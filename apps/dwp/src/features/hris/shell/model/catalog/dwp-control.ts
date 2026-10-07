import {
  HRIS_SETTINGS_PERSONAS as settings,
  hrisCatalogNode as node,
} from '../hris-product-map-contract';

import type { HrisCatalogNode } from '../hris-product-map-contract';

export const HRIS_DWP_CONTROL_CATALOG: readonly HrisCatalogNode[] = Object.freeze([
  node({
    id: 'dwp-experience',
    inventoryGroup: 'DWP_CONTROL',
    surface: 'SETTINGS',
    module: 'SYS',
    personas: settings,
    lifecycle: 'EXTERNAL',
    externalTarget: 'DWP_EXPERIENCE',
    label: { ko: 'Experience · HRIS 표시', en: 'Experience · HRIS presentation' },
    capability: {
      ko: '표시명, 브랜딩과 기본 locale',
      en: 'Display name, branding, and default locale',
    },
  }),
  node({
    id: 'dwp-identity',
    inventoryGroup: 'DWP_CONTROL',
    surface: 'SETTINGS',
    module: 'SYS',
    personas: ['SETTINGS_ADMIN', 'AUDITOR'],
    lifecycle: 'EXTERNAL',
    externalTarget: 'DWP_IDENTITY',
    label: { ko: 'Identity · HRIS 권한', en: 'Identity · HRIS access' },
    capability: {
      ko: 'persona 묶음, 대상집단, 필드 접근과 직무분리',
      en: 'Persona bundles, target populations, field access, and segregation of duties',
    },
  }),
  node({
    id: 'dwp-platform',
    inventoryGroup: 'DWP_CONTROL',
    surface: 'SETTINGS',
    module: 'SYS',
    personas: settings,
    lifecycle: 'EXTERNAL',
    externalTarget: 'DWP_PLATFORM',
    label: { ko: 'Platform · HRIS 설치', en: 'Platform · HRIS installation' },
    capability: {
      ko: '앱 entitlement, 국가팩 카탈로그와 스키마 레지스트리',
      en: 'App entitlement, country-pack catalog, and schema registry',
    },
  }),
  node({
    id: 'dwp-integrations',
    inventoryGroup: 'DWP_CONTROL',
    surface: 'SETTINGS',
    module: 'SYS',
    personas: settings,
    lifecycle: 'EXTERNAL',
    externalTarget: 'DWP_INTEGRATIONS',
    availability: 'LEGACY_PARTIAL',
    authorization: 'CENTRAL_POLICY',
    label: { ko: 'Integrations · HRIS 연결', en: 'Integrations · HRIS connections' },
    capability: {
      ko: '엔드포인트, 비밀·인증서와 허용 목적지',
      en: 'Endpoints, secrets, certificates, and allowed destinations',
    },
    coverageNote: {
      ko: '현재 HRIS 연계·대사 화면은 일부 운영 정보를 제공하며, 비밀·인증서 통제는 DWP 관리자 영역으로 이관할 목표입니다.',
      en: 'The current HRIS integration and reconciliation screen provides a subset of operations; secret and certificate controls target DWP administration.',
    },
    legacyPaths: ['/hr/data/integrations'],
  }),
  node({
    id: 'dwp-governance',
    inventoryGroup: 'DWP_CONTROL',
    surface: 'SETTINGS',
    module: 'SYS',
    personas: ['SETTINGS_ADMIN', 'AUDITOR'],
    lifecycle: 'EXTERNAL',
    externalTarget: 'DWP_GOVERNANCE',
    availability: 'LEGACY_PARTIAL',
    authorization: 'CENTRAL_POLICY',
    label: { ko: 'Governance · HRIS 감사', en: 'Governance · HRIS audit' },
    capability: {
      ko: '감사 묶음, 민감 반출, 보존과 법적 보존',
      en: 'Audit bundles, sensitive exports, retention, and legal hold',
    },
    coverageNote: {
      ko: '현재 통제 반출 화면은 일부 증빙을 제공하며, 감사·보존·법적 보존 정책은 DWP 관리자 영역으로 이관할 목표입니다.',
      en: 'The current governed-export screen provides a subset of evidence; audit, retention, and legal-hold policy targets DWP administration.',
    },
    legacyPaths: ['/hr/data/exports'],
  }),
  node({
    id: 'dwp-extensibility',
    inventoryGroup: 'DWP_CONTROL',
    surface: 'SETTINGS',
    module: 'SYS',
    personas: settings,
    lifecycle: 'EXTERNAL',
    externalTarget: 'DWP_EXTENSIBILITY',
    label: { ko: 'Extensibility · 확장팩 통제', en: 'Extensibility · extension control' },
    capability: {
      ko: '확장팩 검토, 서명, 호환, 중지와 철회',
      en: 'Extension review, signing, compatibility, suspension, and revocation',
    },
  }),
]);
