import { Lexer } from 'marked';

import type { MarkedToken } from 'marked';

export type MessagingFormattedNode =
  | { kind: 'text'; value: string; mentions: boolean }
  | { kind: 'paragraph' | 'strong' | 'em'; children: MessagingFormattedNode[] }
  | { kind: 'code'; value: string; language?: string }
  | { kind: 'inlineCode'; value: string }
  | { kind: 'break' }
  | { kind: 'link'; href: string; children: MessagingFormattedNode[] }
  | { kind: 'list'; ordered: boolean; start: number; items: MessagingFormattedNode[][] };

const literal = (value: string): MessagingFormattedNode => ({
  kind: 'text',
  value,
  mentions: false,
});

function safeLink(value: string): string | null {
  if (
    !/^(https?:\/\/|mailto:)/iu.test(value) ||
    /[\s\\]/u.test(value) ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  ) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function splitMessagingMentionText(value: string, mentions: string[]) {
  if (!mentions.length) return [{ value, mention: false }];
  const alternatives = [...mentions]
    .sort((left, right) => right.length - left.length)
    .map((mention) => mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const matcher = new RegExp(`(?<![\\p{L}\\p{N}_@])(${alternatives})(?![\\p{L}\\p{N}_])`, 'gu');
  const parts: Array<{ value: string; mention: boolean }> = [];
  let cursor = 0;
  for (const match of value.matchAll(matcher)) {
    const start = match.index;
    if (start > cursor) parts.push({ value: value.slice(cursor, start), mention: false });
    parts.push({ value: match[0], mention: true });
    cursor = start + match[0].length;
  }
  if (cursor < value.length) parts.push({ value: value.slice(cursor), mention: false });
  return parts;
}

function toNodes(tokens: MarkedToken[], depth = 0): MessagingFormattedNode[] {
  if (depth > 24) return tokens.map((token) => literal(token.raw));
  return tokens.flatMap((token): MessagingFormattedNode[] => {
    const children = () =>
      toNodes(('tokens' in token ? (token.tokens ?? []) : []) as MarkedToken[], depth + 1);
    switch (token.type) {
      case 'paragraph':
        return [{ kind: 'paragraph', children: children() }];
      case 'strong':
        return [{ kind: 'strong', children: children() }];
      case 'em':
        return [{ kind: 'em', children: children() }];
      case 'text':
        return token.tokens ? children() : [{ kind: 'text', value: token.text, mentions: true }];
      case 'escape':
        return [literal(token.text)];
      case 'space':
        return [];
      case 'br':
        return [{ kind: 'break' }];
      case 'code':
        return [{ kind: 'code', value: token.text, language: token.lang }];
      case 'codespan':
        return [{ kind: 'inlineCode', value: token.text }];
      case 'list':
        return [
          {
            kind: 'list',
            ordered: token.ordered,
            start: token.start || 1,
            items: token.items.map((item) => [
              ...(item.task ? [literal(item.checked ? '[x] ' : '[ ] ')] : []),
              ...toNodes(item.tokens as MarkedToken[], depth + 1),
            ]),
          },
        ];
      case 'link': {
        const href = safeLink(token.href);
        return href ? [{ kind: 'link', href, children: children() }] : [literal(token.raw)];
      }
      // HTML, images and unsupported Markdown stay inert, including their attributes.
      default:
        return [literal(token.raw)];
    }
  });
}

export function parseMessagingMarkdown(value: string): MessagingFormattedNode[] {
  if (value.length > 20_000) return [literal(value)];
  try {
    return toNodes(Lexer.lex(value, { gfm: true, breaks: true }) as MarkedToken[]);
  } catch {
    return [literal(value)];
  }
}

export function messagingFormattedText(value: string, mentionsOnly = false): string {
  const flatten = (nodes: MessagingFormattedNode[]): string =>
    nodes
      .map((node) => {
        switch (node.kind) {
          case 'text':
            return !mentionsOnly || node.mentions ? node.value : '\n';
          case 'code':
            return mentionsOnly ? '\n' : `${node.value}\n`;
          case 'inlineCode':
            return mentionsOnly ? '\n' : node.value;
          case 'break':
            return '\n';
          case 'list':
            return node.items.map(flatten).join('\n');
          case 'paragraph':
            return `${flatten(node.children)}\n`;
          case 'link':
            return mentionsOnly ? '\n' : flatten(node.children);
          default:
            return flatten(node.children);
        }
      })
      .join('');
  return flatten(parseMessagingMarkdown(value));
}

export function messagingMentionAllowedAt(value: string, position: number): boolean {
  const prefix = value.slice(0, position);
  const nodes = parseMessagingMarkdown(`${prefix}@dwp-mention-probe`);
  const containsProbe = (items: MessagingFormattedNode[]): boolean =>
    items.some((node) => {
      if (node.kind === 'text') return node.mentions && node.value.includes('@dwp-mention-probe');
      if (node.kind === 'list') return node.items.some(containsProbe);
      return node.kind !== 'link' && 'children' in node && containsProbe(node.children);
    });
  if (!containsProbe(nodes)) return false;
  let lastToken = (Lexer.lex(prefix, { gfm: true, breaks: true }) as MarkedToken[]).at(-1);
  while (lastToken?.type === 'list') {
    lastToken = lastToken.items.at(-1)?.tokens.at(-1) as MarkedToken | undefined;
  }
  if (lastToken?.type !== 'paragraph' && lastToken?.type !== 'text') return true;
  // A draft's unfinished inline-code delimiter is not a completed Markdown token yet.
  let openDelimiter = 0;
  for (const match of (lastToken?.raw ?? '').matchAll(/\\[\s\S]|`+/gu)) {
    if (match[0].startsWith('\\')) continue;
    if (!openDelimiter) openDelimiter = match[0].length;
    else if (openDelimiter === match[0].length) openDelimiter = 0;
  }
  return openDelimiter === 0;
}
