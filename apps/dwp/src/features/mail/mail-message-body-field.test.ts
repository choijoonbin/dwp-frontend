// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { applyRichTextCommand, sanitizeRichMailHtml } from './mail-message-body-field';

afterEach(() => {
  document.body.replaceChildren();
  window.getSelection()?.removeAllRanges();
});

describe('mail rich message sanitization', () => {
  it('keeps supported formatting and removes executable markup and attributes', () => {
    const clean = sanitizeRichMailHtml(
      '<p onclick="steal()"><strong>Safe</strong><img src=x onerror=steal()><script>bad()</script></p>'
    );

    expect(clean).toBe('<p><strong>Safe</strong></p>');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('<img');
    expect(clean).not.toContain('<script');
  });

  it('preserves list semantics while stripping inline styles', () => {
    expect(sanitizeRichMailHtml('<ul style="color:red"><li data-x="1">One</li></ul>')).toBe(
      '<ul><li>One</li></ul>'
    );
  });

  it('drops dangerous element contents instead of exposing their fallback text', () => {
    expect(
      sanitizeRichMailHtml(
        '<p>Visible<style>.secret{display:block}</style><template>hidden</template><svg><text>svg text</text></svg></p>'
      )
    ).toBe('<p>Visible</p>');
  });

  it('applies and removes inline formatting with Selection and Range DOM transforms', () => {
    const editor = richEditor('<p>Hello world</p>');
    selectText(editor.querySelector('p')!.firstChild!, 6, 11);

    applyRichTextCommand(editor, 'bold');
    expect(editor.innerHTML).toBe('<p>Hello <strong>world</strong></p>');

    const formatted = editor.querySelector('strong')!.firstChild!;
    selectText(formatted, 0, formatted.textContent!.length);
    applyRichTextCommand(editor, 'bold');
    expect(editor.innerHTML).toBe('<p>Hello world</p>');
  });

  it('converts selected blocks to and from semantic lists without execCommand', () => {
    const editor = richEditor('<p>One</p><p>Two</p>');
    selectAcross(
      editor.querySelectorAll('p')[0]!.firstChild!,
      editor.querySelectorAll('p')[1]!.firstChild!
    );

    applyRichTextCommand(editor, 'insertUnorderedList');
    expect(editor.innerHTML).toBe('<ul><li>One</li><li>Two</li></ul>');

    const first = editor.querySelector('li')!.firstChild!;
    selectText(first, 0, first.textContent!.length);
    applyRichTextCommand(editor, 'insertUnorderedList');
    expect(editor.innerHTML).toBe('<p>One</p><p>Two</p>');
  });
});

function richEditor(html: string) {
  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.innerHTML = html;
  document.body.append(editor);
  return editor;
}

function selectText(node: Node, start: number, end: number) {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

function selectAcross(startNode: Node, endNode: Node) {
  const range = document.createRange();
  range.setStart(startNode, 0);
  range.setEnd(endNode, endNode.textContent!.length);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}
