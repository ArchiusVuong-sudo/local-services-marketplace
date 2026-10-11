import { describe, expect, it } from "vitest";
import { EMAIL_MASK, maskContactDetails, PHONE_MASK } from "@/lib/domain/masking";

const at = ["sam", "example.com"].join("@");

describe("contact masking", () => {
  it.each([
    "call me at 602-555-0147",
    "call (602) 555-0147",
    "text 602.555.0147 today",
    "my cell is 6025550147",
    "reach me on +1 602 555 0147",
    "or 555-0147 locally",
  ])("hides the phone in %s", (msg) => {
    const r = maskContactDetails(msg);
    expect(r.text).toContain(PHONE_MASK);
    expect(r.text).not.toMatch(/555.?0147/);
    expect(r.phones).toBe(1);
  });

  it.each([`email ${at}`, "write to sam at example dot com", "sam(at)example(dot)com please"])("hides the email in %s", (msg) => {
    const r = maskContactDetails(msg);
    expect(r.text).toContain(EMAIL_MASK);
    expect(r.text).not.toMatch(/example/);
    expect(r.emails).toBe(1);
  });

  it("keeps prices, times, dates and ZIP codes", () => {
    const msg = "$420 fixed, Thursday 9:00, can start 10/14, near 85016. Parts $1,200 max.";
    expect(maskContactDetails(msg)).toEqual({ text: msg, phones: 0, emails: 0 });
  });

  it("masks every occurrence", () => {
    const r = maskContactDetails(`602-555-0147 or 602-555-0148, ${at}`);
    expect(r.phones).toBe(2);
    expect(r.emails).toBe(1);
  });
});
