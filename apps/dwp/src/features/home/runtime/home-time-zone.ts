import { readRegionalPreference } from '@dwp-frontend/shared-utils';

export function resolveHomeTimeZone(): string {
  const preference = readRegionalPreference().timeZone;
  return preference === 'system'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'
    : preference;
}
