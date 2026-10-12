export type ClockIngestionCopy = Readonly<{
  title: string;
  description: string;
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
}>;

const en: ClockIngestionCopy = {
  title: 'Clock ingestion',
  description: 'Review ordered clock evidence, provenance, and corrective voids.',
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
};

const ko: ClockIngestionCopy = {
  title: '출퇴근 이벤트 수집',
  description: '순서가 보장된 출퇴근 증적, 출처, 정정 무효화 이력을 검토합니다.',
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
};

export function clockIngestionCopy(language: 'en' | 'ko'): ClockIngestionCopy {
  return language === 'ko' ? ko : en;
}
