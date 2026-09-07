import { describe, expect, it } from 'vitest';

import { applyMessagingFormat } from './messaging-formatting-model';
import {
  messagingFormattedText,
  messagingMentionAllowedAt,
  parseMessagingMarkdown,
} from './messaging-formatting-parser';

describe('messaging formatting edits', () => {
  it('wraps a selected range and preserves its UTF-16 selection including Korean text', () => {
    expect(applyMessagingFormat('안녕 @Kim', 3, 7, 'bold')).toEqual({
      value: '안녕 **@Kim**',
      selectionStart: 5,
      selectionEnd: 9,
    });
  });

  it('inserts paired delimiters with the caret inside an empty selection', () => {
    expect(applyMessagingFormat('Hello ', 6, 6, 'bold')).toEqual({
      value: 'Hello ****',
      selectionStart: 8,
      selectionEnd: 8,
    });
    expect(applyMessagingFormat('', 0, 0, 'inlineCode')).toEqual({
      value: '``',
      selectionStart: 1,
      selectionEnd: 1,
    });
  });

  it('toggles bold and italic without discarding surrounding prose', () => {
    const bold = applyMessagingFormat('Check now.', 6, 9, 'bold');
    expect(
      applyMessagingFormat(bold.value, bold.selectionStart, bold.selectionEnd, 'bold')
    ).toEqual({ value: 'Check now.', selectionStart: 6, selectionEnd: 9 });
    expect(applyMessagingFormat('*review*', 0, 8, 'italic').value).toBe('review');
    expect(applyMessagingFormat('**review**', 2, 8, 'italic').value).toBe('***review***');
    expect(applyMessagingFormat('word', 1, 3, 'italic').value).toBe('w*or*d');
    expect(applyMessagingFormat(' Review ', 0, 8, 'bold').value).toBe(' **Review** ');
  });

  it('uses longer code delimiters for content containing literal backticks', () => {
    const inline = applyMessagingFormat('const `x`', 0, 9, 'inlineCode');
    expect(messagingFormattedText(inline.value).trim()).toBe('const `x`');
    const code = applyMessagingFormat('before ``` after', 7, 10, 'codeBlock');
    expect(code.value).toBe('before \n````\n```\n````\n after');
    expect(
      parseMessagingMarkdown(code.value).some(
        (node) => node.kind === 'code' && node.value === '```'
      )
    ).toBe(true);
  });

  it('formats whole selected lines, excluding the line after a selected newline', () => {
    expect(applyMessagingFormat('one\ntwo\nthree', 1, 8, 'bulletList').value).toBe(
      '- one\n- two\nthree'
    );
    expect(applyMessagingFormat('one\ntwo', 0, 7, 'numberedList').value).toBe('1. one\n2. two');
    expect(applyMessagingFormat('', 0, 0, 'bulletList')).toEqual({
      value: '- ',
      selectionStart: 2,
      selectionEnd: 2,
    });
  });

  it('toggles lists, switches list kinds, and keeps an unselected following paragraph', () => {
    expect(applyMessagingFormat('- one\n- two\nTail', 0, 12, 'bulletList').value).toBe(
      'one\ntwo\nTail'
    );
    expect(applyMessagingFormat('- one\n- two', 0, 11, 'numberedList').value).toBe(
      '1. one\n2. two'
    );
    expect(applyMessagingFormat('\nTail', 0, 0, 'bulletList').value).toBe('- \nTail');
  });

  it('filters mention text independently of visual formatting', () => {
    expect(
      messagingFormattedText('**@Kim** _@Lee_ `@Code`\n```\n@Block\n```', true)
        .replace(/\s+/gu, ' ')
        .trim()
    ).toBe('@Kim @Lee');
    expect(
      messagingFormattedText(
        '[@Kim](https://example.com) ![@Lee](https://example.com/pixel)',
        true
      ).trim()
    ).toBe('');
  });

  it.each(['`', '``code ', '```ts\n', '~~~\n', '- `'])(
    'does not offer mentions inside unfinished code: %s',
    (prefix) => {
      expect(messagingMentionAllowedAt(`${prefix}@Ki`, prefix.length)).toBe(false);
    }
  );

  it.each(['**', '_', '- **', 'After `code` ', '~~~\n`open\n~~~\n', '```ts\nconst x=1\n```\n'])(
    'allows mentions in prose and formatted text: %s',
    (prefix) => {
      expect(messagingMentionAllowedAt(`${prefix}@Ki`, prefix.length)).toBe(true);
    }
  );
});
