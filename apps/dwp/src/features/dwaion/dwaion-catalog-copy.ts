import type { DwaionActionKey } from '@dwp-frontend/shared-utils';

const KO = {
  agentEyebrow: 'DWAI·ON 엔터프라이즈 에이전트 카탈로그',
  catalogStatus: '활성 게시 레지스트리',
  filters: { ALL: '전체', GENERAL: '일반 업무', APPROVAL: '전자결재' },
  published: '활성 게시',
  selected: '선택됨',
  sourcePermission: '접근 소스 및 읽기 권한',
  permissionGranted: '현재 권한 확인됨',
  permissionRequired: '현재 권한 없음',
  anyPermission: '다음 중 하나',
  readOnly: '읽기 전용',
  safety: '안전 실행 및 버전 정책',
  humanReview: '담당 앱에서 사용자 최종 확인',
  schemaVersion: '프로필 스키마',
  catalogNotice:
    '현재 사용자 권한으로 열 수 있고 활성 게시된 에이전트만 표시합니다. 비공개 또는 비활성 에이전트 수는 공개되지 않습니다.',
  startWithAgent: '이 에이전트로 대화 시작',
  promptBoundary: '질문은 선택한 에이전트의 실제 출처 범위로 전달됩니다.',
  catalogTitle: '허용된 업무 행동 카탈로그',
  actionCount: (count: number) => `${count}개 연결`,
  noAutoCommit: '무변경 원칙',
  noAutoCommitDetail: 'DWAI·ON은 외부 앱의 저장·발송·제출을 직접 수행하지 않습니다.',
  boundaryTitle: '안전 실행 경계',
  boundaryDetail:
    '카탈로그는 현재 허용된 행동과 담당 앱을 보여줍니다. 실제 업무 값은 대화에서 서버 계획을 미리보기한 뒤 담당 앱으로 전달합니다.',
  responsibleApp: '담당 앱',
  inspect: '지원 범위 보기',
  close: '상세 닫기',
  retry: '다시 시도',
  selectAgent: '에이전트를 선택해 지원 범위를 확인하세요',
  selectAction: '행동을 선택해 입력과 확정 위치를 확인하세요',
  detail: '지원 범위와 검토 경계',
  can: '할 수 있는 일',
  cannot: '할 수 없는 일',
  sources: '읽을 수 있는 범위',
  review: '인계와 사용자 검토',
  owner: '담당',
  version: '게시 버전',
  revision: '리비전',
  risk: '위험 등급',
  metadata: '게시 정보',
  inspector: '인스펙터',
  versionRevision: (version: string, revision: number) => `${version} · 리비전 ${revision}`,
  registryBoundary:
    '게시 정보는 연결 상태를 뜻하지 않습니다. 실제 출처와 운영 준비 상태는 대화에서 확인합니다.',
  starters: '이 에이전트로 시작하기',
  recommendedPrompts: '추천 프롬프트',
  sourceBoundary:
    '선택한 에이전트의 출처 범위로 새 대화를 시작합니다. 현재 권한과 질문에 따라 실제 근거가 달라집니다.',
  launchError:
    '질문을 전달하지 못했습니다. 선택한 에이전트와 질문을 유지했습니다. 다시 시도하세요.',
  launching: '질문 전달 중',
  noSelection: '목록에서 항목을 선택하세요.',
  unavailable: '선택한 항목을 현재 카탈로그에서 찾을 수 없습니다.',
  permission: '카탈로그를 볼 권한이 없습니다. 현재 계정의 앱 권한을 확인하세요.',
  actionDetail: '행동과 담당 앱',
  mode: '연결 방식',
  modes: { REDIRECT: '담당 앱으로 이동', APPROVAL_HANDOFF: '결재 요청 화면으로 연결' },
  requiredPermission: '필요한 권한',
  confirmation: '사용자 확인',
  confirmationRequired: '담당 앱에서 필수',
  confirmationNotRequired: '추가 확인 요구 없음',
  inputs: '담당 앱에서 확인할 입력',
  noInputs: '등록된 입력 항목이 없습니다.',
  target: '담당 앱',
  finalLocation: '최종 확정 위치',
  catalogBoundary:
    '이 카탈로그에서는 업무 내용을 전달하지 않습니다. 대화의 실행 계획에서 실제 입력과 근거를 검토할 수 있습니다.',
  openApp: '담당 앱 열기',
  openBoundary: '앱을 연 뒤 내용을 입력하고 현재 권한으로 검토·확정합니다.',
  invalidTarget: '담당 앱의 연결 경로를 확인할 수 없습니다. 카탈로그를 다시 불러오세요.',
};

