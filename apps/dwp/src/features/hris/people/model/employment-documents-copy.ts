import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

export type EmploymentDocumentsCopy = Readonly<{
  persona: string;
  title: string;
  description: string;
  question: string;
  guidance: string;
  refresh: string;
  refreshing: string;
  asOf: string;
  documentCount: (count: number) => string;
  recordsTitle: string;
  recordsDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  partialTitle: string;
  partialDescription: string;
  relationshipType: string;
  status: string;
  effectivePeriod: string;
  current: string;
  relationshipReference: string;
  assignmentReference: string;
  workerReference: string;
  revision: string;
  documentLabel: (index: number, relationshipType: string) => string;
}>;

const en: EmploymentDocumentsCopy = {
  persona: 'Employee self-service',
  title: 'My employment documents',
  description:
    'Review the employment relationships and assignments that the People service discloses to you.',
  question: 'Which employment relationships and assignments are effective for me now?',
  guidance:
    'Use the owner-provided status and effective period as your current employment record. Refresh before relying on it for a new request.',
  refresh: 'Refresh employment documents',
  refreshing: 'Refreshing employment documents',
  asOf: 'Effective as of',
  documentCount: (count) => `${count} employment ${count === 1 ? 'document' : 'documents'}`,
  recordsTitle: 'Employment records',
  recordsDescription: 'Each record is read-only and comes from the People service.',
  emptyTitle: 'No employment documents are available',
  emptyDescription:
    'The People service returned no employment relationship or assignment for your current scope.',
  partialTitle: 'The latest refresh is unavailable',
  partialDescription:
    'The last successful employment documents remain visible. They may be stale; refresh again before relying on them.',
  relationshipType: 'Relationship type',
  status: 'Assignment status',
  effectivePeriod: 'Effective period',
  current: 'Current',
  relationshipReference: 'Relationship reference',
  assignmentReference: 'Assignment reference',
  workerReference: 'Worker reference',
  revision: 'Record revision',
  documentLabel: (index, relationshipType) => `Employment document ${index}: ${relationshipType}`,
};

const ko: EmploymentDocumentsCopy = {
  persona: '구성원 셀프서비스',
  title: '내 고용 문서',
  description: 'People 서비스가 나에게 공개한 고용 관계와 배치 기록을 확인합니다.',
  question: '현재 나에게 유효한 고용 관계와 배치는 무엇인가요?',
  guidance:
    'owner가 제공한 상태와 유효기간이 현재 고용 기록입니다. 새 요청에 사용하기 전에 최신 상태로 새로고침하세요.',
  refresh: '고용 문서 새로고침',
  refreshing: '고용 문서 새로고침 중',
  asOf: '기준 시각',
  documentCount: (count) => `고용 문서 ${count}건`,
  recordsTitle: '고용 기록',
  recordsDescription: '각 기록은 People 서비스가 제공한 읽기 전용 정보입니다.',
  emptyTitle: '제공 가능한 고용 문서가 없습니다',
  emptyDescription: '현재 권한 범위에서 조회되는 고용 관계 또는 배치가 없습니다.',
  partialTitle: '최신 정보를 새로고치지 못했습니다',
  partialDescription:
    '마지막으로 조회한 고용 문서를 계속 표시합니다. 오래된 정보일 수 있으므로 사용 전에 다시 새로고침하세요.',
  relationshipType: '고용 관계 유형',
  status: '배치 상태',
  effectivePeriod: '유효기간',
  current: '현재',
  relationshipReference: '고용 관계 참조',
  assignmentReference: '배치 참조',
  workerReference: '직원 참조',
  revision: '기록 리비전',
  documentLabel: (index, relationshipType) => `고용 문서 ${index}: ${relationshipType}`,
};

export function getEmploymentDocumentsCopy(
  resolvedLanguage?: string,
  language?: string
): EmploymentDocumentsCopy {
  return resolveSupportedLocale(resolvedLanguage, language) === 'ko' ? ko : en;
}
