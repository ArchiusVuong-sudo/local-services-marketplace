import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IntakeFlow } from "@/components/client/intake-flow";
import { RequestStatusBadge } from "@/components/shared/status";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/scoped";
import { HERO_NOTE, SAMPLE_NOTES } from "@/lib/intake/samples";
import { currentPersona } from "@/lib/server/session";
import { listCategories } from "@/lib/services/catalog";
import { myRequests } from "@/lib/services/views";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientHome() {
  const persona = await currentPersona();
  if (persona.role === "pro") redirect("/pro");
  if (persona.role === "admin") redirect("/admin");
  const db = await getDb();
  const { categories, requests } = await asUser(db, persona.id, async (tx) => ({
    categories: await listCategories(tx),
    requests: await myRequests(tx, persona.id),
  }));
  const samples = [HERO_NOTE, SAMPLE_NOTES[1]!.note, SAMPLE_NOTES[4]!.note];

  return (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-8">
        <p className="mb-3 text-sm text-slate-500">Hi {persona.first_name}. Phoenix-area pros, matched to your job.</p>
        <IntakeFlow categories={categories} samples={samples} />
      </section>
      <aside className="col-span-4">
        <Card>
          <CardHeader>
            <CardTitle>Your requests</CardTitle>
            <span className="text-xs text-slate-500">{requests.length}</span>
          </CardHeader>
          {requests.length === 0 ? (
            <CardBody className="py-10 text-center">
              <ClipboardList className="mx-auto size-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">No requests yet. Describe a job to get quotes.</p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-slate-100" data-testid="my-requests">
              {requests.map((r) => (
                <li key={r.id}>
                  <Link href={r.job_id ? `/jobs/${r.job_id}` : `/requests/${r.id}`} className="block px-5 py-3.5 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-slate-900">{r.title}</span>
                      <RequestStatusBadge status={r.status} jobStatus={r.job_status} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {r.category_name} · {r.zip} · {r.quote_count} quote{r.quote_count === 1 ? "" : "s"} from {r.lead_count} pros · {timeAgo(r.created_at)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="mt-4">
          <CardBody className="space-y-2.5 text-sm text-slate-600">
            <p className="font-medium text-slate-900">How it works</p>
            <p>1. Describe the job in your own words.</p>
            <p>2. Up to 4 nearby pros get it, each match says why.</p>
            <p>3. Compare quotes and hire. Payment is held until the job is done.</p>
            <p>4. Review the pro. It shapes future matches.</p>
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}
