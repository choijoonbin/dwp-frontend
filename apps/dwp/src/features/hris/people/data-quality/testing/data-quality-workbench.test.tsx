// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import { DwpThemeProvider } from '@dwp-frontend/design-system';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HRM012_ADAPTER_KIND,
  HRM012_DEFAULT_GATE,
  HRM012_FEATURE,
  Hrm012DataQualityWorkbench,
  useHrm012WorkbenchQuery,
} from '..';
import {
  HRM012_TEST_CURSOR,
  HRM012_TEST_SCOPE,
  hrm012OmittedProjectionWire,
  hrm012ProjectionWire,
} from './data-quality-fixtures.test-support';

import type { Hrm012QueryAdapter } from '../data-quality-api';
import type { Hrm012Projection, Hrm012TrustedScope } from '../data-quality-contract';

const ADMITTED = Object.freeze({
  feature: HRM012_FEATURE,
  enabled: true,
  tenantEnrolled: true,
});

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
  state: Hrm012Projection['queryState']['state'] = 'COMPLETE',
  freshness: Hrm012Projection['queryState']['freshness'] = state === 'UNAVAILABLE'
    ? 'UNAVAILABLE'
    : 'CURRENT',
  nextCursor: string | null = null
): Hrm012Projection {
  return hrm012ProjectionWire(state, freshness, nextCursor) as unknown as Hrm012Projection;
}

