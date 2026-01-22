import { Route, Routes, Navigate, BrowserRouter } from 'react-router-dom';

import { AuditPage } from './pages/audit/page';
import { CodesPage } from './pages/codes/page';
import { RolesPage } from './pages/roles/page';
import { MenusPage } from './pages/menus/page';
import { UsersPage } from './pages/users/index';
import { ResourcesPage } from './pages/resources/page';
import { MonitoringPage } from './pages/monitoring/page';
import { CodeUsagesPage } from './pages/code-usages/page';

// ----------------------------------------------------------------------

/**
 * AdminApp: Admin Remote의 메인 컴포넌트
 * - 독립 실행 시: BrowserRouter로 감싸서 사용
 * - Host에서 사용 시: BrowserRouter 없이 Routes만 사용 (Host의 라우터 사용)
 */
export const AdminApp = ({ standalone = false }: { standalone?: boolean }) => {
  const routes = (
    <Routes>
      <Route path="monitoring" element={<MonitoringPage />} />
      <Route path="audit-logs" element={<Navigate to="audit" replace />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="roles" element={<RolesPage />} />
      <Route path="menus" element={<MenusPage />} />
      <Route path="resources" element={<ResourcesPage />} />
      <Route path="codes" element={<CodesPage />} />
      <Route path="code-usage" element={<Navigate to="code-usages" replace />} />
      <Route path="code-usages" element={<CodeUsagesPage />} />
      <Route path="audit" element={<AuditPage />} />
    </Routes>
  );

  if (standalone) {
    return <BrowserRouter>{routes}</BrowserRouter>;
  }

  return routes;
};

// Default export for lazy loading
export default AdminApp;
