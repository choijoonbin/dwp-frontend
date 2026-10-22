// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import { DwpThemeProvider } from '@dwp-frontend/design-system';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PAY004_ADAPTER_KIND,
  PAY004_DEFAULT_ROLLOUT,
  PAY004_FEATURE,
  Pay004RetirementWorkbench,
} from '..';
import {
  PAY004_TEST_ADMISSION,
  PAY004_TEST_IDS,
  pay004ProjectionWire,
  pay004TwoItemProjectionWire,
} from './retirement-fixtures.test-support';

import type { Pay004QueryAdapter } from '../retirement-api';
import type { Pay004Projection } from '../retirement-contract';

const ADMITTED = Object.freeze({
  feature: PAY004_FEATURE,
  enabled: true,
  enrolledTenantIds: Object.freeze(['tenant-a']),
});

function installEnvironment({
  width = 1280,
  zoom = 1,
  forcedColors = false,
  reducedMotion = false,
}: {
  width?: number;
  zoom?: number;
  forcedColors?: boolean;
  reducedMotion?: boolean;
} = {}) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: zoom });
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
      if (query.includes('prefers-color-scheme')) matches = false;
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
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
}

function projection(
  state: Pay004Projection['queryState']['state'] = 'COMPLETE',
  freshness: Pay004Projection['queryState']['freshness'] = state === 'UNAVAILABLE'
    ? 'UNAVAILABLE'
    : 'CURRENT',
  nextCursor: string | null = null
): Pay004Projection {
  return pay004ProjectionWire(state, freshness, nextCursor) as unknown as Pay004Projection;
}

