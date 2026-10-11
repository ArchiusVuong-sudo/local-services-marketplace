import type { JobStatus } from "./types";

/** The only allowed forward moves. The database enforces the same table in a trigger. */
export const NEXT_STATUS: Record<JobStatus, JobStatus | null> = {
  booked: "scheduled",
  scheduled: "in_progress",
  in_progress: "done",
  done: null,
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  booked: "Booked",
  scheduled: "Scheduled",
  in_progress: "In progress",
  done: "Done",
};

export const JOB_STEPS: JobStatus[] = ["booked", "scheduled", "in_progress", "done"];

export function canMove(from: JobStatus, to: JobStatus): boolean {
  return NEXT_STATUS[from] === to;
}

export function assertMove(from: JobStatus, to: JobStatus): void {
  if (!canMove(from, to)) throw new Error(`A job can't go from ${JOB_STATUS_LABEL[from]} to ${JOB_STATUS_LABEL[to]}`);
}
