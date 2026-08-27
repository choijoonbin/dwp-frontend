import { lazy, Suspense, useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { ToastViewport } from '@dwp-frontend/design-system/components/toast-viewport';

import { AuthUnauthorizedHandler } from './components/auth-unauthorized-handler';
import { SkipNavigationLink } from './components/skip-navigation-link';
import { UserLocaleSync } from './components/user-locale-sync';
import { registerRouteIntentObserver, reportRouteCommit } from './observability/route-performance';
import { ProductSurfaceAuthorityBridge } from './features/shell/product-surface-authority-bridge';
import {
  ProductApplicationRuntimeProvider,
  type ProductApplicationRuntime,
} from './components/product-application-runtime';

const notificationRuntimeBundled = import.meta.env.VITE_PRODUCT_NOTIFICATION_RUNTIME !== 'disabled';
const dwaionRuntimeBundled = import.meta.env.VITE_PRODUCT_DWAION_RUNTIME !== 'disabled';
const NotificationRuntimeHost = notificationRuntimeBundled
  ? lazy(() =>
      import('./components/notification-runtime-host').then((module) => ({
        default: module.NotificationRuntimeHost,
      }))
    )
  : undefined;
const DwaionGlobalHost = dwaionRuntimeBundled
  ? lazy(() =>
      import('./components/dwaion-assistant/dwaion-global-host').then((module) => ({
        default: module.DwaionGlobalHost,
      }))
    )
  : undefined;

type AppProps = {
  children: React.ReactNode;
  runtime: ProductApplicationRuntime;
};

export function routeDocumentTitle(heading: string, surface?: string): string {
  return [heading.trim(), surface?.trim(), 'DWP'].filter(Boolean).join(' · ');
}

export function commitRouteAccessibility(
  focusTarget: boolean,
  previousTarget?: HTMLElement
): HTMLElement | undefined {
  const main = document.getElementById('dwp-main-content');
  const heading = main?.querySelector<HTMLHeadingElement>('h1');
  const headingLabel = heading?.textContent?.trim();
  const target = headingLabel ? heading : main;
  if (!target) return undefined;

  if (headingLabel) {
    const surface = document
      .querySelector<HTMLElement>('[data-product-surface-label]')
      ?.dataset.productSurfaceLabel?.trim();
    document.title = routeDocumentTitle(headingLabel, surface);
  }

  const targetChanged = previousTarget !== target;
  const focusMayFollowRouteReplacement =
    previousTarget === undefined ||
    document.activeElement === previousTarget ||
    document.activeElement === document.body ||
    document.activeElement === main;
  if (focusTarget && targetChanged && focusMayFollowRouteReplacement) {
    target.tabIndex = -1;
    target.dataset.routeFocusTarget = 'true';
    target.focus({ preventScroll: true });
  }
  return target;
}

export default function App({ children, runtime }: AppProps) {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(pathname);
  const initialCommit = useRef(true);
  const notificationsEnabled = runtime.globalRuntimeHosts.includes('notifications');
  const dwaionEnabled = runtime.globalRuntimeHosts.includes('dwaion');

  useEffect(() => registerRouteIntentObserver(), []);

  useEffect(() => {
    const first = initialCommit.current;
    const pathChanged = previousPath.current !== pathname;
    initialCommit.current = false;
    previousPath.current = pathname;
    const focusHeading = !first && pathChanged && navigationType !== 'POP';
    if (!first && navigationType !== 'POP') window.scrollTo(0, 0);
    const cancelPerformanceReport = first ? () => undefined : reportRouteCommit(pathname);
    let committedTarget: HTMLElement | undefined;
    const commit = () => {
      committedTarget = commitRouteAccessibility(focusHeading, committedTarget) ?? committedTarget;
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
      <ProductApplicationRuntimeProvider runtime={runtime}>
        <ProductSurfaceAuthorityBridge runtime={runtime}>{children}</ProductSurfaceAuthorityBridge>
      </ProductApplicationRuntimeProvider>
      <Suspense fallback={null}>
        {NotificationRuntimeHost && notificationsEnabled && <NotificationRuntimeHost />}
        {DwaionGlobalHost && dwaionEnabled && <DwaionGlobalHost />}
      </Suspense>
      <ToastViewport />
    </>
  );
}
