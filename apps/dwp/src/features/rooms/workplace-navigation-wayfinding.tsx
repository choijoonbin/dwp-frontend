import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Accessibility,
  Building2,
  DoorOpen,
  Map,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
} from 'lucide-react';
import {
  getWorkplaceNavigationPois,
  getWorkplaceNavigationRoute,
} from '@dwp-frontend/shared-utils/api/workplace-navigation-api';
import {
  ActionButton,
  EmptyState,
  InlineFeedback,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatDate } from '@dwp-frontend/shared-i18n';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { WorkplaceAccessPassPanel } from './workplace-access-pass';
import {
  workplaceNavigationCanRenderGuidedRoute,
  workplaceNavigationCopy,
  workplaceNavigationDirection,
  workplaceNavigationFallbackBreadcrumb,
  workplaceNavigationFallbackReason,
  workplaceNavigationPoiName,
  workplaceNavigationTravelModeLabel,
} from './workplace-navigation-model';

import type { WorkplaceNavigationLocale } from './workplace-navigation-model';

export type WorkplaceWayfindingProps = Readonly<{
  siteId: string;
  locale?: WorkplaceNavigationLocale;
  initialOriginPoiId?: string;
  initialDestinationPoiId?: string;
  defaultDestinationResourceId?: string;
  siteOptions?: readonly Readonly<{ siteId: string; name: string }>[];
  onSiteChange?: (siteId: string) => void;
  canUpdate?: boolean;
  elevated?: boolean;
}>;

function displayTime(value: string, locale: WorkplaceNavigationLocale) {
  return formatDate(
    value,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
    locale
  );
}