function adapter(result: Pay004Projection = projection()): Pay004QueryAdapter {
  return Object.freeze({
    kind: PAY004_ADAPTER_KIND,
    query: vi.fn<Pay004QueryAdapter['query']>().mockResolvedValue(result),
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

async function settle() {
  await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
}

async function shown(text: string) {
  await settle();
  await act(async () => {
    await vi.waitFor(() => expect(document.body.textContent).toContain(text));
  });
}

async function changeInput(id: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  expect(input).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(input, value);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function changeSelect(id: string, value: string) {
  const select = document.querySelector<HTMLSelectElement>(`#${id}`);
  expect(select).not.toBeNull();
  await act(async () => {
    select!.value = value;
    select!.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function renderTree(node: React.ReactNode, mode: 'light' | 'dark' = 'light') {
  window.localStorage.setItem(
    'dwp.appearance.v1',
    JSON.stringify({ mode, density: 'standard', highContrast: false, reduceMotion: false })
  );
  root.render(<DwpThemeProvider>{node}</DwpThemeProvider>);
}

async function renderWorkbench(
  source: Pay004QueryAdapter,
  props: Partial<React.ComponentProps<typeof Pay004RetirementWorkbench>> = {},
  mode: 'light' | 'dark' = 'light'
) {
  host.style.width = `${window.innerWidth}px`;
  host.style.maxWidth = '100%';
  await act(async () => {
    renderTree(
      <Pay004RetirementWorkbench
        rollout={ADMITTED}
        admission={PAY004_TEST_ADMISSION}
        adapter={source}
        {...props}
      />,
      mode
    );
  });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  installEnvironment();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.documentElement.style.fontSize = '';
  window.localStorage.clear();
  window.sessionStorage.clear();
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('PAY-004 retirement payroll workbench', () => {
  it('returns before mounting query hooks when default OFF and sends zero owner calls', async () => {
    const source = adapter();
    await act(async () => {
      renderTree(
        <Pay004RetirementWorkbench
          rollout={PAY004_DEFAULT_ROLLOUT}
          admission={PAY004_TEST_ADMISSION}
          adapter={source}
        />
      );
    });
    expect(document.querySelector('[data-runtime-state="disabled"]')).not.toBeNull();
    expect(document.querySelector('[data-owner-calls="0"]')).not.toBeNull();
    expect(source.query).not.toHaveBeenCalled();
  });

  it('fails closed with zero calls for invalid admission or a missing exact adapter', async () => {
    const source = adapter();
    await act(async () => {
      renderTree(
        <Pay004RetirementWorkbench
          rollout={ADMITTED}
          admission={{ ...PAY004_TEST_ADMISSION, dataRouteContractKey: 'wrong' } as never}
          adapter={source}
        />
      );
    });
    expect(document.querySelector('[data-runtime-state="denied"]')).not.toBeNull();
    expect(source.query).not.toHaveBeenCalled();

    await act(async () => {
      renderTree(
        <Pay004RetirementWorkbench rollout={ADMITTED} admission={PAY004_TEST_ADMISSION} />
      );
    });
    expect(document.querySelector('[data-runtime-state="unavailable"]')).not.toBeNull();
    expect(source.query).not.toHaveBeenCalled();
  });

  it('renders loading, concealed denial and unavailable as distinct states', async () => {
    const pending = deferred<Pay004Projection>();
    const loadingAdapter: Pay004QueryAdapter = Object.freeze({
      kind: PAY004_ADAPTER_KIND,
      query: vi.fn().mockReturnValue(pending.promise),
    });
    await renderWorkbench(loadingAdapter);
    expect(document.querySelector('[data-runtime-state="loading"]')).not.toBeNull();
    pending.resolve(projection());
    await shown('Retirement payroll workbench');

    const deniedAdapter: Pay004QueryAdapter = Object.freeze({
      kind: PAY004_ADAPTER_KIND,
      query: vi.fn().mockRejectedValue(new HttpError('concealed', 403)),
    });
    await renderWorkbench(deniedAdapter);
    await shown('This retirement payroll surface is unavailable');
    expect(document.querySelector('[data-runtime-state="denied"]')).not.toBeNull();

    const unavailableAdapter: Pay004QueryAdapter = Object.freeze({
      kind: PAY004_ADAPTER_KIND,
      query: vi.fn().mockRejectedValue(new Error('owner unavailable')),
    });
    await renderWorkbench(unavailableAdapter);
    await shown('Retirement payroll is unavailable');
    expect(document.querySelector('[data-runtime-state="unavailable"]')).not.toBeNull();
  });

  it.each([
    ['EMPTY', 'CURRENT', 'No retirement cases to display', 'empty'],
    ['PARTIAL', 'CURRENT', 'Some retirement evidence is unavailable', 'partial'],
    ['UNAVAILABLE', 'UNAVAILABLE', 'Retirement payroll is unavailable', 'unavailable'],
  ] as const)('renders %s safely', async (state, freshness, text, runtimeState) => {
    await renderWorkbench(adapter(projection(state, freshness)));
    await shown(text);
    expect(document.querySelector(`[data-runtime-state="${runtimeState}"]`)).not.toBeNull();
  });

  it('retains a verified projection as stale only for bounded transient refresh failures', async () => {
    const source: Pay004QueryAdapter = Object.freeze({
      kind: PAY004_ADAPTER_KIND,
      query: vi
        .fn<Pay004QueryAdapter['query']>()
        .mockResolvedValueOnce(projection())
        .mockRejectedValueOnce(new HttpTransportError('NETWORK', 'offline')),
    });
    await renderWorkbench(source);
    await shown('Retirement case · October separation');
    const refresh = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Refresh retirement payroll"]'
    );
    expect(refresh).not.toBeNull();
    await act(async () => refresh!.click());
    await shown('The retirement payroll data is not current');
    expect(document.querySelector('[data-runtime-state="stale"]')).not.toBeNull();
    expect(source.query).toHaveBeenCalledTimes(2);
  });

  it('fails closed when a later page or refresh response changes the pinned asOf snapshot', async () => {
    const changedSnapshot: Pay004Projection = {
      ...projection(),
      asOf: '2026-10-22T05:01:00Z',
    };
    const source: Pay004QueryAdapter = Object.freeze({
      kind: PAY004_ADAPTER_KIND,
      query: vi
        .fn<Pay004QueryAdapter['query']>()
        .mockResolvedValueOnce(projection())
        .mockResolvedValueOnce(changedSnapshot),
    });
    await renderWorkbench(source);
    await shown('Retirement case · October separation');

    const refresh = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Refresh retirement payroll"]'
    );
    await act(async () => refresh!.click());
    await shown('This retirement payroll surface is unavailable');
    expect(document.querySelector('[data-runtime-state="denied"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="pay-004-retirement-workbench"]')).toBeNull();
    expect(source.query).toHaveBeenCalledTimes(2);
  });

  it('pins the derived scope revision without equating it to authorization revision', async () => {
    const baseline = projection();
    const changedScope: Pay004Projection = {
      ...baseline,
      queryState: {
        ...baseline.queryState,
        scopeDecisionRevision: 'scope-projection-revision-13',
      },
    };
    const source: Pay004QueryAdapter = Object.freeze({
      kind: PAY004_ADAPTER_KIND,
      query: vi
        .fn<Pay004QueryAdapter['query']>()
        .mockResolvedValueOnce(baseline)
        .mockResolvedValueOnce(changedScope),
    });
    await renderWorkbench(source);
    await shown('Retirement case · October separation');
    const refresh = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Refresh retirement payroll"]'
    );
    await act(async () => refresh!.click());
    await shown('This retirement payroll surface is unavailable');
    expect(document.querySelector('[data-runtime-state="denied"]')).not.toBeNull();
    expect(source.query).toHaveBeenCalledTimes(2);
  });

  it('offers four governed filter groups and all sealed sorts with in-session restore', async () => {
    const source = adapter();
    await renderWorkbench(source);
    await shown('Retirement case · October separation');
    expect(document.querySelectorAll('[data-filter-key]')).toHaveLength(4);
    expect(document.querySelector('#pay004-sort')?.getAttribute('data-sort-count')).toBe('8');
    const apply = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'Apply criteria'
    );
    expect(apply).not.toBeNull();

    await changeInput('pay004-case-statuses', 'calculated');
    await act(async () => apply!.click());
    await shown('Check the criteria format');
    expect(source.query).toHaveBeenCalledTimes(1);

    await changeInput('pay004-minimum-amount', '1000000.0000');
    await changeInput('pay004-policy-keys', 'kr.retirement, global.retirement');
    await changeInput('pay004-case-statuses', 'CALCULATED, FINALIZED');
    await changeInput('pay004-effective-on', '2026-10-22');
    await changeSelect('pay004-sort', 'caseStatus:DESC');
    await act(async () => apply!.click());
    await vi.waitFor(() => expect(source.query).toHaveBeenCalledTimes(2));
    expect(vi.mocked(source.query).mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        filter: {
          retirementResult: { minimumAmount: '1000000.0000' },
          policyVersion: { policyKeys: ['kr.retirement', 'global.retirement'] },
          caseStatus: { codes: ['CALCULATED', 'FINALIZED'] },
          effectiveOn: '2026-10-22',
        },
        sort: ['caseStatus:DESC', 'itemPublicId:ASC'],
        asOf: null,
        cursor: null,
      })
    );
    expect(window.sessionStorage.length).toBe(1);

    await act(async () => root.unmount());
    root = createRoot(host);
    const restored = adapter();
    await renderWorkbench(restored);
    await vi.waitFor(() => expect(restored.query).toHaveBeenCalledTimes(1));
    expect(vi.mocked(restored.query).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        filter: expect.objectContaining({
          effectiveOn: '2026-10-22',
          caseStatus: { codes: ['CALCULATED', 'FINALIZED'] },
        }),
        sort: ['caseStatus:DESC', 'itemPublicId:ASC'],
      })
    );
    await shown('Retirement case · October separation');
    const reset = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'Reset criteria'
    );
    expect(reset).not.toBeNull();
    await act(async () => reset!.click());
    await vi.waitFor(() => expect(restored.query).toHaveBeenCalledTimes(2));
    expect(window.sessionStorage.length).toBe(0);
    expect(vi.mocked(restored.query).mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ filter: {}, sort: ['itemPublicId:ASC'], asOf: null, cursor: null })
    );
  });

  it('keeps policy civil dates stable in a timezone west of UTC', async () => {
    const wire = pay004ProjectionWire();
    wire.items[0]!.fieldGroups.POLICY_VERSION = {
      decision: 'VIEW',
      value: {
        policyKey: 'us.retirement',
        revision: 3,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        status: 'ACTIVE',
      },
    } as never;
    wire.queryState.fieldDecisionSummary = { viewCount: 3, maskedCount: 0, omittedCount: 0 };
    await renderWorkbench(adapter(wire as unknown as Pay004Projection), {
      admission: { ...PAY004_TEST_ADMISSION, timeZone: 'America/New_York' },
    });
    await shown('Jan 1, 2026');
    expect(document.body.textContent).toContain('Dec 31, 2026');
    expect(document.body.textContent).not.toContain('Dec 31, 2025');
  });

  it('supports Enter and Space selection in the desktop grid without moving authority state', async () => {
    await renderWorkbench(adapter(pay004TwoItemProjectionWire() as unknown as Pay004Projection));
    await shown('Retirement case · November correction');
    const cells = [
      ...document.querySelectorAll<HTMLElement>('[role="gridcell"][data-field="title"]'),
    ];
    expect(cells).toHaveLength(2);

    await act(async () => {
      cells[1]!.focus();
      cells[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await settle();
    expect(
      document
        .querySelector('[data-testid="pay-004-retirement-inspector"]')
        ?.getAttribute('data-governed-deep-link')
    ).toContain(PAY004_TEST_IDS.itemTwo);

    await act(async () => {
      cells[0]!.focus();
      cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });
    await settle();
    expect(
      document
        .querySelector('[data-testid="pay-004-retirement-inspector"]')
        ?.getAttribute('data-governed-deep-link')
    ).toContain(PAY004_TEST_IDS.item);
  });

  it.each([
    { label: '1440px', width: 1440, zoom: 1 },
    { label: '1280px', width: 1280, zoom: 1 },
    { label: '390px', width: 390, zoom: 1 },
    { label: '320px', width: 320, zoom: 1 },
    { label: '1440px at 200% zoom', width: 720, zoom: 2 },
    { label: '1280px at 200% zoom', width: 640, zoom: 2 },
  ])(
    'keeps complete list-detail inspection accessible at $label',
    async ({ width, zoom }) => {
      installEnvironment({
        width,
        zoom,
        forcedColors: width === 320,
        reducedMotion: width === 390,
      });
      await renderWorkbench(adapter(), {}, width === 320 ? 'dark' : 'light');
      await shown('Retirement case · October separation');
      const workbench = document.querySelector<HTMLElement>(
        '[data-testid="pay-004-retirement-workbench"]'
      );
      expect(workbench?.getAttribute('data-runtime-state')).toBe('complete');
      expect(workbench?.getAttribute('data-layout-density')).toBe(
        width <= 600 ? 'compact' : 'fluid'
      );
      expect(workbench?.getAttribute('data-color-scheme')).toBe(
        width === 320 ? 'dark' : 'light'
      );
      expect(workbench?.getAttribute('data-forced-colors')).toBe(
        width === 320 ? 'active' : 'inactive'
      );
      expect(workbench?.getAttribute('data-reduced-motion')).toBe(
        width === 390 ? 'active' : 'inactive'
      );
      expect(document.querySelector('h1')?.textContent).toBe('Retirement payroll workbench');
      expect(document.body.textContent).not.toContain('Calculate');
      expect(document.body.textContent).not.toContain('Activate pack');
      expect(window.devicePixelRatio).toBe(zoom);
      expect(getComputedStyle(workbench!).overflowX).toBe('clip');
      expect(workbench!.scrollWidth).toBeLessThanOrEqual(workbench!.clientWidth);
    }
  );

  it.each(['Enter', ' '])(
    'supports Korean copy and keyboard-only compact inspection with %s',
    async (key) => {
      installEnvironment({ width: 320 });
      await renderWorkbench(adapter(), {
        admission: { ...PAY004_TEST_ADMISSION, locale: 'ko-KR' },
      });
      await shown('퇴직 급여 워크벤치');
      const row = [...document.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
        candidate.textContent?.includes('Retirement case · October separation')
      );
      expect(row?.dataset.focusRing).toBe('keyboard-visible');
      await act(async () => row!.focus());
      expect(document.activeElement).toBe(row);
      await act(async () =>
        row!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      );
      await settle();
      expect(row?.getAttribute('aria-pressed')).toBe('true');
      const inspector = document.querySelector('[data-testid="pay-004-retirement-inspector"]');
      expect(inspector).not.toBeNull();
      expect(inspector?.getAttribute('data-available-actions')).toBe('0');
      expect(document.activeElement?.closest('[role="dialog"]')).not.toBeNull();
    }
  );

  it.each([
    ['ko-KR', `퇴직 정산 정책 변경 검증 ${'매우 긴 한글 레이블 '.repeat(12)}`.trimEnd()],
    [
      'en-US',
      `Retirement policy correction review ${'very long English label '.repeat(12)}`.trimEnd(),
    ],
  ])('contains long %s labels without widening compact content', async (locale, title) => {
    installEnvironment({ width: 320 });
    await renderWorkbench(
      adapter(pay004TwoItemProjectionWire(title) as unknown as Pay004Projection),
      { admission: { ...PAY004_TEST_ADMISSION, locale } }
    );
    await shown(title);
    const row = [...document.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      candidate.textContent?.includes(title)
    );
    expect(row).not.toBeNull();
    expect(getComputedStyle(row!).overflowWrap).toBe('anywhere');
    expect(document.querySelector('[data-testid="pay-004-query-toolbar"]')).not.toBeNull();
  });
});
