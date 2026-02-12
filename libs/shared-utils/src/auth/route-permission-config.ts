/**
 * 공통 라우트 ↔ 권한 리소스 키 매핑
 *
 * - 메뉴/탭/페이지별 권한 제어는 이 설정을 Single Source of Truth로 사용.
 * - Host/Remote 앱 모두 path(또는 path segment)로 resourceKey를 조회해
 *   PermissionRouteGuard / PermissionGate에 전달.
 *
 * @see apps/remotes/synapsex/docs/20260203/[전달용]LOGIN_AND_PERMISSION_API_FE_HANDOVER.md §5
 */

// ----------------------------------------------------------------------
// path segment (라우트 키) → resourceKey (GET /api/auth/permissions 기준)
// ----------------------------------------------------------------------

export const ROUTE_RESOURCE_MAP: Record<string, string> = {
  // 통합 워크벤치 (메인: /synapse/workbench, 권한은 menu.command-center로 통일)
  workbench: 'menu.command-center',
  'command-center': 'menu.command-center',
  'menu.workbench': 'menu.command-center',
  'menu.command-center': 'menu.command-center',
  synapse: 'menu.command-center',

  // 자율 운영 센터
  'menu.autonomous-operations': 'menu.autonomous-operations',
  'menu.autonomous-operations.workbench': 'menu.command-center',
  autonomy: 'menu.autonomous-operations',
  cases: 'menu.autonomous-operations.cases',
  anomalies: 'menu.autonomous-operations.anomalies',
  optimization: 'menu.autonomous-operations.optimization',
  actions: 'menu.autonomous-operations.actions',
  archive: 'menu.autonomous-operations.archive',

  // 원천 데이터·이력 허브
  'menu.master-data-history': 'menu.master-data-history',
  'master-data-history': 'menu.master-data-history',
  documents: 'menu.master-data-history.documents',
  'open-items': 'menu.master-data-history.open-items',
  entities: 'menu.master-data-history.entities',
  lineage: 'menu.master-data-history.lineage',

  // 지식·정책 허브
  'menu.knowledge-policy': 'menu.knowledge-policy',
  'knowledge-policy': 'menu.knowledge-policy',
  rag: 'menu.knowledge-policy.rag',
  policies: 'menu.knowledge-policy.policies',
  guardrails: 'menu.knowledge-policy.guardrails',
  dictionary: 'menu.knowledge-policy.dictionary',
  feedback: 'menu.knowledge-policy.feedback',

  // 대사·감사 센터
  'menu.reconciliation-audit': 'menu.reconciliation-audit',
  'reconciliation-audit': 'menu.reconciliation-audit',
  reconciliation: 'menu.reconciliation-audit.reconciliation',
  'action-recon': 'menu.reconciliation-audit.action-recon',
  audit: 'menu.reconciliation-audit.audit',
  analytics: 'menu.reconciliation-audit.analytics',

  // 거버넌스·설정 (시스템 관리, Admin 3탭 포함)
  'menu.governance-config': 'menu.governance-config',
  'governance-config': 'menu.governance-config',
  governance: 'menu.governance-config.governance',
  'agent-config': 'menu.governance-config.agent-config',
  'demo-control': 'menu.demo-control',
  'menu.demo-control': 'menu.demo-control',
  integrations: 'menu.governance-config.integrations',
  admin: 'menu.governance-config.admin',
};

/**
 * 라우트 키(path segment 또는 normalized path)에 해당하는 resourceKey 반환.
 * 상세 페이지(cases/:id 등)는 부모 리소스 키(cases, documents, entities)로 조회.
 *
 * @param pathKey - PATH_TO_PAGE 키와 동일 (예: 'cases', 'audit', 'synapse')
 * @returns resourceKey 또는 없으면 null
 */
export function getResourceKeyForPath(pathKey: string): string | null {
  if (!pathKey) return null;
  const key = pathKey.trim();
  return ROUTE_RESOURCE_MAP[key] ?? null;
}
