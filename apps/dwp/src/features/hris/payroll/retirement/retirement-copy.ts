import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import type { SupportedLocale } from '@dwp-frontend/shared-i18n';
import type { Pay004QueryState, Pay004Sort } from './retirement-contract';

export type Pay004Copy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  scopeLabel: string;
  live: string;
  syncing: string;
  stale: string;
  degraded: string;
  refresh: string;
  contextLabel: string;
  asOf: string;
  visibleItems: string;
  decisions: string;
  decisionSummary: (summary: Pay004QueryState['fieldDecisionSummary']) => string;
  itemCount: (count: number) => string;
  listLabel: string;
  queryToolbarTitle: string;
  queryToolbarDescription: string;
  minimumAmountFilter: string;
  policyKeyFilter: string;
  policyKeyPlaceholder: string;
  caseStatusFilter: string;
  caseStatusPlaceholder: string;
  effectiveOnFilter: string;
  sortLabel: string;
  applyFilters: string;
  resetFilters: string;
  criteriaValidation: string;
  sessionSaved: string;
  activeFilterCount: (count: number) => string;
  sortLabels: Readonly<Record<Pay004Sort, string>>;
  inspectorClose: string;
  previousItem: string;
  nextItem: string;
  previousPage: string;
  nextPage: string;
  masked: string;
  revision: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: string;
  amount: string;
  currency: string;
  policyKey: string;
  fieldLabels: Readonly<Record<'RETIREMENT_RESULT' | 'POLICY_VERSION' | 'CASE_STATUS', string>>;
  emptyTitle: string;
  emptyDescription: string;
  partialTitle: string;
  partialDescription: string;
  staleTitle: string;
  staleDescription: string;
  loadingTitle: string;
  loadingDescription: string;
  disabledTitle: string;
  disabledDescription: string;
  deniedTitle: string;
  deniedDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  adapterUnavailableDescription: string;
}>;

