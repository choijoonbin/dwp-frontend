import {
  HRIS_OPERATOR_PERSONAS as operator,
  plannedHrisCatalogNode as planned,
} from '../hris-product-map-contract';

import type { HrisCatalogNode } from '../hris-product-map-contract';

export const HRIS_PERFORMANCE_CATALOG: readonly HrisCatalogNode[] = Object.freeze([
  planned(
    'performance-command-center',
    'PERFORMANCE',
    'OPERATIONS',
    'PER',
    operator,
    '성과 Command Center',
    'Performance command center',
    '주기 단계, 참여율, 미완료, 보정과 공개 준비',
    'Cycle stage, participation, incomplete work, calibration, and release readiness',
    ['/hr/operations/talent']
  ),
  planned(
    'performance-goal-cycles',
    'PERFORMANCE',
    'OPERATIONS',
    'PER',
    operator,
    '목표 주기',
    'Goal cycles',
    '목표 템플릿, 조직 전개, 수립·승인과 변경',
    'Goal templates, cascade, creation, approval, and changes'
  ),
  planned(
    'performance-review-operations',
    'PERFORMANCE',
    'OPERATIONS',
    'PER',
    operator,
    '평가 운영',
    'Review operations',
    '평가군, 대상, 평가자, 일정, 단계와 예외',
    'Review groups, population, reviewers, schedule, stages, and exceptions'
  ),
  planned(
    'performance-forms-scales',
    'PERFORMANCE',
    'OPERATIONS',
    'PER',
    operator,
    '평가표·척도',
    'Forms & scales',
    '영역, 문항, 가중치, 척도, 버전과 시뮬레이션',
    'Sections, items, weights, scales, versions, and simulation'
  ),
  planned(
    'performance-multirater-surveys',
    'PERFORMANCE',
    'OPERATIONS',
    'PER',
    operator,
    '다면·설문',
    'Multi-rater & surveys',
    '후보·확정, 익명 정책, 문항, 응답과 최소기준',
    'Nomination, confirmation, anonymity, questions, responses, and minimums'
  ),
  planned(
    'performance-conversations-feedback',
    'PERFORMANCE',
    'OPERATIONS',
    'PER',
    operator,
    '면담·피드백',
    'Conversations & feedback',
    '일정, 양식, 기록과 공개·비공개 구분',
    'Schedule, templates, records, and public or private boundaries'
  ),
  planned(
    'performance-calibration',
    'PERFORMANCE',
    'OPERATIONS',
    'PER',
    operator,
    '보정',
    'Calibration',
    '분포, 조직 비교, 제안, 근거, 승인과 변경 감사',
    'Distribution, organization comparison, proposals, evidence, approval, and audit'
  ),
  planned(
    'performance-results',
    'PERFORMANCE',
    'OPERATIONS',
    'PER',
    operator,
    '결과',
    'Results',
    '확정, 공개, 이의제기, 반출과 이력',
    'Finalization, release, appeals, export, and history'
  ),
]);
