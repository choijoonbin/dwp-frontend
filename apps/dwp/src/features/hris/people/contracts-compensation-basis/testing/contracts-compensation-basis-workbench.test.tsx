// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HttpError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import {
  HRM011_ADAPTER_KIND,
  HRM011_DEFAULT_GATE,
  HRM011_FEATURE,
  Hrm011ContractsCompensationBasisWorkbench,
} from '..';
import {
  HRM011_TEST_CORRELATION_ID,
  HRM011_TEST_SCOPE,
  hrm011ProjectionWire,
  hrm011Receipt,
} from './contracts-compensation-basis-fixtures.test-support';

import type { Hrm011QueryAdapter } from '../contracts-compensation-basis-api';
import type { Hrm011Projection } from '../contracts-compensation-basis-contract';

const ADMITTED = {
  feature: HRM011_FEATURE,
  enabled: true,
  tenantEnrolled: true,
} as const;

function installEnvironment({
  width = 1280,
  forcedColors = false,
  reducedMotion = false,
}: {
  width?: number;
  forcedColors?: boolean;
  reducedMotion?: boolean;
} = {}) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      let matches = true;
      const maximumWidth = /max-width:\s*([\d.]+)px/u.exec(query)?.[1];
      const minimumWidth = /min-width:\s*([\d.]+)px/u.exec(query)?.[1];
      if (maximumWidth) matches = matches && width <= Number(maximumWidth);
      if (minimumWidth) matches = matches && width >= Number(minimumWidth);
      if (query.includes('forced-colors')) matches = forcedColors;
      if (query.includes('prefers-reduced-motion')) matches = reducedMotion;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }),
  });
}

function projection(
  state: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE' = 'COMPLETE',
  freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE' = state === 'UNAVAILABLE'
    ? 'UNAVAILABLE'
    : 'CURRENT'
): Hrm011Projection {
  return hrm011ProjectionWire(state, freshness) as unknown as Hrm011Projection;
}

