import Link from "next/link";
import type { ReactNode } from "react";
import { DemoMenu } from "@/components/app/demo-menu";
import { Logo } from "@/components/app/logo";
import { NavLinks } from "@/components/app/nav-links";
import { NotificationBell } from "@/components/app/notification-bell";
import { PersonaSwitcher } from "@/components/app/persona-switcher";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/scoped";
import { intakeMode } from "@/lib/intake/mode";
import { allPersonas, currentPersona } from "@/lib/server/session";
import { listNotifications } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

const NAV = {
  client: [{ href: "/", label: "My jobs" }],
  pro: [{ href: "/pro", label: "Leads and jobs" }],
  admin: [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/access", label: "Data access" },
  ],
} as const;

export default async function MainLayout({ children }: { children: ReactNode }) {
  const [persona, people, db] = await Promise.all([currentPersona(), allPersonas(), getDb()]);
  const notes = await asUser(db, persona.id, (tx) => listNotifications(tx, 10));
  const mode = intakeMode();
  return (
    <>
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-8">
            <Link href="/" aria-label="Home">
              <Logo />
            </Link>
            <NavLinks links={[...NAV[persona.role]]} />
            <div className="ml-auto flex items-center gap-2.5">
              <Badge tone="amber" title="Every person, business, review and number here is invented for the demo" data-testid="synthetic-badge">
                Synthetic data
              </Badge>
              {mode !== "live" && (
                <Badge tone="violet" title={mode === "replay" ? "Intake replays recorded live agent runs; no login or key needed" : "Intake uses the rules parser"} data-testid="replay-badge">
                  {mode === "replay" ? "Replay mode" : "Rules mode"}
                </Badge>
              )}
              <DemoMenu />
              <NotificationBell items={notes.items} unread={notes.unread} />
              <PersonaSwitcher current={persona} people={people} />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1280px] px-8 pb-16 pt-8">{children}</main>
    </>
  );
}
