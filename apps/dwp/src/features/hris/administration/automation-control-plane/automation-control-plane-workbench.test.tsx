// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AutomationControlPlaneWorkbench } from './automation-control-plane-workbench';
import {
  automationCatalogFixture,
  automationRunFixture,
} from './automation-control-plane-fixtures.test-support';
import { HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT } from './automation-control-plane-contract';

import type { HrisAutomationControlPlaneState } from './automation-control-plane-contract';

describe('SYS-006 unmounted automation operator workbench', () => {
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

  it.each([
    ['loading', 'Loading automation governance'],
    ['empty', 'No automation definitions in this scope'],
    ['complete', 'payroll.posting'],
    ['partial', 'Some automation evidence is restricted or stale'],
    ['unavailable', 'Automation governance is unavailable'],
    ['forbidden', 'Automation governance is restricted'],
    ['retry', 'Automation evidence could not be refreshed'],
    ['step-up', 'Additional verification is required'],
  ] satisfies readonly (readonly [HrisAutomationControlPlaneState, string])[])(
    'renders the real %s journey accessibly without owner fetches',
    (state, expectedText) => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const catalog =
        state === 'empty'
          ? { ...automationCatalogFixture(), items: [] }
          : automationCatalogFixture();
      act(() =>
        root.render(
          <AutomationControlPlaneWorkbench
            state={state}
            catalog={catalog}
            run={automationRunFixture()}
            scopeLabel="SKAX · Tenant"
            onRetry={vi.fn()}
            onStepUp={vi.fn()}
            onAction={vi.fn()}
          />
        )
      );

      const surface = host.querySelector<HTMLElement>(
        '[data-testid="automation-control-plane-workbench"]'
      );
      expect(surface?.getAttribute('data-state')).toBe(state);
      expect(surface?.getAttribute('data-mounted')).toBe('false');
      expect(host.textContent).toContain(expectedText);
      expect(host.querySelector('h1')?.textContent).toBe('Automation control plane');
      expect(fetchSpy).not.toHaveBeenCalled();
    }
  );

  it('shows catalog comparison, lifecycle inspector, run evidence, and only owner-projected actions', () => {
    const onAction = vi.fn();
    act(() =>
      root.render(
        <AutomationControlPlaneWorkbench
          state="complete"
          catalog={automationCatalogFixture()}
          run={automationRunFixture()}
          scopeLabel="SKAX · Tenant"
          onAction={onAction}
        />
      )
    );

    expect(host.querySelector('table[aria-label="Automation resource catalog"]')).not.toBeNull();
    expect(host.textContent).toContain('payroll.posting');
    expect(host.textContent).toContain('Version 4');
    expect(host.textContent).toContain('Asia/Seoul');
    expect(host.textContent).toContain('Run evidence');
    expect(host.textContent).toContain('TARGET_TEMPORARILY_UNAVAILABLE');

    act(() => buttonByName(host, /^Version 4/)?.click());
    const approve = buttonByName(host, 'Approve version');
    expect(approve?.disabled).toBe(false);
    act(() => approve?.click());
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        descriptor: expect.objectContaining({
          actionKey:
            'hris.action.sys.post.platform.v1.admin.hris.automations.resource.versions.resource.approve',
        }),
      })
    );
  });

  it('keeps partial projections useful but read-only and announces the degraded evidence', () => {
    const onAction = vi.fn();
    act(() =>
      root.render(
        <AutomationControlPlaneWorkbench
          state="partial"
          catalog={automationCatalogFixture()}
          run={automationRunFixture()}
          scopeLabel="SKAX · Tenant"
          onAction={onAction}
        />
      )
    );

    expect(host.textContent).toContain('Some automation evidence is restricted or stale');
    expect(host.textContent).toContain('payroll.posting');
    expect(buttonByName(host, 'Queue run')?.disabled).toBe(true);
    expect(buttonByName(host, 'Retry failed items')?.disabled).toBe(true);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('supports keyboard-focusable selection and controlled filter state for later URL composition', () => {
    const onViewStateChange = vi.fn();
    act(() =>
      root.render(
        <AutomationControlPlaneWorkbench
          state="complete"
          catalog={automationCatalogFixture()}
          scopeLabel="SKAX · Tenant"
          viewState={{ search: '', resourceType: 'ALL', selectedKey: null }}
          onViewStateChange={onViewStateChange}
        />
      )
    );

    const selectDefinition = buttonByName(host, /payroll\.posting/);
    expect(selectDefinition).toBeDefined();
    expect(selectDefinition?.tagName).toBe('BUTTON');
    expect(selectDefinition?.tabIndex).toBeGreaterThanOrEqual(0);
    act(() => selectDefinition?.click());
    expect(onViewStateChange).toHaveBeenCalledWith({
      search: '',
      resourceType: 'ALL',
      selectedKey: '10000000-0000-4000-8000-000000000001',
    });

    const search = host.querySelector<HTMLInputElement>('input[type="text"]');
    expect(search).not.toBeNull();
  });

  it.each(HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.viewportWidths)(
    'keeps the %ipx and 200%% zoom workbench bounded with wrapping content and no fixed canvas width',
    (viewportWidth) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: viewportWidth });
      host.style.inlineSize = `${viewportWidth}px`;
      host.style.maxInlineSize = `${viewportWidth}px`;
      host.style.setProperty(
        'zoom',
        String(HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.zoomPercent / 100)
      );
      act(() =>
        root.render(
          <AutomationControlPlaneWorkbench
            state="complete"
            catalog={automationCatalogFixture()}
            run={automationRunFixture()}
            scopeLabel="A very long tenant and legal-entity scope label that must wrap safely"
          />
        )
      );

      const surface = host.querySelector<HTMLElement>(
        '[data-testid="automation-control-plane-workbench"]'
      );
      expect(surface?.getAttribute('data-responsive-widths')).toBe('1440,1280,390,320');
      expect(surface?.getAttribute('data-zoom-percent')).toBe('200');
      expect(surface?.style.width).not.toMatch(/[1-9][0-9]*px/);
      expect(surface?.style.minWidth).not.toMatch(/[1-9][0-9]*px/);
      expect(host.style.getPropertyValue('zoom')).toBe('2');
      expect(host.querySelector('table')?.getAttribute('aria-label')).toBe(
        'Automation resource catalog'
      );
    }
  );
});

function buttonByName(host: HTMLElement, name: string | RegExp): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
    typeof name === 'string'
      ? button.textContent?.trim() === name
      : name.test(button.textContent ?? '')
  );
}
