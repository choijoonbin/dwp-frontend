import type { Theme } from '@mui/material/styles';

// ----------------------------------------------------------------------

export function dashboardLayoutVars(theme: Theme, layoutMode?: 'fixed' | 'scrollable') {
  return {
    '--layout-transition-easing': 'linear',
    '--layout-transition-duration': '120ms',
    '--layout-nav-vertical-width': '260px',
    '--layout-nav-vertical-collapsed-width': '88px',
    '--layout-nav-current-width': 'var(--layout-nav-vertical-width)',
    '--layout-dashboard-content-pt': theme.spacing(1),
    // fixed 모드: pb 축소하여 콘텐츠 영역 높이 확보 (scrollable: 8 → fixed: 2)
    '--layout-dashboard-content-pb': layoutMode === 'fixed' ? theme.spacing(2) : theme.spacing(8),
    '--layout-dashboard-content-px': theme.spacing(5),
  };
}
