import { NextResponse } from "next/server";
import { z } from "zod";
import { body, route } from "@/lib/server/http";
import { allPersonas, PERSONA_COOKIE } from "@/lib/server/session";
import { NotFoundError } from "@/lib/db/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOME = { client: "/", pro: "/pro", admin: "/admin" } as const;

export const POST = route(async ({ req }) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(await body(req));
  const p = (await allPersonas()).find((x) => x.id === id);
  if (!p) throw new NotFoundError();
  const res = NextResponse.json({ id: p.id, role: p.role, home: HOME[p.role] });
  res.cookies.set(PERSONA_COOKIE, p.id, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
});
