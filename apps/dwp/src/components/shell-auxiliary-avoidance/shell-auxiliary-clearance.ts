export type ShellAuxiliaryRect = Readonly<{
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}>;

export type ShellAuxiliaryGeometry = Readonly<{
  rect: ShellAuxiliaryRect;
  placement?: string;
  edge?: string;
}>;

export function resolveShellAuxiliaryInlineClearance(
  target: ShellAuxiliaryRect,
  auxiliary: ShellAuxiliaryGeometry | undefined,
  safetyGap = 16
): number {
  if (
    auxiliary?.placement !== 'floating' ||
    !auxiliary.edge?.split(/\s+/).includes('inline-end') ||
    auxiliary.rect.width <= 0 ||
    auxiliary.rect.height <= 0 ||
    target.width <= 0 ||
    target.height <= 0
  ) {
    return 0;
  }

  const intersectsInlineLane =
    target.right > auxiliary.rect.left - safetyGap &&
    target.left < auxiliary.rect.right + safetyGap;
  const intersectsBlockLane =
    target.bottom > auxiliary.rect.top - safetyGap &&
    target.top < auxiliary.rect.bottom + safetyGap;
  if (!intersectsInlineLane || !intersectsBlockLane) return 0;

  return Math.max(0, Math.ceil(target.right - auxiliary.rect.left + safetyGap));
}
