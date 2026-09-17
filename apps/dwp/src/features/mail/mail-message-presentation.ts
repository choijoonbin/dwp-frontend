import type { MailMessage, MailRecipient } from '@dwp-frontend/shared-utils';

export type MailMessageRecipient = Readonly<{
  email: string;
  name: string | null;
  type: 'TO' | 'CC' | 'BCC';
}>;

const ALLOWED_ELEMENTS = new Set([
  'A',
  'B',
  'BLOCKQUOTE',
  'BR',
  'CODE',
  'DIV',
  'EM',
  'H1',
  'H2',
  'H3',
  'H4',
  'HR',
  'I',
  'IMG',
  'LI',
  'OL',
  'P',
  'PRE',
  'SPAN',
  'STRONG',
  'TABLE',
  'TBODY',
  'TD',
  'TH',
  'THEAD',
  'TR',
  'U',
  'UL',
]);

const DROP_WITH_CONTENT = new Set([
  'BASE',
  'EMBED',
  'FORM',
  'IFRAME',
  'INPUT',
  'LINK',
  'META',
  'OBJECT',
  'SCRIPT',
  'STYLE',
  'SVG',
  'TEMPLATE',
]);

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function recipientType(value: unknown): MailMessageRecipient['type'] {
  const normalized = text(value)?.toUpperCase();
  return normalized === 'CC' || normalized === 'BCC' ? normalized : 'TO';
}

export function mailMessageRecipients(
  message: Pick<MailMessage, 'direction'> & {
    recipients: Array<MailRecipient | Record<string, unknown>>;
  }
): MailMessageRecipient[] {
  return message.recipients.flatMap((recipient) => {
    const record = recipient as Record<string, unknown>;
    const email = text(record.email ?? record.emailAddress ?? record.address);
    if (!email) return [];
    const type = recipientType(record.type ?? record.recipientType ?? record.kind);
    if (type === 'BCC' && message.direction === 'INBOUND') return [];
    return [
      {
        email,
        name: text(record.name ?? record.displayName),
        type,
      },
    ];
  });
}

export function mailRemoteImageCount(html: string) {
  if (typeof DOMParser === 'undefined') {
    return (html.match(/<img\b[^>]*\bsrc\s*=\s*["']https?:\/\//giu) ?? []).length;
  }
  const document = new DOMParser().parseFromString(html, 'text/html');
  return [...document.querySelectorAll('img')].filter((image) =>
    /^https?:\/\//iu.test(image.getAttribute('src') ?? '')
  ).length;
}

function safeLink(value: string) {
  return /^(?:https?:|mailto:)/iu.test(value);
}

export function mailExternalLinkDetails(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return { url: url.toString(), domain: url.hostname };
  } catch {
    return null;
  }
}

function safeImage(value: string) {
  return /^(?:https?:|data:image\/(?:gif|jpe?g|png|webp);base64,)/iu.test(value);
}

export function sanitizeMailHtml(html: string, loadRemoteImages = false) {
  if (typeof DOMParser === 'undefined') return escapeHtml(html);
  const document = new DOMParser().parseFromString(html, 'text/html');
  for (const element of [...document.body.querySelectorAll('*')]) {
    if (DROP_WITH_CONTENT.has(element.tagName)) {
      element.remove();
      continue;
    }
    if (!ALLOWED_ELEMENTS.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      continue;
    }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (
        (element.tagName === 'A' && ['href', 'title'].includes(name)) ||
        (element.tagName === 'IMG' && ['src', 'alt', 'title', 'width', 'height'].includes(name))
      ) {
        continue;
      }
      element.removeAttribute(attribute.name);
    }
    if (element instanceof HTMLAnchorElement) {
      const href = element.getAttribute('href') ?? '';
      if (!safeLink(href)) element.removeAttribute('href');
      else {
        element.rel = 'noopener noreferrer nofollow';
        const external = mailExternalLinkDetails(href);
        if (external) element.setAttribute('data-mail-external-link', external.url);
      }
    }
    if (element instanceof HTMLImageElement) {
      const src = element.getAttribute('src') ?? '';
      const remote = /^https?:\/\//iu.test(src);
      if (!safeImage(src) || (remote && !loadRemoteImages)) {
        const placeholder = document.createElement('span');
        placeholder.setAttribute('data-mail-remote-image', remote ? 'blocked' : 'removed');
        placeholder.textContent = element.alt ? `[${element.alt}]` : '[image]';
        element.replaceWith(placeholder);
      } else {
        element.setAttribute('referrerpolicy', 'no-referrer');
        element.setAttribute('loading', 'lazy');
        element.setAttribute('decoding', 'async');
      }
    }
  }
  return document.body.innerHTML;
}

export function mailMessagePlainText(message: Pick<MailMessage, 'body' | 'bodyFormat'>) {
  if (message.bodyFormat === 'TEXT') return message.body;
  if (typeof DOMParser === 'undefined') return message.body.replace(/<[^>]+>/gu, ' ');
  return new DOMParser().parseFromString(message.body, 'text/html').body.textContent ?? '';
}

export function mailForwardDraft(
  subject: string,
  message: Pick<MailMessage, 'body' | 'bodyFormat' | 'senderEmail' | 'senderName' | 'sentAt'>,
  labels: { forwardedMessage: string; from: string; sentAt: string; subject: string }
) {
  const normalizedSubject = /^\s*(?:fwd?|전달)\s*:/iu.test(subject) ? subject : `Fwd: ${subject}`;
  const body = [
    '',
    '',
    `---------- ${labels.forwardedMessage} ----------`,
    `${labels.from}: ${message.senderName} <${message.senderEmail}>`,
    `${labels.sentAt}: ${message.sentAt}`,
    `${labels.subject}: ${subject}`,
    '',
    mailMessagePlainText(message).trim(),
  ].join('\n');
  return { subject: normalizedSubject, body };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
