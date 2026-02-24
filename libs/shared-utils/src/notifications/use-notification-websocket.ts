/**
 * 백엔드 웹소켓 연결 — SockJS + STOMP /topic/notifications 구독으로 실시간 알림 수신
 * 수신 시 notification-store에 추가 + showToast
 *
 * 백엔드: SockJS 엔드포인트만 노출. SimpMessagingTemplate.convertAndSend("/topic/notifications", dto)
 * @see docs/api-spec/synapse-spec/NOTIFICATIONS_BACKEND_RESULT.md
 */

import SockJS from 'sockjs-client';
import { useRef, useEffect, useState } from 'react';
import { Client, type IMessage } from '@stomp/stompjs';

import { NX_API_URL } from '../env';
import { getTenantId } from '../tenant-util';
import { getAccessToken } from '../auth/token-storage';
import { showToast } from '../toast/toast-store';
import { useNotificationStore, type NotificationCategory } from './notification-store';

// ----------------------------------------------------------------------

/** SockJS 엔드포인트 URL (HTTP/HTTPS, BE는 SockJS만 지원)
 * - 기본 경로: /ws/notifications (BE와 동기화 필요)
 * - Gateway 프록시가 /api/synapse/ws-notifications 인 경우: NX_WS_NOTIFICATIONS_PATH=/api/synapse/ws-notifications 또는 VITE_WS_NOTIFICATIONS_PATH 설정
 */
function getNotificationsEndpointUrl(): string {
  const base =
    typeof process !== 'undefined' && process.env?.NX_WS_URL
      ? process.env.NX_WS_URL
      : NX_API_URL;
  const baseHttp = base.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:').replace(/\/$/, '');
  const pathFromEnv =
    (typeof process !== 'undefined' && process.env?.NX_WS_NOTIFICATIONS_PATH) ||
    (typeof import.meta !== 'undefined' &&
      (import.meta.env as { VITE_WS_NOTIFICATIONS_PATH?: string }).VITE_WS_NOTIFICATIONS_PATH);
  const path = pathFromEnv
    ? (pathFromEnv.startsWith('/') ? pathFromEnv : `/${pathFromEnv}`)
    : '/ws/notifications';
  return `${baseHttp}${path}`;
}

