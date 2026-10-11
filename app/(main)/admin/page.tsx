import { CheckCircle2, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PromotionToggle } from "@/components/admin/promotion-toggle";
import { WeeklyChart } from "@/components/admin/weekly-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/scoped";
import { formatUsd } from "@/lib/domain/money";
import { currentPersona } from "@/lib/server/session";
import { dashboardStats, promotionRows } from "@/lib/services/admin";
import { formatMinutes } from "@/lib/utils";

export const dynamic = "force-dynamic";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "0%");

export default async function AdminDashboard() {
  const persona = await currentPersona();
  if (persona.role !== "admin") redirect(persona.role === "pro" ? "/pro" : "/");
  const db = await getDb();
  const { stats, promos } = await asUser(db, persona.id, async (tx) => ({ stats: await dashboardStats(tx), promos: await promotionRows(tx) }));
  const { funnel, money, ledger } = stats;
  const revenue = money.payment_fees_cents + money.lead_fees_cents;
  const steps = [
    { label: "Requests", value: funnel.requests, conv: "" },
    { label: "Got a quote", value: funnel.quoted, conv: pct(funnel.quoted, funnel.requests) },
    { label: "Hired", value: funnel.hired, conv: pct(funnel.hired, funnel.quoted) },
    { label: "Done", value: funnel.done, conv: pct(funnel.done, funnel.hired) },
  ];
  const balanced = ledger.unbalanced === 0 && ledger.total_cents === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketplace dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Phoenix launch market. Eight weeks of synthetic history plus anything done in this demo.</p>
        </div>
        <Link href="/admin/access" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-800 hover:underline"><ShieldCheck className="size-4" /> Data access check</Link>
      </div>

      <div className="grid grid-cols-4 gap-4" data-testid="kpis">
        <Kpi label="Money through the platform" value={formatUsd(money.gmv_cents)} sub={`${funnel.hired} hired jobs, test mode`} />
        <Kpi label="Platform revenue" value={formatUsd(revenue)} sub={`${formatUsd(money.lead_fees_cents)} lead fees · ${formatUsd(money.payment_fees_cents)} payment fees`} />
        <Kpi label="Median time to first quote" value={stats.median_first_quote_min === null ? "none" : formatMinutes(stats.median_first_quote_min)} sub="from request to the first quote" />
        <Card className={balanced ? "border-brand-200" : "border-rose-300"} data-testid="ledger-check">
          <CardBody>
            <p className="text-xs uppercase tracking-wide text-slate-400">Ledger check</p>
            <p className={`mt-1 flex items-center gap-2 text-lg font-semibold ${balanced ? "text-brand-800" : "text-rose-700"}`}>
              {balanced ? <CheckCircle2 className="size-5" /> : <TriangleAlert className="size-5" />}
              {balanced ? "All transactions balance" : `${ledger.unbalanced} unbalanced`}
            </p>
            <p className="mt-1 text-xs text-slate-500">{ledger.transactions} transactions · ledger total {formatUsd(ledger.total_cents, { cents: true })}</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-5">
          <CardHeader><CardTitle>Funnel</CardTitle><span className="text-xs text-slate-500">conversion from the step before</span></CardHeader>
          <CardBody className="space-y-3" data-testid="funnel">
            {steps.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="text-slate-700">{s.label}</span>
                  <span><b className="font-semibold">{s.value}</b> {s.conv && <span className="text-xs text-slate-500">{s.conv}</span>}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100">
                  <div className="h-2.5 rounded-full bg-brand-600" style={{ width: `${funnel.requests ? (s.value / funnel.requests) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-xs">
              <Mini label="Held now" value={formatUsd(money.held_now_cents)} />
              <Mini label="Paid out to pros" value={formatUsd(money.paid_out_cents)} />
              <Mini label="Revenue / money through" value={pct(revenue, money.gmv_cents)} />
            </div>
          </CardBody>
        </Card>
        <Card className="col-span-7">
          <CardHeader><CardTitle>Weekly activity</CardTitle></CardHeader>
          <CardBody><WeeklyChart weeks={stats.weekly} /></CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-4">
          <CardHeader><CardTitle>Top categories</CardTitle></CardHeader>
          <table className="w-full text-sm" data-testid="top-categories">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400"><th className="px-5 py-2 font-medium">Category</th><th className="px-3 py-2 text-right font-medium">Requests</th><th className="px-5 py-2 text-right font-medium">Hires</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {stats.top_categories.map((c) => (
                <tr key={c.name}><td className="px-5 py-2.5">{c.name}</td><td className="px-3 py-2.5 text-right">{c.requests}</td><td className="px-5 py-2.5 text-right">{c.hires}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="col-span-8">
          <CardHeader>
            <div>
              <CardTitle>Sponsored placements</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">Shown only for verified pros that already pass the match floor, always labelled Sponsored, at most one per request.</p>
            </div>
          </CardHeader>
          <table className="w-full text-sm" data-testid="promotions">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400"><th className="px-5 py-2 font-medium">Pro</th><th className="px-3 py-2 font-medium">Category</th><th className="px-3 py-2 text-right font-medium">Shown</th><th className="px-3 py-2 text-right font-medium">Quotes</th><th className="px-3 py-2 text-right font-medium">Hires</th><th className="px-3 py-2 font-medium">Status</th><th className="px-5 py-2" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {promos.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2.5"><Link href={`/pros/${p.pro_id}`} className="hover:underline">{p.business_name}</Link></td>
                  <td className="px-3 py-2.5 text-slate-600">{p.category_name}</td>
                  <td className="px-3 py-2.5 text-right">{p.placements}</td>
                  <td className="px-3 py-2.5 text-right">{p.quotes}</td>
                  <td className="px-3 py-2.5 text-right">{p.hires}</td>
                  <td className="px-3 py-2.5">
                    {!p.verified ? <Badge tone="rose">Not eligible: unverified</Badge> : p.status === "active" ? <Badge tone="brand">Active</Badge> : <Badge>Paused</Badge>}
                  </td>
                  <td className="px-5 py-2.5 text-right"><PromotionToggle id={p.id} status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{sub}</p>
      </CardBody>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400">{label}</p>
      <p className="mt-0.5 font-medium text-slate-800">{value}</p>
    </div>
  );
}
