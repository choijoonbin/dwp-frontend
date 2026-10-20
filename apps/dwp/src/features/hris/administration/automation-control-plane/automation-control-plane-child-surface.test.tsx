// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HRIS_AUTOMATION_CONTROL_PLANE_BASE_PAGE_ROUTE_CONTRACT,
  HRIS_AUTOMATION_CONTROL_PLANE_DEFAULT_ADMISSION,
  HRIS_AUTOMATION_CONTROL_PLANE_FEATURE,
  HRIS_AUTOMATION_CONTROL_PLANE_OPERATION_CONTRACTS,
  HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT,
  HRIS_AUTOMATION_CONTROL_PLANE_SHARED_ROUTE,
  HRIS_AUTOMATION_CONTROL_PLANE_STATES,
  HRIS_AUTOMATION_CONTROL_PLANE_SURFACE_POLICY,
  HrisAutomationControlPlaneChildSurface,
  HrisAutomationControlPlaneStatePanel,
  isHrisAutomationControlPlaneChildMounted,
} from '.';

describe('SYS-006 unmounted automation child surface', () => {
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

  it('pins the separately authorized child to the existing SYS-002 page without a new owner', () => {
    expect(HRIS_AUTOMATION_CONTROL_PLANE_SHARED_ROUTE).toBe('/hr/settings/operations');
    expect(HRIS_AUTOMATION_CONTROL_PLANE_BASE_PAGE_ROUTE_CONTRACT).toBe(
      'route.hcm.configuration.settings-operations.page'
    );
    expect(HRIS_AUTOMATION_CONTROL_PLANE_SURFACE_POLICY).toEqual({
      parentOwner: 'SYS-002',
      sharedRoute: '/hr/settings/operations',
      requiredFeature: HRIS_AUTOMATION_CONTROL_PLANE_FEATURE,
      requiredBasePageDecision: 'route.hcm.configuration.settings-operations.page',
      secondSidebarNode: false,
      secondPageOwner: false,
      mounted: false,
      defaultEnabled: false,
      tenantEnrollmentCount: 0,
    });
    expect(HRIS_AUTOMATION_CONTROL_PLANE_OPERATION_CONTRACTS).toHaveLength(16);
    expect(
      HRIS_AUTOMATION_CONTROL_PLANE_OPERATION_CONTRACTS.filter(
        ({ routeKind }) => routeKind === 'DATA'
      )
    ).toHaveLength(2);
    expect(
      HRIS_AUTOMATION_CONTROL_PLANE_OPERATION_CONTRACTS.filter(
        ({ routeKind }) => routeKind === 'ACTION'
      )
    ).toHaveLength(14);
    expect(
      new Set(
        HRIS_AUTOMATION_CONTROL_PLANE_OPERATION_CONTRACTS.map(
          ({ routeContractKey }) => routeContractKey
        )
      ).size
    ).toBe(16);
    expect(HRIS_AUTOMATION_CONTROL_PLANE_OPERATION_CONTRACTS).not.toContainEqual(
      expect.objectContaining({ routeKind: 'PAGE' })
    );
  });

  it('stays unmounted even when browser-provided booleans claim full admission', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    act(() =>
      root.render(
        <HrisAutomationControlPlaneChildSurface
          admission={{
            kind: 'TRUSTED_SYS006_CHILD_ADMISSION',
            feature: HRIS_AUTOMATION_CONTROL_PLANE_FEATURE,
            basePageRouteContractKey: HRIS_AUTOMATION_CONTROL_PLANE_BASE_PAGE_ROUTE_CONTRACT,
            basePageAllowed: true,
            featureEnabled: true,
            tenantEnrolled: true,
          }}
        >
          <div>must remain hidden</div>
        </HrisAutomationControlPlaneChildSurface>
      )
    );

    expect(host.childElementCount).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(
      isHrisAutomationControlPlaneChildMounted(HRIS_AUTOMATION_CONTROL_PLANE_DEFAULT_ADMISSION)
    ).toBe(false);
  });

  it.each(HRIS_AUTOMATION_CONTROL_PLANE_STATES)(
    'exposes an accessible, request-free %s presentation state',
    (state) => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      act(() => root.render(<HrisAutomationControlPlaneStatePanel state={state} />));

      const region = host.querySelector('[data-testid="hris-automation-control-plane-state"]');
      expect(region).not.toBeNull();
      expect(region?.getAttribute('data-state')).toBe(state);
      expect(region?.getAttribute('data-required-feature')).toBe(
        HRIS_AUTOMATION_CONTROL_PLANE_FEATURE
      );
      const labelledBy = region?.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(document.getElementById(labelledBy ?? '')?.textContent).toBeTruthy();
      expect(fetchSpy).not.toHaveBeenCalled();
    }
  );

  it('provides named retry and step-up controls without assuming authorization', () => {
    const retry = vi.fn();
    const stepUp = vi.fn();
    act(() => root.render(<HrisAutomationControlPlaneStatePanel state="retry" onRetry={retry} />));
    const retryButton = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Retry'
    );
    expect(retryButton).toBeDefined();
    act(() => retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(retry).toHaveBeenCalledTimes(1);

    act(() =>
      root.render(<HrisAutomationControlPlaneStatePanel state="step-up" onStepUp={stepUp} />)
    );
    const stepUpButton = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Verify session'
    );
    expect(stepUpButton).toBeDefined();
    act(() => stepUpButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(stepUp).toHaveBeenCalledTimes(1);
  });

  it('pins responsive and 200% zoom coverage without fixed child widths', () => {
    expect(HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT).toEqual({
      viewportWidths: [1440, 1280, 390, 320],
      zoomPercent: 200,
      inlineSize: '100%',
      minimumChildInlineSize: 0,
      contentColumns: {
        narrow: 'minmax(0, 1fr)',
        wide: 'minmax(0, 1fr) auto',
      },
      textOverflow: 'anywhere',
    });
  });

  it.each(HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.viewportWidths)(
    'renders every accessible state at %ipx and 200%% zoom without a fixed child width',
    (viewportWidth) => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: viewportWidth,
      });
      host.style.inlineSize = `${viewportWidth}px`;
      host.style.setProperty(
        'zoom',
        String(HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.zoomPercent / 100)
      );
      window.dispatchEvent(new Event('resize'));

      for (const state of HRIS_AUTOMATION_CONTROL_PLANE_STATES) {
        act(() => root.render(<HrisAutomationControlPlaneStatePanel state={state} />));
        const region = host.querySelector<HTMLElement>(
          '[data-testid="hris-automation-control-plane-state"]'
        );
        expect(region).not.toBeNull();
        expect(region?.getAttribute('role')).toBe(
          ['partial', 'unavailable', 'forbidden', 'retry', 'step-up'].includes(state)
            ? 'alert'
            : 'status'
        );
        expect(region?.getAttribute('aria-labelledby')).toBe(
          `hris-automation-control-plane-${state}-title`
        );
        expect(region?.style.width).not.toMatch(/px$/);
        expect(region?.style.minWidth).not.toMatch(/[1-9][0-9]*px$/);
      }

      expect(host.style.inlineSize).toBe(`${viewportWidth}px`);
      expect(host.style.getPropertyValue('zoom')).toBe('2');
    }
  );
});
