import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionNeutralHttp } from '@dwp-frontend/shared-utils/axios-instance';

import type { Metric } from 'web-vitals';

const metricCallbacks = vi.hoisted(() => ({
  CLS: undefined as ((metric: Metric) => void) | undefined,
  INP: undefined as ((metric: Metric) => void) | undefined,
  LCP: undefined as ((metric: Metric) => void) | undefined,
}));

vi.mock('web-vitals', () => ({
  onCLS: vi.fn((callback: (metric: Metric) => void) => {
    metricCallbacks.CLS = callback;
  }),
  onINP: vi.fn((callback: (metric: Metric) => void) => {
    metricCallbacks.INP = callback;
  }),
  onLCP: vi.fn((callback: (metric: Metric) => void) => {
    metricCallbacks.LCP = callback;
  }),
}));

import { registerWebVitals, setHomeWebVitalsContext } from './web-vitals';

const lcpMetric = {
  name: 'LCP',
  value: 1_250,
  delta: 1_250,
  id: 'vital-lcp-1',
  rating: 'good',
  navigationType: 'navigate',
} as Metric;

function installBrowserGlobals() {
  const dispatchEvent = vi.fn();
  vi.stubGlobal('window', {
    location: {
      origin: 'http://localhost:4200',
      pathname: '/sign-in',
    },
    dispatchEvent,
  });
  vi.stubGlobal(
    'CustomEvent',
    class<T> {
      readonly type: string;
      readonly detail: T | undefined;

      constructor(type: string, init?: CustomEventInit<T>) {
        this.type = type;
        this.detail = init?.detail;
      }
    }
  );
  return dispatchEvent;
}

