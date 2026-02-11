/**
 * 백엔드 웹소켓 연결 — 실시간 알림 수신
 * 수신 시 notification-store에 추가 + showToast
 */

import { useRef, useEffect } from 'react';

import { NX_API_URL } from '../env';
import { showToast } from '../toast/toast-store';
import { useNotificationStore, type NotificationCategory } from './notification-store';

// ----------------------------------------------------------------------

/** 백엔드 웹소켓 URL (환경변수 NX_WS_URL 또는 NX_API_URL 기반) */
function getNotificationsWsUrl(): string {
  const base = typeof process !== 'undefined' && process.env?.NX_WS_URL
    ? process.env.NX_WS_URL
    : NX_API_URL.replace(/^http/, 'ws');
  const path = base.endsWith('/') ? 'ws/notifications' : '/ws/notifications';
  return base.includes('/ws') ? base : `${base}${path}`;
}

/** 백엔드 NotificationDto (back.txt 4.3) — id, tenantId, title, content, type, channel, occurredAt, createdAt, readAt, payload */
type IncomingNotificationPayload = {
  id?: string;
  tenantId?: string;
  category?: string;
  type?: string;
  title?: string;
  /** BE 필드명: content (메시지 본문) */
  content?: string;
  message?: string;
  body?: string;
  link?: string;
  channel?: string;
  occurredAt?: string;
  createdAt?: string;
  readAt?: string | null;
  payload?: Record<string, unknown>;
};

/**
 * 백엔드 type/category → NotificationCategory (상단 알림 바 아이콘·색상 1:1 매핑)
 * BE type 예: AI_DETECT, TRAINING_COMPLETE, APPROVAL_COMPLETE 등 — 대소문자 무시 후 매칭
 */
function normalizeCategory(cat: string | undefined): NotificationCategory {
  const c = (cat ?? '').toLowerCase().trim();
  // 위험/이상 징후 (AI_DETECT 등 → 위험 아이콘·색상)
  if (
    c === 'anomaly_detected' ||
    c === 'anomaly' ||
    c === 'danger' ||
    c === 'risk' ||
    c === 'ai_detect' ||
    c === 'detect'
  )
    return 'anomaly_detected';
  // 학습 완료
  if (
    c === 'training_complete' ||
    c === 'training' ||
    c === 'learning' ||
    c === 'learned' ||
    c === 'rag_learned'
  )
    return 'training_complete';
  // 조치/승인 완료
  if (
    c === 'approval_complete' ||
    c === 'approval' ||
    c === 'action' ||
    c === 'action_complete' ||
    c === 'hitl_approved' ||
    c === 'hitl_rejected'
  )
    return 'approval_complete';
  if (c === 'warning') return 'warning';
  if (c === 'error') return 'error';
  return 'info';
}

export type UseNotificationWebSocketOptions = {
  enabled?: boolean;
  wsUrl?: string;
  onOpen?: () => void;
  onClose?: () => void;
  showToastOnReceive?: boolean;
};

/**
 * 실시간 알림 웹소켓 훅
 * - enabled: true일 때만 연결
 * - 수신 메시지를 store에 추가하고, showToastOnReceive 시 토스트 표시
 */
export function useNotificationWebSocket(options: UseNotificationWebSocketOptions = {}) {
  const {
    enabled = true,
    wsUrl,
    onOpen,
    onClose,
    showToastOnReceive = true,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const addNotification = useNotificationStore((s) => s.add);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = wsUrl ?? getNotificationsWsUrl();

  useEffect(() => {
    if (!enabled || typeof WebSocket === 'undefined') return undefined;

    const connect = () => {
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          onOpen?.();
        };

        ws.onmessage = (event: MessageEvent) => {
          try {
            const raw = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            const payload = raw as IncomingNotificationPayload;
            const title = payload.title ?? payload.type ?? 'Notification';
            const message = payload.content ?? payload.message ?? payload.body ?? '';
            const category = normalizeCategory(payload.category ?? payload.type);

            addNotification({
              id: payload.id,
              category,
              title,
              message,
              link: payload.link,
            });

            if (showToastOnReceive) {
              showToast(
                `${title}${message ? ` — ${message}` : ''}`,
                'success',
                undefined,
                { anchorOrigin: { vertical: 'top', horizontal: 'right' } }
              );
            }
          } catch {
            // ignore parse error
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
          onClose?.();
          // optional: reconnect after delay
          reconnectTimeoutRef.current = setTimeout(() => {
            if (enabled) connect();
          }, 3000);
        };

        ws.onerror = () => {
          // close will follow
        };
      } catch {
        if (reconnectTimeoutRef.current == null) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (enabled) connect();
          }, 5000);
        }
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, url, addNotification, showToastOnReceive, onOpen, onClose]);

  return { url };
}
