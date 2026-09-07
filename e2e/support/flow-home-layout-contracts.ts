import { expect, type Locator, type Page } from '@playwright/test';

export async function waitForFlowHomeNavigation(page: Page, editing: boolean) {
  await expect(page).toHaveURL((url) => (url.searchParams.get('edit') === 'home') === editing);
  const stage = page.getByTestId('flow-home-personal-sections');
  if (editing) await expect(stage).toHaveAttribute('data-flow-read-template', 'editing');
  else await expect(stage).not.toHaveAttribute('data-flow-read-template', 'editing');
  const restoredFocus = editing
    ? page.locator('[data-workspace-composer-placement="floating"] button:not([disabled])').first()
    : page.locator('[data-home-edit-trigger]');
  await expect(restoredFocus).toBeFocused();
  // Query navigation restores scroll in an effect. Position the next gesture
  // after that route commit has painted, not in the previous editor's frame.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
}

export async function readFlowHomeDragBounds(page: Page, source: Locator, target: Locator) {
  await waitForFlowHomeNavigation(page, true);
  // Resolve coordinates only after both rows are on screen; off-screen pointer
  // positions trigger auto-scroll and no longer point at the intended target.
  await target.scrollIntoViewIfNeeded();
  await expect(source).toBeInViewport();
  await expect(target).toBeInViewport();
  const [sourceBounds, targetBounds] = await Promise.all([
    source.boundingBox(),
    target.boundingBox(),
  ]);
  expect(sourceBounds).not.toBeNull();
  expect(targetBounds).not.toBeNull();
  if (!sourceBounds || !targetBounds) throw new Error('The drag endpoints must have bounds.');
  return { sourceBounds, targetBounds };
}

export async function setFlowHomeViewport(
  page: Page,
  viewport: { width: number; height: number },
  isMobile: boolean
) {
  await page.setViewportSize(viewport);
  if (isMobile) {
    // Native WebKit must establish a fresh layout viewport after desktop-width checks.
    // Reload preserves the current URL (including edit=home) and the same saved-layout routes.
    await page.reload();
    await expect(page.getByTestId('flow-home')).toBeVisible();
  }
}

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

export async function expectNoHorizontalDocumentOverflow(page: Page, flowHome: Locator) {
  const geometry = await flowHome.evaluate((root) => {
    const viewportWidth = document.documentElement.clientWidth;
    const rootBounds = root.getBoundingClientRect();
    const collectOverflow = (nodes: HTMLElement[]) =>
      nodes
        .filter((node) => {
          const style = window.getComputedStyle(node);
          const bounds = node.getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            bounds.width > 0 &&
            (bounds.left < -1 || bounds.right > viewportWidth + 1)
          );
        })
        .slice(0, 20)
        .map((node) => ({
          name:
            node.getAttribute('data-flow-section') ??
            node.getAttribute('data-workspace-widget') ??
            node.getAttribute('aria-label') ??
            node.tagName,
          className: node.className,
          parentClassName: node.parentElement?.className ?? '',
          html: node.outerHTML.slice(0, 320),
          bounds: (() => {
            const bounds = node.getBoundingClientRect();
            return { left: bounds.left, right: bounds.right, width: bounds.width };
          })(),
        }));
    const offenders = collectOverflow(
      Array.from(
        root.querySelectorAll<HTMLElement>(
          '[data-flow-section], [data-workspace-widget], a[href], button, summary'
        )
      )
    );
    const diagnosticOffenders = collectOverflow(
      Array.from(document.body.querySelectorAll<HTMLElement>('*'))
    );
    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      rootLeft: rootBounds.left,
      rootRight: rootBounds.right,
      offenders,
      diagnosticOffenders,
    };
  });

  expect(
    geometry.documentWidth,
    `Horizontal overflow geometry: ${JSON.stringify(geometry)}`
  ).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.rootLeft).toBeGreaterThanOrEqual(-1);
  expect(geometry.rootRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.offenders).toEqual([]);
}

