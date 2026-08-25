import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  CalendarPlus,
  CircleCheck,
  MapPin,
  Monitor,
  Search,
  ShieldCheck,
  UsersRound,
  Video,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getCalendarResources, usePermissions } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  DateTimePickerField,
  FormField,
  GuidedEmptyState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { CalendarEventDialog } from './calendar-event-dialog';
import { CalendarPageHeading, calendarDate, calendarTime } from './calendar-components';

import type { CalendarResource, CalendarResourceType } from '@dwp-frontend/shared-utils';

function roundedStart() {
  const value = new Date();
  value.setSeconds(0, 0);
  value.setMinutes(value.getMinutes() < 30 ? 30 : 60);
  return value;
}

const FEATURE_ICONS = {
  VIDEO: Video,
  DISPLAY: Monitor,
  HYBRID: UsersRound,
} as const;

export function CalendarResources() {
  const { t, i18n } = useTranslation('calendar');
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('APP.CALENDAR', 'CREATE');
  const [start, setStart] = useState(() => roundedStart().toISOString());
  const [end, setEnd] = useState(() =>
    new Date(roundedStart().getTime() + 60 * 60_000).toISOString()
  );
  const [queryRange, setQueryRange] = useState({ start, end });
  const [resourceType, setResourceType] = useState<CalendarResourceType | 'ALL'>('ROOM');
  const [capacity, setCapacity] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CalendarResource | null>(null);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const rangeValid = new Date(queryRange.end) > new Date(queryRange.start);
  const resources = useQuery({
    queryKey: ['calendar', 'resources', queryRange.start, queryRange.end],
    queryFn: () => getCalendarResources(queryRange.start, queryRange.end),
    enabled: rangeValid,
    staleTime: 20_000,
    retry: 1,
  });
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return (resources.data ?? []).filter(
      (resource) =>
        (resourceType === 'ALL' || resource.type === resourceType) &&
        resource.capacity >= capacity &&
        (!term ||
          `${resource.name} ${resource.site} ${resource.floor ?? ''} ${resource.features.join(' ')}`
            .toLocaleLowerCase()
            .includes(term))
    );
  }, [capacity, resourceType, resources.data, search]);

  return (
    <PageCanvas>
      <CalendarPageHeading
        eyebrow={t('resources.eyebrow')}
        title={t('resources.title')}
        description={t('resources.description')}
      />

      <Box
        component="section"
        sx={{
          p: 2.5,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(5, minmax(0, 1fr)) auto',
            },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <DateTimePickerField
            label={t('resources.startLabel')}
            value={start}
            onValueChange={(value) => value && setStart(value)}
            required
          />
          <DateTimePickerField
            label={t('resources.endLabel')}
            value={end}
            onValueChange={(value) => value && setEnd(value)}
            required
            errorMessage={new Date(end) <= new Date(start) ? t('event.rangeError') : undefined}
          />
          <SelectField
            label={t('resources.typeLabel')}
            value={resourceType}
            onValueChange={(value) => setResourceType(value as CalendarResourceType | 'ALL')}
            options={['ALL', 'ROOM', 'DESK', 'EQUIPMENT'].map((value) => ({
              value,
              label: t(`resources.types.${value}`),
            }))}
          />
          <SelectField
            label={t('resources.capacityLabel')}
            value={capacity}
            onValueChange={(value) => setCapacity(Number(value))}
            options={[1, 2, 4, 6, 8, 12, 20].map((value) => ({
              value,
              label: t('resources.capacity', { count: value }),
            }))}
          />
          <FormField
            label={t('resources.searchLabel')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} />
                </InputAdornment>
              ),
            }}
          />
          <ActionButton
            intent="primary"
            onClick={() => setQueryRange({ start, end })}
            disabled={new Date(end) <= new Date(start)}
            sx={{ minHeight: 48, px: 2.5 }}
          >
            {t('resources.search')}
          </ActionButton>
        </Box>
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        gap={1}
        sx={{ mt: 2.5, mb: 1.5 }}
      >
        <Box>
          <Typography component="h2" variant="h6" fontWeight={800}>
            {t('resources.results', { count: filtered.length })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {calendarDate(queryRange.start, language)} · {calendarTime(queryRange.start, language)}{' '}
            – {calendarTime(queryRange.end, language)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} alignItems="center" color="text.secondary">
          <ShieldCheck size={15} />
          <Typography variant="caption">{t('resources.policyHint')}</Typography>
        </Stack>
      </Stack>

      {resources.isError ? (
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => resources.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('resources.loadError')}
        </Alert>
      ) : resources.isLoading ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 2,
          }}
        >
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} variant="rounded" height={220} />
          ))}
        </Box>
      ) : filtered.length ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 2,
          }}
        >
          {filtered.map((resource) => (
            <Box
              component="article"
              key={resource.resourceId}
              sx={{
                minWidth: 0,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: resource.available ? 'divider' : 'action.disabledBackground',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <Box sx={{ p: 2.25 }}>
                <Stack
                  direction="row"
                  alignItems="flex-start"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        flex: '0 0 38px',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: resource.available ? '#EAF1FF' : 'action.hover',
                        color: resource.available ? 'primary.main' : 'text.disabled',
                        borderRadius: 1,
                      }}
                    >
                      <Building2 size={19} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={800} noWrap>
                        {resource.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(`resources.types.${resource.type}`)} · {resource.code}
                      </Typography>
                    </Box>
                  </Stack>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={resource.available ? 'success' : 'default'}
                    label={t(resource.available ? 'resources.available' : 'resources.unavailable')}
                  />
                </Stack>
                <Stack spacing={1} sx={{ mt: 2 }} color="text.secondary">
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <MapPin size={15} />
                    <Typography variant="body2">
                      {resource.site}
                      {resource.floor ? ` · ${resource.floor}` : ''}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <UsersRound size={15} />
                    <Typography variant="body2">
                      {t('resources.capacity', { count: resource.capacity })}
                    </Typography>
                  </Stack>
                </Stack>
                <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.75 }}>
                  {resource.features.slice(0, 5).map((feature) => {
                    const Icon =
                      FEATURE_ICONS[feature as keyof typeof FEATURE_ICONS] ?? CircleCheck;
                    return (
                      <Chip
                        key={feature}
                        size="small"
                        variant="outlined"
                        icon={<Icon size={13} />}
                        label={t(`resources.features.${feature}`, { defaultValue: feature })}
                      />
                    );
                  })}
                </Stack>
              </Box>
              <Divider />
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={{ px: 2.25, py: 1.25 }}
              >
                <Typography
                  variant="caption"
                  color={resource.approvalRequired ? 'warning.main' : 'text.secondary'}
                  fontWeight={700}
                >
                  {t(
                    resource.approvalRequired
                      ? 'resources.approvalRequired'
                      : 'resources.instantBooking'
                  )}
                </Typography>
                {canCreate && (
                  <ActionButton
                    intent="secondary"
                    size="small"
                    startIcon={<CalendarPlus size={16} />}
                    disabled={!resource.available || resource.state !== 'AVAILABLE'}
                    onClick={() => setSelected(resource)}
                  >
                    {t('resources.book')}
                  </ActionButton>
                )}
              </Stack>
            </Box>
          ))}
        </Box>
      ) : (
        <Box
          sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}
        >
          <GuidedEmptyState
            kind="no-results"
            title={t('resources.emptyTitle')}
            description={t('resources.emptyDescription')}
          />
        </Box>
      )}

      {canCreate && (
        <CalendarEventDialog
          open={Boolean(selected)}
          initialStart={queryRange.start}
          initialEnd={queryRange.end}
          initialResourceId={selected?.resourceId}
          onClose={() => setSelected(null)}
        />
      )}
    </PageCanvas>
  );
}
