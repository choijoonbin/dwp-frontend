import type { Locator } from '@playwright/test';

type WorkspaceSurfaceGap = Readonly<{
  actual: number;
  expected: number;
  leftKey: string;
  rightKey: string;
}>;

export async function readHorizontalWorkspaceSurfaceGaps(
  canvas: Locator
): Promise<WorkspaceSurfaceGap[]> {
  return canvas.evaluate((element) => {
    const columnGap = Number.parseFloat(window.getComputedStyle(element).columnGap);
    const widgets = Array.from(element.querySelectorAll<HTMLElement>('[data-workspace-widget]'))
      .map((widget) => {
        const surface = widget.querySelector<HTMLElement>(
          ':scope > [data-workspace-widget-content] > section'
        );
        if (!surface) return null;
        const widgetBounds = widget.getBoundingClientRect();
        const surfaceBounds = surface.getBoundingClientRect();
        const style = window.getComputedStyle(widget);
        return {
          key: widget.dataset.workspaceWidget ?? '',
          widgetBounds: {
            left: widgetBounds.left,
            right: widgetBounds.right,
            top: widgetBounds.top,
          },
          surfaceBounds: { left: surfaceBounds.left, right: surfaceBounds.right },
          paddingLeft: Number.parseFloat(style.paddingLeft),
          paddingRight: Number.parseFloat(style.paddingRight),
        };
      })
      .filter((widget): widget is NonNullable<typeof widget> => widget !== null);

    return widgets.flatMap((left) => {
      const right = widgets
        .filter(
          (candidate) =>
            candidate.widgetBounds.left >= left.widgetBounds.right - 1 &&
            Math.abs(candidate.widgetBounds.top - left.widgetBounds.top) < 2
        )
        .sort((first, second) => first.widgetBounds.left - second.widgetBounds.left)[0];
      if (!right) return [];
      return [
        {
          actual: right.surfaceBounds.left - left.surfaceBounds.right,
          expected: columnGap + left.paddingRight + right.paddingLeft,
          leftKey: left.key,
          rightKey: right.key,
        },
      ];
    });
  });
}
