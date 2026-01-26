import { CONFIG } from 'src/config-global';
import { MainApiHealth } from 'src/features/health/main-api-health';

import { OverviewAnalyticsView as DashboardView } from 'src/sections/overview/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Dashboard - ${CONFIG.appName}`}</title>
      <meta
        name="description"
        content="DWP 대시보드. Material-UI 기반으로 구성된 대시보드입니다."
      />
      <meta name="keywords" content="react,material,kit,application,dashboard,admin,template" />

      <MainApiHealth />
      <DashboardView />
    </>
  );
}
