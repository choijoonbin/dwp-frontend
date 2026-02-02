import { Route, Routes, Navigate, useLocation, BrowserRouter } from 'react-router-dom';

import { SYNAPSE_ROUTES } from './routes';
import { getPageForPathname } from './pathname-to-page';

// ----------------------------------------------------------------------

/** pathname 기준으로 페이지 반환 (권한 가드 포함, 공통 route-permission-config 사용) */
const SynapseAppByPathname = () => {
  const { pathname } = useLocation();
  return <>{getPageForPathname(pathname)}</>;
};

/**
 * SynapseApp: Synapse Remote 메인 컴포넌트
 * - Host 사용 시: pathname 기준으로 getPageForPathname 호출 (권한 가드 적용)
 * - Standalone 시: /synapse/* 단일 라우트로 동일하게 getPageForPathname 사용 → 권한 일원화
 */
export const SynapseApp = ({ standalone = false }: { standalone?: boolean }) => {
  if (standalone) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to={SYNAPSE_ROUTES.ROOT} replace />} />
          <Route path="/synapse/*" element={<SynapseAppByPathname />} />
          <Route path="*" element={<Navigate to={SYNAPSE_ROUTES.ROOT} replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return <SynapseAppByPathname />;
};

export default SynapseApp;
