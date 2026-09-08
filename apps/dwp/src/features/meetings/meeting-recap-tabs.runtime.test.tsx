// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const geometry = vi.hoisted(() => ({ available: 1144, required: 806 }));
vi.mock('@mui/material/Tabs', async () => {
  const { createElement: element, forwardRef } = await import('react');
  return {
    default: forwardRef<HTMLDivElement, { scrollButtons: string | boolean; dir?: string }>(
      (props, ref) =>
        element(
          'div',
          {
            ref,
            'data-tab-root': true,
            'data-scroll-buttons': String(props.scrollButtons),
            dir: props.dir,
            style: { paddingLeft: 4, paddingRight: 4 },
          },
          element('div', { role: 'tablist' }, element('button', { role: 'tab' }, 'Overview'))
        )
    ),
  };
});
import { MeetingRecapTabs } from './meeting-recap-tabs';

let root: Root;
let mount: HTMLDivElement;
let resize: () => void;
const disconnect = vi.fn();
const observe = vi.fn();

beforeEach(() => {
  geometry.available = 1144;
  geometry.required = 806;
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe = observe;
      disconnect = disconnect;
    }
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.hasAttribute('data-tab-root') ? geometry.available : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.getAttribute('role') === 'tablist' ? geometry.required : 0;
  });
  mount = document.createElement('div');
  document.body.append(mount);
  root = createRoot(mount);
});
afterEach(async () => {
  await act(async () => root.unmount());
  mount.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function render(dir: 'ltr' | 'rtl' = 'ltr') {
  await act(async () => root.render(createElement(MeetingRecapTabs, { dir, value: 0 })));
}
const buttons = () => mount.querySelector('[data-tab-root]')?.getAttribute('data-scroll-buttons');

describe('recap horizontal overflow permission', () => {
  it('keeps controls absent when current content fits with focus clearance', async () => {
    await render();
    expect(buttons()).toBe('false');
    expect(observe).toHaveBeenCalledTimes(2);
  });
  it('allows real narrow-screen overflow and removes controls after expansion', async () => {
    geometry.available = 320;
    await render();
    expect(buttons()).toBe('auto');
    geometry.available = 1144;
    await act(async () => resize());
    expect(buttons()).toBe('false');
  });
  it('remeasures changed label/font width without a viewport change', async () => {
    await render();
    geometry.required = 1600;
    await act(async () => resize());
    expect(buttons()).toBe('auto');
  });
  it('does not interpret transient hidden geometry as proof that overflow disappeared', async () => {
    geometry.available = 320;
    await render();
    geometry.available = 0;
    await act(async () => resize());
    expect(buttons()).toBe('auto');
    geometry.available = 1144;
    await act(async () => resize());
    expect(buttons()).toBe('false');
  });
  it('uses width rather than a positive scrollLeft assumption for RTL', async () => {
    await render('rtl');
    expect(buttons()).toBe('false');
    geometry.available = 320;
    await act(async () => resize());
    expect(buttons()).toBe('auto');
  });
  it('disconnects observers and rejects late resize callbacks on unmount', async () => {
    await render();
    await act(async () => root.render(null));
    expect(disconnect).toHaveBeenCalledTimes(1);
    geometry.required = 1600;
    await act(async () => resize());
    expect(mount.childElementCount).toBe(0);
  });
});
