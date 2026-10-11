import type { Queryable } from "@/lib/db/client";
import { rows } from "@/lib/db/sql";

export type Notification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

export async function notify(
  q: Queryable,
  userId: string,
  n: { kind: string; title: string; body?: string; href?: string },
  now: Date = new Date(),
): Promise<void> {
  await q.query(
    "insert into notifications (user_id, kind, title, body, href, created_at) values ($1, $2, $3, $4, $5, $6)",
    [userId, n.kind, n.title, n.body ?? "", n.href ?? "", now],
  );
}

export async function listNotifications(q: Queryable, limit = 12): Promise<{ items: Notification[]; unread: number }> {
  const items = await rows<Notification>(
    q,
    "select id, kind, title, body, href, read_at, created_at from notifications order by created_at desc, id desc limit $1",
    [limit],
  );
  const unread = await rows<{ n: number }>(q, "select count(*)::int as n from notifications where read_at is null");
  return { items, unread: unread[0]?.n ?? 0 };
}

export async function markAllRead(q: Queryable, now: Date = new Date()): Promise<void> {
  await q.query("update notifications set read_at = $1 where read_at is null", [now]);
}
