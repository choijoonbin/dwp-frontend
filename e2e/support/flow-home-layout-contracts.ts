import { expect, type Locator, type Page } from '@playwright/test';

export async function expectFlowDockDistribution(
  groups: Locator,
  expected: readonly number[],
  maximumPerGroup: number
) {
  const distribution = await groups.evaluateAll((elements) =>
    elements.map((group) => group.querySelectorAll('[data-flow-dock-item]').length)
  );
  expect(distribution).toEqual(expected);
  expect(distribution.every((count) => count <= maximumPerGroup)).toBe(true);
}

export function flowDockRowSizes(items: readonly { top: number }[]) {
  const rows: number[] = [];
  items.forEach((item) => {
    if (!rows.some((top) => Math.abs(top - item.top) <= 2)) rows.push(item.top);
  });
  return rows.map((top) => items.filter((item) => Math.abs(item.top - top) <= 2).length);
}

export async function expectReadableDockLabels(labels: Locator, singleLineItemId: string) {
  const contracts = await labels.evaluateAll((elements) =>
    elements.map((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const lineTops = new Set(
        Array.from(range.getClientRects()).map((rect) => Math.round(rect.top))
      );
      return {
        itemId: element.closest('[data-flow-dock-item]')?.getAttribute('data-flow-dock-item'),
        whiteSpace: window.getComputedStyle(element).whiteSpace,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        lineCount: lineTops.size,
      };
    })
  );

  expect(contracts.length).toBeGreaterThan(0);
  for (const contract of contracts) {
    expect(contract.scrollWidth, contract.itemId ?? 'unknown app').toBeLessThanOrEqual(
      contract.clientWidth + 1
    );
    expect(contract.scrollHeight, contract.itemId ?? 'unknown app').toBeLessThanOrEqual(
      contract.clientHeight + 1
    );
    expect(contract.lineCount, contract.itemId ?? 'unknown app').toBeLessThanOrEqual(2);
  }

  const singleLineContract = contracts.find(({ itemId }) => itemId === singleLineItemId);
  expect(singleLineContract).toBeDefined();
  expect(singleLineContract?.whiteSpace).toBe('nowrap');
  expect(singleLineContract?.lineCount).toBe(1);
}