function adapter(result: Hrm012Projection = projection()): Hrm012QueryAdapter {
  return Object.freeze({
    kind: HRM012_ADAPTER_KIND,
    query: vi.fn<Hrm012QueryAdapter['query']>().mockResolvedValue(result),
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

function renderTree(node: React.ReactNode, mode: 'light' | 'dark' = 'light') {
  window.localStorage.setItem(
    'dwp.appearance.v1',
    JSON.stringify({ mode, density: 'standard', highContrast: false, reduceMotion: false })
  );
  root.render(<DwpThemeProvider>{node}</DwpThemeProvider>);
}

async function renderWorkbench(
  source: Hrm012QueryAdapter,
  props: Partial<React.ComponentProps<typeof Hrm012DataQualityWorkbench>> = {},
  mode: 'light' | 'dark' = 'light'
) {
  host.style.width = `${window.innerWidth}px`;
  host.style.maxWidth = '100%';
  await act(async () => {
    renderTree(
      <Hrm012DataQualityWorkbench
        gate={ADMITTED}
        scope={HRM012_TEST_SCOPE}
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
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('HRM-012 workforce data-quality workbench', () => {
  it('is default OFF before hooks and sends zero owner calls', async () => {
    const source = adapter();
    await act(async () => {
      renderTree(
        <Hrm012DataQualityWorkbench
          gate={HRM012_DEFAULT_GATE}
          scope={HRM012_TEST_SCOPE}
          adapter={source}
        />
      );
    });

    expect(document.querySelector('[data-runtime-state="disabled"]')).not.toBeNull();
    expect(document.querySelector('[data-owner-calls="0"]')).not.toBeNull();
    expect(source.query).not.toHaveBeenCalled();
  });

  it('fails closed with zero calls for an invalid scope or missing exact adapter', async () => {
    const source = adapter();
    await act(async () => {
      renderTree(
        <Hrm012DataQualityWorkbench
          gate={ADMITTED}
          scope={{ ...HRM012_TEST_SCOPE, timeZone: 'Mars/Olympus' }}
          adapter={source}
        />
      );
    });
    expect(document.querySelector('[data-runtime-state="denied"]')).not.toBeNull();
    expect(source.query).not.toHaveBeenCalled();

    await act(async () => {
      renderTree(<Hrm012DataQualityWorkbench gate={ADMITTED} scope={HRM012_TEST_SCOPE} />);
    });
    expect(document.querySelector('[data-runtime-state="unavailable"]')).not.toBeNull();
    expect(source.query).not.toHaveBeenCalled();
  });

  it('renders loading, concealed denial, and unavailable as distinct states', async () => {
    const pending = deferred<Hrm012Projection>();
    const loadingAdapter: Hrm012QueryAdapter = Object.freeze({
      kind: HRM012_ADAPTER_KIND,
      query: vi.fn().mockReturnValue(pending.promise),
    });
    await renderWorkbench(loadingAdapter);
    expect(document.querySelector('[data-runtime-state="loading"]')).not.toBeNull();
    pending.resolve(projection());
    await shown('Workforce data quality');

    const deniedAdapter: Hrm012QueryAdapter = Object.freeze({
      kind: HRM012_ADAPTER_KIND,
      query: vi.fn().mockRejectedValue(new HttpError('concealed', 403)),
    });
    await renderWorkbench(deniedAdapter);
    await shown('This data-quality surface is unavailable');
    expect(document.querySelector('[data-runtime-state="denied"]')).not.toBeNull();

    const unavailableAdapter: Hrm012QueryAdapter = Object.freeze({
      kind: HRM012_ADAPTER_KIND,
      query: vi.fn().mockRejectedValue(new Error('owner unavailable')),
    });
    await renderWorkbench(unavailableAdapter);
    await shown('Workforce data quality is unavailable');
    expect(document.querySelector('[data-runtime-state="unavailable"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Replay');
  });

  it.each([
    ['EMPTY', 'CURRENT', 'No workforce data-quality items', 'empty'],
    ['PARTIAL', 'CURRENT', 'Some quality evidence is unavailable', 'partial'],
    ['UNAVAILABLE', 'UNAVAILABLE', 'Workforce data quality is unavailable', 'unavailable'],
  ] as const)('renders %s safely', async (state, freshness, text, runtimeState) => {
    await renderWorkbench(adapter(projection(state, freshness)));
    await shown(text);
    expect(document.querySelector(`[data-runtime-state="${runtimeState}"]`)).not.toBeNull();
  });

  it('retains a verified projection as stale only after a retryable read refresh failure', async () => {
    const source: Hrm012QueryAdapter = Object.freeze({
      kind: HRM012_ADAPTER_KIND,
      query: vi
        .fn<Hrm012QueryAdapter['query']>()
        .mockResolvedValueOnce(projection())
        .mockRejectedValueOnce(new HttpTransportError('NETWORK', 'offline')),
    });
    await renderWorkbench(source);
    await shown('October workforce ingestion');

    const refresh = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Refresh workforce data quality"]'
    );
    expect(refresh).not.toBeNull();
    await act(async () => refresh!.click());
    await shown('The disclosed data is not current');
    expect(document.querySelector('[data-runtime-state="stale"]')).not.toBeNull();
    expect(document.body.textContent).toContain('October workforce ingestion');
    expect(source.query).toHaveBeenCalledTimes(2);
  });

  it('renders MASK safely and keeps OMIT groups entirely absent from the selected inspector', async () => {
    installEnvironment({ width: 320, forcedColors: true, reducedMotion: true });
    const omitted = hrm012OmittedProjectionWire() as unknown as Hrm012Projection;
    await renderWorkbench(adapter(omitted), {}, 'dark');
    await shown('October workforce ingestion');

    const row = [...document.querySelectorAll('button')].find((candidate) =>
      candidate.textContent?.includes('October workforce ingestion')
    );
    expect(row).toBeInstanceOf(HTMLButtonElement);
    await act(async () => (row as HTMLButtonElement).click());
    const inspector = document.querySelector('[data-testid="hrm-012-data-quality-inspector"]');
    expect(inspector?.textContent).toContain('Ingestion status');
    expect(inspector?.textContent).not.toContain('Quality finding');
    expect(inspector?.textContent).not.toContain('Command receipt');
    expect(inspector?.textContent).not.toContain('Not disclosed');

    await renderWorkbench(adapter(), {}, 'dark');
    await shown('October workforce ingestion');
    const visibleRow = [...document.querySelectorAll('button')].find((candidate) =>
      candidate.textContent?.includes('October workforce ingestion')
    );
    await act(async () => (visibleRow as HTMLButtonElement).click());
    const maskedInspector = document.querySelector(
      '[data-testid="hrm-012-data-quality-inspector"]'
    );
    expect(maskedInspector?.textContent).toContain('Quality finding');
    expect(maskedInspector?.textContent).toContain('Restricted by field policy');
    expect(maskedInspector?.textContent).not.toContain('FIELD_POLICY');
  });

  it.each([1440, 1280, 390, 320])(
    'keeps the complete command center accessible at %ipx',
    async (width) => {
      installEnvironment({ width, forcedColors: width === 320, reducedMotion: width === 390 });
      if (width === 390) document.documentElement.style.fontSize = '32px';
      await renderWorkbench(adapter(), {}, width === 320 ? 'dark' : 'light');
      await shown('October workforce ingestion');
      const workbench = document.querySelector('[data-testid="hrm-012-data-quality-workbench"]');
      expect(workbench?.getAttribute('data-runtime-state')).toBe('complete');
      expect(workbench?.getAttribute('data-layout-density')).toBe(
        width <= 600 ? 'compact' : 'fluid'
      );
      expect(workbench?.getAttribute('data-forced-colors')).toBe(
        width === 320 ? 'active' : 'inactive'
      );
      expect(workbench?.getAttribute('data-reduced-motion')).toBe(
        width === 390 ? 'active' : 'inactive'
      );
      expect(document.querySelector('h1')?.textContent).toBe('Workforce data quality');
      expect(host.style.maxWidth).toBe('100%');
      expect(document.body.textContent).not.toContain('Replay ingestion');
    }
  );

  it('supports long Korean copy and keyboard-only inspection on the compact layout', async () => {
    installEnvironment({ width: 320 });
    await renderWorkbench(adapter(), {
      scope: { ...HRM012_TEST_SCOPE, locale: 'ko-KR' },
    });
    await shown('인력 데이터 품질');
    expect(document.body.textContent).toContain(
      '제한된 원본 값을 노출하지 않고 인력 수집 실행, 품질 판정 및 명령 영수증 증거를 점검합니다.'
    );
    const row = [...document.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      candidate.textContent?.includes('October workforce ingestion')
    );
    expect(row?.dataset.focusRing).toBe('keyboard-visible');
    await act(async () => row!.focus());
    expect(document.activeElement).toBe(row);
    await act(async () => {
      row!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      row!.click();
      row!.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    });
    expect(row?.getAttribute('aria-pressed')).toBe('true');
    const inspector = document.querySelector('[data-testid="hrm-012-data-quality-inspector"]');
    expect(inspector).not.toBeNull();
    expect(document.activeElement?.closest('[role="dialog"]')).not.toBeNull();
  });

  it('resets cursor, as-of, and prior projection when scope or decision revision changes', async () => {
    const nextPage = projection('COMPLETE', 'CURRENT', HRM012_TEST_CURSOR);
    const secondPage = projection();
    const nextScope: Hrm012TrustedScope = Object.freeze({
      ...HRM012_TEST_SCOPE,
      contextScopeKey: 'target-population:hrm-012:next',
      decisionRevision: 'decision-revision-58',
      correlationId: '33333333-3333-4333-8333-333333333333',
    });
    const nextScopeProjection = {
      ...hrm012ProjectionWire(),
      queryState: {
        ...hrm012ProjectionWire().queryState,
        scopeDecisionRevision: nextScope.decisionRevision,
        correlationId: nextScope.correlationId,
        cachePolicy: {
          ...hrm012ProjectionWire().queryState.cachePolicy,
          authorizationDecisionRevision: nextScope.decisionRevision,
        },
      },
    } as unknown as Hrm012Projection;
    const source: Hrm012QueryAdapter = Object.freeze({
      kind: HRM012_ADAPTER_KIND,
      query: vi
        .fn<Hrm012QueryAdapter['query']>()
        .mockResolvedValueOnce(nextPage)
        .mockResolvedValueOnce(secondPage)
        .mockResolvedValueOnce(nextScopeProjection),
    });

    function Harness({ scope }: Readonly<{ scope: Hrm012TrustedScope }>) {
      const query = useHrm012WorkbenchQuery({ adapter: source, scope });
      return (
        <div>
          <span>{query.projection?.queryState.scopeDecisionRevision ?? 'loading'}</span>
          <button type="button" disabled={!query.canNext} onClick={query.next}>
            Next test page
          </button>
        </div>
      );
    }

    await act(async () => renderTree(<Harness scope={HRM012_TEST_SCOPE} />));
    await shown(HRM012_TEST_SCOPE.decisionRevision);
    const next = [...document.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'Next test page'
    )!;
    await act(async () => next.click());
    await act(async () => {
      await vi.waitFor(() => expect(source.query).toHaveBeenCalledTimes(2));
    });
    const secondRequest = vi.mocked(source.query).mock.calls[1]![0];
    expect(secondRequest.cursor).toBe(HRM012_TEST_CURSOR);
    expect(secondRequest.asOf).toBe(nextPage.asOf);

    await act(async () => renderTree(<Harness scope={nextScope} />));
    await shown(nextScope.decisionRevision);
    expect(source.query).toHaveBeenCalledTimes(3);
    const resetRequest = vi.mocked(source.query).mock.calls[2]![0];
    expect(resetRequest.cursor).toBeNull();
    expect(resetRequest.asOf).toBeNull();
    expect(resetRequest.correlationId).toBe(nextScope.correlationId);
    expect(vi.mocked(source.query).mock.calls[2]![1]).toBe(nextScope.contextScopeKey);
  });
});
