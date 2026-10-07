import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

type People360Copy = Readonly<{
  title: string;
  eyebrow: string;
  description: string;
  searchLabel: string;
  searchPlaceholder: string;
  filters: string;
  closeFilters: string;
  applyFilters: string;
  resetFilters: string;
  status: string;
  allStatuses: string;
  asOf: string;
  refresh: string;
  retry: string;
  loadMore: string;
  resultCount: (count: number) => string;
  moreAvailable: string;
  loading: string;
  emptyTitle: string;
  emptyDescription: string;
  filteredEmptyTitle: string;
  filteredEmptyDescription: string;
  partialListTitle: string;
  partialListDescription: string;
  staleTitle: string;
  staleDescription: string;
  accessBoundary: string;
  accessDescription: string;
  openPerson: (name: string) => string;
  undisclosedPerson: string;
  notAvailable: string;
  masked: string;
  detailTitle: string;
  closeDetail: string;
  detailLoading: string;
  partialTitle: string;
  partialDescription: string;
  partialState: string;
  personSection: string;
  employmentSection: string;
  assignmentSection: string;
  unavailableSection: string;
  projectionSection: string;
  displayName: string;
  lifecycleState: string;
  preferredLocale: string;
  timeZone: string;
  workerNumber: string;
  workerType: string;
  workerStatus: string;
  originalHireDate: string;
  relationshipType: string;
  relationshipPeriod: string;
  legalEmployer: string;
  assignmentKey: string;
  assignmentStatus: string;
  businessTitle: string;
  organization: string;
  jobProfile: string;
  jobGrade: string;
  location: string;
  manager: string;
  effectivePeriod: string;
  current: string;
  fieldPolicy: string;
  policyScope: string;
  policyRevision: string;
  projectionRevision: string;
  effectiveDate: string;
}>;

const en: People360Copy = {
  title: 'People 360',
  eyebrow: 'Authorized workforce snapshot',
  description:
    'Find a person inside your current population scope and inspect the person, employment, and one primary assignment effective on the selected date.',
  searchLabel: 'Search authorized people',
  searchPlaceholder: 'Name or worker reference',
  filters: 'Filters',
  closeFilters: 'Close filters',
  applyFilters: 'Show results',
  resetFilters: 'Reset filters',
  status: 'Employment status',
  allStatuses: 'All authorized statuses',
  asOf: 'Effective date',
  refresh: 'Refresh snapshot',
  retry: 'Retry',
  loadMore: 'Load more authorized people',
  resultCount: (count) => `${count} loaded`,
  moreAvailable: 'More available',
  loading: 'Loading authorized People 360 snapshots',
  emptyTitle: 'No people are available in this scope',
  emptyDescription:
    'The People service returned no person snapshots for this effective date and population scope.',
  filteredEmptyTitle: 'No authorized people match these filters',
  filteredEmptyDescription: 'Change the search, status, or effective date and try again.',
  partialListTitle: 'Some snapshots could not be refreshed',
  partialListDescription:
    'Previously loaded snapshots remain visible. Retry before relying on them for current work.',
  staleTitle: 'Showing the last successful snapshot',
  staleDescription:
    'The latest owner-service refresh failed. The displayed projection may be stale; retry to reconcile it.',
  accessBoundary: 'Server-enforced disclosure',
  accessDescription:
    'The owner service decides target population and each VIEW, MASK, or OMIT field. This screen does not calculate or reverse those decisions.',
  openPerson: (name) => `Open People 360 for ${name}`,
  undisclosedPerson: 'Name not disclosed',
  notAvailable: 'Not available',
  masked: 'Masked by policy',
  detailTitle: 'People 360 detail',
  closeDetail: 'Close People 360 detail',
  detailLoading: 'Loading the selected People 360 snapshot',
  partialTitle: 'This snapshot is partial',
  partialDescription:
    'One or more owner projections are unavailable. Available sections remain read-only and policy-projected.',
  partialState: 'Partial',
  personSection: 'Person',
  employmentSection: 'Employment',
  assignmentSection: 'Primary assignment',
  unavailableSection: 'This section was omitted or is unavailable for the selected date.',
  projectionSection: 'Projection evidence',
  displayName: 'Display name',
  lifecycleState: 'Person status',
  preferredLocale: 'Preferred locale',
  timeZone: 'Time zone',
  workerNumber: 'Worker number',
  workerType: 'Worker type',
  workerStatus: 'Employment status',
  originalHireDate: 'Original hire date',
  relationshipType: 'Relationship type',
  relationshipPeriod: 'Employment period',
  legalEmployer: 'Legal employer',
  assignmentKey: 'Assignment reference',
  assignmentStatus: 'Assignment status',
  businessTitle: 'Business title',
  organization: 'Organization',
  jobProfile: 'Job profile',
  jobGrade: 'Job grade',
  location: 'Work location',
  manager: 'Manager',
  effectivePeriod: 'Assignment period',
  current: 'Current',
  fieldPolicy: 'Field policy',
  policyScope: 'Population scope',
  policyRevision: 'Policy revision',
  projectionRevision: 'Projection revision',
  effectiveDate: 'Effective date',
};

