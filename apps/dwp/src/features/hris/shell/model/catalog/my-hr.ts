import {
  HRIS_EMPLOYEE_PERSONAS as employee,
  hrisCatalogNode as node,
  plannedHrisCatalogNode as planned,
} from '../hris-product-map-contract';

import type { HrisCatalogNode } from '../hris-product-map-contract';

export const HRIS_MY_HR_CATALOG: readonly HrisCatalogNode[] = Object.freeze([
  node({
    id: 'my-hr-home',
    inventoryGroup: 'MY_HR',
    surface: 'HOME',
    module: 'SYS',
    personas: ['EMPLOYEE', 'MANAGER', 'OPERATOR', 'SETTINGS_ADMIN', 'AUDITOR'],
    lifecycle: 'PILOT',
    label: { ko: 'HRIS 홈', en: 'HRIS home' },
    capability: {
      ko: '할 일, 승인 대기, 근태·휴가·급여 알림과 일정',
      en: 'Tasks, pending decisions, time, leave, pay alerts, and schedule',
    },
    coverageNote: {
      ko: '1차에서는 기존 개인 홈과 76개 목표 메뉴 지도를 함께 제공합니다.',
      en: 'Phase 1 combines the existing personal home with the 76-menu target map.',
    },
    legacyPaths: ['/hr/home'],
    href: '/hr/home',
  }),
  planned(
    'my-hr-profile',
    'MY_HR',
    'MY_HR',
    'HRM',
    employee,
    '내 프로필',
    'My profile',
    '기본정보, 연락처, 가족, 경력·자격, 계좌와 개인정보 동의',
    'Identity, contacts, family, experience, qualifications, accounts, and privacy consent',
    ['/hr/me']
  ),
  planned(
    'my-employment-documents',
    'MY_HR',
    'MY_HR',
    'HRM',
    employee,
    '고용 및 문서',
    'Employment & documents',
    '고용관계, 배치, 계약서, 발령이력, 서약과 전자문서',
    'Work relationships, assignments, contracts, appointments, pledges, and documents',
    ['/hr/me']
  ),
  node({
    id: 'my-time',
    inventoryGroup: 'MY_HR',
    surface: 'MY_HR',
    module: 'TIM',
    personas: employee,
    lifecycle: 'PILOT',
    label: { ko: '내 근태', en: 'My time' },
    capability: {
      ko: '출퇴근, 근무표, 시간입력, 예외소명과 월 현황',
      en: 'Clock events, schedules, time entry, exception explanations, and monthly status',
    },
    coverageNote: {
      ko: '1차 앵커는 근태표 조회·기존 기록 정정·제출과 충돌 복구를 제공합니다. 타각 수집과 마감은 포함하지 않습니다.',
      en: 'The Phase 1 anchor covers time-card review, correction of existing entries, submission, and conflict recovery. Clock ingestion and close are excluded.',
    },
    legacyPaths: ['/hr/time'],
    href: '/hr/time',
  }),
  planned(
    'my-leave',
    'MY_HR',
    'MY_HR',
    'TIM',
    employee,
    '휴가',
    'Leave',
    '잔액, 발생·사용 내역, 신청·취소, 증빙과 팀 캘린더',
    'Balances, accrual and use, requests, withdrawal, evidence, and team calendar',
    ['/hr/absence']
  ),
  node({
    id: 'my-pay-tax',
    inventoryGroup: 'MY_HR',
    surface: 'MY_HR',
    module: 'PAY',
    personas: employee,
    lifecycle: 'PILOT',
    label: { ko: '급여 및 세무', en: 'Pay & tax' },
    capability: {
      ko: '급여명세, 지급계좌, 원천징수와 세무 문서',
      en: 'Pay statements, payment account, withholding, and tax documents',
    },
    coverageNote: {
      ko: '1차 앵커는 다음 급여 주기와 보안 명세 제공 상태만 조회합니다. 계산·확정·지급 및 세무 처리는 포함하지 않습니다.',
      en: 'The Phase 1 anchor reads the next cycle and secure statement availability only. Calculation, finalization, payment, and tax processing are excluded.',
    },
    legacyPaths: ['/hr/pay'],
    href: '/hr/pay',
  }),
  node({
    id: 'my-goals-performance',
    inventoryGroup: 'MY_HR',
    surface: 'MY_HR',
    module: 'PER',
    personas: employee,
    lifecycle: 'PILOT',
    label: { ko: '목표 및 평가', en: 'Goals & performance' },
    capability: {
      ko: '목표수립, 자기평가, 피드백, 면담과 결과',
      en: 'Goals, self review, feedback, conversations, and results',
    },
    coverageNote: {
      ko: '1차 앵커는 활성·위험 상태인 개인 목표의 진행률만 다룹니다. 완료 전환, 평가등급·평가주기·보상 결정은 포함하지 않습니다.',
      en: 'The Phase 1 anchor only updates progress for active or at-risk personal goals. Completion transitions, ratings, review cycles, and compensation decisions are excluded.',
    },
    legacyPaths: ['/hr/talent'],
    href: '/hr/talent',
  }),
  planned(
    'my-hr-requests',
    'MY_HR',
    'MY_HR',
    'HRM',
    employee,
    'HR 요청',
    'HR requests',
    '정보·가족 변경, 증명, 퇴직·복직 신청과 처리 상태',
    'Data and family changes, certificates, exit or return requests, and status',
    ['/hr/services']
  ),
]);
