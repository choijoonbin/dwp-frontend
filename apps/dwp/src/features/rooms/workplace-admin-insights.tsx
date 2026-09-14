import { InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, CalendarCheck2, Gauge, TrendingUp } from 'lucide-react';
import { ActionButton, EmptyState, PageCanvas } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { RoomsPageHeading } from './rooms-ui';
import {
  useWorkplaceExperienceReportScope,
  WorkplaceExperienceReportControls,
} from './workplace-experience-report-scope';
import {
  WorkplaceExperienceRate,
  WorkplaceExperienceQueryError,
  WorkplaceExperienceFreshness,
} from './workplace-experience-ui';
import {
  WorkplaceAdminFloorRows,
  WorkplaceAdminMetric,
  WorkplaceAdminSection,
} from './workplace-admin-experience-ui';
import { WorkplaceUtilizationHeatmap } from './workplace-utilization-heatmap';
import { WorkplaceUtilizationTrend } from './workplace-utilization-trend';
import { useWorkplaceGovernanceCapabilities } from './rooms-capabilities';
import {
  workplaceAuthorizedFloorMetadata,
  workplaceAuthorizedFloorSetsMatch,
  workplaceAuthorizedFloorContains,
} from './workplace-authorized-floor-metadata';
import { WorkplaceInsightHourBookings } from './workplace-insight-hour-bookings';

