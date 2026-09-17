import { InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system';
import { formatWorkplaceExperienceInstant } from './workplace-experience-format';
import { useQueries, useQuery } from '@tanstack/react-query';
import { getWorkplaceFacilityRequests, getRoomsAdminOverview } from '@dwp-frontend/shared-utils';
import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useSearchParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarCheck2,
  Gauge,
  Wrench,
  ArrowUpRight,
  BarChart3,
} from 'lucide-react';
import { ActionButton, EmptyState, PageCanvas } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { RoomsPageHeading } from './rooms-ui';
import {
  useWorkplaceExperienceReportScope,
  WorkplaceExperienceReportControls,
} from './workplace-experience-report-scope';
import {
  WorkplaceExperienceQueryError,
  WorkplaceExperienceFreshness,
} from './workplace-experience-ui';
import {
  WorkplaceAdminFloorRows,
  WorkplaceAdminMetric,
  WorkplaceAdminSection,
} from './workplace-admin-experience-ui';
import { WorkplaceAdminFloorPreview } from './workplace-admin-floor-preview';
import { WorkplaceAdminInsights } from './workplace-admin-insights';
import { WorkplaceExperienceBookingInspector } from './workplace-experience-booking-inspector';

export function WorkplaceAdminExperienceOverview() {
  const { t } = useTranslation('rooms');
  const [params, setParams] = useSearchParams();
  return (
    <>
      <Stack direction="row" gap={1} sx={{ px: { xs: 2, md: 3, xl: 4 }, pt: 2 }}>
        {(['overview', 'insights'] as const).map((view) => (
          <ActionButton
            key={view}
            intent={(params.get('view') ?? 'overview') === view ? 'primary' : 'quiet'}
            startIcon={view === 'insights' ? <BarChart3 size={16} /> : <Gauge size={16} />}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set('view', view);
              setParams(next, { replace: true });
            }}
          >
            {t(`workplace.experience.${view}`)}
          </ActionButton>
        ))}
      </Stack>
      {params.get('view') === 'insights' ? <WorkplaceAdminInsights /> : <ExperienceOverview />}
    </>
  );
}

