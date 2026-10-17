export type PayrollPopulationCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  operationalQuestion: string;
  effectiveOn: string;
  minimumItems: string;
  maximumItems: string;
  optional: string;
  review: string;
  refresh: string;
  lastRefresh: string;
  loading: string;
  closedTitle: string;
  closedDescription: string;
  idleTitle: string;
  idleDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  permissionTitle: string;
  permissionDescription: string;
  partialTitle: string;
  partialDescription: string;
  staleTitle: string;
  staleDescription: string;
  completeTitle: string;
  completeDescription: string;
  blockedTitle: string;
  blockedDescription: string;
  populations: string;
  populationCount: string;
  preflight: string;
  completeness: string;
  freshness: string;
  safeToFreeze: string;
  aggregate: string;
  projectionVersion: string;
  revision: string;
  rows: string;
  asOf: string;
  digest: string;
  masked: string;
  omitted: string;
  partialFailures: string;
  runType: string;
  payrollEntity: string;
  payrollGroup: string;
  payPeriod: string;
  prepare: string;
  prepareHelp: string;
  stepUpTitle: string;
  stepUpDescription: string;
  acceptedTitle: string;
  acceptedDescription: string;
  preparedTitle: string;
  preparedDescription: string;
  resultUnknownTitle: string;
  resultUnknownDescription: string;
  retryExact: string;
  permissionCommandTitle: string;
  permissionCommandDescription: string;
  conflictTitle: string;
  conflictDescription: string;
  rejectedTitle: string;
  rejectedDescription: string;
  commandCenter: string;
  current: string;
  stale: string;
  incomplete: string;
  pass: string;
  fail: string;
}>;

const EN: PayrollPopulationCopy = Object.freeze({
  eyebrow: 'Payroll operations',
  title: 'Payroll population preflight',
  description:
    'Review one governed payroll population before asking the Payroll owner to freeze an immutable run snapshot.',
  operationalQuestion: 'Is this payroll population complete, current, and safe to freeze?',
  effectiveOn: 'Effective on',
  minimumItems: 'Minimum employees',
  maximumItems: 'Maximum employees',
  optional: 'Optional',
  review: 'Review population',
  refresh: 'Refresh this review',
  lastRefresh: 'Last successful refresh',
  loading: 'Checking the governed population projection',
  closedTitle: 'Payroll preparation is off',
  closedDescription:
    'This tenant is not enrolled in payroll run preparation. No population query or prepare command was started.',
  idleTitle: 'Review a payroll population',
  idleDescription:
    'Use the optional effective date or employee-count filters, then request the governed preflight projection.',
  emptyTitle: 'No payroll population',
  emptyDescription: 'No population matched these filters. Preparation remains unavailable.',
  unavailableTitle: 'Population evidence is unavailable',
  unavailableDescription:
    'The Payroll owner could not return a verifiable projection. Your review and run inputs are preserved.',
  permissionTitle: 'Population access is unavailable',
  permissionDescription:
    'The governed Payroll owner denied this scope. No cached population is displayed.',
  partialTitle: 'Population evidence is incomplete',
  partialDescription:
    'Some projection components failed. Available rows remain read-only until a complete review succeeds.',
  staleTitle: 'Population evidence is stale',
  staleDescription:
    'The authorization-bound projection is no longer current. Refresh before preparing.',
  completeTitle: 'Population preflight passed',
  completeDescription:
    'The selected population is complete and current, and advertises the exact governed prepare action.',
  blockedTitle: 'Population is not safe to freeze',
  blockedDescription:
    'The selected row, field decisions, or exact action authority does not satisfy every preparation check.',
  populations: 'Payroll populations',
  populationCount: '{{count}} populations',
  preflight: 'Preflight decisions',
  completeness: 'Population is complete',
  freshness: 'Projection is current',
  safeToFreeze: 'Safe to freeze',
  aggregate: 'Population aggregate',
  projectionVersion: 'Projection version',
  revision: 'Revision',
  rows: 'Employees',
  asOf: 'As of',
  digest: 'Snapshot digest',
  masked: 'Masked by field policy',
  omitted: 'Not disclosed',
  partialFailures: 'Unavailable components',
  runType: 'Run type',
  payrollEntity: 'Payroll entity ID',
  payrollGroup: 'Pay group ID',
  payPeriod: 'Pay period ID',
  prepare: 'Prepare payroll run',
  prepareHelp:
    'Preparation is a high-impact request. The existing payroll command center owns subsequent calculation and status.',
  stepUpTitle: 'Confirm this high-impact action',
  stepUpDescription:
    'Complete the shared step-up check. The request remains bound to this body, scope, and decision revision.',
  acceptedTitle: 'Preparation accepted',
  acceptedDescription:
    'The Payroll owner accepted the command. Follow its receipt in the existing payroll command center.',
  preparedTitle: 'Payroll run prepared',
  preparedDescription: 'The Payroll owner reports that the immutable run snapshot is ready.',
  resultUnknownTitle: 'Preparation result requires reconciliation',
  resultUnknownDescription:
    'Do not create a new command. Retry only the preserved body and idempotency key.',
  retryExact: 'Retry exact command',
  permissionCommandTitle: 'Preparation was not authorized',
  permissionCommandDescription:
    'Server-verified action or step-up authority did not allow this command.',
  conflictTitle: 'Preparation conflict',
  conflictDescription:
    'The immutable body, idempotency key, or authority revision no longer matches. Refresh before trying again.',
  rejectedTitle: 'Preparation failed',
  rejectedDescription: 'No prepared result was assumed. Review the current preflight evidence.',
  commandCenter: 'Open payroll command center',
  current: 'Current',
  stale: 'Stale',
  incomplete: 'Incomplete',
  pass: 'Pass',
  fail: 'Fail',
});

