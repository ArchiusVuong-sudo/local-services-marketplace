import { BadgeCheck, CalendarCheck, Clock, MapPin, Megaphone, Star, Wrench } from "lucide-react";
import type { ReasonChip } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const ICON = { category: Wrench, distance: MapPin, rating: Star, reply: Clock, verified: BadgeCheck, availability: CalendarCheck, sponsored: Megaphone };

export function ReasonChips({ reasons, hideSponsored }: { reasons: ReasonChip[]; hideSponsored?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="reason-chips">
      {reasons
        .filter((r) => !(hideSponsored && r.kind === "sponsored"))
        .map((r) => {
          const Icon = ICON[r.kind];
          return (
            <span
              key={r.kind}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs",
                r.kind === "verified" ? "bg-brand-50 text-brand-800" : r.kind === "sponsored" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700",
              )}
            >
              <Icon className="size-3" />
              {r.label}
            </span>
          );
        })}
    </div>
  );
}
