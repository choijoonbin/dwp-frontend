import { useTranslation } from 'react-i18next';
import {
  ArchiveRestore,
  ChevronRight,
  Clock3,
  History,
  LibraryBig,
  ShieldCheck,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  SavedViewCustodyUser,
  SavedViewOwnershipDisposition,
} from '@dwp-frontend/shared-utils';
import type { TFunction } from 'i18next';
import type { LucideIcon } from 'lucide-react';

const SURFACE_TRANSLATION_KEYS: Record<string, string> = {
  'communications.work': 'savedViewCustody.surfaces.communicationsWork',
  'communications.management': 'savedViewCustody.surfaces.communicationsManagement',
  'approvals.work': 'savedViewCustody.surfaces.approvalsWork',
  'hcm.operations': 'savedViewCustody.surfaces.hcmOperations',
  'hcm.management': 'savedViewCustody.surfaces.hcmManagement',
  'services.work': 'savedViewCustody.surfaces.servicesWork',
  'services.management': 'savedViewCustody.surfaces.servicesManagement',
  'workspace.home': 'savedViewCustody.surfaces.workspaceHome',
  'workspace.work': 'savedViewCustody.surfaces.workspaceWork',
  'workspace.activity': 'savedViewCustody.surfaces.workspaceActivity',
  'workspace.apps': 'savedViewCustody.surfaces.workspaceApps',
  'people.workforce-directory': 'savedViewCustody.surfaces.workforceDirectory',
  'workforce.operations-overview': 'savedViewCustody.surfaces.workforceOperations',
  'calendar.schedule': 'savedViewCustody.surfaces.calendarSchedule',
};

export function userIdentityLabel(user: SavedViewCustodyUser) {
  return user.email ? user.displayName + ' (' + user.email + ')' : user.displayName;
}

export function statusLabel(status: string, t: TFunction<'admin'>) {
  return t('savedViewCustody.statuses.' + status, { defaultValue: status });
}

export function userOptionLabel(user: SavedViewCustodyUser, t: TFunction<'admin'>) {
  return userIdentityLabel(user) + ' · ' + statusLabel(user.status, t);
}

export function displayDate(value?: string | null) {
  return value ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
}

export function dispositionLabel(value: SavedViewOwnershipDisposition, t: TFunction<'admin'>) {
  return t('savedViewCustody.dispositions.' + value);
}

export function surfaceLabel(value: string, t: TFunction<'admin'>) {
  const key = SURFACE_TRANSLATION_KEYS[value];
  return key ? t(key) : value;
}

