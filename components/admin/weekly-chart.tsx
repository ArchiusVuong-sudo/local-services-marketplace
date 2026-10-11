"use client";

import { useState } from "react";

type Week = { week: string; requests: number; hires: number };

const SERIES = [
  { key: "requests" as const, label: "Requests", color: "#2a78d6" },
  { key: "hires" as const, label: "Hires", color: "#1baf7a" },
];

/** Requests and hires per week. Grouped bars, one axis, direct value labels, hover tooltip. */
export function WeeklyChart({ weeks }: { weeks: Week[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const pad = { l: 32, r: 8, t: 18, b: 28 };
  const max = Math.max(5, ...weeks.flatMap((w) => [w.requests, w.hires]));
  const step = Math.ceil(max / 4 / 5) * 5;
  const top = step * 4;
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const group = plotW / weeks.length;
  const bar = Math.min(18, (group - 12) / 2);
  const y = (v: number) => pad.t + plotH - (v / top) * plotH;
  const label = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-4 text-xs text-slate-600">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>
        ))}
        <span className="text-slate-400">per week, synthetic history</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Requests and hires per week" data-testid="weekly-chart">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(i * step)} y2={y(i * step)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.l - 6} y={y(i * step) + 3} textAnchor="end" fontSize={10} fill="#94a3b8">{i * step}</text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const x0 = pad.l + i * group + (group - (bar * 2 + 2)) / 2;
          return (
            <g key={w.week} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * group} y={pad.t} width={group} height={plotH} fill={hover === i ? "#f1f5f9" : "transparent"} />
              {SERIES.map((s, j) => {
                const v = w[s.key];
                const x = x0 + j * (bar + 2);
                const h = Math.max(0, y(0) - y(v));
                return (
                  <g key={s.key}>
                    {h > 0 && <path d={`M${x},${y(0)} v${-(h - 4)} q0,-4 4,-4 h${bar - 8} q4,0 4,4 v${h - 4} z`} fill={s.color} />}
                    <text x={x + bar / 2} y={y(v) - 4} textAnchor="middle" fontSize={9.5} fill="#475569">{v}</text>
                  </g>
                );
              })}
              <text x={pad.l + i * group + group / 2} y={H - 10} textAnchor="middle" fontSize={10} fill="#64748b">{label(w.week)}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && weeks[hover] && (
        <div className="pointer-events-none absolute top-6 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg" style={{ left: `${((hover + 0.5) / weeks.length) * 92 + 2}%`, transform: "translateX(-50%)" }}>
          <p className="font-medium">Week of {label(weeks[hover].week)}</p>
          <p>{weeks[hover].requests} requests · {weeks[hover].hires} hires</p>
        </div>
      )}
    </div>
  );
}
