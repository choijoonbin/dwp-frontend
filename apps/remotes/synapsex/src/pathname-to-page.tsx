/**
 * Tree API path(pathname) → Synapse 페이지 매핑
 * 메인 진입점: /synapse/workbench (통합 워크벤치). /command-center 흔적 제거.
 * API에서 오는 path를 그대로 사용 (/cases, /rag 등).
 *
 * 권한: 공통 route-permission-config 기반으로 PermissionRouteGuard 적용.
 * path key → resourceKey 매핑은 libs/shared-utils에서 Single Source of Truth.
 */

import type { ReactNode } from 'react';

import { Navigate } from 'react-router-dom';
import { PermissionRouteGuard, getResourceKeyForPath } from '@dwp-frontend/shared-utils';

import { RagPage } from './pages/rag';
import { CasesPage } from './pages/cases';
import { AuditPage } from './pages/audit';
import { ActionsPage } from './pages/actions';
import { ArchivePage } from './pages/archive';
import { LineagePage } from './pages/lineage';
import { AutonomyPage } from './pages/autonomy';
import { EntitiesPage } from './pages/entities';
import { FeedbackPage } from './pages/feedback';
import { PoliciesPage } from './pages/policies';
import { AnalyticsPage } from './pages/analytics';
import { AnomaliesPage } from './pages/anomalies';
import { DocumentsPage } from './pages/documents';
import { WorkbenchPage } from './pages/workbench';
import { OpenItemsPage } from './pages/open-items';
import { DictionaryPage } from './pages/dictionary';
import { GovernancePage } from './pages/governance';
import { GuardrailsPage } from './pages/guardrails';
import { CaseDetailPage } from './pages/case-detail';
import { AgentConfigPage } from './pages/agent-config';
import { SynapseAdminPage } from './pages/admin-legacy';
import { IntegrationsPage } from './pages/integrations';
import { DemoControlPage } from './pages/demo-control';
import { OptimizationPage } from './pages/optimization';
import { EntityDetailPage } from './pages/entity-detail';
import { ReconciliationPage } from './pages/reconciliation';
import { DocumentDetailPage } from './pages/document-detail';
import { RagDocumentDetailPage } from './pages/rag/rag-detail';
import { ActionReconciliationPage } from './pages/action-recon';
import { PolicyProfileDetailPage } from './pages/policies/policy-detail';
import { ReconRunDetailPage } from './pages/reconciliation/recon-run-detail';

// ----------------------------------------------------------------------
// API path (job.txt 기준) → 페이지
// 선행 슬래시 유무 모두 처리 (정규화: 선행 / 제거 후 비교)
// ----------------------------------------------------------------------

const PATH_TO_PAGE: Record<string, () => ReactNode> = {
  // 통합 워크벤치 (메인: /synapse/workbench만 사용, command-center는 위에서 redirect)
  workbench: () => <WorkbenchPage />,
  synapse: () => <WorkbenchPage />,

  // 자율 운영 센터 (부모 메뉴)
  'menu.autonomous-operations': () => <AutonomyPage />,
  autonomy: () => <AutonomyPage />,
  cases: () => <CasesPage />,
  anomalies: () => <AnomaliesPage />,
  optimization: () => <OptimizationPage />,
  actions: () => <ActionsPage />,
  archive: () => <ArchivePage />,

  // 원천 데이터·이력 허브 (부모 path: /synapse/master-data-history)
  'menu.master-data-history': () => <DocumentsPage />,
  'master-data-history': () => <DocumentsPage />,
  documents: () => <DocumentsPage />,
  'open-items': () => <OpenItemsPage />,
  entities: () => <EntitiesPage />,
  lineage: () => <LineagePage />,

  // 지식·정책 허브 (부모 path: /synapse/knowledge-policy)
  'menu.knowledge-policy': () => <RagPage />,
  'knowledge-policy': () => <RagPage />,
  rag: () => <RagPage />,
  policies: () => <PoliciesPage />,
  guardrails: () => <GuardrailsPage />,
  dictionary: () => <DictionaryPage />,
  feedback: () => <FeedbackPage />,

  // 대사·감사 센터 (부모 path: /synapse/reconciliation-audit)
  'menu.reconciliation-audit': () => <ReconciliationPage />,
  'reconciliation-audit': () => <ReconciliationPage />,
  reconciliation: () => <ReconciliationPage />,
  'action-recon': () => <ActionReconciliationPage />,
  audit: () => <AuditPage />,
  analytics: () => <AnalyticsPage />,

  // 거버넌스·설정 (부모 path: /synapse/governance-config)
  'menu.governance-config': () => <GovernancePage />,
  'governance-config': () => <GovernancePage />,
  governance: () => <GovernancePage />,
  'agent-config': () => <AgentConfigPage />,
  'demo-control': () => <DemoControlPage />,
  'menu.demo-control': () => <DemoControlPage />,
  integrations: () => <IntegrationsPage />,
  admin: () => <SynapseAdminPage />,
};

