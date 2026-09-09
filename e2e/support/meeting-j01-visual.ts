import { expect } from '@playwright/test';

import { MEETING_VISUAL_SUMMARY } from './video-meeting-visual-fixtures';

import type { Page, TestInfo } from '@playwright/test';

const J01_STITCH_SOURCE = {
  projectId: '13391261371843159731',
  desktopNodeId: '09c161b0269d473a8e250928328357b1',
  mobileNodeId: '33af784102344c9da07adcd43ac8faba',
  statesNodeId: '598bdd1dbc3f4ffa80cce298793fc60e',
} as const;

export function annotateJ01Source(testInfo: TestInfo, mode: 'desktop' | 'mobile') {
  testInfo.annotations.push({
    type: 'design-source',
    description: `Stitch project ${J01_STITCH_SOURCE.projectId}, ${mode} node ${
      mode === 'desktop' ? J01_STITCH_SOURCE.desktopNodeId : J01_STITCH_SOURCE.mobileNodeId
    }, states ${J01_STITCH_SOURCE.statesNodeId}`,
  });
}

export async function expectJ01JoinWorkspace(
  page: Page,
  layout: 'desktop' | 'mobile',
  options: Readonly<{ compactRail?: boolean }> = {}
) {
  const workspace = page.getByTestId('meeting-join-workspace');
  const stepRail = page.getByTestId('meeting-join-step-rail');
  const primary = page.getByTestId('meeting-join-primary');
  const support = page.getByTestId('meeting-join-support');
  const mediaSafety = page.getByTestId('meeting-join-media-safety');
  await expect(workspace).toBeVisible();
  await expect(stepRail).toBeVisible();
  await expect(primary).toBeVisible();
  await expect(support).toBeVisible();
  await expect(mediaSafety).toBeVisible();
  await expect(stepRail.getByRole('listitem')).toHaveCount(3);
  await expect(stepRail.locator('[aria-current="step"]')).toHaveCount(1);
  await expect(page.getByTestId('meeting-mobile-navigation')).toHaveCount(0);

  const geometry = await workspace.evaluate((element) => {
    const rail = element.querySelector<HTMLElement>('[data-testid="meeting-join-step-rail"]');
    const main = element.querySelector<HTMLElement>('[data-testid="meeting-join-primary"]');
    const aside = element.querySelector<HTMLElement>('[data-testid="meeting-join-support"]');
    if (!rail || !main || !aside) return null;
    const railBounds = rail.getBoundingClientRect();
    const mainBounds = main.getBoundingClientRect();
    const asideBounds = aside.getBoundingClientRect();
    return {
      railHeight: railBounds.height,
      mainLeft: mainBounds.left,
      mainRight: mainBounds.right,
      mainTop: mainBounds.top,
      mainWidth: mainBounds.width,
      asideLeft: asideBounds.left,
      asideTop: asideBounds.top,
      asideWidth: asideBounds.width,
    };
  });
  expect(geometry, 'J01 regions are measurable').not.toBeNull();
  if (options.compactRail ?? true) {
    expect(geometry!.railHeight, 'J01 uses a compact connected step rail').toBeLessThanOrEqual(72);
  }
  if (layout === 'desktop') {
    expect(geometry!.mainRight, 'primary work precedes support rail').toBeLessThan(
      geometry!.asideLeft
    );
    expect(Math.abs(geometry!.mainTop - geometry!.asideTop), 'desktop regions share a row').toBe(0);
    expect(
      geometry!.mainWidth / geometry!.asideWidth,
      'desktop work/support balance'
    ).toBeGreaterThan(1.45);
    expect(geometry!.mainWidth / geometry!.asideWidth, 'desktop work/support balance').toBeLessThan(
      2.8
    );
  } else {
    expect(geometry!.asideTop, 'mobile support follows the primary task').toBeGreaterThan(
      geometry!.mainTop
    );
    expect(
      Math.abs(geometry!.mainLeft - geometry!.asideLeft),
      'mobile regions share a gutter'
    ).toBe(0);
    expect(
      Math.abs(geometry!.mainWidth - geometry!.asideWidth),
      'mobile regions share a width'
    ).toBe(0);
  }

  const visibleCopy = await workspace.innerText();
  expect(visibleCopy, 'J01 must not manufacture a sample meeting').not.toContain('DWPX-MEET-2026');
  expect(visibleCopy, 'J01 must not claim unverifiable absolute security').not.toMatch(
    /100% secure|military.grade|end.to.end encrypted|완벽한 보안|군사급|종단간 암호화/iu
  );
}

export async function mockJ01ResolvedMeeting(page: Page) {
  await page.route('**/api/meetings/v1/join-codes/ABCDEFGHJKMN', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        success: true,
        data: {
          meeting: {
            ...MEETING_VISUAL_SUMMARY,
            title: '분기 제품 출시 의사결정 (Q3 Final Go/No-Go)',
            organizerName: '김민아',
          },
          joinAllowed: true,
          denialReason: null,
          waitingRoomRequired: true,
        },
      }),
    })
  );
}

export async function expectFocusCanvasGutter(page: Page, label: string, expectedPixels: number) {
  const canvas = page.locator('[data-dwp-page-canvas="focus"]').first();
  await expect(canvas).toBeVisible();
  const layout = await canvas.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      paddingLeft: Number.parseFloat(style.paddingLeft),
      paddingRight: Number.parseFloat(style.paddingRight),
    };
  });
  expect(layout.paddingLeft, `${label}: shared left gutter`).toBe(expectedPixels);
  expect(layout.paddingRight, `${label}: shared right gutter`).toBe(expectedPixels);
}
