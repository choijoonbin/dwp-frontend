// ----------------------------------------------------------------------

import type { UiAction } from '@dwp-frontend/shared-utils';

import { useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent, getMenuNameFromPath } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

/**
 * Standard Event Tracking Hook
 * 
 * Provides standardized event tracking with debounce support.
 * Use this hook for UI interactions (buttons, tabs, search, etc.)
 * 
 * Debounce rules:
 * - SEARCH: 500ms debounce
 * - CLICK: no debounce (immediate)
 * - Other actions: no debounce (immediate)
 */
export const useStandardEventTracking = () => {
  const location = useLocation();
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Track a UI event
   * 
   * @param action - Standard UiAction (VIEW, CLICK, EXECUTE, etc.)
   * @param resourceKey - Resource key (e.g., 'btn.admin.roles.create', 'menu.admin.monitoring')
   * @param options - Optional tracking options
   */
  const track = useCallback(
    (
      action: UiAction,
      resourceKey: string,
      options?: {
        label?: string;
        metadata?: Record<string, unknown>;
        debounce?: boolean; // Override default debounce behavior
      }
    ) => {
      const pagePath = location.pathname;
      const menuName = getMenuNameFromPath(pagePath);
      const label = options?.label || menuName || document.title || pagePath;

      const eventPayload = {
        resourceKey,
        action,
        label,
        metadata: {
          ...options?.metadata,
          pagePath,
        },
        path: pagePath,
      };

      // Apply debounce for SEARCH action (500ms)
      const shouldDebounce = options?.debounce !== undefined 
        ? options.debounce 
        : action === 'SEARCH';

      if (shouldDebounce) {
        // Clear previous timeout
        if (searchDebounceRef.current) {
          clearTimeout(searchDebounceRef.current);
        }

        // Debounce: Wait 500ms before sending event
        searchDebounceRef.current = setTimeout(() => {
          trackEvent(eventPayload).catch((error) => {
            console.debug('[Event Tracking] Event failed:', error);
          });
        }, 500);
      } else {
        // Immediate tracking (no debounce)
        trackEvent(eventPayload).catch((error) => {
          console.debug('[Event Tracking] Event failed:', error);
        });
      }
    },
    [location.pathname]
  );

  // Cleanup debounce on unmount
  const cleanup = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
  }, []);

  return {
    track,
    cleanup,
  };
};
