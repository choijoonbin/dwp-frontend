// @vitest-environment jsdom

import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'navigation.expand': 'Expand navigation',
        'navigation.collapse': 'Collapse navigation',
      })[key] ?? key,
  }),
}));

vi.mock('./brand-lockup', async () => {
  const { createElement: createMockElement } = await import('react');
  return {
    BrandLockup: ({ variant }: { variant: string }) =>
      createMockElement('a', {
        'data-testid': 'brand-lockup',
        'data-variant': variant,
        href: '/',
      }),
  };
});

vi.mock('../features/shell/shell-mobile-navigation', async () => {
  const { createElement: createMockElement } = await import('react');
  return {
    ShellMobileNavigationCloseButton: ({ onDismiss }: { onDismiss: () => void }) =>
      createMockElement(
        'button',
        { 'data-testid': 'mobile-navigation-close', onClick: onDismiss },
        'Close navigation'
      ),
  };
});

import { DesktopNavigationHeader } from './desktop-navigation-header';

let host!: HTMLDivElement;
let root!: Root;

function CollapsibleHeaderHarness() {
  const [compact, setCompact] = useState(false);

  return createElement(DesktopNavigationHeader, {
    compact,
    collapsible: true,
    controlsId: 'test-desktop-navigation',
    onToggle: () => setCompact((current) => !current),
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
});

describe('desktop navigation header', () => {
  it('keeps one focused toggle while the product mark morphs between rail states', () => {
    act(() => root.render(createElement(CollapsibleHeaderHarness)));

    const expandedToggle = host.querySelector<HTMLButtonElement>(
      '[data-testid="desktop-navigation-toggle"]'
    );
    expect(expandedToggle).not.toBeNull();
    expect(expandedToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(expandedToggle?.getAttribute('aria-controls')).toBe('test-desktop-navigation');
    expect(
      expandedToggle?.querySelector('[data-navigation-toggle-visual-kind="sidebar"]')
    ).not.toBeNull();
    expect(
      expandedToggle?.querySelector('[data-navigation-toggle-visual-kind="collapse"]')
    ).not.toBeNull();
    expect(host.querySelector('[data-testid="brand-lockup"]')).not.toBeNull();

    expandedToggle?.focus();
    act(() => expandedToggle?.click());

    const compactToggle = host.querySelector<HTMLButtonElement>(
      '[data-testid="desktop-navigation-toggle"]'
    );
    expect(compactToggle).toBe(expandedToggle);
    expect(document.activeElement).toBe(compactToggle);
    expect(compactToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(
      compactToggle?.querySelector('[data-navigation-toggle-visual-kind="product-mark"]')
    ).not.toBeNull();
    expect(
      compactToggle?.querySelector('[data-navigation-toggle-visual-kind="expand"]')
    ).not.toBeNull();
    expect(host.querySelector('[data-testid="brand-lockup"]')).toBeNull();

    act(() => compactToggle?.click());
    expect(host.querySelector('[data-testid="desktop-navigation-toggle"]')).toBe(compactToggle);
    expect(document.activeElement).toBe(compactToggle);
  });

  it('keeps the mobile close action separate from the desktop collapse control', () => {
    const onDismiss = vi.fn();
    act(() =>
      root.render(
        createElement(DesktopNavigationHeader, {
          compact: false,
          collapsible: true,
          controlsId: 'test-desktop-navigation',
          onDismiss,
          onToggle: vi.fn(),
        })
      )
    );

    expect(host.querySelector('[data-testid="brand-lockup"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="mobile-navigation-close"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="desktop-navigation-toggle"]')).toBeNull();
  });

  it('preserves the home link without an expand affordance for a policy-forced rail', () => {
    act(() =>
      root.render(
        createElement(DesktopNavigationHeader, {
          compact: true,
          collapsible: false,
          controlsId: 'test-desktop-navigation',
          onToggle: vi.fn(),
        })
      )
    );

    expect(host.querySelector('[data-testid="brand-lockup"]')?.getAttribute('data-variant')).toBe(
      'product-only'
    );
    expect(host.querySelector('[data-testid="desktop-navigation-toggle"]')).toBeNull();
  });
});
