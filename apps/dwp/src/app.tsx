import { lazy, Suspense, useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { ToastViewport } from '@dwp-frontend/design-system/components/toast-viewport';

import { AuthUnauthorizedHandler } from './components/auth-unauthorized-handler';
import { SkipNavigationLink } from './components/skip-navigation-link';
import { UserLocaleSync } from './components/user-locale-sync';
import { registerRouteIntentObserver, reportRouteCommit } from './observability/route-performance';
import { ProductSurfaceAuthorityBridge } from './features/shell/product-surface-authority-bridge';

const NotificationRuntimeHost = lazy(() =>
  import('./components/notification-runtime-host').then((module) => ({
    default: module.NotificationRuntimeHost,
  }))
);

const DwaionGlobalHost = lazy(() =>
  import('./components/dwaion-assistant/dwaion-global-host').then((module) => ({
    default: module.DwaionGlobalHost,
  }))
);

type AppProps = {
  children: React.ReactNode;
};

export function routeDocumentTitle(heading: string, surface?: string): string {
  return [heading.trim(), surface?.trim(), 'DWP'].filter(Boolean).join(' · ');
}

function commitRouteAccessibility(
  focusHeading: boolean,
  previousHeading?: HTMLHeadingElement
): HTMLHeadingElement | undefined {
  const main = document.getElementById('dwp-main-content');
  const heading = main?.querySelector<HTMLHeadingElement>('h1');
  if (!heading?.textContent?.trim()) return undefined;
  const surface = document
    .querySelector<HTMLElement>('[data-product-surface-label]')
    ?.dataset.productSurfaceLabel?.trim();
  document.title = routeDocumentTitle(heading.textContent, surface);
  const headingChanged = previousHeading !== heading;
  const focusMayFollowRouteReplacement =
    previousHeading === undefined ||
    document.activeElement === previousHeading ||
    document.activeElement === document.body ||
    document.activeElement === main;
  if (focusHeading && headingChanged && focusMayFollowRouteReplacement) {
    heading.tabIndex = -1;
    heading.dataset.routeFocusTarget = 'true';
    heading.focus({ preventScroll: true });
  }
  return heading;
}

export default function App({ children }: AppProps) {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(pathname);
  const initialCommit = useRef(true);

  useEffect(() => registerRouteIntentObserver(), []);

  useEffect(() => {
    const first = initialCommit.current;
    const pathChanged = previousPath.current !== pathname;
    initialCommit.current = false;
    previousPath.current = pathname;
    const focusHeading = !first && pathChanged && navigationType !== 'POP';
    if (!first && navigationType !== 'POP') window.scrollTo(0, 0);
    const cancelPerformanceReport = first ? () => undefined : reportRouteCommit(pathname);
    let committedHeading: HTMLHeadingElement | undefined;
    const commit = () => {
      committedHeading =
        commitRouteAccessibility(focusHeading, committedHeading) ?? committedHeading;
    };
    const observer = new MutationObserver(commit);
    const focusFrame = window.requestAnimationFrame(() => {
      const stableRoot = document.getElementById('root') ?? document.body;
      observer.observe(stableRoot, { childList: true, subtree: true });
      commit();
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      observer.disconnect();
      cancelPerformanceReport();
    };
  }, [navigationType, pathname]);

  return (
    <>
      <SkipNavigationLink />
      <AuthUnauthorizedHandler />
      <UserLocaleSync />
      <ProductSurfaceAuthorityBridge>{children}</ProductSurfaceAuthorityBridge>
      <Suspense fallback={null}>
        <NotificationRuntimeHost />
        <DwaionGlobalHost />
      </Suspense>
      <ToastViewport />
    </>
  );
}
