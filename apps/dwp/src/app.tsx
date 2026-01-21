import { useEffect } from 'react';

import { usePathname } from 'src/routes/hooks';

import { useEventTracking } from './hooks/use-event-tracking';
import { usePageViewTracking } from './hooks/use-page-view-tracking';
import { AuthUnauthorizedHandler } from './components/auth-unauthorized-handler';

// ----------------------------------------------------------------------

type AppProps = {
  children: React.ReactNode;
};

export default function App({ children }: AppProps) {
  useScrollToTop();
  usePageViewTracking(); // Track page views on route changes
  useEventTracking(); // Track navigation events on route changes

  return (
    <>
      <AuthUnauthorizedHandler />
      {children}
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
