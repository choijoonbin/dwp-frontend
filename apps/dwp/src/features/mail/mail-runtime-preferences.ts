import { useQuery } from '@tanstack/react-query';
import { getMailPreferences } from '@dwp-frontend/shared-utils';

import type { MailPreferences } from '@dwp-frontend/shared-utils';

export const MAIL_PREFERENCES_QUERY_KEY = ['mail', 'preferences'] as const;

export function useMailRuntimePreferences() {
  return useQuery({
    queryKey: MAIL_PREFERENCES_QUERY_KEY,
    queryFn: getMailPreferences,
    staleTime: 30_000,
    retry: 1,
  });
}

export function mailKeyboardShortcutsEnabled(
  preferences: Pick<MailPreferences, 'keyboardShortcuts'> | null | undefined
) {
  return preferences?.keyboardShortcuts === true;
}

export function mailUsesCompactDensity(
  preferences: Pick<MailPreferences, 'density'> | null | undefined
) {
  return preferences?.density === 'COMPACT';
}

export function mailRemoteImageState(
  policy: MailPreferences['remoteImages'] | null | undefined,
  manuallyAllowed: boolean
) {
  const resolvedPolicy = policy ?? 'BLOCK';
  return {
    allowed: resolvedPolicy === 'ALLOW' || (resolvedPolicy === 'ASK' && manuallyAllowed),
    canLoad: resolvedPolicy === 'ASK' && !manuallyAllowed,
    policy: resolvedPolicy,
  } as const;
}
