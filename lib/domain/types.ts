export type Role = "client" | "pro" | "admin";
export type Timing = "asap" | "this_week" | "next_two_weeks" | "flexible";
export type LeadStatus = "new" | "viewed" | "quoted" | "hired" | "not_selected";
export type JobStatus = "booked" | "scheduled" | "in_progress" | "done";

export const TIMING_LABEL: Record<Timing, string> = {
  asap: "As soon as possible",
  this_week: "This week",
  next_two_weeks: "In the next two weeks",
  flexible: "Flexible",
};

export type CategoryQuestion = { id: string; text: string; options?: string[] };

export type Category = {
  slug: string;
  name: string;
  serves_label: string;
  keywords: string[];
  lead_fee_credits: number;
  questions: CategoryQuestion[];
};

export type ReasonChip = {
  kind: "category" | "distance" | "rating" | "reply" | "verified" | "availability" | "sponsored";
  label: string;
};
