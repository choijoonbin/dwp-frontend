// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BriefcaseBusiness } from 'lucide-react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let compactSpecializedMobileShell = false;
vi.mock('@mui/material/useMediaQuery', () => ({
  default: (query: string) =>
    query === '(max-width:1199.95px)' ? compactSpecializedMobileShell : false,
}));

vi.mock('@mui/material/Drawer', async () => {
  const { createElement, useEffect, useRef } = await import('react');
  function MockDrawer({
    children,
    open,
    slotProps,
  }: {
    children: ReactNode;
    open: boolean;
    slotProps?: { transition?: { onExited?: () => void } };
  }) {
    const wasOpen = useRef(open);
    useEffect(() => {
      if (wasOpen.current && !open) slotProps?.transition?.onExited?.();
      wasOpen.current = open;
    }, [open, slotProps?.transition]);
    return open ? createElement('div', null, children) : null;
  }
  return { default: MockDrawer };
});

vi.mock('@dwp-frontend/design-system/appearance', () => ({
  useAppearance: () => ({ preference: { highContrast: false } }),
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => ({
    user: {
      identityPlane: 'tenant',
      tenantId: 'tenant-1',
      tenantName: 'Tenant',
      userId: 'user-1',
    },
  }),
}));

vi.mock('@dwp-frontend/shared-utils/auth/control-plane-access', () => ({
  isProviderIdentity: () => false,
}));

vi.mock('@dwp-frontend/shared-utils/auth/provider-support-context', () => ({
  useProviderSupportContext: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: () => ({ hasPermission: () => true, isLoaded: true, permissions: [] }),
}));

vi.mock('../components/desktop-navigation-header', () => ({
  DesktopNavigationHeader: () => null,
}));

vi.mock('../components/shell-header', async () => {
  const { createElement } = await import('react');
  return {
    shellHeaderHeight: 64,
    shellMobileContextRailHeight: 40,
    ShellHeader: ({
      navigation,
    }: {
      navigation: {
        onOpen: (trigger: HTMLButtonElement) => void;
        testId: string;
      };
    }) =>
      createElement(
        'button',
        {
          'data-testid': navigation.testId,
          onClick: (event: { currentTarget: HTMLButtonElement }) =>
            navigation.onOpen(event.currentTarget),
          type: 'button',
        },
        'Open navigation'
      ),
  };
});

vi.mock('../components/product-surface-focus-handoff', () => ({
  clearProductSurfaceFocusAfterNavigation: () => undefined,
  clearProductSurfaceFocus: () => undefined,
  deferProductSurfaceFocusClear: () => undefined,
  recordProductSurfaceFocus: () => undefined,
  synchronizeProductSurfaceFocus: () => undefined,
}));

vi.mock('../features/shell/desktop-navigation', () => ({
  useDesktopNavigation: () => ({
    compact: false,
    collapsible: true,
    desktopOffset: 280,
    sidebarWidth: 280,
    toggle: () => undefined,
  }),
}));

vi.mock('../observability/product-surface-telemetry-context', () => ({
  ProductSurfaceTelemetryExposure: ({ children }: { children: ReactNode }) => children,
  useProductSurfaceTelemetry: () => ({ captureReturn: () => undefined }),
}));

vi.mock('./product-area-permissions', () => ({
  canAccessProductAreaNavigationItem: () => true,
}));

import {
  ProductAreaLayout,
  type ProductAreaNavigationItemChildrenContext,
} from './product-area-layout';

let host: HTMLDivElement;
let root: Root;
let commitRoute: (() => void) | undefined;
let expectedTargetLocation = '/hr/new';
let nextFrameId = 0;
let frames = new Map<number, FrameRequestCallback>();

function DeferredRouteChild({
  onNavigateToTarget,
}: Pick<ProductAreaNavigationItemChildrenContext, 'onNavigateToTarget'>) {
  const navigate = useNavigate();
  return (
    <button
      data-testid="deferred-mobile-child"
      type="button"
      onClick={() => {
        onNavigateToTarget?.(() => {
          const target = document.querySelector<HTMLElement>('#dwp-main-content h1');
          if (target && !target.matches('[tabindex]')) target.tabIndex = -1;
          return target;
        }, expectedTargetLocation);
        if (expectedTargetLocation !== '/hr/old') {
          commitRoute = () => navigate(expectedTargetLocation);
        }
      }}
    >
      New route
    </button>
  );
}

