import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { useMemo, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  DateRangePickerField,
  SelectField,
  foundationTokens,
} from '@dwp-frontend/design-system';
import {
  getWorkplaceAdminFloors,
  getWorkplaceAdminSites,
  getWorkplaceExperienceReport,
} from '@dwp-frontend/shared-utils';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { RefreshCw } from 'lucide-react';
import { useRoomsCapabilities } from './rooms-capabilities';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';

export function workplaceReportDateRange(
  from: string | null,
  through: string | null,
  timeZone: string,
  now = Temporal.Now.instant()
) {
  const today = now.toZonedDateTimeISO(timeZone).toPlainDate();
  try {
    const start = from ? Temporal.PlainDate.from(from) : today.subtract({ days: 6 });
    const end = through ? Temporal.PlainDate.from(through) : today;
    const days = start.until(end, { largestUnit: 'days' }).days;
    if (days < 0 || days >= 93) return null;
    return {
      start: start.toString(),
      end: end.toString(),
      exclusiveEnd: end.add({ days: 1 }).toString(),
    };
  } catch {
    return null;
  }
}

export function useWorkplaceExperienceReportScope() {
  const authorityKey = useWorkplaceExperienceAuthority();
  const capabilities = useRoomsCapabilities();
  const [params, setParams] = useSearchParams();
  const identity = authorityKey;
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'experience', identity, 'sites'],
    queryFn: getWorkplaceAdminSites,
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    staleTime: 30_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const sites = useMemo(
    () => (sitesQuery.isError ? [] : (sitesQuery.data ?? [])),
    [sitesQuery.data, sitesQuery.isError]
  );
  const site = sites.find((item) => item.siteId === params.get('site')) ?? sites[0] ?? null;
  const authorizedScopeKey = JSON.stringify([site?.countsScope, site?.allowedFloorIds]);
  const floorsQuery = useQuery({
    queryKey: ['workplace', 'experience', identity, 'floors', site?.siteId, authorizedScopeKey],
    queryFn: () => getWorkplaceAdminFloors(site!.siteId),
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin && Boolean(site),
    staleTime: 15_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const range = workplaceReportDateRange(
    params.get('from'),
    params.get('through'),
    site?.timeZone ?? 'Asia/Seoul'
  );
  const floorId = params.get('floor') || undefined;
  const page = Math.max(0, Number.parseInt(params.get('exceptionPage') ?? '0', 10) || 0);
  const reportQuery = useQuery({
    queryKey: [
      'workplace',
      'experience',
      identity,
      'report',
      site?.siteId,
      authorizedScopeKey,
      floorId,
      range?.start,
      range?.exclusiveEnd,
      page,
    ],
    queryFn: () =>
      getWorkplaceExperienceReport({
        siteId: site!.siteId,
        floorId,
        from: range!.start,
        to: range!.exclusiveEnd,
        page,
        size: 20,
      }),
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin && Boolean(site && range),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    if (!('exceptionPage' in changes)) next.delete('exceptionPage');
    setParams(next, { replace: true });
  };
  return {
    sitesQuery,
    floorsQuery,
    reportQuery,
    capabilities,
    sites,
    site,
    range,
    floorId,
    page,
    update,
    floors: floorsQuery.isError ? [] : (floorsQuery.data ?? []),
    report:
      capabilities.isLoaded &&
      capabilities.canViewWorkplaceAdmin &&
      !reportQuery.isError &&
      !sitesQuery.isError &&
      !floorsQuery.isError
        ? reportQuery.data
        : undefined,
  };
}

export function WorkplaceExperienceReportControls({
  scope,
}: {
  scope: ReturnType<typeof useWorkplaceExperienceReportScope>;
}) {
  const { t } = useTranslation('rooms');
  const wide = useMediaQuery(useTheme().breakpoints.up('md'));
  const [datesOpen, setDatesOpen] = useState(false);
  const preset = (days: number) => {
    const end = Temporal.Now.instant()
      .toZonedDateTimeISO(scope.site?.timeZone ?? 'Asia/Seoul')
      .toPlainDate();
    scope.update({ from: end.subtract({ days: days - 1 }).toString(), through: end.toString() });
  };
  return (
    <Box
      sx={{
        mb: 2,
        p: { xs: 1.25, md: 1.5 },
        bgcolor: 'var(--dwp-product-soft)',
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.control + 'px',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
        flexWrap="wrap"
        sx={{ mb: 1.25 }}
      >
        <Typography variant="caption" fontWeight="fontWeightBold" color="primary.main">
          {scope.site?.name} · {scope.site?.timeZone}
        </Typography>
        <Stack direction="row" gap={0.25}>
          {([1, 7, 30] as const).map((days) => (
            <ActionButton key={days} intent="quiet" onClick={() => preset(days)} sx={{ px: 0.75 }}>
              {t(
                `workplace.experience.polish.${days === 1 ? 'today' : days === 7 ? 'last7Days' : 'last30Days'}`
              )}
            </ActionButton>
          ))}
        </Stack>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 1.25,
          alignItems: 'start',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'minmax(120px, 1fr) minmax(120px, 1fr) minmax(270px, 1.8fr) auto',
          },
        }}
      >
        <SelectField
          size="small"
          label={t('workplace.admin.governance.fields.site')}
          value={scope.site?.siteId ?? ''}
          options={scope.sites.map((site) => ({ value: site.siteId, label: site.name }))}
          onValueChange={(site) => scope.update({ site, floor: null })}
        />
        {scope.site && (
          <SelectField
            size="small"
            label={t('workplace.admin.governance.fields.floor')}
            value={scope.floorId ?? ''}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            options={[
              {
                value: '',
                label: t(
                  scope.site?.countsScope === 'FLOORS'
                    ? 'workplace.experience.floorScope.allAuthorizedFloors'
                    : 'workplace.experience.allFloors'
                ),
              },
              ...scope.floors.map((floor) => ({ value: floor.floorId, label: floor.name })),
            ]}
            onValueChange={(floor) => scope.update({ floor: floor || null })}
          />
        )}
        <Box
          component="details"
          open={wide || datesOpen}
          onToggle={(event) => {
            if (!wide) setDatesOpen(event.currentTarget.open);
          }}
          sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, minWidth: 0 }}
        >
          <Typography
            component="summary"
            variant="body2"
            sx={{ display: { md: 'none' }, minHeight: 44, cursor: 'pointer', py: 1 }}
          >
            {t('workplace.experience.polish.scopedPeriod')}: {scope.range?.start} –{' '}
            {scope.range?.end}
          </Typography>
          <DateRangePickerField
            value={{ start: scope.range?.start ?? null, end: scope.range?.end ?? null }}
            onValueChange={(value) => scope.update({ from: value.start, through: value.end })}
            startLabel={t('workplace.experience.from')}
            endLabel={t('workplace.experience.through')}
            pickerProps={{ size: 'small' }}
            orderErrorMessage={t('workplace.experience.rangeError')}
            errorMessage={!scope.range ? t('workplace.experience.rangeError') : undefined}
          />
        </Box>
        <ActionButton
          intent="secondary"
          startIcon={<RefreshCw size={16} />}
          disabled={scope.reportQuery.isFetching}
          sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
          onClick={() => void scope.reportQuery.refetch()}
        >
          {t('workplace.experience.refresh')}
        </ActionButton>
      </Box>
    </Box>
  );
}
