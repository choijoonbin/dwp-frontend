// ----------------------------------------------------------------------

/**
 * SSE Stream Status Types
 * 
 * Standard status model for Aura SSE streaming connections.
 * Used across Host and Remote apps for consistent UX.
 */

/**
 * Stream connection status
 */
export type StreamStatus = 
  | 'IDLE'           // Initial state, no active stream
  | 'CONNECTING'     // Establishing connection
  | 'STREAMING'      // Actively receiving data
  | 'RECONNECTING'   // Attempting to reconnect after failure
  | 'COMPLETED'      // Stream completed successfully ([DONE] received)
  | 'ABORTED'        // User cancelled or component unmounted
  | 'ERROR';         // Connection/parsing error

/**
 * Debug information for stream monitoring (dev only)
 * Does NOT include sensitive data (tokens, etc.)
 */
export type StreamDebugInfo = {
  endpoint: string;           // e.g., "/api/aura/test/stream"
  retryCount: number;         // Current reconnection attempt (0-based)
  lastEventId?: string;      // Last-Event-ID for reconnection
  lastEventType?: string;    // Last SSE event type received
  recentEventTypes: string[]; // Last 10 event types (for debugging)
  startedAt?: Date;          // Stream start timestamp
  completedAt?: Date;        // Stream completion timestamp
  errorMessage?: string;     // Error message (if status is ERROR)
  /** Aura failed event: true면 재시도 가능 표시, false면 생략 가능 (Aura §13) */
  retryable?: boolean;
  /** Aura failed event: error 객체의 stage (rag/llm 등), 재시도 안내 문구 차별화용 (선택) */
  failedStage?: string;
};

/**
 * Stream status with debug info
 */
export type StreamState = {
  status: StreamStatus;
  debug: StreamDebugInfo;
};
