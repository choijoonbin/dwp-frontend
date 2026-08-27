import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { ActionButton, DetailInspector } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { HomeExperienceRevision } from '@dwp-frontend/shared-utils';

const FULL_RESTORE_SCOPES = [
  'PRESENTATION',
  'BACKGROUND_ASSET',
  'LAUNCHPAD',
  'COMPOSITION',
] as const;

export type HomeExperienceHistoryState = 'LOADING' | 'ERROR' | 'EMPTY' | 'READY';

export function resolveHomeExperienceHistoryState(
  loading: boolean,
  error: boolean,
  revisionCount: number
): HomeExperienceHistoryState {
  if (loading) return 'LOADING';
  if (error) return 'ERROR';
  return revisionCount === 0 ? 'EMPTY' : 'READY';
}

export function homeExperienceRevisionScopes(revision: HomeExperienceRevision): string[] {
  return revision.affectedScopes?.length ? revision.affectedScopes : [...FULL_RESTORE_SCOPES];
}

export function HomeExperienceRevisionHistory({
  open,
  revisions,
  loading,
  error,
  busy,
  canWrite,
  onClose,
  onRestore,
  onRetry,
}: {
  open: boolean;
  revisions: HomeExperienceRevision[];
  loading: boolean;
  error: boolean;
  busy: boolean;
  canWrite: boolean;
  onClose: () => void;
  onRestore: (revision: HomeExperienceRevision) => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation('admin');
  const state = resolveHomeExperienceHistoryState(loading, error, revisions.length);
  return (
    <DetailInspector
      open={open}
      variant="drawer"
      width={520}
      title={t('homeExperience.history.title')}
      subtitle={t('homeExperience.history.subtitle')}
      closeLabel={t('homeExperience.history.close')}
      onClose={onClose}
    >
      {state === 'LOADING' ? (
        <Alert severity="info">{t('homeExperience.history.loading')}</Alert>
      ) : state === 'ERROR' ? (
        <Alert
          severity="error"
          action={
            <ActionButton size="small" intent="secondary" onClick={onRetry}>
              {t('homeExperience.history.retry')}
            </ActionButton>
          }
        >
          {t('homeExperience.history.error')}
        </Alert>
      ) : state === 'EMPTY' ? (
        <Alert severity="info">{t('homeExperience.history.empty')}</Alert>
      ) : (
        <Stack divider={<Divider flexItem />}>
          {revisions.map((revision) => (
            <Stack key={revision.revisionId} gap={1} sx={{ py: 1.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2">
                    {t(`homeExperience.history.changeTypes.${revision.changeType}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(revision.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                  </Typography>
                </Box>
                {revision.current ? (
                  <Chip size="small" color="success" label={t('homeExperience.history.current')} />
                ) : (
                  <ActionButton
                    size="small"
                    intent="secondary"
                    startIcon={<RotateCcw size={15} />}
                    disabled={busy || !canWrite}
                    onClick={() => onRestore(revision)}
                  >
                    {t('homeExperience.history.restore')}
                  </ActionButton>
                )}
              </Stack>
              <Typography variant="body2" noWrap>
                {revision.headline || t('homeExperience.history.defaultCopy')}
              </Typography>
              <Stack direction="row" gap={0.75} flexWrap="wrap">
                {homeExperienceRevisionScopes(revision).map((scope) => (
                  <Chip
                    key={scope}
                    size="small"
                    variant="outlined"
                    label={t(`homeExperience.history.scopes.${scope}`)}
                  />
                ))}
              </Stack>
              <Stack direction="row" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {revision.backgroundOriginalName || t('homeExperience.builtInBackground')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('homeExperience.history.summary', {
                    locales: t('homeExperience.history.localeCount', {
                      count: revision.localeCount,
                    }),
                    version: revision.sourceVersion,
                  })}
                </Typography>
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </DetailInspector>
  );
}
