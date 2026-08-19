import { useTranslation } from 'react-i18next';
import {
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Gauge,
  Layers3,
  MapPinned,
  Monitor,
  ShieldCheck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { getWorkplaceAdminOverview } from '@dwp-frontend/shared-utils';
import { ActionButton, PageCanvas } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { RoomsPageHeading } from './rooms-ui';

import type { LucideIcon } from 'lucide-react';

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper', p: 2, minHeight: 118 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Box sx={{ width: 34, height: 34, display: 'grid', placeItems: 'center', color: 'var(--dwp-product-accent)', bgcolor: 'var(--dwp-product-soft)' }}>
          <Icon size={18} />
        </Box>
      </Stack>
      <Typography variant="h4" fontWeight={800} sx={{ mt: 1 }}>{value}</Typography>
    </Box>
  );
}

export function WorkplaceAdminOverview() {
  const { t } = useTranslation('rooms');
  const query = useQuery({
    queryKey: ['workplace', 'admin', 'overview'],
    queryFn: getWorkplaceAdminOverview,
    staleTime: 30_000,
    retry: 1,
  });
  const overview = query.data;

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('workplace.admin.overview.eyebrow')}
        title={t('workplace.admin.overview.title')}
        description={t('workplace.admin.overview.description')}
        actions={
          <>
            <ActionButton component={NavLink} to="/workplace/admin/locations" intent="secondary" startIcon={<MapPinned size={17} />}>
              {t('workplace.admin.overview.manageLocations')}
            </ActionButton>
            <ActionButton component={NavLink} to="/workplace/admin/policies" intent="primary" startIcon={<ShieldCheck size={17} />}>
              {t('workplace.admin.overview.managePolicy')}
            </ActionButton>
          </>
        }
      />
      {query.isError && (
        <Alert severity="error" action={<ActionButton intent="quiet" onClick={() => query.refetch()}>{t('actions.retry')}</ActionButton>}>
          {t('workplace.admin.overview.loadError')}
        </Alert>
      )}
      {query.isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1.5 }}>
          {[0, 1, 2, 3].map((value) => <Skeleton key={value} variant="rectangular" height={118} />)}
        </Box>
      ) : overview ? (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1.5 }}>
            <Metric icon={Building2} label={t('workplace.admin.overview.activeSites')} value={overview.activeSites} />
            <Metric icon={Layers3} label={t('workplace.admin.overview.configuredFloors')} value={overview.configuredFloors} />
            <Metric icon={Monitor} label={t('workplace.admin.overview.reservable')} value={overview.reservableResources} />
            <Metric icon={CalendarCheck2} label={t('workplace.admin.overview.weekBookings')} value={overview.bookingsThisWeek} />
          </Box>
          <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.35fr 1fr' }, gap: 1.5 }}>
            <Box sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper', p: 2.25 }}>
              <Stack direction="row" gap={1} alignItems="center">
                <Gauge size={19} color="var(--dwp-product-accent)" />
                <Typography variant="h6" fontWeight={750}>{t('workplace.admin.overview.utilization')}</Typography>
              </Stack>
              <Typography variant="h3" fontWeight={800} sx={{ mt: 2 }}>{overview.utilizationPercent}%</Typography>
              <LinearProgress variant="determinate" value={overview.utilizationPercent} sx={{ mt: 1, height: 8 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>{t('workplace.admin.overview.utilizationHint')}</Typography>
            </Box>
            <Box sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper', p: 2.25 }}>
              <Stack direction="row" gap={1} alignItems="center">
                <CheckCircle2 size={19} color="var(--dwp-product-accent)" />
                <Typography variant="h6" fontWeight={750}>{t('workplace.admin.overview.policySnapshot')}</Typography>
              </Stack>
              <Stack gap={1.4} sx={{ mt: 2 }}>
                <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">{t('workplace.admin.policy.bookingWindow')}</Typography><Typography variant="body2" fontWeight={750}>{t('workplace.admin.policy.days', { count: overview.policy.bookingWindowDays })}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">{t('workplace.admin.policy.activeLimit')}</Typography><Typography variant="body2" fontWeight={750}>{overview.policy.maximumActiveBookings}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">{t('workplace.admin.policy.checkIn')}</Typography><Typography variant="body2" fontWeight={750}>{overview.policy.requireCheckIn ? t('workplace.admin.policy.enabled') : t('workplace.admin.policy.disabled')}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">{t('workplace.admin.overview.assignedSeats')}</Typography><Typography variant="body2" fontWeight={750}>{overview.assignedResources}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">{t('workplace.admin.overview.checkedInToday')}</Typography><Typography variant="body2" fontWeight={750}>{overview.checkedInToday}</Typography></Stack>
              </Stack>
            </Box>
          </Box>
        </>
      ) : null}
    </PageCanvas>
  );
}
