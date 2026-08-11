import { resolveShellKey } from '../features/shell/shell-registry';

type NavigationIntent = {
  startedAt: number;
  type: 'link' | 'history';
};

export type RoutePerformanceDetail = {
  name: 'route-transition';
  routeGroup: string;
  duration: number;
  navigationType: NavigationIntent['type'];
};

let pendingIntent: NavigationIntent | null = null;

export function classifyRouteGroup(pathname: string): string {
  const shell = resolveShellKey(pathname);
  if (shell) return shell;
  if (pathname.startsWith('/sign-in') || pathname.startsWith('/auth/')) return 'authentication';
  if (pathname === '/403' || pathname.startsWith('/404')) return 'status';
  return 'unclassified';
}

export function registerRouteIntentObserver(): () => void {
  const handleClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(target instanceof HTMLAnchorElement) || target.target === '_blank') return;

    const destination = new URL(target.href, window.location.href);
    if (destination.origin !== window.location.origin) return;
    if (
      destination.pathname === window.location.pathname &&
      destination.search === window.location.search
    ) {
      return;
    }
    pendingIntent = { startedAt: performance.now(), type: 'link' };
  };
  const handleHistory = () => {
    pendingIntent = { startedAt: performance.now(), type: 'history' };
  };

  document.addEventListener('click', handleClick, true);
  window.addEventListener('popstate', handleHistory);
  return () => {
    document.removeEventListener('click', handleClick, true);
    window.removeEventListener('popstate', handleHistory);
  };
}

export function reportRouteCommit(pathname: string): () => void {
  const intent = pendingIntent;
  if (!intent) return () => undefined;
  pendingIntent = null;

  let secondFrame = 0;
  const firstFrame = window.requestAnimationFrame(() => {
    secondFrame = window.requestAnimationFrame(() => {
      const detail: RoutePerformanceDetail = {
        name: 'route-transition',
        routeGroup: classifyRouteGroup(pathname),
        duration: Math.round((performance.now() - intent.startedAt) * 10) / 10,
        navigationType: intent.type,
      };
      window.dispatchEvent(
        new CustomEvent<RoutePerformanceDetail>('dwp:route-performance', { detail })
      );
    });
  });

  return () => {
    window.cancelAnimationFrame(firstFrame);
    if (secondFrame) window.cancelAnimationFrame(secondFrame);
  };
}