/** 백엔드 NotificationDto — id/tenantId/userId는 Java Long → JSON number */
type IncomingNotificationPayload = {
  id?: string | number;
  tenantId?: string | number;
  userId?: string | number;
  category?: string;
  type?: string;
  title?: string;
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
 * BE type 예: CASE_ACTION, ANALYSIS_STARTED, AI_DETECT 등 — 대소문자 무시 후 매칭
 */
function normalizeCategory(cat: string | undefined): NotificationCategory {
  const c = (cat ?? '').toLowerCase().trim();
  if (
    c === 'anomaly_detected' ||
    c === 'anomaly' ||
    c === 'danger' ||
    c === 'risk' ||
    c === 'ai_detect' ||
    c === 'detect'
  )
    return 'anomaly_detected';
  if (
    c === 'training_complete' ||
    c === 'training' ||
    c === 'learning' ||
    c === 'learned' ||
    c === 'rag_learned'
  )
    return 'training_complete';
  if (
    c === 'approval_complete' ||
    c === 'approval' ||
    c === 'action' ||
    c === 'action_complete' ||
    c === 'hitl_approved' ||
    c === 'hitl_rejected' ||
    c === 'case_action'
  )
    return 'approval_complete';
  if (c === 'analysis_started') return 'info';
  if (c === 'rag_status' || c === 'rag') return 'training_complete';
  if (c === 'warning') return 'warning';
  if (c === 'error') return 'error';
  if (c === 'generic' || c === 'unknown') return 'info';
  return 'info';
}

export type UseNotificationWebSocketOptions = {
  enabled?: boolean;
  wsUrl?: string;
  /** STOMP 구독 경로. BE와 동기화 필요. 기본 /topic/notifications */
  topicSubscriptionPath?: string;
  /** true이면 /topic/notifications/{tenantId} 구독 (BE가 테넌트별 경로로 브로드캐스트할 때 사용) */
  subscribeByTenant?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  /** 알림 수신 시 호출 (워크벤치 스트림 등 다른 쿼리 무효화용) */
  onReceive?: (payload: IncomingNotificationPayload) => void;
  showToastOnReceive?: boolean;
};

const NOTIFICATIONS_TOPIC_DEFAULT = '/topic/notifications';
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * 실시간 알림 웹소켓 훅 (STOMP)
 * - enabled: true일 때만 연결
 * - /topic/notifications 구독 후 수신 메시지를 store에 추가, showToastOnReceive 시 토스트 표시
 */
export function useNotificationWebSocket(options: UseNotificationWebSocketOptions = {}) {
  const {
    enabled = true,
    wsUrl,
    topicSubscriptionPath = NOTIFICATIONS_TOPIC_DEFAULT,
    subscribeByTenant = false,
    onOpen,
    onClose,
    onReceive,
    showToastOnReceive = true,
  } = options;

  const clientRef = useRef<Client | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addNotification = useNotificationStore((s) => s.add);
  const endpointUrl = wsUrl ?? getNotificationsEndpointUrl();
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'>('idle');

  useEffect(() => {
    if (!enabled) return undefined;
    reconnectCountRef.current = 0;
    const currentTenantId = getTenantId();
    const effectiveTopic =
      subscribeByTenant && currentTenantId
        ? `/topic/notifications/${currentTenantId}`
        : topicSubscriptionPath;
    const isDev =
      (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) ||
      process.env.NODE_ENV === 'development';

    const getConnectHeaders = () => {
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      return headers;
    };

    setConnectionStatus('connecting');
    if (isDev) {
      console.log('[Notification WS] activating', {
        endpointUrl,
        topic: effectiveTopic,
        subscribeByTenant,
        tenantId: currentTenantId ?? undefined,
      });
    }

    const client = new Client({
      webSocketFactory: () => {
        if (isDev) console.log('[Notification WS] creating SockJS transport', { endpointUrl });
        return new SockJS(endpointUrl, undefined, {
          /** iframe 등 구식 transport 제외 → iframe.html 404 시도 방지 */
          transports: ['websocket', 'xhr-streaming'],
        }) as unknown as WebSocket;
      },
      connectHeaders: getConnectHeaders(),
      reconnectDelay: 2147483647,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      connectionTimeout: 8000,
      onConnect: () => {
        reconnectCountRef.current = 0;
        setConnectionStatus('connected');
        if (isDev) console.log('[Notification WS] connected', { endpointUrl, topic: effectiveTopic });
        onOpen?.();
        const sub = client.subscribe(effectiveTopic, (message: IMessage) => {
          try {
            const body = message.body;
            if (!body || typeof body !== 'string') return;
            const raw = JSON.parse(body) as IncomingNotificationPayload;
            const logPayload =
              isDev ||
              (typeof import.meta !== 'undefined' &&
                (import.meta.env as { VITE_NOTIFICATION_WS_LOG_PAYLOAD?: string }).VITE_NOTIFICATION_WS_LOG_PAYLOAD === 'true');
            if (logPayload) {
              console.log('[Notification WS] received payload', raw);
            }
            const cat = (raw.category ?? '').toString().toUpperCase();
            const typ = (raw.type ?? '').toString().toUpperCase();
            const pl = raw.payload as Record<string, unknown> | undefined;
            const caseIdFromPl =
              pl?.case_id != null ? String(pl.case_id) : pl?.caseId != null ? String(pl.caseId) : undefined;
            if (isDev) {
              console.log('[Notification WS] Received:', { type: typ, category: cat, caseId: caseIdFromPl, tenantId: raw.tenantId });
              console.log('[Notification WS] received', {
                category: cat,
                type: typ,
                caseId: caseIdFromPl,
                tenantId: raw.tenantId,
                payloadKeys: pl ? Object.keys(pl) : [],
              });
            }
            if (currentTenantId && raw.tenantId != null && String(raw.tenantId) !== currentTenantId) {
              if (isDev) console.log('[Notification WS] skipped (tenant mismatch)');
              return;
            }

            const isThoughtStream = cat === 'THOUGHT_STREAM' || typ === 'THOUGHT_STREAM';

            if (isThoughtStream) {
              if (isDev) console.log('[Notification WS] THOUGHT_STREAM → onReceive only (no toast)');
              onReceive?.(raw);
              return;
            }

            const title = raw.title ?? raw.type ?? 'Notification';
            const messageText = raw.content ?? raw.message ?? raw.body ?? '';
            const category = normalizeCategory(raw.category ?? raw.type);
            const id = raw.id != null ? String(raw.id) : undefined;

            addNotification({
              id,
              category,
              title,
              message: messageText,
              link: raw.link,
            });

            onReceive?.(raw);

            if (showToastOnReceive) {
              const isCaseCreated =
                cat === 'CASE_ACTION' ||
                typ === 'CASE_ACTION' ||
                (raw.payload as { event?: string } | undefined)?.event === 'case_created';
              const toastMessage = isCaseCreated
                ? '🚨 새로운 위반 의심 케이스 탐지! Aura가 분석을 시작합니다.'
                : `${title}${messageText ? ` — ${messageText}` : ''}`;
              showToast(toastMessage, 'success', undefined, {
                anchorOrigin: { vertical: 'top', horizontal: 'right' },
              });
            }
          } catch {
            // ignore parse error
          }
        });
        subscriptionRef.current = sub;
      },
      onWebSocketClose: (ev) => {
        setConnectionStatus('disconnected');
        if (isDev) {
          console.log('[Notification WS] websocket closed', {
            code: ev.code,
            reason: ev.reason,
            wasClean: ev.wasClean,
            reconnectCount: reconnectCountRef.current,
            maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
          });
        }
        subscriptionRef.current?.unsubscribe();
        subscriptionRef.current = null;
        onClose?.();
        if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
          void client.deactivate();
          return;
        }
        reconnectCountRef.current += 1;
        const delayMs = Math.min(
          INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectCountRef.current - 1),
          MAX_RECONNECT_DELAY_MS,
        );
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          setConnectionStatus('connecting');
          Object.assign(client.connectHeaders, getConnectHeaders());
          if (isDev) console.log('[Notification WS] exponential backoff reconnect', { attempt: reconnectCountRef.current, delayMs });
          client.activate();
        }, delayMs);
      },
      onWebSocketError: (ev) => {
        setConnectionStatus('error');
        if (isDev) console.log('[Notification WS] websocket error', ev);
      },
      onStompError: (frame) => {
        setConnectionStatus('error');
        if (isDev) {
          console.log('[Notification WS] STOMP error', {
            headers: frame.headers,
            body: frame.body?.slice(0, 500),
          });
        }
        // broker error; connection may close and trigger reconnect
      },
    });

    client.activate();
    if (isDev) console.log('[Notification WS] client.activate() called');
    clientRef.current = client;

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setConnectionStatus('idle');
      if (isDev) console.log('[Notification WS] cleanup: unsubscribe + deactivate');
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
      clientRef.current = null;
      void client.deactivate();
    };
  }, [enabled, endpointUrl, topicSubscriptionPath, subscribeByTenant, addNotification, showToastOnReceive, onOpen, onClose, onReceive]);

  return { url: endpointUrl, connectionStatus };
}
