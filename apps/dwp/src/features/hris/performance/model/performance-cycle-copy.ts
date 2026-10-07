import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

export type PerformanceCycleCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  create: string;
  cycles: string;
  cyclesDescription: string;
  noCycles: string;
  noCyclesDescription: string;
  selectCycle: string;
  detail: string;
  detailDescription: string;
  edit: string;
  createSuccessor: string;
  validate: string;
  preview: string;
  publish: string;
  refresh: string;
  staleTitle: string;
  staleDescription: string;
  partialTitle: string;
  partialDescription: string;
  integrationTitle: string;
  integrationDescription: string;
  author: string;
  publisher: string;
  connected: string;
  unavailable: string;
  version: string;
  revision: string;
  period: string;
  openEnded: string;
  authoredBy: string;
  publishedBy: string;
  notPublished: string;
  stages: string;
  participantPreview: string;
  participantPreviewDescription: string;
  participantCount: string;
  reviewerCount: string;
  snapshotRevision: string;
  expires: string;
  asOf: string;
  generatePreview: string;
  noPreview: string;
  noPreviewDescription: string;
  stalePreviewTitle: string;
  stalePreviewDescription: string;
  unknownPreviewTitle: string;
  unknownPreviewDescription: string;
  participantRef: string;
  assignmentRef: string;
  organizationRef: string;
  reviewerRef: string;
  jobProfileRef: string;
  gradeRef: string;
  status: string;
  eligibility: string;
  commandUnknownTitle: string;
  commandUnknownDescription: string;
  checkReceipt: string;
  retryExact: string;
  conflictTitle: string;
  conflictDescription: string;
  loadLatest: string;
  rejectedTitle: string;
  rejectedDescription: string;
  permissionTitle: string;
  permissionDescription: string;
  saved: string;
  cancel: string;
  save: string;
  createDraft: string;
  cycleKey: string;
  displayName: string;
  retentionPolicy: string;
  effectiveFrom: string;
  effectiveTo: string;
  timezone: string;
  policyVersion: string;
  populationRule: string;
  stageKey: string;
  stageType: string;
  opensAt: string;
  closesAt: string;
  required: string;
  addStage: string;
  removeStage: string;
  invalidDraft: string;
  approvalRef: string;
  approvalHelp: string;
  publishTitle: string;
  publishDescription: string;
  publishImpact: string;
  reason: string;
  reasonRequired: string;
}>;

const EN: PerformanceCycleCopy = {
  eyebrow: 'Talent operations · governed authoring',
  title: 'Performance cycle studio',
  description:
    'Author versioned cycles, review an opaque participant snapshot, and publish with separate approval authority.',
  create: 'Create cycle',
  cycles: 'Cycles',
  cyclesDescription: 'Server-authorized cycles in the selected workforce scope.',
  noCycles: 'No performance cycles',
  noCyclesDescription: 'Create a draft only when the server exposes CREATE_DRAFT.',
  selectCycle: 'Select a cycle',
  detail: 'Cycle details',
  detailDescription: 'The active immutable version and its concurrency revision.',
  edit: 'Edit draft',
  createSuccessor: 'Create successor draft',
  validate: 'Validate draft',
  preview: 'Preview participants',
  publish: 'Publish cycle',
  refresh: 'Refresh',
  staleTitle: 'Showing cached data',
  staleDescription:
    'The latest read failed. Review the cached values and refresh before changing anything.',
  partialTitle: 'Cycle detail unavailable',
  partialDescription:
    'The cycle list loaded, but this detail did not. Other cycles remain available.',
  integrationTitle: 'Command authority is not connected',
  integrationDescription:
    'This exported studio fails closed until its author and publisher action bindings are registered and injected.',
  author: 'Author commands',
  publisher: 'Publisher command',
  connected: 'Connected',
  unavailable: 'Unavailable',
  version: 'Version',
  revision: 'Revision',
  period: 'Effective period',
  openEnded: 'Open-ended',
  authoredBy: 'Authored by',
  publishedBy: 'Published by',
  notPublished: 'Not published',
  stages: 'Stages',
  participantPreview: 'Participant preview',
  participantPreviewDescription:
    'Minimum fields only: counts, statuses, and opaque references. Names and email are never requested.',
  participantCount: 'Participants',
  reviewerCount: 'Reviewers',
  snapshotRevision: 'Workforce revision',
  expires: 'Expires',
  asOf: 'Snapshot as of',
  generatePreview: 'Generate preview',
  noPreview: 'No current preview',
  noPreviewDescription:
    'Generate a preview after validation. Publication remains disabled until it is READY and current.',
  stalePreviewTitle: 'Preview is stale',
  stalePreviewDescription:
    'The cycle version, rule, workforce revision, or expiry changed. Generate and review a new preview.',
  unknownPreviewTitle: 'Preview result is unknown',
  unknownPreviewDescription:
    'Do not publish. Reconcile the receipt or replay the exact idempotent command.',
  participantRef: 'Participant ref',
  assignmentRef: 'Primary assignment ref',
  organizationRef: 'Organization ref',
  reviewerRef: 'Reviewer assignment ref',
  jobProfileRef: 'Job profile ref',
  gradeRef: 'Grade ref',
  status: 'Workforce status',
  eligibility: 'Eligibility',
  commandUnknownTitle: 'Command result is not confirmed',
  commandUnknownDescription:
    'No success is assumed. A known receipt is checked; without one, retry sends the exact same command ID and body.',
  checkReceipt: 'Check receipt',
  retryExact: 'Retry exact command',
  conflictTitle: 'Draft is stale',
  conflictDescription:
    'Your draft is preserved. Load the latest revision, review the differences, then submit again.',
  loadLatest: 'Load latest revision',
  rejectedTitle: 'Command was not applied',
  rejectedDescription:
    'Review the server response and the preserved draft. Quarantined commands require operational follow-up.',
  permissionTitle: 'Authority changed',
  permissionDescription:
    'Sensitive detail and preview data were cleared. Re-check access before continuing.',
  saved: 'Confirmed after fresh read.',
  cancel: 'Cancel',
  save: 'Save draft',
  createDraft: 'Create draft',
  cycleKey: 'Cycle key',
  displayName: 'Display name',
  retentionPolicy: 'Retention policy UUID',
  effectiveFrom: 'Effective from',
  effectiveTo: 'Effective to (optional)',
  timezone: 'Time zone',
  policyVersion: 'Policy version UUID',
  populationRule: 'Population rule version UUID',
  stageKey: 'Stage key',
  stageType: 'Stage type',
  opensAt: 'Opens at',
  closesAt: 'Closes at',
  required: 'Required stage',
  addStage: 'Add stage',
  removeStage: 'Remove stage',
  invalidDraft:
    'Complete every required field with valid UUIDs, instants, and ordered stage windows.',
  approvalRef: 'Publication approval UUID',
  approvalHelp:
    'Paste the approval evidence issued by the approval workflow. This studio never fabricates it.',
  publishTitle: 'Review publication',
  publishDescription: 'Publishing freezes this reviewed cycle version and participant snapshot.',
  publishImpact: 'Publication impact',
  reason: 'Publication reason',
  reasonRequired: 'Enter 10–500 characters and provide a valid approval UUID.',
};

