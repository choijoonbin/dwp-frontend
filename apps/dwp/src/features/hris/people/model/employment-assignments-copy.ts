import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

export type EmploymentAssignmentsCopy = Readonly<{
  persona: string;
  title: string;
  description: string;
  question: string;
  guidance: string;
  refresh: string;
  refreshing: string;
  asOf: string;
  assignmentCount: (count: number) => string;
  listTitle: string;
  listDescription: string;
  searchLabel: string;
  searchHelp: string;
  noMatchesTitle: string;
  noMatchesDescription: string;
  clearSearch: string;
  emptyTitle: string;
  emptyDescription: string;
  partialTitle: string;
  partialDescription: string;
  staleTitle: string;
  staleDescription: string;
  detailTitle: string;
  detailDescription: string;
  chooseTitle: string;
  chooseDescription: string;
  reviewAssignment: (index: number) => string;
  startEvent: string;
  eventUnavailableTitle: string;
  eventUnavailableDescription: string;
  eventPausedTitle: string;
  eventPausedDescription: string;
  evidenceIncompleteTitle: string;
  evidenceIncompleteDescription: string;
  unavailable: string;
  assignmentStatus: string;
  workerStatus: string;
  relationshipType: string;
  effectivePeriod: string;
  current: string;
  primary: string;
  yes: string;
  no: string;
  fte: string;
  workerReference: string;
  personReference: string;
  relationshipReference: string;
  assignmentReference: string;
  workerVersion: string;
  relationshipVersion: string;
  assignmentVersion: string;
  ownerEvidence: string;
  ownerPublicId: string;
  ownerRevision: string;
  ownerValidity: string;
  ownerContentHash: string;
  legalEmployer: string;
  organization: string;
  position: string;
  job: string;
  workLocation: string;
}>;

const en: EmploymentAssignmentsCopy = {
  persona: 'HR business operations',
  title: 'Employment assignments',
  description:
    'Review effective-dated worker assignments and start a governed employment lifecycle event.',
  question: 'Which current assignment needs an employment lifecycle action now?',
  guidance:
    'Select an assignment, verify its worker and owner versions, then start a concurrent-employment event from that exact evidence.',
  refresh: 'Refresh assignments',
  refreshing: 'Refreshing assignments',
  asOf: 'Owner snapshot',
  assignmentCount: (count) => `${count} ${count === 1 ? 'assignment' : 'assignments'}`,
  listTitle: 'Effective assignments',
  listDescription: 'Choose one assignment to inspect its versioned owner evidence.',
  searchLabel: 'Search assignments',
  searchHelp: 'Search by worker, person, relationship, assignment, or owner reference.',
  noMatchesTitle: 'No assignments match this search',
  noMatchesDescription: 'Clear the search to return to all disclosed assignments.',
  clearSearch: 'Clear search',
  emptyTitle: 'No effective assignments are available',
  emptyDescription:
    'The People service returned no employment assignment for this operations scope.',
  partialTitle: 'The latest refresh is unavailable',
  partialDescription:
    'The last successful assignments remain visible, but lifecycle actions are paused until owner evidence refreshes.',
  staleTitle: 'The assignment snapshot is stale',
  staleDescription:
    'Review remains available, but lifecycle actions are paused until a current owner snapshot is loaded.',
  detailTitle: 'Assignment evidence',
  detailDescription:
    'The action below binds the current worker version and rechecks owner evidence before creation.',
  chooseTitle: 'Choose an assignment',
  chooseDescription: 'Select an assignment from the list to inspect its governed owner evidence.',
  reviewAssignment: (index) => `Review assignment ${index}`,
  startEvent: 'Start concurrent employment event',
  eventUnavailableTitle: 'Lifecycle actions are not available',
  eventUnavailableDescription:
    'The exact hcm.operations assignment-management grant is not writable in this scope.',
  eventPausedTitle: 'Lifecycle action is paused',
  eventPausedDescription: 'Refresh the owner snapshot before starting an event.',
  evidenceIncompleteTitle: 'Owner evidence is incomplete',
  evidenceIncompleteDescription:
    'This assignment remains available for review, but an employment event cannot start until every required owner reference and FTE value is available.',
  unavailable: 'Not available',
  assignmentStatus: 'Assignment status',
  workerStatus: 'Worker status',
  relationshipType: 'Relationship type',
  effectivePeriod: 'Effective period',
  current: 'Current',
  primary: 'Primary assignment',
  yes: 'Yes',
  no: 'No',
  fte: 'Full-time equivalent',
  workerReference: 'Worker reference',
  personReference: 'Person reference',
  relationshipReference: 'Relationship reference',
  assignmentReference: 'Assignment reference',
  workerVersion: 'Worker version',
  relationshipVersion: 'Relationship version',
  assignmentVersion: 'Assignment version',
  ownerEvidence: 'Versioned owner evidence',
  ownerPublicId: 'Public ID',
  ownerRevision: 'Revision',
  ownerValidity: 'Valid period',
  ownerContentHash: 'Content hash',
  legalEmployer: 'Legal employer',
  organization: 'Organization',
  position: 'Position',
  job: 'Job',
  workLocation: 'Work location',
};

