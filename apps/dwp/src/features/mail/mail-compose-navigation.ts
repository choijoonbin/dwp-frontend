export type MailComposeSeed = Readonly<{
  toEmail?: string;
  subject?: string;
  body?: string;
}>;

export type MailComposeNavigationState = Readonly<{
  mailComposeSeed: MailComposeSeed;
  mailReturnTo?: string;
}>;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value: unknown, maximum: number) {
  return typeof value === 'string' && value.length <= maximum ? value : undefined;
}

export function safeMailReturnPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/mail')) return null;
  if (
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    return null;
  try {
    const url = new URL(value, 'https://dwp.invalid');
    return url.origin === 'https://dwp.invalid' && url.pathname.startsWith('/mail')
      ? `${url.pathname}${url.search}${url.hash}`
      : null;
  } catch {
    return null;
  }
}

export function parseMailComposeNavigationState(value: unknown): {
  seed: MailComposeSeed | null;
  returnTo: string | null;
} {
  if (!record(value) || !record(value.mailComposeSeed)) return { seed: null, returnTo: null };
  const seed = {
    toEmail: boundedText(value.mailComposeSeed.toEmail, 320),
    subject: boundedText(value.mailComposeSeed.subject, 998),
    body: boundedText(value.mailComposeSeed.body, 100_000),
  };
  return {
    seed: Object.values(seed).some((item) => item !== undefined) ? seed : null,
    returnTo: safeMailReturnPath(value.mailReturnTo),
  };
}

export function mailComposeNavigationState(
  seed: MailComposeSeed,
  returnTo?: string
): MailComposeNavigationState {
  const safeReturnTo = safeMailReturnPath(returnTo);
  return {
    mailComposeSeed: seed,
    ...(safeReturnTo ? { mailReturnTo: safeReturnTo } : {}),
  };
}
