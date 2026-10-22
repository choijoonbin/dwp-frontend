import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import type { SupportedLocale } from '@dwp-frontend/shared-i18n';
import type { Hrm012QueryState } from './data-quality-contract';

export type Hrm012Copy = Readonly<{
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
  decisionSummary: (summary: Hrm012QueryState['fieldDecisionSummary']) => string;
  itemCount: (count: number) => string;
  listLabel: string;
  inspectorClose: string;
  previousItem: string;
  nextItem: string;
  previousPage: string;
  nextPage: string;
  omitted: string;
  masked: string;
  revision: string;
  occurredAt: string;
  evidenceDigest: string;
  receiptId: string;
  state: string;
  code: string;
  fieldLabels: Readonly<Record<'INGESTION_STATUS' | 'QUALITY_FINDING' | 'COMMAND_RECEIPT', string>>;
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

const COPY: Readonly<Record<SupportedLocale, Hrm012Copy>> = Object.freeze({
  ko: Object.freeze({
    eyebrow: 'HR 운영 · 통제된 데이터 품질',
    title: '인력 데이터 품질',
    description:
      '제한된 원본 값을 노출하지 않고 인력 수집 실행, 품질 판정 및 명령 영수증 증거를 점검합니다.',
    scopeLabel: '대상 인력 범위',
    live: '최신 검증됨',
    syncing: '최신 상태 확인 중',
    stale: '이전 검증 결과',
    degraded: '일부 증거 제한',
    refresh: '데이터 품질 새로 고침',
    contextLabel: '인력 데이터 품질 조회 컨텍스트',
    asOf: '기준 시각',
    visibleItems: '표시 항목',
    decisions: '필드 공개 결정',
    decisionSummary: (summary: Hrm012QueryState['fieldDecisionSummary']) =>
      `공개 ${summary.viewCount} · 마스킹 ${summary.maskedCount} · 미제공 ${summary.omittedCount}`,
    itemCount: (count: number) => `${count}건`,
    listLabel: '인력 수집 실행 및 품질 판정 목록',
    inspectorClose: '상세 닫기',
    previousItem: '이전 항목',
    nextItem: '다음 항목',
    previousPage: '이전 페이지',
    nextPage: '다음 페이지',
    omitted: '현재 권한 범위에 제공되지 않음',
    masked: '필드 정책에 따라 제한됨',
    revision: '리비전',
    occurredAt: '발생 시각',
    evidenceDigest: '증거 다이제스트',
    receiptId: '영수증 ID',
    state: '상태',
    code: '코드',
    fieldLabels: Object.freeze({
      INGESTION_STATUS: '수집 상태',
      QUALITY_FINDING: '품질 판정',
      COMMAND_RECEIPT: '명령 영수증',
    }),
    emptyTitle: '표시할 데이터 품질 항목이 없습니다',
    emptyDescription: '현재 허용 범위와 필터에 해당하는 실행 또는 품질 판정이 없습니다.',
    partialTitle: '일부 품질 증거를 확인할 수 없습니다',
    partialDescription: '검증된 항목만 표시합니다. 누락된 구성요소를 추정하지 않습니다.',
    staleTitle: '표시된 데이터가 최신 상태가 아닙니다',
    staleDescription: '새 검증 결과를 가져오지 못해 마지막으로 검증된 읽기 전용 결과를 표시합니다.',
    loadingTitle: '인력 데이터 품질을 불러오는 중',
    loadingDescription: '현재 권한과 대상 인력 범위에 맞는 증거를 확인하고 있습니다.',
    disabledTitle: '인력 데이터 품질 기능이 활성화되지 않았습니다',
    disabledDescription:
      '기능이 꺼져 있거나 이 테넌트가 등록되지 않았습니다. 소유자 요청은 전송되지 않았습니다.',
    deniedTitle: '이 데이터 품질 화면을 열 수 없습니다',
    deniedDescription:
      '현재 접근 컨텍스트에서는 항목의 존재 여부를 포함한 정보를 공개할 수 없습니다.',
    unavailableTitle: '인력 데이터 품질을 확인할 수 없습니다',
    unavailableDescription: '안전하게 공개할 수 있는 소유자 데이터를 가져오지 못했습니다.',
    adapterUnavailableDescription:
      '봉인된 IAQ-012 조회 어댑터가 연결되지 않았습니다. 소유자 요청은 전송되지 않았습니다.',
  }),
  en: Object.freeze({
    eyebrow: 'HR operations · governed data quality',
    title: 'Workforce data quality',
    description:
      'Inspect workforce-ingestion runs, quality findings, and command-receipt evidence without exposing restricted source values.',
    scopeLabel: 'Target population',
    live: 'Verified current',
    syncing: 'Checking current state',
    stale: 'Last verified result',
    degraded: 'Some evidence limited',
    refresh: 'Refresh workforce data quality',
    contextLabel: 'Workforce data-quality query context',
    asOf: 'As of',
    visibleItems: 'Visible items',
    decisions: 'Field decisions',
    decisionSummary: (summary: Hrm012QueryState['fieldDecisionSummary']) =>
      `View ${summary.viewCount} · masked ${summary.maskedCount} · omitted ${summary.omittedCount}`,
    itemCount: (count: number) => `${count} items`,
    listLabel: 'Workforce-ingestion runs and quality findings',
    inspectorClose: 'Close details',
    previousItem: 'Previous item',
    nextItem: 'Next item',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    omitted: 'Not disclosed in the current authorized scope',
    masked: 'Restricted by field policy',
    revision: 'Revision',
    occurredAt: 'Occurred at',
    evidenceDigest: 'Evidence digest',
    receiptId: 'Receipt ID',
    state: 'State',
    code: 'Code',
    fieldLabels: Object.freeze({
      INGESTION_STATUS: 'Ingestion status',
      QUALITY_FINDING: 'Quality finding',
      COMMAND_RECEIPT: 'Command receipt',
    }),
    emptyTitle: 'No workforce data-quality items',
    emptyDescription: 'No run or quality finding is available for the current scope and filters.',
    partialTitle: 'Some quality evidence is unavailable',
    partialDescription: 'Only verified items are shown. Missing components are never inferred.',
    staleTitle: 'The disclosed data is not current',
    staleDescription: 'A refresh failed, so the last verified read-only result remains visible.',
    loadingTitle: 'Loading workforce data quality',
    loadingDescription: 'Checking evidence for the current authority and target population.',
    disabledTitle: 'Workforce data quality is not enabled',
    disabledDescription:
      'The feature is off or this tenant is not enrolled. No owner request was sent.',
    deniedTitle: 'This data-quality surface is unavailable',
    deniedDescription: 'The current access context cannot disclose whether matching items exist.',
    unavailableTitle: 'Workforce data quality is unavailable',
    unavailableDescription: 'Safe owner data could not be loaded or disclosed.',
    adapterUnavailableDescription:
      'The sealed IAQ-012 adapter is not mounted. No owner request was sent.',
  }),
});

export function hrm012Copy(locale?: string | null): Hrm012Copy {
  return COPY[resolveSupportedLocale(locale)];
}
