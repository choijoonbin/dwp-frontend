import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

export type PerformanceReviewOperationsCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  connected: string;
  unavailable: string;
  refresh: string;
  listTitle: string;
  detailTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  partialTitle: string;
  partialDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  staleTitle: string;
  masked: string;
  assignment: string;
  queue: string;
  dueStatus: string;
  openCount: string;
  oldestAt: string;
  preview: string;
  previewEvidence: string;
  participantCount: string;
  reviewerCount: string;
  snapshotRevision: string;
  freeze: string;
  freezeTitle: string;
  freezeDescription: string;
  reason: string;
  reasonHelp: string;
  immutableConfirmation: string;
  cancel: string;
  next: string;
  previous: string;
  integrationTitle: string;
  integrationDescription: string;
  commandFailed: string;
  frozenTitle: string;
  frozenDescription: string;
  resultUnknownTitle: string;
  resultUnknownDescription: string;
  reconcile: string;
  frozenAt: string;
}>;

const EN: PerformanceReviewOperationsCopy = {
  eyebrow: 'Performance operations',
  title: 'Review population operations',
  description:
    'Preview the current eligible population, verify the evidence, and create an immutable freeze.',
  connected: 'Current',
  unavailable: 'Unavailable',
  refresh: 'Refresh',
  listTitle: 'Review queues',
  detailTitle: 'Operation detail',
  emptyTitle: 'No review operations',
  emptyDescription: 'No performance cycles match the current governed scope and filters.',
  partialTitle: 'Some operation data is unavailable',
  partialDescription: 'Available items remain usable. Refresh after the owner source recovers.',
  unavailableTitle: 'Review operations are unavailable',
  unavailableDescription: 'The governed owner projection could not be resolved.',
  staleTitle: 'Showing stale operation data',
  masked: 'Restricted by field policy',
  assignment: 'Review assignment',
  queue: 'Work queue',
  dueStatus: 'Due status',
  openCount: 'Open participants',
  oldestAt: 'Oldest evidence',
  preview: 'Generate preview',
  previewEvidence: 'Preview evidence',
  participantCount: 'Participants',
  reviewerCount: 'Reviewer assignments',
  snapshotRevision: 'Workforce snapshot revision',
  freeze: 'Freeze population',
  freezeTitle: 'Confirm immutable population freeze',
  freezeDescription:
    'This copies the exact preview evidence into an immutable receipt. The existing preview is not changed.',
  reason: 'Freeze reason',
  reasonHelp: 'Enter at least 10 characters for the audit record.',
  immutableConfirmation: 'I verified this exact preview and understand the freeze is immutable.',
  cancel: 'Cancel',
  next: 'Next page',
  previous: 'Previous page',
  integrationTitle: 'Command authority is not connected',
  integrationDescription:
    'The read-only workbench is available. Preview and freeze require the generated owner action bindings.',
  commandFailed: 'The operation could not be completed.',
  frozenTitle: 'Population frozen',
  frozenDescription: 'The immutable receipt and publication event were created successfully.',
  resultUnknownTitle: 'Result requires reconciliation',
  resultUnknownDescription:
    'Do not submit again. Reconcile the existing receipt to determine the final result.',
  reconcile: 'Reconcile receipt',
  frozenAt: 'Frozen at',
};

const KO: PerformanceReviewOperationsCopy = {
  eyebrow: '성과 운영',
  title: '평가 대상자 운영',
  description: '현재 대상자를 미리 보고 근거를 확인한 다음 변경 불가능한 동결본을 생성합니다.',
  connected: '최신',
  unavailable: '사용 불가',
  refresh: '새로고침',
  listTitle: '평가 작업 목록',
  detailTitle: '작업 상세',
  emptyTitle: '평가 작업이 없습니다',
  emptyDescription: '현재 권한 범위와 필터에 해당하는 성과 주기가 없습니다.',
  partialTitle: '일부 작업 정보를 불러오지 못했습니다',
  partialDescription: '표시된 항목은 사용할 수 있습니다. 소유자 원본이 복구되면 새로고침하세요.',
  unavailableTitle: '평가 작업을 사용할 수 없습니다',
  unavailableDescription: '권한이 적용된 소유자 조회 결과를 확인할 수 없습니다.',
  staleTitle: '이전 시점의 작업 정보를 표시하고 있습니다',
  masked: '필드 정책에 따라 제한됨',
  assignment: '평가 배정',
  queue: '작업 대기열',
  dueStatus: '진행 상태',
  openCount: '대상 인원',
  oldestAt: '가장 오래된 근거',
  preview: '대상자 미리보기 생성',
  previewEvidence: '미리보기 근거',
  participantCount: '대상자',
  reviewerCount: '평가자 배정',
  snapshotRevision: '인력 스냅샷 리비전',
  freeze: '대상자 동결',
  freezeTitle: '변경 불가능한 대상자 동결 확인',
  freezeDescription:
    '정확한 미리보기 근거를 변경 불가능한 영수증으로 복사합니다. 기존 미리보기는 변경하지 않습니다.',
  reason: '동결 사유',
  reasonHelp: '감사 기록을 위해 10자 이상 입력하세요.',
  immutableConfirmation: '이 미리보기를 정확히 확인했고 동결 후 변경할 수 없음을 이해했습니다.',
  cancel: '취소',
  next: '다음 페이지',
  previous: '이전 페이지',
  integrationTitle: '명령 권한 연결이 필요합니다',
  integrationDescription:
    '읽기 전용 작업 화면은 사용할 수 있습니다. 미리보기와 동결에는 생성된 소유자 액션 연결이 필요합니다.',
  commandFailed: '작업을 완료하지 못했습니다.',
  frozenTitle: '대상자를 동결했습니다',
  frozenDescription: '변경 불가능한 영수증과 발행 이벤트를 생성했습니다.',
  resultUnknownTitle: '결과 확인이 필요합니다',
  resultUnknownDescription:
    '다시 제출하지 마세요. 기존 영수증을 재조정하여 최종 결과를 확인하세요.',
  reconcile: '영수증 재조정',
  frozenAt: '동결 시각',
};

export function getPerformanceReviewOperationsCopy(
  language?: string
): PerformanceReviewOperationsCopy {
  return resolveSupportedLocale(language) === 'ko' ? KO : EN;
}
