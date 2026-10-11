"use client";

import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

/** The same inbox at phone width (390 px), rendered by the real app in a frame. */
export function PhoneView() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" data-testid="phone-view"><Smartphone /> Phone view</Button>
      </DialogTrigger>
      <DialogContent title="Phone view" description="The same inbox at phone width." className="w-auto">
        <div className="mx-auto w-[406px] rounded-[2.4rem] border-[8px] border-slate-900 bg-slate-900 shadow-xl">
          <iframe src="/phone/pro" title="Inbox at phone width" className="h-[620px] w-[390px] rounded-[1.9rem] bg-white" data-testid="phone-frame" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
