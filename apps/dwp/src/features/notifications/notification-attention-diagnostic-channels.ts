import type {
  NotificationCapabilities,
  NotificationChannel,
  NotificationDeliveryEndpoint,
  NotificationEffectiveSettings,
} from '@dwp-frontend/shared-utils/api/notification-api';

export const ATTENTION_DIAGNOSTIC_CHANNELS = [
  'IN_APP',
  'WEB_PUSH',
  'MOBILE_PUSH',
] as const satisfies readonly NotificationChannel[];

export type NotificationDiagnosticSourceState = 'LOADING' | 'READY' | 'ERROR' | 'FORBIDDEN';

export type NotificationDiagnosticChannelAvailability =
  | 'AVAILABLE'
  | 'CHECKING'
  | 'DISABLED'
  | 'UNAVAILABLE'
  | 'PERMISSION_DENIED'
  | 'EXPIRED'
  | 'OFFLINE';

export type NotificationDiagnosticChannelReason =
  | 'OFFLINE'
  | 'CHECKING'
  | 'CAPABILITY_DISABLED'
  | 'PROVIDER_DISABLED'
  | 'POLICY_DISABLED'
  | 'NO_ENDPOINT'
  | 'ENDPOINT_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'SOURCE_UNAVAILABLE';

export type NotificationDiagnosticChannelOption = {
  channel: (typeof ATTENTION_DIAGNOSTIC_CHANNELS)[number];
  availability: NotificationDiagnosticChannelAvailability;
  reason?: NotificationDiagnosticChannelReason;
  endpointLabels: readonly string[];
};

type ResolveDiagnosticChannelsInput = {
  online: boolean;
  capabilities?: NotificationCapabilities;
  effectiveSettings?: NotificationEffectiveSettings;
  endpoints?: readonly NotificationDeliveryEndpoint[];
  capabilitiesState: NotificationDiagnosticSourceState;
  settingsState: NotificationDiagnosticSourceState;
  endpointsState: NotificationDiagnosticSourceState;
};

function unresolved(
  channel: NotificationDiagnosticChannelOption['channel'],
  state: NotificationDiagnosticSourceState
): NotificationDiagnosticChannelOption | null {
  if (state === 'READY') return null;
  if (state === 'LOADING') {
    return { channel, availability: 'CHECKING', reason: 'CHECKING', endpointLabels: [] };
  }
  if (state === 'FORBIDDEN') {
    return {
      channel,
      availability: 'PERMISSION_DENIED',
      reason: 'PERMISSION_DENIED',
      endpointLabels: [],
    };
  }
  return {
    channel,
    availability: 'UNAVAILABLE',
    reason: 'SOURCE_UNAVAILABLE',
    endpointLabels: [],
  };
}

function policyAllows(
  settings: NotificationEffectiveSettings,
  channel: NotificationDiagnosticChannelOption['channel']
): boolean {
  return settings.globalChannels[channel]?.effectiveValue === true;
}

function externalEndpointState(
  channel: Extract<NotificationDiagnosticChannelOption['channel'], 'WEB_PUSH' | 'MOBILE_PUSH'>,
  endpoints: readonly NotificationDeliveryEndpoint[]
): Pick<NotificationDiagnosticChannelOption, 'availability' | 'reason' | 'endpointLabels'> {
  const matching = endpoints.filter((endpoint) => endpoint.channel === channel);
  const active = matching
    .filter((endpoint) => endpoint.state === 'ACTIVE')
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
  if (active.length > 0) {
    return {
      availability: 'AVAILABLE',
      endpointLabels: active.map((endpoint) => endpoint.displayName),
    };
  }
  if (matching.some((endpoint) => endpoint.state === 'EXPIRED')) {
    return {
      availability: 'EXPIRED',
      reason: 'ENDPOINT_EXPIRED',
      endpointLabels: [],
    };
  }
  return { availability: 'UNAVAILABLE', reason: 'NO_ENDPOINT', endpointLabels: [] };
}

export function resolveNotificationDiagnosticChannels({
  online,
  capabilities,
  effectiveSettings,
  endpoints = [],
  capabilitiesState,
  settingsState,
  endpointsState,
}: ResolveDiagnosticChannelsInput): NotificationDiagnosticChannelOption[] {
  return ATTENTION_DIAGNOSTIC_CHANNELS.map((channel) => {
    if (!online) {
      return { channel, availability: 'OFFLINE', reason: 'OFFLINE', endpointLabels: [] };
    }
    const capabilityUnknown = unresolved(channel, capabilitiesState);
    if (capabilityUnknown) return capabilityUnknown;
    const settingsUnknown = unresolved(channel, settingsState);
    if (settingsUnknown) return settingsUnknown;
    if (!capabilities || !effectiveSettings) {
      return {
        channel,
        availability: 'UNAVAILABLE',
        reason: 'SOURCE_UNAVAILABLE',
        endpointLabels: [],
      };
    }
    if (channel !== 'IN_APP' && capabilities.externalDeliveryState !== 'ENABLED') {
      return {
        channel,
        availability: 'DISABLED',
        reason: 'PROVIDER_DISABLED',
        endpointLabels: [],
      };
    }
    if (capabilities.unavailableChannels.includes(channel)) {
      return {
        channel,
        availability: 'UNAVAILABLE',
        reason: 'CAPABILITY_DISABLED',
        endpointLabels: [],
      };
    }
    if (!capabilities.enabledChannels.includes(channel)) {
      return {
        channel,
        availability: 'DISABLED',
        reason: 'CAPABILITY_DISABLED',
        endpointLabels: [],
      };
    }
    if (!policyAllows(effectiveSettings, channel)) {
      return {
        channel,
        availability: 'DISABLED',
        reason: 'POLICY_DISABLED',
        endpointLabels: [],
      };
    }
    if (channel === 'IN_APP') {
      return { channel, availability: 'AVAILABLE', endpointLabels: [] };
    }
    const endpointsUnknown = unresolved(channel, endpointsState);
    if (endpointsUnknown) return endpointsUnknown;
    return { channel, ...externalEndpointState(channel, endpoints) };
  });
}

export function selectableDiagnosticChannels(
  options: readonly NotificationDiagnosticChannelOption[]
): NotificationChannel[] {
  return options
    .filter((option) => option.availability === 'AVAILABLE')
    .map((option) => option.channel);
}
