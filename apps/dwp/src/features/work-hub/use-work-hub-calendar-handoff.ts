import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
  workCalendarOwnerFingerprint,
  type WorkCalendarEventHandoffState,
} from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';
import {
  clearWorkCalendarDocumentHandoff,
  persistWorkCalendarDocumentHandoff,
} from '@dwp-frontend/shared-utils/api/work-calendar-document-handoff';

import type { WorkHubItem } from './work-hub-contracts';
import {
  workHubCalendarComposerRoute,
  workHubCalendarRoute,
  type WorkHubOperationFeedback,
} from './work-hub-page-helpers';
import type { WorkScheduleDraftInput } from './work-hub-scheduling';

type WorkCalendarDocumentBoundary = Readonly<{
  assign: (target: string) => void;
  clear: (handoffId?: string) => void;
  persist: (state: WorkCalendarEventHandoffState, now: number) => boolean;
}>;

const browserWorkCalendarDocumentBoundary: WorkCalendarDocumentBoundary = {
  assign: (target) => window.location.assign(target),
  clear: clearWorkCalendarDocumentHandoff,
  persist: persistWorkCalendarDocumentHandoff,
};

function isCalendarScheduleDocumentTarget(target: string, composer: boolean): boolean {
  try {
    const url = new URL(target, 'https://dwp.internal');
    const keys = [...url.searchParams.keys()];
    const allowedKeys = composer ? ['date', 'create'] : ['date'];
    return (
      target === `${url.pathname}${url.search}` &&
      url.origin === 'https://dwp.internal' &&
      url.pathname === '/calendar/schedule' &&
      !url.hash &&
      keys.length === allowedKeys.length &&
      keys.every((key) => allowedKeys.includes(key)) &&
      /^\d{4}-\d{2}-\d{2}$/u.test(url.searchParams.get('date') ?? '') &&
      (!composer || url.searchParams.get('create') === 'focus')
    );
  } catch {
    return false;
  }
}

/** Calendar is a separately deployable product, so even a plain open crosses a document boundary. */
export function openWorkCalendarDocument(
  target: string,
  assign: (target: string) => void = browserWorkCalendarDocumentBoundary.assign
): boolean {
  if (!isCalendarScheduleDocumentTarget(target, false)) return false;
  try {
    assign(target);
    return true;
  } catch {
    return false;
  }
}

/** Persists the private draft before leaving Work and erases it if navigation cannot start. */
export function openWorkCalendarComposerDocument(
  navigation: Readonly<{ to: string; state: WorkCalendarEventHandoffState }>,
  now: number,
  boundary: WorkCalendarDocumentBoundary = browserWorkCalendarDocumentBoundary
): boolean {
  if (!isCalendarScheduleDocumentTarget(navigation.to, true)) return false;
  const handoffId = navigation.state.workCalendarEventHandoff.handoffId;
  if (!boundary.persist(navigation.state, now)) return false;
  try {
    boundary.assign(navigation.to);
    return true;
  } catch {
    boundary.clear(handoffId);
    return false;
  }
}

export function useWorkHubCalendarHandoff({
  owner,
  date,
  now,
  onFeedback,
}: {
  owner: string | null;
  date: string;
  now: number;
  onFeedback: (feedback: WorkHubOperationFeedback) => void;
}) {
  const { t } = useTranslation('work');
  const location = useLocation();
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const unavailable = useCallback(
    () =>
      onFeedback({
        severity: 'error',
        title: t('workHub.results.UNAVAILABLE.title'),
        detail: t('workHub.results.UNAVAILABLE.detail'),
      }),
    [onFeedback, t]
  );
  const openCalendar = useCallback(() => {
    if (!openWorkCalendarDocument(workHubCalendarRoute(date))) unavailable();
  }, [date, unavailable]);
  const continueWorkInCalendar = useCallback(
    async (item: WorkHubItem, draft: WorkScheduleDraftInput) => {
      const submittedOwner = owner;
      if (!submittedOwner) return;
      try {
        const ownerFingerprint = await workCalendarOwnerFingerprint(submittedOwner);
        if (ownerRef.current !== submittedOwner) return;
        const navigation = workHubCalendarComposerRoute(
          date,
          returnTo,
          item,
          draft,
          ownerFingerprint,
          new Date(now)
        );
        if (ownerRef.current !== submittedOwner) return;
        if (!openWorkCalendarComposerDocument(navigation, now)) unavailable();
      } catch {
        unavailable();
      }
    },
    [date, now, owner, returnTo, unavailable]
  );
  return { continueWorkInCalendar, openCalendar };
}
