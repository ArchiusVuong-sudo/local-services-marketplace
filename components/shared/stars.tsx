import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size === "sm" ? "size-3.5" : "size-4", i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200")} />
      ))}
    </span>
  );
}

export function Rating({ sum, count }: { sum: number; count: number }) {
  if (!count) return <span className="text-sm text-slate-500">No reviews yet</span>;
  const avg = sum / count;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Stars value={avg} />
      <span className="font-semibold text-slate-900">{avg.toFixed(1)}</span>
      <span className="text-slate-500">({count})</span>
    </span>
  );
}
