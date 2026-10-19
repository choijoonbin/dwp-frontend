// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
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

async function renderWorkbench(
  source: Hrm011QueryAdapter,
  props: Partial<React.ComponentProps<typeof Hrm011ContractsCompensationBasisWorkbench>> = {},
  mode: 'light' | 'dark' = 'light'
) {
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
    expect(workbench?.getAttribute('data-color-scheme')).toBe('dark');
    expect(workbench?.getAttribute('data-forced-colors')).toBe('active');
    expect(workbench?.getAttribute('data-reduced-motion')).toBe('active');
    expect(document.querySelector('h1')?.textContent).toBe('Contracts and compensation basis');
    expect(document.querySelector('button[aria-pressed="true"]')).not.toBeNull();
    expect(document.body.textContent).toContain('125000.00 USD');
    expect(button('Review issuance').disabled).toBe(true);
  });

  it('reviews immutable fields and preserves one identity for an explicit 503 retry', async () => {
    const issue = vi
      .fn()
      .mockRejectedValueOnce(new HttpTransportError('NETWORK'))
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
