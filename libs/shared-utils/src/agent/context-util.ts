// ----------------------------------------------------------------------

/**
 * Gathers the current context of the application for the AI agent.
 */
export const getAgentContext = () => {
  const path = window.location.pathname;
  
  // Extract remote app name from path if possible (e.g., /mail -> mail)
  const segments = path.split('/').filter(Boolean);
  const activeApp = segments[0] || 'dashboard';

  // Try to find specific item IDs in the URL (e.g., /mail/inbox/123 -> 123)
  const lastSegment = segments[segments.length - 1];
  const itemId = /^\d+$/.test(lastSegment) || /^[a-f\d]{24}$/i.test(lastSegment) ? lastSegment : undefined;

  return {
    activeApp,
    path,
    itemId,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    language: navigator.language,
  };
};
