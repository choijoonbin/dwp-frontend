import type { Locator } from '@playwright/test';

/** Measures the separate branded header and app panel as one launch-deck contract. */
export async function measureFlowLaunchDeck(deck: Locator) {
  return deck.evaluate((surface) => {
    const frame = surface;
    const hero = surface.querySelector<HTMLElement>('[data-flow-workscape]')!;
    const context = surface.querySelector<HTMLElement>('[data-flow-hero-surface]')!;
    const copy = surface.querySelector<HTMLElement>('[data-flow-context-copy]')!;
    const dock = surface.querySelector<HTMLElement>('[data-flow-dock-shell]')!;
    const frameBounds = frame.getBoundingClientRect();
    const copyBounds = copy.getBoundingClientRect();
    const dockBounds = dock.getBoundingClientRect();
    const targets = Array.from(surface.querySelectorAll<HTMLElement>('button')).map((target) => {
      const bounds = target.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    });
    const appLabels = Array.from(
      surface.querySelectorAll<HTMLElement>('[data-flow-dock-item] button .MuiTypography-root')
    ).map((label) => ({
      text: label.textContent?.trim() ?? '',
      clipped: label.scrollWidth > label.clientWidth + 1,
    }));
    const appItemBounds = Array.from(
      surface.querySelectorAll<HTMLElement>('[data-flow-dock-item] button')
    ).map((item) => {
      const bounds = item.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
      };
    });
    const groupLabels = Array.from(
      surface.querySelectorAll<HTMLElement>('[data-flow-dock-group-label]')
    )
      .filter((label) => window.getComputedStyle(label).display !== 'none')
      .map((label) => {
        const bounds = label.getBoundingClientRect();
        return {
          text: label.textContent?.trim() ?? '',
          clipped: label.scrollWidth > label.clientWidth + 1,
          bounds: {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            bottom: bounds.bottom,
          },
        };
      });
    const groupSurfaces = Array.from(
      surface.querySelectorAll<HTMLElement>('[data-flow-dock-group]')
    ).map((group) => {
      const bounds = group.getBoundingClientRect();
      const style = window.getComputedStyle(group);
      return {
        id: group.dataset.flowDockGroup,
        display: style.display,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
        borderStyles: [
          style.borderTopStyle,
          style.borderRightStyle,
          style.borderBottomStyle,
          style.borderLeftStyle,
        ],
        borderWidths: [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ].map(Number.parseFloat),
        borderRadius: Number.parseFloat(style.borderTopLeftRadius),
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
      };
    });
    const dockAction = surface
      .querySelector<HTMLElement>('[data-flow-dock-action]')!
      .getBoundingClientRect();
    return {
      frame: {
        left: frameBounds.left,
        right: frameBounds.right,
        width: frameBounds.width,
        center: frameBounds.left + frameBounds.width / 2,
      },
      copy: { left: copyBounds.left, right: copyBounds.right },
      context: {
        left: context.getBoundingClientRect().left,
        right: context.getBoundingClientRect().right,
      },
      dock: {
        left: dockBounds.left,
        right: dockBounds.right,
        width: dockBounds.width,
        center: dockBounds.left + dockBounds.width / 2,
        background: window.getComputedStyle(dock).backgroundColor,
        overflow: dock.scrollWidth - dock.clientWidth,
      },
      workscapeHeight: hero.getBoundingClientRect().height,
      targets,
      appLabels,
      appItemBounds,
      groupLabels,
      groupSurfaces,
      dockAction: {
        left: dockAction.left,
        right: dockAction.right,
        top: dockAction.top,
        bottom: dockAction.bottom,
      },
    };
  });
}
