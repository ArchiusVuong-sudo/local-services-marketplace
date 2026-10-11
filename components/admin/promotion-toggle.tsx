"use client";

import { Loader2, Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/client/api";

export function PromotionToggle({ id, status }: { id: number; status: "active" | "paused" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      data-testid={`promo-toggle-${id}`}
      onClick={async () => {
        setBusy(true);
        try {
          await postJson(`/api/admin/promotions/${id}`, { status: status === "active" ? "paused" : "active" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : status === "active" ? <Pause /> : <Play />}
      {status === "active" ? "Pause" : "Resume"}
    </Button>
  );
}
