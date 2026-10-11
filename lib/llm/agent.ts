import { createSdkMcpServer, query, tool, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { z } from "zod";

/**
 * One locked-down structured agent call on the Claude Agent SDK.
 * - No built-in Claude Code tools (tools: []); only the app's own in-process MCP tools, each allow-listed.
 * - No settings, project files or user MCP config are loaded; no session is written to disk.
 * - A fresh empty temp folder as cwd, a bounded number of turns, and a permission mode that denies
 *   anything not pre-approved (dontAsk): only the allow-listed app tools can run.
 * - The child process gets an allowlisted environment only.
 */

export type AgentTool<S extends z.ZodRawShape = z.ZodRawShape> = {
  name: string;
  description: string;
  shape: S;
  handler: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>;
};

export type ToolEvent = { name: string; input: unknown; output: unknown; ms: number };

export type StructuredAgentOptions = {
  serverName: string;
  systemPrompt: string;
  prompt: string;
  tools: AgentTool[];
  jsonSchema: Record<string, unknown>;
  model: string;
  maxTurns: number;
  timeoutMs: number;
  onToolStart?: (name: string, input: unknown) => void;
};

export type StructuredAgentResult = {
  output: unknown;
  model: string;
  durationMs: number;
  costUsd: number | null;
  turns: number;
  toolCalls: ToolEvent[];
  attempts: number;
};

export class AgentError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "AgentError";
  }
}

const ENV_ALLOWLIST = ["PATH", "HOME", "USER", "LANG", "TMPDIR"] as const;

export function childEnv(source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ENV_ALLOWLIST) {
    const v = source[key];
    if (v) env[key] = v;
  }
  if (source.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = source.ANTHROPIC_API_KEY;
  return env;
}

export function isRetryable(message: string, status?: number | null): boolean {
  if (status && (status === 429 || status === 529 || status >= 500)) return true;
  return /overloaded|rate.?limit|too many requests|\b429\b|\b5\d\d\b|internal server error|service unavailable|ECONNRESET|ETIMEDOUT|socket hang up/i.test(message);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attempt(opts: StructuredAgentOptions, abort: AbortController): Promise<Omit<StructuredAgentResult, "attempts">> {
  const toolCalls: ToolEvent[] = [];
  const allowed = new Set(opts.tools.map((t) => `mcp__${opts.serverName}__${t.name}`));
  const server = createSdkMcpServer({
    name: opts.serverName,
    version: "1.0.0",
    tools: opts.tools.map((t) =>
      tool(t.name, t.description, t.shape, async (args: unknown) => {
        const started = Date.now();
        opts.onToolStart?.(t.name, args);
        try {
          const output = await t.handler(args as never);
          toolCalls.push({ name: t.name, input: args, output, ms: Date.now() - started });
          return { content: [{ type: "text" as const, text: JSON.stringify(output) }] };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          toolCalls.push({ name: t.name, input: args, output: { error: message }, ms: Date.now() - started });
          return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
        }
      }),
    ),
  });

  const cwd = mkdtempSync(join(tmpdir(), "intake-agent-"));
  const started = Date.now();
  try {
    let result: Extract<SDKMessage, { type: "result" }> | null = null;
    let lastError = "";
    for await (const m of query({
      prompt: opts.prompt,
      options: {
        cwd,
        model: opts.model,
        systemPrompt: opts.systemPrompt,
        tools: [],
        allowedTools: [...allowed],
        mcpServers: { [opts.serverName]: server },
        strictMcpConfig: true,
        settingSources: [],
        persistSession: false,
        permissionMode: "dontAsk",
        maxTurns: opts.maxTurns,
        outputFormat: { type: "json_schema", schema: opts.jsonSchema },
        env: childEnv(),
        abortController: abort,
        stderr: (d: string) => {
          lastError = d.slice(-400);
        },
      },
    })) {
      if (m.type === "assistant" && "error" in m && m.error) lastError = String(m.error);
      if (m.type === "result") result = m;
    }
    if (!result) throw new AgentError(`No result from the agent. ${lastError}`.trim(), isRetryable(lastError));
    const used = Object.keys(result.modelUsage ?? {});
    const model = used.includes(opts.model) ? opts.model : (used[0] ?? opts.model);
    if (result.subtype !== "success" || result.is_error) {
      const text = "result" in result ? String(result.result) : result.subtype;
      const status = "api_error_status" in result ? (result.api_error_status as number | null) : null;
      throw new AgentError(`Agent ended with ${result.subtype}: ${text} ${lastError}`.trim(), isRetryable(`${text} ${lastError}`, status));
    }
    return {
      output: result.structured_output,
      model,
      durationMs: Date.now() - started,
      costUsd: typeof result.total_cost_usd === "number" ? result.total_cost_usd : null,
      turns: result.num_turns,
      toolCalls,
    };
  } catch (e) {
    if (e instanceof AgentError) throw e;
    const message = e instanceof Error ? e.message : String(e);
    if (abort.signal.aborted) throw new AgentError("Timed out", false);
    throw new AgentError(message, isRetryable(message));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/** Runs the agent, retrying with backoff on overloaded, rate-limit and 5xx errors, inside one overall deadline. */
export async function runStructuredAgent(opts: StructuredAgentOptions): Promise<StructuredAgentResult> {
  const deadline = Date.now() + opts.timeoutMs;
  const started = Date.now();
  let lastError: AgentError | null = null;
  for (let i = 0; i < 4; i++) {
    const remaining = deadline - Date.now();
    if (remaining < 3000) break;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), remaining);
    try {
      const r = await attempt(opts, abort);
      return { ...r, durationMs: Date.now() - started, attempts: i + 1 };
    } catch (e) {
      lastError = e instanceof AgentError ? e : new AgentError(String(e), false);
      if (!lastError.retryable) throw lastError;
      const wait = Math.min(1500 * 2 ** i + Math.floor(Math.random() * 500), Math.max(0, deadline - Date.now() - 3000));
      if (wait > 0) await sleep(wait);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new AgentError("Timed out", false);
}