const ko: People360Copy = {
  ...en,
  title: 'People 360',
  eyebrow: '권한이 적용된 인력 스냅샷',
  description:
    '현재 대상 범위에서 구성원을 찾고 선택한 기준일에 유효한 개인, 고용, 단일 주 배치 정보를 확인합니다.',
  searchLabel: '조회 가능한 구성원 검색',
  searchPlaceholder: '이름 또는 직원 참조',
  filters: '필터',
  closeFilters: '필터 닫기',
  applyFilters: '결과 보기',
  resetFilters: '필터 초기화',
  status: '고용 상태',
  allStatuses: '조회 가능한 전체 상태',
  asOf: '기준일',
  refresh: '스냅샷 새로고침',
  retry: '다시 시도',
  loadMore: '조회 가능한 구성원 더 불러오기',
  resultCount: (count) => `${count}명 불러옴`,
  moreAvailable: '추가 결과 있음',
  loading: '권한이 적용된 People 360 스냅샷을 불러오는 중',
  emptyTitle: '현재 범위에서 조회할 구성원이 없습니다',
  emptyDescription:
    'People 서비스가 이 기준일과 대상 범위에 해당하는 스냅샷을 반환하지 않았습니다.',
  filteredEmptyTitle: '필터와 일치하는 조회 가능 구성원이 없습니다',
  filteredEmptyDescription: '검색어, 고용 상태 또는 기준일을 바꿔 다시 시도하세요.',
  partialListTitle: '일부 스냅샷을 새로고치지 못했습니다',
  partialListDescription:
    '이전에 불러온 결과를 표시합니다. 현재 업무에 사용하기 전에 다시 시도하세요.',
  staleTitle: '마지막으로 성공한 스냅샷을 표시합니다',
  staleDescription:
    '최신 owner-service 새로고침에 실패했습니다. 표시 정보가 오래되었을 수 있으므로 다시 대사하세요.',
  accessBoundary: '서버가 확정한 공개 범위',
  accessDescription:
    'Owner 서비스가 대상 범위와 각 필드의 VIEW, MASK, OMIT을 결정합니다. 화면은 결정을 계산하거나 되돌리지 않습니다.',
  openPerson: (name) => `${name}의 People 360 열기`,
  undisclosedPerson: '이름 비공개',
  notAvailable: '정보 없음',
  masked: '정책에 따라 마스킹됨',
  detailTitle: 'People 360 상세',
  closeDetail: 'People 360 상세 닫기',
  detailLoading: '선택한 People 360 스냅샷을 불러오는 중',
  partialTitle: '일부 정보만 제공되는 스냅샷입니다',
  partialDescription:
    '하나 이상의 owner projection을 사용할 수 없습니다. 제공된 섹션은 읽기 전용 정책 투영 결과입니다.',
  partialState: '일부 제공',
  personSection: '개인',
  employmentSection: '고용',
  assignmentSection: '주 배치',
  unavailableSection: '이 기준일에는 이 섹션이 제외되었거나 제공되지 않습니다.',
  projectionSection: '투영 근거',
  displayName: '표시 이름',
  lifecycleState: '개인 상태',
  preferredLocale: '선호 언어',
  timeZone: '시간대',
  workerNumber: '직원 번호',
  workerType: '고용 유형',
  workerStatus: '고용 상태',
  originalHireDate: '최초 입사일',
  relationshipType: '고용 관계 유형',
  relationshipPeriod: '고용 관계 기간',
  legalEmployer: '법적 고용주',
  assignmentKey: '배치 참조',
  assignmentStatus: '배치 상태',
  businessTitle: '직무명',
  organization: '조직',
  jobProfile: '직무 프로필',
  jobGrade: '직급',
  location: '근무 위치',
  manager: '관리자',
  effectivePeriod: '배치 유효기간',
  current: '현재',
  fieldPolicy: '필드 정책',
  policyScope: '대상 범위',
  policyRevision: '정책 리비전',
  projectionRevision: '투영 리비전',
  effectiveDate: '기준일',
};

export function getPeople360Copy(resolvedLanguage?: string, language?: string): People360Copy {
  return resolveSupportedLocale(resolvedLanguage, language) === 'ko' ? ko : en;
}
