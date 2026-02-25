import { useEffect } from 'react';
import { useAuth } from '@dwp-frontend/shared-utils';
import { GlobalSnackbar } from '@dwp-frontend/design-system';

import { usePathname } from 'src/routes/hooks';

import { useThemeMode } from 'src/theme/theme-mode';

import { useEventTracking } from './hooks/use-event-tracking';
import { usePageViewTracking } from './hooks/use-page-view-tracking';
import { AuthUnauthorizedHandler } from './components/auth-unauthorized-handler';

// ----------------------------------------------------------------------

type AppProps = {
  children: React.ReactNode;
};

export default function App({ children }: AppProps) {
  const auth = useAuth();
  const { setMode } = useThemeMode();

  useScrollToTop();
  usePageViewTracking(); // Track page views on route changes
  useEventTracking(); // Track navigation events on route changes

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    setMode('light');
  }, [auth.isAuthenticated, setMode]);

  return (
    <>
      <AuthUnauthorizedHandler />
      {children}
      <GlobalSnackbar />
    </>
  );
}

// ----------------------------------------------------------------------

function useScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
