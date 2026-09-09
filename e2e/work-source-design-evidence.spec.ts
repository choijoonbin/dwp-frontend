import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockWorkHubFoundation, WORK_HUB_FIXTURE } from './support/work-hub-foundation-fixtures';
import { fulfillSuccess } from './support/shell-session';
import type { ServiceRequestDetail } from '@dwp-frontend/shared-utils/api/service-center-api';
import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils/api/approval-api';

/** Korean design evidence uses allowed fictional source data; live release checks are separate. */
async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  await page.screenshot({ path: testInfo.outputPath(`${name}-full.png`), fullPage: true });
}

async function expectAccessActionsClearOfLauncher(page: Page) {
  const launcher = page.getByTestId('dwaion-launcher');
  const group = page.getByRole('group', { name: '권한 유지 또는 회수 선택', exact: true });
  const controls = ['접근 유지', '접근 회수'].map((name) =>
    group.getByRole('button', { name, exact: true })
  );
  await expect(launcher).toBeVisible();
  if ((await launcher.getAttribute('data-shell-auxiliary-placement')) === 'floating') {
    await group.scrollIntoViewIfNeeded();
    await group.evaluate((element) => {
      const auxiliary = document.querySelector('[data-testid="dwaion-launcher"]')!;
      const action = element.getBoundingClientRect();
      const floating = auxiliary.getBoundingClientRect();
      window.scrollBy(0, action.top + action.height / 2 - floating.top - floating.height / 2);
    });
    await expect(group).toHaveAttribute('data-shell-auxiliary-avoidance-active', 'true');
  }
  const separated = async () => {
    const floating = await launcher.boundingBox();
    const buttons = await Promise.all(controls.map((control) => control.boundingBox()));
    if (!floating || buttons.some((button) => !button)) return false;
    return buttons.every(
      (button) =>
        button!.y + button!.height <= floating.y ||
        button!.y >= floating.y + floating.height ||
        button!.x + button!.width + 12 <= floating.x ||
        button!.x >= floating.x + floating.width + 12
    );
  };
  await expect.poll(separated).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(separated).toBe(true);
}

