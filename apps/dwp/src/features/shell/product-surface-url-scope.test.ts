// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resolveProductSurfaceUrlScope,
  useProductSurfaceUrlScope,
} from './product-surface-url-scope';

import type { EffectiveProductSurfaceContextEnvelope } from './product-surface-context';
import type { ProductSurfaceIdentity } from './product-surface-url-scope';

const scopeMocks = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: scopeMocks.useAuth,
}));

const NOW_MS = Date.parse('2029-01-01T00:00:00.000Z');
const REVALIDATE_AT = '2030-01-01T00:00:00.000Z';
const EXPIRED_AT = '2028-01-01T00:00:00.000Z';
const workSurface = { productId: 'approvals', surfaceId: 'approvals.work' } as const;

function envelope(
  owner = 'actor-a',
  activeAccessMode: EffectiveProductSurfaceContextEnvelope['activeAccessMode'] = 'NORMAL',
  surfaceKey = 'approvals.work'
): EffectiveProductSurfaceContextEnvelope {
  const management = surfaceKey.includes('admin');
  return {
    contractVersion: '2',
    decisionRevision: `revision-${owner}`,
    sourceRevisions: {},
    activeAccessMode,
    generatedAt: '2029-01-01T00:00:00.000Z',
    contexts: [
      {
        contextKey: `${surfaceKey}-${owner}-${activeAccessMode.toLowerCase()}`,
        productKey: 'approvals',
        surfaceKey,
        plane: management ? 'management' : 'work',
        accessMode: activeAccessMode,
        accessSource: management ? 'MANAGEMENT' : 'ENTITLEMENT',
        appResourceKey: 'APP.APPROVALS',
        effectiveGrants: [],
        scopes: [
          {
            key: `scope-${owner}-current`,
            kind: 'RESOURCE_SET',
            displayName: 'Current',
            isDefault: true,
            readOnly: false,
          },
          {
            key: `scope-${owner}-secondary`,
            kind: 'RESOURCE_SET',
            displayName: 'Secondary',
            isDefault: false,
            readOnly: false,
          },
          {
            key: `scope-${owner}-expired`,
            kind: 'RESOURCE_SET',
            displayName: 'Expired',
            isDefault: false,
            readOnly: false,
            validUntil: EXPIRED_AT,
          },
        ],
        revalidateAt: REVALIDATE_AT,
      },
    ],
  };
}

function identity(actorId: string, identityPlane = 'TENANT'): ProductSurfaceIdentity {
  return { identityPlane, tenantId: '1', actorId };
}

