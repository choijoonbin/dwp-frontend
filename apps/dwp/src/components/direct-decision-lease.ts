export type DirectDecisionClockAnchor = Readonly<{
  serverNowMs: number;
  monotonicNowMs: number;
}>;

const MAX_TIMER_DELAY_MS = 2_147_000_000;
const MAX_RENEW_LEAD_MS = 5_000;
const MIN_RENEW_LEAD_MS = 100;

export function readMonotonicNowMs(): number {
  return globalThis.performance?.now() ?? 0;
}

export function createDirectDecisionClockAnchor(
  clockOffsetMs: number,
  wallNowMs = Date.now(),
  monotonicNowMs = readMonotonicNowMs()
): DirectDecisionClockAnchor {
  return {
    serverNowMs: wallNowMs + clockOffsetMs,
    monotonicNowMs,
  };
}

export function directDecisionServerNow(
  anchor: DirectDecisionClockAnchor,
  monotonicFloorMs = anchor.monotonicNowMs,
  monotonicNowMs = readMonotonicNowMs()
): number {
  return (
    anchor.serverNowMs +
    Math.max(0, Math.max(monotonicFloorMs, monotonicNowMs) - anchor.monotonicNowMs)
  );
}

function renewLeadMs(remainingMs: number): number {
  if (remainingMs <= 1) return 0;
  return Math.min(
    MAX_RENEW_LEAD_MS,
    Math.max(MIN_RENEW_LEAD_MS, Math.floor(remainingMs / 4)),
    remainingMs - 1
  );
}

function scheduleAtMonotonicInstant(monotonicInstantMs: number, callback: () => void): () => void {
  let timer: number | undefined;
  let cancelled = false;
  const schedule = () => {
    if (cancelled) return;
    const remainingMs = monotonicInstantMs - readMonotonicNowMs();
    timer = window.setTimeout(
      () => {
        if (cancelled) return;
        if (monotonicInstantMs > readMonotonicNowMs()) {
          schedule();
          return;
        }
        callback();
      },
      Math.min(Math.max(0, remainingMs), MAX_TIMER_DELAY_MS)
    );
  };
  schedule();
  return () => {
    cancelled = true;
    if (timer !== undefined) window.clearTimeout(timer);
  };
}

export function scheduleDirectDecisionLease({
  anchor,
  serverDeadlineMs,
  onRenew,
  onExpire,
}: {
  anchor: DirectDecisionClockAnchor;
  serverDeadlineMs: number;
  onRenew: () => void;
  onExpire: () => void;
}): () => void {
  if (!Number.isFinite(serverDeadlineMs)) return () => undefined;
  const expiryMonotonicMs = anchor.monotonicNowMs + (serverDeadlineMs - anchor.serverNowMs);
  const remainingMs = expiryMonotonicMs - readMonotonicNowMs();
  // An already expired response is mapped fail-closed by the caller. Do not auto-refetch it:
  // a server that keeps returning distinct past timestamps must not create a zero-delay loop.
  if (remainingMs <= 0) return () => undefined;
  const renewMonotonicMs = expiryMonotonicMs - renewLeadMs(remainingMs);
  const cancelRenew = scheduleAtMonotonicInstant(renewMonotonicMs, onRenew);
  const cancelExpiry = scheduleAtMonotonicInstant(expiryMonotonicMs, onExpire);
  return () => {
    cancelRenew();
    cancelExpiry();
  };
}
