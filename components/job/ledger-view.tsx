"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { ACCOUNT_LABEL, formatUsd, type LedgerLine } from "@/lib/domain/money";
import type { LedgerTx } from "@/lib/services/views";
import { cn, formatDateTime } from "@/lib/utils";

export function LedgerView({ transactions }: { transactions: LedgerTx[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-slate-100 pt-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900" data-testid="ledger-toggle">
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        Ledger lines <span className="font-normal text-slate-400">{transactions.length} transactions</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3" data-testid="ledger-lines">
          {transactions.map((t) => {
            const sum = t.lines.reduce((s: number, l: LedgerLine) => s + Number(l.amount_cents), 0);
            return (
              <div key={t.id} className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs">
                  <span className="font-medium text-slate-700">{t.memo}</span>
                  <span className="text-slate-400">{formatDateTime(t.created_at)}</span>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {t.lines.map((l, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-slate-600">{ACCOUNT_LABEL[l.account] ?? l.account}</td>
                        <td className={cn("px-3 py-1.5 text-right font-mono", Number(l.amount_cents) < 0 ? "text-rose-700" : "text-slate-900")}>
                          {Number(l.amount_cents) < 0 ? "-" : "+"}
                          {formatUsd(Math.abs(Number(l.amount_cents)), { cents: true })}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-100 bg-slate-50">
                      <td className="px-3 py-1.5 font-medium text-slate-700">Sum</td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold">
                        <span className={cn("inline-flex items-center gap-1", sum === 0 ? "text-brand-700" : "text-rose-700")} data-testid="ledger-sum">
                          {sum === 0 && <Check className="size-3" />}
                          {formatUsd(sum, { cents: true })}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
