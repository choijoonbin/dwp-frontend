// ----------------------------------------------------------------------

import { postEvent } from '../api/monitoring-api';
import { getUserId } from '../auth/user-id-storage';
import { useMenuTreeStore } from '../auth/menu-tree-store';

import type { MenuNode } from '../auth/types';
import type { UiAction } from '../admin/event-actions';
import type { EventPayload } from '../api/monitoring-api';

// ----------------------------------------------------------------------

/**
 * Generate visitor ID (consistent with page view tracking)
 * Uses user ID if available, otherwise generates a stable visitor ID
 */
function getVisitorId(): string {
  const userId = getUserId();
  if (userId) {
    return userId;
  }

  // Generate a stable visitor ID based on user agent and screen resolution
  // This should be consistent across page loads for the same browser/device
  const key = `${navigator.userAgent}_${screen.width}x${screen.height}`;
  const storedVisitorId = sessionStorage.getItem('dwp-visitor-id');
  
  if (storedVisitorId) {
    return storedVisitorId;
  }

  // Generate new visitor ID
  const visitorId = `visitor_${btoa(key).substring(0, 16)}`;
  sessionStorage.setItem('dwp-visitor-id', visitorId);
  return visitorId;
}

/**
 * Track event (for analytics collection)
 * Silent fail - doesn't break the app if tracking fails
 * 
 * Standardized event tracking with automatic field population.
 * action must be a valid UiAction (VIEW, CLICK, EXECUTE, etc.)
 * 
 * @param payload - Event payload (action and resourceKey are required)
 * @param options - Optional tracking options
 */
export const trackEvent = async (
  payload: {
    resourceKey: string; // Required
    action: UiAction | string; // Required - should be UiAction, but accepts string for flexibility
    label?: string;
    metadata?: Record<string, unknown>;
    path?: string; // Auto-filled if not provided
    visitorId?: string; // Auto-filled if not provided
    userId?: string | null; // Auto-filled if not provided
  },
  options?: {
    silent?: boolean; // Default: true
  }
): Promise<void> => {
  const silent = options?.silent !== false; // Default to true

  try {
    // Get current path if not provided
    const path = payload.path || (typeof window !== 'undefined' ? window.location.pathname : undefined);
    
    // Get visitor ID if not provided
    const visitorId = payload.visitorId || (typeof window !== 'undefined' ? getVisitorId() : undefined);
    
    // Get user ID if not provided
    const userId = payload.userId !== undefined ? payload.userId : getUserId();

    // Prepare event payload
    const eventPayload: EventPayload = {
      resourceKey: payload.resourceKey,
      action: payload.action,
      label: payload.label,
      metadata: payload.metadata,
      path,
      visitorId,
      userId: userId || null,
    };

    // Post event (already has silent fail handling)
    await postEvent(eventPayload);

    // Debug log in development
    if (process.env.NODE_ENV === 'development' && !silent) {
      console.debug('[Event Tracking]', eventPayload);
    }
  } catch (error) {
    // Silent fail - don't break the app
    if (!silent) {
      console.warn('[Event Tracking] Failed to track event:', error);
    }
  }
};

// ----------------------------------------------------------------------

/**
 * Find menu node by path in menu tree (recursive)
 */
function findMenuByPath(nodes: MenuNode[], pathname: string): MenuNode | null {
  for (const node of nodes) {
    // Check exact match
    if (node.path === pathname) {
      return node;
    }
    
    // Check children recursively
    if (node.children && node.children.length > 0) {
      const found = findMenuByPath(node.children, pathname);
      if (found) {
        return found;
      }
    }
  }
  
  return null;
}

/**
 * Helper function to extract resource key from route path
 * Examples:
 *   /admin/users -> menu.admin.users
 *   /admin/monitoring -> menu.admin.monitoring
 *   /mail -> menu.mail
 *   /dashboard -> menu.dashboard
 */
export const getResourceKeyFromPath = (pathname: string): string => {
  // Try to get from menu tree first
  const menuTree = useMenuTreeStore.getState().menuTree;
  if (menuTree.length > 0) {
    const menuNode = findMenuByPath(menuTree, pathname);
    if (menuNode && menuNode.menuKey) {
      return menuNode.menuKey;
    }
  }
  
  // Fallback to path-based extraction
  if (pathname.startsWith('/admin')) {
    const adminPath = pathname.replace('/admin', '').replace(/^\//, '');
    if (adminPath) {
      return `menu.admin.${adminPath.replace(/\//g, '.')}`;
    }
    return 'menu.admin';
  }
  
  if (pathname.startsWith('/mail')) {
    return 'menu.mail';
  }
  
  if (pathname.startsWith('/chat')) {
    return 'menu.chat';
  }
  
  if (pathname.startsWith('/approval')) {
    return 'menu.approval';
  }
  
  if (pathname.startsWith('/ai-workspace')) {
    return 'menu.ai.workspace';
  }
  
  if (pathname === '/' || pathname === '/dashboard') {
    return 'menu.dashboard';
  }
  
  // Fallback: use route path
  return `route:${pathname}`;
};

/**
 * Get menu name from path (for label)
 */
export const getMenuNameFromPath = (pathname: string): string | null => {
  const menuTree = useMenuTreeStore.getState().menuTree;
  if (menuTree.length > 0) {
    const menuNode = findMenuByPath(menuTree, pathname);
    if (menuNode && menuNode.menuName) {
      return menuNode.menuName;
    }
  }
  
  return null;
};

// ----------------------------------------------------------------------
