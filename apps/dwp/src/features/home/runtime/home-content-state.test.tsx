// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  HOME_CONTENT_STATES,
  HomeContentState,
  HomeWidgetErrorBoundary,
  resolveHomeContentStateSemantics,
} from './home-content-state';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values ? `:${JSON.stringify(values)}` : ''}`,
  }),
}));

describe('Home content state contract', () => {
  it('keeps all accepted states explicit and machine-readable', () => {
    expect(HOME_CONTENT_STATES).toEqual([
      'initial-loading',
      'background-refresh',
      'empty',
      'partial',
      'forbidden',
      'stale',
      'widget-error',
      'dirty',
      'conflict',
    ]);
    for (const kind of HOME_CONTENT_STATES) {
      const markup = renderToStaticMarkup(createElement(HomeContentState, { kind }));
      expect(markup).toContain(`data-home-content-state="${kind}"`);
    }
  });

  it('preserves verified information while refreshing, partial, stale, or dirty', () => {
    for (const kind of ['background-refresh', 'partial', 'stale', 'dirty'] as const) {
      expect(resolveHomeContentStateSemantics(kind)).toEqual({
        blocksContent: false,
        preservesVerifiedContent: true,
        role: 'status',
      });
      const markup = renderToStaticMarkup(
        createElement(HomeContentState, {
          kind,
          preservedContent: createElement('p', null, 'Verified content remains'),
        })
      );
      expect(markup).toContain('Verified content remains');
      expect(markup).toContain('data-home-content-preserved="true"');
    }
  });

  it('does not present forbidden or failed content as a successful empty result', () => {
    expect(resolveHomeContentStateSemantics('empty').role).toBe('status');
    expect(resolveHomeContentStateSemantics('forbidden').blocksContent).toBe(true);
    expect(resolveHomeContentStateSemantics('widget-error').role).toBe('alert');
    expect(resolveHomeContentStateSemantics('conflict').role).toBe('alert');
  });

  it('renders a generic widget failure without requiring an internal widget identifier', () => {
    const markup = renderToStaticMarkup(
      createElement(HomeContentState, { kind: 'widget-error' })
    );
    expect(markup).not.toContain('{{widget}}');
    expect(markup).not.toContain('fixture.widget');
  });

  it('attributes partial and stale evidence to sources and last success time', () => {
    const markup = renderToStaticMarkup(
      createElement(HomeContentState, {
        kind: 'stale',
        affectedSources: ['Calendar', 'Meetings'],
        lastSuccessfulAt: '09:42',
      })
    );
    expect(markup).toContain('Calendar, Meetings');
    expect(markup).toContain('09:42');
    expect(markup).toContain('data-home-state-sources');
    expect(markup).toContain('data-home-state-last-success');
  });

  it('contains one widget crash while preserving sibling Home content', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    const root = createRoot(host);
    const onError = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const CrashedWidget = () => {
      throw new Error('fixture widget failed');
    };

    try {
      await act(async () => {
        root.render(
          <main>
            <HomeWidgetErrorBoundary widgetKey="fixture.widget" onError={onError}>
              <CrashedWidget />
            </HomeWidgetErrorBoundary>
            <p data-safe-sibling>Verified sibling content</p>
          </main>
        );
      });

      expect(host.querySelector('[data-home-content-state="widget-error"]')).not.toBeNull();
      expect(host.textContent).not.toContain('{{widget}}');
      expect(host.textContent).not.toContain('fixture.widget');
      expect(host.querySelector('[data-safe-sibling]')?.textContent).toBe(
        'Verified sibling content'
      );
      expect(onError).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
      await act(async () => root.unmount());
    }
  });
});
