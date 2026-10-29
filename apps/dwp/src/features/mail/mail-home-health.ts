import type { MailAccount, MailReadinessAction } from '@dwp-frontend/shared-utils';

import {
  mailAccountReadinessIsReady,
  mailReadinessObservationIsCurrent,
} from './mail-account-capability-presentation';

export type MailHomeHealthState =
  'NO_ACCOUNT' | 'BLOCKED_EXTERNAL' | 'ACTION_REQUIRED' | 'PAUSED' | 'STALE' | 'HEALTHY';

export const MAIL_HOME_STALE_AFTER_MS = 30 * 60 * 1_000;

export type MailHomeHealth = Readonly<{
  state: MailHomeHealthState;
  oldestSuccessfulSyncAt: string | null;
  affectedAccountCount: number;
}>;

function requiresExternalActivation(action: MailReadinessAction | null | undefined) {
  return action === 'ACTIVATE_EXTERNALLY';
}

export function mailHomeHealthActionPath(state: MailHomeHealthState, healthyPath: string) {
  return state === 'HEALTHY' ? healthyPath : '/mail/accounts';
}

export function resolveMailHomeHealth(
  accounts: readonly MailAccount[],
  nowMs = Date.now(),
  staleAfterMs = MAIL_HOME_STALE_AFTER_MS
): MailHomeHealth {
  if (!accounts.length) {
    return { state: 'NO_ACCOUNT', oldestSuccessfulSyncAt: null, affectedAccountCount: 0 };
  }

  const externallyBlocked = accounts.filter((account) => {
    const readiness = account.readiness;
    return (
      account.connectionState === 'REAUTHENTICATION_REQUIRED' ||
      requiresExternalActivation(readiness?.action) ||
      requiresExternalActivation(readiness?.consentEvidence?.action) ||
      requiresExternalActivation(readiness?.tokenEvidence?.action)
    );
  });
  const actionRequired = accounts.filter((account) => {
    if (account.connectionState === 'DISCONNECTED') return true;
    const readiness = account.readiness;
    return Boolean(
      readiness &&
      mailReadinessObservationIsCurrent(readiness.observedAt, nowMs) &&
      !mailAccountReadinessIsReady(readiness, nowMs)
    );
  });
  const paused = accounts.filter(
    (account) =>
      account.connectionState === 'SUSPENDED' || account.synchronizationState === 'PAUSED'
  );
  const successfulSyncTimes = accounts
    .map((account) => account.readiness?.lastSuccessfulSyncAt ?? null)
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  const oldestSuccessfulSyncMs = successfulSyncTimes.length
    ? Math.min(...successfulSyncTimes)
    : Number.NaN;
  const oldestSuccessfulSyncAt = Number.isFinite(oldestSuccessfulSyncMs)
    ? new Date(oldestSuccessfulSyncMs).toISOString()
    : null;

  if (externallyBlocked.length) {
    return {
      state: 'BLOCKED_EXTERNAL',
      oldestSuccessfulSyncAt,
      affectedAccountCount: externallyBlocked.length,
    };
  }

  if (actionRequired.length) {
    return {
      state: 'ACTION_REQUIRED',
      oldestSuccessfulSyncAt,
      affectedAccountCount: actionRequired.length,
    };
  }

  if (paused.length) {
    return {
      state: 'PAUSED',
      oldestSuccessfulSyncAt,
      affectedAccountCount: paused.length,
    };
  }

  const stale = accounts.filter((account) => {
    if (account.synchronizationState === 'DEGRADED') return true;
    if (!mailReadinessObservationIsCurrent(account.readiness?.observedAt, nowMs)) return true;
    const syncAt = account.readiness?.lastSuccessfulSyncAt;
    if (!syncAt) return true;
    const syncMs = Date.parse(syncAt);
    return !Number.isFinite(syncMs) || syncMs > nowMs || nowMs - syncMs > staleAfterMs;
  });

  return {
    state: stale.length ? 'STALE' : 'HEALTHY',
    oldestSuccessfulSyncAt,
    affectedAccountCount: stale.length,
  };
}
