// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  MessagingMessageBody,
  messagingPlainTextPreview,
  parseMessagingMarkdown,
} from './messaging-message-body';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderBody(body: string) {
  const markup = renderToStaticMarkup(
    <MessagingMessageBody
      body={body}
      mentions={[
        {
          userId: 2,
          displayName: 'Kim',
          mentionKind: 'USER',
        },
      ]}
    />
  );
  return new DOMParser().parseFromString(markup, 'text/html').body;
}

describe('messaging message body', () => {
  it('keeps prose and fenced code in their original order', () => {
    expect(
      parseMessagingMarkdown('Review this:\n```ts\nconst ready = true;\n```\nThen approve.')
    ).toEqual([
      { kind: 'paragraph', children: [{ kind: 'text', value: 'Review this:', mentions: true }] },
      { kind: 'code', value: 'const ready = true;', language: 'ts' },
      { kind: 'paragraph', children: [{ kind: 'text', value: 'Then approve.', mentions: true }] },
    ]);
  });

  it('leaves ordinary text untouched', () => {
    expect(parseMessagingMarkdown('No code here.')).toEqual([
      { kind: 'paragraph', children: [{ kind: 'text', value: 'No code here.', mentions: true }] },
    ]);
  });

  it('removes fenced-code markers from compact previews', () => {
    expect(messagingPlainTextPreview('Ready.\n```ts\nconst ready = true;\n```')).toBe(
      'Ready. const ready = true;'
    );
  });

  it('renders supported inline formatting and ordered/unordered lists as semantic elements', () => {
    const body = renderBody(
      '**Decision** _today_ `status`\n\n- **First**\n- Second\n\n3. Third\n4. Fourth'
    );
    expect(body.querySelector('strong')?.textContent).toBe('Decision');
    expect(body.querySelector('em')?.textContent).toBe('today');
    expect(body.querySelector('code')?.textContent).toBe('status');
    expect(body.querySelectorAll('ul > li')).toHaveLength(2);
    expect(body.querySelector('ol')?.getAttribute('start')).toBe('3');
    expect(body.querySelectorAll('ol > li')).toHaveLength(2);
  });

  it('highlights authorized mentions in formatted prose but not code or links', () => {
    const body = renderBody(
      '**@Kim** _@Kim_ `@Kim`\n\n```text\n@Kim\n```\n\n[@Kim](https://example.com)'
    );
    expect(body.querySelector('strong span')?.textContent).toBe('@Kim');
    expect(body.querySelector('em span')?.textContent).toBe('@Kim');
    expect(body.querySelectorAll('code span, a span')).toHaveLength(0);
    expect(body.querySelectorAll('code')).toHaveLength(2);
  });

  it.each([
    '<script>alert(1)</script>',
    '<img src="https://tracking.example/x" onerror="alert(1)">',
    '<svg onload="alert(1)"></svg>',
    '![tracking](https://tracking.example/pixel)',
    '[click](javascript:alert(1))',
    '[click](javascript&#58;alert(1))',
    '[click](data:text/html;base64,abcd)',
    '[click](//tracking.example/x)',
    '[click](https://admin:password@example.com)',
    '[click](https://example.com\\@evil.example)',
  ])('keeps dangerous or unsupported content literal: %s', (source) => {
    const body = renderBody(source);
    expect(body.querySelectorAll('script,img,svg,iframe,object,a')).toHaveLength(0);
    expect(body.textContent).toContain(source);
  });

  it('uses safe links with no opener or referrer and does not eagerly fetch media', () => {
    const body = renderBody(
      '[Document](https://example.com/doc?q=1) and [Mail](mailto:user@example.com)'
    );
    const links = Array.from(body.querySelectorAll('a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://example.com/doc?q=1',
      'mailto:user@example.com',
    ]);
    for (const link of links) {
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('referrerpolicy')).toBe('no-referrer');
    }
    expect(body.querySelector('img')).toBeNull();
  });

  it('creates useful plain previews without formatting punctuation', () => {
    expect(
      messagingPlainTextPreview('**Ready** _today_\n\n- [Document](https://example.com)\n- `code`')
    ).toBe('Ready today Document code');
    expect(messagingPlainTextPreview('```\ncode\n```\nAfter')).toBe('code After');
  });

  it('falls back to literal text over the server body limit', () => {
    const source = '**unparsed**'.repeat(2_000);
    expect(parseMessagingMarkdown(source)).toEqual([
      { kind: 'text', value: source, mentions: false },
    ]);
  });
});
