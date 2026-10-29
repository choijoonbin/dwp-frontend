import { useEffect, useState } from 'react';
import type { MailAccountReadinessEvidence } from '@dwp-frontend/shared-utils';

import { MAIL_ACCOUNT_READINESS_EVIDENCE_MAX_AGE_MS } from './mail-account-capability-presentation';

const MAXIMUM_TIMER_DELAY_MS = 2_147_483_647;

function instant(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mailReadinessInvalidationAt(
  readinessValues: readonly (MailAccountReadinessEvidence | null | undefined)[],
  now = Date.now()
) {
  const deadlines: number[] = [];
  const addObservation = (value: string | null | undefined) => {
    const observedAt = instant(value);
    if (observedAt === null) return;
    const deadline = observedAt + MAIL_ACCOUNT_READINESS_EVIDENCE_MAX_AGE_MS + 1;
    if (Number.isFinite(deadline)) deadlines.push(deadline);
  };
  const addExpiry = (value: string | null | undefined) => {
    const expiresAt = instant(value);
    if (expiresAt !== null) deadlines.push(expiresAt);
  };

  for (const readiness of readinessValues) {
    if (!readiness) continue;
    addObservation(readiness.observedAt);
    for (const evidence of [readiness.consentEvidence, readiness.tokenEvidence]) {
      if (!evidence) continue;
      addObservation(evidence.observedAt);
      addExpiry(evidence.expiresAt);
    }
    for (const evidence of Object.values(readiness.featureReadiness ?? {})) {
      addObservation(evidence?.observedAt);
    }
  }

  const futureDeadlines = deadlines.filter((deadline) => deadline > now);
  return futureDeadlines.length ? Math.min(...futureDeadlines) : null;
}

export function useMailReadinessNow(invalidationAt: number | null) {
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof globalThis.setTimeout> | null = null;
    const updateClock = () => setClockNow(Date.now());
    const scheduleInvalidation = () => {
      if (invalidationAt === null || !Number.isFinite(invalidationAt)) return;
      const remaining = invalidationAt - Date.now();
      if (remaining <= 0) {
        updateClock();
        return;
      }
      timer = globalThis.setTimeout(
        () => {
          updateClock();
          if (Date.now() < invalidationAt) scheduleInvalidation();
        },
        Math.min(remaining, MAXIMUM_TIMER_DELAY_MS)
      );
    };
    const updateWhenVisible = () => {
      if (document.visibilityState === 'visible') updateClock();
    };

    scheduleInvalidation();
    window.addEventListener('focus', updateClock);
    document.addEventListener('visibilitychange', updateWhenVisible);
    return () => {
      if (timer !== null) globalThis.clearTimeout(timer);
      window.removeEventListener('focus', updateClock);
      document.removeEventListener('visibilitychange', updateWhenVisible);
    };
  }, [invalidationAt]);

  return Math.max(clockNow, Date.now());
}