describe('Web Vitals collection boundary', () => {
  beforeEach(() => {
    metricCallbacks.CLS = undefined;
    metricCallbacks.INP = undefined;
    metricCallbacks.LCP = undefined;
  });

  afterEach(() => {
    setHomeWebVitalsContext(null);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('adds bounded Home rollout context and preserves each metric base unit', () => {
    const dispatchEvent = installBrowserGlobals();
    window.location.pathname = '/';
    vi.stubEnv('VITE_WEB_VITALS_ENDPOINT', '');
    setHomeWebVitalsContext({
      deviceClass: 'MOBILE_STANDARD',
      homeMode: 'FLOW_V1',
      homeRuntime: 'SHADOW_COMPARE',
      rolloutRing: 'CONTROL',
    });

    registerWebVitals();
    metricCallbacks.CLS?.({ ...lcpMetric, name: 'CLS', value: 0.125, delta: 0.125 } as Metric);
    metricCallbacks.INP?.({ ...lcpMetric, name: 'INP', value: 180, delta: 180 } as Metric);
    metricCallbacks.LCP?.(lcpMetric);

    const details = dispatchEvent.mock.calls.map((call) => call[0].detail);
    expect(details.map((detail) => [detail.name, detail.value])).toEqual([
      ['CLS', 0.125],
      ['INP', 180],
      ['LCP', 1_250],
    ]);
    expect(details[0]).toMatchObject({
      routeGroup: 'home',
      homeMode: 'FLOW_V1',
      homeRuntime: 'SHADOW_COMPARE',
      rolloutRing: 'CONTROL',
      deviceClass: 'MOBILE_STANDARD',
    });
    expect(JSON.stringify(details)).not.toContain('rolloutRevision');
  });

  it('drops malformed Home context and never attaches it outside Home', () => {
    const dispatchEvent = installBrowserGlobals();
    vi.stubEnv('VITE_WEB_VITALS_ENDPOINT', '');
    setHomeWebVitalsContext({
      deviceClass: 'DESKTOP_STANDARD',
      homeMode: 'CLASSIC',
      homeRuntime: 'READ_ONLY_ACTIVE',
      rolloutRing: 'INTERNAL',
      tenantId: 42,
    } as unknown as Parameters<typeof setHomeWebVitalsContext>[0]);
    registerWebVitals();
    metricCallbacks.LCP?.(lcpMetric);
    expect(dispatchEvent.mock.calls[0]?.[0].detail).not.toHaveProperty('homeMode');

    setHomeWebVitalsContext({
      deviceClass: 'DESKTOP_STANDARD',
      homeMode: 'CLASSIC',
      homeRuntime: 'READ_ONLY_ACTIVE',
      rolloutRing: 'INTERNAL',
    });
    metricCallbacks.LCP?.(lcpMetric);
    expect(dispatchEvent.mock.calls[1]?.[0].detail).not.toHaveProperty('homeRuntime');
  });

  it('drops a Home sample until a complete trusted rollout context exists', () => {
    const dispatchEvent = installBrowserGlobals();
    window.location.pathname = '/';
    const post = vi.spyOn(sessionNeutralHttp, 'post').mockResolvedValue({ data: undefined });
    vi.stubEnv('VITE_WEB_VITALS_ENDPOINT', '/api/platform/v1/observability/web-vitals');

    registerWebVitals();
    metricCallbacks.LCP?.(lcpMetric);

    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('emits the browser event without network traffic when no collector is configured', () => {
    const dispatchEvent = installBrowserGlobals();
    const post = vi.spyOn(sessionNeutralHttp, 'post').mockResolvedValue({ data: undefined });
    vi.stubEnv('VITE_WEB_VITALS_ENDPOINT', '');

    registerWebVitals();
    metricCallbacks.LCP?.(lcpMetric);

    expect(post).not.toHaveBeenCalled();
    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0]?.[0]).toMatchObject({
      type: 'dwp:web-vital',
      detail: {
        name: 'LCP',
        value: 1_250,
        routeGroup: 'authentication',
      },
    });
  });

  it('uses the session-neutral transport for a configured same-origin collector', async () => {
    installBrowserGlobals();
    const post = vi.spyOn(sessionNeutralHttp, 'post').mockRejectedValue(new Error('unauthorized'));
    vi.stubEnv(
      'VITE_WEB_VITALS_ENDPOINT',
      'http://localhost:4200/api/platform/v1/observability/web-vitals'
    );

    registerWebVitals();
    metricCallbacks.LCP?.(lcpMetric);
    await Promise.resolve();

    expect(post).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith(
      '/api/platform/v1/observability/web-vitals',
      {
        name: 'LCP',
        value: 1_250,
        delta: 1_250,
        id: 'vital-lcp-1',
        rating: 'good',
        navigationType: 'navigate',
        routeGroup: 'authentication',
      },
      { keepalive: true, timeoutMs: 2_000 }
    );
  });

  it.each([
    ['cross-origin', 'https://collector.example.test/web-vitals'],
    ['credential-bearing', 'http://actor:secret@localhost:4200/web-vitals'],
    ['fragment-bearing', '/web-vitals#unexpected'],
    ['malformed', 'http://['],
  ])('rejects a %s collector configuration', (_case, configuredEndpoint) => {
    installBrowserGlobals();
    const post = vi.spyOn(sessionNeutralHttp, 'post').mockResolvedValue({ data: undefined });
    vi.stubEnv('VITE_WEB_VITALS_ENDPOINT', configuredEndpoint);

    registerWebVitals();
    metricCallbacks.LCP?.(lcpMetric);

    expect(post).not.toHaveBeenCalled();
  });

  it('contains network rejection inside the telemetry boundary', async () => {
    installBrowserGlobals();
    const post = vi
      .spyOn(sessionNeutralHttp, 'post')
      .mockRejectedValue(new Error('collector unavailable'));
    vi.stubEnv('VITE_WEB_VITALS_ENDPOINT', '/rum/web-vitals');

    registerWebVitals();
    expect(() => metricCallbacks.LCP?.(lcpMetric)).not.toThrow();
    await Promise.resolve();

    expect(post).toHaveBeenCalledOnce();
  });
});
