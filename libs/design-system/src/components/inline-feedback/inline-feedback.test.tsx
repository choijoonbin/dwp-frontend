import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { InlineFeedback } from './inline-feedback';

describe('InlineFeedback', () => {
  it.each([
    ['info', 'status', 'polite'],
    ['success', 'status', 'polite'],
    ['warning', 'alert', 'assertive'],
    ['error', 'alert', 'assertive'],
  ] as const)('announces %s with an appropriate role', (severity, role, live) => {
    const markup = renderToStaticMarkup(
      <InlineFeedback severity={severity} title="계정 설정">
        Changes remain on this device until saved.
      </InlineFeedback>
    );
    expect(markup).toContain(`role="${role}"`);
    expect(markup).toContain(`aria-live="${live}"`);
    expect(markup).toContain('aria-atomic="true"');
    expect(markup).toContain('계정 설정');
    expect(markup).toContain('Changes remain on this device until saved.');
    expect(markup).not.toContain('min-height:120px');
  });

  it('does not add a dismiss control without a caller command', () => {
    const markup = renderToStaticMarkup(<InlineFeedback>Persistent information</InlineFeedback>);
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain('<button');
  });

  it('uses the caller-provided accessible label and executes dismissal', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    const root = createRoot(container);
    const close = vi.fn();
    try {
      await act(async () =>
        root.render(
          <InlineFeedback closeLabel="Dismiss device warning" onClose={close} severity="warning">
            Device unavailable
          </InlineFeedback>
        )
      );
      const button = container.querySelector('button');
      expect(button?.getAttribute('aria-label')).toBe('Dismiss device warning');
      await act(async () => button?.click());
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => root.unmount());
    }
  });
});
