import { expect, type Locator } from '@playwright/test';

import { expectRoleMetricAlignment } from './flow-home-role-metric-contract';

export async function expectRoleMetricLabelsReadable(flowHome: Locator) {
  const roleLabels = await flowHome
    .locator('[data-home-role-label], [data-home-role-comparison]')
    .evaluateAll((labels) =>
      labels.map((label) => {
        const element = label as HTMLElement;
        return {
          text: element.textContent?.trim() ?? '',
          clippedHorizontally: element.scrollWidth > element.clientWidth + 1,
          clippedVertically: element.scrollHeight > element.clientHeight + 1,
        };
      })
    );
  expect(roleLabels).toHaveLength(4);
  expect(
    roleLabels.every(
      (label) => label.text.length > 1 && !label.clippedHorizontally && !label.clippedVertically
    ),
    JSON.stringify(roleLabels)
  ).toBe(true);
}

async function expectReferenceDesktopGeometry(stage: Locator) {
  await expect(stage).toHaveAttribute('data-flow-read-template', 'adaptive-wide');
  await expect(stage).toHaveAttribute('data-flow-adaptive-applied', 'true');
  await expect(stage).toHaveAttribute('data-flow-wide-composition', '8-4/4-4-4/8-4');
  const placements = [
    { key: 'action-queue', column: '1', span: 'span 40', row: 1 },
    { key: 'role-pulse', column: '41', span: 'span 20', row: 1 },
    { key: 'today', column: '1', span: 'span 20', row: 2 },
    { key: 'response-hub', column: '21', span: 'span 20', row: 2 },
    { key: 'focus-balance', column: '41', span: 'span 20', row: 2 },
    { key: 'request-tracker', column: '1', span: 'span 40', row: 3 },
    { key: 'meeting-load', column: '41', span: 'span 20', row: 3 },
  ];
  const geometry = await stage.evaluate((root, expected) => {
    const grid = root.querySelector<HTMLElement>('[data-workspace-presentation]')!;
    const gridBounds = grid.getBoundingClientRect();
    const rowOffset = root.querySelector('[data-workspace-widget="announcements"]') ? 1 : 0;
    return {
      gridWidth: gridBounds.width,
      left: gridBounds.left,
      right: gridBounds.right,
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      rowOffset,
      items: expected.map((placement) => {
        const element = root.querySelector<HTMLElement>(
          `[data-workspace-widget="${placement.key}"]`
        )!;
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const section = element.querySelector<HTMLElement>('[data-flow-section]');
        const list = element.querySelector<HTMLElement>('[data-home-purpose-list]');
        return {
          ...placement,
          actualColumn: style.gridColumnStart,
          actualSpan: style.gridColumnEnd,
          actualRow: style.gridRowStart,
          naturalHeight:
            (placement.key === 'request-tracker' &&
              Boolean(element.querySelector('[data-home-request-empty-journey]'))) ||
            (placement.key === 'today' &&
              Boolean(element.querySelector('[data-home-purpose-sparse-timeline="true"]'))),
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
          width: bounds.width,
          visibleItems: Number(list?.dataset.homePurposeVisibleCount ?? 0),
          sparseTimeline: section?.dataset.homePurposeSparseTimeline === 'true',
          trailingSpace:
            section && list
              ? section.getBoundingClientRect().bottom - list.getBoundingClientRect().bottom
              : 0,
        };
      }),
    };
  }, placements);
  expect(geometry.columns).toBe(60);
  for (const item of geometry.items) {
    expect(item.actualColumn, item.key).toBe(item.column);
    expect(item.actualSpan, item.key).toBe(item.span);
    expect(Number(item.actualRow), item.key).toBe(item.row + geometry.rowOffset);
    const expectedRatio = item.span === 'span 40' ? 2 / 3 : 1 / 3;
    expect(Math.abs(item.width / geometry.gridWidth - expectedRatio), item.key).toBeLessThan(0.02);
    if (item.key === 'today' && item.visibleItems > 0 && item.visibleItems < 3) {
      expect(item.sparseTimeline, JSON.stringify(item)).toBe(true);
      expect(item.trailingSpace, JSON.stringify(item)).toBeLessThanOrEqual(24);
    }
  }
  for (const row of [1, 2, 3]) {
    const items = geometry.items.filter((item) => item.row === row);
    const rowBottom = Math.max(...items.map((item) => item.bottom));
    expect(Math.abs(items[0]!.left - geometry.left)).toBeLessThanOrEqual(2);
    expect(Math.abs(items.at(-1)!.right - geometry.right)).toBeLessThanOrEqual(2);
    for (const [index, item] of items.entries()) {
      expect(Math.abs(item.top - items[0]!.top)).toBeLessThanOrEqual(2);
      if (item.naturalHeight) expect(item.bottom).toBeLessThanOrEqual(rowBottom);
      else expect(Math.abs(item.bottom - rowBottom)).toBeLessThanOrEqual(2);
      if (index > 0) expect(item.left).toBeGreaterThanOrEqual(items[index - 1]!.right);
    }
    if (row > 1) {
      const prior = geometry.items.filter((item) => item.row === row - 1);
      expect(items[0]!.top).toBeGreaterThanOrEqual(Math.max(...prior.map((item) => item.bottom)));
    }
  }
}

