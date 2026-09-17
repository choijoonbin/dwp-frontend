import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { getWorkplaceExplore, useProductSurfaceAuthority } from '@dwp-frontend/shared-utils';
import { useQuery } from '@tanstack/react-query';
import { InlineFeedback, LoadingState, PageCanvas } from '@dwp-frontend/design-system';

import { useRoomsCapabilities } from './rooms-capabilities';
import { WorkplaceDeviceOperations } from './workplace-navigation-device-operations';
import { WorkplaceWayfinding } from './workplace-navigation-wayfinding';

import type { WorkplaceNavigationLocale } from './workplace-navigation-model';

function useNavigationLocale(): WorkplaceNavigationLocale {
  const { i18n } = useTranslation('rooms');
  return resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
}

export function WorkplaceWayfindingPage() {
  const { t } = useTranslation('rooms');
  const [search, setSearch] = useSearchParams();
  const locale = useNavigationLocale();
  const capabilities = useRoomsCapabilities();
  const authority = useProductSurfaceAuthority();
  const range = useMemo(() => {
    const from = new Date();
    const to = new Date(from.getTime() + 60 * 60 * 1_000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const contextQuery = useQuery({
    queryKey: ['workplace', 'navigation', 'entry-context', range.from, range.to],
    queryFn: () => getWorkplaceExplore(range.from, range.to, null),
    retry: false,
  });
  if (contextQuery.isLoading) {
    return (
      <LoadingState
        label={
          locale === 'ko' ? '권한 있는 캠퍼스를 불러오는 중입니다.' : 'Loading authorized campuses.'
        }
      />
    );
  }
  if (contextQuery.isError || !contextQuery.data) {
    return (
      <PageCanvas topInset="compact">
        <InlineFeedback severity="error">
          {locale === 'ko'
            ? '실내 길찾기 기본 컨텍스트를 불러오지 못했습니다.'
            : 'The default indoor-navigation context could not be loaded.'}
        </InlineFeedback>
      </PageCanvas>
    );
  }
  const requestedSiteId = search.get('siteId')?.trim() ?? '';
  const sites = contextQuery.data.sites.filter((site) => site.state === 'ACTIVE');
  const authorizedSiteIds = new Set(sites.map((site) => site.siteId));
  const selectedSiteId = authorizedSiteIds.has(requestedSiteId)
    ? requestedSiteId
    : contextQuery.data.selectedFloor &&
        authorizedSiteIds.has(contextQuery.data.selectedFloor.siteId)
      ? contextQuery.data.selectedFloor.siteId
      : (contextQuery.data.resources.find((resource) => authorizedSiteIds.has(resource.siteId))
          ?.siteId ??
        sites[0]?.siteId ??
        '');
  if (!selectedSiteId) {
    return (
      <PageCanvas topInset="compact">
        <InlineFeedback severity="warning">
          {t('screen19.wayfinding.startFromContext')}
        </InlineFeedback>
      </PageCanvas>
    );
  }
  const currentBookingResourceId = contextQuery.data.occupancy.find(
    (occupancy) =>
      occupancy.currentUser &&
      contextQuery.data.resources.some(
        (resource) =>
          resource.resourceId === occupancy.resourceId && resource.siteId === selectedSiteId
      )
  )?.resourceId;
  const defaultResourceId =
    currentBookingResourceId ??
    contextQuery.data.resources.find(
      (resource) => resource.siteId === selectedSiteId && resource.state === 'AVAILABLE'
    )?.resourceId ??
    '';
  return (
    <>
      {requestedSiteId && requestedSiteId !== selectedSiteId ? (
        <PageCanvas topInset="compact">
          <InlineFeedback severity="warning">
            {locale === 'ko'
              ? '요청한 캠퍼스에 접근할 수 없어 권한 있는 기본 캠퍼스로 이동했습니다.'
              : 'The requested campus is unavailable. An authorized default was selected.'}
          </InlineFeedback>
        </PageCanvas>
      ) : null}
      <WorkplaceWayfinding
        siteId={selectedSiteId}
        locale={locale}
        initialOriginPoiId={search.get('originPoiId') ?? ''}
        initialDestinationPoiId={search.get('destinationPoiId') ?? ''}
        defaultDestinationResourceId={defaultResourceId}
        siteOptions={sites.map((site) => ({ siteId: site.siteId, name: site.name }))}
        onSiteChange={(siteId) => {
          const next = new URLSearchParams(search);
          next.set('siteId', siteId);
          next.delete('originPoiId');
          next.delete('destinationPoiId');
          setSearch(next, { replace: true });
        }}
        canUpdate={capabilities.canUpdateWorkplaceBooking}
        elevated={authority.snapshot?.envelope.activeAccessMode === 'ELEVATED'}
      />
    </>
  );
}

export function WorkplaceDeviceOperationsPage() {
  const locale = useNavigationLocale();
  const capabilities = useRoomsCapabilities();
  const authority = useProductSurfaceAuthority();
  return (
    <WorkplaceDeviceOperations
      locale={locale}
      canManage={capabilities.canManageWorkplaceAdmin}
      elevated={authority.snapshot?.envelope.activeAccessMode === 'ELEVATED'}
    />
  );
}
