export type MessagingTimelineScrollAnchor = Readonly<{
  messageId: string | null;
  viewportTop: number | null;
  scrollHeight: number;
}>;

function timelineMessageNodes(scroller: HTMLElement): HTMLElement[] {
  return Array.from(scroller.querySelectorAll<HTMLElement>('[data-msg-receipt-id]'));
}

function timelineMessageAnchor(node: HTMLElement): HTMLElement {
  return node.querySelector<HTMLElement>('[data-msg-scroll-anchor]') ?? node;
}

export function captureMessagingTimelineScrollAnchor(
  scroller: HTMLElement
): MessagingTimelineScrollAnchor {
  const scrollerRect = scroller.getBoundingClientRect();
  const nodes = timelineMessageNodes(scroller);
  const retained =
    nodes.find((node) => {
      const rect = node.getBoundingClientRect();
      return rect.bottom >= scrollerRect.top && rect.top <= scrollerRect.bottom;
    }) ?? nodes[0];

  return {
    messageId: retained?.dataset.msgReceiptId ?? null,
    viewportTop: retained ? timelineMessageAnchor(retained).getBoundingClientRect().top : null,
    scrollHeight: scroller.scrollHeight,
  };
}

export function restoreMessagingTimelineScrollAnchor(
  scroller: HTMLElement,
  anchor: MessagingTimelineScrollAnchor
): number {
  const retained = anchor.messageId
    ? timelineMessageNodes(scroller).find((node) => node.dataset.msgReceiptId === anchor.messageId)
    : undefined;
  const offset =
    retained && anchor.viewportTop !== null
      ? timelineMessageAnchor(retained).getBoundingClientRect().top - anchor.viewportTop
      : scroller.scrollHeight - anchor.scrollHeight;

  if (Number.isFinite(offset) && Math.abs(offset) > 0.01) scroller.scrollTop += offset;
  return offset;
}

export function stabilizeMessagingTimelineScrollAnchor(
  scroller: HTMLElement,
  anchor: MessagingTimelineScrollAnchor
): () => void {
  let secondFrame: number | undefined;
  restoreMessagingTimelineScrollAnchor(scroller, anchor);
  const firstFrame = requestAnimationFrame(() => {
    restoreMessagingTimelineScrollAnchor(scroller, anchor);
    secondFrame = requestAnimationFrame(() => {
      restoreMessagingTimelineScrollAnchor(scroller, anchor);
    });
  });

  return () => {
    cancelAnimationFrame(firstFrame);
    if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
  };
}
