export function shouldScheduleWorkMobileFocusScroll({
  availableWidth,
  pointerActive,
  target,
  container,
}: {
  availableWidth: number;
  pointerActive: boolean;
  target: EventTarget | null;
  container: HTMLElement;
}): boolean {
  return (
    availableWidth < 900 &&
    !pointerActive &&
    target instanceof HTMLElement &&
    target !== container &&
    container.contains(target)
  );
}
