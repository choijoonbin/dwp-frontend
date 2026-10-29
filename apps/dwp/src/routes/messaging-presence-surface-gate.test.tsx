// @vitest-environment jsdom

import { act, isValidElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Outlet, type RouteObject } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  authority: {
    authorityPending: false,
    flags: {},
  } as { authorityPending?: boolean; flags: Record<string, unknown> },
  decision: { state: 'route-denied' } as { state: string },
  mode: 'surface-ui',
  useMessagingPresenceHeartbeat: vi.fn(),
}));

vi.mock('../features/shell/product-surface-canary-runtime', () => ({
  isProductSurfaceEnforced: (mode: string) => mode === 'surface-ui',
  resolveCanaryProductFlags: (authority: { flags: Record<string, unknown> }) => authority.flags,
  resolveCanaryRouteDecision: () => mocks.decision,
  resolveCanarySurfaceDecision: () => mocks.decision,
  resolveProductSurfaceRolloutMode: () => mocks.mode,
  useProductSurfaceCanaryAuthority: () => mocks.authority,
}));

vi.mock('./product-surface-guard', () => ({
  ProductSurfaceGuard: ({
    decision,
    children,
  }: {
    decision: { state: string };
    children: ReactNode;
  }) => (decision.state === 'allowed' ? children : null),
}));

vi.mock('./product-canary-access-state', () => ({
  ProductCanaryAccessState: () => <div>access blocked</div>,
}));

vi.mock('../components/product-surface-loading-shell', () => ({
  ProductSurfaceLoadingShell: () => <div>surface pending</div>,
}));

vi.mock('@dwp-frontend/shared-utils', () => ({
  isAppReadEntitled: () => true,
  useAuth: () => ({ user: { tenantId: 7, userId: 42 } }),
  usePermissions: () => ({ permissions: [], isLoaded: true }),
}));

vi.mock('../features/messaging/use-messaging-presence-heartbeat', () => ({
  useMessagingPresenceHeartbeat: mocks.useMessagingPresenceHeartbeat,
}));

import { MessagingPresenceRouteRuntime } from '../features/messaging/messaging-presence-route-runtime';
import { messagingRoutes } from './messaging-routes';
import {
  ProductCanaryRouteBoundary,
  ProductCanarySurfaceBoundary,
} from './product-surface-canary-routes';

type ElementProps = {
  children?: ReactNode;
};

function childElement(node: ReactNode): ReactNode {
  return isValidElement<ElementProps>(node) ? node.props.children : null;
}

function routeByHandle(
  routes: readonly RouteObject[],
  key: 'surfaceId' | 'routeContractKey',
  value: string
): RouteObject | undefined {
  for (const route of routes) {
    if ((route.handle as Record<string, unknown> | undefined)?.[key] === value) return route;
    const nested = routeByHandle(route.children ?? [], key, value);
    if (nested) return nested;
  }
  return undefined;
}

describe('Messaging presence ProductSurface gate', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    mocks.authority = { authorityPending: false, flags: {} };
    mocks.decision = { state: 'route-denied' };
    mocks.mode = 'surface-ui';
    mocks.useMessagingPresenceHeartbeat.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  async function renderBoundary() {
    await act(async () => {
      root.render(
        <ProductCanarySurfaceBoundary
          productId="messaging"
          surfaceId="messaging.work"
          legacy={<div>legacy</div>}
        >
          <MessagingPresenceRouteRuntime>
            <div>messaging work</div>
          </MessagingPresenceRouteRuntime>
        </ProductCanarySurfaceBoundary>
      );
      await Promise.resolve();
    });
  }

  it('publishes only after the server Surface decision is allowed', async () => {
    mocks.decision = { state: 'allowed' };

    await renderBoundary();

    expect(mocks.useMessagingPresenceHeartbeat).toHaveBeenCalledWith(true, {
      tenantId: 7,
      userId: 42,
    });
    expect(host.textContent).toContain('messaging work');
  });

  it.each([
    {
      name: 'pending',
      setup: () => {
        mocks.authority = { authorityPending: true, flags: {} };
      },
    },
    {
      name: 'authority unavailable',
      setup: () => {
        mocks.mode = 'invalid';
      },
    },
    {
      name: 'denied',
      setup: () => {
        mocks.decision = { state: 'route-denied' };
      },
    },
  ])('does not publish while the Surface is $name', async ({ setup }) => {
    setup();

    await renderBoundary();

    expect(mocks.useMessagingPresenceHeartbeat).not.toHaveBeenCalled();
  });

  it('nests the publisher below the governed Work boundaries, never at the product root', () => {
    const rootRoute = messagingRoutes[0];
    const workspaceGuard = childElement(rootRoute?.element);
    expect(childElement(workspaceGuard)).toMatchObject({ type: Outlet });

    const workSurface = routeByHandle(rootRoute?.children ?? [], 'surfaceId', 'messaging.work');
    expect(isValidElement(workSurface?.element)).toBe(true);
    if (isValidElement(workSurface?.element)) {
      expect(workSurface.element.type).toBe(ProductCanarySurfaceBoundary);
    }

    const workPage = routeByHandle(
      rootRoute?.children ?? [],
      'routeContractKey',
      'route.messaging.work.home.page'
    );
    expect(isValidElement<ElementProps>(workPage?.element)).toBe(true);
    if (isValidElement<ElementProps>(workPage?.element)) {
      expect(workPage.element.type).toBe(ProductCanaryRouteBoundary);
      expect(isValidElement(workPage.element.props.children)).toBe(true);
      if (isValidElement(workPage.element.props.children)) {
        expect(workPage.element.props.children.type).toBe(MessagingPresenceRouteRuntime);
      }
    }

    const managementPage = routeByHandle(
      rootRoute?.children ?? [],
      'routeContractKey',
      'route.messaging.management.overview.page'
    );
    expect(isValidElement<ElementProps>(managementPage?.element)).toBe(true);
    if (isValidElement<ElementProps>(managementPage?.element)) {
      expect(managementPage.element.type).toBe(ProductCanaryRouteBoundary);
      expect(isValidElement(managementPage.element.props.children)).toBe(true);
      if (isValidElement(managementPage.element.props.children)) {
        expect(managementPage.element.props.children.type).not.toBe(MessagingPresenceRouteRuntime);
      }
    }
  });
});
