"use client";

import { ArrowRight, Check, ChevronDown, CircleDashed, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { postJson } from "@/lib/client/api";
import type { Category, Timing } from "@/lib/domain/types";
import { TIMING_LABEL } from "@/lib/domain/types";
import type { IntakeStep } from "@/lib/intake/schema";
import type { IntakeResult } from "@/lib/services/intake";
import { cn } from "@/lib/utils";

type StepState = Record<IntakeStep["id"], { status: "pending" | "active" | "done"; detail?: string }>;

const STEP_LABEL: Record<IntakeStep["id"], string> = {
  read: "Reading your note",
  search: "Searching categories",
  fill: "Filling in the request",
};

const INITIAL_STEPS: StepState = { read: { status: "pending" }, search: { status: "pending" }, fill: { status: "pending" } };

const PATH_LABEL = {
  live: { text: "Read by the intake agent", tone: "brand" as const },
  replay: { text: "Replayed agent run", tone: "violet" as const },
  rules: { text: "Read by the rules parser", tone: "neutral" as const },
};

type Draft = {
  category_slug: string;
  zip: string;
  timing: Timing | "";
  budget: string;
  title: string;
  details: string;
  answers: Record<string, string>;
};

export function IntakeFlow({ categories, samples }: { categories: Category[]; samples: string[] }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<"idle" | "reading" | "draft" | "sending">("idle");
  const [steps, setSteps] = useState<StepState>(INITIAL_STEPS);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(false);

  const category = useMemo(() => categories.find((c) => c.slug === draft?.category_slug), [categories, draft?.category_slug]);

  async function read() {
    setError(null);
    setResult(null);
    setDraft(null);
    setShowTrace(false);
    setSteps(INITIAL_STEPS);
    setPhase("reading");
    try {
      const res = await fetch("/api/intake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note }) });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Could not read the note");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const msg = JSON.parse(line) as { type: "step"; step: IntakeStep } | { type: "result"; result: IntakeResult } | { type: "error"; error: string };
          if (msg.type === "step") {
            const order: IntakeStep["id"][] = ["read", "search", "fill"];
            setSteps((s) => {
              const next = { ...s, [msg.step.id]: { status: msg.step.status, detail: msg.step.detail ?? s[msg.step.id].detail } };
              for (const id of order.slice(0, order.indexOf(msg.step.id))) next[id] = { ...next[id], status: "done" };
              return next;
            });
          } else if (msg.type === "result") {
            const r = msg.result;
            setSteps((s) => ({ read: { status: "done" }, search: { status: "done", detail: s.search.detail }, fill: { status: "done" } }));
            setResult(r);
            setDraft({
              category_slug: r.output.category_slug,
              zip: r.output.zip ?? "",
              timing: r.output.timing ?? "",
              budget: r.output.budget_usd ? String(r.output.budget_usd) : "",
              title: r.output.title,
              details: r.output.details,
              answers: Object.fromEntries(r.output.answers.map((a) => [a.question_id, a.answer])),
            });
            setPhase("draft");
          } else {
            throw new Error(msg.error);
          }
        }
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  }

  async function send() {
    if (!draft || !result) return;
    setError(null);
    setPhase("sending");
    try {
      const budget = draft.budget.trim() ? Number(draft.budget.replace(/[$,\s]/g, "")) : null;
      const r = await postJson<{ id: number }>("/api/requests", {
        category_slug: draft.category_slug,
        zip: draft.zip.trim(),
        timing: draft.timing || "flexible",
        budget_usd: budget !== null && Number.isFinite(budget) ? Math.round(budget) : null,
        title: draft.title,
        details: draft.details,
        answers: Object.entries(draft.answers).filter(([, v]) => v).map(([question_id, answer]) => ({ question_id, answer })),
        note,
        intake_run_id: result.id,
      });
      router.push(`/requests/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setPhase("draft");
    }
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const fromNote = new Set(result?.output.answers.map((a) => a.question_id) ?? []);
  const missingCore = draft ? [!draft.zip && "ZIP code", !draft.timing && "timing"].filter(Boolean) : [];

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-brand-50 via-white to-white px-7 pb-6 pt-7">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Describe your job</h1>
          <p className="mt-1 text-[15px] text-slate-600">One or two sentences is enough. We fill in the request and send it to the best-fit local pros.</p>
          <div className="mt-5">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="For example: Water heater leaking in the garage, 85016. Need it fixed this week, budget about $450"
              className="resize-none bg-white text-[15px]"
              data-testid="intake-note"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && note.trim().length >= 8) void read();
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="lg" onClick={read} disabled={note.trim().length < 8 || phase === "reading" || phase === "sending"} data-testid="get-quotes">
              {phase === "reading" ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Get quotes
            </Button>
            <span className="ml-2 text-xs text-slate-500">Try:</span>
            {samples.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setNote(s)}
                className="max-w-64 truncate rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand-300 hover:text-brand-800"
                title={s}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {phase !== "idle" && (
          <div className="flex items-center gap-6 border-t border-slate-100 bg-white px-7 py-3.5" data-testid="intake-steps">
            {(Object.keys(STEP_LABEL) as IntakeStep["id"][]).map((id) => {
              const s = steps[id];
              return (
                <div key={id} className="flex items-center gap-2 text-sm">
                  {s.status === "done" ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-white"><Check className="size-3" /></span>
                  ) : s.status === "active" ? (
                    <Loader2 className="size-5 animate-spin text-brand-600" />
                  ) : (
                    <CircleDashed className="size-5 text-slate-300" />
                  )}
                  <span className={cn(s.status === "pending" ? "text-slate-400" : "text-slate-800")}>
                    {STEP_LABEL[id]}
                    {id === "search" && s.detail ? <span className="text-slate-500"> for &ldquo;{s.detail}&rdquo;</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <TriangleAlert className="size-4" /> {error}
        </div>
      )}

      {draft && result && category && (
        <Card data-testid="request-draft">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-7 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[17px] font-semibold">Your request</h2>
              <Badge tone={PATH_LABEL[result.path].tone}>{PATH_LABEL[result.path].text}</Badge>
              {result.cached && <Badge tone="outline">Cached reading</Badge>}
            </div>
            <span className="text-xs text-slate-500">Check it, change anything, then send.</span>
          </div>

          <div className="grid grid-cols-12 gap-x-5 gap-y-4 px-7 py-5">
            <div className="col-span-4">
              <Label htmlFor="f-cat">Category</Label>
              <Select id="f-cat" value={draft.category_slug} onChange={(e) => set({ category_slug: e.target.value, answers: {} })} data-testid="draft-category">
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="f-zip">ZIP</Label>
              <Input id="f-zip" value={draft.zip} onChange={(e) => set({ zip: e.target.value })} inputMode="numeric" maxLength={5} placeholder="85016" className={cn(!draft.zip && "border-amber-300 bg-amber-50/50")} data-testid="draft-zip" />
            </div>
            <div className="col-span-3">
              <Label htmlFor="f-when">When</Label>
              <Select id="f-when" value={draft.timing} onChange={(e) => set({ timing: e.target.value as Timing })} className={cn(!draft.timing && "border-amber-300 bg-amber-50/50")} data-testid="draft-timing">
                <option value="">Choose...</option>
                {(Object.keys(TIMING_LABEL) as Timing[]).map((t) => (
                  <option key={t} value={t}>{TIMING_LABEL[t]}</option>
                ))}
              </Select>
            </div>
            <div className="col-span-3">
              <Label htmlFor="f-budget">Budget</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                <Input id="f-budget" value={draft.budget} onChange={(e) => set({ budget: e.target.value })} inputMode="numeric" placeholder="Optional" className="pl-6" data-testid="draft-budget" />
              </div>
            </div>
            <div className="col-span-5">
              <Label htmlFor="f-title">Title</Label>
              <Input id="f-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} />
            </div>
            <div className="col-span-7">
              <Label htmlFor="f-details">Details</Label>
              <Input id="f-details" value={draft.details} onChange={(e) => set({ details: e.target.value })} maxLength={600} />
            </div>
          </div>

          <div className="border-t border-slate-100 px-7 py-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                {category.questions.some((q) => !fromNote.has(q.id)) ? "A few quick questions for the pros" : "Details for the pros"}
              </h3>
              <span className="text-xs text-slate-500">Optional. Answers help pros quote accurately.</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {category.questions.map((q) => (
                <div key={q.id} data-testid={`question-${q.id}`}>
                  <p className="mb-2 flex items-center gap-2 text-sm text-slate-700">
                    {q.text}
                    {fromNote.has(q.id) && draft.answers[q.id] === result.output.answers.find((a) => a.question_id === q.id)?.answer && (
                      <Badge tone="brand">From your note</Badge>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(q.options ?? []).map((o) => {
                      const on = draft.answers[q.id] === o;
                      return (
                        <button
                          key={o}
                          type="button"
                          onClick={() => set({ answers: { ...draft.answers, [q.id]: on ? "" : o } })}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300",
                          )}
                        >
                          {o}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 px-7 py-3">
            <button type="button" onClick={() => setShowTrace((v) => !v)} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900" data-testid="how-read">
              <ChevronDown className={cn("size-4 transition-transform", showTrace && "rotate-180")} />
              How this was read
              <span className="font-normal text-slate-400">
                {result.tool_calls.length} tool call{result.tool_calls.length === 1 ? "" : "s"}, {(result.duration_ms / 1000).toFixed(1)} s
              </span>
            </button>
            {showTrace && <IntakeTrace result={result} />}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-b-xl border-t border-slate-100 bg-slate-50/70 px-7 py-4">
            <p className="text-sm text-slate-500">
              {missingCore.length ? (
                <span className="text-amber-700">Add the {missingCore.join(" and ")} to send.</span>
              ) : (
                <>Goes to up to 4 matched pros. Your phone and email stay hidden until you hire.</>
              )}
            </p>
            <Button size="lg" onClick={send} disabled={phase === "sending" || missingCore.length > 0 || draft.title.trim().length < 3} data-testid="send-to-pros">
              {phase === "sending" ? <Loader2 className="animate-spin" /> : null}
              Send to pros <ArrowRight />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function IntakeTrace({ result }: { result: IntakeResult }) {
  const pathText = { live: "Live agent call", replay: "Replay of a recorded live agent run", rules: "Rules parser (no model)" }[result.path];
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm" data-testid="intake-trace">
      <dl className="grid grid-cols-4 gap-3">
        <Meta label="Path" value={pathText} />
        <Meta label="Model" value={result.model ?? "none"} />
        <Meta label={result.path === "replay" ? "Time (recorded live run)" : "Time"} value={`${(result.duration_ms / 1000).toFixed(1)} s`} />
        <Meta label="Cost" value={result.cost_usd === null ? "none" : `$${Number(result.cost_usd).toFixed(4)} (estimate)`} />
      </dl>
      {result.fallback_reason && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{result.fallback_reason}</p>}
      <ol className="space-y-2">
        {result.tool_calls.map((c, i) => {
          const hits = Array.isArray(c.output) ? (c.output as { slug: string; name: string; score: number }[]) : [];
          return (
            <li key={i} className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <div className="font-mono text-xs text-slate-700">
                {i + 1}. {c.name}({JSON.stringify(c.input)})
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {hits.map((h) => (
                  <Badge key={h.slug} tone={h.slug === result.output.category_slug ? "brand" : "outline"}>
                    {h.name} <span className="opacity-60">score {h.score}</span>
                  </Badge>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-slate-500">The output was checked against the request schema and the categories table before it was shown. Run #{result.id} is saved in the intake log.</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{value}</dd>
    </div>
  );
}
