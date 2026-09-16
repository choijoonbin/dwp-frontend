import { onCLS, onINP, onLCP } from 'web-vitals';
import { sessionNeutralHttp } from '@dwp-frontend/shared-utils/axios-instance';
import type { components } from '@dwp-frontend/api-contracts';

import { classifyRouteGroup } from './route-performance';

import type { Metric } from 'web-vitals';

type DwpWebVital = components['schemas']['platform_WebVitalRequest'];
type HomeWebVitalContext = Readonly<{
  deviceClass: 'DESKTOP_WIDE' | 'DESKTOP_STANDARD' | 'MOBILE_STANDARD' | 'MOBILE_COMPACT';
  homeMode: 'CLASSIC' | 'FLOW_V1';
  homeRuntime: 'SHADOW_COMPARE' | 'READ_ONLY_ACTIVE' | 'COMMAND_CANARY';
  rolloutRing: 'CONTROL' | 'INTERNAL' | 'PILOT' | 'EARLY_ADOPTER' | 'GA';
}>;
type Wave6WebVital = DwpWebVital & Partial<HomeWebVitalContext>;

const HOME_MODES = new Set(['CLASSIC', 'FLOW_V1']);
const HOME_RUNTIMES = new Set(['SHADOW_COMPARE', 'READ_ONLY_ACTIVE', 'COMMAND_CANARY']);
const HOME_RINGS = new Set(['CONTROL', 'INTERNAL', 'PILOT', 'EARLY_ADOPTER', 'GA']);
const HOME_DEVICES = new Set([
  'DESKTOP_WIDE',
  'DESKTOP_STANDARD',
  'MOBILE_STANDARD',
  'MOBILE_COMPACT',
]);
let homeContext: HomeWebVitalContext | null = null;

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

function sendToCollector(payload: Wave6WebVital): void {
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
  const routeGroup = classifyRouteGroup(window.location.pathname);
  if (routeGroup === 'home' && !homeContext) return;
  const payload: Wave6WebVital = {
    name: metric.name,
    // web-vitals reports CLS as a dimensionless score and INP/LCP in milliseconds.
    // Keep the library base unit intact so the server can select the correct histogram.
    value: metric.value,
    delta: metric.delta,
    id: metric.id,
    rating: metric.rating,
    navigationType: metric.navigationType,
    routeGroup,
    ...(routeGroup === 'home' && homeContext ? homeContext : {}),
  };

  window.dispatchEvent(new CustomEvent<Wave6WebVital>('dwp:web-vital', { detail: payload }));
  sendToCollector(payload);
}

export function setHomeWebVitalsContext(value: HomeWebVitalContext | null): void {
  if (value === null) {
    homeContext = null;
    return;
  }
  const exactKeys =
    Object.keys(value).sort().join(',') ===
    ['deviceClass', 'homeMode', 'homeRuntime', 'rolloutRing'].sort().join(',');
  homeContext =
    exactKeys &&
    HOME_MODES.has(value.homeMode) &&
    HOME_RUNTIMES.has(value.homeRuntime) &&
    HOME_RINGS.has(value.rolloutRing) &&
    HOME_DEVICES.has(value.deviceClass)
      ? Object.freeze({ ...value })
      : null;
}

export function registerWebVitals() {
  if (window.__dwpWebVitalsRegistered) return;
  window.__dwpWebVitalsRegistered = true;
  onCLS(reportMetric);
  onINP(reportMetric);
  onLCP(reportMetric);
}
