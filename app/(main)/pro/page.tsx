import { CalendarClock, Coins } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InboxList } from "@/components/pro/inbox-list";
import { PhoneView } from "@/components/pro/phone-view";
import { JobStatusBadge } from "@/components/shared/status";
import { Rating } from "@/components/shared/stars";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/scoped";
import { formatUsd } from "@/lib/domain/money";
import { currentPersona } from "@/lib/server/session";
import { proInbox, proJobs, proProfile } from "@/lib/services/views";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProInbox() {
  const persona = await currentPersona();
  if (persona.role !== "pro") redirect(persona.role === "admin" ? "/admin" : "/");
  const db = await getDb();
  const { leads, jobs, profile } = await asUser(db, persona.id, async (tx) => ({
    leads: await proInbox(tx, persona.id),
    jobs: await proJobs(tx, persona.id),
    profile: (await proProfile(tx, persona.id))!,
  }));
  const fresh = leads.filter((l) => l.status === "new" || l.status === "viewed").length;

  return (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
            <p className="mt-1 text-sm text-slate-500">{fresh} waiting for a quote. You pay the lead fee only when you quote.</p>
          </div>
          <PhoneView />
        </div>
        <Card><InboxList leads={leads} /></Card>
      </section>
      <aside className="col-span-4 space-y-6">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Lead credits</p>
                <p className="mt-1 text-3xl font-semibold" data-testid="credits">{profile.credits}</p>
              </div>
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Coins className="size-5" /></span>
            </div>
            <p className="mt-3 text-xs text-slate-500">Prepaid in test mode. 1 credit = $1. Each quote uses the category lead fee.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Active jobs</CardTitle><span className="text-xs text-slate-500">{jobs.length}</span></CardHeader>
          {jobs.length === 0 ? (
            <CardBody className="text-sm text-slate-500">No active jobs. Hired jobs show up here.</CardBody>
          ) : (
            <ul className="divide-y divide-slate-100">
              {jobs.map((j) => (
                <li key={j.id}>
                  <Link href={`/jobs/${j.id}`} className="block px-5 py-3 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{j.title}</span><JobStatusBadge status={j.status} /></div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      {j.client_display} · {formatUsd(j.price_cents)}
                      {j.scheduled_for && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" /> {formatDateTime(j.scheduled_for)}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardBody className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-slate-400">Your public profile</p>
            <Link href={`/pros/${persona.id}`} className="font-medium hover:underline">{profile.business_name}</Link>
            <div><Rating sum={profile.rating_sum} count={profile.review_count} /></div>
            <p className="text-xs text-slate-500">Serves {profile.category_names.join(", ")} within {profile.radius_mi} mi of {profile.home_zip}.</p>
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}
