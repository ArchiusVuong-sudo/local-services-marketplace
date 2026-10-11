import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type Env = Readonly<Record<string, string | undefined>>;

export type IntakeMode = "live" | "replay" | "rules";

/** True when a Claude Code login or an API key is present on this machine. */
export function hasClaudeLogin(env: Env = process.env): boolean {
  if (env.ANTHROPIC_API_KEY) return true;
  const home = env.HOME ?? homedir();
  if (existsSync(join(home, ".claude", ".credentials.json"))) return true;
  try {
    const cfg = JSON.parse(readFileSync(join(home, ".claude.json"), "utf8")) as { oauthAccount?: unknown };
    return Boolean(cfg.oauthAccount);
  } catch {
    return false;
  }
}

/** live when the SDK can run, replay when DEMO_REPLAY=1 or no login or key is found. INTAKE_MODE overrides. */
export function intakeMode(env: Env = process.env): IntakeMode {
  const forced = env.INTAKE_MODE?.trim();
  if (forced === "live" || forced === "replay" || forced === "rules") return forced;
  if (env.DEMO_REPLAY === "1") return "replay";
  return hasClaudeLogin(env) ? "live" : "replay";
}

export function intakeModel(env: Env = process.env): string {
  return env.INTAKE_MODEL?.trim() || "claude-sonnet-5-5";
}

export function intakeTimeoutMs(env: Env = process.env): number {
  const s = Number(env.INTAKE_TIMEOUT_S ?? 45);
  return Number.isFinite(s) && s > 0 ? s * 1000 : 45_000;
}
