import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { foundationTokens } from '@dwp-frontend/design-system';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { formatWorkplaceExperienceInstant } from './workplace-experience-format';
import { useEffect, useMemo, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, DatePickerField, SelectField } from '@dwp-frontend/design-system';
import { getWorkplaceAdminSites, getWorkplacePolicyImpact } from '@dwp-frontend/shared-utils';
import type { WorkplacePolicy } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRoomsCapabilities } from './rooms-capabilities';
import {
  WorkplaceExperienceFreshness,
  WorkplaceExperienceMetric,
  WorkplaceExperiencePanel,
  WorkplaceExperienceQueryError,
} from './workplace-experience-ui';
import { WorkplacePolicyImpactChart } from './workplace-policy-impact-chart';

export function WorkplacePolicyImpactPreview({
  proposed,
  valid,
}: {
  proposed: WorkplacePolicy;
  valid: boolean;
}) {
  const { t } = useTranslation('rooms');
  const authorityKey = useWorkplaceExperienceAuthority();
  const capabilities = useRoomsCapabilities();
  const identity = authorityKey;
  const [siteId, setSiteId] = useState('');
  const [dates, setDates] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  });
  const [requested, setRequested] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'policy-impact', identity, 'sites'],
    queryFn: getWorkplaceAdminSites,
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    retry: false,
    staleTime: 15_000,
  });
  const sites = sitesQuery.isError ? [] : (sitesQuery.data ?? []);
  const site = sites.find((item) => item.siteId === siteId) ?? sites[0];
  const range = useMemo(() => {
    if (!site) return null;
    try {
      const today = Temporal.Now.instant().toZonedDateTimeISO(site.timeZone).toPlainDate();
      const start = dates.start ? Temporal.PlainDate.from(dates.start) : today;
      const end = dates.end ? Temporal.PlainDate.from(dates.end) : today.add({ days: 29 });
      if (
        start.until(end, { largestUnit: 'days' }).days < 0 ||
        start.until(end, { largestUnit: 'days' }).days >= 93
      )
        return null;
      return {
        start: start.toString(),
        end: end.toString(),
        from: start.toZonedDateTime(site.timeZone).toInstant().toString(),
        to: end.add({ days: 1 }).toZonedDateTime(site.timeZone).toInstant().toString(),
      };
    } catch {
      return null;
    }
  }, [site, dates]);
  const input =
    range && site
      ? {
          siteId: site.siteId,
          from: range.from,
          to: range.to,
          requireCheckIn: proposed.requireCheckIn,
          autoReleaseMinutes: proposed.autoReleaseMinutes,
          minimumBookingMinutes: proposed.minimumBookingMinutes,
          maximumBookingMinutes: proposed.maximumBookingMinutes,
          workingDayStart: proposed.workingDayStart,
          workingDayEnd: proposed.workingDayEnd,
        }
      : null;
  const fingerprint = JSON.stringify({ identity, input });
  useEffect(() => {
    setPage(0);
    setRequested(null);
  }, [fingerprint]);
  const query = useQuery({
    queryKey: ['workplace', 'policy-impact', fingerprint, page],
    queryFn: () => getWorkplacePolicyImpact({ ...input!, page, size: 20 }),
    enabled: Boolean(
      input &&
      valid &&
      requested === fingerprint &&
      capabilities.isLoaded &&
      capabilities.canManageWorkplaceAdmin
    ),
    staleTime: 0,
    retry: false,
  });
  const data =
    requested === fingerprint &&
    !query.isError &&
    capabilities.isLoaded &&
    capabilities.canManageWorkplaceAdmin
      ? query.data
      : undefined;
  return (
    <WorkplaceExperiencePanel
      title={t('workplace.experience.policyImpact')}
      description={t('workplace.experience.policyImpactDescription')}
    >
      <Stack gap={2}>
        <Typography variant="caption" color="text.secondary">
          {t('workplace.experience.policyImpactScopeNotice')}
        </Typography>
        {site ? (
          <Typography variant="caption" color="text.secondary">
            {t('admin.resources.timeZone')}: {site.timeZone}
          </Typography>
        ) : null}
        <Stack gap={1.5}>
          <SelectField
            label={t('workplace.admin.governance.fields.site')}
            value={site?.siteId ?? ''}
            options={sites.map((item) => ({ value: item.siteId, label: item.name }))}
            onValueChange={(value) => {
              setSiteId(value);
              setDates({ start: null, end: null });
            }}
          />
          <DatePickerField
            value={range?.start ?? dates.start}
            onValueChange={(start) => setDates((current) => ({ ...current, start }))}
            label={t('workplace.experience.from')}
            maxDate={range?.end}
          />
          <DatePickerField
            value={range?.end ?? dates.end}
            onValueChange={(end) => setDates((current) => ({ ...current, end }))}
            label={t('workplace.experience.through')}
            minDate={range?.start}
            errorMessage={!range ? t('workplace.experience.rangeError') : undefined}
          />
          <ActionButton
            intent="primary"
            disabled={!valid || !input || query.isFetching || !capabilities.canManageWorkplaceAdmin}
            onClick={() => {
              setRequested(fingerprint);
              if (requested === fingerprint) void query.refetch();
            }}
          >
            {t('workplace.experience.previewPolicy')}
          </ActionButton>
        </Stack>
        {sitesQuery.isError ? (
          <WorkplaceExperienceQueryError retry={() => void sitesQuery.refetch()} />
        ) : null}
        {query.isError ? (
          <WorkplaceExperienceQueryError retry={() => void query.refetch()} />
        ) : null}
        {!data && !query.isError ? (
          <InlineFeedback severity="info">
            {t('workplace.experience.impactReadOnly')}
          </InlineFeedback>
        ) : null}
        {data ? (
          <>
            <WorkplaceExperienceFreshness
              at={data.metadata.generatedAt}
              refreshing={query.isFetching}
            />
            <WorkplacePolicyImpactChart days={data.dailyImpact} />
            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}
            >
              <WorkplaceExperienceMetric
                label={t('workplace.experience.reviewedBookings')}
                value={data.reviewedBookings}
              />
              <WorkplaceExperienceMetric
                label={t('workplace.experience.futureImpact')}
                value={data.affectedBookings}
              />
            </Box>
            {data.content.length ? (
              data.content.map((effect) => (
                <Stack
                  key={effect.booking.bookingId}
                  gap={0.5}
                  sx={{
                    p: 1.5,
                    borderRadius: foundationTokens.radius.control + 'px',
                    bgcolor: 'var(--dwp-product-soft)',
                  }}
                >
                  <Typography fontWeight={(theme) => theme.typography.fontWeightBold}>
                    {effect.booking.resourceName}
                  </Typography>
                  <Typography variant="caption">
                    {formatWorkplaceExperienceInstant(effect.booking.startsAt, site!.timeZone)} –{' '}
                    {formatWorkplaceExperienceInstant(effect.booking.endsAt, site!.timeZone)}
                  </Typography>
                  {effect.knownEffects.map((reason) => (
                    <Typography key={reason} variant="body2">
                      {t(`workplace.experience.policyEffects.${reason}`)}
                    </Typography>
                  ))}
                </Stack>
              ))
            ) : (
              <InlineFeedback severity="info">
                {t('workplace.experience.policyImpactEmpty')}
              </InlineFeedback>
            )}
            <Stack direction="row" justifyContent="space-between">
              <ActionButton
                intent="quiet"
                disabled={!page || query.isFetching}
                onClick={() => setPage(page - 1)}
              >
                {t('workplace.experience.previous')}
              </ActionButton>
              <ActionButton
                intent="quiet"
                disabled={page + 1 >= data.totalPages || query.isFetching}
                onClick={() => setPage(page + 1)}
              >
                {t('workplace.experience.next')}
              </ActionButton>
            </Stack>
            <InlineFeedback severity="info">
              {t('workplace.experience.closurePreservesBookings')}
            </InlineFeedback>
            {data.limitations.map((value) => (
              <Typography key={value} variant="caption" color="text.secondary">
                {value}
              </Typography>
            ))}
          </>
        ) : null}
      </Stack>
    </WorkplaceExperiencePanel>
  );
}