export async function expectDesktopPurposeComposition(
  flowHome: Locator,
  template: 'adaptive-wide' = 'adaptive-wide'
) {
  const stage = flowHome.getByTestId('flow-home-personal-sections');
  await expect(stage).toHaveAttribute('data-flow-layout-contract', 'purpose-widgets');
  await expect(stage).toHaveAttribute('data-flow-read-template', template);
  await expect(stage.locator('[data-workspace-widget="action-queue"]')).toHaveAttribute(
    'data-workspace-widget-size',
    'large'
  );
  for (const key of ['today', 'response-hub', 'request-tracker', 'role-pulse']) {
    await expect(stage.locator(`[data-workspace-widget="${key}"]`)).toHaveAttribute(
      'data-workspace-widget-size',
      'compact'
    );
  }
  for (const key of ['focus-balance', 'meeting-load']) {
    await expect(stage.locator(`[data-workspace-widget="${key}"]`)).toHaveAttribute(
      'data-workspace-widget-size',
      'medium'
    );
  }
  await expectReferenceDesktopGeometry(stage);
}

export async function expectFlowWideWidgetContract(stage: Locator) {
  for (const key of ['response-hub', 'request-tracker', 'role-pulse']) {
    await expect(
      stage.locator(`[data-workspace-widget="${key}"] [data-home-support-stack="true"]`)
    ).toHaveCount(0);
  }

  const roleInsight = stage.locator(
    '[data-workspace-widget="role-pulse"] [data-home-role-insight]'
  );
  await expect(roleInsight).toBeVisible();
  await expect(roleInsight).toHaveAttribute('role', 'region');
  await expect(roleInsight.locator('[data-home-role-lens]')).toHaveCount(2);
  await expectRoleMetricAlignment(roleInsight, 2);
  for (const signalKey of ['open-work', 'activity-attention']) {
    const lens = roleInsight.locator(`[data-home-role-lens="${signalKey}"]`);
    await expect(lens).toBeVisible();
    await expect(lens).toHaveAttribute('href', /\/.+/u);
    await expect(lens.locator('[data-home-role-value]')).not.toHaveText(/NaN|undefined/u);
  }
  await expect(roleInsight.locator('[data-home-role-lens="focus-time"]')).toHaveCount(0);
  await expect(roleInsight.locator('[data-home-role-lens="schedule-load"]')).toHaveCount(0);

  const focusInsight = stage.locator(
    '[data-workspace-widget="focus-balance"] [data-calendar-insight-widget="focus-balance"]'
  );
  const meetingInsight = stage.locator(
    '[data-workspace-widget="meeting-load"] [data-calendar-insight-widget="meeting-load"]'
  );
  await expect(focusInsight).toHaveAttribute('data-calendar-insight-state', 'available');
  await expect(meetingInsight).toHaveAttribute('data-calendar-insight-state', 'available');
  await expect(focusInsight.locator('[data-calendar-insight-value]')).not.toHaveText(
    /NaN|undefined/u
  );
  await expect(meetingInsight.locator('[data-calendar-insight-value]')).not.toHaveText(
    /NaN|undefined/u
  );
  await expect(focusInsight.locator('[data-calendar-insight-open]')).toHaveAttribute(
    'href',
    '/calendar/insights'
  );
  const scheduleSeries = meetingInsight.locator('[data-calendar-insight-week-bars]');
  await expect(scheduleSeries).toBeVisible();
  await expect(scheduleSeries).toHaveAttribute(
    'data-calendar-insight-week-scale',
    'daily-limit-100'
  );
  await expect(scheduleSeries.locator('[data-calendar-insight-day-current="true"]')).toHaveCount(1);
  expect(await scheduleSeries.locator('[data-calendar-insight-day]').count()).toBeGreaterThan(0);
  const scheduleScale = await scheduleSeries.evaluate((series) => {
    const height = series.getBoundingClientRect().height;
    return Array.from(series.querySelectorAll<HTMLElement>('[data-calendar-insight-day]')).map(
      (point) => ({
        load: Number(point.dataset.calendarInsightDayLoad),
        ratio: point.getBoundingClientRect().height / height,
      })
    );
  });
  for (const point of scheduleScale) {
    expect(
      Math.abs(point.ratio - Math.max(0.04, Math.min(1, point.load / 100)))
    ).toBeLessThanOrEqual(0.08);
  }

  const roleHeaderContract = await stage
    .locator('[data-workspace-widget="role-pulse"] [data-flow-section="purpose-pulse"]')
    .evaluate((section) => {
      const heading = section.querySelector<HTMLElement>('#flow-purpose-pulse-heading')!;
      const insight = section.querySelector<HTMLElement>('[data-home-role-insight]')!;
      return {
        insightAfterHeading:
          insight.getBoundingClientRect().top >= heading.getBoundingClientRect().bottom,
      };
    });
  expect(roleHeaderContract.insightAfterHeading).toBe(true);
  await expect(
    stage.locator('[data-workspace-widget="request-tracker"] [data-home-request-empty-journey]')
  ).toBeVisible();
  const contextualListGaps = await stage
    .locator('[data-home-purpose-contextual-visual]')
    .evaluateAll((visuals) =>
      visuals.flatMap((visual) => {
        const list = visual.parentElement?.querySelector<HTMLElement>('[data-home-purpose-list]');
        return list
          ? [list.getBoundingClientRect().top - visual.getBoundingClientRect().bottom]
          : [];
      })
    );
  expect(contextualListGaps.length).toBeGreaterThan(0);
  for (const gap of contextualListGaps) {
    expect(gap).toBeGreaterThanOrEqual(7);
    expect(gap).toBeLessThanOrEqual(9);
  }

  await expectReferenceDesktopGeometry(stage);
}
