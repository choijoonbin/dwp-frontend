// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HRIS_INTEGRATION_CONTROL_PLANE_DEFAULT_ADMISSIONS,
  HRIS_INTEGRATION_CONTROL_PLANE_DWP_ROUTE,
  HRIS_INTEGRATION_CONTROL_PLANE_DWP_ROUTE_CONTRACT,
  HRIS_INTEGRATION_CONTROL_PLANE_FEATURE,
  HRIS_INTEGRATION_CONTROL_PLANE_OPERATION_CONTRACTS,
  HRIS_INTEGRATION_CONTROL_PLANE_OWNER_QUERY_CONTRACT,
  HRIS_INTEGRATION_CONTROL_PLANE_PRIMARY_ROUTE,
  HRIS_INTEGRATION_CONTROL_PLANE_PRIMARY_ROUTE_CONTRACT,
  HRIS_INTEGRATION_CONTROL_PLANE_PROJECTIONS,
  HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT,
  HRIS_INTEGRATION_CONTROL_PLANE_STATES,
  HRIS_INTEGRATION_CONTROL_PLANE_SURFACE_POLICY,
  HrisIntegrationControlPlaneProjectionSurface,
  HrisIntegrationControlPlaneStatePanel,
  isHrisIntegrationControlPlaneProjectionMounted,
} from '.';

import type { HrisIntegrationControlPlaneProjection } from '.';

const PROJECTIONS = ['PRIMARY_HRIS_SETTINGS', 'PRIMARY_DWP_CONTROL'] as const;
const SUCCESSOR = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      'docs/06-delivery/hris/wave7-2026-10-17/r7-batch-05-module-start-r1/sys-008-iaq-transport-event-and-central-authorization-successor.v1.json'
    ),
    'utf8'
  )
) as {
  transportAndAuthorizationContract: {
    operationBindings: readonly Record<string, unknown>[];
  };
  iaq057AndIaq062Successor: {
    projections: readonly Record<string, unknown>[];
  };
};

