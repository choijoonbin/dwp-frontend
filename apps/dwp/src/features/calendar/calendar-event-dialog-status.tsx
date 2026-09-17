import { useTranslation } from 'react-i18next';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';

export type CalendarEventSaveFailureKind = 'AUTHORITY_REVOKED' | 'VERSION_CONFLICT' | 'OTHER';

export function calendarEventSaveFailureKind(error: unknown): CalendarEventSaveFailureKind {
  if (!(error instanceof HttpError)) return 'OTHER';
  if ([401, 403, 404].includes(error.status)) return 'AUTHORITY_REVOKED';
  if (error.status === 409) return 'VERSION_CONFLICT';
  return 'OTHER';
}

export function calendarEventSaveErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function CalendarEventDialogStatus({
  fromDwaion,
  workHandoff,
  workReceiptLocked,
  saveError,
  versionConflict,
  calendarsError,
  peopleError,
  onKeepDraft,
  onReloadCurrent,
  onRetryCalendars,
  onRetryPeople,
}: Readonly<{
  fromDwaion: boolean;
  workHandoff: boolean;
  workReceiptLocked: boolean;
  saveError?: string | null;
  versionConflict: boolean;
  calendarsError: boolean;
  peopleError: boolean;
  onKeepDraft: () => void;
  onReloadCurrent: () => void;
  onRetryCalendars: () => void;
  onRetryPeople: () => void;
}>) {
  const { t } = useTranslation('calendar');
  return (
    <>
      {fromDwaion ? (
        <InlineFeedback severity="info">{t('event.dwaionDraftNotice')}</InlineFeedback>
      ) : null}
      {workHandoff ? (
        <InlineFeedback severity="info">{t('event.workHandoffNotice')}</InlineFeedback>
      ) : null}
      {workReceiptLocked ? (
        <InlineFeedback severity="warning">{t('event.workLinkRecoveryRequired')}</InlineFeedback>
      ) : null}
      {versionConflict ? (
        <InlineFeedback
          severity="warning"
          action={
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <ActionButton intent="quiet" size="small" onClick={onKeepDraft}>
                {t('event.conflictKeepEditing')}
              </ActionButton>
              <ActionButton intent="secondary" size="small" onClick={onReloadCurrent}>
                {t('event.conflictReload')}
              </ActionButton>
            </Stack>
          }
        >
          {t('event.versionConflict')}
        </InlineFeedback>
      ) : saveError ? (
        <InlineFeedback severity="error">{saveError}</InlineFeedback>
      ) : null}
      {calendarsError ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton intent="quiet" size="small" onClick={onRetryCalendars}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('event.calendarsLoadError')}
        </InlineFeedback>
      ) : null}
      {peopleError ? (
        <InlineFeedback
          severity="warning"
          action={
            <ActionButton intent="quiet" size="small" onClick={onRetryPeople}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('event.peopleLoadError')}
        </InlineFeedback>
      ) : null}
    </>
  );
}
