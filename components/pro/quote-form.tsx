"use client";

import { Coins, EyeOff, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { postJson } from "@/lib/client/api";
import { maskContactDetails } from "@/lib/domain/masking";
import { cn } from "@/lib/utils";

function defaultDate(): string {
  const d = new Date(Date.now() + 2 * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function QuoteForm({ leadId, fee, credits, suggested }: { leadId: number; fee: number; credits: number; suggested: number | null }) {
  const router = useRouter();
  const [price, setPrice] = useState(suggested ? String(suggested) : "");
  const [type, setType] = useState<"fixed" | "estimate">("fixed");
  const [date, setDate] = useState(defaultDate());
  const [time, setTime] = useState("09:00");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const masked = useMemo(() => maskContactDetails(message), [message]);
  const enough = credits >= fee;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Times are entered in the job's local time (Arizona has no daylight saving: UTC-7).
      const available_at = new Date(`${date}T${time}:00-07:00`).toISOString();
      await postJson(`/api/leads/${leadId}/quote`, { price_usd: Number(price.replace(/[$,\s]/g, "")), price_type: type, available_at, message });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="quote-form">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="q-price">Price</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
            <Input id="q-price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" required className="pl-6" data-testid="quote-price" />
          </div>
        </div>
        <div>
          <Label>Type</Label>
          <div className="grid h-10 grid-cols-2 rounded-lg border border-slate-200 p-0.5 text-sm">
            {(["fixed", "estimate"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn("rounded-md capitalize", type === t ? "bg-brand-700 font-medium text-white" : "text-slate-600 hover:bg-slate-50")}
                data-testid={`quote-type-${t}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="q-date">Can start</Label>
          <Input id="q-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required data-testid="quote-date" />
        </div>
        <div>
          <Label htmlFor="q-time">Time</Label>
          <Input id="q-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required data-testid="quote-time" />
        </div>
      </div>
      <div>
        <Label htmlFor="q-msg">Message to the client</Label>
        <Textarea id="q-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} required placeholder="What's included, what you'll check first..." data-testid="quote-message-input" />
        {(masked.phones > 0 || masked.emails > 0) && (
          <p className="mt-2 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600" data-testid="mask-preview">
            <EyeOff className="mt-0.5 size-3.5 shrink-0" />
            <span>The client sees: &ldquo;{masked.text}&rdquo;. Contact details open to both sides after hire.</span>
          </p>
        )}
      </div>
      <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm", enough ? "bg-brand-50 text-brand-900" : "bg-rose-50 text-rose-800")}>
        <Coins className="size-4" />
        {enough ? <>Sending uses <b>{fee} credits</b> of your {credits}.</> : <>This lead needs {fee} credits and you have {credits}.</>}
      </div>
      {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy || !enough || !price || !message.trim()} data-testid="send-quote">
        {busy ? <Loader2 className="animate-spin" /> : <Send />}
        Send quote
      </Button>
    </form>
  );
}
