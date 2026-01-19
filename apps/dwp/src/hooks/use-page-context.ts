// ----------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// ----------------------------------------------------------------------

export type PageContext = {
  url: string;
  path: string;
  title: string;
  activeApp: string;
  itemId?: string;
  metadata?: Record<string, any>;
  remoteState?: Record<string, any>; // Remote 앱의 내부 상태
};

/**
 * MFE Context Bridge: Remote 앱의 내부 상태를 수집하기 위한 인터페이스
 * Remote 앱은 window.dwpContextProvider를 통해 컨텍스트를 제공할 수 있습니다.
 */
declare global {
  interface Window {
    dwpContextProvider?: {
      getContext?: () => Record<string, any>;
      getSelectedItems?: () => string[] | Record<string, any>[];
      getViewState?: () => Record<string, any>;
    };
  }
}

export const usePageContext = (): PageContext => {
  const location = useLocation();
  const [title, setTitle] = useState('');
  const [remoteState, setRemoteState] = useState<Record<string, any>>({});

  useEffect(() => {
    setTitle(document.title || window.location.pathname);
  }, [location]);

  const path = location.pathname;
  const segments = path.split('/').filter(Boolean);
  const activeApp = segments[0] || 'dashboard';
  const itemId = segments[segments.length - 1];

  // Extract metadata from page
  const [metadata, setMetadata] = useState<Record<string, any>>({});
  
  // Try to extract data from common elements
  useEffect(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map((el) => el.textContent);
    const tables = document.querySelectorAll('table');
    const cards = document.querySelectorAll('[class*="card"], [class*="Card"]');

    const newMetadata: Record<string, any> = {};
    if (headings.length > 0) {
      newMetadata.headings = headings.slice(0, 5);
    }
    if (tables.length > 0) {
      newMetadata.hasTables = true;
      newMetadata.tableCount = tables.length;
    }
    if (cards.length > 0) {
      newMetadata.hasCards = true;
      newMetadata.cardCount = cards.length;
    }
    setMetadata(newMetadata);
  }, [location]);

  // Collect Remote app internal state via MFE Context Bridge
  useEffect(() => {
    const collectRemoteState = () => {
      if (!window.dwpContextProvider) {
        setRemoteState({});
        return;
      }

      const state: Record<string, any> = {};

      // Get general context
      if (window.dwpContextProvider.getContext) {
        try {
          const context = window.dwpContextProvider.getContext();
          if (context) {
            state.context = context;
          }
        } catch (e) {
          console.warn('Failed to get remote context:', e);
        }
      }

      // Get selected items (e.g., selected mail items, grid selections)
      if (window.dwpContextProvider.getSelectedItems) {
        try {
          const selectedItems = window.dwpContextProvider.getSelectedItems();
          if (selectedItems && selectedItems.length > 0) {
            state.selectedItems = selectedItems;
            state.selectedCount = Array.isArray(selectedItems) ? selectedItems.length : 1;
          }
        } catch (e) {
          console.warn('Failed to get selected items:', e);
        }
      }

      // Get view state (e.g., current view mode, filters, sort order)
      if (window.dwpContextProvider.getViewState) {
        try {
          const viewState = window.dwpContextProvider.getViewState();
          if (viewState) {
            state.viewState = viewState;
          }
        } catch (e) {
          console.warn('Failed to get view state:', e);
        }
      }

      setRemoteState(state);
    };

    // Collect immediately and on location change
    collectRemoteState();

    // Also collect periodically to catch dynamic changes (e.g., user selections)
    const interval = setInterval(collectRemoteState, 1000);
    return () => clearInterval(interval);
  }, [location]);

  return {
    url: window.location.href,
    path,
    title,
    activeApp,
    itemId: /^\d+$/.test(itemId) || /^[a-f\d]{24}$/i.test(itemId) ? itemId : undefined,
    metadata,
    remoteState: Object.keys(remoteState).length > 0 ? remoteState : undefined,
  };
};
