import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center" data-testid="not-found">
      <SearchX className="mx-auto size-10 text-slate-300" />
      <h1 className="mt-4 text-xl font-semibold">Not found</h1>
      <p className="mt-1 text-sm text-slate-500">This page does not exist, or this account is not allowed to see it.</p>
      <Link href="/" className="mt-6 inline-block text-sm font-medium text-brand-800 hover:underline">Go home</Link>
    </div>
  );
}
