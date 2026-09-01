import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import { readRegionalPreference } from '@dwp-frontend/shared-utils';

export function resolveHomeTimeZone(): string {
  const preference = readRegionalPreference().timeZone;
  return preference === 'system' ? resolveSystemTimeZone('Asia/Seoul') : preference;
}