export function WorkplaceAdminInsights() {
  const { t } = useTranslation('rooms');
  const scope = useWorkplaceExperienceReportScope();
  const governance = useWorkplaceGovernanceCapabilities();
  const siteScope = workplaceAuthorizedFloorMetadata(
    scope.site,
    governance.isLoaded && governance.globalAdministrator
  );
  const reportScope = workplaceAuthorizedFloorMetadata(
    scope.report?.scope,
    governance.isLoaded && governance.globalAdministrator
  );
  const scopeVerified =
    workplaceAuthorizedFloorSetsMatch(siteScope, reportScope) &&
    (siteScope?.kind !== 'FLOORS' || scope.site?.totalFloorCount === null) &&
    scope.report?.scope.siteId === scope.site?.siteId &&
    scope.report?.scope.floorId === (scope.floorId ?? null) &&
    Boolean(
      scope.report?.floors.every((floor) =>
        workplaceAuthorizedFloorContains(reportScope, floor.floorId)
      )
    );
  const report =
    scopeVerified && !scope.floorsQuery.isError && scope.capabilities.canViewWorkplaceAdmin
      ? scope.report
      : undefined;
  const globalReader = governance.isLoaded && governance.globalAdministrator && !governance.isError;
  const [selectedHour, setSelectedHour] = useState<{
    date: string;
    hour: number;
    offset: string;
  } | null>(null);
  const rate = (value: number | null) => (value === null ? null : `${value.toFixed(1)}%`);
  const selected = report?.hourlyHeatmap.find(
    (cell) =>
      cell.date === selectedHour?.date &&
      cell.hour === selectedHour.hour &&
      cell.offset === selectedHour.offset
  );
  const peak = report?.hourlyHeatmap.reduce<(typeof report.hourlyHeatmap)[number] | undefined>(
    (maximum, cell) =>
      cell.utilizationPercent !== null &&
      (maximum?.utilizationPercent === null ||
        maximum?.utilizationPercent === undefined ||
        cell.utilizationPercent > maximum.utilizationPercent)
        ? cell
        : maximum,
    undefined
  );
  const exportCsv = () => {
    if (!report) return;
    const rows = [
      [
        'date',
        'bookings',
        'bookedMinutes',
        'availableResourceMinutes',
        'utilizationPercent',
        'noShows',
        'noShowPercent',
      ],
      ...report.dailyTrend.map((day) => [
        day.date,
        day.bookingCount,
        day.bookedMinutes,
        day.denominatorResourceMinutes,
        day.utilizationPercent ?? '',
        day.noShowCount,
        day.noShowPercent ?? '',
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `workplace-${report.scope.from}-${report.scope.to}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <PageCanvas topInset="compact">
      <RoomsPageHeading
        eyebrow={t('workplace.experience.insights')}
        title={t('workplace.experience.insightsTitle')}
        description={t('workplace.experience.insightsDescription')}
        actions={
          <ActionButton intent="secondary" disabled={!report} onClick={exportCsv}>
            {t('workplace.experience.exportCsv')}
          </ActionButton>
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
          skeletonHeight={300}
          label={t('workplace.experience.refreshing')}
        />
      ) : !scope.site ? (
        <EmptyState title={t('workplace.admin.locations.emptySites')} />
      ) : (
        <>
          <WorkplaceExperienceReportControls scope={scope} />
          {scope.report && !scopeVerified ? (
            <InlineFeedback severity="warning">
              {t('workplace.experience.floorScope.scopeUnverified')}
            </InlineFeedback>
          ) : null}
          {scope.reportQuery.isError ? (
            <WorkplaceExperienceQueryError retry={() => void scope.reportQuery.refetch()} />
          ) : null}
          {scope.reportQuery.isLoading ? (
            <LoadingState
              variant="skeleton"
              embedded
              skeletonRows={1}
              skeletonHeight={500}
              label={t('workplace.experience.refreshing')}
            />
          ) : report ? (
            <Stack gap={2}>
              {reportScope?.kind === 'FLOORS' ? (
                <Typography variant="body2" color="primary.main">
                  {t('workplace.experience.floorScope.authorizedScope', {
                    count: reportScope.floorIds?.length,
                  })}
                </Typography>
              ) : null}
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
                gap={1}
              >
                <Typography variant="body2" fontWeight="fontWeightBold">
                  {scope.site.name} · {report.scope.from} – {scope.range?.end}
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
                  icon={CalendarCheck2}
                  label={t('workplace.experience.totalBookings')}
                  value={report.summary.bookingCount}
                  detail={t('workplace.experience.resourceCount', {
                    count: report.current.reservableResources,
                  })}
                />
                <WorkplaceAdminMetric
                  icon={Gauge}
                  label={t('workplace.experience.utilization')}
                  value={rate(report.summary.utilizationPercent)}
                  tone="secondary"
                />
                <WorkplaceAdminMetric
                  icon={BarChart3}
                  tone="warning"
                  label={t('workplace.experience.noShowRate')}
                  value={rate(report.summary.noShowPercent)}
                  detail={t('workplace.experience.polish.noShowCohort', {
                    count: report.summary.noShowEligibleCount,
                  })}
                />
                <WorkplaceAdminMetric
                  icon={TrendingUp}
                  tone="error"
                  label={t('workplace.experience.peakRate')}
                  value={rate(report.summary.peakUtilizationPercent)}
                  detail={
                    peak ? `${peak.date.slice(5)} · ${peak.hour}:00 (${peak.offset})` : undefined
                  }
                  onClick={
                    peak
                      ? () =>
                          setSelectedHour({ date: peak.date, hour: peak.hour, offset: peak.offset })
                      : undefined
                  }
                />
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.75fr) minmax(0, 1fr)' },
                  gap: 2,
                  alignItems: 'start',
                }}
              >
                <WorkplaceAdminSection
                  title={t('workplace.experience.hourlyUtilization')}
                  description={t('workplace.experience.utilizationDefinition')}
                >
                  {report.hourlyHeatmap.length ? (
                    <WorkplaceUtilizationHeatmap
                      cells={report.hourlyHeatmap}
                      workingDayStart={report.current.policy.workingDayStart}
                      workingDayEnd={report.current.policy.workingDayEnd}
                      selectedStartsAt={selected?.startsAt}
                      onSelect={(cell) =>
                        setSelectedHour({ date: cell.date, hour: cell.hour, offset: cell.offset })
                      }
                    />
                  ) : (
                    <EmptyState title={t('workplace.experience.noData')} />
                  )}
                  <Box component="details" sx={{ mt: 1.5 }}>
                    <Typography
                      component="summary"
                      variant="body2"
                      sx={{ cursor: 'pointer', minHeight: 44 }}
                    >
                      {t('workplace.experience.tableAlternative')}
                    </Typography>
                    <TableContainer sx={{ maxHeight: 350 }}>
                      <Table size="small" aria-label={t('workplace.experience.hourlyUtilization')}>
                        <TableHead>
                          <TableRow>
                            {['date', 'hour', 'utilization', 'bookedMinutes'].map((key) => (
                              <TableCell key={key}>{t(`workplace.experience.${key}`)}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {report.hourlyHeatmap.map((cell) => (
                            <TableRow key={`${cell.date}-${cell.hour}-${cell.offset}`}>
                              <TableCell>{cell.date}</TableCell>
                              <TableCell>
                                {cell.hour}:00 ({cell.offset})
                              </TableCell>
                              <TableCell>{rate(cell.utilizationPercent) ?? '—'}</TableCell>
                              <TableCell>{cell.bookedMinutes.toFixed(0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </WorkplaceAdminSection>
                <Stack gap={2}>
                  <WorkplaceAdminSection
                    title={t('workplace.experience.selectedPeriod')}
                    tone="soft"
                  >
                    {selected ? (
                      <Stack gap={1}>
                        <Typography fontWeight={(theme) => theme.typography.fontWeightBold}>
                          {selected.date} · {selected.hour}:00 ({selected.offset})
                        </Typography>
                        <WorkplaceExperienceRate
                          label={t('workplace.experience.utilization')}
                          value={selected.utilizationPercent}
                        />
                        <Typography variant="caption">
                          {t('workplace.experience.minutes', {
                            count: Math.round(selected.bookedMinutes),
                          })}
                        </Typography>
                        <ActionButton
                          component="a"
                          href="#workplace-insight-hour-bookings"
                          intent="secondary"
                          disabled={!globalReader}
                        >
                          {t('workplace.experience.polish.hourBookingsTitle')}
                        </ActionButton>
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {t('workplace.experience.selectPeriod')}
                      </Typography>
                    )}
                  </WorkplaceAdminSection>
                  <WorkplaceAdminSection title={t('workplace.experience.previousPeriod')}>
                    <Typography variant="caption">
                      {report.comparison.previousFrom} – {report.comparison.previousTo}
                    </Typography>
                    <Typography
                      variant="h5"
                      fontWeight={(theme) => theme.typography.fontWeightBold}
                      color="primary.main"
                      sx={{ mt: 1 }}
                    >
                      {report.comparison.utilizationChangePercentagePoints === null
                        ? t('workplace.experience.unavailable')
                        : `${report.comparison.utilizationChangePercentagePoints > 0 ? '+' : ''}${report.comparison.utilizationChangePercentagePoints.toFixed(1)} pp`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('workplace.experience.utilizationChange')}
                    </Typography>
                  </WorkplaceAdminSection>
                  <WorkplaceAdminSection
                    title={t('workplace.experience.polish.trendTitle')}
                    description={t('workplace.experience.polish.trendDescription')}
                  >
                    <WorkplaceUtilizationTrend days={report.dailyTrend} />
                  </WorkplaceAdminSection>
                </Stack>
              </Box>
              {selected ? (
                <WorkplaceInsightHourBookings
                  siteId={report.scope.siteId}
                  floorId={scope.floorId}
                  hour={selected}
                  reportGeneratedAt={report.metadata.generatedAt}
                  timeZone={report.scope.timeZone}
                  enabled={
                    scope.capabilities.isLoaded &&
                    scope.capabilities.canViewWorkplaceAdmin &&
                    globalReader
                  }
                />
              ) : null}
              <WorkplaceAdminSection title={t('workplace.experience.floorUtilization')}>
                <WorkplaceAdminFloorRows
                  floors={report.floors}
                  selectedFloorId={scope.floorId}
                  onSelect={(id) => scope.update({ floor: id })}
                />
              </WorkplaceAdminSection>
              <Box component="details">
                <Typography
                  component="summary"
                  variant="body2"
                  sx={{ minHeight: 44, cursor: 'pointer' }}
                >
                  {t('workplace.experience.polish.trendTitle')} ·{' '}
                  {t('workplace.experience.tableAlternative')}
                </Typography>
                <TableContainer>
                  <Table size="small" aria-label={t('workplace.experience.polish.trendTitle')}>
                    <TableHead>
                      <TableRow>
                        {['date', 'totalBookings', 'utilization', 'noShowRate'].map((key) => (
                          <TableCell key={key}>{t(`workplace.experience.${key}`)}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {report.dailyTrend.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>{day.date}</TableCell>
                          <TableCell>{day.bookingCount}</TableCell>
                          <TableCell>{rate(day.utilizationPercent) ?? '—'}</TableCell>
                          <TableCell>{rate(day.noShowPercent) ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Stack>
          ) : null}
        </>
      )}
    </PageCanvas>
  );
}
