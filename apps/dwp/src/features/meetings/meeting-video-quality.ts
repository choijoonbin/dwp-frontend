/** Browser capability gate shared by preferences, preview, and LiveKit capture. */
export function isMeetingHdVideoSupported() {
  try {
    if (typeof navigator === 'undefined') return false;
    const constraints = navigator.mediaDevices?.getSupportedConstraints?.();
    return Boolean(constraints?.width && constraints.height);
  } catch {
    return false;
  }
}

/** A stale preference must never force unsupported capture constraints. */
export function resolveMeetingHdVideo(requested: boolean) {
  return requested && isMeetingHdVideoSupported();
}
