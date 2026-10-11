import { BadgeCheck, Clock, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { Rating, Stars } from "@/components/shared/stars";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/scoped";
import { formatReply, weightedRating } from "@/lib/domain/matching";
import { currentPersona } from "@/lib/server/session";
import { proProfile, proReviews } from "@/lib/services/views";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const persona = await currentPersona();
  const db = await getDb();
  const data = await asUser(db, persona.id, async (tx) => {
    const profile = await proProfile(tx, id);
    return profile ? { profile, reviews: await proReviews(tx, id) } : null;
  });
  if (!data) notFound();
  const { profile: p, reviews } = data;
  const avg = p.review_count ? p.rating_sum / p.review_count : 0;

  return (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-4 space-y-6">
        <Card>
          <CardBody className="space-y-4">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold">{p.business_name} {p.verified && <BadgeCheck className="size-5 text-brand-600" />}</h1>
              <p className="text-sm text-slate-500">Owner {p.owner_name} · {p.years_in_business} years in business</p>
            </div>
            <div className="flex items-end gap-3" data-testid="profile-score">
              <span className="text-4xl font-semibold">{avg ? avg.toFixed(1) : "New"}</span>
              <div className="pb-1">
                <Stars value={avg} size="md" />
                <p className="text-sm text-slate-500" data-testid="profile-review-count">{p.review_count} reviews</p>
              </div>
            </div>
            <p className="text-sm text-slate-700">{p.bio}</p>
            <div className="flex flex-wrap gap-1.5">
              {p.verified ? <Badge tone="brand"><BadgeCheck /> Verified</Badge> : <Badge tone="outline">Not verified yet</Badge>}
              <Badge tone="outline"><MapPin /> {p.radius_mi} mi around {p.home_zip} {p.place}</Badge>
              <Badge tone="outline"><Clock /> {formatReply(p.reply_minutes)}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.category_names.map((c) => <Badge key={c}>{c}</Badge>)}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-1 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Match score input</p>
            <p>Weighted review score {weightedRating(p.review_count, p.rating_sum).toFixed(2)} (a few reviews count less than many).</p>
          </CardBody>
        </Card>
      </section>
      <section className="col-span-8">
        <Card>
          <CardHeader>
            <CardTitle>Reviews</CardTitle>
            <Rating sum={p.rating_sum} count={p.review_count} />
          </CardHeader>
          {reviews.length === 0 ? (
            <CardBody className="text-sm text-slate-500">No reviews yet.</CardBody>
          ) : (
            <ul className="divide-y divide-slate-100" data-testid="reviews">
              {reviews.map((r) => (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <Stars value={r.rating} />
                    <span className="text-xs text-slate-400">{formatDate(r.created_at)}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-800">{r.body || "No comment."}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.author_label} {r.source === "imported" ? "· from before the platform history (synthetic)" : "· verified job on the platform"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
