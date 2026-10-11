/** Platform fee on a hired job, in basis points (10%). */
export const PLATFORM_FEE_BPS = 1000;

export function platformFeeCents(priceCents: number): number {
  if (!Number.isInteger(priceCents) || priceCents <= 0) throw new Error("price must be a positive whole number of cents");
  return Math.round((priceCents * PLATFORM_FEE_BPS) / 10_000);
}

export function payoutCents(priceCents: number): number {
  return priceCents - platformFeeCents(priceCents);
}

export function formatUsd(cents: number, opts: { cents?: boolean } = {}): string {
  const showCents = opts.cents ?? cents % 100 !== 0;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
}

export type LedgerLine = { account: string; amount_cents: number };

/** A ledger transaction balances when its signed lines sum to zero. */
export function isBalanced(lines: LedgerLine[]): boolean {
  return lines.length >= 2 && lines.reduce((s, l) => s + l.amount_cents, 0) === 0;
}

export function holdLines(priceCents: number): LedgerLine[] {
  return [
    { account: "client_test_card", amount_cents: -priceCents },
    { account: "escrow_held", amount_cents: priceCents },
  ];
}

export function releaseLines(priceCents: number): LedgerLine[] {
  return [
    { account: "escrow_held", amount_cents: -priceCents },
    { account: "pro_payouts", amount_cents: payoutCents(priceCents) },
    { account: "platform_payment_fees", amount_cents: platformFeeCents(priceCents) },
  ];
}

export const ACCOUNT_LABEL: Record<string, string> = {
  client_test_card: "Client card (test mode)",
  escrow_held: "Held for the job",
  pro_payouts: "Paid out to the pro",
  platform_payment_fees: "Platform fee (10%)",
  pro_test_card: "Pro card (test mode)",
  pro_credit_balance: "Pro lead credits",
  platform_lead_fees: "Platform lead fees",
};