export async function expectLaunchpadEditControlsFit(
  page: Page,
  groupLists: Locator,
  requireEdgeHit: boolean,
  largeTextRoot?: Locator
) {
  if (largeTextRoot) {
    await page.evaluate(() =>
      document.documentElement.style.setProperty('font-size', '200%', 'important')
    );
    await expect
      .poll(() => page.evaluate(() => window.getComputedStyle(document.documentElement).fontSize))
      .toBe('32px');
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await expect(largeTextRoot).toHaveAttribute('data-flow-large-text', 'true');
  }
  const contracts = await groupLists.evaluateAll((lists) =>
    lists.map((list) => {
      const section = list.parentElement;
      const grid = section?.parentElement;
      const listBounds = list.getBoundingClientRect();
      const items = Array.from(
        list.querySelectorAll<HTMLElement>(':scope > [data-launchpad-item]')
      );
      const firstColumnControls = items
        .filter((item) => Math.abs(item.getBoundingClientRect().left - listBounds.left) < 1)
        .map((item) => {
          const control = item.querySelector<HTMLElement>('[data-launchpad-remove-control]');
          if (!control) return null;
          const bounds = control.getBoundingClientRect();
          const edgeTarget = document.elementFromPoint(
            bounds.left + 1,
            bounds.top + bounds.height / 2
          );
          return {
            edgeHit: edgeTarget === control || Boolean(edgeTarget && control.contains(edgeTarget)),
            height: Math.round(bounds.height),
            width: Math.round(bounds.width),
          };
        })
        .filter((control) => control !== null);
      const frames = items.map((item) => {
        const itemBounds = item.getBoundingClientRect();
        const frame = item.querySelector<HTMLElement>('[data-launchpad-edit-frame]');
        const glyph = item.querySelector<HTMLElement>('[data-launchpad-glyph]');
        const frameBounds = frame?.getBoundingClientRect();
        const glyphBounds = glyph?.getBoundingClientRect();
        return {
          itemLeft: itemBounds.left,
          itemRight: itemBounds.right,
          itemTop: itemBounds.top,
          frameLeft: frameBounds?.left ?? Number.NEGATIVE_INFINITY,
          frameRight: frameBounds?.right ?? Number.POSITIVE_INFINITY,
          glyphLeft: glyphBounds?.left ?? Number.NEGATIVE_INFINITY,
          glyphRight: glyphBounds?.right ?? Number.POSITIVE_INFINITY,
        };
      });
      const labelContracts = items.map((item) => {
        const label = item.querySelector<HTMLElement>('[data-launchpad-item-label]');
        if (!label) {
          return {
            fontSize: 0,
            horizontalOverflow: Number.POSITIVE_INFINITY,
            lineCount: Number.POSITIVE_INFINITY,
            verticalOverflow: Number.POSITIVE_INFINITY,
          };
        }
        const range = document.createRange();
        range.selectNodeContents(label);
        const lineTops = new Set(
          Array.from(range.getClientRects()).map((rect) => Math.round(rect.top))
        );
        return {
          fontSize: Number.parseFloat(window.getComputedStyle(label).fontSize),
          horizontalOverflow: label.scrollWidth - label.clientWidth,
          lineCount: lineTops.size,
          verticalOverflow: label.scrollHeight - label.clientHeight,
        };
      });
      const rows: (typeof frames)[] = [];
      frames.forEach((frame) => {
        const row = rows.find((candidate) => Math.abs(candidate[0]!.itemTop - frame.itemTop) <= 2);
        if (row) row.push(frame);
        else rows.push([frame]);
      });
      const maximumOverlap = Math.max(
        0,
        ...rows.flatMap((row) => {
          const sorted = [...row].sort((left, right) => left.frameLeft - right.frameLeft);
          return sorted.slice(1).map((frame, index) => sorted[index]!.frameRight - frame.frameLeft);
        })
      );
      const maximumItemOverflow = Math.max(
        0,
        ...frames.flatMap(
          ({ itemLeft, itemRight, frameLeft, frameRight, glyphLeft, glyphRight }) => [
            itemLeft - frameLeft,
            frameRight - itemRight,
            itemLeft - glyphLeft,
            glyphRight - itemRight,
          ]
        )
      );

      return {
        firstColumnControls,
        labelContracts,
        maximumItemOverflow,
        maximumOverlap,
        gridOverflowX: grid ? window.getComputedStyle(grid).overflowX : '',
        gridOverflowY: grid ? window.getComputedStyle(grid).overflowY : '',
        listOverflowX: window.getComputedStyle(list).overflowX,
        listOverflowY: window.getComputedStyle(list).overflowY,
        sectionOverflowX: section ? window.getComputedStyle(section).overflowX : '',
        sectionOverflowY: section ? window.getComputedStyle(section).overflowY : '',
      };
    })
  );

  for (const contract of contracts) {
    expect(contract.listOverflowX).toBe('visible');
    expect(contract.listOverflowY).toBe('visible');
    expect(contract.sectionOverflowX).toBe('visible');
    expect(contract.sectionOverflowY).toBe('visible');
    expect(contract.gridOverflowX).toBe('visible');
    expect(contract.gridOverflowY).toBe('visible');
    expect(contract.firstColumnControls.length).toBeGreaterThan(0);
    expect(
      contract.firstColumnControls.every(({ height, width }) => height === 44 && width === 44)
    ).toBe(true);
    if (requireEdgeHit) {
      expect(contract.firstColumnControls.every(({ edgeHit }) => edgeHit)).toBe(true);
    }
    expect(contract.maximumOverlap).toBeLessThanOrEqual(1);
    // Compact 44px targets may consume at most half of the 6px column gap,
    // while the separate overlap contract guarantees neighbouring targets never collide.
    expect(contract.maximumItemOverflow).toBeLessThanOrEqual(3);
    expect(contract.labelContracts.every(({ fontSize }) => fontSize >= 12)).toBe(true);
    expect(
      contract.labelContracts.every(
        ({ horizontalOverflow, lineCount, verticalOverflow }) =>
          horizontalOverflow <= 1 && verticalOverflow <= 1 && lineCount <= 2
      )
    ).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(
    0
  );
}

export async function expectVerticallyStackedDockGroups(dock: Locator, expectedCount: number) {
  const contract = await dock.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const groups = Array.from(element.querySelectorAll<HTMLElement>(':scope > section')).map(
      (group) => {
        const groupBounds = group.getBoundingClientRect();
        return {
          bottom: groupBounds.bottom,
          height: groupBounds.height,
          leftGap: Math.abs(groupBounds.left - bounds.left),
          rightGap: Math.abs(groupBounds.right - bounds.right),
          top: groupBounds.top,
        };
      }
    );
    return {
      columns: window.getComputedStyle(element).gridTemplateColumns.split(' ').length,
      horizontalOverflow: element.scrollWidth - element.clientWidth,
      groups,
    };
  });

  expect(contract.columns).toBe(1);
  expect(contract.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(contract.groups).toHaveLength(expectedCount);
  expect(contract.groups.every(({ height }) => height > 0)).toBe(true);
  expect(contract.groups.every(({ leftGap, rightGap }) => leftGap <= 2 && rightGap <= 2)).toBe(
    true
  );
  for (let index = 1; index < contract.groups.length; index += 1) {
    expect(contract.groups[index - 1]!.bottom).toBeLessThanOrEqual(contract.groups[index]!.top + 1);
  }
}
