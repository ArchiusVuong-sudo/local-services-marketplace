"use client";

import { DropdownMenu as M } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuGroup = M.Group;

export function MenuContent({ children, className, align = "end" }: { children: ReactNode; className?: string; align?: "start" | "end" | "center" }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={8}
        className={cn("z-50 min-w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl", className)}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({ className, ...props }: M.DropdownMenuItemProps) {
  return (
    <M.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900 data-[disabled]:opacity-50 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ className, ...props }: M.DropdownMenuLabelProps) {
  return <M.Label className={cn("px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400", className)} {...props} />;
}

export function MenuSeparator() {
  return <M.Separator className="my-1.5 h-px bg-slate-100" />;
}
