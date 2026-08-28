// @vitest-environment jsdom

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFocusWhenReady } from './saved-view-custody-focus';

function FocusHarness({ pending, ready }: { pending: boolean; ready: boolean }) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  useFocusWhenReady(inputRef, pending, ready);
  return React.createElement('input', { ref: inputRef, 'aria-label': 'Target' });
}

describe('useFocusWhenReady', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await React.act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('focuses once after recovery is stable and resets for the next failure', async () => {
    await React.act(async () =>
      root.render(React.createElement(FocusHarness, { pending: true, ready: false }))
    );
    const input = container.querySelector('input')!;

    await React.act(async () =>
      root.render(React.createElement(FocusHarness, { pending: true, ready: true }))
    );
    await React.act(async () => vi.advanceTimersByTime(299));
    expect(input).not.toBe(document.activeElement);
    await React.act(async () => vi.advanceTimersByTime(1));
    expect(input).toBe(document.activeElement);

    input.blur();
    await React.act(async () =>
      root.render(React.createElement(FocusHarness, { pending: false, ready: true }))
    );
    await React.act(async () =>
      root.render(React.createElement(FocusHarness, { pending: true, ready: true }))
    );
    await React.act(async () => vi.advanceTimersByTime(300));
    expect(input).toBe(document.activeElement);
  });
});