function adapter(result: Hrm011Projection = projection()): Hrm011QueryAdapter {
  return Object.freeze({
    kind: HRM011_ADAPTER_KIND,
    query: vi.fn<Hrm011QueryAdapter['query']>().mockResolvedValue(result),
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

let root: Root;
let host: HTMLDivElement;

function button(label: string): HTMLButtonElement {
  const match = [...document.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(label)
  );
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return match;
}

async function shown(text: string) {
  await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
  await act(async () => {
    await vi.waitFor(() => expect(document.body.textContent).toContain(text));
  });
}

async function click(label: string) {
  await act(async () => {
    button(label).click();
  });
}

async function keyboardActivate(target: HTMLButtonElement) {
  await act(async () => {
    target.focus();
    expect(document.activeElement).toBe(target);
    expect(target.dataset.focusRing).toBe('keyboard-visible');
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    target.click();
    target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  });
}

function expectNoHorizontalOverflow() {
  const assertContained = (element: HTMLElement) => {
    const availableWidth = element.clientWidth || window.innerWidth;
    expect(availableWidth).toBeGreaterThan(0);
    expect(element.scrollWidth).toBeLessThanOrEqual(availableWidth);
  };
  assertContained(host);
  for (const selector of [
    '[data-testid="hrm-011-contracts-compensation-basis"]',
    '[data-testid="hrm-011-work-list"]',
    '[data-testid="hrm-011-work-detail"]',
  ]) {
    const element = document.querySelector<HTMLElement>(selector);
    expect(element).not.toBeNull();
    assertContained(element!);
  }
}

async function renderWorkbench(
  source: Hrm011QueryAdapter,
  props: Partial<React.ComponentProps<typeof Hrm011ContractsCompensationBasisWorkbench>> = {},
  mode: 'light' | 'dark' = 'light'
) {
  host.style.width = `${window.innerWidth}px`;
  host.style.maxWidth = '100%';
  await act(async () => {
    root.render(
      <ThemeProvider theme={createTheme({ palette: { mode } })}>
        <Hrm011ContractsCompensationBasisWorkbench
          gate={ADMITTED}
          scope={HRM011_TEST_SCOPE}
          adapter={source}
          {...props}
        />
      </ThemeProvider>
    );
  });
}

describe('HRM-011 contracts and compensation basis workbench', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    installEnvironment();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.documentElement.style.fontSize = '';
    host.remove();
    vi.restoreAllMocks();
  });

  it('is default OFF before hooks and sends zero GET or POST calls', async () => {
    const source = adapter();
    const issue = vi.fn();
    await act(async () => {
      root.render(
        <Hrm011ContractsCompensationBasisWorkbench
          gate={HRM011_DEFAULT_GATE}
          scope={HRM011_TEST_SCOPE}
          adapter={source}
          onIssueEmploymentContract={issue}
        />
      );
    });

    expect(document.querySelector('[data-runtime-state="disabled"]')).not.toBeNull();
    expect(source.query).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it('renders loading, denied, and unavailable without exposing an action', async () => {
    const pending = deferred<Hrm011Projection>();
    const loadingAdapter: Hrm011QueryAdapter = Object.freeze({
      kind: HRM011_ADAPTER_KIND,
      query: vi.fn().mockReturnValue(pending.promise),
    });
    await renderWorkbench(loadingAdapter);
    expect(document.querySelector('[data-runtime-state="loading"]')).not.toBeNull();
    pending.resolve(projection());
    await shown('Contracts and compensation basis');

    const deniedAdapter: Hrm011QueryAdapter = Object.freeze({
      kind: HRM011_ADAPTER_KIND,
      query: vi.fn().mockRejectedValue(new HttpError('concealed', 403)),
    });
    await renderWorkbench(deniedAdapter);
    await shown('This contract surface is unavailable');
    expect(document.querySelector('[data-runtime-state="denied"]')).not.toBeNull();

    const unavailableAdapter: Hrm011QueryAdapter = Object.freeze({
      kind: HRM011_ADAPTER_KIND,
      query: vi.fn().mockRejectedValue(new Error('owner down')),
    });
    await renderWorkbench(unavailableAdapter);
    await shown('Contract metadata unavailable');
    expect(document.querySelector('[data-runtime-state="unavailable"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Review issuance');
  });

  it.each([
    ['EMPTY', 'CURRENT', 'No contract-ready relationships', 'empty'],
    ['PARTIAL', 'CURRENT', 'Some authoritative inputs are unavailable', 'partial'],
    ['UNAVAILABLE', 'UNAVAILABLE', 'Contract metadata unavailable', 'unavailable'],
  ] as const)(
    'renders the %s projection as a distinct safe state',
    async (state, freshness, expected, runtimeState) => {
      await renderWorkbench(adapter(projection(state, freshness)));
      await shown(expected);
      expect(document.querySelector(`[data-runtime-state="${runtimeState}"]`)).not.toBeNull();
      expect(document.body.textContent).not.toContain('Confirm and issue');
    }
  );

  it('renders stale without actions and complete as responsive accessible list-detail', async () => {
    await renderWorkbench(adapter(projection('COMPLETE', 'STALE')));
    await shown('The disclosed snapshot is stale');
    expect(document.querySelector('[data-runtime-state="stale"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Review issuance');

    installEnvironment({ width: 320, forcedColors: true, reducedMotion: true });
    await renderWorkbench(adapter(), {}, 'dark');
    await shown('Global mobility employment relationship');
    const workbench = document.querySelector(
      '[data-testid="hrm-011-contracts-compensation-basis"]'
    );
    expect(workbench?.getAttribute('data-runtime-state')).toBe('complete');
    expect(workbench?.getAttribute('data-layout-density')).toBe('compact');
    expect(workbench?.getAttribute('data-workflow-layout')).toBe('stacked');
    expect(workbench?.getAttribute('data-color-scheme')).toBe('dark');
    expect(workbench?.getAttribute('data-forced-colors')).toBe('active');
    expect(workbench?.getAttribute('data-reduced-motion')).toBe('active');
    expect(document.querySelector('h1')?.textContent).toBe('Contracts and compensation basis');
    expect(document.querySelector('button[aria-pressed="true"]')).not.toBeNull();
    expect(document.body.textContent).toContain('125000.00 USD');
    expect(button('Review issuance').disabled).toBe(true);
    expectNoHorizontalOverflow();
  });

  it.each([
    [1440, 'fluid', 'split'],
    [1280, 'fluid', 'split'],
    [390, 'compact', 'stacked'],
  ] as const)(
    'keeps the bounded list-detail usable without horizontal overflow at %ipx',
    async (width, density, workflowLayout) => {
      installEnvironment({ width });
      await renderWorkbench(adapter());
      await shown('Global mobility employment relationship');

      const workbench = document.querySelector(
        '[data-testid="hrm-011-contracts-compensation-basis"]'
      );
      expect(workbench?.getAttribute('data-layout-density')).toBe(density);
      expect(workbench?.getAttribute('data-workflow-layout')).toBe(workflowLayout);
      expectNoHorizontalOverflow();
    }
  );

  it('keeps a 200%-zoom-equivalent constrained viewport stacked and overflow-safe', async () => {
    installEnvironment({ width: 720 });
    document.documentElement.style.fontSize = '32px';
    await renderWorkbench(adapter());
    await shown('Global mobility employment relationship');

    const workbench = document.querySelector(
      '[data-testid="hrm-011-contracts-compensation-basis"]'
    );
    expect(getComputedStyle(document.documentElement).fontSize).toBe('32px');
    expect(workbench?.getAttribute('data-workflow-layout')).toBe('stacked');
    expectNoHorizontalOverflow();
  });

  it('reviews immutable fields and preserves one identity for an explicit 503 retry', async () => {
    const issue = vi
      .fn()
      .mockRejectedValueOnce(new HttpError('artifact unavailable', 503))
      .mockResolvedValueOnce(hrm011Receipt());
    const createCommandIdentity = vi.fn().mockReturnValue({
      idempotencyKey: 'employment-contract-command-0001',
      correlationId: HRM011_TEST_CORRELATION_ID,
    });
    await renderWorkbench(adapter(), { onIssueEmploymentContract: issue, createCommandIdentity });
    await shown('Review issuance');

    await click('Review issuance');
    expect(document.body.textContent).toContain('Confirm immutable issuance snapshot');
    expect(document.body.textContent).toContain('immutable snapshot verified');
    expect(document.body.textContent).toContain('125000.00 USD');
    await click('Confirm and issue');
    await shown('Artifact service is temporarily unavailable');
    expect(issue).toHaveBeenCalledTimes(1);
    const originalDraft = issue.mock.calls[0]?.[0];

    await click('Retry same command');
    await shown('Employment contract command accepted');
    expect(issue).toHaveBeenCalledTimes(2);
    expect(issue.mock.calls[1]?.[0]).toBe(originalDraft);
    expect(createCommandIdentity).toHaveBeenCalledOnce();
  });

  it('discards a prepared command when a refreshed immutable snapshot changes at the same resource version', async () => {
    const first = hrm011ProjectionWire();
    const refreshed = hrm011ProjectionWire();
    const refreshedMetadata = refreshed.items[0]!.fieldGroups.CONTRACT_METADATA as {
      decision: 'VIEW';
      value: { key: string; version: string; digest: string };
    };
    const refreshedBasis = refreshed.items[0]!.fieldGroups.COMPENSATION_BASIS as {
      decision: 'VIEW';
      value: { amount: string; currency: string };
    };
    refreshedMetadata.value.key = '77777777-7777-4777-8777-777777777777';
    refreshedMetadata.value.version = '4';
    refreshedMetadata.value.digest = 'd'.repeat(64);
    refreshedBasis.value.amount = '130000.00';
    const query = vi
      .fn<Hrm011QueryAdapter['query']>()
      .mockResolvedValueOnce(first as unknown as Hrm011Projection)
      .mockResolvedValueOnce(refreshed as unknown as Hrm011Projection);
    const source: Hrm011QueryAdapter = Object.freeze({ kind: HRM011_ADAPTER_KIND, query });
    const issue = vi.fn().mockResolvedValue(hrm011Receipt());
    const createCommandIdentity = vi
      .fn()
      .mockReturnValueOnce({
        idempotencyKey: 'employment-contract-command-old-0001',
        correlationId: HRM011_TEST_CORRELATION_ID,
      })
      .mockReturnValueOnce({
        idempotencyKey: 'employment-contract-command-new-0002',
        correlationId: HRM011_TEST_CORRELATION_ID,
      });
    await renderWorkbench(source, { onIssueEmploymentContract: issue, createCommandIdentity });
    await shown('Review issuance');
    await click('Review issuance');
    expect(document.body.textContent).toContain('125000.00 USD');
    expect(document.body.textContent).toContain('Confirm immutable issuance snapshot');

    await click('Refresh');
    await shown('130000.00 USD');
    expect(document.body.textContent).toContain('77777777-7777-4777-8777-777777777777');
    expect(document.body.textContent).not.toContain('Confirm immutable issuance snapshot');
    expect(issue).not.toHaveBeenCalled();

    await click('Review issuance');
    await click('Confirm and issue');
    await shown('Employment contract command accepted');
    expect(issue).toHaveBeenCalledOnce();
    expect(issue.mock.calls[0]?.[0]).toMatchObject({
      idempotencyKey: 'employment-contract-command-new-0002',
      request: {
        templatePublicId: '77777777-7777-4777-8777-777777777777',
        templateVersion: 4,
        snapshotDigest: 'd'.repeat(64),
      },
    });
  });

  it('fences the completed snapshot after one verified receipt and ignores later submits', async () => {
    const issue = vi.fn().mockResolvedValue(hrm011Receipt());
    await renderWorkbench(adapter(), {
      onIssueEmploymentContract: issue,
      createCommandIdentity: () => ({
        idempotencyKey: 'employment-contract-command-0001',
        correlationId: HRM011_TEST_CORRELATION_ID,
      }),
    });
    await shown('Review issuance');
    await click('Review issuance');
    await click('Confirm and issue');
    await shown('Employment contract command accepted');

    const accepted = button('Issuance accepted');
    expect(accepted.disabled).toBe(true);
    expect(button('Back').disabled).toBe(true);
    expect(document.body.textContent).toContain(`Receipt ${hrm011Receipt().receiptId} · ACCEPTED`);
    const form = accepted.closest('form');
    expect(form).not.toBeNull();
    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      accepted.click();
      await Promise.resolve();
    });
    expect(issue).toHaveBeenCalledOnce();
  });

  it('visibly disables prepared and review actions when a retained projection becomes stale', async () => {
    const query = vi
      .fn<Hrm011QueryAdapter['query']>()
      .mockResolvedValueOnce(projection())
      .mockRejectedValueOnce(new HttpError('temporarily unavailable', 503));
    const source: Hrm011QueryAdapter = Object.freeze({ kind: HRM011_ADAPTER_KIND, query });
    const issue = vi.fn().mockResolvedValue(hrm011Receipt());
    await renderWorkbench(source, {
      onIssueEmploymentContract: issue,
      createCommandIdentity: () => ({
        idempotencyKey: 'employment-contract-command-0001',
        correlationId: HRM011_TEST_CORRELATION_ID,
      }),
    });
    await shown('Review issuance');
    await click('Review issuance');
    await click('Refresh');
    await shown('The disclosed snapshot is stale');

    expect(button('Confirm and issue').disabled).toBe(true);
    await click('Back');
    expect(button('Review issuance').disabled).toBe(true);
    expect(issue).not.toHaveBeenCalled();
  });

  it('supports the two-step issuance path using keyboard focus with visible focus hooks', async () => {
    const issue = vi.fn().mockResolvedValue(hrm011Receipt());
    await renderWorkbench(adapter(), {
      onIssueEmploymentContract: issue,
      createCommandIdentity: () => ({
        idempotencyKey: 'employment-contract-command-0001',
        correlationId: HRM011_TEST_CORRELATION_ID,
      }),
    });
    await shown('Review issuance');
    const selected = document.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    expect(selected).not.toBeNull();
    selected!.focus();
    expect(document.activeElement).toBe(selected);
    expect(selected!.dataset.focusRing).toBe('keyboard-visible');

    await keyboardActivate(button('Review issuance'));
    await keyboardActivate(button('Confirm and issue'));
    await shown('Employment contract command accepted');
    expect(issue).toHaveBeenCalledOnce();
  });

  it('never auto-retries a 409 and requires a refreshed resource version', async () => {
    const issue = vi.fn().mockRejectedValue(new HttpError('stale', 409, { currentVersion: 8 }));
    const source = adapter();
    await renderWorkbench(source, {
      onIssueEmploymentContract: issue,
      createCommandIdentity: () => ({
        idempotencyKey: 'employment-contract-command-0001',
        correlationId: HRM011_TEST_CORRELATION_ID,
      }),
    });
    await shown('Review issuance');
    await click('Review issuance');
    await click('Confirm and issue');
    await shown('current version 8');

    expect(issue).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain('Retry same command');
    await click('Refresh relationship');
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
    expect(source.query).toHaveBeenCalledTimes(2);
    expect(issue).toHaveBeenCalledOnce();
    expect(button('Review issuance').disabled).toBe(true);
  });
});
