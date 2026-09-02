import { expect, type Page } from '@playwright/test';

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
      .map(
        (element) =>
          element.getAttribute('aria-label') ||
          element.getAttribute('data-home-contribution') ||
          element.textContent?.trim().slice(0, 60) ||
          element.tagName
      );
    return { launcher: launcherRect.toJSON(), collisions };
  });
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
