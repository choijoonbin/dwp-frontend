import { useTranslation } from 'react-i18next';
import { ChevronRight, FilePenLine } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  previewNotificationTemplate,
  type NotificationTemplateContent,
  type NotificationTemplateVariant,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { ActionButton, InlineFeedback, LoadingState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { notificationQueryKeys } from './integration-contract';
import { NotificationChannelTemplatePreview } from './notification-template-preview';
import { NotificationSupportReference } from './notification-error-support';
import { NotificationTemplateDetailWorkspace } from './notification-template-detail-workspace';

export function notificationTemplateVariantKey(variant: NotificationTemplateVariant) {
  return `${variant.typeVersionId}:${variant.channel}:${variant.locale}`;
}

function effectiveRevision(variant: NotificationTemplateVariant) {
  return variant.publishedOverride ?? null;
}

export function effectiveNotificationTemplateContent(variant: NotificationTemplateVariant) {
  return effectiveRevision(variant)?.content ?? variant.providerDefault;
}

export function nextNotificationTemplateVersion(variant: NotificationTemplateVariant) {
  return variant.version;
}

function effectivePreviewSamples(variables: string[], locale: string): Record<string, string> {
  let korean = false;
  try {
    korean = new Intl.Locale(locale).language === 'ko';
  } catch {
    korean = false;
  }
  const values: Record<string, string> = {};
  for (const variable of variables) {
    const normalized = variable.toLowerCase();
    values[variable] = normalized.includes('name')
      ? korean
        ? '합성 사용자'
        : 'Synthetic user'
      : normalized.includes('title')
        ? korean
          ? '클라우드 운영 예산'
          : 'Cloud operations budget'
        : normalized.includes('message')
          ? korean
            ? '검토 의견을 남겼습니다.'
            : 'Left a review comment.'
          : normalized.includes('due')
            ? korean
              ? '오늘 오후 5시'
              : 'Today at 5:00 PM'
            : normalized.endsWith('id')
              ? 'sample-001'
              : korean
                ? `예시 ${variable}`
                : `Sample ${variable}`;
  }
  return values;
}

export function NotificationTemplateVariantRow({
  variant,
  selected,
  onSelect,
}: {
  variant: NotificationTemplateVariant;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('notifications');
  return (
    <ButtonBase
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        width: 1,
        minHeight: 76,
        px: 1.75,
        py: 1.25,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 1,
        textAlign: 'left',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: selected ? 'action.selected' : 'transparent',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box minWidth={0}>
        <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
          {variant.displayName}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', overflowWrap: 'anywhere' }}
        >
          {variant.appName} · {variant.channel} · {variant.locale}
        </Typography>
        <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
          <Chip
            size="small"
            variant="outlined"
            color={variant.publishedOverride ? 'info' : 'default'}
            label={t(
              variant.publishedOverride
                ? 'admin.templates.tenantOverride'
                : 'admin.templates.providerDefault'
            )}
          />
          {variant.draft && (
            <Chip
              size="small"
              variant="outlined"
              color="warning"
              label={t('admin.templates.draft')}
            />
          )}
        </Stack>
      </Box>
      <Stack direction="row" gap={0.75} alignItems="center">
        {variant.publishedOverride && (
          <Typography variant="caption" color="text.secondary">
            {`r${variant.publishedOverride.revision}`}
          </Typography>
        )}
        <ChevronRight size={18} aria-hidden />
      </Stack>
    </ButtonBase>
  );
}

export function NotificationTemplateCatalogDetail({
  variant,
  canManage,
  onEdit,
}: {
  variant: NotificationTemplateVariant;
  canManage: boolean;
  onEdit: (content?: NotificationTemplateContent) => void;
}) {
  const { t } = useTranslation('notifications');
  const revision = effectiveRevision(variant);
  const content = effectiveNotificationTemplateContent(variant);
  const effectivePreview = useQuery({
    queryKey: [
      ...notificationQueryKeys.adminTemplates(),
      'effective-preview',
      notificationTemplateVariantKey(variant),
      revision?.checksum ?? variant.version,
    ],
    queryFn: ({ signal }) =>
      previewNotificationTemplate(
        {
          typeVersionId: variant.typeVersionId,
          channel: variant.channel,
          locale: variant.locale,
          ...content,
          sampleData: effectivePreviewSamples(variant.allowedVariables, variant.locale),
        },
        signal
      ),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return (
    <Box component="section" sx={{ minWidth: 0, p: { xs: 1.5, md: 2 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        gap={1.5}
      >
        <Box minWidth={0}>
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <Chip size="small" variant="outlined" label={variant.appName} />
            <Chip size="small" variant="outlined" label={variant.channel} />
            <Chip size="small" variant="outlined" label={variant.locale} />
          </Stack>
          <Typography component="h2" variant="h6" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
            {variant.displayName}
          </Typography>
          <Typography
            component="code"
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}
          >
            {variant.typeKey}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {revision
              ? t('admin.templates.effectiveTenantRevision', { revision: revision.revision })
              : t('admin.templates.effectiveProviderRevision')}
          </Typography>
          {variant.draft && (
            <ActionButton
              component="a"
              intent="quiet"
              size="small"
              href={`#notification-template-review-${variant.draft.revisionId}`}
            >
              {t('admin.templates.draft')} {`· r${variant.draft.revision}`}
            </ActionButton>
          )}
        </Box>
        {canManage && (
          <ActionButton
            intent="secondary"
            startIcon={<FilePenLine size={17} />}
            onClick={() => onEdit()}
            disabled={Boolean(variant.draft)}
          >
            {variant.draft
              ? t('admin.templates.openDraftExists')
              : t('admin.templates.proposeOverride')}
          </ActionButton>
        )}
      </Stack>

      <NotificationTemplateDetailWorkspace
        variant={variant}
        content={content}
        canManage={canManage}
        onEdit={onEdit}
      >
        <Box sx={{ minWidth: 0 }}>
          {effectivePreview.isLoading ? (
            <LoadingState
              label={t('admin.templates.previewing')}
              variant="skeleton"
              skeletonRows={3}
            />
          ) : effectivePreview.isError || !effectivePreview.data ? (
            <InlineFeedback severity="warning" title={t('admin.templates.effectivePreviewFailed')}>
              <Stack gap={0.75} alignItems="flex-start">
                <ActionButton
                  intent="secondary"
                  size="small"
                  onClick={() => void effectivePreview.refetch()}
                >
                  {t('actions.retry')}
                </ActionButton>
                <NotificationSupportReference error={effectivePreview.error} />
              </Stack>
            </InlineFeedback>
          ) : (
            <NotificationChannelTemplatePreview
              variant={variant}
              content={effectivePreview.data.rendered}
              label={t('admin.templates.effectivePreview')}
            />
          )}
        </Box>
      </NotificationTemplateDetailWorkspace>
    </Box>
  );
}