const COPY: Readonly<Record<SupportedLocale, Pay004Copy>> = Object.freeze({
  ko: Object.freeze({
    eyebrow: '급여 · 통제된 퇴직 결과',
    title: '퇴직 급여 워크벤치',
    description:
      '권한이 허용된 퇴직 케이스의 불변 결과, 처리 상태 및 적용 정책 리비전을 한곳에서 점검합니다.',
    scopeLabel: '급여 대상 인력 범위',
    live: '최신 검증됨',
    syncing: '최신 상태 확인 중',
    stale: '이전 검증 결과',
    degraded: '일부 증거 제한',
    refresh: '퇴직 급여 새로 고침',
    contextLabel: '퇴직 급여 조회 컨텍스트',
    asOf: '기준 시각',
    visibleItems: '표시 케이스',
    decisions: '필드 공개 결정',
    decisionSummary: (summary: Pay004QueryState['fieldDecisionSummary']) =>
      `공개 ${summary.viewCount} · 마스킹 ${summary.maskedCount} · 미제공 ${summary.omittedCount}`,
    itemCount: (count: number) => `${count}건`,
    listLabel: '퇴직 케이스 목록',
    queryToolbarTitle: '조회 조건',
    queryToolbarDescription:
      '퇴직 결과, 정책 버전, 케이스 상태와 적용일 필터를 설정합니다. 적용한 조건은 현재 브라우저 탭에만 안전하게 유지됩니다.',
    minimumAmountFilter: '최소 퇴직 결과 금액',
    policyKeyFilter: '정책 버전 키',
    policyKeyPlaceholder: '여러 값은 쉼표로 구분',
    caseStatusFilter: '케이스 상태',
    caseStatusPlaceholder: '예: CALCULATED, FINALIZED',
    effectiveOnFilter: '적용 기준일',
    sortLabel: '정렬 기준',
    applyFilters: '조회 조건 적용',
    resetFilters: '조건 초기화',
    criteriaValidation:
      '조회 조건 형식을 확인해 주세요. 잘못된 조건은 서버로 전송되지 않았습니다.',
    sessionSaved:
      '적용한 조건은 이 탭에서만 보존되며 권한 범위가 바뀌면 자동으로 분리됩니다.',
    activeFilterCount: (count: number) => `활성 필터 ${count}개`,
    sortLabels: Object.freeze({
      'retirementResult:ASC': '퇴직 결과 금액 오름차순',
      'policyVersion:ASC': '정책 버전 오름차순',
      'caseStatus:ASC': '케이스 상태 오름차순',
      'retirementResult:DESC': '퇴직 결과 금액 내림차순',
      'policyVersion:DESC': '정책 버전 내림차순',
      'caseStatus:DESC': '케이스 상태 내림차순',
      'itemPublicId:ASC': '케이스 ID 오름차순',
      'itemPublicId:DESC': '케이스 ID 내림차순',
    }),
    inspectorClose: '퇴직 케이스 상세 닫기',
    previousItem: '이전 케이스',
    nextItem: '다음 케이스',
    previousPage: '이전 페이지',
    nextPage: '다음 페이지',
    masked: '필드 정책에 따라 제한됨',
    revision: '리비전',
    effectiveFrom: '적용 시작일',
    effectiveTo: '적용 종료일',
    status: '상태',
    amount: '금액',
    currency: '통화',
    policyKey: '정책 키',
    fieldLabels: Object.freeze({
      RETIREMENT_RESULT: '퇴직 급여 결과',
      POLICY_VERSION: '적용 정책 버전',
      CASE_STATUS: '케이스 상태',
    }),
    emptyTitle: '표시할 퇴직 케이스가 없습니다',
    emptyDescription: '현재 허용 범위와 필터에 해당하는 퇴직 케이스가 없습니다.',
    partialTitle: '일부 퇴직 급여 증거를 확인할 수 없습니다',
    partialDescription: '검증된 정보만 표시하며 누락된 결과나 정책 정보는 추정하지 않습니다.',
    staleTitle: '표시된 퇴직 급여 데이터가 최신 상태가 아닙니다',
    staleDescription: '새 결과를 가져오지 못해 마지막으로 검증된 읽기 전용 결과를 표시합니다.',
    loadingTitle: '퇴직 급여 케이스를 불러오는 중',
    loadingDescription: '현재 권한과 대상 인력 범위에 맞는 결과를 확인하고 있습니다.',
    disabledTitle: '퇴직 급여 워크벤치가 활성화되지 않았습니다',
    disabledDescription:
      '기능이 꺼져 있거나 이 테넌트가 등록되지 않았습니다. 소유자 요청은 전송되지 않았습니다.',
    deniedTitle: '이 퇴직 급여 화면을 열 수 없습니다',
    deniedDescription: '현재 접근 컨텍스트에서는 일치하는 케이스의 존재 여부도 공개할 수 없습니다.',
    unavailableTitle: '퇴직 급여 데이터를 확인할 수 없습니다',
    unavailableDescription: '안전하게 공개할 수 있는 Payroll 소유자 데이터를 가져오지 못했습니다.',
    adapterUnavailableDescription:
      '봉인된 IAQ-049 조회 어댑터가 연결되지 않았습니다. 소유자 요청은 전송되지 않았습니다.',
  }),
  en: Object.freeze({
    eyebrow: 'Payroll · governed retirement results',
    title: 'Retirement payroll workbench',
    description:
      'Inspect immutable retirement results, case status, and the effective policy revision for the authorized payroll population.',
    scopeLabel: 'Payroll target population',
    live: 'Verified current',
    syncing: 'Checking current state',
    stale: 'Last verified result',
    degraded: 'Some evidence limited',
    refresh: 'Refresh retirement payroll',
    contextLabel: 'Retirement payroll query context',
    asOf: 'As of',
    visibleItems: 'Visible cases',
    decisions: 'Field decisions',
    decisionSummary: (summary: Pay004QueryState['fieldDecisionSummary']) =>
      `View ${summary.viewCount} · masked ${summary.maskedCount} · omitted ${summary.omittedCount}`,
    itemCount: (count: number) => `${count} cases`,
    listLabel: 'Retirement cases',
    queryToolbarTitle: 'Query criteria',
    queryToolbarDescription:
      'Filter retirement results, policy versions, case status, and effective date. Applied criteria stay only in this browser tab.',
    minimumAmountFilter: 'Minimum retirement result',
    policyKeyFilter: 'Policy version key',
    policyKeyPlaceholder: 'Separate multiple values with commas',
    caseStatusFilter: 'Case status',
    caseStatusPlaceholder: 'For example: CALCULATED, FINALIZED',
    effectiveOnFilter: 'Effective on',
    sortLabel: 'Sort by',
    applyFilters: 'Apply criteria',
    resetFilters: 'Reset criteria',
    criteriaValidation: 'Check the criteria format. Invalid criteria were not sent to the owner.',
    sessionSaved:
      'Applied criteria are retained only in this tab and isolated when the authority scope changes.',
    activeFilterCount: (count: number) => `${count} active filters`,
    sortLabels: Object.freeze({
      'retirementResult:ASC': 'Retirement result, ascending',
      'policyVersion:ASC': 'Policy version, ascending',
      'caseStatus:ASC': 'Case status, ascending',
      'retirementResult:DESC': 'Retirement result, descending',
      'policyVersion:DESC': 'Policy version, descending',
      'caseStatus:DESC': 'Case status, descending',
      'itemPublicId:ASC': 'Case ID, ascending',
      'itemPublicId:DESC': 'Case ID, descending',
    }),
    inspectorClose: 'Close retirement case details',
    previousItem: 'Previous case',
    nextItem: 'Next case',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    masked: 'Restricted by field policy',
    revision: 'Revision',
    effectiveFrom: 'Effective from',
    effectiveTo: 'Effective to',
    status: 'Status',
    amount: 'Amount',
    currency: 'Currency',
    policyKey: 'Policy key',
    fieldLabels: Object.freeze({
      RETIREMENT_RESULT: 'Retirement result',
      POLICY_VERSION: 'Policy version',
      CASE_STATUS: 'Case status',
    }),
    emptyTitle: 'No retirement cases to display',
    emptyDescription: 'No retirement case matches the current authorized scope and filters.',
    partialTitle: 'Some retirement evidence is unavailable',
    partialDescription:
      'Only verified data is shown. Missing result or policy evidence is never inferred.',
    staleTitle: 'The retirement payroll data is not current',
    staleDescription: 'A refresh failed, so the last verified read-only result remains visible.',
    loadingTitle: 'Loading retirement payroll cases',
    loadingDescription: 'Checking results for the current authority and payroll population.',
    disabledTitle: 'Retirement payroll is not enabled',
    disabledDescription:
      'The feature is off or this tenant is not enrolled. No owner request was sent.',
    deniedTitle: 'This retirement payroll surface is unavailable',
    deniedDescription: 'The current access context cannot disclose whether matching cases exist.',
    unavailableTitle: 'Retirement payroll is unavailable',
    unavailableDescription: 'Safe Payroll owner data could not be loaded or disclosed.',
    adapterUnavailableDescription:
      'The sealed IAQ-049 adapter is not mounted. No owner request was sent.',
  }),
});

export function pay004Copy(locale?: string | null): Pay004Copy {
  return COPY[resolveSupportedLocale(locale)];
}
