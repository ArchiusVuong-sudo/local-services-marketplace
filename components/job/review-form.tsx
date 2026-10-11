"use client";

import { Loader2, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { postJson } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export function ReviewForm({ jobId }: { jobId: number }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/jobs/${jobId}/review`, { rating, body });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="review-form">
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onMouseEnter={() => setHover(i)} onClick={() => setRating(i)} aria-label={`${i} stars`} data-testid={`star-${i}`}>
            <Star className={cn("size-7 transition-colors", i <= (hover || rating) ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300")} />
          </button>
        ))}
        <span className="ml-2 text-sm text-slate-500">{rating ? `${rating} of 5` : "Tap to rate"}</span>
      </div>
      <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="How did it go?" data-testid="review-body" />
      {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
      <Button onClick={submit} disabled={busy || rating === 0} data-testid="submit-review">
        {busy && <Loader2 className="animate-spin" />} Post review
      </Button>
    </div>
  );
}
