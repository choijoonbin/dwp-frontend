import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { postPageView, getUserId } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

/**
 * Hook to track page views automatically on route changes
 * Debounces calls to prevent excessive API requests
 */
export const usePageViewTracking = () => {
  const location = useLocation();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPathRef = useRef<string>('');

  useEffect(() => {
    // Skip if path hasn't changed
    if (location.pathname === lastPathRef.current) {
      return;
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce: Wait 500ms before sending page view
    timeoutRef.current = setTimeout(() => {
      const path = location.pathname;
      const search = location.search;
      const fullPath = search ? `${path}${search}` : path;

      // Extract menu key from path if possible
      // e.g., /admin/monitoring -> menu.admin.monitoring
      let menuKey: string | undefined;
      if (path.startsWith('/admin')) {
        const adminPath = path.replace('/admin', '').replace(/^\//, '');
        if (adminPath) {
          menuKey = `menu.admin.${adminPath.replace(/\//g, '.')}`;
        } else {
          menuKey = 'menu.admin';
        }
      } else if (path.startsWith('/mail')) {
        menuKey = 'menu.mail';
      } else if (path.startsWith('/chat')) {
        menuKey = 'menu.chat';
      } else if (path.startsWith('/approval')) {
        menuKey = 'menu.approval';
      } else if (path.startsWith('/ai-workspace')) {
        menuKey = 'menu.ai.workspace';
      } else if (path === '/' || path === '/dashboard') {
        menuKey = 'menu.dashboard';
      }

      // Get page title
      const title = document.title || path;

      // Get user ID if available
      const userId = getUserId();

      // Get device info
      const device = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? 'mobile' : 'desktop';

      // Get referrer
      const referrer = document.referrer || undefined;

      // Generate visitor ID (simple hash of user agent + screen resolution)
      // In production, use a more robust visitor tracking solution
      const visitorId = userId || `visitor_${btoa(`${navigator.userAgent}_${screen.width}x${screen.height}`).substring(0, 16)}`;

      // Post page view (silent fail - don't break the app)
      postPageView({
        path: fullPath,
        menuKey,
        title,
        visitorId,
        userId: userId || undefined,
        device,
        referrer,
      }).catch((error) => {
        // Already handled in postPageView, but log for debugging
        console.debug('[PageView Tracking]', error);
      });

      lastPathRef.current = path;
    }, 500);

    // Cleanup on unmount or path change
    // eslint-disable-next-line consistent-return
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [location.pathname, location.search]);
};
