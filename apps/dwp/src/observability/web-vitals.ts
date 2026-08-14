import { onCLS, onINP, onLCP } from 'web-vitals';
import {
  reportWebVital,
  type WebVitalMetric,
} from '@dwp-frontend/shared-utils/api/observability-api';

import { classifyRouteGroup } from './route-performance';

import type { Metric } from 'web-vitals';

type DwpWebVital = WebVitalMetric;

declare global {
  interface Window {
    __dwpWebVitalsRegistered?: boolean;
  }
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

  void reportWebVital(payload).catch(() => {
    // Telemetry must never block or alter the user workflow.
  });
}

export function registerWebVitals() {
  if (window.__dwpWebVitalsRegistered) return;
  window.__dwpWebVitalsRegistered = true;
  onCLS(reportMetric);
  onINP(reportMetric);
  onLCP(reportMetric);
}
