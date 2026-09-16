import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, FileStack, History } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@dwp-frontend/design-system';
import {
  HttpError,
  createHomeCommandKey,
  getHomeTemplates,
  publishHomeTemplate,
  revokeHomeTemplate,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useCurrentProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { TenantWidgetRegistryPanel } from './tenant-widget-registry-panel';
import { TenantHomeTemplateHistory } from './tenant-home-template-history';

import type { HomeTemplate } from '@dwp-frontend/shared-utils';

function lifecycleColor(lifecycle: HomeTemplate['lifecycle']) {
  if (lifecycle === 'PUBLISHED') return 'success';
  if (lifecycle === 'REVOKED') return 'default';
  return 'warning';
}

export function TenantWidgetCatalogPanel({ onOpenPolicy }: { onOpenPolicy: () => void }) {
  return <TenantWidgetRegistryPanel onOpenPolicy={onOpenPolicy} />;
}

export function TenantHomeBlueprintPanel() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const supportContext = useCurrentProviderSupportContext();
  const canWriteSupport =
    !supportContext.data || supportContext.data.scopes.includes('TENANT_CONFIGURATION_WRITE');
  const canManage =
    hasPermission('ADMIN.HOME_EXPERIENCE', 'MANAGE') &&
    hasPermission('ADMIN.HOME_TEMPLATE', 'MANAGE') &&
    canWriteSupport;
  const [pending, setPending] = useState<{
    template: HomeTemplate;
    action: 'publish' | 'revoke';
  } | null>(null);
  const [historyTemplateId, setHistoryTemplateId] = useState<string | null>(null);
  const templatesQuery = useQuery({
    queryKey: ['home-personalization', 'templates'],
    queryFn: getHomeTemplates,
    staleTime: 30_000,
    retry: 1,
  });
  const lifecycleMutation = useMutation({
    mutationFn: ({ template, action }: NonNullable<typeof pending>) =>
      action === 'publish'
        ? publishHomeTemplate(
            template.templateId,
            template.version,
            createHomeCommandKey('publish-home-blueprint')
          )
        : revokeHomeTemplate(
            template.templateId,
            template.version,
            createHomeCommandKey('revoke-home-blueprint')
          ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['home-personalization', 'templates'] });
      toast.success(t('homeWidgets.blueprints.saved'));
    },
    onError: () => toast.error(t('homeWidgets.blueprints.saveFailed')),
  });

  if (templatesQuery.isLoading) {
    return <LoadingState label={t('homeWidgets.blueprints.loading')} variant="skeleton" />;
  }
  if (templatesQuery.isError) {
    const disabled =
      templatesQuery.error instanceof HttpError && templatesQuery.error.status === 403;
    return (
      <ErrorState
        title={t(
          disabled ? 'homeWidgets.blueprints.featureDisabled' : 'homeWidgets.blueprints.loadFailed'
        )}
        description={t(
          disabled
            ? 'homeWidgets.blueprints.featureDisabledDescription'
            : 'homeWidgets.blueprints.loadFailedDescription'
        )}
        retryLabel={t('homeWidgets.blueprints.retry')}
        retrying={templatesQuery.isFetching}
        onRetry={() => void templatesQuery.refetch()}
      />
    );
  }

  const templates = templatesQuery.data ?? [];
  const pendingAudience = pending
    ? pending.template.audience.type === 'ALL'
      ? t('homeWidgets.blueprints.allMembers')
      : pending.template.audience.values.join(', ')
    : '';
  return (
    <Stack gap={2.5}>
      <Alert severity="info" icon={<FileStack size={19} />}>
        <Typography variant="subtitle2">{t('homeWidgets.blueprints.namingTitle')}</Typography>
        <Typography variant="body2">{t('homeWidgets.blueprints.namingDescription')}</Typography>
      </Alert>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
      >
        <Box>
          <Typography component="h2" variant="h6">
            {t('homeWidgets.blueprints.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('homeWidgets.blueprints.count', { count: templates.length })}
          </Typography>
        </Box>
        <ActionButton
          intent="secondary"
          startIcon={<ExternalLink size={16} />}
          onClick={() => navigate('/')}
        >
          {t('homeWidgets.blueprints.openHomeStudio')}
        </ActionButton>
      </Stack>

      {templates.length === 0 ? (
        <EmptyState
          icon={<FileStack size={28} />}
          title={t('homeWidgets.blueprints.empty')}
          description={t('homeWidgets.blueprints.emptyDescription')}
          size="standard"
        />
      ) : (
        <Stack
          component="ul"
          sx={{ p: 0, m: 0, listStyle: 'none', borderTop: 1, borderColor: 'divider' }}
        >
          {templates.map((template) => (
            <Stack
              component="li"
              key={template.templateId}
              gap={2}
              sx={{ px: 1, py: 2, borderBottom: 1, borderColor: 'divider' }}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
                gap={2}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle1">{template.name}</Typography>
                    <Chip
                      size="small"
                      color={lifecycleColor(template.lifecycle)}
                      label={t(`homeWidgets.blueprints.lifecycle.${template.lifecycle}`)}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    {t('homeWidgets.blueprints.metadata', {
                      audience:
                        template.audience.type === 'ALL'
                          ? t('homeWidgets.blueprints.allMembers')
                          : template.audience.values.join(', '),
                      widgets: formatNumber(template.layout.widgets.length),
                      date: formatDate(template.updatedAt, { dateStyle: 'medium' }),
                    })}
                  </Typography>
                </Box>
                <Stack direction="row" gap={0.75} flexWrap="wrap">
                  <ActionButton
                    size="small"
                    intent="quiet"
                    startIcon={<History size={15} />}
                    aria-expanded={historyTemplateId === template.templateId}
                    onClick={() =>
                      setHistoryTemplateId((current) =>
                        current === template.templateId ? null : template.templateId
                      )
                    }
                  >
                    {t('homeWidgets.blueprints.history.action')}
                  </ActionButton>
                  {template.lifecycle === 'DRAFT' && (
                    <ActionButton
                      size="small"
                      intent="primary"
                      disabled={!canManage || lifecycleMutation.isPending}
                      onClick={() => setPending({ template, action: 'publish' })}
                    >
                      {t('homeWidgets.blueprints.publish')}
                    </ActionButton>
                  )}
                  {template.lifecycle === 'PUBLISHED' && (
                    <ActionButton
                      size="small"
                      intent="quiet"
                      disabled={!canManage || lifecycleMutation.isPending}
                      onClick={() => setPending({ template, action: 'revoke' })}
                      sx={{ color: 'error.main' }}
                    >
                      {t('homeWidgets.blueprints.revoke')}
                    </ActionButton>
                  )}
                </Stack>
              </Stack>
              {historyTemplateId === template.templateId && (
                <TenantHomeTemplateHistory template={template} canManage={canManage} />
              )}
            </Stack>
          ))}
        </Stack>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={t(`homeWidgets.blueprints.confirm.${pending?.action ?? 'publish'}.title`)}
        description={t(
          `homeWidgets.blueprints.confirm.${pending?.action ?? 'publish'}.description`,
          {
            name: pending?.template.name ?? '',
            audience: pendingAudience,
            widgets: pending ? formatNumber(pending.template.layout.widgets.length) : '',
            version: pending ? formatNumber(pending.template.version) : '',
          }
        )}
        cancelLabel={t('homeWidgets.blueprints.cancel')}
        confirmLabel={t(`homeWidgets.blueprints.confirm.${pending?.action ?? 'publish'}.action`)}
        intent={pending?.action === 'revoke' ? 'danger' : 'primary'}
        busy={lifecycleMutation.isPending}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) lifecycleMutation.mutate(pending);
          setPending(null);
        }}
      />
    </Stack>
  );
}
