import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/client";
import { NotFoundError, RuleError } from "@/lib/db/sql";
import type { Persona } from "@/lib/services/views";
import { PERSONA_COOKIE, personaById } from "./session";

export type RouteCtx = { db: Db; persona: Persona; req: NextRequest };

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof ZodError) {
    const issue = e.issues[0];
    return NextResponse.json({ error: issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Invalid input" }, { status: 400 });
  }
  if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (e instanceof RuleError) return NextResponse.json({ error: e.message }, { status: 409 });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** Wraps a route handler: resolves the persona, parses errors into clean JSON responses. */
export function route<P = Record<string, string>>(
  fn: (ctx: RouteCtx, params: P) => Promise<unknown>,
): (req: NextRequest, ctx: { params: Promise<P> }) => Promise<NextResponse> {
  return async (req, ctx) => {
    try {
      const db = await getDb();
      const persona = await personaById(req.cookies.get(PERSONA_COOKIE)?.value);
      const result = await fn({ db, persona, req }, await ctx.params);
      return result instanceof NextResponse ? result : NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function body(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function intParam(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new NotFoundError();
  return n;
}

export function requireRole(persona: Persona, role: Persona["role"]): void {
  if (persona.role !== role) throw new RuleError(`Switch to a ${role} account to do this`);
}
