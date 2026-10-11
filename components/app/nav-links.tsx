"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" || path.startsWith("/requests") : path === l.href || (l.href !== "/admin" && path.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900", active && "bg-slate-100 text-slate-900")}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
