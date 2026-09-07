import { expect, type Locator, type Page } from '@playwright/test';

type LauncherClearanceState = {
  revision: number;
  scrollY: string | null;
};

function readLauncherClearanceState(page: Page) {
  return page
    .getByTestId('flow-home-personal-sections')
    .evaluate<LauncherClearanceState>((element) => ({
      revision: Number(element.getAttribute('data-flow-launcher-clearance-revision') ?? '-1'),
      scrollY: element.getAttribute('data-flow-launcher-clearance-scroll-y'),
    }));
}

async function waitForLauncherClearance(
  page: Page,
  expectedScrollY: string,
  previous: LauncherClearanceState
) {
  await expect
    .poll(
      async () => {
        const current = await readLauncherClearanceState(page);
        return (
          current.scrollY === expectedScrollY &&
          (previous.scrollY === expectedScrollY
            ? current.revision >= previous.revision
            : current.revision > previous.revision)
        );
      },
      { timeout: 1_000, message: `DWAI clearance must settle at scrollTop ${expectedScrollY}` }
    )
    .toBe(true);
}

async function readLauncherCollisions(page: Page) {
  return page.evaluate(() => {
    const launcher = document.querySelector<HTMLElement>('[data-testid="dwaion-launcher"]');
    if (!launcher) return { launcher: null, collisions: ['launcher missing'] };
    const launcherRect = launcher.getBoundingClientRect();
    const clearance = 8;
    const collisions = Array.from(
      document.querySelectorAll<HTMLElement>('#dwp-main-content a, #dwp-main-content button')
    )
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight
        );
      })
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return !(
          rect.right <= launcherRect.left - clearance ||
          rect.left >= launcherRect.right + clearance ||
          rect.bottom <= launcherRect.top - clearance ||
          rect.top >= launcherRect.bottom + clearance
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label =
          element.getAttribute('aria-label') ||
          element.getAttribute('data-home-contribution') ||
          element.textContent?.trim().slice(0, 60) ||
          element.tagName;
        return `${label} [${Math.round(rect.left)},${Math.round(rect.top)}–${Math.round(rect.right)},${Math.round(rect.bottom)}]`;
      });
    return { launcher: launcherRect.toJSON(), collisions };
  });
}

export async function readFlowLauncherCollisionContract(stage: Locator) {
  return stage.evaluate((root) => {
    const launcher = document.querySelector<HTMLElement>('[data-testid="dwaion-launcher"]')!;
    const launcherRect = launcher.getBoundingClientRect();
    const floating = launcher.dataset.shellAuxiliaryPlacement === 'floating';
    const safetyGap = 16;
    const widgets = Array.from(root.querySelectorAll<HTMLElement>('[data-workspace-widget]')).map(
      (widget) => {
        const section = widget.querySelector<HTMLElement>(
          '[data-workspace-widget-content] > section'
        );
        const rect = (section ?? widget).getBoundingClientRect();
        const expectedClearance =
          floating &&
          rect.right > launcherRect.left &&
          rect.left < launcherRect.right &&
          rect.bottom > launcherRect.top &&
          rect.top < launcherRect.bottom
            ? Math.max(0, Math.ceil(rect.right - launcherRect.left + safetyGap))
            : 0;
        const appliedClearance = Number(widget.dataset.flowLauncherClearance ?? 0);
        const paddingInlineEnd = section
          ? Number.parseFloat(window.getComputedStyle(section).paddingInlineEnd)
          : 0;
        return {
          key: widget.dataset.workspaceWidget,
          expected: expectedClearance > 0,
          marked: widget.dataset.flowLauncherEdge === 'true',
          expectedClearance,
          appliedClearance,
          paddingInlineEnd,
        };
      }
    );
    return {
      mismatches: widgets.filter(
        ({ expected, marked, expectedClearance, appliedClearance, paddingInlineEnd }) =>
          expected !== marked ||
          Math.abs(expectedClearance - appliedClearance) > 1 ||
          (expected && paddingInlineEnd + 1 < expectedClearance)
      ),
      marked: widgets.filter(({ marked }) => marked).length,
      unmarked: widgets.filter(({ marked }) => !marked).length,
    };
  });
}

