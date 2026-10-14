export type NavigationPolicyCopy = Readonly<{
  title: string;
  description: string;
  refresh: string;
  scope: string;
  tenant: string;
  legalEntity: string;
  lifecycle: string;
  rollout: string;
  impactTitle: string;
  impactDescription: string;
  recoveryTitle: string;
  recoveryDescription: string;
  groupsTitle: string;
  defaultNode: string;
  moveUp: string;
  moveDown: string;
  loadingTitle: string;
  emptyTitle: string;
  deniedTitle: string;
  deniedDescription: string;
  unavailableTitle: string;
  staleTitle: string;
  partialTitle: string;
  commandUnavailable: string;
}>;

const COPY: Readonly<Record<'ko' | 'en', NavigationPolicyCopy>> = {
  ko: {
    title: 'HRIS 메뉴 정책',
    description: '테넌트 기준과 법인별 제한을 검토하고 하나의 불변 정책 리비전으로 게시합니다.',
    refresh: '새로고침',
    scope: '적용 범위',
    tenant: '테넌트 기준',
    legalEntity: '법인 제한',
    lifecycle: '수명주기',
    rollout: '적용 모드',
    impactTitle: '게시 영향',
    impactDescription:
      '표시 설정은 권한을 부여하지 않으며, PAGE 권한이 없는 메뉴는 항상 제외됩니다.',
    recoveryTitle: '복구와 감사',
    recoveryDescription:
      '복원은 과거 리비전을 수정하지 않고 이전 digest를 가리키는 새 리비전을 만듭니다.',
    groupsTitle: '인사 운영 메뉴 구성',
    defaultNode: '기본 메뉴',
    moveUp: '위로 이동',
    moveDown: '아래로 이동',
    loadingTitle: '메뉴 정책 근거를 불러오는 중입니다',
    emptyTitle: '아직 게시된 메뉴 정책이 없습니다',
    deniedTitle: '메뉴 정책 접근이 제한되었습니다',
    deniedDescription: '현재 범위에는 설정 관리자 PAGE 권한이 없습니다.',
    unavailableTitle: '메뉴 정책 서비스를 사용할 수 없습니다',
    staleTitle: '정책 근거가 오래되었습니다',
    partialTitle: '일부 정책 근거를 확인하지 못했습니다',
    commandUnavailable: '중앙 통제 명령 권한이 연결되지 않아 변경 작업이 비활성화되었습니다.',
  },
  en: {
    title: 'HRIS navigation policy',
    description:
      'Review the tenant baseline and legal-entity restrictions, then publish one immutable policy revision.',
    refresh: 'Refresh',
    scope: 'Scope',
    tenant: 'Tenant baseline',
    legalEntity: 'Legal-entity restriction',
    lifecycle: 'Lifecycle',
    rollout: 'Rollout mode',
    impactTitle: 'Publication impact',
    impactDescription:
      'Visibility never grants authority. A menu without exact PAGE authority is always removed.',
    recoveryTitle: 'Recovery and audit',
    recoveryDescription:
      'Restore creates a new revision pinned to a prior digest; it never mutates published history.',
    groupsTitle: 'HR Operations menu composition',
    defaultNode: 'Default menu',
    moveUp: 'Move up',
    moveDown: 'Move down',
    loadingTitle: 'Loading navigation-policy evidence',
    emptyTitle: 'No navigation policy has been published yet',
    deniedTitle: 'Navigation-policy access is restricted',
    deniedDescription: 'This scope does not have the configuration-administrator PAGE authority.',
    unavailableTitle: 'Navigation-policy service is unavailable',
    staleTitle: 'Policy evidence is stale',
    partialTitle: 'Some policy evidence is unavailable',
    commandUnavailable:
      'Changes are disabled because the centrally governed command authority is not connected.',
  },
};

export function navigationPolicyCopy(locale?: string): NavigationPolicyCopy {
  const resolved = locale ?? (typeof navigator === 'undefined' ? 'en' : navigator.language);
  return COPY[resolved.toLowerCase().startsWith('ko') ? 'ko' : 'en'];
}
