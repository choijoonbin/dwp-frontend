import type {
  WorkplaceDevice,
  WorkplaceDeviceCommandReceipt,
  WorkplaceDeviceProviderTruth,
  WorkplaceDeviceScheduleItem,
  WorkplaceDeviceSafetyFrame,
  WorkplaceNavigationPoi,
  WorkplaceNavigationRoute,
  WorkplaceNavigationStep,
} from '@dwp-frontend/shared-utils/api/workplace-navigation-contract';

export type WorkplaceNavigationLocale = 'ko' | 'en';

export function workplaceNavigationPoiName(
  poi: Pick<WorkplaceNavigationPoi, 'nameKo' | 'nameEn'>,
  locale: WorkplaceNavigationLocale
) {
  return locale === 'ko' ? poi.nameKo : poi.nameEn;
}

export function workplaceNavigationDirection(
  step: Pick<WorkplaceNavigationStep, 'directionKo' | 'directionEn'>,
  locale: WorkplaceNavigationLocale
) {
  return locale === 'ko' ? step.directionKo : step.directionEn;
}

export function workplaceNavigationFallbackBreadcrumb(
  route: Pick<WorkplaceNavigationRoute, 'fallback'>
) {
  const fallback = route.fallback;
  if (!fallback) return [];
  return [fallback.siteName, fallback.floorName, fallback.resourceName].filter(
    (value): value is string => Boolean(value)
  );
}

export function workplaceNavigationCanRenderGuidedRoute(route: WorkplaceNavigationRoute) {
  return (
    route.outcome === 'GUIDED' &&
    Boolean(route.graphRevisionId) &&
    route.graphRevisionNumber > 0 &&
    Boolean(route.graphPublishedAt) &&
    route.steps.length > 0
  );
}

export function workplaceNavigationFallbackReason(
  outcome: WorkplaceNavigationRoute['outcome'],
  locale: WorkplaceNavigationLocale
) {
  const reasons = {
    ko: {
      GRAPH_MISSING: '게시된 실내 지도가 없어 경로를 표시할 수 없습니다.',
      GRAPH_STALE: '실내 지도가 오래되어 안전한 경로를 확정할 수 없습니다.',
      ACCESS_DENIED: '제한 구역 권한이 없어 이 경로를 안내할 수 없습니다.',
      NO_ROUTE: '선택한 조건에 맞는 경로가 없습니다.',
      GUIDED: '',
    },
    en: {
      GRAPH_MISSING: 'A published indoor map is unavailable, so a route cannot be shown.',
      GRAPH_STALE: 'The indoor map is stale, so a safe route cannot be confirmed.',
      ACCESS_DENIED: 'This route crosses an area you are not allowed to enter.',
      NO_ROUTE: 'No route matches the selected constraints.',
      GUIDED: '',
    },
  } as const;
  return reasons[locale][outcome];
}

export function workplaceNavigationTravelModeLabel(
  mode: WorkplaceNavigationStep['travelMode'],
  locale: WorkplaceNavigationLocale
) {
  const labels = {
    ko: { WALK: '도보', STAIR: '계단', ELEVATOR: '엘리베이터', RAMP: '경사로' },
    en: { WALK: 'Walk', STAIR: 'Stairs', ELEVATOR: 'Elevator', RAMP: 'Ramp' },
  } as const;
  return labels[locale][mode];
}

export function workplaceDeviceAttentionTone(device: WorkplaceDevice) {
  if (device.registrationState === 'SUSPENDED' || device.registrationState === 'RETIRED') {
    return 'error' as const;
  }
  if (device.connectivity === 'OFFLINE' || device.recentErrorCode) return 'error' as const;
  if (device.registrationState !== 'BOUND' || device.scheduleFreshness !== 'FRESH') {
    return 'warning' as const;
  }
  return 'success' as const;
}

export function workplaceProviderDisplayState(provider: WorkplaceDeviceProviderTruth) {
  const verifiedHealthy =
    provider.state === 'HEALTHY' &&
    Boolean(provider.evidenceReference) &&
    provider.observedConfigurationVersion === provider.configurationVersion &&
    Boolean(provider.lastSuccessAt);
  if (provider.state === 'HEALTHY' && !verifiedHealthy) return 'CONFIGURED_UNVERIFIED' as const;
  return provider.state;
}

export function workplaceDeviceCommandNeedsGetRecovery(
  receipt: WorkplaceDeviceCommandReceipt | null | undefined
) {
  return Boolean(
    receipt &&
    (receipt.state === 'ACCEPTED' ||
      receipt.state === 'RUNNING' ||
      receipt.state === 'RESULT_UNKNOWN')
  );
}

export function workplaceDeviceCommandMaySubmit(receipt: WorkplaceDeviceCommandReceipt | null) {
  return !receipt || receipt.state === 'SUCCEEDED' || receipt.state === 'FAILED';
}

export function workplaceMaskedSchedule(
  item: WorkplaceDeviceScheduleItem | null,
  locale: WorkplaceNavigationLocale
) {
  if (!item) return null;
  if (item.privacyMasked) {
    return {
      ...item,
      title: locale === 'ko' ? '비공개 일정' : 'Private event',
      organizer: null,
    };
  }
  return item;
}

export function workplaceActiveSafetyFrame(frame: WorkplaceDeviceSafetyFrame | null) {
  return frame?.state === 'ACTIVE' ? frame : null;
}