function renderChildren(context: ProductAreaNavigationItemChildrenContext) {
  return context.selected ? (
    <DeferredRouteChild onNavigateToTarget={context.onNavigateToTarget} />
  ) : null;
}

function OldRoute() {
  const navigate = useNavigate();
  return (
    <>
      <h1 data-testid="old-heading">Old route</h1>
      <button data-testid="main-route-change" type="button" onClick={() => navigate('/hr/new')}>
        Change route
      </button>
      <button
        data-testid="same-path-context-change"
        type="button"
        onClick={() =>
          navigate('/hr/old?navigationScope=LEGAL_ENTITY&legalEntityPublicId=entity-b')
        }
      >
        Change legal entity
      </button>
    </>
  );
}

function NewRoute() {
  return <h1 data-testid="new-heading">New route</h1>;
}

function Application({
  navigationChildrenPresentation = 'inline',
}: {
  navigationChildrenPresentation?: 'inline' | 'panel';
} = {}) {
  return (
    <MemoryRouter initialEntries={['/hr/old']}>
      <Routes>
        <Route
          path="/hr"
          element={
            <ProductAreaLayout
              areaKey="hcm"
              navigation={[
                {
                  id: 'work',
                  items: [
                    {
                      path: '/hr/old',
                      view: 'old',
                      icon: BriefcaseBusiness,
                      activePathPrefixes: ['/hr/old', '/hr/new'],
                    },
                  ],
                },
              ]}
              renderNavigationItemChildren={renderChildren}
              navigationChildrenPresentation={navigationChildrenPresentation}
            />
          }
        >
          <Route path="old" element={<OldRoute />} />
          <Route path="new" element={<NewRoute />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  commitRoute = undefined;
  expectedTargetLocation = '/hr/new';
  compactSpecializedMobileShell = false;
  nextFrameId = 0;
  frames = new Map();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrameId += 1;
    frames.set(nextFrameId, callback);
    return nextFrameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (frameId: number) => frames.delete(frameId));
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    media: '(min-width:1200px)',
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  }));
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<Application />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('ProductAreaLayout child navigation focus contracts', () => {
  it('opens panel navigation without changing route and restores trigger focus on Escape', async () => {
    await act(async () => root.render(<Application navigationChildrenPresentation="panel" />));
    const trigger = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-navigation-item-old"]'
    )!;

    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-current')).toBe('page');
    await act(async () => trigger.click());

    const panel = host.querySelector<HTMLElement>('[data-testid="hcm-desktop-task-navigator"]');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('role')).toBe('region');
    expect(panel?.querySelector('[data-testid="deferred-mobile-child"]')).not.toBeNull();
    const toolbar = panel?.querySelector('[data-testid="hcm-desktop-task-navigator-toolbar"]');
    const scrollBody = panel?.querySelector('[data-testid="hcm-desktop-task-navigator-scroll"]');
    expect(toolbar).not.toBeNull();
    expect(scrollBody).not.toBeNull();
    expect(toolbar?.parentElement).toBe(panel);
    expect(scrollBody?.parentElement).toBe(panel);
    expect(scrollBody!.contains(toolbar!)).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-current')).toBeNull();

    await act(async () =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    );
    flushScheduledFramesUntil(() => document.activeElement === trigger);

    expect(host.querySelector('[data-testid="hcm-desktop-task-navigator"]')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-current')).toBe('page');
    expect(document.activeElement).toBe(trigger);
    expect(host.querySelector('[data-testid="old-heading"]')).not.toBeNull();
  });

  it('closes an open panel when another surface changes the route', async () => {
    await act(async () => root.render(<Application navigationChildrenPresentation="panel" />));
    const trigger = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-navigation-item-old"]'
    )!;
    await act(async () => trigger.click());
    expect(host.querySelector('[data-testid="hcm-desktop-task-navigator"]')).not.toBeNull();

    const routeChange = host.querySelector<HTMLButtonElement>('[data-testid="main-route-change"]')!;
    await act(async () => routeChange.click());

    expect(host.querySelector('[data-testid="hcm-desktop-task-navigator"]')).toBeNull();
    expect(host.querySelector('[data-testid="new-heading"]')).not.toBeNull();
  });

  it('does not reuse an open panel across a same-path legal-entity context change', async () => {
    await act(async () => root.render(<Application navigationChildrenPresentation="panel" />));
    const trigger = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-navigation-item-old"]'
    )!;
    await act(async () => trigger.click());
    expect(host.querySelector('[data-testid="hcm-desktop-task-navigator"]')).not.toBeNull();

    const contextChange = host.querySelector<HTMLButtonElement>(
      '[data-testid="same-path-context-change"]'
    )!;
    await act(async () => contextChange.click());

    expect(host.querySelector('[data-testid="hcm-desktop-task-navigator"]')).toBeNull();
    expect(host.querySelector('[data-testid="old-heading"]')).not.toBeNull();
  });

  it('does not steal focus from content when click-away closes the panel', async () => {
    await act(async () => root.render(<Application navigationChildrenPresentation="panel" />));
    const trigger = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-navigation-item-old"]'
    )!;
    await act(async () => trigger.click());
    const outside = host.querySelector<HTMLButtonElement>('[data-testid="main-route-change"]')!;
    outside.focus();
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));

    await act(async () =>
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    );
    flushAllScheduledFrames();

    expect(host.querySelector('[data-testid="hcm-desktop-task-navigator"]')).toBeNull();
    expect(document.activeElement).toBe(outside);
  });

  it('hands desktop task navigation focus to the committed page heading', async () => {
    await act(async () => root.render(<Application navigationChildrenPresentation="panel" />));
    const trigger = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-navigation-item-old"]'
    )!;
    await act(async () => trigger.click());
    const child = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-desktop-task-navigator"] [data-testid="deferred-mobile-child"]'
    )!;

    await act(async () => child.click());
    expect(host.querySelector('[data-testid="hcm-desktop-task-navigator"]')).toBeNull();
    expect(commitRoute).toBeTypeOf('function');
    await act(async () => commitRoute?.());
    const heading = host.querySelector<HTMLElement>('[data-testid="new-heading"]')!;
    flushScheduledFramesUntil(() => document.activeElement === heading);

    expect(document.activeElement).toBe(heading);
  });

  it('hands an active desktop task back to the current page heading', async () => {
    expectedTargetLocation = '/hr/old';
    await act(async () => root.render(<Application navigationChildrenPresentation="panel" />));
    const trigger = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-navigation-item-old"]'
    )!;
    await act(async () => trigger.click());
    const child = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-desktop-task-navigator"] [data-testid="deferred-mobile-child"]'
    )!;
    const heading = host.querySelector<HTMLElement>('[data-testid="old-heading"]')!;

    await act(async () => child.click());
    flushScheduledFramesUntil(() => document.activeElement === heading);

    expect(commitRoute).toBeUndefined();
    expect(document.activeElement).toBe(heading);
  });

  it('restores focus to the visible workbench trigger after a responsive surface change', async () => {
    await act(async () => root.render(<Application navigationChildrenPresentation="panel" />));
    const trigger = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-navigation-item-old"]'
    )!;
    await act(async () => trigger.click());
    trigger.style.display = 'none';
    const responsiveTrigger = document.createElement('button');
    responsiveTrigger.type = 'button';
    responsiveTrigger.dataset.testid = 'hcm-navigation-item-old';
    responsiveTrigger.dataset.navigationPanelTrigger = 'true';
    responsiveTrigger.textContent = 'Responsive trigger';
    document.body.append(responsiveTrigger);

    try {
      await act(async () =>
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      );
      flushScheduledFramesUntil(() => document.activeElement === responsiveTrigger);

      expect(document.activeElement).toBe(responsiveTrigger);
    } finally {
      responsiveTrigger.remove();
    }
  });

  it('closes the desktop task panel and focuses the mobile menu on breakpoint entry', async () => {
    await act(async () => root.render(<Application navigationChildrenPresentation="panel" />));
    const desktopTrigger = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-navigation-item-old"]'
    )!;
    desktopTrigger.focus();
    await act(async () => desktopTrigger.click());
    expect(host.querySelector('[data-testid="hcm-desktop-task-navigator"]')).not.toBeNull();

    compactSpecializedMobileShell = true;
    await act(async () => root.render(<Application navigationChildrenPresentation="panel" />));

    const mobileTrigger = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-mobile-navigation-trigger"]'
    )!;
    expect(host.querySelector('[data-testid="hcm-desktop-task-navigator"]')).toBeNull();
    expect(document.activeElement).toBe(mobileTrigger);
  });

  it('uses a mobile drill-in view and restores focus to the remounted workbench trigger', async () => {
    await act(async () => root.render(<Application navigationChildrenPresentation="panel" />));
    compactSpecializedMobileShell = true;
    await act(async () => root.render(<Application navigationChildrenPresentation="panel" />));
    const drawerTrigger = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-mobile-navigation-trigger"]'
    )!;
    await act(async () => drawerTrigger.click());

    const drawer = document.querySelector<HTMLElement>('[data-testid="hcm-mobile-sidebar"]')!;
    const workbenchTrigger = drawer.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-navigation-item-old"]'
    )!;
    await act(async () => workbenchTrigger.click());

    const navigator = drawer.querySelector<HTMLElement>(
      '[data-testid="hcm-mobile-task-navigator"]'
    )!;
    expect(navigator).not.toBeNull();
    expect(host.querySelector('[data-testid="hcm-desktop-task-navigator"]')).toBeNull();
    expect(navigator.querySelector('[data-testid="deferred-mobile-child"]')).not.toBeNull();
    const back = [...navigator.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'actions.back'
    )!;
    await act(async () => back.click());

    const remountedTrigger = drawer.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-navigation-item-old"]'
    )!;
    flushScheduledFramesUntil(() => document.activeElement === remountedTrigger);
    expect(drawer.querySelector('[data-testid="hcm-mobile-task-navigator"]')).toBeNull();
    expect(document.activeElement).toBe(remountedTrigger);
  });

  it('waits for the route commit before focusing the replacement heading', async () => {
    const oldHeading = host.querySelector<HTMLElement>('[data-testid="old-heading"]')!;
    const trigger = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-mobile-navigation-trigger"]'
    )!;

    await act(async () => trigger.click());
    const drawer = document.querySelector<HTMLElement>('[data-testid="hcm-mobile-sidebar"]')!;
    const child = drawer.querySelector<HTMLButtonElement>('[data-testid="deferred-mobile-child"]')!;
    child.focus();
    await act(async () => child.click());

    expect(commitRoute).toBeTypeOf('function');
    expect(host.querySelector('[data-testid="old-heading"]')).toBe(oldHeading);
    expect(document.activeElement).not.toBe(oldHeading);
    expect(frames.size).toBe(1);

    await act(async () => commitRoute?.());
    const newHeading = host.querySelector<HTMLElement>('[data-testid="new-heading"]')!;
    expect(oldHeading.isConnected).toBe(false);
    expect(newHeading).toBeTruthy();
    expect(frames.size).toBe(1);

    flushScheduledFramesUntil(() => document.activeElement === newHeading);

    expect(newHeading.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(newHeading);
  });

  it('focuses the current heading after closing a same-location child', async () => {
    expectedTargetLocation = '/hr/old';
    const heading = host.querySelector<HTMLElement>('[data-testid="old-heading"]')!;
    const trigger = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-mobile-navigation-trigger"]'
    )!;

    await act(async () => trigger.click());
    const child = document.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-mobile-sidebar"] [data-testid="deferred-mobile-child"]'
    )!;
    child.focus();
    await act(async () => child.click());
    flushScheduledFramesUntil(() => document.activeElement === heading);

    expect(commitRoute).toBeUndefined();
    expect(heading.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(heading);
  });

  it('expires a pending handoff when the expected route never commits', async () => {
    const trigger = host.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-mobile-navigation-trigger"]'
    )!;

    await act(async () => trigger.click());
    const child = document.querySelector<HTMLButtonElement>(
      '[data-testid="hcm-mobile-sidebar"] [data-testid="deferred-mobile-child"]'
    )!;
    await act(async () => child.click());

    flushAllScheduledFrames();
    expect(frames.size).toBe(0);

    await act(async () => commitRoute?.());
    const newHeading = host.querySelector<HTMLElement>('[data-testid="new-heading"]')!;
    expect(newHeading).toBeTruthy();
    expect(newHeading.tabIndex).toBe(-1);
    expect(document.activeElement).not.toBe(newHeading);
    expect(frames.size).toBe(0);
  });
});

function flushScheduledFramesUntil(done: () => boolean) {
  for (let attempt = 0; attempt < 5 && !done(); attempt += 1) {
    const scheduled = [...frames.values()];
    frames.clear();
    scheduled.forEach((callback) => callback(0));
  }
}

function flushAllScheduledFrames() {
  for (let attempt = 0; attempt < 125 && frames.size; attempt += 1) {
    const scheduled = [...frames.values()];
    frames.clear();
    scheduled.forEach((callback) => callback(0));
  }
}
