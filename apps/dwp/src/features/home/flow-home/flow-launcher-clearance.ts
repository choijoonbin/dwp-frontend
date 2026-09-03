export type FlowLauncherRect = Readonly<{
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}>;

export function resolveFlowLauncherClearance(
  widget: FlowLauncherRect,
  launcher: FlowLauncherRect | undefined,
  placement: string | undefined,
  clearance = 16
): number {
  if (
    placement !== 'floating' ||
    !launcher ||
    launcher.width <= 0 ||
    launcher.height <= 0 ||
    widget.width <= 0 ||
    widget.height <= 0
  ) {
    return 0;
  }

  // The safety gap belongs to the clearance applied *after* a collision.
  // Expanding the hit area by that gap makes a nearby launcher reserve space
  // before it touches the widget, leaving a permanent-looking empty gutter.
  const intersectsInlineLane = widget.right > launcher.left && widget.left < launcher.right;
  const intersectsBlockLane = widget.bottom > launcher.top && widget.top < launcher.bottom;
  if (!intersectsInlineLane || !intersectsBlockLane) return 0;

  return Math.max(0, Math.ceil(widget.right - launcher.left + clearance));
}