export function workplaceNavigationCopy(locale: WorkplaceNavigationLocale) {
  return locale === 'ko'
    ? {
        wayfindingTitle: '공간으로 이동',
        wayfindingDescription: '게시된 실내 지도와 권한을 기준으로 경로를 안내합니다.',
        origin: '출발지',
        destination: '목적지',
        accessible: '휠체어 접근 경로',
        avoidStairs: '계단 피하기',
        findRoute: '경로 찾기',
        selectPlaceholder: '위치를 선택하세요',
        loading: '정보를 불러오는 중입니다.',
        retry: '다시 시도',
        routeSummary: '경로 요약',
        minutes: '분',
        publishedGraph: '게시 지도',
        asOf: '기준 시각',
        limitations: '제한 사항',
        fallbackTitle: '대체 안내',
        floorMap: '층 지도 열기',
        helpDesk: '안내 데스크',
        noFloorMap: '사용 가능한 층 지도가 없습니다.',
        devicesTitle: '현장 장치 운영',
        devicesDescription: '등록, 바인딩, 상태, 원격 명령과 감사 증거를 관리합니다.',
        refresh: '새로고침',
        approve: '등록 승인',
        bind: '위치 연결',
        command: '원격 작업',
        reason: '사유',
        explicitConfirm: '영향을 확인했으며 이 작업을 실행합니다.',
        preview: '영향 미리보기',
        execute: '명령 실행',
        refreshReceipt: '상태 재조회',
        cancel: '취소',
        deviceDetail: '장치 상세',
        connectivity: '연결',
        heartbeat: '마지막 Heartbeat',
        scheduleFreshness: '일정 신선도',
        versions: '버전',
        recentError: '최근 오류',
        providers: 'Provider 검증 상태',
        audit: '감사 기록',
        commandReceipt: '명령 영수증',
        resultUnknown: '전송 결과가 불명확합니다. 원 명령을 다시 보내지 말고 상태만 조회하세요.',
        bindingSite: 'Site ID',
        bindingFloor: 'Floor ID',
        bindingResource: 'Resource ID',
        safetyOffline: '오프라인 안전 공지 유지',
        roomAvailable: '사용 가능',
        roomOccupied: '사용 중',
        roomUnavailable: '사용 불가',
        current: '현재',
        next: '다음',
        walkUp: '즉시 예약',
        checkIn: '체크인',
        earlyEnd: '조기 종료',
        privacy: '개인정보 보호 정책 적용',
        boardTitle: '층 공간 현황',
        available: '가용',
        occupied: '사용 중',
        unavailable: '사용 불가',
        stale: '표시 정보가 오래되었습니다.',
        safetyTakeover: '안전 공지',
        offlineFallback: '오프라인 대체 화면',
        returnToNormal: '안전 공지 해제 후 정상 화면으로 복귀합니다.',
      }
    : {
        wayfindingTitle: 'Navigate to space',
        wayfindingDescription:
          'Directions use the published indoor graph and your access permissions.',
        origin: 'From',
        destination: 'To',
        accessible: 'Wheelchair accessible',
        avoidStairs: 'Avoid stairs',
        findRoute: 'Find route',
        selectPlaceholder: 'Select a location',
        loading: 'Loading information.',
        retry: 'Try again',
        routeSummary: 'Route summary',
        minutes: 'min',
        publishedGraph: 'Published graph',
        asOf: 'As of',
        limitations: 'Limitations',
        fallbackTitle: 'Location guidance',
        floorMap: 'Open floor map',
        helpDesk: 'Help desk',
        noFloorMap: 'No floor map is available.',
        devicesTitle: 'Device operations',
        devicesDescription:
          'Manage registration, binding, health, remote commands, and audit evidence.',
        refresh: 'Refresh',
        approve: 'Approve registration',
        bind: 'Bind location',
        command: 'Remote command',
        reason: 'Reason',
        explicitConfirm: 'I reviewed the impact and explicitly confirm this operation.',
        preview: 'Preview impact',
        execute: 'Execute command',
        refreshReceipt: 'Refresh status',
        cancel: 'Cancel',
        deviceDetail: 'Device detail',
        connectivity: 'Connectivity',
        heartbeat: 'Last heartbeat',
        scheduleFreshness: 'Schedule freshness',
        versions: 'Versions',
        recentError: 'Recent error',
        providers: 'Provider verification',
        audit: 'Audit events',
        commandReceipt: 'Command receipt',
        resultUnknown:
          'The result is unknown. Query status only; do not send the original command again.',
        bindingSite: 'Site ID',
        bindingFloor: 'Floor ID',
        bindingResource: 'Resource ID',
        safetyOffline: 'Keep safety notice while offline',
        roomAvailable: 'Available',
        roomOccupied: 'In use',
        roomUnavailable: 'Unavailable',
        current: 'Now',
        next: 'Next',
        walkUp: 'Book now',
        checkIn: 'Check in',
        earlyEnd: 'End early',
        privacy: 'Privacy policy applied',
        boardTitle: 'Floor availability',
        available: 'Available',
        occupied: 'Occupied',
        unavailable: 'Unavailable',
        stale: 'This display is using stale information.',
        safetyTakeover: 'Safety notice',
        offlineFallback: 'Offline fallback frame',
        returnToNormal: 'The normal display returns after the safety notice is cleared.',
      };
}