test('02 03 04 and M1 Korean source design evidence at 1440 and 390', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const runtime = await mockWorkHubFoundation(page, {
    locale: 'ko',
    designDetails: true,
    accessReview: true,
  });
  const foreignSourceMutations = () =>
    runtime.sourceMutations.filter(
      ({ path }) =>
        path.startsWith('/api/approvals/') || path.startsWith('/api/platform/v1/services/')
    );
  const targets = [
    ['02', `APPROVAL_TASK:${WORK_HUB_FIXTURE.approvalId}:SECURITY_REVIEW`, 'approval'],
    ['03', 'IDENTITY_GOVERNANCE:f1111111-1111-4111-8111-111111111111:', 'review'],
    ['04', `SERVICE_REQUEST:${WORK_HUB_FIXTURE.serviceId}:`, 'service'],
  ] as const;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const [screen, reference, kind] of targets) {
      await page.goto(`/work/queue?work=${encodeURIComponent(reference)}`);
      await expect(page.getByRole('article').getByRole('heading').first()).toBeVisible({
        timeout: 20_000,
      });
      if (kind === 'review') {
        await expect(page.getByRole('button', { name: '접근 회수', exact: true })).toBeVisible();
      } else {
        const detail = page.getByRole('article');
        await expect(
          detail.getByRole('button', { name: '원본에서 확인', exact: true })
        ).toBeVisible();
        await expect(
          detail.getByRole('button', { name: /승인|반려|보완 내용 검토 및 제출/u })
        ).toHaveCount(0);
        await expect(
          page.getByText('이 업무에 연결된 수행 시간이 없습니다.', { exact: true })
        ).toBeVisible();
        const context = detail.getByRole('region', {
          name: kind === 'approval' ? '전자결재 문서 정보' : '서비스 요청 정보',
        });
        await expect(context).toBeVisible();
        const history = detail.getByRole('region', { name: '원천 처리 이력', exact: true });
        await expect(history).toBeVisible();
        await expect(history.getByRole('listitem')).toHaveCount(1);
        await expect(history.locator('time')).toHaveAttribute('datetime', /T/u);
        await expect(history.getByText('처리 주체', { exact: true })).toBeVisible();
        await expect(history.getByRole('button')).toHaveCount(0);
        if (kind === 'approval') {
          await expect(context.getByText('APR-031', { exact: true })).toBeVisible();
          await expect(context.getByText('박서진', { exact: true })).toBeVisible();
          await expect(context.getByText('고객지원본부', { exact: true })).toBeVisible();
          await expect(context.getByText('프로젝트 데이터 접근', { exact: true })).toBeVisible();
          await expect(context.getByText('1단계 · Security review', { exact: true })).toBeVisible();
          await expect(context.getByText('35 / 100', { exact: true })).toBeVisible();
          const evidence = detail.getByRole('region', { name: '품의 핵심 근거 및 내역' });
          await expect(evidence.getByText('구매 목적', { exact: true })).toBeVisible();
          await expect(
            evidence.getByText('고객센터 인력 증원에 따른 상담용 장비 교체', { exact: true })
          ).toBeVisible();
          await expect(evidence.getByText('신청 금액', { exact: true })).toBeVisible();
          await expect(evidence.getByText('1,850,000', { exact: true })).toBeVisible();
          await expect(evidence.getByText('공급 업체', { exact: true })).toBeVisible();
          await expect(evidence.getByText('DWP Supplies', { exact: true })).toBeVisible();
          await expect(
            history.getByRole('heading', { name: '업무 생성', exact: true })
          ).toBeVisible();
          await expect(history.getByText('박서진', { exact: true })).toBeVisible();
          await expect(history.getByText('1단계 · Request', { exact: true })).toBeVisible();
          await expect(history.getByText('처리 성공', { exact: true })).toBeVisible();
        } else {
          await expect(context.getByText('SR-088', { exact: true })).toBeVisible();
          await expect(context.getByText('원격접속(VPN) 신청', { exact: true })).toBeVisible();
          await expect(context.getByText('IT Service', { exact: true })).toBeVisible();
          await expect(context.getByText('원천 정보 없음', { exact: true })).toBeVisible();
          const requested = detail.getByRole('region', { name: '보완 요청 사유' });
          await expect(
            requested.getByText(
              '접속 목적이 모호합니다. 구체적인 프로젝트명과 접속 대상, 수행 기간을 보완해 주세요.',
              { exact: true }
            )
          ).toBeVisible();
          const values = detail.getByRole('region', { name: '최초 신청 내역 및 현재 요청 값' });
          await expect(
            values.getByText('접속 대상 리소스 / 서버망', { exact: true })
          ).toBeVisible();
          await expect(values.getByText('업무 목적', { exact: true })).toBeVisible();
          await expect(values.getByText('원천 정보 없음', { exact: true }).first()).toBeVisible();
          await expect(
            history.getByRole('heading', { name: '보완 요청', exact: true })
          ).toBeVisible();
          await expect(history.getByText('사용자', { exact: true })).toBeVisible();
          await expect(history.getByText('요청자 응답 대기', { exact: true })).toBeVisible();
          await expect(
            history.getByText(
              '접속 목적이 모호합니다. 구체적인 프로젝트명과 접속 대상, 수행 기간을 보완해 주세요.',
              { exact: true }
            )
          ).toBeVisible();
        }
        expect(foreignSourceMutations()).toEqual([]);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      if (kind === 'review' && width === 1440) await expectAccessActionsClearOfLauncher(page);
      await capture(page, testInfo, `${screen}-${width}-ko`);
      if (kind === 'review' && width === 390) {
        await page.getByRole('button', { name: '접근 회수', exact: true }).click();
        await page
          .getByRole('textbox', { name: '결정 사유' })
          .fill(
            '업무 역할 변경으로 재무 보고 시스템 접근이 더 이상 필요하지 않아 회수를 요청합니다.'
          );
        await page.getByRole('button', { name: '결정 제출 내용 확인' }).click();
        const dialog = page.getByRole('dialog', { name: '이 접근 권한을 회수할까요?' });
        await expect(dialog).toBeVisible();
        await capture(page, testInfo, 'M1-390-ko-decision-preview');
        await dialog.getByRole('button', { name: '접근 회수', exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect(page.getByText('원천 권한 반영 대기', { exact: false })).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, 0));
        await capture(page, testInfo, 'M1-390-ko-decision-receipt');
      }
    }
  }
  expect(foreignSourceMutations()).toEqual([]);
});