const KO: PerformanceCycleCopy = {
  ...EN,
  eyebrow: '인재 운영 · 통제된 작성',
  title: '성과 주기 스튜디오',
  description:
    '버전이 있는 주기를 작성하고 불투명 참조만 포함한 참여자 스냅샷을 검토한 뒤 별도 승인 권한으로 게시합니다.',
  create: '주기 만들기',
  cycles: '성과 주기',
  cyclesDescription: '선택한 인력 범위에서 서버가 허용한 주기입니다.',
  noCycles: '성과 주기가 없습니다',
  noCyclesDescription: '서버가 CREATE_DRAFT를 제공할 때만 초안을 만들 수 있습니다.',
  selectCycle: '주기 선택',
  detail: '주기 상세',
  detailDescription: '활성 불변 버전과 동시성 리비전입니다.',
  edit: '초안 편집',
  createSuccessor: '후속 초안 만들기',
  validate: '초안 검증',
  preview: '참여자 미리보기',
  publish: '주기 게시',
  refresh: '새로고침',
  staleTitle: '캐시된 데이터 표시 중',
  staleDescription: '최신 조회에 실패했습니다. 변경 전에 값을 검토하고 새로고침하세요.',
  partialTitle: '주기 상세를 불러올 수 없음',
  partialDescription:
    '목록은 불러왔지만 이 상세는 실패했습니다. 다른 주기는 계속 사용할 수 있습니다.',
  integrationTitle: '명령 권한이 연결되지 않음',
  integrationDescription:
    '작성자 및 게시자 액션 바인딩이 등록·주입될 때까지 이 내보낸 스튜디오는 안전하게 차단됩니다.',
  author: '작성자 명령',
  publisher: '게시자 명령',
  connected: '연결됨',
  unavailable: '사용 불가',
  participantPreview: '참여자 미리보기',
  participantPreviewDescription:
    '최소 필드만 표시합니다: 집계, 상태, 불투명 참조. 이름과 이메일은 요청하지 않습니다.',
  noPreview: '현재 미리보기 없음',
  noPreviewDescription: '검증 후 미리보기를 생성하세요. READY 최신 상태 전에는 게시할 수 없습니다.',
  participantRef: '참여자 참조',
  assignmentRef: '주 배정 참조',
  organizationRef: '조직 참조',
  reviewerRef: '검토자 배정 참조',
  jobProfileRef: '직무 프로필 참조',
  gradeRef: '등급 참조',
  status: '재직 상태',
  eligibility: '적격 상태',
  commandUnknownTitle: '명령 결과가 확인되지 않음',
  commandUnknownDescription:
    '성공으로 간주하지 않습니다. 영수증이 있으면 조회하고, 없으면 같은 명령 ID와 본문으로 다시 시도합니다.',
  checkReceipt: '영수증 확인',
  retryExact: '동일 명령 재시도',
  conflictTitle: '초안이 오래됨',
  conflictDescription:
    '초안은 보존되었습니다. 최신 리비전을 불러와 차이를 검토한 뒤 다시 제출하세요.',
  loadLatest: '최신 리비전 불러오기',
  permissionTitle: '권한이 변경됨',
  permissionDescription:
    '민감한 상세와 미리보기 데이터를 지웠습니다. 계속하기 전에 권한을 확인하세요.',
  approvalRef: '게시 승인 UUID',
  approvalHelp: '승인 워크플로에서 발급된 증거를 붙여넣으세요. 스튜디오가 값을 만들지 않습니다.',
};

export function getPerformanceCycleCopy(...languages: Array<string | undefined>) {
  return resolveSupportedLocale(...languages) === 'ko' ? KO : EN;
}
