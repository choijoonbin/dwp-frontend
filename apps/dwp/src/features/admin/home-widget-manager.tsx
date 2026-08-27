import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Database, ExternalLink, FileStack, LockKeyhole, Search, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
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
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  WORKSPACE_WIDGET_CATALOG,
  type WorkspaceWidgetCatalogDefinition,
} from '../../components/workspace-composer/workspace-widget-catalog';
import { useCurrentProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';

import type { HomeTemplate } from '@dwp-frontend/shared-utils';

function technicalValue({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="code"
        variant="body2"
        sx={{ mt: 0.25, display: 'block', overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function lifecycleColor(lifecycle: HomeTemplate['lifecycle']) {
  if (lifecycle === 'PUBLISHED') return 'success';
  if (lifecycle === 'REVOKED') return 'default';
  return 'warning';
}

function revealStackedCatalogDetail(detailPanelId: string, detailHeadingId: string) {
  if (!window.matchMedia('(max-width: 899.95px)').matches) return;
  window.requestAnimationFrame(() => {
    const detail = document.getElementById(detailPanelId);
    const heading = document.getElementById(detailHeadingId);
    heading?.focus({ preventScroll: true });
    detail?.scrollIntoView({ behavior: 'auto', block: 'start' });
  });
}

export function TenantWidgetCatalogPanel({ onOpenPolicy }: { onOpenPolicy: () => void }) {
  const { t } = useTranslation('admin');
  const { t: homeT } = useTranslation('home');
  const detailPanelId = useId();
  const detailHeadingId = `${detailPanelId}-heading`;
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>(WORKSPACE_WIDGET_CATALOG[0]?.key ?? '');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const definitions = useMemo(
    () =>
      WORKSPACE_WIDGET_CATALOG.filter((definition) => {
        if (!deferredQuery) return true;
        return [
          definition.key,
          definition.ownerProduct,
          definition.sourceAppResourceKey,
          definition.dataSource,
          homeT(`widgets.registry.${definition.key}.label`),
        ]
          .join(' ')
          .toLowerCase()
          .includes(deferredQuery);
      }),
    [deferredQuery, homeT]
  );

  useEffect(() => {
    if (definitions.some((definition) => definition.key === selectedKey)) return;
    setSelectedKey(definitions[0]?.key ?? '');
  }, [definitions, selectedKey]);

  const selected = definitions.find((definition) => definition.key === selectedKey) ?? null;

  return (
    <Stack gap={2.5}>
      <Alert icon={<ShieldCheck size={19} />} severity="info">
        <Typography variant="subtitle2">{t('homeWidgets.catalog.governanceTitle')}</Typography>
        <Typography variant="body2">{t('homeWidgets.catalog.governanceDescription')}</Typography>
      </Alert>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
      >
        <FormField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          label={t('homeWidgets.catalog.search')}
          placeholder={t('homeWidgets.catalog.searchPlaceholder')}
          sx={{ maxWidth: { sm: 420 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
        />
        <ActionButton intent="secondary" onClick={onOpenPolicy}>
          {t('homeWidgets.catalog.openPolicy')}
        </ActionButton>
      </Stack>

      <Typography variant="body2" color="text.secondary" aria-live="polite">
        {t('homeWidgets.catalog.resultCount', { count: definitions.length })}
      </Typography>

      {definitions.length === 0 ? (
        <EmptyState
          icon={<Search size={28} />}
          title={t('homeWidgets.catalog.noResults')}
          description={t('homeWidgets.catalog.noResultsDescription')}
          size="standard"
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '340px minmax(0, 1fr)' },
            borderBlock: 1,
            borderColor: 'divider',
          }}
        >
          <List
            disablePadding
            aria-label={t('homeWidgets.catalog.listLabel')}
            sx={{ borderInlineEnd: { md: 1 }, borderColor: 'divider' }}
          >
            {definitions.map((definition) => (
              <ListItem key={definition.key} disablePadding>
                <ListItemButton
                  selected={definition.key === selected?.key}
                  aria-current={definition.key === selected?.key ? 'true' : undefined}
                  aria-controls={detailPanelId}
                  onClick={() => {
                    setSelectedKey(definition.key);
                    revealStackedCatalogDetail(detailPanelId, detailHeadingId);
                  }}
                  sx={{ minHeight: 76, borderBottom: 1, borderColor: 'divider' }}
                >
                  <ListItemText
                    primary={homeT(`widgets.registry.${definition.key}.label`)}
                    secondary={homeT(`widgets.registry.${definition.key}.description`)}
                    primaryTypographyProps={{ variant: 'subtitle2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`homeWidgets.states.${definition.lifecycle}`)}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          {selected && (
            <WidgetDefinitionDetail
              detailId={detailPanelId}
              headingId={detailHeadingId}
              definition={selected}
              label={homeT(`widgets.registry.${selected.key}.label`)}
              description={homeT(`widgets.registry.${selected.key}.description`)}
            />
          )}
        </Box>
      )}
    </Stack>
  );
}

function WidgetDefinitionDetail({
  detailId,
  headingId,
  definition,
  label,
  description,
}: {
  detailId: string;
  headingId: string;
  definition: WorkspaceWidgetCatalogDefinition;
  label: string;
  description: string;
}) {
  const { t } = useTranslation('admin');
  return (
    <Stack
      id={detailId}
      role="region"
      aria-labelledby={headingId}
      gap={2.5}
      sx={{ minWidth: 0, p: { xs: 2, sm: 3 } }}
    >
      <Box>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography id={headingId} component="h2" variant="h6" tabIndex={-1}>
            {label}
          </Typography>
          <Chip
            size="small"
            icon={<FileStack size={14} />}
            label={t('homeWidgets.catalog.providerVerified')}
            variant="outlined"
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        {technicalValue({ label: t('homeWidgets.fields.definitionKey'), value: definition.key })}
        {technicalValue({
          label: t('homeWidgets.fields.ownerProduct'),
          value: definition.ownerProduct,
        })}
        {technicalValue({
          label: t('homeWidgets.fields.sourceApp'),
          value: definition.sourceAppResourceKey,
        })}
        {technicalValue({
          label: t('homeWidgets.fields.dataSource'),
          value: definition.dataSource,
        })}
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2">{t('homeWidgets.catalog.runtimeContract')}</Typography>
        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
          <Chip size="small" label={t(`homeWidgets.runtime.${definition.runtime}`)} />
          <Chip size="small" label={t(`homeWidgets.privacy.${definition.privacyClass}`)} />
          <Chip
            size="small"
            label={t('homeWidgets.catalog.freshness', {
              seconds: definition.freshnessSeconds,
            })}
          />
          <Chip size="small" label={t(`homeWidgets.policyClass.${definition.policyClass}`)} />
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle2">{t('homeWidgets.catalog.allowedSizes')}</Typography>
        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
          {definition.allowedSizes.map((size) => (
            <Chip
              key={size}
              size="small"
              variant="outlined"
              label={t(`homeComposition.sizes.${size}`)}
            />
          ))}
        </Stack>
      </Box>

      <Alert
        icon={definition.configuration ? <Database size={18} /> : <LockKeyhole size={18} />}
        severity={definition.configuration ? 'info' : 'warning'}
      >
        <Typography variant="subtitle2">
          {t(
            definition.configuration
              ? 'homeWidgets.catalog.configurableTitle'
              : 'homeWidgets.catalog.governedTitle'
          )}
        </Typography>
        <Typography variant="body2">
          {t(
            definition.configuration
              ? 'homeWidgets.catalog.configurableDescription'
              : 'homeWidgets.catalog.governedDescription',
            {
              fields: definition.configuration?.fieldKeys.length ?? 0,
              filters: definition.configuration?.filterPresets.length ?? 0,
            }
          )}
        </Typography>
      </Alert>
    </Stack>
  );
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
  const canManage = hasPermission('ADMIN.HOME_TEMPLATE', 'MANAGE') && canWriteSupport;
  const [pending, setPending] = useState<{
    template: HomeTemplate;
    action: 'publish' | 'revoke';
  } | null>(null);
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
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              gap={2}
              sx={{ px: 1, py: 2, borderBottom: 1, borderColor: 'divider' }}
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
              {canManage && (
                <Stack direction="row" gap={0.75} flexWrap="wrap">
                  {template.lifecycle === 'DRAFT' && (
                    <ActionButton
                      size="small"
                      intent="primary"
                      disabled={lifecycleMutation.isPending}
                      onClick={() => setPending({ template, action: 'publish' })}
                    >
                      {t('homeWidgets.blueprints.publish')}
                    </ActionButton>
                  )}
                  {template.lifecycle === 'PUBLISHED' && (
                    <ActionButton
                      size="small"
                      intent="quiet"
                      disabled={lifecycleMutation.isPending}
                      onClick={() => setPending({ template, action: 'revoke' })}
                      sx={{ color: 'error.main' }}
                    >
                      {t('homeWidgets.blueprints.revoke')}
                    </ActionButton>
                  )}
                </Stack>
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
