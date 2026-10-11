import { ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/app/avatar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { one } from "@/lib/db/sql";
import { HERO } from "@/lib/seed/people";
import { currentPersona } from "@/lib/server/session";
import { ACCESS_TABLES, dataAccessMatrix } from "@/lib/services/admin";

export const dynamic = "force-dynamic";

const TABLE_LABEL: Record<(typeof ACCESS_TABLES)[number], string> = {
  service_requests: "Requests",
  leads: "Leads",
  quotes: "Quotes",
  jobs: "Jobs",
  user_contacts: "Contact details",
  ledger_transactions: "Ledger transactions",
  notifications: "Notifications",
  intake_runs: "Intake runs",
};

export default async function DataAccessPage() {
  const persona = await currentPersona();
  if (persona.role !== "admin") redirect("/");
  const db = await getDb();
  const matrix = await dataAccessMatrix(db);
  const heroLead = await one<{ id: number }>(db, "select id from leads where pro_id = $1 order by created_at desc, id desc limit 1", [HERO.pro]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><ShieldCheck className="size-6 text-brand-700" /> Data access</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Rows each person can read, counted live through the same database policies the app uses. Each count runs as that person in its own
          transaction under a non-superuser role, so the database, not the page, decides what comes back.
        </p>
      </div>
      <Card>
        <table className="w-full text-sm" data-testid="access-matrix">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">Table</th>
              <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">All rows</th>
              {matrix.people.map((p) => (
                <th key={p.id} className="px-3 py-3 text-right">
                  <span className="inline-flex items-center gap-2 font-medium text-slate-800"><Avatar name={p.display_name} role={p.role as "client" | "pro" | "admin"} small />{p.display_name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ACCESS_TABLES.map((t) => (
              <tr key={t}>
                <td className="px-5 py-3 text-slate-700">{TABLE_LABEL[t]}</td>
                <td className="px-3 py-3 text-right text-slate-500">{matrix.totals[t]}</td>
                {matrix.people.map((p) => {
                  const v = matrix.visible[p.id]?.[t] ?? 0;
                  const all = v === matrix.totals[t];
                  return (
                    <td key={p.id} className="px-3 py-3 text-right" data-testid={`access-${p.id}-${t}`}>
                      <span className={all ? "font-semibold text-violet-800" : v === 0 ? "text-slate-400" : "font-semibold text-slate-900"}>{v}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>What the policies say</CardTitle></CardHeader>
          <CardBody className="space-y-2 text-sm text-slate-600">
            <p>Clients see their own requests, the leads and quotes on them, and their own jobs.</p>
            <p>Pros see only leads sent to them, their own quotes and the jobs they were hired for.</p>
            <p>Contact details open only to yourself, an admin, or the other side of a hired job.</p>
            <p>Quotes can only be written by the pro who owns the lead. Reviews only by the client of a done job, once.</p>
            <p>Admins can read everything and pause sponsored placements.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Try it</CardTitle></CardHeader>
          <CardBody className="space-y-3 text-sm text-slate-600">
            <p>Switch &ldquo;Viewing as&rdquo; to Brightline Electric (another pro) and open Pipewright Plumbing&apos;s newest lead. The database returns no row, so the page says Not found.</p>
            {heroLead && (
              <Link href={`/pro/leads/${heroLead.id}`} className="inline-flex items-center gap-1.5 font-medium text-brand-800 hover:underline" data-testid="hero-lead-link">
                /pro/leads/{heroLead.id} <ExternalLink className="size-3.5" />
              </Link>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
