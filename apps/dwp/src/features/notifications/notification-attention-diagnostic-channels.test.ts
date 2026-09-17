import { describe, expect, it } from 'vitest';

import {
  resolveNotificationDiagnosticChannels,
  selectableDiagnosticChannels,
} from './notification-attention-diagnostic-channels';

import type {
  NotificationCapabilities,
  NotificationDeliveryEndpoint,
  NotificationEffectiveSettings,
} from '@dwp-frontend/shared-utils/api/notification-api';

const capabilities: NotificationCapabilities = {
  enabledChannels: ['IN_APP', 'WEB_PUSH', 'MOBILE_PUSH'],
  unavailableChannels: [],
  canonicalStore: 'POSTGRESQL',
  realtimeTransport: 'SSE_HINT_WITH_DURABLE_SYNC',
  externalDeliveryState: 'ENABLED',
  generatedAt: '2026-09-17T00:00:00Z',
};

const effectiveSettings: NotificationEffectiveSettings = {
  partial: false,
  unavailableSources: [],
  message: null,
  globalChannels: {
    IN_APP: {
      effectiveValue: true,
      source: 'SYSTEM_DEFAULT',
      managed: false,
      exceptionAllowed: true,
    },
    WEB_PUSH: { effectiveValue: true, source: 'USER', managed: false, exceptionAllowed: true },
    MOBILE_PUSH: { effectiveValue: true, source: 'USER', managed: false, exceptionAllowed: true },
  },
  apps: [],
  generatedAt: '2026-09-17T00:00:00Z',
};

const endpoints: NotificationDeliveryEndpoint[] = [
  {
    endpointId: 'web-b',
    channel: 'WEB_PUSH',
    displayName: 'Work Chrome',
    platform: 'WEB',
    endpointHint: 'Chrome',
    state: 'ACTIVE',
    lastSeenAt: '2026-09-17T00:00:00Z',
    createdAt: '2026-09-16T00:00:00Z',
    version: '1',
  },
  {
    endpointId: 'web-a',
    channel: 'WEB_PUSH',
    displayName: 'Desk Edge',
    platform: 'WEB',
    endpointHint: 'Edge',
    state: 'ACTIVE',
    lastSeenAt: '2026-09-17T00:00:00Z',
    createdAt: '2026-09-16T00:00:00Z',
    version: '1',
  },
  {
    endpointId: 'mobile-expired',
    channel: 'MOBILE_PUSH',
    displayName: 'Old phone',
    platform: 'IOS',
    endpointHint: 'iOS',
    state: 'EXPIRED',
    lastSeenAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-08-01T00:00:00Z',
    version: '2',
  },
];

const ready = {
  capabilitiesState: 'READY' as const,
  settingsState: 'READY' as const,
  endpointsState: 'READY' as const,
};

describe('notification attention diagnostic channels', () => {
  it('only exposes policy-enabled channels with active endpoint evidence', () => {
    const result = resolveNotificationDiagnosticChannels({
      online: true,
      capabilities,
      effectiveSettings,
      endpoints,
      ...ready,
    });

    expect(result).toEqual([
      { channel: 'IN_APP', availability: 'AVAILABLE', endpointLabels: [] },
      {
        channel: 'WEB_PUSH',
        availability: 'AVAILABLE',
        endpointLabels: ['Desk Edge', 'Work Chrome'],
      },
      {
        channel: 'MOBILE_PUSH',
        availability: 'EXPIRED',
        reason: 'ENDPOINT_EXPIRED',
        endpointLabels: [],
      },
    ]);
    expect(selectableDiagnosticChannels(result)).toEqual(['IN_APP', 'WEB_PUSH']);
  });

  it('reports unapproved external providers instead of implying successful delivery', () => {
    const result = resolveNotificationDiagnosticChannels({
      online: true,
      capabilities: { ...capabilities, externalDeliveryState: 'DISABLED' },
      effectiveSettings,
      endpoints,
      ...ready,
    });

    expect(result.find((item) => item.channel === 'WEB_PUSH')).toMatchObject({
      availability: 'DISABLED',
      reason: 'PROVIDER_DISABLED',
    });
    expect(result.find((item) => item.channel === 'MOBILE_PUSH')).toMatchObject({
      availability: 'DISABLED',
      reason: 'PROVIDER_DISABLED',
    });
  });

  it('fails closed for policy denial, permission denial, and offline state', () => {
    const policyResult = resolveNotificationDiagnosticChannels({
      online: true,
      capabilities,
      effectiveSettings: {
        ...effectiveSettings,
        globalChannels: {
          ...effectiveSettings.globalChannels,
          WEB_PUSH: {
            effectiveValue: false,
            source: 'TENANT_POLICY',
            managed: true,
            exceptionAllowed: false,
          },
        },
      },
      endpoints,
      ...ready,
    });
    expect(policyResult.find((item) => item.channel === 'WEB_PUSH')).toMatchObject({
      availability: 'DISABLED',
      reason: 'POLICY_DISABLED',
    });

    const forbidden = resolveNotificationDiagnosticChannels({
      online: true,
      capabilities,
      effectiveSettings,
      endpoints,
      ...ready,
      endpointsState: 'FORBIDDEN',
    });
    expect(forbidden.find((item) => item.channel === 'WEB_PUSH')).toMatchObject({
      availability: 'PERMISSION_DENIED',
      reason: 'PERMISSION_DENIED',
    });

    const offline = resolveNotificationDiagnosticChannels({
      online: false,
      capabilities,
      effectiveSettings,
      endpoints,
      ...ready,
    });
    expect(offline.every((item) => item.availability === 'OFFLINE')).toBe(true);
    expect(selectableDiagnosticChannels(offline)).toEqual([]);
  });

  it('distinguishes infrastructure unavailability from a missing active endpoint', () => {
    const unavailable = resolveNotificationDiagnosticChannels({
      online: true,
      capabilities: {
        ...capabilities,
        unavailableChannels: ['WEB_PUSH'],
      },
      effectiveSettings,
      endpoints,
      ...ready,
    });
    expect(unavailable.find((item) => item.channel === 'WEB_PUSH')).toMatchObject({
      availability: 'UNAVAILABLE',
      reason: 'CAPABILITY_DISABLED',
    });

    const missingEndpoint = resolveNotificationDiagnosticChannels({
      online: true,
      capabilities,
      effectiveSettings,
      endpoints: [],
      ...ready,
    });
    expect(missingEndpoint.find((item) => item.channel === 'WEB_PUSH')).toMatchObject({
      availability: 'UNAVAILABLE',
      reason: 'NO_ENDPOINT',
    });

    const unavailableSource = resolveNotificationDiagnosticChannels({
      online: true,
      capabilities,
      effectiveSettings,
      endpoints,
      ...ready,
      capabilitiesState: 'ERROR',
    });
    expect(unavailableSource.every((item) => item.availability === 'UNAVAILABLE')).toBe(true);
    expect(unavailableSource.every((item) => item.reason === 'SOURCE_UNAVAILABLE')).toBe(true);
  });
});