describe('SYS-008 unmounted integration projections', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('pins one owner truth to two policy projections without re-owning the DWP page', () => {
    expect(HRIS_INTEGRATION_CONTROL_PLANE_PRIMARY_ROUTE).toBe('/hr/settings/integrations');
    expect(HRIS_INTEGRATION_CONTROL_PLANE_DWP_ROUTE).toBe(
      '/admin/integrations/productivity?product=HCM'
    );
    expect(HRIS_INTEGRATION_CONTROL_PLANE_SURFACE_POLICY).toEqual({
      owner: 'SYS-008',
      ownerQuery: 'SYS008_SINGLE_OWNER_QUERY',
      requiredFeature: HRIS_INTEGRATION_CONTROL_PLANE_FEATURE,
      oneOwnerTruth: true,
      projectionCount: 2,
      newPageRouteCount: 1,
      newSidebarNode: false,
      duplicatePageOwner: false,
      dwpProductivityPageOwnerChanged: false,
      mounted: false,
      defaultEnabled: false,
      tenantEnrollmentCount: 0,
    });
    expect(HRIS_INTEGRATION_CONTROL_PLANE_PROJECTIONS.PRIMARY_HRIS_SETTINGS).toMatchObject({
      entryQuery: 'IAQ-057',
      role: 'PRIMARY_HRIS_SETTINGS',
      routeKind: 'PAGE',
      routeContractKey: HRIS_INTEGRATION_CONTROL_PLANE_PRIMARY_ROUTE_CONTRACT,
      ownsPage: true,
    });
    expect(HRIS_INTEGRATION_CONTROL_PLANE_PROJECTIONS.PRIMARY_DWP_CONTROL).toMatchObject({
      entryQuery: 'IAQ-062',
      role: 'PRIMARY_DWP_CONTROL',
      routeKind: 'DATA',
      routeContractKey: HRIS_INTEGRATION_CONTROL_PLANE_DWP_ROUTE_CONTRACT,
      ownsPage: false,
    });
    expect(HRIS_INTEGRATION_CONTROL_PLANE_OWNER_QUERY_CONTRACT).toMatchObject({
      owner: 'SYS008_SINGLE_OWNER_QUERY',
      sortCountPerProjection: 8,
      defaultSort: 'itemPublicId:ASC',
      minimumLimit: 1,
      maximumLimit: 100,
      stalePartialUnavailableOrDeniedActionCount: 0,
    });
  });

  it('seals all 20 operation bindings as one page, three data and sixteen actions', () => {
    expect(HRIS_INTEGRATION_CONTROL_PLANE_OPERATION_CONTRACTS).toHaveLength(20);
    expect(
      HRIS_INTEGRATION_CONTROL_PLANE_OPERATION_CONTRACTS.filter(
        ({ routeKind }) => routeKind === 'PAGE'
      )
    ).toHaveLength(1);
    expect(
      HRIS_INTEGRATION_CONTROL_PLANE_OPERATION_CONTRACTS.filter(
        ({ routeKind }) => routeKind === 'DATA'
      )
    ).toHaveLength(3);
    expect(
      HRIS_INTEGRATION_CONTROL_PLANE_OPERATION_CONTRACTS.filter(
        ({ routeKind }) => routeKind === 'ACTION'
      )
    ).toHaveLength(16);
    expect(
      new Set(
        HRIS_INTEGRATION_CONTROL_PLANE_OPERATION_CONTRACTS.map(
          ({ routeContractKey }) => routeContractKey
        )
      ).size
    ).toBe(20);
    expect(
      HRIS_INTEGRATION_CONTROL_PLANE_OPERATION_CONTRACTS.filter(({ api }) => api.startsWith('IAQ-'))
    ).toHaveLength(2);
  });

  it('matches every sealed operation and projection field in the reviewed successor', () => {
    const operationKeys = [
      'api',
      'pep',
      'method',
      'browserPath',
      'servicePath',
      'routeContractKey',
      'routeKind',
      'capability',
    ] as const;
    const expectedOperations = SUCCESSOR.transportAndAuthorizationContract.operationBindings.map(
      (binding) => Object.fromEntries(operationKeys.map((key) => [key, binding[key]]))
    );
    expect(HRIS_INTEGRATION_CONTROL_PLANE_OPERATION_CONTRACTS).toEqual(expectedOperations);

    const projectionKeys = [
      'entryQuery',
      'iaNodeId',
      'role',
      'method',
      'browserApi',
      'serviceApi',
      'canonicalRoute',
      'routeContractKey',
      'routeKind',
      'fieldGroups',
      'filters',
    ] as const;
    const expectedProjections = SUCCESSOR.iaq057AndIaq062Successor.projections.map((projection) =>
      Object.fromEntries(projectionKeys.map((key) => [key, projection[key]]))
    );
    const actualProjections = Object.values(HRIS_INTEGRATION_CONTROL_PLANE_PROJECTIONS).map(
      (projection) => Object.fromEntries(projectionKeys.map((key) => [key, projection[key]]))
    );
    expect(actualProjections).toEqual(expectedProjections);
  });

  it.each(PROJECTIONS)(
    'keeps the %s projection unmounted despite fabricated browser admission',
    (projection) => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const routeContractKey =
        HRIS_INTEGRATION_CONTROL_PLANE_PROJECTIONS[projection].routeContractKey;
      const admission = {
        kind: 'TRUSTED_SYS008_PROJECTION_ADMISSION' as const,
        feature: HRIS_INTEGRATION_CONTROL_PLANE_FEATURE,
        projection,
        routeContractKey,
        routeAllowed: true,
        featureEnabled: true,
        tenantEnrolled: true,
      };
      act(() =>
        root.render(
          <HrisIntegrationControlPlaneProjectionSurface
            projection={projection}
            admission={admission}
          >
            <div>must remain hidden</div>
          </HrisIntegrationControlPlaneProjectionSurface>
        )
      );

      expect(host.childElementCount).toBe(0);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(isHrisIntegrationControlPlaneProjectionMounted(admission)).toBe(false);
      expect(
        isHrisIntegrationControlPlaneProjectionMounted(
          HRIS_INTEGRATION_CONTROL_PLANE_DEFAULT_ADMISSIONS[projection]
        )
      ).toBe(false);
    }
  );

  it('fails closed when an admission is replayed across projections', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    act(() =>
      root.render(
        <HrisIntegrationControlPlaneProjectionSurface
          projection="PRIMARY_DWP_CONTROL"
          admission={HRIS_INTEGRATION_CONTROL_PLANE_DEFAULT_ADMISSIONS.PRIMARY_HRIS_SETTINGS}
        >
          <div>must remain hidden</div>
        </HrisIntegrationControlPlaneProjectionSurface>
      )
    );
    expect(host.childElementCount).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(
    PROJECTIONS.flatMap((projection) =>
      HRIS_INTEGRATION_CONTROL_PLANE_STATES.map((state) => [projection, state] as const)
    )
  )('exposes an accessible, request-free %s %s state', (projection, state) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    act(() => root.render(<HrisIntegrationControlPlaneStatePanel {...{ projection, state }} />));

    const region = host.querySelector('[data-testid="hris-integration-control-plane-state"]');
    expect(region).not.toBeNull();
    expect(region?.tagName).toBe('SECTION');
    expect(region?.getAttribute('data-state')).toBe(state);
    expect(region?.getAttribute('data-projection')).toBe(projection);
    expect(region?.getAttribute('data-required-feature')).toBe(
      HRIS_INTEGRATION_CONTROL_PLANE_FEATURE
    );
    const labelledBy = region?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy ?? '')?.textContent).toBeTruthy();
    expect(host.querySelector('main')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('provides named retry and step-up controls without assuming authorization', () => {
    const retry = vi.fn();
    const stepUp = vi.fn();
    act(() =>
      root.render(
        <HrisIntegrationControlPlaneStatePanel
          projection="PRIMARY_HRIS_SETTINGS"
          state="retry"
          onRetry={retry}
        />
      )
    );
    const retryButton = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Retry'
    );
    expect(retryButton).toBeDefined();
    act(() => retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(retry).toHaveBeenCalledTimes(1);

    act(() =>
      root.render(
        <HrisIntegrationControlPlaneStatePanel
          projection="PRIMARY_HRIS_SETTINGS"
          state="step-up"
          onStepUp={stepUp}
        />
      )
    );
    const stepUpButton = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Verify session'
    );
    expect(stepUpButton).toBeDefined();
    act(() => stepUpButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(stepUp).toHaveBeenCalledTimes(1);
  });

  it('pins responsive, zoom and landmark constraints without fixed child widths', () => {
    expect(HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT).toEqual({
      viewportWidths: [1440, 1280, 390, 320],
      zoomPercent: 200,
      inlineSize: '100%',
      minimumChildInlineSize: 0,
      contentColumns: {
        narrow: 'minmax(0, 1fr)',
        wide: 'minmax(0, 1fr) auto',
      },
      textOverflow: 'anywhere',
      nestedMainLandmark: false,
    });
  });

  it.each(HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.viewportWidths)(
    'renders both projections at %ipx and 200%% zoom without overflow contracts',
    (viewportWidth) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: viewportWidth });
      host.style.inlineSize = `${viewportWidth}px`;
      host.style.setProperty(
        'zoom',
        String(HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.zoomPercent / 100)
      );
      window.dispatchEvent(new Event('resize'));

      for (const projection of PROJECTIONS) {
        for (const state of HRIS_INTEGRATION_CONTROL_PLANE_STATES) {
          act(() =>
            root.render(<HrisIntegrationControlPlaneStatePanel {...{ projection, state }} />)
          );
          const region = host.querySelector<HTMLElement>(
            '[data-testid="hris-integration-control-plane-state"]'
          );
          expect(region).not.toBeNull();
          expect(region?.style.width).not.toMatch(/px$/);
          expect(region?.style.minWidth).not.toMatch(/[1-9][0-9]*px$/);
          expect(host.querySelector('main')).toBeNull();
        }
      }

      expect(host.style.inlineSize).toBe(`${viewportWidth}px`);
      expect(host.style.getPropertyValue('zoom')).toBe('2');
    }
  );
});

const assertProjectionType = (
  projection: HrisIntegrationControlPlaneProjection
): HrisIntegrationControlPlaneProjection => projection;
void assertProjectionType('PRIMARY_HRIS_SETTINGS');
