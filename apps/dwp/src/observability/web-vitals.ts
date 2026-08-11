import { onCLS, onINP, onLCP } from 'web-vitals';

import { classifyRouteGroup } from './route-performance';

import type { Metric } from 'web-vitals';

type DwpWebVital = Pick<Metric, 'name' | 'value' | 'delta' | 'id' | 'rating' | 'navigationType'> & {
  routeGroup: string;
};

declare global {
  interface Window {
    __dwpWebVitalsRegistered?: boolean;
  }
}

function reportMetric(metric: Metric) {
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

  const endpoint = import.meta.env.VITE_WEB_VITALS_ENDPOINT?.trim();
  if (!endpoint) return;
  const body = JSON.stringify(payload);
  navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'application/json' }));
}

export function registerWebVitals() {
  if (window.__dwpWebVitalsRegistered) return;
  window.__dwpWebVitalsRegistered = true;
  onCLS(reportMetric);
  onINP(reportMetric);
  onLCP(reportMetric);
}