function ExperienceOverview() {
  const { t } = useTranslation('rooms');
  const scope = useWorkplaceExperienceReportScope();
  const report = scope.report;
  const navigate = useNavigate();
  const authority = useWorkplaceExperienceAuthority();
  const requests = useQueries({
    queries: (['OPEN', 'IN_PROGRESS'] as const).map((status) => ({
      queryKey: [
        'workplace',
        'overview-active-requests',
        authority,
        scope.site?.siteId,
        scope.floorId,
        status,
      ],
      queryFn: () =>
        getWorkplaceFacilityRequests(
          { siteId: scope.site!.siteId, floorId: scope.floorId, status, page: 0, size: 1 },
          true
        ),
      enabled:
        Boolean(scope.site) &&
        scope.capabilities.canViewWorkplaceAdmin &&
        !scope.sitesQuery.isError &&
        !scope.floorsQuery.isError,
      staleTime: 15_000,
      refetchInterval: 30_000,
      retry: false,
    })),
  });
  const approvals = useQuery({
    queryKey: ['rooms', 'admin-overview-approval-count', authority],
    queryFn: getRoomsAdminOverview,
    enabled: scope.capabilities.isLoaded && scope.capabilities.canViewRoomsAdmin,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const pendingApprovals =
    !approvals.isError && scope.capabilities.canViewRoomsAdmin
      ? (approvals.data?.pendingBookings ?? null)
      : null;
  const openRequestCount = requests.every((query) => query.isSuccess && !query.isError)
    ? requests.reduce((total, query) => total + (query.data?.totalElements ?? 0), 0)
    : null;
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  useEffect(
    () => setSelectedBooking(null),
    [scope.site?.siteId, scope.floorId, scope.range?.start, scope.range?.end]
  );
  const rate = (value: number | null) => (value === null ? null : `${value.toFixed(1)}%`);
  const previewFloor =
    scope.floors.find((floor) => floor.floorId === scope.floorId) ?? scope.floors[0] ?? null;
  return (
    <PageCanvas topInset="compact">
      <RoomsPageHeading
        eyebrow={t('workplace.admin.overview.eyebrow')}
        title={t('workplace.admin.overview.title')}
        description={t('workplace.experience.overviewDescription')}
        actions={
          <Stack direction="row" gap={1} flexWrap="wrap">
            <ActionButton
              component={NavLink}
              to="/workplace/admin/operations?view=bookings"
              intent="secondary"
              startIcon={<Wrench size={16} />}
            >
              {t('workplace.admin.operations.title')}
            </ActionButton>
            <ActionButton
              component={NavLink}
              to="/workplace/admin/locations"
              intent="primary"
              startIcon={<ArrowUpRight size={16} />}
            >
              {t('workplace.admin.overview.manageLocations')}
            </ActionButton>
          </Stack>
        }
      />
      {scope.sitesQuery.isError ? (
        <WorkplaceExperienceQueryError retry={() => void scope.sitesQuery.refetch()} />
      ) : null}
      {scope.sitesQuery.isLoading ? (
        <LoadingState
          variant="skeleton"
          embedded
          skeletonRows={1}
          skeletonHeight={320}
          label={t('workplace.experience.refreshing')}
        />
      ) : !scope.site ? (
        <EmptyState
          title={t('workplace.admin.locations.emptySites')}
          description={t('workplace.admin.locations.emptySitesDescription')}
        />
      ) : (
        <>
          <WorkplaceExperienceReportControls scope={scope} />
          {scope.reportQuery.isError ? (
            <WorkplaceExperienceQueryError retry={() => void scope.reportQuery.refetch()} />
          ) : null}
          {scope.reportQuery.isLoading ? (
            <LoadingState
              variant="skeleton"
              embedded
              skeletonRows={1}
              skeletonHeight={420}
              label={t('workplace.experience.refreshing')}
            />
          ) : report ? (
            <Stack gap={2}>
              <Stack
                direction="row"
                gap={1}
                justifyContent="space-between"
                flexWrap="wrap"
                alignItems="center"
              >
                <Typography variant="caption" color="text.secondary">
                  {report.scope.siteName} · {report.scope.from} – {scope.range?.end}
                </Typography>
                <WorkplaceExperienceFreshness
                  at={report.metadata.generatedAt}
                  refreshing={scope.reportQuery.isFetching}
                />
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    lg: 'repeat(4, minmax(0, 1fr))',
                  },
                  gap: 1.5,
                }}
              >
                <WorkplaceAdminMetric
                  icon={AlertTriangle}
                  tone="error"
                  label={t('workplace.experience.needsAttention')}
                  value={report.exceptions.totalElements}
                  detail={t('workplace.experience.polish.latestExceptions')}
                  onClick={
                    report.exceptions.content[0]
                      ? () => setSelectedBooking(report.exceptions.content[0].bookingId)
                      : undefined
                  }
                />
                <WorkplaceAdminMetric
                  icon={CalendarCheck2}
                  label={t('workplace.experience.polish.pendingApprovals')}
                  value={pendingApprovals}
                  detail={t('workplace.experience.polish.approvalCountDefinition')}
                  onClick={
                    scope.capabilities.canViewRoomsAdmin
                      ? () => navigate('/workplace/admin/meeting-operations')
                      : undefined
                  }
                />
                <WorkplaceAdminMetric
                  icon={Wrench}
                  tone="secondary"
                  label={t('workplace.experience.polish.currentRequests')}
                  value={openRequestCount}
                  detail={t('workplace.experience.polish.requestCountDefinition')}
                  onClick={() => {
                    navigate(
                      `/workplace/admin/operations?view=facilities&site=${encodeURIComponent(report.scope.siteId)}${scope.floorId ? `&floor=${encodeURIComponent(scope.floorId)}` : ''}`
                    );
                  }}
                />
                <WorkplaceAdminMetric
                  icon={Gauge}
                  label={t('workplace.experience.utilization')}
                  value={rate(report.summary.utilizationPercent)}
                  detail={t('workplace.experience.resourceCount', {
                    count: report.current.reservableResources,
                  })}
                />
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.65fr) minmax(0, 1fr)' },
                  gap: 2,
                  alignItems: 'start',
                }}
              >
                <WorkplaceAdminSection
                  title={t('workplace.experience.priorityExceptions')}
                  description={t('workplace.experience.polish.countShown', {
                    count: report.exceptions.content.length,
                    total: report.exceptions.totalElements,
                  })}
                  actions={
                    <ActionButton
                      component={NavLink}
                      to="/workplace/admin/operations?view=bookings"
                      intent="quiet"
                      endIcon={<ArrowUpRight size={15} />}
                    >
                      {t('workplace.experience.allOperations')}
                    </ActionButton>
                  }
                >
                  {report.exceptions.content.length === 0 ? (
                    <EmptyState title={t('workplace.experience.noExceptions')} />
                  ) : (
                    <Stack gap={1}>
                      <Box sx={{ maxHeight: 430, overflowY: 'auto' }}>
                        {report.exceptions.content.map((booking) => (
                          <Box
                            key={booking.bookingId}
                            sx={{
                              bgcolor: 'var(--dwp-product-soft)',
                              borderRadius: foundationTokens.radius.control + 'px',
                              borderLeft: 3,
                              borderLeftColor:
                                booking.status === 'NO_SHOW' ? 'warning.main' : 'error.main',
                              p: 1.25,
                              mb: 1,
                            }}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              gap={1}
                              flexWrap="wrap"
                            >
                              <Box>
                                <Typography fontWeight={(theme) => theme.typography.fontWeightBold}>
                                  {booking.resourceName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {booking.floorName}
                                </Typography>
                              </Box>
                              <Chip
                                size="small"
                                color={booking.status === 'NO_SHOW' ? 'warning' : 'error'}
                                variant="outlined"
                                label={t(`workplace.bookingStatus.${booking.status}`)}
                              />
                            </Stack>
                            <Stack
                              direction="row"
                              gap={1}
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ mt: 1 }}
                            >
                              <Typography variant="caption">
                                {formatWorkplaceExperienceInstant(
                                  booking.startsAt,
                                  report.scope.timeZone
                                )}
                              </Typography>
                              <ActionButton
                                intent="primary"
                                onClick={() => setSelectedBooking(booking.bookingId)}
                              >
                                {t('workplace.experience.review')}
                              </ActionButton>
                            </Stack>
                          </Box>
                        ))}
                      </Box>
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <ActionButton
                          intent="quiet"
                          disabled={scope.page === 0}
                          onClick={() => scope.update({ exceptionPage: String(scope.page - 1) })}
                        >
                          {t('workplace.experience.previous')}
                        </ActionButton>
                        <ActionButton
                          intent="quiet"
                          disabled={scope.page + 1 >= report.exceptions.totalPages}
                          onClick={() => scope.update({ exceptionPage: String(scope.page + 1) })}
                        >
                          {t('workplace.experience.next')}
                        </ActionButton>
                      </Stack>
                    </Stack>
                  )}
                </WorkplaceAdminSection>
                <Stack gap={1.5}>
                  <WorkplaceAdminFloorPreview
                    floor={previewFloor}
                    enabled={scope.capabilities.canViewWorkplaceAdmin && !scope.floorsQuery.isError}
                    highlightedResourceIds={report.exceptions.content
                      .filter((booking) => booking.floorId === previewFloor?.floorId)
                      .map((booking) => booking.resourceId)}
                  />
                  {report.externalSources.some(
                    (source) =>
                      source.kind === 'SENSOR_OCCUPANCY' && source.availability === 'UNAVAILABLE'
                  ) ? (
                    <InlineFeedback
                      severity="info"
                      title={t('workplace.experience.polish.sensorSource')}
                    >
                      {t('workplace.experience.polish.sensorUnavailable')}
                    </InlineFeedback>
                  ) : null}
                </Stack>
              </Box>
              <WorkplaceAdminSection
                title={t('workplace.experience.floorUtilization')}
                description={t('workplace.experience.utilizationDefinition')}
                actions={
                  <ActionButton
                    component={NavLink}
                    to="/workplace/admin/policies"
                    intent="quiet"
                    endIcon={<ArrowUpRight size={15} />}
                  >
                    {t('workplace.admin.overview.managePolicy')}
                  </ActionButton>
                }
              >
                <Stack
                  direction="row"
                  gap={2}
                  flexWrap="wrap"
                  sx={{ mb: 1, py: 1, px: 1.25, bgcolor: 'var(--dwp-product-soft)' }}
                >
                  {[
                    ['workplace.admin.overview.activeSites', report.current.activeSites],
                    ['workplace.admin.overview.configuredFloors', report.current.configuredFloors],
                    ['workplace.admin.overview.assignedSeats', report.current.assignedResources],
                    ['workplace.admin.overview.checkedInToday', report.current.checkedInToday],
                    ['workplace.experience.noShow', report.summary.noShowCount],
                  ].map(([key, value]) => (
                    <Typography key={key} variant="caption" color="text.secondary">
                      {t(String(key))}{' '}
                      <Typography
                        component="span"
                        variant="body2"
                        fontWeight="fontWeightBold"
                        color="text.primary"
                      >
                        {value}
                      </Typography>
                    </Typography>
                  ))}
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 1 }}
                >
                  {t('workplace.admin.overview.policySnapshot')}:{' '}
                  {report.current.policy.workingDayStart.slice(0, 5)} –{' '}
                  {report.current.policy.workingDayEnd.slice(0, 5)} · {report.scope.timeZone}
                </Typography>
                <WorkplaceAdminFloorRows
                  floors={report.floors}
                  selectedFloorId={scope.floorId}
                  onSelect={(floor) => scope.update({ floor })}
                />
              </WorkplaceAdminSection>
              <WorkplaceExperienceBookingInspector
                siteId={scope.site.siteId}
                bookingId={selectedBooking}
                onClose={() => setSelectedBooking(null)}
                timeZone={report.scope.timeZone}
              />
            </Stack>
          ) : null}
        </>
      )}
    </PageCanvas>
  );
}
