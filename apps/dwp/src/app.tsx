import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ToastViewport } from '@dwp-frontend/design-system/components/toast-viewport';

import { AuthUnauthorizedHandler } from './components/auth-unauthorized-handler';
import { SkipNavigationLink } from './components/skip-navigation-link';
import { UserLocaleSync } from './components/user-locale-sync';
import { registerRouteIntentObserver, reportRouteCommit } from './observability/route-performance';

type AppProps = {
  children: React.ReactNode;
};

export default function App({ children }: AppProps) {
  const { pathname } = useLocation();
  const initialPath = useRef(pathname);

  useEffect(() => registerRouteIntentObserver(), []);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (initialPath.current === pathname) return;
    initialPath.current = pathname;
    const cancelPerformanceReport = reportRouteCommit(pathname);
    const focusFrame = window.requestAnimationFrame(() => {
      document.getElementById('dwp-main-content')?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      cancelPerformanceReport();
    };
  }, [pathname]);

  return (
    <>
      <SkipNavigationLink />
      <AuthUnauthorizedHandler />
      <UserLocaleSync />
      {children}
      <ToastViewport />
    </>
  );
}
