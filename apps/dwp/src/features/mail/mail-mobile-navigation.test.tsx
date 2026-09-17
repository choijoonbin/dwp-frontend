// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';

import type { ProductAreaMobileShellContext } from '../../layouts/product-area-layout';
import { resolveMailProductAreaMobileShell } from './mail-mobile-navigation';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

let host: HTMLDivElement;
let root: Root;

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function mobileContext(
  pathname: string,
  visibleNavigationPaths: readonly string[],
  onOpen = vi.fn()
): ProductAreaMobileShellContext {
  return {
    pathname,
    search: '',
    visibleNavigationPaths,
    navigation: {
      controlsId: 'mail-mobile-navigation',
      expanded: false,
      label: 'Open mail navigation',
      testId: 'mail-mobile-navigation-trigger',
      onOpen,
    },
    onNavigate: vi.fn(),
  };
}

async function renderNavigation(context: ProductAreaMobileShellContext) {
  const shell = resolveMailProductAreaMobileShell(context);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[context.pathname]}>
        {shell.footer}
        <CurrentLocation />
      </MemoryRouter>
    )
  );
}

describe('Mail mobile navigation', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    document.body.replaceChildren();
  });

  it('keeps one stable user destination set and routes secondary pages through More', async () => {
    await renderNavigation(
      mobileContext('/mail/search', [
        '/mail/home',
        '/mail/inbox',
        '/mail/shared',
        '/mail/search',
        '/mail/follow-up',
      ])
    );

    const navigation = host.querySelector('[data-testid="mail-mobile-bottom-navigation"]');
    expect(navigation?.querySelectorAll('a')).toHaveLength(3);
    expect(
      navigation
        ?.querySelector('[data-testid="mail-mobile-navigation-more"]')
        ?.getAttribute('aria-current')
    ).toBe('page');

    await act(async () => {
      (
        navigation?.querySelector('[data-testid="mail-mobile-navigation-inbox"]') as HTMLElement
      ).click();
    });
    expect(host.querySelector('[data-testid="location"]')?.textContent).toBe('/mail/inbox');
  });

  it('projects only granted admin destinations and groups retention with delivery audit', async () => {
    const onOpen = vi.fn();
    await renderNavigation(
      mobileContext(
        '/mail/admin/delivery-audit',
        [
          '/mail/admin/overview',
          '/mail/admin/shared-inboxes',
          '/mail/admin/retention',
          '/mail/admin/delivery-audit',
        ],
        onOpen
      )
    );

    const navigation = host.querySelector('[data-testid="mail-mobile-bottom-navigation"]');
    expect(navigation?.querySelectorAll('a')).toHaveLength(2);
    expect(
      navigation?.querySelector('[data-testid="mail-mobile-navigation-admin-overview"]')
    ).toBeTruthy();
    expect(
      navigation?.querySelector('[data-testid="mail-mobile-navigation-admin-shared-inboxes"]')
    ).toBeTruthy();
    expect(
      navigation?.querySelector('[data-testid="mail-mobile-navigation-admin-connections"]')
    ).toBeNull();
    expect(
      navigation?.querySelector('[data-testid="mail-mobile-navigation-admin-policies"]')
    ).toBeNull();

    const retentionAndAudit = navigation?.querySelector(
      '[data-testid="mail-mobile-navigation-more"]'
    ) as HTMLButtonElement;
    expect(retentionAndAudit.textContent).toContain('mobileNavigation.items.retentionAudit');
    expect(retentionAndAudit.getAttribute('aria-current')).toBe('page');
    expect(retentionAndAudit.getAttribute('aria-controls')).toBe('mail-mobile-navigation');

    await act(async () => retentionAndAudit.click());
    expect(onOpen).toHaveBeenCalledWith(retentionAndAudit);
  });

  it('omits the footer until at least one authorized Mail destination is known', () => {
    expect(
      resolveMailProductAreaMobileShell(mobileContext('/mail/home', [])).footer
    ).toBeUndefined();
  });
});
