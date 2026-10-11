import "server-only";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { listPersonas, type Persona } from "@/lib/services/views";

export const PERSONA_COOKIE = "persona";
export const DEFAULT_PERSONA = "client_maya";

/**
 * Demo sign-in: the "Viewing as" switcher stores a user id in a cookie. The database role and
 * row-level security do the rest. A production build replaces this with real accounts and sessions.
 */
export async function allPersonas(): Promise<Persona[]> {
  const db = await getDb();
  return listPersonas(db);
}

export async function personaById(id: string | undefined): Promise<Persona> {
  const people = await allPersonas();
  return people.find((p) => p.id === id) ?? people.find((p) => p.id === DEFAULT_PERSONA)!;
}

export async function currentPersona(): Promise<Persona> {
  const jar = await cookies();
  return personaById(jar.get(PERSONA_COOKIE)?.value);
}
