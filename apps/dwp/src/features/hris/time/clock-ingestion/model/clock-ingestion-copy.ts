export type ClockIngestionCopy = Readonly<{
  title: string;
  description: string;
  exceptionsTitle: string;
  exceptionsDescription: string;
  ingest: string;
  refresh: string;
  freshness: string;
  lastRefresh: string;
  accepted: string;
  openExceptions: string;
  corrected: string;
  filter: string;
  all: string;
  needsReview: string;
  event: string;
  source: string;
  occurred: string;
  evidence: string;
  review: string;
  selected: string;
  details: string;
  noSelection: string;
  voidAction: string;
  originalEvidence: string;
  provenance: string;
  ordering: string;
  civilTime: string;
  exceptions: string;
  exceptionCode: string;
  state: string;
  partialTitle: string;
  partialDescription: string;
  staleTitle: string;
  staleDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  loading: string;
  loadMore: string;
  loadingMore: string;
  commandSucceededTitle: string;
  commandSucceededDescription: string;
  commandRejectedTitle: string;
  commandRejectedDescription: string;
  resultUnknownTitle: string;
  resultUnknownDescription: string;
  retryExact: string;
  close: string;
  recordDialogTitle: string;
  recordDialogDescription: string;
  submitRecord: string;
  voidDialogTitle: string;
  voidDialogDescription: string;
  submitVoid: string;
  commandWorking: string;
  voidReasonCode: string;
  voidReasonHelp: string;
  sourcePublicId: string;
  sourceEventKey: string;
  sourceSequence: string;
  sourceType: string;
  devicePublicId: string;
  captureMode: string;
  offlineBatchPublicId: string;
  workerPublicId: string;
  assignmentPublicId: string;
  assignmentRevision: string;
  eventType: string;
  occurredAt: string;
  sourceLocalDateTime: string;
  sourceTimeZone: string;
  sourceUtcOffset: string;
  dstResolution: string;
  instantAuthority: string;
  tzdbVersion: string;
  timeZoneRuleVersion: string;
  sourceProvenanceDigest: string;
  trustLevel: string;
}>;

const en: ClockIngestionCopy = {
  title: 'Clock ingestion',
  description: 'Review ordered clock evidence, provenance, and corrective voids.',
  exceptionsTitle: 'Time exceptions',
  exceptionsDescription: 'Prioritize open clock exceptions and inspect their immutable evidence.',
  ingest: 'Ingest clock event',
  refresh: 'Refresh evidence',
  freshness: 'Evidence status',
  lastRefresh: 'Last successful refresh',
  accepted: 'Accepted facts',
  openExceptions: 'Open exceptions',
  corrected: 'Corrective voids',
  filter: 'Evidence filter',
  all: 'All evidence',
  needsReview: 'Needs review',
  event: 'Event',
  source: 'Quality and revision',
  occurred: 'Occurred',
  evidence: 'Evidence state',
  review: 'Review',
  selected: 'Selected',
  details: 'Evidence inspector',
  noSelection: 'Select an event to inspect its immutable evidence.',
  voidAction: 'Append corrective void',
  originalEvidence: 'Original evidence remains immutable.',
  provenance: 'Evidence digest',
  ordering: 'Projection revision',
  civilTime: 'Occurrence instant',
  exceptions: 'Derived time exceptions',
  exceptionCode: 'Exception',
  state: 'State',
  partialTitle: 'Some clock evidence is unavailable',
  partialDescription: 'Available owner facts remain visible. Retry the unavailable projection.',
  staleTitle: 'Clock evidence may be stale',
  staleDescription: 'Decisions should wait for a current owner refresh.',
  unavailableTitle: 'Clock evidence is unavailable',
  unavailableDescription: 'No owner facts were returned. No command was sent.',
  emptyTitle: 'No clock evidence in this scope',
  emptyDescription: 'Ingest an authorized event or change the governed scope.',
  loading: 'Loading clock evidence…',
  loadMore: 'Load more',
  loadingMore: 'Loading more…',
  commandSucceededTitle: 'Clock command completed',
  commandSucceededDescription: 'The sealed receipt was accepted and owner evidence is refreshing.',
  commandRejectedTitle: 'Clock command was rejected',
  commandRejectedDescription: 'No retry is pending. Review the inputs and current authority.',
  resultUnknownTitle: 'Command result is unknown',
  resultUnknownDescription:
    'Retry only the preserved command. Its payload and idempotency key will remain unchanged.',
  retryExact: 'Retry exact command',
  close: 'Close',
  recordDialogTitle: 'Ingest clock evidence',
  recordDialogDescription:
    'Record the immutable source, assignment, civil-time, and provenance facts.',
  submitRecord: 'Record evidence',
  voidDialogTitle: 'Append corrective void',
  voidDialogDescription: 'The original evidence remains immutable. A verified reason is appended.',
  submitVoid: 'Append void',
  commandWorking: 'Submitting…',
  voidReasonCode: 'Closed reason code',
  voidReasonHelp: 'Use an approved uppercase code such as DEVICE_DUPLICATE.',
  sourcePublicId: 'Source public ID',
  sourceEventKey: 'Source event key',
  sourceSequence: 'Source sequence',
  sourceType: 'Source type',
  devicePublicId: 'Device public ID',
  captureMode: 'Capture mode',
  offlineBatchPublicId: 'Offline batch public ID',
  workerPublicId: 'Worker public ID',
  assignmentPublicId: 'People assignment public ID',
  assignmentRevision: 'People assignment revision',
  eventType: 'Clock event type',
  occurredAt: 'Occurrence instant (ISO 8601)',
  sourceLocalDateTime: 'Source local date-time',
  sourceTimeZone: 'Source time zone',
  sourceUtcOffset: 'UTC offset in minutes',
  dstResolution: 'DST resolution',
  instantAuthority: 'Instant authority',
  tzdbVersion: 'TZDB version',
  timeZoneRuleVersion: 'Time-zone rule version',
  sourceProvenanceDigest: 'Source provenance SHA-256',
  trustLevel: 'Trust level',
};

