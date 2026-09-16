import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, RotateCcw } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@dwp-frontend/design-system';
import {
  createHomeCommandKey,
  getHomeTemplateRevisions,
  restoreHomeTemplateRevision,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { HomeTemplate, HomeTemplateRevision } from '@dwp-frontend/shared-utils';

export function TenantHomeTemplateHistory({
  template,
  canManage,
}: {
  template: HomeTemplate;
  canManage: boolean;
}) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [restoreCandidate, setRestoreCandidate] = useState<HomeTemplateRevision | null>(null);
  const revisionsQuery = useQuery({
    queryKey: ['home-personalization', 'templates', template.templateId, 'revisions'],
    queryFn: () => getHomeTemplateRevisions(template.templateId),
    staleTime: 30_000,
  });
  const restoreMutation = useMutation({
    mutationFn: (revision: HomeTemplateRevision) =>
      restoreHomeTemplateRevision(
        template.templateId,
        revision.templateRevisionId,
        template.version,
        createHomeCommandKey('restore-home-blueprint')
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['home-personalization', 'templates'] }),
        queryClient.invalidateQueries({
          queryKey: ['home-personalization', 'templates', template.templateId, 'revisions'],
        }),
      ]);
      toast.success(t('homeWidgets.blueprints.history.restored'));
    },
    onError: () => toast.error(t('homeWidgets.blueprints.history.restoreFailed')),
  });

  if (revisionsQuery.isLoading) {
    return <LoadingState label={t('homeWidgets.blueprints.history.loading')} variant="skeleton" />;
  }
  if (revisionsQuery.isError) {
    return (
      <ErrorState
        title={t('homeWidgets.blueprints.history.loadFailed')}
        retryLabel={t('homeWidgets.blueprints.retry')}
        retrying={revisionsQuery.isFetching}
        onRetry={() => void revisionsQuery.refetch()}
      />
    );
  }

  const revisions = revisionsQuery.data ?? [];
  return (
    <Box sx={{ width: 1, borderLeft: 3, borderColor: 'primary.main', pl: 2, py: 1 }}>
      <Typography component="h3" variant="subtitle1">
        {t('homeWidgets.blueprints.history.title', { name: template.name })}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, mb: 1.5 }}>
        {t('homeWidgets.blueprints.history.description')}
      </Typography>
      {revisions.length === 0 ? (
        <EmptyState
          icon={<History size={24} />}
          title={t('homeWidgets.blueprints.history.empty')}
          size="compact"
        />
      ) : (
        <Stack component="ol" divider={<Divider flexItem />} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {revisions.map((revision) => (
            <Stack
              component="li"
              key={revision.templateRevisionId}
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
              gap={1.5}
              sx={{ py: 1.5 }}
            >
              <Box>
                <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="subtitle2">
                    {t('homeWidgets.blueprints.history.revision', {
                      revision: revision.revisionNumber,
                    })}
                  </Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`homeWidgets.blueprints.history.sources.${revision.source}`)}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(revision.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                </Typography>
              </Box>
              {canManage && (
                <ActionButton
                  size="small"
                  intent="secondary"
                  startIcon={<RotateCcw size={15} />}
                  disabled={restoreMutation.isPending}
                  onClick={() => setRestoreCandidate(revision)}
                >
                  {t('homeWidgets.blueprints.history.restore')}
                </ActionButton>
              )}
            </Stack>
          ))}
        </Stack>
      )}
      <ConfirmDialog
        open={Boolean(restoreCandidate)}
        title={t('homeWidgets.blueprints.history.confirm.title')}
        description={t('homeWidgets.blueprints.history.confirm.description', {
          revision: restoreCandidate?.revisionNumber ?? '',
          name: template.name,
        })}
        cancelLabel={t('homeWidgets.blueprints.cancel')}
        confirmLabel={t('homeWidgets.blueprints.history.confirm.action')}
        intent="primary"
        busy={restoreMutation.isPending}
        onClose={() => setRestoreCandidate(null)}
        onConfirm={() => {
          if (restoreCandidate) restoreMutation.mutate(restoreCandidate);
          setRestoreCandidate(null);
        }}
      />
    </Box>
  );
}
