import {
  HRIS_SETTINGS_PERSONAS as settings,
  plannedHrisCatalogNode as planned,
} from '../hris-product-map-contract';

import type { HrisCatalogNode } from '../hris-product-map-contract';

export const HRIS_SETTINGS_CATALOG: readonly HrisCatalogNode[] = Object.freeze([
  planned(
    'settings-enterprise',
    'SETTINGS',
    'SETTINGS',
    'SYS',
    settings,
    'Enterprise',
    'Enterprise',
    '법인·고용주, 사업단위, 사업장, 조직유형과 번호체계',
    'Legal entities, employers, business units, sites, organization types, and numbering'
  ),
  planned(
    'settings-reference',
    'SETTINGS',
    'SETTINGS',
    'SYS',
    settings,
    '기준정보',
    'Reference data',
    '코드셋, 다국어, 사유, 통화·단위, 지역과 캘린더',
    'Code sets, localization, reasons, currency, units, regions, and calendars',
    ['/hr/data/reference']
  ),
  planned(
    'settings-people-employment',
    'SETTINGS',
    'SETTINGS',
    'HRM',
    settings,
    '사람·고용',
    'People & employment',
    '인물번호, 고용형태, 배치·발령·계약유형과 필드 구성',
    'Person numbering, worker types, assignment, appointment and contract types, and fields'
  ),
  planned(
    'settings-time',
    'SETTINGS',
    'SETTINGS',
    'TIM',
    settings,
    '근태',
    'Time',
    '근무제, 교대, 타각원천, 해석규칙, 연장·휴일과 마감정책',
    'Work patterns, shifts, clock sources, interpretation, overtime, holidays, and close policy'
  ),
  planned(
    'settings-leave',
    'SETTINGS',
    'SETTINGS',
    'TIM',
    settings,
    '휴가',
    'Leave',
    '유형, 자격, 발생·소멸·이월, 사용순서, 증빙과 한도',
    'Types, eligibility, accrual, expiry, carryover, consumption order, evidence, and limits'
  ),
  planned(
    'settings-payroll',
    'SETTINGS',
    'SETTINGS',
    'PAY',
    settings,
    '급여',
    'Payroll',
    '급여그룹, 기간, 항목·분류, 산식, 잔액, 반올림과 소급',
    'Payroll groups, periods, items, classifications, formulas, balances, rounding, and retro'
  ),
  planned(
    'settings-statutory',
    'SETTINGS',
    'SETTINGS',
    'PAY',
    settings,
    '법정',
    'Statutory',
    '관할, 세율, 보험, 퇴직과 연말정산 팩',
    'Jurisdictions, rates, insurance, retirement, and year-end tax packs'
  ),
  planned(
    'settings-performance',
    'SETTINGS',
    'SETTINGS',
    'PER',
    settings,
    '성과',
    'Performance',
    '주기, 템플릿, 평가군·평가자, 척도, 보정과 공개',
    'Cycles, templates, groups, reviewers, scales, calibration, and release'
  ),
  planned(
    'settings-workflow',
    'SETTINGS',
    'SETTINGS',
    'SYS',
    settings,
    '워크플로',
    'Workflow',
    '승인정책, 위임, SLA, 알림과 예외 상향',
    'Approval policy, delegation, SLA, notifications, and escalation'
  ),
  planned(
    'settings-documents-communications',
    'SETTINGS',
    'SETTINGS',
    'HRM',
    settings,
    '문서·커뮤니케이션',
    'Documents & communications',
    '문서·인쇄·메일·알림 템플릿, 직인과 전자서명',
    'Document, print, mail and notification templates, seals, and e-signature'
  ),
  planned(
    'settings-integrations',
    'SETTINGS',
    'SETTINGS',
    'SYS',
    settings,
    '연계',
    'Integrations',
    '커넥터, 매핑, 일정, 대사와 재시도',
    'Connectors, mapping, schedules, reconciliation, and retry',
    ['/hr/data/integrations']
  ),
  planned(
    'settings-extensions',
    'SETTINGS',
    'SETTINGS',
    'SYS',
    settings,
    '확장',
    'Extensions',
    '사용자 정의 필드·규칙, 웹훅과 확장팩',
    'Custom fields and rules, webhooks, and extension packs'
  ),
  planned(
    'settings-operations',
    'SETTINGS',
    'SETTINGS',
    'SYS',
    settings,
    '운영',
    'Operations',
    '작업 실행, 예외, 설정 이력, 상태와 사용량',
    'Job runs, exceptions, configuration history, health, and usage'
  ),
]);
