// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BriefcaseBusiness } from 'lucide-react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@mui/material/useMediaQuery', () => ({ default: () => false }));

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
  return <h1 data-testid="old-heading">Old route</h1>;
}

function NewRoute() {
  return <h1 data-testid="new-heading">New route</h1>;
}

function Application() {
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
              navigationChildrenPresentation="inline"
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

describe('ProductAreaLayout mobile child focus handoff', () => {
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
