import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { ASK_RUNTIME_FIXTURE } from './support/runtime-access';
import { mockQuestionLaunches } from './support/question-launch';
import { CALENDAR_EVENT_FIXTURE } from './support/product-area-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

function fulfillAskStream(route: Route, response: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: [
      'event: progress\ndata: {"stage":"AUTHORIZING"}',
      'event: progress\ndata: {"stage":"RETRIEVING"}',
      `event: result\ndata: ${JSON.stringify({ data: response })}`,
      '',
    ].join('\n\n'),
  });
}

async function installVoiceRecorder(page: Page) {
  await page.addInitScript(() => {
    const stream = {
      getTracks: () => [{ stop: () => undefined }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => stream },
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: class {
        static isTypeSupported(type: string) {
          return type.startsWith('audio/webm');
        }

        state: RecordingState = 'inactive';
        mimeType = 'audio/webm;codecs=opus';
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;

        start() {
          this.state = 'recording';
        }

        stop() {
          if (this.state === 'inactive') return;
          this.state = 'inactive';
          this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) });
          this.onstop?.();
        }
      },
    });
  });
}

for (const viewport of [
  { name: '1440', width: 1440, height: 1000 },
  { name: '390', width: 390, height: 844 },
] as const) {
  test(`global assistant ${viewport.name} keeps route context and requires transcript review before send`, async ({
    page,
  }, testInfo) => {
    const i18nWarnings: string[] = [];
    page.on('console', (message) => {
      if (/missingKey|i18next::translator/u.test(message.text())) i18nWarnings.push(message.text());
    });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installVoiceRecorder(page);
    await mockShellSession(page, ['WORKSPACE_MEMBER'], {
      locale: 'ko',
      displayName: '김민아',
      permissions: FULL_PRODUCT_PERMISSIONS,
    });
    await mockQuestionLaunches(page);
    await page.route('**/api/platform/v1/calendar/events?**', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [
            {
              ...CALENDAR_EVENT_FIXTURE,
              eventId: 'calendar-u10-product-review',
              title: '3분기 제품 검토 및 AX 인프라 검토 회의',
              startsAt: '2026-09-09T01:00:00Z',
              endsAt: '2026-09-09T02:30:00Z',
            },
            {
              ...CALENDAR_EVENT_FIXTURE,
              eventId: 'calendar-u10-sprint-focus',
              title: '팀 주간 스프린트 집중시간',
              startsAt: '2026-09-09T05:00:00Z',
              endsAt: '2026-09-09T06:30:00Z',
              importance: 'NORMAL',
            },
            {
              ...CALENDAR_EVENT_FIXTURE,
              eventId: 'calendar-u10-license-check',
              title: '인프라 라이선스 갱신 결재 상태 확인',
              startsAt: '2026-09-09T07:30:00Z',
              endsAt: '2026-09-09T08:00:00Z',
              importance: 'NORMAL',
            },
          ],
        },
      })
    );

    const askRequests: Array<Record<string, unknown>> = [];
    await page.route('**/api/agent/v1/ask/stream', (route) => {
      const request = route.request().postDataJSON() as Record<string, unknown> & {
        requestId: string;
      };
      askRequests.push(request);
      return fulfillAskStream(route, {
        ...ASK_RUNTIME_FIXTURE,
        requestId: request.requestId,
        answer:
          '현재 권한으로 확인한 일정 근거를 요약했습니다. 세부 출처와 다음 업무는 근거 화면에서 다시 검토하세요.',
      });
    });
    let transcriptionRequests = 0;
    await page.route('**/api/agent/v1/voice/transcriptions', (route) => {
      transcriptionRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          status: 'SUCCESS',
          message: 'Voice transcription completed.',
          data: { text: '내일 회의 준비에 필요한 업무를 알려줘', language: 'ko' },
        }),
      });
    });

    await page.goto('/work/calendar');
    await page
      .getByTestId('dwaion-launcher')
      .getByRole('button', { name: 'DWAI·ON 열기', exact: true })
      .click();
    const panel = page.getByRole('dialog', { name: 'DWAI·ON 대화 및 지원 패널' });
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('dwaion-page-context')).toContainText('/work/calendar');
    const composer = panel.getByRole('textbox', { name: 'DWAI·ON에게 질문하기' });
    await composer.fill('오늘 일정과 준비할 내용을 요약해 주세요');
    await panel.getByRole('button', { name: '질문 보내기' }).click();
    await expect(panel.getByTestId('dwaion-answer')).toContainText(
      '현재 권한으로 확인한 일정 근거'
    );
    expect(askRequests).toHaveLength(1);
    expect(askRequests[0]).toMatchObject({
      pageContext: {
        route: '/work/calendar',
        appKey: 'APP.CALENDAR',
        surface: 'work-calendar',
      },
    });

    await panel.getByRole('button', { name: '음성으로 입력' }).click();
    await panel.getByRole('button', { name: '듣는 중 · 눌러서 종료' }).click();
    const recordingReview = panel.getByTestId('dwaion-voice-review');
    await expect(recordingReview).toBeVisible();
    await expect(recordingReview).toContainText('업로드 및 받아쓰기');
    await expect(recordingReview.locator('audio')).toHaveAttribute('src', /^blob:/);
    expect(transcriptionRequests).toBe(0);
    expect(askRequests).toHaveLength(1);

    await recordingReview.getByRole('button', { name: '계속', exact: true }).click();
    const transcriptReview = panel.getByTestId('dwaion-transcript-review');
    await expect(transcriptReview).toContainText('내일 회의 준비에 필요한 업무를 알려줘');
    await expect(composer).toHaveValue('내일 회의 준비에 필요한 업무를 알려줘');
    expect(transcriptionRequests).toBe(1);
    expect(askRequests).toHaveLength(1);

    const geometry = await panel.evaluate((element) => ({
      overflow: element.scrollWidth - element.clientWidth,
      bounds: element.getBoundingClientRect().toJSON(),
    }));
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.bounds.left).toBeGreaterThanOrEqual(0);
    expect(geometry.bounds.right).toBeLessThanOrEqual(viewport.width);
    const audit = await new AxeBuilder({ page })
      .include('[data-testid="dwaion-panel"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      audit.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`U10-global-voice-review-${viewport.name}.png`),
      animations: 'disabled',
    });

    await composer.fill('내일 회의 준비에 필요한 업무와 담당자를 알려줘');
    await panel.getByRole('button', { name: '질문 보내기' }).click();
    await expect.poll(() => askRequests.length).toBe(2);
    expect(askRequests[1]).toMatchObject({
      query: '내일 회의 준비에 필요한 업무와 담당자를 알려줘',
      pageContext: {
        route: '/work/calendar',
        appKey: 'APP.CALENDAR',
        surface: 'work-calendar',
      },
    });
    expect(i18nWarnings).toEqual([]);
  });
}

