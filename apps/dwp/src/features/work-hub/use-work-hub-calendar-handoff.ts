import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { workCalendarOwnerFingerprint } from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';

import type { WorkHubItem } from './work-hub-contracts';
import {
  workHubCalendarComposerRoute,
  workHubCalendarRoute,
  type WorkHubOperationFeedback,
} from './work-hub-page-helpers';
import type { WorkScheduleDraftInput } from './work-hub-scheduling';

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
  const navigate = useNavigate();
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const openCalendar = useCallback(
    () => navigate(workHubCalendarRoute(date, returnTo)),
    [date, navigate, returnTo]
  );
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
        navigate(navigation.to, { state: navigation.state });
      } catch {
        onFeedback({
          severity: 'error',
          title: t('workHub.results.UNAVAILABLE.title'),
          detail: t('workHub.results.UNAVAILABLE.detail'),
        });
      }
    },
    [date, navigate, now, onFeedback, owner, returnTo, t]
  );
  return { continueWorkInCalendar, openCalendar };
}
