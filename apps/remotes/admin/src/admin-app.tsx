import { Routes, Route, BrowserRouter } from 'react-router-dom';

import { AuditPage } from './pages/audit';
import { UsersPage } from './pages/users';
import { RolesPage } from './pages/roles';
import { CodesPage } from './pages/codes';
import { ResourcesPage } from './pages/resources';
import { MonitoringPage } from './pages/monitoring';

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
      <Route path="users" element={<UsersPage />} />
      <Route path="roles" element={<RolesPage />} />
      <Route path="resources" element={<ResourcesPage />} />
      <Route path="codes" element={<CodesPage />} />
      <Route path="audit" element={<AuditPage />} />
      <Route index element={<MonitoringPage />} />
    </Routes>
  );

  if (standalone) {
    return <BrowserRouter>{routes}</BrowserRouter>;
  }

  return routes;
};

// Default export for lazy loading
export default AdminApp;
