import { useTranslation } from 'react-i18next';
import {
  Building2,
  CalendarClock,
  ChevronDown,
  Database,
  Download,
  ListChecks,
  ShieldCheck,
  UserRound,
  UserRoundCog,
} from 'lucide-react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { summarizeWorkforceAccess } from './workforce-access-model';

import type { WorkforceAccessPolicy } from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

const STEPS = [
  { key: 'subject', icon: UserRound },
  { key: 'organization', icon: Building2 },
  { key: 'data', icon: Database },
  { key: 'action', icon: ListChecks },
  { key: 'validity', icon: CalendarClock },
] as const;

function Metric({
  icon: Icon,
  label,
  description,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  value: number;
  color: string;
}) {
  return (
    <Box
      component="article"
      aria-label={label}
      sx={{ minWidth: 0, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {label}
        </Typography>
        <Icon size={18} color="currentColor" aria-hidden="true" />
      </Stack>
      <Typography
        component="p"
        variant="h4"
        color={color}
        sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {description}
      </Typography>
    </Box>
  );
}

function AccessTerm({ children, emphasized = false }: { children: string; emphasized?: boolean }) {
  return (
    <Box
      sx={{
        minWidth: 0,
        px: 1.5,
        py: 1.25,
        border: 1,
        borderColor: emphasized ? 'primary.main' : 'divider',
        borderRadius: 1.5,
        bgcolor: emphasized ? 'primary.main' : 'background.paper',
        color: emphasized ? 'primary.contrastText' : 'text.primary',
        textAlign: 'center',
      }}
    >
      <Typography variant="subtitle2">{children}</Typography>
    </Box>
  );
}

type OverviewMetric = {
  key: 'active' | 'userOverrides' | 'exportEnabled' | 'expiringSoon';
  icon: LucideIcon;
  value: number;
  color: string;
};

function WorkforceAccessOverviewContent({
  titleId,
  metrics,
  hasPolicies,
  compact = false,
}: {
  titleId: string;
  metrics: readonly OverviewMetric[];
  hasPolicies: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation('admin');
  return (
    <Stack
      gap={2}
      sx={
        compact
          ? { px: 1.5, pb: 1.5 }
          : { p: { sm: 2, md: 2.5 }, border: 1, borderColor: 'divider', borderRadius: 2 }
      }
    >
      {!compact && (
        <Box sx={{ maxWidth: 900 }}>
          <Typography id={titleId} variant="h6" fontWeight={750}>
            {t('workforceAccess.overview.title')}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {t('workforceAccess.overview.description')}
          </Typography>
        </Box>
      )}

      <Box
        component="ol"
        aria-label={t('workforceAccess.overview.ariaLabel')}
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(5, minmax(0, 1fr))',
          },
          gap: 1,
          p: 0,
          m: 0,
          listStyle: 'none',
        }}
      >
        {STEPS.map(({ key, icon: Icon }, index) => (
          <Box
            component="li"
            key={key}
            sx={{ minWidth: 0, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5 }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Box sx={{ display: 'flex', color: 'primary.main' }}>
                <Icon size={19} aria-hidden="true" />
              </Box>
              <Typography variant="overline" color="text.secondary">
                {String(index + 1).padStart(2, '0')}
              </Typography>
            </Stack>
            <Typography variant="subtitle2" sx={{ mt: 0.75 }}>
              {t(`workforceAccess.overview.steps.${key}.title`)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t(`workforceAccess.overview.steps.${key}.description`)}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: hasPolicies ? 'minmax(0, 1.45fr) minmax(420px, 0.8fr)' : '1fr',
          },
          gap: 1.5,
        }}
      >
        <Stack gap={1.5}>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2">
              {t('workforceAccess.overview.intersection.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('workforceAccess.overview.intersection.description')}
            </Typography>
            <Box
              role="group"
              aria-label={t('workforceAccess.overview.intersection.title')}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr)',
                },
                alignItems: 'center',
                gap: 0.75,
                mt: 1.5,
              }}
            >
              <AccessTerm>{t('workforceAccess.overview.intersection.rolePermission')}</AccessTerm>
              <Typography aria-hidden="true" textAlign="center" fontWeight={800}>
                ∩
              </Typography>
              <AccessTerm>{t('workforceAccess.overview.intersection.accessPolicy')}</AccessTerm>
              <Typography aria-hidden="true" textAlign="center" fontWeight={800}>
                =
              </Typography>
              <AccessTerm emphasized>
                {t('workforceAccess.overview.intersection.effectiveAccess')}
              </AccessTerm>
            </Box>
          </Box>

          <Stack
            component="aside"
            role="note"
            direction="row"
            alignItems="flex-start"
            gap={1.25}
            sx={{ p: 1.5, borderLeft: 3, borderColor: 'info.main', bgcolor: 'action.hover' }}
          >
            <UserRoundCog size={20} aria-hidden="true" />
            <Box>
              <Typography variant="subtitle2">
                {t('workforceAccess.overview.override.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {t('workforceAccess.overview.override.description')}
              </Typography>
            </Box>
          </Stack>
        </Stack>

        {hasPolicies && (
          <Box
            component="section"
            aria-label={t('workforceAccess.metrics.ariaLabel')}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 1,
            }}
          >
            {metrics.map(({ key, ...metric }) => (
              <Metric
                key={key}
                {...metric}
                label={t(`workforceAccess.metrics.${key}`)}
                description={t(`workforceAccess.metrics.${key}Description`)}
              />
            ))}
          </Box>
        )}
      </Box>
    </Stack>
  );
}

