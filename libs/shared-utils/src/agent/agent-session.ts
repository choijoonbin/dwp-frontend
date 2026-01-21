// ----------------------------------------------------------------------

/**
 * Agent Session ID Management
 * 
 * Generates and manages unique agent session IDs for Aura AI agent requests.
 * Session ID is maintained throughout the agent session lifecycle.
 */

// Session storage key for agent session ID
const AGENT_SESSION_STORAGE_KEY = 'dwp-agent-session-id';

/**
 * Generate a unique agent session ID
 * Format: agent_session_{timestamp}_{random}
 */
function generateAgentSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `agent_session_${timestamp}_${random}`;
}

/**
 * Get or create agent session ID
 * - If session ID exists in sessionStorage, reuse it
 * - Otherwise, generate a new one and store it
 * 
 * Session ID persists for the browser session (until tab/window closes)
 */
export function getAgentSessionId(): string {
  if (typeof window === 'undefined') {
    // Server-side: generate a new ID each time
    return generateAgentSessionId();
  }

  // Check sessionStorage for existing session ID
  const storedId = sessionStorage.getItem(AGENT_SESSION_STORAGE_KEY);
  if (storedId) {
    return storedId;
  }

  // Generate new session ID and store it
  const newId = generateAgentSessionId();
  sessionStorage.setItem(AGENT_SESSION_STORAGE_KEY, newId);
  return newId;
}

/**
 * Clear agent session ID
 * Call this when agent session ends
 */
export function clearAgentSessionId(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(AGENT_SESSION_STORAGE_KEY);
  }
}

/**
 * Check if agent session ID exists
 */
export function hasAgentSessionId(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return sessionStorage.getItem(AGENT_SESSION_STORAGE_KEY) !== null;
}
