"use client";

import { CalendarClock, CheckCircle2, Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { postJson } from "@/lib/client/api";
import type { JobStatus } from "@/lib/domain/types";

function toLocalParts(iso: string): { date: string; time: string } {
  // Arizona time (UTC-7, no daylight saving).
  const d = new Date(new Date(iso).getTime() - 7 * 3_600_000);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}

export function JobActions({ jobId, status, suggestedAt }: { jobId: number; status: JobStatus; suggestedAt: string }) {
  const router = useRouter();
  const initial = toLocalParts(suggestedAt);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(body: object) {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/jobs/${jobId}/advance`, body);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (status === "done") return null;
  return (
    <div className="space-y-3" data-testid="job-actions">
      {status === "booked" && (
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="j-date">Visit date</Label>
            <Input id="j-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="w-32">
            <Label htmlFor="j-time">Time</Label>
            <Input id="j-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <Button onClick={() => act({ action: "schedule", scheduled_for: new Date(`${date}T${time}:00-07:00`).toISOString() })} disabled={busy} data-testid="job-schedule">
            {busy ? <Loader2 className="animate-spin" /> : <CalendarClock />} Schedule
          </Button>
        </div>
      )}
      {status === "scheduled" && (
        <Button onClick={() => act({ action: "start" })} disabled={busy} data-testid="job-start">
          {busy ? <Loader2 className="animate-spin" /> : <Play />} Start job
        </Button>
      )}
      {status === "in_progress" && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="j-note">Note for the client</Label>
            <Textarea id="j-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done" data-testid="job-done-note" />
          </div>
          <Button onClick={() => act({ action: "done", note })} disabled={busy} data-testid="job-done">
            {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Mark done
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
    </div>
  );
}
