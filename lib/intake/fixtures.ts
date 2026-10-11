import recorded from "@/fixtures/intake-runs.json";
import type { IntakeOutput, ToolCallTrace } from "./schema";

/** A live agent run recorded by scripts/record-fixtures.ts, replayed when there is no login or DEMO_REPLAY=1. */
export type RecordedRun = {
  note: string;
  model: string;
  duration_ms: number;
  cost_usd: number | null;
  turns: number;
  tool_calls: ToolCallTrace[];
  output: IntakeOutput;
  recorded_at: string;
};

export type FixtureFile = { recorded_with: { sdk: string; model: string }; runs: RecordedRun[] };

export const FIXTURE_PATH = "fixtures/intake-runs.json";

export function normalizeNote(note: string): string {
  return note.trim().toLowerCase().replace(/\s+/g, " ");
}

let cache: Map<string, RecordedRun> | null = null;

/** Recorded runs keyed by normalized note. Pass a file's contents to use other recordings (tests). */
export function loadFixtures(file: FixtureFile = recorded as FixtureFile): Map<string, RecordedRun> {
  if (cache && file === recorded) return cache;
  const map = new Map<string, RecordedRun>();
  for (const run of file.runs) map.set(normalizeNote(run.note), run);
  if (file === recorded) cache = map;
  return map;
}
