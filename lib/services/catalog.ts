import type { Queryable } from "@/lib/db/client";
import { rows } from "@/lib/db/sql";
import type { LatLng } from "@/lib/domain/geo";
import type { MatchPro, MatchPromotion } from "@/lib/domain/matching";
import type { Category } from "@/lib/domain/types";

export async function listCategories(q: Queryable): Promise<Category[]> {
  return rows<Category>(q, "select slug, name, serves_label, keywords, lead_fee_credits, questions from categories order by sort, slug");
}

export async function zipIndex(q: Queryable): Promise<Map<string, LatLng>> {
  const list = await rows<{ zip: string; lat: number; lng: number }>(q, "select zip, lat, lng from zip_centroids");
  return new Map(list.map((z) => [z.zip, { lat: z.lat, lng: z.lng }]));
}

export async function listZips(q: Queryable): Promise<{ zip: string; place: string }[]> {
  return rows(q, "select zip, place from zip_centroids order by zip");
}

export async function matchPool(q: Queryable, categorySlug: string): Promise<{ pros: MatchPro[]; promotions: MatchPromotion[] }> {
  const pros = await rows<MatchPro>(
    q,
    `select user_id, business_name, home_zip, radius_mi, category_slugs, verified, reply_minutes,
            next_available_days, accepting_leads, review_count, rating_sum
       from pro_profiles where $1 = any(category_slugs)`,
    [categorySlug],
  );
  const promotions = await rows<MatchPromotion>(q, "select id, pro_id, category_slug, status from promotions where category_slug = $1", [categorySlug]);
  return { pros, promotions };
}
