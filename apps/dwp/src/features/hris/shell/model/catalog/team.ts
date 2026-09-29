import {
  HRIS_MANAGER_PERSONAS as manager,
  plannedHrisCatalogNode as planned,
} from '../hris-product-map-contract';

import type { HrisCatalogNode } from '../hris-product-map-contract';

export const HRIS_TEAM_CATALOG: readonly HrisCatalogNode[] = Object.freeze([
  planned(
    'team-home',
    'TEAM',
    'TEAM',
    'SYS',
    manager,
    '팀 홈',
    'Team home',
    '인원 변화, 근태·휴가, 목표 진행과 판단 대기',
    'People changes, time, leave, goal progress, and pending decisions',
    ['/hr/team']
  ),
  planned(
    'team-members',
    'TEAM',
    'TEAM',
    'HRM',
    manager,
    '팀원',
    'Team members',
    '팀 디렉터리, 배치·계약 종료, 자격·스킬과 변경 제안',
    'Team directory, assignment and contract end, skills, and change proposals',
    ['/hr/team']
  ),
  planned(
    'team-time',
    'TEAM',
    'TEAM',
    'TIM',
    manager,
    '팀 근태',
    'Team time',
    '근무표, 누락·이상, 연장근무, 제출과 승인',
    'Schedules, missing and anomalous time, overtime, submission, and approval',
    ['/hr/team/time']
  ),
  planned(
    'team-leave',
    'TEAM',
    'TEAM',
    'TIM',
    manager,
    '팀 휴가',
    'Team leave',
    '팀 캘린더, 잔액 영향, 인력 경고와 승인',
    'Team calendar, balance impact, staffing warnings, and approval',
    ['/hr/team/absence']
  ),
  planned(
    'team-people-changes',
    'TEAM',
    'TEAM',
    'HRM',
    manager,
    '인사 변경',
    'People changes',
    '이동, 겸직, 직무, 근무지와 계약 변경 요청',
    'Transfer, concurrent role, job, location, and contract change requests'
  ),
  planned(
    'team-performance',
    'TEAM',
    'TEAM',
    'PER',
    manager,
    '팀 성과',
    'Team performance',
    '목표 승인, 평가, 다면 요청, 면담과 피드백',
    'Goal approval, reviews, multi-rater requests, conversations, and feedback'
  ),
  planned(
    'team-delegation',
    'TEAM',
    'TEAM',
    'SYS',
    manager,
    '위임함',
    'Delegated work',
    '위임받은 승인, 만료와 충돌 확인',
    'Delegated approvals, expiry, and conflict review'
  ),
]);
