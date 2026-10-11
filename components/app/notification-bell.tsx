"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Popover } from "radix-ui";
import type { Notification } from "@/lib/services/notifications";
import { postJson } from "@/lib/client/api";
import { timeAgo } from "@/lib/utils";

export function NotificationBell({ items, unread }: { items: Notification[]; unread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && unread > 0) void postJson("/api/notifications").then(() => router.refresh());
  };
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger className="relative inline-flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Notifications" data-testid="bell">
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-[18px] text-white" data-testid="bell-count">
            {unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-96 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && <span className="text-xs text-slate-500">{unread} new</span>}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Nothing yet. Updates on your jobs show up here.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={n.href || "#"} onClick={() => onOpenChange(false)} className="flex gap-3 px-4 py-3 hover:bg-slate-50">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-brand-500"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">{n.title}</span>
                      {n.body && <span className="mt-0.5 block truncate text-xs text-slate-500">{n.body}</span>}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(n.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
