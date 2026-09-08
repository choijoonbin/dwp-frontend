import { expect, type Page } from '@playwright/test';

/** Guard the mobile composition against accidental desktop-column regressions. */
export async function expectMobileActivityLayout(
  page: Page,
  surface: 'flow' | 'timeline' | 'detail' | 'dwaion'
) {
  if (surface === 'detail' || surface === 'dwaion') {
    const action = page.getByRole('button', {
      name: surface === 'detail' ? '소스 열기' : '대화 열기',
      exact: true,
    });
    expect((await action.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    return;
  }
  if (surface === 'flow') {
    const distribution = page.getByTestId('flow-activity-signal-panel').locator('dl');
    const columns = await distribution.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length
    );
    expect(columns).toBe(3);
    const sourceAction = page
      .getByRole('dialog', { name: '실행 신호', exact: true })
      .locator('a[href="/activity/timeline?state=needs-input"]');
    expect((await sourceAction.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    return;
  }

  const firstEvent = page
    .getByRole('list', { name: '워크스페이스 활동' })
    .getByRole('button')
    .first();
  const layout = await firstEvent.evaluate((button) => {
    const time = button.querySelector('time')!;
    const body = button.querySelector('h3')!.parentElement!.parentElement!;
    const timeBox = time.getBoundingClientRect();
    const bodyBox = body.getBoundingClientRect();
    const dateAndTime = [...time.children].map((element) => element.getBoundingClientRect());
    return {
      columns: getComputedStyle(button).gridTemplateColumns.split(' ').length,
      timestampDisplay: getComputedStyle(time).display,
      sameTimestampLine: Math.abs(dateAndTime[0].y - dateAndTime[1].y) < 1,
      bodyBelowTimestamp: bodyBox.y >= timeBox.bottom,
      sharedLeftEdge: Math.abs(bodyBox.x - timeBox.x) < 1,
      fullBodyWidth: Math.abs(bodyBox.width - timeBox.width) < 1,
    };
  });
  expect(layout).toEqual({
    columns: 1,
    timestampDisplay: 'flex',
    sameTimestampLine: true,
    bodyBelowTimestamp: true,
    sharedLeftEdge: true,
    fullBodyWidth: true,
  });
}