export async function positionFlowNewsRelativeToLauncher(
  page: Page,
  position: 'clear' | 'near-miss' | 'overlap'
) {
  const previousClearance = await readLauncherClearanceState(page);
  const appliedScrollTop = await page.evaluate((nextPosition) => {
    const widget = document.querySelector<HTMLElement>('[data-workspace-widget="announcements"]')!;
    const launcher = document.querySelector<HTMLElement>('[data-testid="dwaion-launcher"]')!;
    const widgetRect = widget.getBoundingClientRect();
    const launcherRect = launcher.getBoundingClientRect();
    const absoluteTop = window.scrollY + widgetRect.top;
    const desiredTop =
      nextPosition === 'clear'
        ? launcherRect.top - widgetRect.height - 32
        : nextPosition === 'near-miss'
          ? launcherRect.top - widgetRect.height - 0.5
          : launcherRect.top - widgetRect.height + 1;
    window.scrollTo(0, Math.max(0, absoluteTop - desiredTop));
    return String(window.scrollY);
  }, position);
  await waitForLauncherClearance(page, appliedScrollTop, previousClearance);
}

export async function readFlowNewsLauncherGeometry(news: Locator) {
  return news.evaluate((widget) => {
    const section = widget.querySelector<HTMLElement>('[data-workspace-widget-content] > section')!;
    const viewAll = section.querySelector<HTMLElement>('a[href="/communications/for-you"]')!;
    const launcher = document.querySelector<HTMLElement>('[data-testid="dwaion-launcher"]')!;
    const sectionRect = section.getBoundingClientRect();
    const viewAllRect = viewAll.getBoundingClientRect();
    const launcherRect = launcher.getBoundingClientRect();
    return {
      marked: widget.dataset.flowLauncherEdge === 'true',
      clearance: Number(widget.dataset.flowLauncherClearance ?? 0),
      paddingInlineEnd: Number.parseFloat(window.getComputedStyle(section).paddingInlineEnd),
      sectionRight: sectionRect.right,
      sectionBottom: sectionRect.bottom,
      viewAllRight: viewAllRect.right,
      launcherLeft: launcherRect.left,
      launcherTop: launcherRect.top,
    };
  });
}

export async function positionFlowWidgetAtLauncher(page: Page, widgetKey: string) {
  const previous = await readLauncherClearanceState(page);
  const scrollY = await page.evaluate((key) => {
    const widget = document.querySelector<HTMLElement>(`[data-workspace-widget="${key}"]`)!;
    const section = widget.querySelector<HTMLElement>('[data-workspace-widget-content] > section')!;
    const launcher = document.querySelector<HTMLElement>('[data-testid="dwaion-launcher"]')!;
    const bounds = section.getBoundingClientRect();
    const launcherBounds = launcher.getBoundingClientRect();
    const absoluteTop = window.scrollY + bounds.top;
    window.scrollTo(0, absoluteTop - (launcherBounds.top - bounds.height / 2));
    return String(window.scrollY);
  }, widgetKey);
  await waitForLauncherClearance(page, scrollY, previous);
}

export async function expectDwaionClearOfHomeActions(page: Page) {
  const placement = await page
    .getByTestId('dwaion-launcher')
    .getAttribute('data-shell-auxiliary-placement');
  // Compact launchers live inside the opaque shell header. Main content can
  // geometrically pass behind that fixed layer while remaining neither visible
  // nor interactive, so collision geometry only applies to the floating mode.
  if (placement !== 'floating') return;
  const scrollRange = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  );
  const scrollPositions = [...new Set([0, 0.33, 0.66, 1].map((ratio) => scrollRange * ratio))];

  for (const top of scrollPositions) {
    const previousClearance = await readLauncherClearanceState(page);
    const appliedScrollTop = await page.evaluate(async (scrollTop) => {
      window.scrollTo(0, scrollTop);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      return String(window.scrollY);
    }, top);
    await waitForLauncherClearance(page, appliedScrollTop, previousClearance);
    const geometry = await readLauncherCollisions(page);
    expect(geometry.launcher).not.toBeNull();
    expect(geometry.collisions, `DWAI collision at scrollTop ${Math.round(top)}`).toEqual([]);
  }

  const finalClearance = await readLauncherClearanceState(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await waitForLauncherClearance(page, '0', finalClearance);
}