export function StepTitle({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <Stack direction="row" gap={1.25} alignItems="flex-start">
      <Box
        aria-hidden="true"
        sx={{
          width: 26,
          height: 26,
          flex: '0 0 auto',
          borderRadius: '50%',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'grid',
          placeItems: 'center',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {step}
      </Box>
      <Box>
        <Typography component="h3" variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
    </Stack>
  );
}

function StatusMetric({
  label,
  helper,
  value,
  icon: Icon,
  onClick,
}: {
  label: string;
  helper: string;
  value: number | null;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={`${label}: ${value === null ? '—' : value}. ${helper}`}
      onClick={onClick}
      sx={{
        appearance: 'none',
        border: 0,
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'transparent',
        color: 'text.primary',
        textAlign: 'left',
        p: { xs: 1.25, md: 2 },
        cursor: 'pointer',
        '&:last-of-type': { borderRight: 0 },
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': {
          outline: '3px solid',
          outlineColor: 'primary.main',
          outlineOffset: -3,
        },
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems="flex-start"
        gap={{ xs: 0.25, sm: 1.25 }}
      >
        <Box sx={{ color: 'primary.main', mt: 0.25 }}>
          <Icon size={19} aria-hidden="true" />
        </Box>
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', lineHeight: 1.25 }}
          >
            {label}
          </Typography>
          <Typography component="p" variant="h5" sx={{ lineHeight: 1.25 }}>
            {value === null ? '—' : value}
          </Typography>
          <Typography
            component="p"
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            {helper}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

export function SectionLoadError({
  message,
  retryLabel,
  retrying = false,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  retrying?: boolean;
  onRetry: () => void;
}) {
  return (
    <Alert
      severity="error"
      action={
        <ActionButton intent="quiet" size="small" loading={retrying} onClick={onRetry}>
          {retryLabel}
        </ActionButton>
      }
    >
      {message}
    </Alert>
  );
}

export function SavedViewCustodyExplainer() {
  const { t } = useTranslation('admin');
  return (
    <>
      <Box
        component="details"
        sx={{
          display: { xs: 'block', md: 'none' },
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'action.hover',
          '&[open] > summary': { borderBottom: 1, borderColor: 'divider' },
          '&[open] .saved-view-explainer-chevron': { transform: 'rotate(90deg)' },
        }}
      >
        <Box
          component="summary"
          sx={{
            cursor: 'pointer',
            p: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            listStyle: 'none',
            '&::-webkit-details-marker': { display: 'none' },
            '&:focus-visible': {
              outline: '3px solid',
              outlineColor: 'primary.main',
              outlineOffset: 2,
            },
          }}
        >
          <ChevronRight
            className="saved-view-explainer-chevron"
            size={19}
            aria-hidden="true"
            style={{ flex: '0 0 auto', marginTop: 2 }}
          />
          <Box>
            <Typography variant="overline" color="primary.main" fontWeight={700}>
              {t('savedViewCustody.explainer.eyebrow')}
            </Typography>
            <Typography component="span" variant="body2" fontWeight={700} display="block">
              {t('savedViewCustody.explainer.title')}
            </Typography>
          </Box>
        </Box>
        <Stack gap={1.25} sx={{ p: 1.5 }}>
          <ExplainerDefinition />
          <SavedViewFlowSteps />
        </Stack>
      </Box>

      <Box
        component="section"
        aria-labelledby="saved-view-explainer-title"
        sx={{
          display: { xs: 'none', md: 'grid' },
          gridTemplateColumns: { md: '1fr', lg: 'minmax(0, 1.4fr) minmax(340px, 1fr)' },
          gap: 3,
          p: 2.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'action.hover',
        }}
      >
        <Stack gap={1.25}>
          <Stack direction="row" alignItems="center" gap={1}>
            <LibraryBig size={20} aria-hidden="true" />
            <Typography variant="overline" color="primary.main" fontWeight={700}>
              {t('savedViewCustody.explainer.eyebrow')}
            </Typography>
          </Stack>
          <Typography id="saved-view-explainer-title" component="h2" variant="h6">
            {t('savedViewCustody.explainer.title')}
          </Typography>
          <ExplainerDefinition />
        </Stack>
        <SavedViewFlowSteps />
      </Box>
    </>
  );
}

function ExplainerDefinition() {
  const { t } = useTranslation('admin');
  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 780 }}>
        {t('savedViewCustody.explainer.description')}
      </Typography>
      <Stack direction="row" gap={0.75} flexWrap="wrap">
        {(['filters', 'sort', 'columns'] as const).map((item) => (
          <Chip
            key={item}
            size="small"
            variant="outlined"
            label={t('savedViewCustody.explainer.examples.' + item)}
          />
        ))}
      </Stack>
      <Alert severity="info" icon={<ShieldCheck size={20} />}>
        {t('savedViewCustody.explainer.boundary')}
      </Alert>
    </>
  );
}

function SavedViewFlowSteps() {
  const { t } = useTranslation('admin');
  return (
    <Stack component="ol" gap={1.25} sx={{ m: 0, p: 0, listStyle: 'none' }}>
      {(['select', 'review', 'decide', 'record'] as const).map((step, index) => (
        <Stack component="li" key={step} direction="row" alignItems="center" gap={1.25}>
          <Box
            aria-hidden="true"
            sx={{
              width: 24,
              height: 24,
              flex: '0 0 auto',
              borderRadius: '50%',
              border: 1,
              borderColor: 'primary.main',
              color: 'primary.main',
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {index + 1}
          </Box>
          <Box>
            <Typography variant="body2" fontWeight={700}>
              {t('savedViewCustody.explainer.steps.' + step + '.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('savedViewCustody.explainer.steps.' + step + '.description')}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

export function SavedViewCustodyMetrics({
  orphanedCount,
  expiringSoon,
  historyCount,
  updatedAt,
  refreshing,
  onOpenOrphaned,
  onOpenHistory,
}: {
  orphanedCount: number | null;
  expiringSoon: number | null;
  historyCount: number | null;
  updatedAt: string | null;
  refreshing: boolean;
  onOpenOrphaned: () => void;
  onOpenHistory: () => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <Stack component="section" gap={0.75} aria-labelledby="saved-view-custody-metrics-title">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={0.25}
      >
        <Typography id="saved-view-custody-metrics-title" component="h2" variant="subtitle2">
          {t('savedViewCustody.metrics.label')}
        </Typography>
        <Stack direction="row" alignItems="center" gap={0.5} aria-live="polite">
          <Clock3 size={14} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            {refreshing
              ? t('savedViewCustody.metrics.refreshing')
              : updatedAt
                ? t('savedViewCustody.metrics.updatedAt', { value: displayDate(updatedAt) })
                : t('savedViewCustody.metrics.notUpdated')}
          </Typography>
        </Stack>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        <StatusMetric
          label={t('savedViewCustody.metrics.orphaned')}
          helper={t('savedViewCustody.metrics.orphanedHelp')}
          value={orphanedCount}
          icon={ArchiveRestore}
          onClick={onOpenOrphaned}
        />
        <StatusMetric
          label={t('savedViewCustody.metrics.expiringSoon')}
          helper={t('savedViewCustody.metrics.expiringSoonHelp')}
          value={expiringSoon}
          icon={Clock3}
          onClick={onOpenOrphaned}
        />
        <StatusMetric
          label={t('savedViewCustody.metrics.recentTransfers')}
          helper={t('savedViewCustody.metrics.recentTransfersHelp')}
          value={historyCount}
          icon={History}
          onClick={onOpenHistory}
        />
      </Box>
    </Stack>
  );
}