/** path key에 대해 권한 가드로 감싼 페이지 반환 (공통 권한 설정 사용). 레이아웃 HOC 없음 — Host DashboardLayout만 적용. */
function wrapWithRouteGuard(page: ReactNode, pathKey: string): ReactNode {
  const resourceKey = getResourceKeyForPath(pathKey);
  if (!resourceKey) return page;
  return (
    <PermissionRouteGuard resource={resourceKey} permission="VIEW" redirectTo="/403">
      {page}
    </PermissionRouteGuard>
  );
}

/** pathname(예: /synapse/workbench, /cases) → 해당 Synapse 페이지 컴포넌트 */
export const getPageForPathname = (pathname: string): ReactNode => {
  const normalized = pathname.replace(/^\//, '').trim();
  if (!normalized) return wrapWithRouteGuard(<WorkbenchPage />, 'workbench');

  // 0) 레거시 /command-center → /synapse/workbench 즉시 리다이렉트 (최종 경로 고정)
  if (normalized === 'synapse/command-center' || normalized === 'command-center') {
    return <Navigate to="/synapse/workbench" replace />;
  }

  // 1) /synapse/admin/code-usages|menus|codes → Admin Remote로 리다이렉트 (동일 화면 버그 수정)
  const synapseAdminRedirectMatch = normalized.match(/^synapse\/admin\/(code-usages|menus|codes)(?:\/|$)/);
  if (synapseAdminRedirectMatch) {
    const subPath = synapseAdminRedirectMatch[1];
    return <Navigate to={`/admin/${subPath}`} replace />;
  }

  // 1) 상세 페이지 패턴 먼저 체크 (cases/:id, documents/:id, entities/:id, rag/:docId, policies/:profileId)
  const detailMatch = normalized.match(/^(?:synapse\/)?(cases|documents|entities|rag|policies|reconciliation)\/(.+)$/);
  if (detailMatch) {
    const [, resource, idOrPath] = detailMatch;
    if (resource === 'cases') return wrapWithRouteGuard(<CaseDetailPage />, 'cases');
    if (resource === 'documents') return wrapWithRouteGuard(<DocumentDetailPage />, 'documents');
    if (resource === 'entities') return wrapWithRouteGuard(<EntityDetailPage />, 'entities');
    if (resource === 'rag' && idOrPath && idOrPath !== 'search') {
      return wrapWithRouteGuard(<RagDocumentDetailPage docId={idOrPath} />, 'rag');
    }
    if (resource === 'policies' && idOrPath) {
      return wrapWithRouteGuard(<PolicyProfileDetailPage profileId={idOrPath} />, 'policies');
    }
    if (resource === 'reconciliation' && idOrPath) {
      return wrapWithRouteGuard(<ReconRunDetailPage runId={idOrPath} />, 'reconciliation');
    }
  }

  const segments = normalized.split('/');

  // 1) 전체 path가 키인 경우 (menu.command-center, menu.autonomous-operations 등)
  const exact = PATH_TO_PAGE[normalized];
  if (exact) return wrapWithRouteGuard(exact(), normalized);

  // 2) /synapse/xxx 형태: 두 번째 세그먼트만 사용
  if (segments[0] === 'synapse' && segments.length >= 2) {
    const sub = segments[1];
    const subPage = PATH_TO_PAGE[sub];
    if (subPage) return wrapWithRouteGuard(subPage(), sub);
  }

  // 3) 첫 번째 세그먼트만 (API 자식 path: /cases → cases)
  const first = segments[0];
  const firstPage = PATH_TO_PAGE[first];
  if (firstPage) return wrapWithRouteGuard(firstPage(), first);

  return wrapWithRouteGuard(<WorkbenchPage />, 'workbench');
};
