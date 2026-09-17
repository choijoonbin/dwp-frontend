import { formatDate } from '@dwp-frontend/shared-i18n';

export function commandIdentity(deviceId: string, kind: string) {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `workplace:device:${deviceId}:${kind}:${suffix}`;
}

export function displayTime(value: string | null, locale: 'ko' | 'en') {
  if (!value) return '—';
  return formatDate(
    value,
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
    locale
  );
}

export function stateColor(state: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (['ONLINE', 'FRESH', 'BOUND', 'HEALTHY', 'SUCCEEDED'].includes(state)) return 'success';
  if (['OFFLINE', 'STALE', 'FAILED', 'SUSPENDED'].includes(state)) return 'error';
  if (
    ['PENDING', 'APPROVED', 'CONFIGURED_UNVERIFIED', 'DEGRADED', 'RESULT_UNKNOWN'].includes(state)
  ) {
    return 'warning';
  }
  if (['ACCEPTED', 'RUNNING'].includes(state)) return 'info';
  return 'default';
}

export function stateChipSx(state: string, filled = true) {
  const tone = stateColor(state);
  const color =
    tone === 'success'
      ? '#1b5e20'
      : tone === 'warning'
        ? '#754000'
        : tone === 'error'
          ? '#9b1515'
          : tone === 'info'
            ? '#0d47a1'
            : '#424242';
  return filled
    ? {
        bgcolor: color,
        borderColor: color,
        color: '#ffffff',
        '& .MuiChip-icon': { color: '#ffffff' },
      }
    : {
        bgcolor: 'transparent',
        borderColor: color,
        color,
        '& .MuiChip-icon': { color },
      };
}
