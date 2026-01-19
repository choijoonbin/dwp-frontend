// ----------------------------------------------------------------------

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

/**
 * Gathers the current context of the application for the AI agent.
 * Includes Remote app internal state via MFE Context Bridge.
 */
export const getAgentContext = () => {
  const path = window.location.pathname;
  
  // Extract remote app name from path if possible (e.g., /mail -> mail)
  const segments = path.split('/').filter(Boolean);
  const activeApp = segments[0] || 'dashboard';

  // Try to find specific item IDs in the URL (e.g., /mail/inbox/123 -> 123)
  const lastSegment = segments[segments.length - 1];
  const itemId = /^\d+$/.test(lastSegment) || /^[a-f\d]{24}$/i.test(lastSegment) ? lastSegment : undefined;

  // Collect Remote app internal state via MFE Context Bridge
  let remoteState: Record<string, any> | undefined;
  if (window.dwpContextProvider) {
    try {
      const state: Record<string, any> = {};
      
      if (window.dwpContextProvider.getContext) {
        const context = window.dwpContextProvider.getContext();
        if (context) state.context = context;
      }
      
      if (window.dwpContextProvider.getSelectedItems) {
        const selectedItems = window.dwpContextProvider.getSelectedItems();
        if (selectedItems && (Array.isArray(selectedItems) ? selectedItems.length > 0 : true)) {
          state.selectedItems = selectedItems;
          state.selectedCount = Array.isArray(selectedItems) ? selectedItems.length : 1;
        }
      }
      
      if (window.dwpContextProvider.getViewState) {
        const viewState = window.dwpContextProvider.getViewState();
        if (viewState) state.viewState = viewState;
      }
      
      if (Object.keys(state).length > 0) {
        remoteState = state;
      }
    } catch (e) {
      console.warn('Failed to collect remote state:', e);
    }
  }

  const context = {
    activeApp,
    path,
    pathname: path, // 명세에 맞춰 pathname 필드 추가
    itemId,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    language: navigator.language,
    ...(remoteState && { remoteState }),
  };

  // 디버깅: context 객체 로깅 (개발 환경에서만)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Aura Context]', {
      endpoint: '/api/aura/test/stream',
      context,
      url: window.location.href,
    });
  }

  return context;
};