describe('product Surface URL scope reconciliation', () => {
  it('keeps ordinary explicit scopes opaque so invalid deep links remain fail-closed', () => {
    expect(
      resolveProductSurfaceUrlScope({
        search: '?scope=opaque-invalid&queue=urgent',
        activeProductId: 'approvals',
        activeSurface: workSurface,
        envelope: envelope('actor-b'),
        nowMs: NOW_MS,
      })
    ).toEqual({ requestedScope: 'opaque-invalid' });
  });

  it('waits for the current authority snapshot before handling a captured selector', () => {
    expect(
      resolveProductSurfaceUrlScope({
        search: '?scope=scope-actor-a-current',
        activeProductId: 'approvals',
        activeSurface: workSurface,
        transitionScope: 'scope-actor-a-current',
      })
    ).toEqual({ requestedScope: 'scope-actor-a-current' });
  });

  it('preserves a captured selector that is valid for the new identity', () => {
    expect(
      resolveProductSurfaceUrlScope({
        search: '?scope=scope-actor-b-secondary&queue=urgent',
        activeProductId: 'approvals',
        activeSurface: workSurface,
        envelope: envelope('actor-b'),
        nowMs: NOW_MS,
        transitionScope: 'scope-actor-b-secondary',
      })
    ).toEqual({ requestedScope: 'scope-actor-b-secondary', transitionHandled: true });
  });

  it.each([
    ['previous actor', 'scope-actor-a-current', envelope('actor-b')],
    ['expired', 'scope-actor-b-expired', envelope('actor-b')],
    ['undisclosed context', 'scope-actor-a-current', { ...envelope('actor-b'), contexts: [] }],
    [
      'unselectable context',
      'scope-actor-a-current',
      {
        ...envelope('actor-b'),
        contexts: envelope('actor-b').contexts.map((context) => ({ ...context, scopes: [] })),
      },
    ],
  ])('removes only the captured %s selector and preserves other query state', (_, scope, next) => {
    const resolved = resolveProductSurfaceUrlScope({
      search: `?scope=${scope}&queue=urgent&view=compact`,
      activeProductId: 'approvals',
      activeSurface: workSurface,
      envelope: next,
      nowMs: NOW_MS,
      transitionScope: scope,
    });

    expect(resolved.requestedScope).toBeUndefined();
    expect(resolved.transitionHandled).toBe(true);
    const replacement = new URLSearchParams(resolved.replacementSearch);
    expect(replacement.has('scope')).toBe(false);
    expect(replacement.get('queue')).toBe('urgent');
    expect(replacement.get('view')).toBe('compact');
  });

  it.each([
    ['duplicate', '?scope=scope-old&scope=scope-other&queue=urgent'],
    ['blank', '?scope=&queue=urgent'],
    ['different', '?scope=crafted-later&queue=urgent'],
  ])('preserves a %s selector that does not exactly match transition provenance', (_, search) => {
    const resolved = resolveProductSurfaceUrlScope({
      search,
      activeProductId: 'approvals',
      activeSurface: workSurface,
      envelope: envelope('actor-b'),
      nowMs: NOW_MS,
      transitionScope: 'scope-old',
    });

    expect(resolved.replacementSearch).toBeUndefined();
    expect(resolved.transitionHandled).toBe(true);
    expect(resolved.requestedScope).toBe(new URLSearchParams(search).get('scope') ?? undefined);
  });

  it('validates management selectors against the active elevated access mode', () => {
    const adminSurface = { productId: 'approvals', surfaceId: 'approvals.admin' } as const;
    const elevated = envelope('admin', 'ELEVATED', adminSurface.surfaceId);

    expect(
      resolveProductSurfaceUrlScope({
        search: '?scope=scope-admin-current',
        activeProductId: 'approvals',
        activeSurface: adminSurface,
        envelope: elevated,
        nowMs: NOW_MS,
        transitionScope: 'scope-admin-current',
      })
    ).toEqual({ requestedScope: 'scope-admin-current', transitionHandled: true });
  });

  it('removes transition provenance at a product root before surface selection', () => {
    const resolved = resolveProductSurfaceUrlScope({
      search: '?scope=scope-admin-current&queue=urgent',
      activeProductId: 'approvals',
      envelope: envelope('admin', 'ELEVATED', 'approvals.admin'),
      nowMs: NOW_MS,
      transitionScope: 'scope-admin-current',
    });

    expect(resolved).toEqual({ replacementSearch: 'queue=urgent', transitionHandled: true });
  });
});

type ProbeProps = Readonly<{
  identity?: ProductSurfaceIdentity;
  identityLoading: boolean;
  envelope?: EffectiveProductSurfaceContextEnvelope;
}>;

