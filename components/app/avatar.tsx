import { cn } from "@/lib/utils";

const TONE = { client: "bg-sky-100 text-sky-800", pro: "bg-brand-100 text-brand-800", admin: "bg-violet-100 text-violet-800" } as const;

export function Avatar({ name, role, small }: { name: string; role: keyof typeof TONE; small?: boolean }) {
  const initials = name
    .replace(/\(.*\)/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-md font-semibold", TONE[role], small ? "size-6 text-[10px]" : "size-8 text-xs")}>
      {initials}
    </span>
  );
}