test('global assistant keeps keyboard input available when voice recording is unsupported', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: undefined,
    });
  });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '김민아',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockQuestionLaunches(page);

  await page.goto('/work/calendar');
  await page
    .getByTestId('dwaion-launcher')
    .getByRole('button', { name: 'DWAI·ON 열기', exact: true })
    .click();
  const panel = page.getByRole('dialog', { name: 'DWAI·ON 대화 및 지원 패널' });
  await expect(
    panel.getByRole('button', { name: '이 브라우저는 음성 입력을 지원하지 않습니다' })
  ).toBeDisabled();
  await expect(panel.getByRole('textbox', { name: 'DWAI·ON에게 질문하기' })).toBeEnabled();
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true
  );
});

test('global assistant exposes a keyboard fallback after microphone permission is denied', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException('Microphone permission denied', 'NotAllowedError');
        },
      },
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: class {},
    });
  });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '김민아',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockQuestionLaunches(page);
  let transcriptionRequests = 0;
  let askRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/agent/v1/voice/transcriptions')) transcriptionRequests += 1;
    if (request.url().includes('/api/agent/v1/ask/stream')) askRequests += 1;
  });

  await page.goto('/work/calendar');
  await page
    .getByTestId('dwaion-launcher')
    .getByRole('button', { name: 'DWAI·ON 열기', exact: true })
    .click();
  const panel = page.getByRole('dialog', { name: 'DWAI·ON 대화 및 지원 패널' });
  await panel.getByRole('button', { name: '음성으로 입력' }).click();
  await expect(panel.getByRole('alert')).toContainText(
    '마이크 권한이나 음성 처리 경로를 확인하지 못했습니다.'
  );
  await expect(panel.getByRole('button', { name: '음성 입력 다시 시도' })).toBeEnabled();
  await expect(panel.getByRole('textbox', { name: 'DWAI·ON에게 질문하기' })).toBeEnabled();
  expect(transcriptionRequests).toBe(0);
  expect(askRequests).toBe(0);
});