export async function expectFiveColumnDockAlignment(
  groupLists: Locator,
  itemAttribute: 'data-flow-dock-item' | 'data-launchpad-item'
) {
  const groups = await groupLists.evaluateAll(
    (lists, attribute) =>
      lists.map((list) => {
        const listBounds = list.getBoundingClientRect();
        const style = window.getComputedStyle(list);
        return {
          columns: style.gridTemplateColumns.split(' ').filter(Boolean),
          flow: style.gridAutoFlow,
          id:
            list.getAttribute('data-launchpad-group-target') ??
            list.closest('[data-flow-dock-group]')?.getAttribute('data-flow-dock-group'),
          items: Array.from(list.querySelectorAll<HTMLElement>(`:scope > [${attribute}]`)).map(
            (item) => {
              const bounds = item.getBoundingClientRect();
              return {
                columnStart: window.getComputedStyle(item).gridColumnStart,
                id: item.getAttribute(attribute),
                left: bounds.left - listBounds.left,
                top: bounds.top,
              };
            }
          ),
        };
      }),
    itemAttribute
  );
  const baselineGroup = groups.find((group) => group.items.length >= 5);
  expect(baselineGroup, 'A complete first row establishes all five column positions').toBeDefined();
  if (!baselineGroup) throw new Error('A complete five-item Dock row is required.');
  const baseline = baselineGroup.items.slice(0, 5).map((item) => item.left);
  const columnPitch = baseline[1]! - baseline[0]!;
  expect(columnPitch).toBeGreaterThan(0);
  for (const [index, left] of baseline.entries()) {
    expect(Math.abs(left - baseline[0]! - columnPitch * index)).toBeLessThanOrEqual(1);
  }
  for (const group of groups) {
    expect(group.columns, group.id ?? 'Dock group').toHaveLength(5);
    expect(group.flow).toBe('row');
    expect(group.items.length).toBeLessThanOrEqual(10);
    expect(flowDockRowSizes(group.items)).toEqual(
      Array.from({ length: Math.ceil(group.items.length / 5) }, (_, row) =>
        Math.min(5, group.items.length - row * 5)
      )
    );
    for (const [index, item] of group.items.entries()) {
      expect(item.columnStart, `${group.id}/${item.id} uses sequential auto placement`).toBe(
        'auto'
      );
      expect(
        Math.abs(item.left - baseline[index % 5]!),
        `${group.id}/${item.id} must align with first-row column ${(index % 5) + 1}`
      ).toBeLessThanOrEqual(1);
      expect(Math.abs(item.top - group.items[Math.floor(index / 5) * 5]!.top)).toBeLessThanOrEqual(
        1
      );
    }
  }
}

export async function expectVerticalPurposeRows(list: Locator) {
  await expect(list).toHaveAttribute('data-home-purpose-list', 'stack');
  const rows = await list.locator(':scope > [role="listitem"]').evaluateAll((items) =>
    items.map((item) => {
      const bounds = item.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
    })
  );
  expect(rows.length).toBeGreaterThanOrEqual(2);
  expect(rows.length).toBeLessThanOrEqual(4);
  for (const [index, row] of rows.entries()) {
    expect(Math.abs(row.left - rows[0]!.left)).toBeLessThanOrEqual(2);
    expect(Math.abs(row.right - rows[0]!.right)).toBeLessThanOrEqual(2);
    if (index > 0) expect(row.top).toBeGreaterThanOrEqual(rows[index - 1]!.bottom);
  }
}

