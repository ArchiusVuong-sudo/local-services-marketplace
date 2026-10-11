import { expect, test, type Page } from "@playwright/test";

const NOTE = "Water heater leaking in the garage, 85016. Need it fixed this week, budget about $450";
const SHOTS = process.env.SHOTS;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test("client posts a job, a pro quotes, the client hires, pays and reviews (replay mode)", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/404 \(Not Found\)/.test(m.text())) errors.push(m.text());
  });
  const as = (id: string) => page.context().request.post("/api/persona", { data: { id } });

  await request.post("/api/demo/reset");
  await as("client_maya");
  await page.goto("/");
  await expect(page.getByTestId("replay-badge")).toHaveText("Replay mode");
  await expect(page.getByTestId("synthetic-badge")).toBeVisible();
  await shot(page, "01-home");

  // 1. Describe the job; the recorded agent run fills in the request.
  await page.getByTestId("intake-note").fill(NOTE);
  await page.getByTestId("get-quotes").click();
  await expect(page.getByTestId("intake-steps")).toContainText("Searching categories");
  const draft = page.getByTestId("request-draft");
  await expect(draft).toBeVisible();
  await expect(page.getByTestId("draft-category")).toHaveValue("water-heater-repair");
  await expect(page.getByTestId("draft-zip")).toHaveValue("85016");
  await expect(page.getByTestId("draft-timing")).toHaveValue("this_week");
  await expect(page.getByTestId("draft-budget")).toHaveValue("450");
  await page.getByTestId("question-fuel").getByRole("button", { name: "Gas" }).click();
  await page.getByTestId("how-read").click();
  await expect(page.getByTestId("intake-trace")).toContainText("search_categories");
  await expect(page.getByTestId("intake-trace")).toContainText("Replay of a recorded live agent run");
  await shot(page, "02-draft");
  await page.getByTestId("send-to-pros").click();

  // 2. Matched pros with reasons, one sponsored.
  await page.waitForURL(/\/requests\/\d+$/);
  await expect(page.getByTestId("match-card")).toHaveCount(4);
  await expect(page.getByTestId("sponsored-tag")).toHaveCount(1);
  await expect(page.getByTestId("match-card").first()).toContainText("Pipewright Plumbing");
  await expect(page.getByTestId("match-card").first()).toContainText("4.8 from 41 reviews");
  await shot(page, "03-matches");

  // 3. The pro sees the lead (contact hidden) and quotes; the phone number is masked.
  await as("pro_pipewright");
  await page.goto("/pro");
  await expect(page.getByTestId("credits")).toHaveText("120");
  const lead = page.getByTestId("inbox-lead").first();
  await expect(lead).toContainText("Maya O.");
  await expect(lead).toContainText("Contact hidden until hire");
  await page.getByTestId("phone-view").click();
  await expect(page.getByTestId("phone-frame")).toBeVisible();
  await expect(page.frameLocator('[data-testid="phone-frame"]').getByTestId("inbox-lead").first()).toContainText("Maya O.");
  await shot(page, "04-phone-view");
  await page.keyboard.press("Escape");
  await lead.click();
  await page.waitForURL(/\/pro\/leads\/\d+$/);
  const leadUrl = page.url();
  await expect(page.getByTestId("client-contact")).toContainText("Contact hidden until hire");
  await page.getByTestId("quote-price").fill("420");
  await page.getByTestId("quote-message-input").fill("Can swap the valve and flush the tank, call me at 602-555-0147");
  await expect(page.getByTestId("mask-preview")).toContainText("[phone hidden until hire]");
  await page.getByTestId("send-quote").click();
  await expect(page.getByTestId("sent-quote-masked")).toHaveText("Can swap the valve and flush the tank, call me at [phone hidden until hire]");
  await expect(page.getByTestId("lead-credits")).toHaveText("105 credits");
  await shot(page, "05-quote-sent");

  // 4. Demo control: the other matched pros reply. The client compares and hires.
  await page.getByTestId("demo-menu").click();
  await page.getByTestId("demo-simulate").click();
  await expect(page.getByRole("status")).toContainText("3 more pros sent quotes");
  await as("client_maya");
  await page.goto("/");
  await page.getByTestId("my-requests").locator("a").first().click();
  const table = page.getByTestId("compare-quotes");
  await expect(table.locator("thead th a")).toHaveCount(4);
  await expect(page.getByTestId("quote-message").first()).toContainText("hidden until hire");
  const names = await table.locator("thead th a").allTextContents();
  await page.locator('[data-testid^="hire-"]').nth(names.findIndex((n) => n.includes("Pipewright"))).click();
  await shot(page, "06-hire");
  await page.getByTestId("confirm-hire").click();
  await page.waitForURL(/\/jobs\/\d+$/);
  const jobUrl = page.url();
  await expect(page.getByTestId("pay-held")).toHaveText("$420");
  await expect(page.getByTestId("job-contacts")).toContainText("602-555-0147");

  // 5. The pro moves the job to done; the payout is released minus the fee.
  await as("pro_pipewright");
  await page.goto(jobUrl);
  await page.getByTestId("job-schedule").click();
  await page.getByTestId("job-start").click();
  await page.getByTestId("job-done-note").fill("Replaced the drain valve and flushed the tank.");
  await page.getByTestId("job-done").click();
  await expect(page.getByTestId("pay-payout")).toHaveText("$378");
  await expect(page.getByTestId("pay-fee")).toHaveText("$42");
  await page.getByTestId("ledger-toggle").click();
  await expect(page.getByTestId("ledger-sum")).toHaveText(["$0.00", "$0.00"]);
  await shot(page, "07-job-done");

  // 6. The client reviews; the profile shows 42 reviews with the new one on top.
  await as("client_maya");
  await page.goto(jobUrl);
  await expect(page.getByTestId("timeline")).toContainText("Payout released");
  await page.getByTestId("star-5").click();
  await page.getByTestId("review-body").fill("Fixed in an hour, clean work");
  await page.getByTestId("submit-review").click();
  await expect(page.getByTestId("job-review")).toContainText("Fixed in an hour");
  await page.goto("/pros/pro_pipewright");
  await expect(page.getByTestId("profile-review-count")).toHaveText("42 reviews");
  await expect(page.getByTestId("reviews").locator("li").first()).toContainText("Fixed in an hour, clean work");

  // 7. Admin: dashboard and data access; another pro gets Not found on the lead link.
  await as("admin_ops");
  await page.goto("/admin");
  await expect(page.getByTestId("ledger-check")).toContainText("All transactions balance");
  await expect(page.getByTestId("weekly-chart")).toBeVisible();
  await shot(page, "08-admin");
  await page.goto("/admin/access");
  await expect(page.getByTestId("access-matrix")).toBeVisible();
  await shot(page, "09-access");
  await as("pro_brightline");
  await page.goto(leadUrl);
  await expect(page.getByTestId("not-found")).toBeVisible();

  expect(errors).toEqual([]);
});
