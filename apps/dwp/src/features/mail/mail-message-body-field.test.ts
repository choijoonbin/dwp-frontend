// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { sanitizeRichMailHtml } from './mail-message-body-field';

describe('mail rich message sanitization', () => {
  it('keeps supported formatting and removes executable markup and attributes', () => {
    const clean = sanitizeRichMailHtml(
      '<p onclick="steal()"><strong>Safe</strong><img src=x onerror=steal()><script>bad()</script></p>'
    );

    expect(clean).toContain('<p><strong>Safe</strong>bad()</p>');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('<img');
    expect(clean).not.toContain('<script');
  });

  it('preserves list semantics while stripping inline styles', () => {
    expect(sanitizeRichMailHtml('<ul style="color:red"><li data-x="1">One</li></ul>')).toBe(
      '<ul><li>One</li></ul>'
    );
  });
});
