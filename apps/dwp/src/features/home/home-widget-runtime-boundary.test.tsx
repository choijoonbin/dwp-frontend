// @vitest-environment jsdom
import { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomeWidgetRuntimeBoundary } from './home-widget-runtime-boundary';
import { staticHomeWidgetRuntimeDecisions } from './runtime/widget-registry-runtime';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

describe('HomeWidgetRuntimeBoundary', () => {
  it('preserves native child identity, refs, and evidence without creating a layout box', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    cleanups.push(() => {
      root.unmount();
      host.remove();
    });
    const ref = createRef<HTMLElement>();
    const decision = staticHomeWidgetRuntimeDecisions()['focus-balance'];
    const render = () =>
      root.render(
        <HomeWidgetRuntimeBoundary decision={decision} label="Focus time">
          <section ref={ref} data-widget-runtime-state="source-available">
            Native content
          </section>
        </HomeWidgetRuntimeBoundary>
      );
    await act(render);
    const originalChild = ref.current;
    const boundary = host.querySelector<HTMLElement>('[data-workspace-widget-transparent]')!;
    expect(getComputedStyle(boundary).display).toBe('contents');
    expect(boundary.dataset.widgetRuntimeState).toBe('available');
    expect(boundary.querySelector('section')).toBe(originalChild);
    expect(originalChild?.dataset.widgetRuntimeState).toBe('source-available');
    await act(render);
    expect(ref.current).toBe(originalChild);
  });

  it('does not mount native content when the authoritative decision denies rendering', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    cleanups.push(() => root.unmount());
    const nativeRender = vi.fn(() => <section>Native content</section>);
    const Native = nativeRender;
    await act(() =>
      root.render(
        <HomeWidgetRuntimeBoundary
          decision={{
            ...staticHomeWidgetRuntimeDecisions().focus,
            render: 'UNAVAILABLE',
            rendererKey: null,
          }}
          label="Focus"
        >
          <Native />
        </HomeWidgetRuntimeBoundary>
      )
    );
    expect(nativeRender).not.toHaveBeenCalled();
    expect(host.querySelector('[data-widget-runtime-state="unavailable"]')).not.toBeNull();
  });
});
