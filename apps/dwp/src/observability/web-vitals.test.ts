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

import { registerWebVitals } from './web-vitals';

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
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
