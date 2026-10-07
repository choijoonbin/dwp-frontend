import {
  HRIS_OPERATOR_PERSONAS as operator,
  hrisCatalogNode as node,
  plannedHrisCatalogNode as planned,
} from '../hris-product-map-contract';

import type { HrisCatalogNode } from '../hris-product-map-contract';

export const HRIS_PAYROLL_CATALOG: readonly HrisCatalogNode[] = Object.freeze([
  planned(
    'pay-command-center',
    'PAYROLL',
    'OPERATIONS',
    'PAY',
    operator,
    '급여 Command Center',
    'Payroll command center',
    '기간 점검, 입력 잠금, 계산·검증·승인·지급 상태',
    'Period checklist, input lock, calculation, validation, approval, and payment state',
    ['/hr/operations/pay']
  ),
  planned(
    'pay-population',
    'PAYROLL',
    'OPERATIONS',
    'PAY',
    operator,
    '급여 대상',
    'Payroll population',
    '대상자, 입퇴사·휴직, 비정기 급여와 제외 근거',
    'Population, joins, exits, leave, off-cycle pay, and exclusion rationale'
  ),
  planned(
    'pay-inputs',
    'PAYROLL',
    'OPERATIONS',
    'PAY',
    operator,
    '급여 입력',
    'Payroll inputs',
    '고정·변동 항목, 근태 인계, 일괄 업로드와 검증',
    'Fixed and variable items, time handoff, bulk upload, and validation'
  ),
  planned(
    'pay-calculation',
    'PAYROLL',
    'OPERATIONS',
    'PAY',
    operator,
    '계산 실행',
    'Calculation runs',
    '미리보기, 계산 추적, 대상별 상태, 격리와 재실행',
    'Preview, calculation trace, worker state, isolation, and rerun'
  ),
  planned(
    'pay-validation-reconciliation',
    'PAYROLL',
    'OPERATIONS',
    'PAY',
    operator,
    '검증·대사',
    'Validation & reconciliation',
    '전월·예상 차이, 총액, 이상치와 승인 점검',
    'Prior-period and forecast variance, totals, anomalies, and approval checks'
  ),
  planned(
    'pay-retro-corrections',
    'PAYROLL',
    'OPERATIONS',
    'PAY',
    operator,
    '소급·정정',
    'Retro & corrections',
    '소급 사건, 영향기간, 재계산, 차액과 역분개',
    'Retro events, impact periods, recalculation, deltas, and reversal'
  ),
  planned(
    'pay-results',
    'PAYROLL',
    'OPERATIONS',
    'PAY',
    operator,
    '급여 결과',
    'Payroll results',
    '대상·항목·조직별 결과, 산식 추적과 확정 스냅샷',
    'Worker, item and organization results, formula trace, and final snapshot'
  ),
  planned(
    'pay-payments',
    'PAYROLL',
    'OPERATIONS',
    'PAY',
    operator,
    '지급',
    'Payments',
    '계좌 검증, 지급 지시, 은행파일과 지급 대사',
    'Account validation, payment instructions, bank files, and reconciliation'
  ),
  planned(
    'pay-accounting',
    'PAYROLL',
    'OPERATIONS',
    'PAY',
    operator,
    '회계',
    'Accounting',
    '계정·코스트센터 매핑, 전표 미리보기, 게시와 역분개',
    'Account and cost-center mapping, journal preview, posting, and reversal'
  ),
  planned(
    'pay-statements',
    'PAYROLL',
    'OPERATIONS',
    'PAY',
    operator,
    '명세서',
    'Statements',
    '생성, 게시, 알림, 재발급과 조회 감사',
    'Generation, publishing, notification, reissue, and access audit'
  ),
  planned(
    'pay-tax-social-insurance',
    'PAYROLL',
    'OPERATIONS',
    'PAY',
    operator,
    '세금·사회보험',
    'Tax & social insurance',
    '신고 기준, 산출, 파일, 결과·오류와 정산',
    'Filing basis, calculation, files, results, errors, and settlement'
  ),
  planned(
    'pay-retirement',
    'PAYROLL',
    'OPERATIONS',
    'PAY',
    operator,
    '퇴직급여',
    'Retirement pay',
    '추계, 대상, 계산, 지급·신고와 정정',
    'Estimate, population, calculation, payment, filing, and correction'
  ),
  node({
    id: 'pay-year-end-tax',
    inventoryGroup: 'PAYROLL',
    surface: 'OPERATIONS',
    module: 'PAY',
    personas: operator,
    lifecycle: 'BLOCKED_EVIDENCE',
    label: { ko: '연말정산', en: 'Year-end tax' },
    capability: {
      ko: '대상, 자료수집, 검증, 계산, 신고, 결과와 정정 사례',
      en: 'Population, evidence collection, validation, calculation, filing, results, and corrections',
    },
  }),
  planned(
    'pay-reports',
    'PAYROLL',
    'OPERATIONS',
    'PAY',
    operator,
    '급여 리포트',
    'Payroll reports',
    '법정·경영·운영 보고와 통제 반출',
    'Statutory, management and operational reports with governed export'
  ),
]);
