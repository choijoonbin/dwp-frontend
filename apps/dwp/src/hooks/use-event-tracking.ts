import type { UiAction } from '@dwp-frontend/shared-utils';

import { useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent, getMenuNameFromPath, getResourceKeyFromPath } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

/**
 * Hook to track navigation events automatically on route changes
 * Debounces calls to prevent excessive API requests
 */
export const useEventTracking = () => {
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

    // Debounce: Wait 300ms before sending event
    timeoutRef.current = setTimeout(() => {
      const path = location.pathname;
      const search = location.search;
      const fullPath = search ? `${path}${search}` : path;

      // Extract resource key from path
      const resourceKey = getResourceKeyFromPath(path);
      
      // Get menu name from menu tree (preferred) or fallback to document title or path
      const menuName = getMenuNameFromPath(path);
      const label = menuName || document.title || path;

      // Track navigation event
      trackEvent({
        resourceKey,
        action: 'VIEW' as UiAction, // Navigation is a VIEW action
        label,
        metadata: {
          path: fullPath,
          page: fullPath,
        },
        path: fullPath,
      }).catch((error) => {
        // Already handled in trackEvent, but log for debugging
        console.debug('[Event Tracking] Navigation event failed:', error);
      });

      lastPathRef.current = path;
    }, 300);

    // Cleanup on unmount or path change
    // eslint-disable-next-line consistent-return
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [location.pathname, location.search]);
};

// ----------------------------------------------------------------------
