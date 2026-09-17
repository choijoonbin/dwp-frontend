import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  PenLine,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatDate as formatLocalizedDate,
  resolveSupportedLocale,
  resolveSystemTimeZone,
} from '@dwp-frontend/shared-i18n';
import {
  createMailFollowUp,
  deleteMailFollowUp,
  getMailFollowUps,
  updateMailFollowUp,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  FormDialog,
  FormField,
  GuidedEmptyState,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MailFollowUp, MailFollowUpInput } from '@dwp-frontend/shared-utils';

import { useMailUserPermissions } from './use-mail-user-permissions';

export function MailFollowUpTracker({
  suggestedThreadId,
  onOpenThread,
}: {
  suggestedThreadId?: string | null;
  onOpenThread: (threadId: string) => void;
}) {
  const { t, i18n } = useTranslation('mail');
  const { isLoaded, canCreate, canUpdate } = useMailUserPermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<MailFollowUp | 'create' | null>(null);
  const [cancelling, setCancelling] = useState<MailFollowUp | null>(null);
  const query = useQuery({
    queryKey: ['mail', 'follow-ups'],
    queryFn: () => getMailFollowUps({}),
    staleTime: 20_000,
    retry: 1,
  });
  const save = useMutation({
    mutationFn: (input: MailFollowUpInput) => {
      if (editing === 'create') {
        if (!canCreate) throw new Error('APP.MAIL:CREATE is required');
        if (!suggestedThreadId) throw new Error('Select a mail thread first.');
        return createMailFollowUp(suggestedThreadId, input);
      }
      if (editing) {
        if (!canUpdate) throw new Error('APP.MAIL:UPDATE is required');
        return updateMailFollowUp(editing.followUpId, input, editing.version);
      }
      throw new Error('Follow-up editor is not open.');
    },
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['mail', 'follow-ups'] });
      toast.success(t('secondary.followUp.trackingSaved'));
    },
    onError: () => toast.error(t('secondary.followUp.trackingSaveError')),
  });
  const cancel = useMutation({
    mutationFn: (followUp: MailFollowUp) => {
      if (!canUpdate) throw new Error('APP.MAIL:UPDATE is required');
      return deleteMailFollowUp(followUp.followUpId, followUp.version);
    },
    onSuccess: async () => {
      setCancelling(null);
      await queryClient.invalidateQueries({ queryKey: ['mail', 'follow-ups'] });
      toast.success(t('secondary.followUp.trackingCancelled'));
    },
    onError: () => toast.error(t('secondary.followUp.trackingCancelError')),
  });

  return (
    <Box sx={{ mt: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        spacing={1}
        alignItems={{ sm: 'center' }}
      >
        <Box>
          <Typography component="h2" variant="subtitle1" fontWeight={800}>
            {t('secondary.followUp.waitingTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('secondary.followUp.waitingDescription')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5}>
          <ActionIconButton label={t('actions.refresh')} onClick={() => void query.refetch()}>
            <RefreshCw size={17} />
          </ActionIconButton>
          <ActionButton
            intent="primary"
            startIcon={<Plus size={16} />}
            disabled={!canCreate || !suggestedThreadId}
            onClick={() => setEditing('create')}
          >
            {t('secondary.followUp.addTracking')}
          </ActionButton>
        </Stack>
      </Stack>
      {isLoaded && !canCreate && !canUpdate && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {t('permissions.readOnly', {
            defaultValue: 'You have read-only access. Follow-up changes are unavailable.',
          })}
        </Alert>
      )}
      {!suggestedThreadId && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {t('secondary.followUp.selectBeforeTracking')}
        </Alert>
      )}
      {query.isLoading ? (
        <Stack spacing={1} sx={{ mt: 2 }}>
          <Skeleton variant="rounded" height={100} />
          <Skeleton variant="rounded" height={100} />
        </Stack>
      ) : query.isError ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('secondary.followUp.trackingLoadError')}
        </Alert>
      ) : query.data?.length ? (
        <Box
          component="section"
          aria-label={t('secondary.followUp.waitingTitle')}
          sx={{ mt: 2, borderBlock: 1, borderColor: 'divider' }}
        >
          {query.data.map((followUp, index) => (
            <Box key={followUp.followUpId}>
              {index > 0 && <Divider />}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                alignItems={{ sm: 'center' }}
                sx={{ py: 2 }}
              >
                <Box
                  sx={{
                    color:
                      followUp.status === 'OVERDUE' ? 'error.main' : 'var(--dwp-product-accent)',
                  }}
                >
                  {followUp.status === 'REPLIED' ? (
                    <CheckCircle2 size={19} />
                  ) : followUp.status === 'OVERDUE' ? (
                    <CalendarClock size={19} />
                  ) : (
                    <Clock3 size={19} />
                  )}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                    <Typography fontWeight={800}>{followUp.subject}</Typography>
                    <Chip
                      size="small"
                      color={
                        followUp.status === 'OVERDUE'
                          ? 'error'
                          : followUp.status === 'REPLIED'
                            ? 'success'
                            : 'default'
                      }
                      variant="outlined"
                      label={t(`secondary.followUp.status.${followUp.status}`)}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {[followUp.participantName, followUp.participantEmail]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('secondary.followUp.expectedBy', {
                      value: formatDate(followUp.expectedReplyAt, i18n.language),
                      timeZone: followUp.timeZone,
                    })}
                  </Typography>
                  {followUp.note && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {followUp.note}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  <ActionButton intent="quiet" onClick={() => onOpenThread(followUp.threadId)}>
                    {t('secondary.followUp.openMail')}
                  </ActionButton>
                  {followUp.status !== 'CANCELLED' && followUp.status !== 'REPLIED' && (
                    <>
                      <ActionButton
                        intent="quiet"
                        startIcon={<PenLine size={15} />}
                        disabled={!canUpdate}
                        onClick={() => setEditing(followUp)}
                      >
                        {t('secondary.followUp.changeTracking')}
                      </ActionButton>
                      <ActionButton
                        intent="quiet"
                        startIcon={<XCircle size={15} />}
                        disabled={!canUpdate}
                        onClick={() => setCancelling(followUp)}
                      >
                        {t('secondary.followUp.cancelTracking')}
                      </ActionButton>
                    </>
                  )}
                </Stack>
              </Stack>
            </Box>
          ))}
        </Box>
      ) : (
        <GuidedEmptyState
          kind="empty"
          title={t('secondary.followUp.waitingEmptyTitle')}
          description={t('secondary.followUp.waitingEmptyDescription')}
        />
      )}
      <FollowUpDialog
        editing={editing}
        busy={save.isPending}
        onClose={() => setEditing(null)}
        onSubmit={(input) => save.mutate(input)}
      />
      <ConfirmDialog
        open={Boolean(cancelling)}
        title={t('secondary.followUp.cancelTitle')}
        description={t('secondary.followUp.cancelDescription')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('secondary.followUp.cancelTracking')}
        intent="danger"
        busy={cancel.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={() => {
          if (cancelling) cancel.mutate(cancelling);
        }}
      />
    </Box>
  );
}

function FollowUpDialog({
  editing,
  busy,
  onClose,
  onSubmit,
}: {
  editing: MailFollowUp | 'create' | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: MailFollowUpInput) => void;
}) {
  const { t } = useTranslation('mail');
  const [expectedReplyAt, setExpectedReplyAt] = useState('');
  const [note, setNote] = useState('');
  const timeZone = resolveSystemTimeZone('UTC');
  useEffect(() => {
    if (!editing) return;
    setExpectedReplyAt(
      editing === 'create'
        ? localDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000))
        : localDateTime(new Date(editing.expectedReplyAt))
    );
    setNote(editing === 'create' ? '' : (editing.note ?? ''));
  }, [editing]);
  const valid = Boolean(expectedReplyAt && new Date(expectedReplyAt).getTime() > Date.now());
  return (
    <FormDialog
      open={Boolean(editing)}
      title={t('secondary.followUp.trackingDialogTitle')}
      description={t('secondary.followUp.trackingDialogDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={busy}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={() =>
        onSubmit({
          expectedReplyAt: new Date(expectedReplyAt).toISOString(),
          timeZone,
          note: note.trim() || null,
        })
      }
    >
      <Stack spacing={2}>
        <FormField
          required
          autoFocus
          type="datetime-local"
          label={t('secondary.followUp.expectedReplyAt')}
          value={expectedReplyAt}
          slotProps={{ inputLabel: { shrink: true } }}
          errorMessage={
            expectedReplyAt && !valid ? t('secondary.followUp.futureRequired') : undefined
          }
          onChange={(event) => setExpectedReplyAt(event.target.value)}
        />
        <FormField
          multiline
          minRows={3}
          label={t('secondary.followUp.note')}
          value={note}
          inputProps={{ maxLength: 500 }}
          onChange={(event) => setNote(event.target.value)}
        />
        <Typography variant="caption" color="text.secondary">
          {t('secondary.followUp.timeZone', { value: timeZone })}
        </Typography>
      </Stack>
    </FormDialog>
  );
}

function localDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string, language: string) {
  return formatLocalizedDate(
    value,
    { dateStyle: 'medium', timeStyle: 'short' },
    resolveSupportedLocale(language)
  );
}
