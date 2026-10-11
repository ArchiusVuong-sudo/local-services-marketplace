"use client";

import { FlaskConical, MessagesSquare, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/client/api";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";

export function DemoMenu() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    try {
      setNotice(await fn());
      router.refresh();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(null);
      setTimeout(() => setNotice(null), 3500);
    }
  };

  return (
    <div className="relative">
      <Menu>
        <MenuTrigger className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50" data-testid="demo-menu">
          <FlaskConical className="size-3.5" />
          {busy ? "Working..." : "Demo"}
        </MenuTrigger>
        <MenuContent className="w-80">
          <MenuLabel>Demo controls (not part of the product)</MenuLabel>
          <MenuItem
            data-testid="demo-simulate"
            onSelect={() =>
              run("sim", async () => {
                const r = await postJson<{ quotes: number }>("/api/demo/simulate-replies");
                return r.quotes ? `${r.quotes} more pros sent quotes` : "No open leads waiting for a reply";
              })
            }
          >
            <MessagesSquare />
            Simulate replies from the other matched pros
          </MenuItem>
          <MenuItem
            data-testid="demo-reset"
            onSelect={() =>
              run("reset", async () => {
                await postJson("/api/demo/reset");
                router.push("/");
                return "Demo data reset";
              })
            }
          >
            <RotateCcw />
            Reset demo data
          </MenuItem>
        </MenuContent>
      </Menu>
      {notice && (
        <div className="absolute right-0 top-11 z-50 w-max max-w-xs rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
