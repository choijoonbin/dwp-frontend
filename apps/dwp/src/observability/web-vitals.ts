import { onCLS, onINP, onLCP } from 'web-vitals';
import { sessionNeutralHttp } from '@dwp-frontend/shared-utils/axios-instance';
import type { components } from '@dwp-frontend/api-contracts';

import { classifyRouteGroup } from './route-performance';

import type { Metric } from 'web-vitals';

type DwpWebVital = components['schemas']['platform_WebVitalRequest'];

declare global {
  interface Window {
    __dwpWebVitalsRegistered?: boolean;
  }
}

function configuredCollectorEndpoint(): string | null {
  const configured = import.meta.env.VITE_WEB_VITALS_ENDPOINT?.trim();
  if (!configured) return null;

  try {
    const endpoint = new URL(configured, window.location.origin);
    if (
      endpoint.origin !== window.location.origin ||
      endpoint.username ||
      endpoint.password ||
      endpoint.hash
    ) {
      return null;
    }
    return endpoint.pathname + endpoint.search;
  } catch {
    return null;
  }
}

function sendToCollector(payload: DwpWebVital): void {
  const endpoint = configuredCollectorEndpoint();
  if (!endpoint) return;

  void sessionNeutralHttp
    .post(endpoint, payload, { keepalive: true, timeoutMs: 2_000 })
    .catch(() => {
      // Real-user monitoring is best-effort and cannot participate in application control flow.
    });
}

function reportMetric(metric: Metric) {
  if (metric.name !== 'CLS' && metric.name !== 'INP' && metric.name !== 'LCP') return;
  const payload: DwpWebVital = {
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    id: metric.id,
    rating: metric.rating,
    navigationType: metric.navigationType,
    routeGroup: classifyRouteGroup(window.location.pathname),
  };

  window.dispatchEvent(new CustomEvent<DwpWebVital>('dwp:web-vital', { detail: payload }));
  sendToCollector(payload);
}

export function registerWebVitals() {
  if (window.__dwpWebVitalsRegistered) return;
  window.__dwpWebVitalsRegistered = true;
  onCLS(reportMetric);
  onINP(reportMetric);
  onLCP(reportMetric);
}
