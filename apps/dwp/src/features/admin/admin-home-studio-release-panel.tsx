import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, RotateCcw, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import {
  getAdminHomeExperience,
  getHomeExperienceRevisions,
  rollbackHomeExperience,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { useCurrentProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { homeExperienceRevisionScopes } from './home-experience-revision-history';

import type { HomeExperienceRevision } from '@dwp-frontend/shared-utils';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function HomeStudioReleasePanel() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const supportContext = useCurrentProviderSupportContext();
  const canWrite =
    hasPermission('ADMIN.HOME_EXPERIENCE', 'MANAGE') &&
    (!supportContext.data || supportContext.data.scopes.includes('TENANT_CONFIGURATION_WRITE'));
  const [restoreCandidate, setRestoreCandidate] = useState<HomeExperienceRevision | null>(null);
  const experienceQuery = useQuery({
    queryKey: ['admin', 'home-experience'],
    queryFn: getAdminHomeExperience,
  });
  const historyQuery = useQuery({
    queryKey: ['admin', 'home-experience', 'revisions'],
    queryFn: () => getHomeExperienceRevisions(50),
  });
  const rollbackMutation = useMutation({
    mutationFn: (revision: HomeExperienceRevision) =>
      rollbackHomeExperience(revision.revisionId, experienceQuery.data!.version),
    onSuccess: async (experience) => {
      queryClient.setQueryData(['admin', 'home-experience'], experience);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'home-experience', 'revisions'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
        queryClient.invalidateQueries({ queryKey: ['home-experience'] }),
      ]);
      toast.success(t('homeExperience.toasts.revisionRestored'));
    },
    onError: (error) => toast.error(errorMessage(error, t('homeComposition.errors.save'))),
  });

  if (experienceQuery.isLoading || historyQuery.isLoading) {
    return <LoadingState label={t('homeStudio.release.loading')} variant="skeleton" />;
  }
  if (experienceQuery.isError || historyQuery.isError || !experienceQuery.data) {
    return (
      <ErrorState
        title={t('homeStudio.release.loadFailed')}
        retryLabel={t('homeWidgets.controlPlane.retry')}
        retrying={experienceQuery.isFetching || historyQuery.isFetching}
        onRetry={() => {
          void experienceQuery.refetch();
          void historyQuery.refetch();
        }}
      />
    );
  }

  const revisions = historyQuery.data ?? [];
  return (
    <Stack gap={3} data-testid="admin-home-release-history">
      <InlineFeedback severity="info" icon={<ShieldCheck size={19} />}>
        <Typography variant="subtitle2">{t('homeStudio.release.title')}</Typography>
        <Typography variant="body2">{t('homeStudio.release.description')}</Typography>
      </InlineFeedback>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Chip
          color="success"
          label={t('homeStudio.release.currentVersion', { version: experienceQuery.data.version })}
        />
        <Chip
          variant="outlined"
          label={t('homeStudio.release.revisionCount', { count: revisions.length })}
        />
      </Stack>
      {revisions.length === 0 ? (
        <EmptyState icon={<History size={28} />} title={t('homeExperience.history.empty')} />
      ) : (
        <Stack
          component="ol"
          divider={<Divider flexItem />}
          sx={{ listStyle: 'none', p: 0, m: 0, borderBlock: 1, borderColor: 'divider' }}
        >
          {revisions.map((revision) => (
            <Stack
              component="li"
              key={revision.revisionId}
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              gap={2}
              sx={{ px: 1, py: 2 }}
            >
              <Box>
                <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="subtitle1">
                    {t(`homeExperience.history.changeTypes.${revision.changeType}`)}
                  </Typography>
                  {revision.current && (
                    <Chip
                      size="small"
                      color="success"
                      label={t('homeExperience.history.current')}
                    />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(revision.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                </Typography>
                <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                  {homeExperienceRevisionScopes(revision).map((scope) => (
                    <Chip
                      key={scope}
                      size="small"
                      variant="outlined"
                      label={t(`homeExperience.history.scopes.${scope}`)}
                    />
                  ))}
                </Stack>
              </Box>
              {!revision.current && (
                <ActionButton
                  intent="secondary"
                  startIcon={<RotateCcw size={16} />}
                  disabled={!canWrite || rollbackMutation.isPending}
                  onClick={() => setRestoreCandidate(revision)}
                >
                  {t('homeExperience.history.restore')}
                </ActionButton>
              )}
            </Stack>
          ))}
        </Stack>
      )}
      <ConfirmDialog
        open={Boolean(restoreCandidate)}
        title={t('homeExperience.restoreDialog.title')}
        description={t('homeStudio.release.rollbackImpact', {
          version: restoreCandidate?.sourceVersion ?? '',
          scopes: restoreCandidate
            ? homeExperienceRevisionScopes(restoreCandidate)
                .map((scope) => t(`homeExperience.history.scopes.${scope}`))
                .join(', ')
            : '',
        })}
        cancelLabel={t('homeExperience.restoreDialog.cancel')}
        confirmLabel={t('homeExperience.restoreDialog.confirm')}
        intent="danger"
        busy={rollbackMutation.isPending}
        onClose={() => setRestoreCandidate(null)}
        onConfirm={() => {
          if (restoreCandidate) rollbackMutation.mutate(restoreCandidate);
          setRestoreCandidate(null);
        }}
      />
    </Stack>
  );
}
