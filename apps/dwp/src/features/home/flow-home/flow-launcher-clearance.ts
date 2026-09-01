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

  const intersectsInlineLane =
    widget.right > launcher.left - clearance && widget.left < launcher.right + clearance;
  const intersectsBlockLane =
    widget.bottom > launcher.top - clearance && widget.top < launcher.bottom + clearance;
  if (!intersectsInlineLane || !intersectsBlockLane) return 0;

  return Math.max(0, Math.ceil(widget.right - launcher.left + clearance));
}
