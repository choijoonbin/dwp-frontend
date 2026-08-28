import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HomePurposeStatus, resolveHomePurposeStatusAccessibility } from './home-purpose-status';

describe('HomePurposeStatus accessibility contract', () => {
  it('announces a total provider outage assertively', () => {
    expect(resolveHomePurposeStatusAccessibility('UNAVAILABLE')).toEqual({
      role: 'alert',
      live: 'assertive',
    });
  });

  it.each(['PARTIAL', 'RESTRICTED', 'EMPTY'] as const)(
    'announces %s as a non-disruptive status update',
    (state) => {
      expect(resolveHomePurposeStatusAccessibility(state)).toEqual({
        role: 'status',
        live: 'polite',
      });
    }
  );

  it('applies the live-region contract to the rendered status presenter', () => {
    const unavailable = renderToStaticMarkup(
      createElement(HomePurposeStatus, {
        state: 'UNAVAILABLE',
        title: 'Unavailable',
        description: 'Try again later',
        supportStack: false,
        fetching: false,
        retryLabel: 'Retry',
      })
    );
    const empty = renderToStaticMarkup(
      createElement(HomePurposeStatus, {
        state: 'EMPTY',
        title: 'All clear',
        description: 'No pending work',
        supportStack: false,
        fetching: false,
        retryLabel: 'Retry',
      })
    );

    expect(unavailable).toContain('role="alert"');
    expect(unavailable).toContain('aria-live="assertive"');
    expect(unavailable).toContain('aria-atomic="true"');
    expect(empty).toContain('role="status"');
    expect(empty).toContain('aria-live="polite"');
  });
});