const ko: ClockIngestionCopy = {
  title: '출퇴근 이벤트 수집',
  description: '순서가 보장된 출퇴근 증적, 출처, 정정 무효화 이력을 검토합니다.',
  exceptionsTitle: '근태 예외',
  exceptionsDescription: '미해결 출퇴근 예외를 우선 검토하고 변경 불가능한 원본 증적을 확인합니다.',
  ingest: '출퇴근 이벤트 수집',
  refresh: '증적 새로고침',
  freshness: '증적 상태',
  lastRefresh: '마지막 정상 조회',
  accepted: '수락된 사실',
  openExceptions: '미해결 예외',
  corrected: '정정 무효화',
  filter: '증적 필터',
  all: '전체 증적',
  needsReview: '검토 필요',
  event: '이벤트',
  source: '품질 및 revision',
  occurred: '발생 시각',
  evidence: '증적 상태',
  review: '검토',
  selected: '선택됨',
  details: '증적 검사기',
  noSelection: '이벤트를 선택하면 변경 불가능한 원본 증적을 확인할 수 있습니다.',
  voidAction: '정정 무효화 추가',
  originalEvidence: '원본 증적은 변경되지 않고 그대로 보존됩니다.',
  provenance: '증적 다이제스트',
  ordering: 'Projection revision',
  civilTime: '발생 시각',
  exceptions: '파생된 근태 예외',
  exceptionCode: '예외',
  state: '상태',
  partialTitle: '일부 출퇴근 증적을 불러오지 못했습니다',
  partialDescription: '조회된 소유자 사실은 유지됩니다. 실패한 projection만 다시 조회하세요.',
  staleTitle: '출퇴근 증적이 최신이 아닐 수 있습니다',
  staleDescription: '소유자 데이터가 갱신될 때까지 중요한 결정을 보류하세요.',
  unavailableTitle: '출퇴근 증적을 사용할 수 없습니다',
  unavailableDescription: '소유자 사실을 받지 못했으며 명령도 전송하지 않았습니다.',
  emptyTitle: '현재 범위에 출퇴근 증적이 없습니다',
  emptyDescription: '승인된 이벤트를 수집하거나 통제된 범위를 변경하세요.',
  loading: '출퇴근 증적을 불러오는 중…',
  loadMore: '더 보기',
  loadingMore: '추가 항목을 불러오는 중…',
  commandSucceededTitle: '출퇴근 명령 완료',
  commandSucceededDescription: '봉인된 영수증을 확인했으며 소유자 증적을 새로고침합니다.',
  commandRejectedTitle: '출퇴근 명령이 거부되었습니다',
  commandRejectedDescription: '대기 중인 재시도는 없습니다. 입력과 현재 권한을 확인하세요.',
  resultUnknownTitle: '명령 결과를 확인할 수 없습니다',
  resultUnknownDescription:
    '보존된 명령만 다시 시도합니다. payload와 idempotency key는 변경되지 않습니다.',
  retryExact: '동일 명령 다시 시도',
  close: '닫기',
  recordDialogTitle: '출퇴근 증적 수집',
  recordDialogDescription: '소스, 배정, 현지 시각, 출처 증적을 변경 불가능한 사실로 기록합니다.',
  submitRecord: '증적 기록',
  voidDialogTitle: '정정 무효화 추가',
  voidDialogDescription: '원본 증적은 그대로 보존되며 검증된 사유를 별도 이벤트로 추가합니다.',
  submitVoid: '무효화 추가',
  commandWorking: '전송 중…',
  voidReasonCode: '폐쇄형 사유 코드',
  voidReasonHelp: 'DEVICE_DUPLICATE처럼 승인된 영문 대문자 코드를 입력하세요.',
  sourcePublicId: '소스 공개 ID',
  sourceEventKey: '소스 이벤트 키',
  sourceSequence: '소스 순번',
  sourceType: '소스 유형',
  devicePublicId: '장치 공개 ID',
  captureMode: '수집 모드',
  offlineBatchPublicId: '오프라인 배치 공개 ID',
  workerPublicId: '근로자 공개 ID',
  assignmentPublicId: 'People 배정 공개 ID',
  assignmentRevision: 'People 배정 revision',
  eventType: '출퇴근 이벤트 유형',
  occurredAt: '발생 instant (ISO 8601)',
  sourceLocalDateTime: '소스 현지 일시',
  sourceTimeZone: '소스 시간대',
  sourceUtcOffset: 'UTC 오프셋(분)',
  dstResolution: 'DST 해석 방식',
  instantAuthority: 'Instant 권위',
  tzdbVersion: 'TZDB 버전',
  timeZoneRuleVersion: '시간대 규칙 버전',
  sourceProvenanceDigest: '소스 출처 SHA-256',
  trustLevel: '신뢰 수준',
};

export function clockIngestionCopy(language: 'en' | 'ko'): ClockIngestionCopy {
  return language === 'ko' ? ko : en;
}
