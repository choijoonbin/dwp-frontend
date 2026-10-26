// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT } from './integration-control-plane-contract';
import {
  executionFixture,
  FIXTURE_IDS,
  projectionFixture,
} from './integration-control-plane-fixtures.test-support';
import { IntegrationControlPlaneWorkbench } from './integration-control-plane-workbench';

import type { HrisIntegrationControlPlaneState } from './integration-control-plane-contract';

describe('SYS-008 unmounted integration operator workbench', () => {
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
    ['loading', 'Loading integration governance'],
    ['empty', 'No connector definitions in this scope'],
    ['complete', 'Workforce gateway'],
    ['partial', 'Some integration evidence is restricted or stale'],
    ['unavailable', 'Integration governance is unavailable'],
    ['forbidden', 'Integration governance is restricted'],
    ['retry', 'Integration evidence could not be refreshed'],
    ['step-up', 'Additional verification is required'],
    ['result-unknown', 'The latest command outcome is not confirmed'],
  ] satisfies readonly (readonly [HrisIntegrationControlPlaneState, string])[])(
    'renders the real %s journey accessibly without owner fetches',
    (state, expectedText) => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const projection =
        state === 'empty'
          ? projectionFixture('PRIMARY_HRIS_SETTINGS', { state: 'EMPTY' })
          : state === 'partial'
            ? projectionFixture('PRIMARY_HRIS_SETTINGS', { state: 'PARTIAL' })
            : ['complete', 'result-unknown'].includes(state)
              ? projectionFixture()
              : undefined;
      act(() =>
        root.render(
          <IntegrationControlPlaneWorkbench
            state={state}
            projection={projection}
            execution={
              state === 'complete' || state === 'result-unknown' ? executionFixture() : undefined
            }
            scopeLabel="SKAX · Tenant"
            asOf="2026-10-26T00:00:00Z"
            onRetry={vi.fn()}
            onStepUp={vi.fn()}
            onAction={vi.fn()}
          />
        )
      );

      const surface = host.querySelector<HTMLElement>(
        '[data-testid="integration-control-plane-workbench"]'
      );
      expect(surface?.getAttribute('data-state')).toBe(state);
      expect(surface?.getAttribute('data-mounted')).toBe('false');
      expect(host.textContent).toContain(expectedText);
      expect(host.querySelector('h1')?.textContent).toBe('Integration control plane');
      expect(host.querySelector('main')).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    }
  );

  it('shows comparison, inspector, execution evidence, and owner-projected actions only', () => {
    const onAction = vi.fn();
    act(() =>
      root.render(
        <IntegrationControlPlaneWorkbench
          state="complete"
          projection={projectionFixture()}
          execution={executionFixture()}
          scopeLabel="SKAX · Tenant"
          createAvailable
          onAction={onAction}
        />
      )
    );

    expect(host.querySelector('table[aria-label="Connector governance evidence"]')).not.toBeNull();
    expect(host.textContent).toContain('Workforce gateway');
    expect(host.textContent).toContain('Execution evidence');
    expect(host.textContent).toContain('same-key reconciliation');

    const testAction = buttonByName(host, 'Test connection');
    expect(testAction?.disabled).toBe(false);
    act(() => testAction?.click());
    expect(onAction).toHaveBeenCalledWith({
      scope: 'ITEM',
      actionKey: 'hris.action.sys.post.platform.v1.admin.hris.connectors.resource.test',
      itemPublicId: FIXTURE_IDS.item,
      expectedObjectRevision: 12,
    });

    act(() => buttonByName(host, 'New connector')?.click());
    expect(onAction).toHaveBeenCalledWith({
      scope: 'COLLECTION',
      actionKey: 'hris.action.sys.post.platform.v1.admin.hris.connectors',
    });
  });

  it('keeps partial and result-unknown projections useful while withholding commands', () => {
    const onAction = vi.fn();
    act(() =>
      root.render(
        <IntegrationControlPlaneWorkbench
          state="partial"
          projection={projectionFixture('PRIMARY_HRIS_SETTINGS', { state: 'PARTIAL' })}
          scopeLabel="SKAX · Tenant"
          onAction={onAction}
        />
      )
    );
    expect(host.textContent).toContain('Restricted connector');
    expect(buttonByName(host, 'Test connection')).toBeUndefined();

    act(() =>
      root.render(
        <IntegrationControlPlaneWorkbench
          state="result-unknown"
          projection={projectionFixture()}
          execution={executionFixture()}
          scopeLabel="SKAX · Tenant"
          onAction={onAction}
        />
      )
    );
    expect(host.textContent).toContain('Workforce gateway');
    expect(buttonByName(host, 'Test connection')).toBeUndefined();
    expect(host.textContent).toContain('never mutates the original result-unknown receipt');
    expect(onAction).not.toHaveBeenCalled();
  });

  it.each([
    'loading',
    'empty',
    'partial',
    'unavailable',
    'forbidden',
    'retry',
    'step-up',
    'result-unknown',
  ] satisfies readonly HrisIntegrationControlPlaneState[])(
    'renders zero integration command buttons in cached %s state',
    (state) => {
      act(() =>
        root.render(
          <IntegrationControlPlaneWorkbench
            state={state}
            projection={projectionFixture()}
            execution={executionFixture()}
            scopeLabel="SKAX · Tenant"
            createAvailable
            onAction={vi.fn()}
            onRetry={vi.fn()}
            onStepUp={vi.fn()}
          />
        )
      );

      expect(host.querySelectorAll('[data-integration-command]')).toHaveLength(0);
    }
  );

  it('keeps command errors separate and does not erase the verified read snapshot', () => {
    act(() =>
      root.render(
        <IntegrationControlPlaneWorkbench
          state="complete"
          projection={projectionFixture()}
          scopeLabel="SKAX · Tenant"
          commandFeedback={{
            kind: 'ERROR',
            title: 'Activation was rejected',
            detail: 'The verified connector snapshot remains current.',
            correlationId: FIXTURE_IDS.correlation,
          }}
        />
      )
    );
    expect(host.textContent).toContain('Activation was rejected');
    expect(host.textContent).toContain(FIXTURE_IDS.correlation);
    expect(host.textContent).toContain('Workforce gateway');
    expect(host.querySelector('table')).not.toBeNull();
  });

  it('supports keyboard-focusable selection and controlled view state', () => {
    const onViewStateChange = vi.fn();
    act(() =>
      root.render(
        <IntegrationControlPlaneWorkbench
          state="complete"
          projection={projectionFixture()}
          scopeLabel="SKAX · Tenant"
          viewState={{ search: '', selectedItemPublicId: null }}
          onViewStateChange={onViewStateChange}
        />
      )
    );

    const selectConnector = buttonByName(host, /Workforce gateway/);
    expect(selectConnector?.tagName).toBe('BUTTON');
    expect(selectConnector?.tabIndex).toBeGreaterThanOrEqual(0);
    act(() => selectConnector?.click());
    expect(onViewStateChange).toHaveBeenCalledWith({
      search: '',
      selectedItemPublicId: FIXTURE_IDS.item,
    });
    expect(host.querySelector<HTMLInputElement>('input[type="text"]')).not.toBeNull();
  });

  it.each(HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.viewportWidths)(
    'keeps the %ipx and 200%% zoom workbench bounded without a fixed canvas',
    (viewportWidth) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: viewportWidth });
      host.style.inlineSize = `${viewportWidth}px`;
      host.style.maxInlineSize = `${viewportWidth}px`;
      host.style.setProperty(
        'zoom',
        String(HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.zoomPercent / 100)
      );
      act(() =>
        root.render(
          <IntegrationControlPlaneWorkbench
            state="complete"
            projection={projectionFixture()}
            execution={executionFixture()}
            scopeLabel="A very long tenant and legal-entity scope label that must wrap safely"
          />
        )
      );

      const surface = host.querySelector<HTMLElement>(
        '[data-testid="integration-control-plane-workbench"]'
      );
      expect(surface?.getAttribute('data-responsive-widths')).toBe('1440,1280,390,320');
      expect(surface?.getAttribute('data-zoom-percent')).toBe('200');
      expect(surface?.style.width).not.toMatch(/[1-9][0-9]*px/);
      expect(surface?.style.minWidth).not.toMatch(/[1-9][0-9]*px/);
      expect(host.style.getPropertyValue('zoom')).toBe('2');
      expect(host.querySelector('table')?.getAttribute('aria-label')).toBe(
        'Connector governance evidence'
      );
    }
  );

  it('does not serialize secret, raw payload, or employee identity material into the DOM', () => {
    act(() =>
      root.render(
        <IntegrationControlPlaneWorkbench
          state="complete"
          projection={projectionFixture()}
          execution={executionFixture()}
          scopeLabel="SKAX · Tenant"
        />
      )
    );
    expect(host.textContent).not.toMatch(/secret_|raw payload|employee public id/i);
    expect(host.innerHTML).not.toContain('ref_payload_');
  });
});

function buttonByName(host: HTMLElement, name: string | RegExp): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
    typeof name === 'string'
      ? button.textContent?.trim() === name
      : name.test(button.textContent ?? '')
  );
}