export function WorkplaceWayfinding({
  siteId,
  locale = 'ko',
  initialOriginPoiId = '',
  initialDestinationPoiId = '',
  defaultDestinationResourceId = '',
  siteOptions = [],
  onSiteChange,
  canUpdate = false,
  elevated = false,
}: WorkplaceWayfindingProps) {
  const { t } = useTranslation('rooms');
  const copy = workplaceNavigationCopy(locale);
  const [originPoiId, setOriginPoiId] = useState(initialOriginPoiId);
  const [destinationPoiId, setDestinationPoiId] = useState(initialDestinationPoiId);
  const [accessible, setAccessible] = useState(false);
  const [avoidStairs, setAvoidStairs] = useState(false);
  const autoRoutedSite = useRef('');
  const poisQuery = useQuery({
    queryKey: ['workplace', 'navigation', 'pois', siteId],
    queryFn: () => getWorkplaceNavigationPois(siteId),
    enabled: Boolean(siteId),
    retry: false,
  });
  const routeMutation = useMutation({
    mutationFn: () =>
      getWorkplaceNavigationRoute({
        siteId,
        originPoiId,
        destinationPoiId,
        accessible,
        avoidStairs,
      }),
  });
  const pois = useMemo(() => poisQuery.data ?? [], [poisQuery.data]);
  const route = routeMutation.data ?? null;
  const guided = route ? workplaceNavigationCanRenderGuidedRoute(route) : false;
  const breadcrumb = route ? workplaceNavigationFallbackBreadcrumb(route) : [];
  const canSearch =
    Boolean(originPoiId && destinationPoiId) &&
    originPoiId !== destinationPoiId &&
    !routeMutation.isPending;

  useEffect(() => {
    if (!pois.length) return;
    const validOrigin = pois.some((poi) => poi.poiId === originPoiId);
    const validDestination = pois.some((poi) => poi.poiId === destinationPoiId);
    if (!validOrigin) {
      const requested = pois.find((poi) => poi.poiId === initialOriginPoiId);
      const fallback = pois.find((poi) => poi.category === 'ENTRY') ?? pois[0];
      setOriginPoiId((requested ?? fallback)?.poiId ?? '');
    }
    if (!validDestination) {
      const requested = pois.find((poi) => poi.poiId === initialDestinationPoiId);
      const booked = pois.find((poi) => poi.resourceId === defaultDestinationResourceId);
      const fallback = pois.find((poi) => poi.category === 'ROOM') ?? pois.at(1) ?? pois[0];
      setDestinationPoiId((requested ?? booked ?? fallback)?.poiId ?? '');
    }
  }, [
    defaultDestinationResourceId,
    destinationPoiId,
    initialDestinationPoiId,
    initialOriginPoiId,
    originPoiId,
    pois,
  ]);

  useEffect(() => {
    routeMutation.reset();
    autoRoutedSite.current = '';
    // The selected POIs are validated against the next site's published graph when it loads.
  }, [siteId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!canSearch || route || routeMutation.isPending || autoRoutedSite.current === siteId) return;
    autoRoutedSite.current = siteId;
    routeMutation.mutate();
  }, [canSearch, route, routeMutation, siteId]);

  const selectedDestination = pois.find((poi) => poi.poiId === destinationPoiId) ?? null;

  return (
    <PageCanvas topInset="compact" data-testid="workplace-wayfinding">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        gap={2}
        sx={{ mb: 2.5 }}
      >
        <Box>
          <Typography variant="overline" color="primary.main">
            {t('screen19.wayfinding.eyebrow')}
          </Typography>
          <Typography component="h1" variant="h4" fontWeight={800}>
            {copy.wayfindingTitle}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
            {copy.wayfindingDescription}
          </Typography>
        </Box>
        <ActionButton
          intent="secondary"
          startIcon={<RefreshCw size={16} />}
          loading={poisQuery.isFetching}
          onClick={() => void poisQuery.refetch()}
        >
          {copy.refresh}
        </ActionButton>
      </Stack>

      <Box
        component="section"
        aria-label={copy.wayfindingTitle}
        sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, sm: 2 }, mb: 2 })}
      >
        {poisQuery.isLoading ? (
          <LoadingState embedded label={copy.loading} />
        ) : poisQuery.isError ? (
          <InlineFeedback
            severity="error"
            action={
              <ActionButton intent="quiet" onClick={() => void poisQuery.refetch()}>
                {copy.retry}
              </ActionButton>
            }
          >
            {locale === 'ko'
              ? '위치 목록을 불러오지 못했습니다.'
              : 'Locations could not be loaded.'}
          </InlineFeedback>
        ) : (
          <Stack spacing={2}>
            {siteOptions.length > 1 ? (
              <FormControl fullWidth>
                <InputLabel id="wayfinding-site-label">
                  {locale === 'ko' ? '캠퍼스' : 'Campus'}
                </InputLabel>
                <Select
                  labelId="wayfinding-site-label"
                  label={locale === 'ko' ? '캠퍼스' : 'Campus'}
                  value={siteId}
                  onChange={(event) => onSiteChange?.(event.target.value)}
                >
                  {siteOptions.map((site) => (
                    <MenuItem key={site.siteId} value={site.siteId}>
                      {site.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}
            >
              <FormControl fullWidth>
                <InputLabel id="wayfinding-origin-label">{copy.origin}</InputLabel>
                <Select
                  labelId="wayfinding-origin-label"
                  label={copy.origin}
                  value={originPoiId}
                  onChange={(event) => setOriginPoiId(event.target.value)}
                >
                  <MenuItem value="">
                    <em>{copy.selectPlaceholder}</em>
                  </MenuItem>
                  {pois.map((poi) => (
                    <MenuItem key={poi.poiId} value={poi.poiId}>
                      {workplaceNavigationPoiName(poi, locale)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="wayfinding-destination-label">{copy.destination}</InputLabel>
                <Select
                  labelId="wayfinding-destination-label"
                  label={copy.destination}
                  value={destinationPoiId}
                  onChange={(event) => setDestinationPoiId(event.target.value)}
                >
                  <MenuItem value="">
                    <em>{copy.selectPlaceholder}</em>
                  </MenuItem>
                  {pois.map((poi) => (
                    <MenuItem key={poi.poiId} value={poi.poiId}>
                      {workplaceNavigationPoiName(poi, locale)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
              gap={1}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={accessible}
                      onChange={(event) => setAccessible(event.target.checked)}
                    />
                  }
                  label={copy.accessible}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={avoidStairs}
                      onChange={(event) => setAvoidStairs(event.target.checked)}
                    />
                  }
                  label={copy.avoidStairs}
                />
              </Stack>
              <ActionButton
                intent="primary"
                startIcon={<Navigation size={17} />}
                disabled={!canSearch}
                loading={routeMutation.isPending}
                onClick={() => routeMutation.mutate()}
              >
                {copy.findRoute}
              </ActionButton>
            </Stack>
          </Stack>
        )}
      </Box>

      {routeMutation.isError && (
        <InlineFeedback severity="error" sx={{ mb: 2 }}>
          {locale === 'ko'
            ? '경로를 조회하지 못했습니다. 원 명령은 변경되지 않았습니다.'
            : 'The route could not be loaded. No state was changed.'}
        </InlineFeedback>
      )}

      {route && guided && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(0, 1.7fr) minmax(320px, .8fr)',
            },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Stack spacing={2}>
            <Box
              component="section"
              aria-labelledby="guided-route-heading"
              sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, sm: 2 } })}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                gap={1.5}
                sx={{ mb: 2 }}
              >
                <Box>
                  <Typography
                    id="guided-route-heading"
                    component="h2"
                    variant="h6"
                    fontWeight={750}
                  >
                    {copy.routeSummary}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {workplaceNavigationPoiName(route.origin!, locale)} →{' '}
                    {workplaceNavigationPoiName(route.destination!, locale)}
                  </Typography>
                </Box>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Chip
                    icon={<Accessibility size={15} />}
                    label={`${Math.max(1, Math.ceil(route.totalTravelSeconds / 60))} ${copy.minutes}`}
                  />
                  <Chip
                    variant="outlined"
                    label={`${copy.publishedGraph} r${route.graphRevisionNumber}`}
                  />
                </Stack>
              </Stack>

              <Box
                data-testid="workplace-wayfinding-map"
                aria-hidden="true"
                sx={{
                  minHeight: { xs: 210, sm: 300 },
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'rgba(37, 99, 235, .045)',
                  backgroundImage:
                    'linear-gradient(rgba(37,99,235,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,.08) 1px, transparent 1px)',
                  backgroundSize: '28px 28px',
                  mb: 2,
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    left: '10%',
                    top: '22%',
                    width: '30%',
                    height: '28%',
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    p: 1,
                  }}
                >
                  <Typography variant="caption" fontWeight={700}>
                    {workplaceNavigationPoiName(route.origin!, locale)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    position: 'absolute',
                    right: '8%',
                    bottom: '15%',
                    width: '30%',
                    height: '30%',
                    border: '2px solid',
                    borderColor: 'primary.main',
                    bgcolor: 'primary.50',
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    p: 1,
                  }}
                >
                  <Typography variant="caption" color="primary.main" fontWeight={850}>
                    {workplaceNavigationPoiName(route.destination!, locale)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    position: 'absolute',
                    left: '35%',
                    top: '43%',
                    width: '35%',
                    borderTop: '4px dashed',
                    borderColor: 'primary.main',
                    transform: 'rotate(18deg)',
                    transformOrigin: 'left center',
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    left: '34%',
                    top: '40%',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                    border: '3px solid white',
                    boxShadow: 2,
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    right: '22%',
                    bottom: '37%',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                    border: '3px solid white',
                    boxShadow: 2,
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    right: 12,
                    p: 1,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(15, 39, 71, .92)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Route size={18} />
                  <Typography variant="body2" fontWeight={750} noWrap>
                    {workplaceNavigationDirection(route.steps[0]!, locale)}
                  </Typography>
                </Box>
              </Box>

              <Typography component="h3" variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                {locale === 'ko'
                  ? '도면 대체 순차 텍스트 안내'
                  : 'Accessible turn-by-turn directions'}
              </Typography>
              <Box
                component="ol"
                sx={{
                  listStyle: 'none',
                  p: 0,
                  m: 0,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                  gap: 1,
                }}
              >
                {route.steps.map((step, index) => (
                  <Box
                    component="li"
                    key={`${step.fromNodeId}-${step.toNodeId}-${index}`}
                    sx={(theme) => ({
                      ...workplaceMemberSoftSurface(theme),
                      display: 'grid',
                      gridTemplateColumns: '34px minmax(0, 1fr)',
                      gap: 1.25,
                      p: 1.25,
                    })}
                  >
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 32,
                        height: 32,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        fontWeight: 800,
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Box>
                      <Typography fontWeight={700}>
                        {workplaceNavigationDirection(step, locale)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {workplaceNavigationTravelModeLabel(step.travelMode, locale)} ·{' '}
                        {step.travelSeconds} {t('screen19.wayfinding.secondsShort')} ·{' '}
                        {step.floorId}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1.5 }}
              >
                {copy.asOf}: {displayTime(route.asOf, locale)}
              </Typography>
            </Box>
          </Stack>

          {selectedDestination ? (
            <Stack spacing={2}>
              <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: 2 })}>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Box>
                    <Typography variant="overline" color="primary.main">
                      {locale === 'ko' ? '목적지 정보' : 'Destination'}
                    </Typography>
                    <Typography component="h2" variant="h6" fontWeight={850}>
                      {workplaceNavigationPoiName(selectedDestination, locale)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      bgcolor: 'primary.50',
                      color: 'primary.main',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <DoorOpen size={22} />
                  </Box>
                </Stack>
                <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.5 }}>
                  <Chip size="small" label={selectedDestination.category} />
                  <Chip size="small" variant="outlined" label={selectedDestination.floorId} />
                </Stack>
                {(
                  locale === 'ko'
                    ? selectedDestination.directionHintKo
                    : selectedDestination.directionHintEn
                ) ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    {locale === 'ko'
                      ? selectedDestination.directionHintKo
                      : selectedDestination.directionHintEn}
                  </Typography>
                ) : null}
              </Box>
              <WorkplaceAccessPassPanel
                destination={selectedDestination}
                locale={locale}
                canUpdate={canUpdate}
                elevated={elevated}
              />
            </Stack>
          ) : null}
        </Box>
      )}

      {route && !guided && (
        <Box
          component="section"
          aria-labelledby="fallback-heading"
          sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, sm: 2 } })}
        >
          <InlineFeedback
            severity={route.outcome === 'ACCESS_DENIED' ? 'error' : 'warning'}
            sx={{ mb: 2 }}
          >
            {workplaceNavigationFallbackReason(route.outcome, locale) ||
              (locale === 'ko'
                ? '검증된 게시 경로를 표시할 수 없습니다.'
                : 'A verified published route cannot be displayed.')}
          </InlineFeedback>
          <Typography id="fallback-heading" component="h2" variant="h6" fontWeight={750}>
            {copy.fallbackTitle}
          </Typography>
          {breadcrumb.length > 0 && (
            <Stack
              component="nav"
              aria-label={copy.fallbackTitle}
              direction="row"
              gap={0.75}
              flexWrap="wrap"
              sx={{ my: 1.5 }}
            >
              {breadcrumb.map((part, index) => (
                <Chip
                  key={`${part}-${index}`}
                  icon={index === 0 ? <Building2 size={14} /> : <MapPin size={14} />}
                  label={part}
                  variant="outlined"
                />
              ))}
            </Stack>
          )}
          {route.fallback?.floorMapPath ? (
            <ActionButton
              component={Link}
              href={route.fallback.floorMapPath}
              intent="secondary"
              startIcon={<Map size={16} />}
            >
              {copy.floorMap}
            </ActionButton>
          ) : (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {copy.noFloorMap}
            </Typography>
          )}
          {route.fallback?.helpDesks.length ? (
            <Box sx={{ mt: 2 }}>
              <Typography fontWeight={700}>{copy.helpDesk}</Typography>
              {route.fallback.helpDesks.map((desk) => (
                <Typography key={desk.poiId} variant="body2" sx={{ mt: 0.5 }}>
                  {workplaceNavigationPoiName(desk, locale)}
                  {(locale === 'ko' ? desk.directionHintKo : desk.directionHintEn)
                    ? ` · ${locale === 'ko' ? desk.directionHintKo : desk.directionHintEn}`
                    : ''}
                </Typography>
              ))}
            </Box>
          ) : null}
          {route.limitations.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography fontWeight={700}>{copy.limitations}</Typography>
              <Box component="ul" sx={{ mt: 0.5 }}>
                {route.limitations.map((item) => (
                  <li key={item}>
                    <Typography variant="body2">{item}</Typography>
                  </li>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {!route && !routeMutation.isPending && !poisQuery.isLoading && !poisQuery.isError && (
        <EmptyState
          icon={<MapPin />}
          title={copy.routeSummary}
          description={
            locale === 'ko'
              ? '출발지와 목적지를 선택하면 게시 지도 기반 안내를 제공합니다.'
              : 'Select an origin and destination to use the published indoor graph.'
          }
        />
      )}
    </PageCanvas>
  );
}
