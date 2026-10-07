import {
  HRIS_OPERATOR_PERSONAS as operator,
  hrisCatalogNode as node,
  plannedHrisCatalogNode as planned,
} from '../hris-product-map-contract';

import type { HrisCatalogNode } from '../hris-product-map-contract';

export const HRIS_HR_OPERATIONS_CATALOG: readonly HrisCatalogNode[] = Object.freeze([
  planned(
    'hr-operations-home',
    'HR_OPERATIONS',
    'OPERATIONS',
    'SYS',
    operator,
    '운영 홈',
    'Operations home',
    '입퇴사, 발령·계약, 데이터 품질, SLA와 연계 오류',
    'Joiners and leavers, appointments, contracts, data quality, SLA, and integration errors',
    ['/hr/operations']
  ),
  node({
    id: 'hr-people',
    inventoryGroup: 'HR_OPERATIONS',
    surface: 'OPERATIONS',
    module: 'HRM',
    personas: operator,
    lifecycle: 'PILOT',
    label: { ko: '사람', en: 'People' },
    capability: {
      ko: '인물 검색, 중복 후보, 인사정보와 문서의 360° 조회',
      en: 'People search, duplicate candidates, HR information, and document 360 view',
    },
    coverageNote: {
      ko: '1차 앵커는 권한·유효일 기반 사람 목록과 상세 조회를 제공합니다. 생성·변경·중복병합·문서 편집은 포함하지 않습니다.',
      en: 'The Phase 1 anchor provides authority-aware, effective-dated people search and detail. Create, change, duplicate merge, and document editing are excluded.',
    },
    legacyPaths: ['/hr/directory', '/hr/operations/people'],
    href: '/hr/operations/people',
  }),
  planned(
    'hr-employment-assignments',
    'HR_OPERATIONS',
    'OPERATIONS',
    'HRM',
    operator,
    '고용관계·배치',
    'Employment & assignments',
    '입사, 재고용, 겸직, 주·부배치, 계약과 종료',
    'Hire, rehire, concurrent jobs, primary and secondary assignments, contracts, and end',
    ['/hr/operations/assignments']
  ),
  planned(
    'hr-appointments',
    'HR_OPERATIONS',
    'OPERATIONS',
    'HRM',
    operator,
    '발령',
    'Appointments',
    '발령안, 일괄 검증, 승인, 게시, 취소와 정정',
    'Appointment proposals, bulk validation, approval, publish, cancellation, and correction'
  ),
  planned(
    'hr-organization-positions',
    'HR_OPERATIONS',
    'OPERATIONS',
    'HRM',
    operator,
    '조직·포지션',
    'Organizations & positions',
    '법인, 사업장, 조직, 직무, 직급, 포지션과 시나리오',
    'Legal entities, sites, organizations, jobs, grades, positions, and scenarios',
    ['/hr/organization', '/hr/design/organization']
  ),
  planned(
    'hr-contracts-compensation-basis',
    'HR_OPERATIONS',
    'OPERATIONS',
    'HRM',
    operator,
    '계약·보상기준',
    'Contracts & compensation basis',
    '근로·연봉계약, 보상 기준, 대상, 만료와 전자서명',
    'Employment and salary contracts, compensation basis, population, expiry, and e-signature'
  ),
  planned(
    'hr-employee-change-requests',
    'HR_OPERATIONS',
    'OPERATIONS',
    'HRM',
    operator,
    '직원변경 요청',
    'Employee change requests',
    '요청 대기열, 증빙, 차이 비교, 결정과 적용 결과',
    'Request queue, evidence, diff, decisions, and application results'
  ),
  planned(
    'hr-certificates-documents',
    'HR_OPERATIONS',
    'OPERATIONS',
    'HRM',
    operator,
    '증명·문서',
    'Certificates & documents',
    '증명서 발급·진위, 양식, 직인, 일괄처리와 보존',
    'Certificate issue and verification, templates, seals, batches, and retention'
  ),
  planned(
    'hr-exit-return',
    'HR_OPERATIONS',
    'OPERATIONS',
    'HRM',
    operator,
    '퇴직·복직',
    'Exit & return',
    '종료, 퇴직, 해고, 복직 사례와 체크리스트',
    'Termination, resignation, dismissal, return cases, and checklists'
  ),
  planned(
    'hr-data-quality',
    'HR_OPERATIONS',
    'OPERATIONS',
    'HRM',
    operator,
    '데이터 품질',
    'Data quality',
    '누락, 충돌, 유효일 중복과 참조 오류 관리',
    'Missing data, conflicts, effective-date overlaps, and reference errors',
    ['/hr/data/integrations']
  ),
]);
