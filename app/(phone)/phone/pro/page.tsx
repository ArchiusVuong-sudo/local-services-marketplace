import { InboxList } from "@/components/pro/inbox-list";
import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/scoped";
import { currentPersona } from "@/lib/server/session";
import { proInbox, proProfile } from "@/lib/services/views";

export const dynamic = "force-dynamic";

/** The pro inbox laid out for a phone screen (used by the Phone view frame). */
export default async function PhoneInbox() {
  const persona = await currentPersona();
  if (persona.role !== "pro") return <p className="p-6 text-sm text-slate-500">Switch to a pro to see the inbox.</p>;
  const db = await getDb();
  const { leads, profile } = await asUser(db, persona.id, async (tx) => ({ leads: await proInbox(tx, persona.id), profile: (await proProfile(tx, persona.id))! }));
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-6 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">{profile.business_name}</p>
            <h1 className="text-xl font-semibold">Leads</h1>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800">{profile.credits} credits</span>
        </div>
        <p className="mt-1 text-[11px] text-amber-700">Synthetic data</p>
      </div>
      <InboxList leads={leads} compact target="_top" />
    </div>
  );
}