test('320px source history keeps long evidence readable and hides it on a failed or revoked source read', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const runtime = await mockWorkHubFoundation(page, { locale: 'ko', designDetails: true });
  await page.setViewportSize({ width: 320, height: 568 });
  const path = `/api/platform/v1/services/requests/${WORK_HUB_FIXTURE.serviceId}`;
  const workRoute = `/work/queue?work=${encodeURIComponent(`SERVICE_REQUEST:${WORK_HUB_FIXTURE.serviceId}:`)}`;
  const response = page.waitForResponse(
    (result) => new URL(result.url()).pathname === path && result.request().method() === 'GET'
  );
  await page.goto(workRoute);
  const body = (await (await response).json()) as { data: ServiceRequestDetail };
  let mode: 'history' | 'empty' | 'unavailable' | 'denied' = 'history';
  const note = '허용된 원천 이력에서 확인한 접속 목적과 업무 범위를 검토합니다. '.repeat(20);
  await page.route(`**${path}`, async (route) => {
    if (mode === 'unavailable' || mode === 'denied')
      return route.fulfill({
        status: mode === 'unavailable' ? 503 : 403,
        json: { status: 'ERROR', message: 'Source read unavailable' },
      });
    return fulfillSuccess(route, {
      ...body.data,
      timeline:
        mode === 'empty'
          ? []
          : [
              {
                eventId: 'source-status-history',
                eventType: 'STATUS_CHANGED',
                status: 'AWAITING_REQUESTER',
                actorType: 'USER',
                actorId: 98123,
                note,
                occurredAt: '2026-09-04T00:00:00Z',
              },
            ],
    });
  });
  await page.reload();
  const history = page.getByRole('region', { name: '원천 처리 이력', exact: true });
  await expect(history.getByRole('heading', { name: '요청 상태 변경', exact: true })).toBeVisible();
  await expect(history.getByText(note.trim(), { exact: true })).toBeVisible();
  await expect(history.getByText('요청자 응답 대기', { exact: true })).toBeVisible();
  await expect(history.getByText('98123', { exact: true })).toHaveCount(0);
  await capture(page, testInfo, 'source-history-320-long');
  mode = 'empty';
  await page.reload();
  await expect(
    history.getByText('원천에서 표시 가능한 처리 이력이 없습니다.', { exact: true })
  ).toBeVisible();
  await expect(history.getByRole('listitem')).toHaveCount(0);
  for (const state of ['unavailable', 'denied'] as const) {
    mode = 'history';
    await page.goto(workRoute);
    await expect(history.getByText(note.trim(), { exact: true })).toBeVisible();
    mode = state;
    const failedRead = page.waitForResponse(
      (result) =>
        new URL(result.url()).pathname === path &&
        result.status() === (state === 'unavailable' ? 503 : 403)
    );
    await page.goto(workRoute);
    await failedRead;
    await expect(history).toHaveCount(0);
    await expect(page.getByText(note.trim(), { exact: true })).toHaveCount(0);
  }
  expect(runtime.sourceMutations).toEqual([]);
});

