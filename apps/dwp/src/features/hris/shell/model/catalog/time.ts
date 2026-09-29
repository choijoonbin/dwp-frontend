import {
  HRIS_OPERATOR_PERSONAS as operator,
  plannedHrisCatalogNode as planned,
} from '../hris-product-map-contract';

import type { HrisCatalogNode } from '../hris-product-map-contract';

export const HRIS_TIME_CATALOG: readonly HrisCatalogNode[] = Object.freeze([
  planned(
    'time-command-center',
    'TIME',
    'OPERATIONS',
    'TIM',
    operator,
    '근태 Command Center',
    'Time command center',
    '기간 상태, 승인·마감 진행, 차단요인과 SLA',
    'Period state, approval and close progress, blockers, and SLA',
    ['/hr/operations/time']
  ),
  planned(
    'time-work-plans',
    'TIME',
    'OPERATIONS',
    'TIM',
    operator,
    '근무계획',
    'Work plans',
    '근무제·교대, 일정 배정, 캘린더와 시뮬레이션',
    'Work patterns, shifts, schedule assignment, calendar, and simulation'
  ),
  planned(
    'time-clock-ingestion',
    'TIME',
    'OPERATIONS',
    'TIM',
    operator,
    '타각 수집',
    'Clock ingestion',
    '원천별 수집, 중복·순서 오류, 격리와 재처리',
    'Source ingestion, duplicate and ordering errors, quarantine, and replay'
  ),
  planned(
    'time-interpretation',
    'TIME',
    'OPERATIONS',
    'TIM',
    operator,
    '근태 해석',
    'Time interpretation',
    '규칙 버전, 지각·조퇴·결근·연장·휴일과 추적',
    'Rule versions, attendance outcomes, overtime, holidays, and trace'
  ),
  planned(
    'time-exceptions',
    'TIME',
    'OPERATIONS',
    'TIM',
    operator,
    '예외 처리',
    'Exception handling',
    '누락, 겹침, 한도초과, 소명과 일괄 정정 제안',
    'Missing and overlapping time, limit breaches, explanations, and bulk corrections'
  ),
  planned(
    'time-daily-close',
    'TIME',
    'OPERATIONS',
    'TIM',
    operator,
    '일 마감',
    'Daily close',
    '조직별 진행, 차단요인, 승인과 재개방',
    'Organization progress, blockers, approval, and reopen'
  ),
  planned(
    'time-monthly-close',
    'TIME',
    'OPERATIONS',
    'TIM',
    operator,
    '월 마감',
    'Monthly close',
    '집계, 급여 인계, 동결, 재개방과 재산정 영향',
    'Aggregation, payroll handoff, freeze, reopen, and recalculation impact'
  ),
  planned(
    'time-leave-operations',
    'TIME',
    'OPERATIONS',
    'TIM',
    operator,
    '휴가 운영',
    'Leave operations',
    '신청 대기열, 대량 등록, 원장, 증빙과 장기휴가',
    'Request queue, bulk registration, ledger, evidence, and long leave',
    ['/hr/operations/absence']
  ),
  planned(
    'time-accrual-expiration',
    'TIME',
    'OPERATIONS',
    'TIM',
    operator,
    '발생·소멸 실행',
    'Accrual & expiration runs',
    '발생, 이월, 소멸, 시험실행과 대사',
    'Accrual, carryover, expiry, dry run, and reconciliation'
  ),
  planned(
    'time-reports',
    'TIME',
    'OPERATIONS',
    'TIM',
    operator,
    '근태·휴가 리포트',
    'Time & leave reports',
    '근로시간, 휴가, 예외, 법정 한도와 통제 반출',
    'Work hours, leave, exceptions, statutory limits, and governed export'
  ),
]);