const EN: typeof KO = {
  agentEyebrow: 'DWAI·ON enterprise agent catalog',
  catalogStatus: 'Active published registry',
  filters: { ALL: 'All', GENERAL: 'General work', APPROVAL: 'Approvals' },
  published: 'Published',
  selected: 'Selected',
  sourcePermission: 'Sources and read permissions',
  permissionGranted: 'Available with current permissions',
  permissionRequired: 'Not in current permissions',
  anyPermission: 'Any one of',
  readOnly: 'Read only',
  safety: 'Safe execution and version policy',
  humanReview: 'Final user confirmation in the responsible app',
  schemaVersion: 'Profile schema',
  catalogNotice:
    'Only active published agents available to the current user are shown. Counts for private or inactive agents are not disclosed.',
  startWithAgent: 'Start a conversation with this agent',
  promptBoundary: "The question is transferred within the selected agent's actual source scope.",
  catalogTitle: 'Allowed work action catalog',
  actionCount: (count: number) => `${count} ${count === 1 ? 'connection' : 'connections'}`,
  noAutoCommit: 'No auto-commit',
  noAutoCommitDetail: 'DWAI·ON does not save, send, or submit changes in an external app.',
  boundaryTitle: 'Safe execution boundary',
  boundaryDetail:
    'The catalog shows currently allowed actions and their owning apps. Preview real work values in a server-verified conversation plan before handoff.',
  responsibleApp: 'Responsible app',
  inspect: 'View capabilities',
  close: 'Close details',
  retry: 'Retry',
  selectAgent: 'Select an agent to review its capabilities',
  selectAction: 'Select an action to review its inputs and final step',
  detail: 'Capabilities and review boundaries',
  can: 'What it can do',
  cannot: 'What it cannot do',
  sources: 'Readable sources',
  review: 'Handoff and your review',
  owner: 'Owner',
  version: 'Published version',
  revision: 'Revision',
  risk: 'Risk tier',
  metadata: 'Published metadata',
  inspector: 'Inspector',
  versionRevision: (version: string, revision: number) => `${version} · revision ${revision}`,
  registryBoundary:
    'Published metadata does not indicate connection health. The conversation shows actual sources and runtime readiness.',
  starters: 'Start with this agent',
  recommendedPrompts: 'Recommended prompts',
  sourceBoundary:
    'Start a new conversation in this agent’s source scope. Actual evidence depends on your current permissions and question.',
  launchError:
    'The question could not be transferred. Your agent and question are still selected. Please try again.',
  launching: 'Transferring question',
  noSelection: 'Select an item from the list.',
  unavailable: 'The selected item is unavailable in the current catalog.',
  permission: 'You do not have access to this catalog. Check your current app permissions.',
  actionDetail: 'Action and responsible app',
  mode: 'Connection mode',
  modes: { REDIRECT: 'Open responsible app', APPROVAL_HANDOFF: 'Open approval request' },
  requiredPermission: 'Required permission',
  confirmation: 'User confirmation',
  confirmationRequired: 'Required in the responsible app',
  confirmationNotRequired: 'No additional confirmation required',
  inputs: 'Inputs to review in the responsible app',
  noInputs: 'No input fields are registered.',
  target: 'Responsible app',
  finalLocation: 'Final confirmation',
  catalogBoundary:
    'This catalog does not transfer work content. Review actual inputs and evidence from the action plan in a conversation.',
  openApp: 'Open responsible app',
  openBoundary:
    'Enter the details and review and confirm them with your current permissions in the app.',
  invalidTarget: 'The responsible app route could not be verified. Reload the catalog.',
};

export function catalogCopy(language: 'ko' | 'en') {
  return language === 'ko' ? KO : EN;
}

export function actionDestination(key: DwaionActionKey, language: 'ko' | 'en') {
  const ko = language === 'ko';
  const destinations: Record<DwaionActionKey, { app: string; final: string; route: string }> = {
    'CALENDAR.EVENT.CREATE': {
      app: ko ? '캘린더' : 'Calendar',
      final: ko
        ? '일정 작성 화면에서 날짜·시간대·참석자를 확인하고 저장'
        : 'Review dates, time zone, and attendees, then save in the event editor',
      route: '/calendar/schedule?create=event',
    },
    'MAIL.DRAFT.CREATE': {
      app: ko ? '메일' : 'Mail',
      final: ko
        ? '메일 작성 화면에서 수신자와 본문을 확인하고 발송'
        : 'Review recipients and content, then send in the mail composer',
      route: '/mail/inbox?compose=open',
    },
    'SERVICE.REQUEST.CREATE': {
      app: ko ? '서비스' : 'Services',
      final: ko
        ? '서비스를 선택하고 요청 화면에서 내용을 검토·제출'
        : 'Choose a service, then review and submit in the request form',
      route: '/services/discover',
    },
    'APPROVAL.REQUEST.CREATE': {
      app: ko ? '전자결재' : 'Approvals',
      final: ko
        ? '결재 요청 화면에서 양식·결재선을 검토하고 상신. 승인은 별도 결재 단계'
        : 'Review the form and approvers, then submit the request. Approval remains a separate step',
      route: '/approvals/requests/new',
    },
  };
  return destinations[key];
}

export function actionInputLabel(field: string, language: 'ko' | 'en'): string {
  const labels: Record<string, [string, string]> = {
    title: ['제목', 'Title'],
    startsAt: ['시작 일시·시간대', 'Start date, time, and time zone'],
    endsAt: ['종료 일시·시간대', 'End date, time, and time zone'],
    attendees: ['참석자', 'Attendees'],
    to: ['수신자', 'Recipients'],
    subject: ['메일 제목', 'Subject'],
    body: ['본문', 'Body'],
    serviceCategory: ['서비스 분류', 'Service category'],
    requestSummary: ['요청 요약', 'Request summary'],
    formType: ['결재 양식', 'Approval form'],
    businessJustification: ['요청 사유', 'Business justification'],
    approvers: ['결재자', 'Approvers'],
  };
  return labels[field]?.[language === 'ko' ? 0 : 1] ?? field;
}
