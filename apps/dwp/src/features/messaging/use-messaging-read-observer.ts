import { useEffect } from 'react';
import { recordMessagingReadReceipts } from '@dwp-frontend/shared-utils';

import type { RefObject } from 'react';
import type { MessagingMessage } from '@dwp-frontend/shared-utils';

export function messagingReadSurfaceVisible(root: HTMLElement, node: HTMLElement) {
  if (
    document.visibilityState !== 'visible' ||
    !document.hasFocus() ||
    root.closest('[aria-hidden="true"]')
  )
    return false;
  const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
  if (modal && !modal.contains(root)) return false;
  const box = node.getBoundingClientRect();
  const frame = root.getBoundingClientRect();
  const height =
    Math.min(box.bottom, frame.bottom, window.innerHeight) - Math.max(box.top, frame.top, 0);
  const width =
    Math.min(box.right, frame.right, window.innerWidth) - Math.max(box.left, frame.left, 0);
  return (
    height >= Math.min(box.height * 0.5, 120) &&
    height > 0 &&
    width >= Math.min(box.width * 0.5, 120) &&
    width > 0
  );
}

/** Read observations are independent of the conversation cursor, especially for unopened replies. */
export function useMessagingReadObserver(
  rootRef: RefObject<HTMLDivElement | null>,
  conversationId: string | undefined,
  messages: MessagingMessage[],
  currentUserId?: number,
  enabled = true
) {
  const ids = messages
    .filter(
      (message) =>
        message.senderUserId !== currentUserId &&
        message.messageKind === 'USER' &&
        !message.deletedAt
    )
    .map((message) => message.messageId)
    .join(',');
  useEffect(() => {
    const root = rootRef.current;
    if (
      !enabled ||
      !conversationId ||
      !root ||
      !ids ||
      currentUserId === undefined ||
      typeof IntersectionObserver === 'undefined'
    )
      return;
    const allowed = new Set(ids.split(','));
    const nodes = new Map<string, HTMLElement>();
    root.querySelectorAll<HTMLElement>('[data-msg-receipt-id]').forEach((node) => {
      const id = node.dataset.msgReceiptId;
      if (id && allowed.has(id)) nodes.set(id, node);
    });
    const confirmed = new Set<string>();
    const pending = new Set<string>();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let busy = false;
    const schedule = () => {
      if (disposed) return;
      for (const [id, node] of nodes) {
        if (!confirmed.has(id) && !pending.has(id) && messagingReadSurfaceVisible(root, node)) {
          if (!timers.has(id))
            timers.set(
              id,
              setTimeout(() => {
                timers.delete(id);
                if (messagingReadSurfaceVisible(root, node)) {
                  pending.add(id);
                  clearTimeout(flushTimer);
                  flushTimer = setTimeout(() => void flush(), 100);
                }
              }, 650)
            );
        } else {
          clearTimeout(timers.get(id));
          timers.delete(id);
        }
      }
    };
    const flush = async () => {
      if (disposed || busy || pending.size === 0) return;
      const batch = [...pending]
        .filter((id) => messagingReadSurfaceVisible(root, nodes.get(id)!))
        .slice(0, 50);
      pending.clear();
      if (!batch.length) return;
      busy = true;
      try {
        await recordMessagingReadReceipts(conversationId, batch);
        batch.forEach((id) => confirmed.add(id));
      } catch {
        // A failed observation remains unconfirmed; retry only while the view is actually visible.
      } finally {
        busy = false;
        if (!disposed) {
          if (pending.size) flushTimer = setTimeout(() => void flush(), 100);
          retryTimer = setTimeout(schedule, 5_000);
        }
      }
    };
    const observer = new IntersectionObserver(schedule, { root, threshold: [0, 0.1, 0.5, 1] });
    nodes.forEach((node) => observer.observe(node));
    root.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('focus', schedule);
    window.addEventListener('blur', schedule);
    document.addEventListener('visibilitychange', schedule);
    schedule();
    return () => {
      disposed = true;
      observer.disconnect();
      timers.forEach(clearTimeout);
      clearTimeout(flushTimer);
      clearTimeout(retryTimer);
      root.removeEventListener('scroll', schedule);
      window.removeEventListener('focus', schedule);
      window.removeEventListener('blur', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [conversationId, currentUserId, enabled, ids, rootRef]);
}