export async function expectLargeTextPurposeGeometry(root: Locator) {
  const contract = await root.evaluate((element) => {
    const bounds = (node: Element) => {
      const rect = node.getBoundingClientRect();
      return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
    };
    const meaningfulText = Array.from(
      element.querySelectorAll<HTMLElement>(
        '[data-home-purpose-list] .MuiTypography-root, [data-home-role-insight] .MuiTypography-root, [data-home-purpose-contextual-visual] .MuiTypography-root, [data-calendar-insight-widget] .MuiTypography-root'
      )
    )
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return rect.width > 1 && rect.height > 1 && style.display !== 'none';
      })
      .map((node) => ({
        fontSize: Number.parseFloat(window.getComputedStyle(node).fontSize),
        horizontalOverflow: node.scrollWidth - node.clientWidth,
        text: node.textContent?.trim() ?? '',
        verticalOverflow: node.scrollHeight - node.clientHeight,
      }));
    const lists = Array.from(element.querySelectorAll<HTMLElement>('[data-home-purpose-list]')).map(
      (list) => {
        const items = Array.from(list.querySelectorAll<HTMLElement>(':scope > [role="listitem"]'));
        const itemBounds = items.map(bounds);
        return {
          display: window.getComputedStyle(list).display,
          direction: window.getComputedStyle(list).flexDirection,
          rowsContained: items.every((item, index) => {
            const contribution = item.querySelector<HTMLElement>('[data-home-contribution]');
            if (!contribution) return true;
            const itemRect = itemBounds[index]!;
            const contributionRect = bounds(contribution);
            return (
              contributionRect.top >= itemRect.top - 1 &&
              contributionRect.bottom <= itemRect.bottom + 1
            );
          }),
          rowsSeparated: itemBounds.every(
            (item, index) => index === 0 || item.top >= itemBounds[index - 1]!.bottom - 1
          ),
        };
      }
    );
    const timeline = Array.from(
      element.querySelectorAll<HTMLElement>(
        '[data-home-purpose-timeline="true"] > [role="listitem"]'
      )
    ).map((item) => {
      const time = item.querySelector<HTMLElement>('[data-home-purpose-time]');
      const title = item.querySelector<HTMLElement>('[data-home-purpose-title]');
      return time && title ? { time: bounds(time), title: bounds(title) } : null;
    });
    const roleLenses = Array.from(
      element.querySelectorAll<HTMLElement>('[data-home-role-lens]')
    ).map((lens) => {
      const label = lens.querySelector<HTMLElement>('[data-home-role-label]')!;
      const value = lens.querySelector<HTMLElement>('[data-home-role-value]')!;
      const comparison = lens.querySelector<HTMLElement>('[data-home-role-comparison]')!;
      const rail = lens.querySelector<HTMLElement>('[data-home-role-metric-rail]')!;
      return {
        comparison: bounds(comparison),
        label: bounds(label),
        rail: bounds(rail),
        value: bounds(value),
      };
    });
    const calendarInsights = Array.from(
      element.querySelectorAll<HTMLElement>('[data-calendar-insight-widget]')
    ).map((widget) => {
      const open = widget.querySelector<HTMLElement>('[data-calendar-insight-open]');
      return {
        horizontalOverflow: widget.scrollWidth - widget.clientWidth,
        openColumns: open ? window.getComputedStyle(open).gridTemplateColumns.split(' ').length : 0,
      };
    });
    return { calendarInsights, lists, meaningfulText, roleLenses, timeline };
  });

  expect(contract.meaningfulText.length).toBeGreaterThan(0);
  expect(
    contract.meaningfulText.every(
      ({ fontSize, horizontalOverflow, text, verticalOverflow }) =>
        text.length > 0 && fontSize >= 17 && horizontalOverflow <= 1 && verticalOverflow <= 1
    ),
    JSON.stringify(contract.meaningfulText)
  ).toBe(true);
  expect(
    contract.lists.every(
      ({ direction, display, rowsContained, rowsSeparated }) =>
        display === 'flex' && direction === 'column' && rowsContained && rowsSeparated
    ),
    JSON.stringify(contract.lists)
  ).toBe(true);
  expect(
    contract.timeline.every((row) => row === null || row.time.right <= row.title.left + 1),
    JSON.stringify(contract.timeline)
  ).toBe(true);
  expect(
    contract.roleLenses.every(
      ({ comparison, label, rail, value }) =>
        label.right <= value.left + 1 &&
        Math.max(label.bottom, value.bottom) <= Math.min(comparison.top, rail.top) + 1
    ),
    JSON.stringify(contract.roleLenses)
  ).toBe(true);
  expect(contract.calendarInsights).toHaveLength(2);
  expect(
    contract.calendarInsights.every(
      ({ horizontalOverflow, openColumns }) => horizontalOverflow <= 1 && openColumns === 1
    ),
    JSON.stringify(contract.calendarInsights)
  ).toBe(true);
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
      const items = Array.from(
        list.querySelectorAll<HTMLElement>(':scope > [data-launchpad-item]')
      );
      const firstItemLeft = Math.min(
        Number.POSITIVE_INFINITY,
        ...items.map((item) => item.getBoundingClientRect().left)
      );
      const firstColumnControls = items
        .filter((item) => Math.abs(item.getBoundingClientRect().left - firstItemLeft) < 1)
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
      ),
      JSON.stringify(contract.labelContracts)
    ).toBe(true);
  }
  const documentGeometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: Array.from(document.body.querySelectorAll<HTMLElement>('*'))
      .filter((node) => {
        const bounds = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return (
          bounds.width > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          (bounds.left < -1 || bounds.right > window.innerWidth + 1)
        );
      })
      .slice(0, 20)
      .map((node) => ({
        html: node.outerHTML.slice(0, 200),
        left: node.getBoundingClientRect().left,
        right: node.getBoundingClientRect().right,
      })),
  }));
  expect(
    documentGeometry.scrollWidth - documentGeometry.innerWidth,
    JSON.stringify(documentGeometry)
  ).toBe(0);
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