export function WorkforceAccessOverview({
  policies,
}: {
  policies?: readonly WorkforceAccessPolicy[];
}) {
  const { t } = useTranslation('admin');
  const summary = summarizeWorkforceAccess(policies ?? []);
  const metrics: readonly OverviewMetric[] = [
    {
      key: 'active',
      icon: ShieldCheck,
      value: summary.active,
      color: 'success.main',
    },
    {
      key: 'userOverrides',
      icon: UserRoundCog,
      value: summary.userOverrides,
      color: 'info.main',
    },
    {
      key: 'exportEnabled',
      icon: Download,
      value: summary.exportEnabled,
      color: 'primary.main',
    },
    {
      key: 'expiringSoon',
      icon: CalendarClock,
      value: summary.expiringSoon,
      color: 'warning.dark',
    },
  ];

  return (
    <>
      <Box
        component="section"
        aria-labelledby="workforce-access-overview-mobile-title"
        sx={{ display: { xs: 'block', sm: 'none' } }}
      >
        <Box
          component="details"
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: 'background.paper',
            '&[open] [data-overview-chevron]': { transform: 'rotate(180deg)' },
          }}
        >
          <Box
            component="summary"
            aria-controls="workforce-access-overview-mobile-content"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              minHeight: 56,
              px: 1.5,
              py: 1.25,
              cursor: 'pointer',
              listStyle: 'none',
              '&::-webkit-details-marker': { display: 'none' },
              '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main' },
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography id="workforce-access-overview-mobile-title" variant="subtitle2">
                {t('workforceAccess.overview.mobileSummaryTitle')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('workforceAccess.overview.mobileSummaryDescription', {
                  count: summary.active,
                })}
              </Typography>
            </Box>
            <ChevronDown data-overview-chevron size={18} aria-hidden="true" />
          </Box>
          <Box id="workforce-access-overview-mobile-content">
            <WorkforceAccessOverviewContent
              compact
              titleId="workforce-access-overview-mobile-title"
              metrics={metrics}
              hasPolicies={Boolean(policies)}
            />
          </Box>
        </Box>
      </Box>

      <Box
        component="section"
        aria-labelledby="workforce-access-overview-desktop-title"
        sx={{ display: { xs: 'none', sm: 'block' } }}
      >
        <WorkforceAccessOverviewContent
          titleId="workforce-access-overview-desktop-title"
          metrics={metrics}
          hasPolicies={Boolean(policies)}
        />
      </Box>
    </>
  );
}
