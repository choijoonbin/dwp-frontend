import { useTranslation } from 'react-i18next';
import { RotateCcw, Server, UserRoundCheck } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MailDraftConflictRecord } from './mail-draft-conflict';
import type { MailDraftFields } from './use-mail-draft-autosave';

const FIELD_KEYS = ['toEmail', 'subject', 'body'] as const;

export function MailDraftConflictReview({
  conflict,
  server,
  loading,
  loadFailed,
  onRetry,
  onUseServer,
  onKeepLocal,
}: {
  conflict: MailDraftConflictRecord;
  server: MailDraftFields | null;
  loading: boolean;
  loadFailed: boolean;
  onRetry: () => void;
  onUseServer: () => void;
  onKeepLocal: () => void;
}) {
  const { t } = useTranslation('mail');

  return (
    <Alert severity="warning" role="alert" aria-live="assertive">
      <Stack spacing={1.5}>
        <Box>
          <Typography component="h3" variant="subtitle1" fontWeight={800}>
            {t('draft.conflictReview.title')}
          </Typography>
          <Typography variant="body2">{t('draft.conflictReview.description')}</Typography>
        </Box>
        {loading && <Typography variant="body2">{t('draft.conflictReview.loading')}</Typography>}
        {loadFailed && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">{t('draft.conflictReview.loadFailed')}</Typography>
            <ActionButton intent="quiet" startIcon={<RotateCcw size={16} />} onClick={onRetry}>
              {t('actions.retry')}
            </ActionButton>
          </Stack>
        )}
        {server && (
          <Stack spacing={1.25}>
            {FIELD_KEYS.map((field) => (
              <Box key={field}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {t(`draft.conflictReview.fields.${field}`)}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1,
                    mt: 0.5,
                  }}
                >
                  {(
                    [
                      ['base', conflict.base[field]],
                      ['local', conflict.local[field]],
                      ['server', server[field]],
                    ] as const
                  ).map(([version, value]) => (
                    <Paper key={version} variant="outlined" sx={{ p: 1, minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {t(`draft.conflictReview.versions.${version}`)}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                          maxHeight: 120,
                          overflow: 'auto',
                        }}
                      >
                        {value || t('draft.conflictReview.empty')}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              </Box>
            ))}
            {(conflict.base.composeOptions ||
              conflict.local.composeOptions ||
              server.composeOptions) && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {t('draft.conflictReview.fields.delivery')}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1,
                    mt: 0.5,
                  }}
                >
                  {(
                    [
                      ['base', conflict.base.composeOptions],
                      ['local', conflict.local.composeOptions],
                      ['server', server.composeOptions],
                    ] as const
                  ).map(([version, value]) => (
                    <Paper key={version} variant="outlined" sx={{ p: 1, minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {t(`draft.conflictReview.versions.${version}`)}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                      >
                        {composeOptionsSummary(
                          value,
                          t('draft.conflictReview.empty'),
                          t('compose.attachments.title'),
                          t('compose.schedule')
                        )}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              </Box>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <ActionButton
                intent="secondary"
                startIcon={<Server size={16} />}
                onClick={onUseServer}
              >
                {t('draft.conflictReview.useServer')}
              </ActionButton>
              <ActionButton
                intent="primary"
                startIcon={<UserRoundCheck size={16} />}
                onClick={onKeepLocal}
              >
                {t('draft.conflictReview.keepLocal')}
              </ActionButton>
            </Stack>
          </Stack>
        )}
      </Stack>
    </Alert>
  );
}

function composeOptionsSummary(
  value: MailDraftFields['composeOptions'],
  empty: string,
  attachmentsLabel: string,
  scheduleLabel: string
) {
  if (!value) return empty;
  const recipients = value.recipients
    .map((recipient) => `${recipient.type}: ${recipient.name || recipient.email}`)
    .join(', ');
  return (
    [
      recipients,
      value.attachmentIds.length ? `${attachmentsLabel}: ${value.attachmentIds.length}` : null,
      value.scheduledAt ? `${scheduleLabel}: ${value.scheduledAt}` : null,
    ]
      .filter(Boolean)
      .join('\n') || empty
  );
}
