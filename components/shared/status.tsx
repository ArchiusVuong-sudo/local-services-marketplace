import { Badge } from "@/components/ui/badge";
import type { JobStatus, LeadStatus } from "@/lib/domain/types";
import { JOB_STATUS_LABEL } from "@/lib/domain/lifecycle";

export function RequestStatusBadge({ status, jobStatus }: { status: "open" | "hired" | "closed"; jobStatus?: JobStatus | null }) {
  if (jobStatus) return <JobStatusBadge status={jobStatus} />;
  if (status === "open") return <Badge tone="blue">Getting quotes</Badge>;
  return <Badge tone="neutral">{status === "hired" ? "Hired" : "Closed"}</Badge>;
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const tone = status === "done" ? "brand" : status === "in_progress" ? "amber" : "blue";
  return <Badge tone={tone}>{JOB_STATUS_LABEL[status]}</Badge>;
}

const LEAD_LABEL: Record<LeadStatus, string> = { new: "New", viewed: "Viewed", quoted: "Quoted", hired: "Hired", not_selected: "Not selected" };

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const tone = status === "new" ? "blue" : status === "hired" ? "brand" : status === "quoted" ? "violet" : "neutral";
  return <Badge tone={tone} data-testid="lead-status">{LEAD_LABEL[status]}</Badge>;
}
