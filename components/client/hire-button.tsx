"use client";

import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { postJson } from "@/lib/client/api";
import { formatUsd, payoutCents, platformFeeCents } from "@/lib/domain/money";

export function HireButton({ quoteId, proName, priceCents, priceType }: { quoteId: number; proName: string; priceCents: number; priceType: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const r = await postJson<{ jobId: number }>(`/api/quotes/${quoteId}/hire`);
      router.push(`/jobs/${r.jobId}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full" data-testid={`hire-${quoteId}`}>Hire</Button>
      </DialogTrigger>
      <DialogContent title={`Hire ${proName}`} description="Your payment is held, not paid out, until the pro marks the job done.">
        <dl className="space-y-2 rounded-lg border border-slate-200 p-4 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Quote ({priceType})</dt><dd className="font-medium">{formatUsd(priceCents)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Held now</dt><dd className="font-medium">{formatUsd(priceCents)}</dd></div>
          <div className="flex justify-between border-t border-slate-100 pt-2"><dt className="text-slate-500">Pro gets when done</dt><dd>{formatUsd(payoutCents(priceCents))}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Platform fee (10%, paid by the pro)</dt><dd>{formatUsd(platformFeeCents(priceCents))}</dd></div>
        </dl>
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">
          <Lock className="size-3.5" /> Test mode: a simulated payment. No card is charged and no payment provider is called.
        </p>
        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
          <Button onClick={confirm} disabled={busy} data-testid="confirm-hire">
            {busy && <Loader2 className="animate-spin" />}
            Confirm and hold {formatUsd(priceCents)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
