import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export type MeetingScheduleDraftStatus =
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'discarding'
  | 'saved'
  | 'restored'
  | 'error'
  | 'conflict'
  | 'expired';

const statusKey: Record<Exclude<MeetingScheduleDraftStatus, 'idle'>, string> = {
  dirty: 'draftUnsaved',
  saving: 'draftSaving',
  discarding: 'draftDiscarding',
  saved: 'draftSaved',
  restored: 'draftRestored',
  error: 'draftSaveError',
  conflict: 'draftConflict',
  expired: 'draftExpired',
};

export function MeetingScheduleDraftStatusText({
  id,
  status,
  updatedAt,
  timeZone,
}: {
  id: string;
  status: MeetingScheduleDraftStatus;
  updatedAt?: string;
  timeZone: string;
}) {
  const { t, i18n } = useTranslation('meetings');
  if (status === 'idle') return null;
  const error = ['error', 'conflict', 'expired'].includes(status);
  const time =
    updatedAt && Number.isFinite(Date.parse(updatedAt))
      ? formatDate(
          updatedAt,
          { hour: '2-digit', minute: '2-digit', timeZone },
          resolveSupportedLocale(i18n.language)
        )
      : '';
  return (
    <Typography
      id={id}
      role={error ? 'alert' : 'status'}
      aria-live={error ? undefined : 'polite'}
      variant="caption"
      color={error ? 'error.main' : 'text.secondary'}
      sx={{ display: 'block', overflowWrap: 'anywhere' }}
    >
      {t('scheduleWorkspace.' + statusKey[status], { time })}
    </Typography>
  );
}

export function MeetingScheduleDraftHeaderAction({
  disabled,
  hasStatus,
  onSave,
}: {
  disabled: boolean;
  hasStatus: boolean;
  onSave: () => void;
}) {
  const { t } = useTranslation('meetings');
  return (
    <ActionButton
      intent="quiet"
      size="small"
      aria-label={t('scheduleWorkspace.saveDraft')}
      aria-describedby={hasStatus ? 'meeting-draft-status-mobile' : undefined}
      disabled={disabled}
      onClick={onSave}
      sx={{ display: { xs: 'inline-flex', md: 'none' }, minHeight: 44, flexShrink: 0 }}
    >
      {t('scheduleWorkspace.saveDraftShort')}
    </ActionButton>
  );
}

export function MeetingScheduleDraftSourceUnavailable({
  busy,
  onDiscard,
}: {
  busy: boolean;
  onDiscard: () => void;
}) {
  const { t } = useTranslation('meetings');
  return (
    <InlineFeedback severity="warning">
      <Stack gap={1.5}>
        <Typography variant="body2">{t('scheduleWorkspace.draftSourceUnavailable')}</Typography>
        <ActionButton
          intent="secondary"
          disabled={busy}
          onClick={onDiscard}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          {t('scheduleWorkspace.discardSavedDraft')}
        </ActionButton>
      </Stack>
    </InlineFeedback>
  );
}

export function MeetingScheduleDraftConflict({
  busy,
  canRestore,
  onRestore,
  onDiscard,
}: {
  busy: boolean;
  canRestore: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation('meetings');
  return (
    <InlineFeedback severity="warning" sx={{ mb: 2 }}>
      <Stack gap={1.5}>
        <Typography variant="body2">{t('scheduleWorkspace.draftConflictHint')}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          {canRestore && (
            <ActionButton
              intent="secondary"
              disabled={busy}
              onClick={onRestore}
              sx={{ minHeight: 44 }}
            >
              {t('scheduleWorkspace.restoreLatestDraft')}
            </ActionButton>
          )}
          <ActionButton intent="quiet" disabled={busy} onClick={onDiscard} sx={{ minHeight: 44 }}>
            {t('scheduleWorkspace.discardSavedDraft')}
          </ActionButton>
        </Stack>
      </Stack>
    </InlineFeedback>
  );
}

export function MeetingScheduleDesktopDraftActions({
  busy,
  disabled,
  hasPersistedDraft,
  status,
  updatedAt,
  timeZone,
  onSave,
  onDiscard,
  onCancel,
}: {
  busy: boolean;
  disabled: boolean;
  hasPersistedDraft: boolean;
  status: MeetingScheduleDraftStatus;
  updatedAt?: string;
  timeZone: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('meetings');
  return (
    <>
      <ActionButton
        intent="secondary"
        disabled={disabled}
        aria-describedby={status !== 'idle' ? 'meeting-draft-status-desktop' : undefined}
        onClick={onSave}
      >
        {t('scheduleWorkspace.saveDraft')}
      </ActionButton>
      <MeetingScheduleDraftStatusText
        id="meeting-draft-status-desktop"
        status={status}
        updatedAt={updatedAt}
        timeZone={timeZone}
      />
      {hasPersistedDraft && (
        <ActionButton intent="quiet" disabled={busy} onClick={onDiscard}>
          {t('scheduleWorkspace.discardSavedDraft')}
        </ActionButton>
      )}
      <ActionButton intent="quiet" disabled={busy} onClick={onCancel}>
        {t('actions.cancel')}
      </ActionButton>
    </>
  );
}

export function MeetingScheduleMobileFooter({
  step,
  busy,
  submitButton,
  draftDisabled,
  hasPersistedDraft,
  status,
  updatedAt,
  timeZone,
  onPrevious,
  onNext,
  onSave,
  onDiscard,
}: {
  step: number;
  busy: boolean;
  submitButton: ReactNode;
  draftDisabled: boolean;
  hasPersistedDraft: boolean;
  status: MeetingScheduleDraftStatus;
  updatedAt?: string;
  timeZone: string;
  onPrevious: () => void;
  onNext: () => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation('meetings');
  return (
    <Box
      sx={{
        display: { xs: 'block', md: 'none' },
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        p: 2,
        pb: 'max(16px, env(safe-area-inset-bottom))',
        zIndex: 1100,
      }}
    >
      <Stack direction="row" gap={1}>
        {step > 0 && (
          <ActionButton intent="secondary" disabled={busy} onClick={onPrevious}>
            {t('scheduleWorkspace.previous')}
          </ActionButton>
        )}
        {step < 3 ? (
          <ActionButton
            fullWidth
            intent="primary"
            disabled={busy}
            endIcon={<ArrowRight size={16} aria-hidden="true" />}
            onClick={onNext}
          >
            {t('scheduleWorkspace.next')}
          </ActionButton>
        ) : (
          submitButton
        )}
      </Stack>
      <Stack direction="row" gap={1} sx={{ mt: 0.5 }}>
        <ActionButton
          fullWidth
          intent="quiet"
          disabled={draftDisabled}
          aria-describedby={status !== 'idle' ? 'meeting-draft-status-mobile' : undefined}
          onClick={onSave}
          sx={{ minHeight: 44 }}
        >
          {t('scheduleWorkspace.saveDraft')}
        </ActionButton>
        {hasPersistedDraft && (
          <ActionButton intent="quiet" disabled={busy} onClick={onDiscard} sx={{ minHeight: 44 }}>
            {t('scheduleWorkspace.discardDraftShort')}
          </ActionButton>
        )}
      </Stack>
      <MeetingScheduleDraftStatusText
        id="meeting-draft-status-mobile"
        status={status}
        updatedAt={updatedAt}
        timeZone={timeZone}
      />
    </Box>
  );
}
