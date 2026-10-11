"use client";

import { Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { postJson } from "@/lib/client/api";
import type { Persona } from "@/lib/services/views";
import { cn } from "@/lib/utils";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Avatar } from "./avatar";

const FEATURED = ["client_maya", "client_jordan", "pro_pipewright", "pro_brightline", "pro_bluepeak", "admin_ops"];
const ROLE_LABEL = { client: "Client", pro: "Pro", admin: "Admin" } as const;

export function PersonaSwitcher({ current, people }: { current: Persona; people: Persona[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const featured = FEATURED.map((id) => people.find((p) => p.id === id)).filter((p): p is Persona => Boolean(p));

  const choose = (id: string) =>
    start(async () => {
      const r = await postJson<{ home: string }>("/api/persona", { id });
      router.push(r.home);
      router.refresh();
    });

  return (
    <Menu>
      <MenuTrigger
        className={cn("flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pl-1 pr-2.5 text-left shadow-xs hover:bg-slate-50", pending && "opacity-60")}
        data-testid="persona-switcher"
      >
        <Avatar name={current.display_name} role={current.role} />
        <span className="leading-tight">
          <span className="block text-[11px] text-slate-500">Viewing as</span>
          <span className="block max-w-40 truncate text-[13px] font-medium text-slate-900">{current.display_name}</span>
        </span>
        <ChevronDown className="size-4 text-slate-400" />
      </MenuTrigger>
      <MenuContent className="w-72">
        {(["client", "pro", "admin"] as const).map((role, i) => (
          <div key={role}>
            {i > 0 && <MenuSeparator />}
            <MenuLabel>{ROLE_LABEL[role]}</MenuLabel>
            {featured.filter((p) => p.role === role).map((p) => (
              <MenuItem key={p.id} onSelect={() => choose(p.id)} data-testid={`persona-${p.id}`}>
                <Avatar name={p.display_name} role={p.role} small />
                <span className="flex-1 truncate">{p.display_name}</span>
                {p.id === current.id && <Check className="text-brand-700" />}
              </MenuItem>
            ))}
          </div>
        ))}
      </MenuContent>
    </Menu>
  );
}
