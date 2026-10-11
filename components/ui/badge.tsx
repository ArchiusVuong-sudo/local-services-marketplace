import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium [&_svg]:size-3", {
  variants: {
    tone: {
      neutral: "bg-slate-100 text-slate-700",
      brand: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200",
      amber: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
      blue: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200",
      rose: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
      violet: "bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-200",
      outline: "border border-slate-200 bg-white text-slate-700",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
