import { Route, Routes, Navigate, BrowserRouter } from 'react-router-dom';

import { RagPage } from './pages/rag';
import { CasesPage } from './pages/cases';
import { AuditPage } from './pages/audit';
import { ActionsPage } from './pages/actions';
import { ArchivePage } from './pages/archive';
import { LineagePage } from './pages/lineage';
import { AutonomyPage } from './pages/autonomy';
import { EntitiesPage } from './pages/entities';
import { PoliciesPage } from './pages/policies';
import { FeedbackPage } from './pages/feedback';
import { SynapseAdminPage } from './pages/admin';
import { DashboardPage } from './pages/dashboard';
import { AnomaliesPage } from './pages/anomalies';
import { DocumentsPage } from './pages/documents';
import { AnalyticsPage } from './pages/analytics';
import { OpenItemsPage } from './pages/open-items';
import { GuardrailsPage } from './pages/guardrails';
import { DictionaryPage } from './pages/dictionary';
import { GovernancePage } from './pages/governance';
import { ActionReconPage } from './pages/action-recon';
import { AgentConfigPage } from './pages/agent-config';
import { OptimizationPage } from './pages/optimization';
import { IntegrationsPage } from './pages/integrations';
import { ReconciliationPage } from './pages/reconciliation';

// ----------------------------------------------------------------------

/**
 * SynapseApp: Synapse Remote 메인 컴포넌트
 * - 메뉴는 Host의 Menu API로 전달됨
 * - Host에서 사용 시: BrowserRouter 없이 Routes만 사용
 * - 독립 실행 시: BrowserRouter로 감싸서 사용
 *
 * 경로 매핑 (참고용 메뉴):
 *   / → 통합 관제 센터, /autonomy → 자율 운영 센터, /cases → 케이스 작업함,
 *   /anomalies → 이상 징후 탐지, /optimization → 채권·채무 최적화,
 *   /actions → 조치 실행 센터, /archive → 조치 이력 보관함,
 *   /documents → 전표 조회, /open-items → 미결제 항목, /entities → 거래처 허브,
 *   /lineage → 계보·근거 뷰어, /rag → 규정·문서 라이브러리, /policies → 정책 프로파일,
 *   /guardrails → 조치 가드레일, /dictionary → 용어·코드 사전, /feedback → 피드백·라벨링,
 *   /reconciliation → 정합성 대사, /action-recon → 조치 결과 대사, /audit → 감사 추적,
 *   /analytics → 효과·성과 분석, /governance → 자율성·통제 설정,
 *   /agent-config → 에이전트 구성, /integrations → 연동·데이터 운영, /admin → 시스템 관리
 */
export const SynapseApp = ({ standalone = false }: { standalone?: boolean }) => {
  const routes = (
    <Routes>
      <Route path="/" element={<Navigate to="/synapse" replace />} />
      <Route path="synapse" element={<DashboardPage />} />
      <Route path="synapse/autonomy" element={<AutonomyPage />} />
      <Route path="synapse/cases" element={<CasesPage />} />
      <Route path="synapse/anomalies" element={<AnomaliesPage />} />
      <Route path="synapse/optimization" element={<OptimizationPage />} />
      <Route path="synapse/actions" element={<ActionsPage />} />
      <Route path="synapse/archive" element={<ArchivePage />} />
      <Route path="synapse/documents" element={<DocumentsPage />} />
      <Route path="synapse/open-items" element={<OpenItemsPage />} />
      <Route path="synapse/entities" element={<EntitiesPage />} />
      <Route path="synapse/lineage" element={<LineagePage />} />
      <Route path="synapse/rag" element={<RagPage />} />
      <Route path="synapse/policies" element={<PoliciesPage />} />
      <Route path="synapse/guardrails" element={<GuardrailsPage />} />
      <Route path="synapse/dictionary" element={<DictionaryPage />} />
      <Route path="synapse/feedback" element={<FeedbackPage />} />
      <Route path="synapse/reconciliation" element={<ReconciliationPage />} />
      <Route path="synapse/action-recon" element={<ActionReconPage />} />
      <Route path="synapse/audit" element={<AuditPage />} />
      <Route path="synapse/analytics" element={<AnalyticsPage />} />
      <Route path="synapse/governance" element={<GovernancePage />} />
      <Route path="synapse/agent-config" element={<AgentConfigPage />} />
      <Route path="synapse/integrations" element={<IntegrationsPage />} />
      <Route path="synapse/admin" element={<SynapseAdminPage />} />
      <Route path="synapse/" element={<DashboardPage />} />
      <Route path="synapse/*" element={<Navigate to="/synapse" replace />} />
    </Routes>
  );

  if (standalone) {
    return <BrowserRouter>{routes}</BrowserRouter>;
  }

  return routes;
};

export default SynapseApp;