describe('useProductSurfaceUrlScope identity boundary', () => {
  let root: Root | null;
  let container: HTMLDivElement | null;
  let navigateProbe: ReturnType<typeof useNavigate> | undefined;

  function Probe(props: ProbeProps) {
    const location = useLocation();
    navigateProbe = useNavigate();
    scopeMocks.useAuth.mockReturnValue({
      isLoading: props.identityLoading,
      isAuthenticated: Boolean(props.identity),
      user: props.identity
        ? {
            identityPlane: props.identity.identityPlane,
            tenantId: props.identity.tenantId,
            userId: props.identity.actorId,
          }
        : null,
    });
    const scope = useProductSurfaceUrlScope({
      activeProductId: location.pathname.startsWith('/approvals') ? 'approvals' : undefined,
      activeSurface: location.pathname.startsWith('/approvals/') ? workSurface : undefined,
      envelope: props.envelope,
      nowMs: NOW_MS,
    });
    return createElement('output', null, JSON.stringify({ scope, ...location }));
  }

  async function renderProbe(props: ProbeProps, initialEntry: string) {
    await act(async () => {
      root?.render(
        createElement(
          StrictMode,
          null,
          createElement(
            MemoryRouter,
            { initialEntries: [initialEntry] },
            createElement(Probe, props)
          )
        )
      );
    });
  }

  function output() {
    return JSON.parse(container?.textContent ?? '{}') as {
      scope?: string;
      pathname?: string;
      search?: string;
      hash?: string;
      state?: unknown;
    };
  }

  function createTestRoot() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }

  async function destroyTestRoot() {
    if (root) await act(async () => root?.unmount());
    root = null;
    container?.remove();
    container = null;
  }

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.sessionStorage.clear();
    root = null;
    container = null;
    navigateProbe = undefined;
    createTestRoot();
  });

  afterEach(async () => {
    await destroyTestRoot();
    window.sessionStorage.clear();
  });

  it('treats the first verified identity as a baseline under StrictMode', async () => {
    const entry = '/approvals/home?scope=opaque-initial&queue=urgent#focus';
    await renderProbe({ identityLoading: true }, entry);
    await renderProbe(
      {
        identity: identity('actor-a'),
        identityLoading: false,
        envelope: envelope('actor-a'),
      },
      entry
    );

    expect(output()).toMatchObject({
      scope: 'opaque-initial',
      pathname: '/approvals/home',
      search: '?scope=opaque-initial&queue=urgent',
      hash: '#focus',
    });
  });

  it('keeps logout scope provenance through sign-in and removes it for the next actor', async () => {
    const entry = '/approvals/home?scope=scope-actor-a-current&queue=urgent';
    await renderProbe(
      {
        identity: identity('actor-a'),
        identityLoading: false,
        envelope: envelope('actor-a'),
      },
      entry
    );
    await renderProbe({ identityLoading: false }, entry);
    await act(async () =>
      navigateProbe?.(
        `/sign-in?returnUrl=${encodeURIComponent('/approvals/home?scope=scope-actor-a-current&queue=urgent')}`
      )
    );
    await renderProbe(
      {
        identity: identity('actor-b'),
        identityLoading: false,
        envelope: envelope('actor-b'),
      },
      entry
    );
    await act(async () =>
      navigateProbe?.('/approvals/home?scope=scope-actor-a-current&queue=urgent#focus', {
        state: { from: '/sign-in' },
      })
    );

    await vi.waitFor(() => expect(new URLSearchParams(output().search).has('scope')).toBe(false));
    expect(output()).toMatchObject({
      pathname: '/approvals/home',
      search: '?queue=urgent',
      hash: '#focus',
      state: { from: '/sign-in' },
    });
    expect(output().scope).toBeUndefined();
  });

  it('survives an App remount by restoring the last verified identity marker', async () => {
    const entry = '/approvals/home?scope=scope-actor-a-current&queue=urgent';
    await renderProbe(
      {
        identity: identity('actor-a'),
        identityLoading: false,
        envelope: envelope('actor-a'),
      },
      entry
    );
    await destroyTestRoot();
    createTestRoot();
    await renderProbe(
      {
        identity: identity('actor-b'),
        identityLoading: false,
        envelope: envelope('actor-b'),
      },
      entry
    );

    await vi.waitFor(() => expect(new URLSearchParams(output().search).has('scope')).toBe(false));
    expect(output().scope).toBeUndefined();
    expect(new URLSearchParams(output().search).get('queue')).toBe('urgent');
  });

  it('clears captured scope at a product root before its surface resolver runs', async () => {
    const entry = '/approvals?scope=scope-actor-a-current&queue=urgent';
    await renderProbe(
      {
        identity: identity('actor-a'),
        identityLoading: false,
        envelope: envelope('actor-a'),
      },
      entry
    );
    await renderProbe(
      {
        identity: identity('actor-b'),
        identityLoading: false,
        envelope: envelope('actor-b'),
      },
      entry
    );

    await vi.waitFor(() => expect(new URLSearchParams(output().search).has('scope')).toBe(false));
    expect(output()).toMatchObject({ pathname: '/approvals', search: '?queue=urgent' });
  });

  it('consumes provenance on the first authenticated non-product route', async () => {
    const entry = '/approvals/home?scope=scope-actor-a-current';
    await renderProbe(
      {
        identity: identity('actor-a'),
        identityLoading: false,
        envelope: envelope('actor-a'),
      },
      entry
    );
    await renderProbe({ identityLoading: false }, entry);
    await act(async () => navigateProbe?.('/sign-in'));
    await renderProbe(
      {
        identity: identity('actor-b'),
        identityLoading: false,
        envelope: envelope('actor-b'),
      },
      entry
    );
    await act(async () => navigateProbe?.('/apps'));
    await act(async () =>
      navigateProbe?.('/approvals/home?scope=scope-actor-a-current&queue=urgent')
    );

    expect(output().scope).toBe('scope-actor-a-current');
    expect(output().search).toBe('?scope=scope-actor-a-current&queue=urgent');
  });

  it('does not create sanitization authority from a duplicate selector', async () => {
    const entry = '/approvals/home?scope=scope-old&scope=scope-other&queue=urgent';
    await renderProbe(
      {
        identity: identity('actor-a'),
        identityLoading: false,
        envelope: envelope('actor-a'),
      },
      entry
    );
    await renderProbe(
      {
        identity: identity('actor-b', 'PROVIDER'),
        identityLoading: false,
        envelope: envelope('actor-b'),
      },
      entry
    );

    expect(output().scope).toBe('scope-old');
    expect(output().search).toBe('?scope=scope-old&scope=scope-other&queue=urgent');
  });
});