const KO: PayrollPopulationCopy = Object.freeze({
  eyebrow: '급여 운영',
  title: '급여 대상자 사전 점검',
  description:
    '급여 소유자에게 변경 불가능한 실행 스냅샷 동결을 요청하기 전에 권한이 적용된 대상자 하나를 검토합니다.',
  operationalQuestion: '선택한 급여 대상자가 완전하고 최신이며 안전하게 동결할 수 있습니까?',
  effectiveOn: '적용일',
  minimumItems: '최소 직원 수',
  maximumItems: '최대 직원 수',
  optional: '선택 사항',
  review: '대상자 검토',
  refresh: '이 검토 새로고침',
  lastRefresh: '마지막 새로고침',
  loading: '권한이 적용된 대상자 프로젝션을 확인하고 있습니다',
  closedTitle: '급여 실행 준비 기능이 꺼져 있습니다',
  closedDescription:
    '이 테넌트는 급여 실행 준비 기능에 등록되지 않았습니다. 대상자 조회나 준비 명령을 시작하지 않았습니다.',
  idleTitle: '급여 대상자를 검토하세요',
  idleDescription: '선택 사항인 적용일 또는 직원 수 필터를 사용해 사전 점검 프로젝션을 요청하세요.',
  emptyTitle: '급여 대상자가 없습니다',
  emptyDescription: '필터와 일치하는 대상자가 없습니다. 실행 준비는 비활성 상태입니다.',
  unavailableTitle: '대상자 근거를 사용할 수 없습니다',
  unavailableDescription:
    '급여 소유자가 검증 가능한 프로젝션을 반환하지 못했습니다. 검토 및 실행 입력은 유지됩니다.',
  permissionTitle: '대상자 접근 권한이 없습니다',
  permissionDescription: '급여 소유자가 이 범위를 거부했습니다. 캐시된 대상자는 표시하지 않습니다.',
  partialTitle: '대상자 근거가 완전하지 않습니다',
  partialDescription:
    '일부 프로젝션 구성 요소가 실패했습니다. 완전한 검토 전까지 행은 읽기 전용입니다.',
  staleTitle: '대상자 근거가 오래되었습니다',
  staleDescription: '권한 결정에 결합된 프로젝션이 최신이 아닙니다. 준비 전에 새로고침하세요.',
  completeTitle: '대상자 사전 점검을 통과했습니다',
  completeDescription: '선택한 대상자가 완전하고 최신이며 정확한 준비 작업을 제공합니다.',
  blockedTitle: '대상자를 안전하게 동결할 수 없습니다',
  blockedDescription:
    '선택한 행, 필드 결정 또는 정확한 작업 권한이 모든 준비 점검을 충족하지 않습니다.',
  populations: '급여 대상자',
  populationCount: '대상자 {{count}}개',
  preflight: '사전 점검 결정',
  completeness: '대상자가 완전함',
  freshness: '프로젝션이 최신임',
  safeToFreeze: '안전하게 동결 가능',
  aggregate: '대상자 집계',
  projectionVersion: '프로젝션 버전',
  revision: '리비전',
  rows: '직원',
  asOf: '기준 시각',
  digest: '스냅샷 다이제스트',
  masked: '필드 정책에 따라 마스킹됨',
  omitted: '공개되지 않음',
  partialFailures: '사용할 수 없는 구성 요소',
  runType: '실행 유형',
  payrollEntity: '급여 법인 ID',
  payrollGroup: '급여 그룹 ID',
  payPeriod: '급여 기간 ID',
  prepare: '급여 실행 준비',
  prepareHelp: '준비는 중요한 작업입니다. 이후 계산 및 상태는 기존 급여 명령 센터에서 관리합니다.',
  stepUpTitle: '중요 작업을 확인하세요',
  stepUpDescription:
    '공유 단계별 인증을 완료하세요. 요청은 이 본문, 범위, 결정 리비전에 결합됩니다.',
  acceptedTitle: '준비 요청이 접수되었습니다',
  acceptedDescription:
    '급여 소유자가 명령을 접수했습니다. 기존 급여 명령 센터에서 영수증을 확인하세요.',
  preparedTitle: '급여 실행을 준비했습니다',
  preparedDescription: '급여 소유자가 변경 불가능한 실행 스냅샷이 준비되었다고 보고했습니다.',
  resultUnknownTitle: '준비 결과를 재확인해야 합니다',
  resultUnknownDescription: '새 명령을 만들지 마세요. 보존된 본문과 멱등성 키만 다시 사용하세요.',
  retryExact: '동일 명령 다시 시도',
  permissionCommandTitle: '준비 권한이 없습니다',
  permissionCommandDescription:
    '서버가 검증한 작업 또는 단계별 인증 권한이 이 명령을 허용하지 않았습니다.',
  conflictTitle: '준비 충돌',
  conflictDescription:
    '변경 불가능한 본문, 멱등성 키 또는 권한 리비전이 일치하지 않습니다. 새로고침하세요.',
  rejectedTitle: '준비에 실패했습니다',
  rejectedDescription: '준비 완료를 가정하지 않았습니다. 현재 사전 점검 근거를 검토하세요.',
  commandCenter: '급여 명령 센터 열기',
  current: '최신',
  stale: '오래됨',
  incomplete: '불완전',
  pass: '통과',
  fail: '실패',
});

export function payrollPopulationCopy(language?: string): PayrollPopulationCopy {
  return language?.toLowerCase().startsWith('ko') ? KO : EN;
}
