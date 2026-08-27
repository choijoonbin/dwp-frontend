// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useShellMobileNavigation,
  type ShellMobileNavigationController,
} from './shell-mobile-navigation';

let controller!: ShellMobileNavigationController;
let host!: HTMLDivElement;
let root!: Root;
let desktopListener: ((event: MediaQueryListEvent) => void) | undefined;

function Harness() {
  controller = useShellMobileNavigation({ headerTestId: 'test-shell-header' });
  return controller.open ? createElement('button', { id: 'drawer-action' }, 'Drawer action') : null;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    media: '(min-width:1200px)',
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      desktopListener = listener;
    },
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  }));
  document.body.innerHTML = [
    '<header data-testid="test-shell-header"><button id="trigger">Open</button></header>',
    '<aside id="test-desktop-navigation"><a id="desktop-current" href="/current" aria-current="page">Current</a></aside>',
    '<main id="dwp-main-content"><h1 id="route-heading">Current page</h1></main>',
    '<button id="auxiliary" data-shell-auxiliary-layer>Auxiliary action</button>',
    '<div id="test-root"></div>',
  ].join('');
  host = document.getElementById('test-root') as HTMLDivElement;
  root = createRoot(host);
  act(() => root.render(createElement(Harness)));
});

afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('shell mobile navigation controller', () => {
  it('makes the background inert and restores trigger focus after dismiss', () => {
    const trigger = document.getElementById('trigger') as HTMLButtonElement;

    act(() => controller.openFrom(trigger));
    const drawerAction = document.getElementById('drawer-action') as HTMLButtonElement;
    expect(document.querySelector('header')?.hasAttribute('inert')).toBe(true);
    expect(document.querySelector('main')?.hasAttribute('inert')).toBe(true);
    expect(document.getElementById('auxiliary')?.hasAttribute('inert')).toBe(true);

    drawerAction.focus();
    act(() => controller.dismiss());

    expect(document.querySelector('header')?.hasAttribute('inert')).toBe(false);
    expect(document.querySelector('main')?.hasAttribute('inert')).toBe(false);
    expect(document.getElementById('auxiliary')?.hasAttribute('inert')).toBe(false);
    expect(drawerAction.isConnected).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('does not steal focus back from the next route after navigation', () => {
    const trigger = document.getElementById('trigger') as HTMLButtonElement;
    const routeHeading = document.getElementById('route-heading') as HTMLHeadingElement;

    act(() => controller.openFrom(trigger));
    const drawerAction = document.getElementById('drawer-action') as HTMLButtonElement;
    drawerAction.focus();
    act(() => controller.navigate());
    routeHeading.tabIndex = -1;
    routeHeading.focus();

    expect(drawerAction.isConnected).toBe(false);
    expect(document.activeElement).toBe(routeHeading);
    expect(document.activeElement).not.toBe(trigger);
  });

  it('closes without restoring a hidden trigger when the layout crosses into desktop', () => {
    const trigger = document.getElementById('trigger') as HTMLButtonElement;
    const desktopCurrent = document.getElementById('desktop-current') as HTMLAnchorElement;

    act(() => controller.openFrom(trigger));
    const drawerAction = document.getElementById('drawer-action') as HTMLButtonElement;
    drawerAction.focus();
    act(() => desktopListener?.({ matches: true } as MediaQueryListEvent));

    expect(controller.open).toBe(false);
    expect(document.querySelector('header')?.hasAttribute('inert')).toBe(false);
    expect(document.querySelector('main')?.hasAttribute('inert')).toBe(false);
    expect(drawerAction.isConnected).toBe(false);
    expect(document.activeElement).toBe(desktopCurrent);
    expect(document.activeElement).not.toBe(trigger);
  });

  it('falls back to the current route heading when no desktop navigation item is current', () => {
    document.getElementById('desktop-current')?.removeAttribute('aria-current');
    const trigger = document.getElementById('trigger') as HTMLButtonElement;
    const routeHeading = document.getElementById('route-heading') as HTMLHeadingElement;

    act(() => controller.openFrom(trigger));
    document.getElementById('drawer-action')?.focus();
    act(() => desktopListener?.({ matches: true } as MediaQueryListEvent));

    expect(routeHeading.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(routeHeading);
  });
});