test('requester approval needs-info shows authorized form and history then hands response to Approvals', async ({
  page,
}, testInfo) => {
  await mockWorkHubFoundation(page, { locale: 'ko', designDetails: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const requestId = 'c2222222-2222-4222-8222-222222222222';
  const source: ApprovalRequestDetail = {
    request: {
      requestId,
      requestNumber: 'APR-042',
      title: '고객센터 장비 구매 보완',
      summary: '구매 근거 보완 요청',
      workflowNameKo: '장비 구매 승인',
      workflowNameEn: 'Equipment purchase approval',
      currentStepKey: 'MANAGER_REVIEW',
      currentStepName: '구매 검토',
      currentStepSequence: 2,
      totalSteps: 3,
      status: 'NEEDS_INFO',
      priority: 'HIGH',
      dataClassification: 'INTERNAL',
      latestInformationRequest: '공급 업체별 비교 견적과 보증 기간을 보완해 주세요.',
      submittedAt: '2026-09-04T00:00:00Z',
      dueAt: null,
      version: 3,
    },
    workflowId: 'workflow-purchase',
    formId: 'form-purchase',
    payload: { purpose: '고객센터 상담용 장비 교체', amount: 1850000 },
    formSchema: {
      schemaVersion: 1,
      fields: [
        {
          key: 'purpose',
          labelKo: '구매 목적',
          labelEn: 'Purpose',
          type: 'TEXTAREA',
          required: true,
        },
        { key: 'amount', labelKo: '신청 금액', labelEn: 'Amount', type: 'NUMBER', required: true },
      ],
    },
    timeline: [
      {
        eventId: 'requester-information',
        eventType: 'INFORMATION_REQUESTED',
        actorType: 'USER',
        actorDisplayName: '김민아',
        stepName: '구매 검토',
        stepSequence: 2,
        outcome: 'SUCCESS',
        message: '비교 견적을 확인한 뒤 다시 검토하겠습니다.',
        occurredAt: '2026-09-04T01:00:00Z',
      },
    ],
  };
  const mutations: string[] = [];
  page.on('request', (request) => {
    if (
      new URL(request.url()).pathname.startsWith('/api/approvals/') &&
      ['POST', 'PUT', 'DELETE'].includes(request.method())
    )
      mutations.push(request.method());
  });
  await page.route(/\/api\/approvals\/v1\/requests(?:\?|$)/u, (route) =>
    fulfillSuccess(route, [source.request])
  );
  await page.route(`**/api/approvals/v1/requests/${requestId}/detail`, (route) =>
    fulfillSuccess(route, source)
  );
  await page.route(`**/api/approvals/v1/requests/${requestId}`, (route) =>
    fulfillSuccess(route, source.request)
  );
  const workRoute = `/work/action-required?work=${encodeURIComponent(`APPROVAL_REQUEST:${requestId}:REQUEST_INFORMATION`)}`;
  await page.goto(workRoute);
  const detail = page.getByRole('article');
  await expect(
    detail.getByRole('heading', { name: source.request.title, exact: true })
  ).toBeVisible();
  const requested = detail.getByRole('region', { name: '결재 보완 요청 사유', exact: true });
  await expect(
    requested.getByText(source.request.latestInformationRequest!, { exact: true })
  ).toBeVisible();
  const fields = detail.getByRole('region', { name: '내가 제출한 결재 내용', exact: true });
  await expect(fields.getByText('고객센터 상담용 장비 교체', { exact: true })).toBeVisible();
  await expect(fields.getByText('1,850,000', { exact: true })).toBeVisible();
  const history = detail.getByRole('region', { name: '원천 처리 이력', exact: true });
  await expect(history.getByText('김민아', { exact: true })).toBeVisible();
  await expect(history.getByText('2단계 · 구매 검토', { exact: true })).toBeVisible();
  await expect(detail.getByRole('textbox')).toHaveCount(0);
  await capture(page, testInfo, 'requester-approval-390-read-only');
  await detail.getByRole('button', { name: '원본에서 확인', exact: true }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/approvals/requests/needs-info' &&
      url.searchParams.get('request') === requestId &&
      url.searchParams.get('returnTo') === workRoute
  );
  await page.goBack();
  await expect(fields.getByText('고객센터 상담용 장비 교체', { exact: true })).toBeVisible();
  await expect(detail.getByRole('button', { name: '원본에서 확인', exact: true })).toBeFocused();
  expect(mutations).toEqual([]);
});
