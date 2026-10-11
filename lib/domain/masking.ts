/**
 * Hides phone numbers and email addresses a pro types into a quote, so the first contact
 * stays on the platform until the client hires. Prices, times, dates and ZIP codes stay.
 */
const EMAIL = /[A-Za-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\s+at\s+)\s*[A-Za-z0-9-]+(?:\s*(?:\.|\(dot\)|\[dot\]|\s+dot\s+)\s*[A-Za-z0-9-]+)*\s*(?:\.|\(dot\)|\[dot\]|\s+dot\s+)\s*(?:com|net|org|io|co|us|biz|info|me)\b/gi;
const PHONE = /(?<![\d$,.:])(?:(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-]?)\d{3}[\s.-]?\d{4}|\d{3}[.-]\d{4})(?![\d:])/g;

export const PHONE_MASK = "[phone hidden until hire]";
export const EMAIL_MASK = "[email hidden until hire]";

export type MaskResult = { text: string; phones: number; emails: number };

export function maskContactDetails(input: string): MaskResult {
  let emails = 0;
  let phones = 0;
  const noEmails = input.replace(EMAIL, () => {
    emails += 1;
    return EMAIL_MASK;
  });
  const text = noEmails.replace(PHONE, () => {
    phones += 1;
    return PHONE_MASK;
  });
  return { text, phones, emails };
}