const ko: EmploymentAssignmentsCopy = {
  persona: 'HR 비즈니스 운영',
  title: '고용 배치',
  description: '유효일 기반 직원 배치를 확인하고 통제된 고용 생애주기 이벤트를 시작합니다.',
  question: '지금 고용 생애주기 조치가 필요한 현재 배치는 무엇인가요?',
  guidance:
    '배치를 선택하고 직원 및 owner 버전을 확인한 뒤 해당 근거에서 겸직 이벤트를 시작하세요.',
  refresh: '배치 새로고침',
  refreshing: '배치 새로고침 중',
  asOf: 'Owner 스냅샷',
  assignmentCount: (count) => `배치 ${count}건`,
  listTitle: '유효한 배치',
  listDescription: '버전이 지정된 owner 근거를 확인할 배치를 선택하세요.',
  searchLabel: '배치 검색',
  searchHelp: '직원, 개인, 고용 관계, 배치 또는 owner 참조로 검색합니다.',
  noMatchesTitle: '검색 조건과 일치하는 배치가 없습니다',
  noMatchesDescription: '모든 공개 배치로 돌아가려면 검색어를 지우세요.',
  clearSearch: '검색어 지우기',
  emptyTitle: '유효한 배치가 없습니다',
  emptyDescription: 'People 서비스가 현재 운영 범위에서 고용 배치를 반환하지 않았습니다.',
  partialTitle: '최신 정보를 새로고치지 못했습니다',
  partialDescription:
    '마지막으로 조회한 배치는 계속 표시하지만 owner 근거가 갱신될 때까지 생애주기 조치를 일시 중지합니다.',
  staleTitle: '배치 스냅샷이 오래되었습니다',
  staleDescription:
    '검토는 가능하지만 현재 owner 스냅샷을 불러올 때까지 생애주기 조치를 일시 중지합니다.',
  detailTitle: '배치 근거',
  detailDescription:
    '아래 조치는 현재 직원 버전에 바인딩되며 생성 전에 owner 근거를 다시 확인합니다.',
  chooseTitle: '배치를 선택하세요',
  chooseDescription: '목록에서 배치를 선택하여 통제된 owner 근거를 확인하세요.',
  reviewAssignment: (index) => `배치 ${index} 검토`,
  startEvent: '겸직 이벤트 시작',
  eventUnavailableTitle: '생애주기 조치를 사용할 수 없습니다',
  eventUnavailableDescription:
    '현재 범위에서 정확한 hcm.operations 배치 관리 권한을 쓰기 권한으로 사용할 수 없습니다.',
  eventPausedTitle: '생애주기 조치가 일시 중지되었습니다',
  eventPausedDescription: '이벤트를 시작하기 전에 owner 스냅샷을 새로고침하세요.',
  evidenceIncompleteTitle: 'Owner 근거가 불완전합니다',
  evidenceIncompleteDescription:
    '이 배치는 계속 검토할 수 있지만 필수 owner 참조와 FTE 값을 모두 확인할 때까지 고용 이벤트를 시작할 수 없습니다.',
  unavailable: '확인 불가',
  assignmentStatus: '배치 상태',
  workerStatus: '직원 상태',
  relationshipType: '고용 관계 유형',
  effectivePeriod: '유효기간',
  current: '현재',
  primary: '주 배치',
  yes: '예',
  no: '아니요',
  fte: 'FTE',
  workerReference: '직원 참조',
  personReference: '개인 참조',
  relationshipReference: '고용 관계 참조',
  assignmentReference: '배치 참조',
  workerVersion: '직원 버전',
  relationshipVersion: '고용 관계 버전',
  assignmentVersion: '배치 버전',
  ownerEvidence: '버전이 지정된 owner 근거',
  ownerPublicId: '공개 ID',
  ownerRevision: '리비전',
  ownerValidity: '유효기간',
  ownerContentHash: '콘텐츠 해시',
  legalEmployer: '법적 고용주',
  organization: '조직',
  position: '포지션',
  job: '직무',
  workLocation: '근무지',
};

export function getEmploymentAssignmentsCopy(
  resolvedLanguage?: string,
  language?: string
): EmploymentAssignmentsCopy {
  return resolveSupportedLocale(resolvedLanguage, language) === 'ko' ? ko : en;
}
