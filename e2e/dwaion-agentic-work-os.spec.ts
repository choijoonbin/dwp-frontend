import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Route } from '@playwright/test';

import { ASK_RUNTIME_FIXTURE } from './support/runtime-access';
import { mockQuestionLaunches } from './support/question-launch';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

function fulfillAskStream(route: Route, response: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: `event: result\ndata: ${JSON.stringify({ data: response })}\n\n`,
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockQuestionLaunches(page);
});

test('voice input requires transcript review and never submits automatically', async ({ page }) => {
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

  let askRequests = 0;
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    askRequests += 1;
    return fulfillAskStream(route, ASK_RUNTIME_FIXTURE);
  });
  await page.route('**/api/agent/v1/voice/transcriptions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        status: 'SUCCESS',
        message: 'Voice transcription completed.',
        data: { text: 'Review my schedule for tomorrow', language: 'en' },
      }),
    })
  );

  await page.goto('/dwaion/new');
  const composer = page.getByRole('textbox', { name: 'Ask a work question' });
  await page.getByRole('button', { name: 'Enter by voice' }).click();
  await page.getByRole('button', { name: 'Listening · press to stop' }).click();

  await expect(composer).toHaveValue('Review my schedule for tomorrow');
  await expect(
    page.getByRole('button', { name: 'Transcript ready · review before sending' })
  ).toBeVisible();
  expect(askRequests).toBe(0);
});

test('pending microphone permission is released when the voice surface unmounts', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const probe = {
      grant: () => undefined,
      stoppedTracks: 0,
      recorderStarts: 0,
    };
    Object.defineProperty(globalThis, '__dwaionVoiceLifecycleProbe', {
      configurable: true,
      value: probe,
    });
    const stream = {
      getTracks: () => [
        {
          stop: () => {
            probe.stoppedTracks += 1;
          },
        },
      ],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () =>
          new Promise<MediaStream>((resolve) => {
            probe.grant = () => resolve(stream as unknown as MediaStream);
          }),
      },
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: class {
        static isTypeSupported() {
          return true;
        }

        state: RecordingState = 'inactive';
        mimeType = 'audio/webm';
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;

        start() {
          probe.recorderStarts += 1;
          this.state = 'recording';
        }

        stop() {
          this.state = 'inactive';
          this.onstop?.();
        }
      },
    });
  });

  await page.goto('/dwaion/new');
  await page.getByRole('button', { name: 'Enter by voice' }).click();
  await expect(page.getByRole('button', { name: 'Checking microphone access' })).toBeVisible();

  await page.evaluate(() => {
    history.pushState({}, '', '/apps');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/apps$/);
  await expect(page.getByRole('textbox', { name: 'Ask a work question' })).toHaveCount(0);
  await page.evaluate(() => {
    const probe = (
      globalThis as typeof globalThis & {
        __dwaionVoiceLifecycleProbe: { grant: () => void };
      }
    ).__dwaionVoiceLifecycleProbe;
    probe.grant();
  });

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              __dwaionVoiceLifecycleProbe: {
                stoppedTracks: number;
                recorderStarts: number;
              };
            }
          ).__dwaionVoiceLifecycleProbe.stoppedTracks
      )
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () =>
        (
          globalThis as typeof globalThis & {
            __dwaionVoiceLifecycleProbe: { recorderStarts: number };
          }
        ).__dwaionVoiceLifecycleProbe.recorderStarts
    )
  ).toBe(0);
});

test('spoken answers are generated only after an explicit user request', async ({ page }) => {
  let speechRequests = 0;
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    const request = route.request().postDataJSON() as { requestId: string };
    return fulfillAskStream(route, { ...ASK_RUNTIME_FIXTURE, requestId: request.requestId });
  });
  await page.route('**/api/agent/v1/voice/speech', (route) => {
    speechRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: 'audio/mpeg',
      body: Buffer.from('ID3'),
    });
  });

  await page.goto('/dwaion/new');
  await page.getByRole('textbox', { name: 'Ask a work question' }).fill('Summarize my schedule');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText(ASK_RUNTIME_FIXTURE.answer)).toBeVisible();
  expect(speechRequests).toBe(0);

  const speechRequest = page.waitForRequest('**/api/agent/v1/voice/speech');
  await page.getByRole('button', { name: 'Listen to answer' }).click();
  await speechRequest;
  expect(speechRequests).toBe(1);
});

test('failed speech playback releases its temporary audio resource before retry', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const probe = { created: 0, revoked: 0, paused: 0 };
    Object.defineProperty(globalThis, '__dwaionSpeechLifecycleProbe', {
      configurable: true,
      value: probe,
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: () => {
        probe.created += 1;
        return `blob:dwaion-speech-${probe.created}`;
      },
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: () => {
        probe.revoked += 1;
      },
    });
    Object.defineProperty(globalThis, 'Audio', {
      configurable: true,
      value: class {
        src = '';
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;

        pause() {
          probe.paused += 1;
        }

        play() {
          return Promise.reject(new DOMException('Playback blocked', 'NotAllowedError'));
        }
      },
    });
  });
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    const request = route.request().postDataJSON() as { requestId: string };
    return fulfillAskStream(route, { ...ASK_RUNTIME_FIXTURE, requestId: request.requestId });
  });
  await page.route('**/api/agent/v1/voice/speech', (route) =>
    route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from('ID3') })
  );

  await page.goto('/dwaion/new');
  await page.getByRole('textbox', { name: 'Ask a work question' }).fill('Read this answer');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText(ASK_RUNTIME_FIXTURE.answer)).toBeVisible();
  await page.getByRole('button', { name: 'Listen to answer' }).click();

  await expect(page.getByRole('button', { name: 'Try spoken answer again' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              __dwaionSpeechLifecycleProbe: {
                created: number;
                revoked: number;
                paused: number;
              };
            }
          ).__dwaionSpeechLifecycleProbe
      )
    )
    .toEqual({ created: 1, revoked: 1, paused: 1 });
});

test('run activity presents privacy-minimized, policy-aware execution evidence', async ({
  page,
}) => {
  const question = 'Confidential acquisition review';
  await page.route('**/api/agent/v1/runs?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        status: 'SUCCESS',
        message: 'Agent activity loaded.',
        data: [
          {
            runId: '019d8cb0-27a6-7b11-82d1-9eb8a26c1191',
            agentKey: 'DWP_ASSISTANT',
            agentRevision: 3,
            runState: 'COMPLETED',
            answerState: 'COMPLETED',
            riskTier: 'L0',
            policyOutcome: 'ALLOW',
            statusCode: null,
            sourceCount: 4,
            latencyMs: 820,
            conversationId: '019d8cb0-27a6-7b11-82d1-9eb8a26c1192',
            createdAt: '2026-08-27T08:00:00Z',
            completedAt: '2026-08-27T08:00:00.820Z',
          },
        ],
      }),
    })
  );

  await page.goto('/dwaion/activity');
  await expect(page.getByRole('heading', { name: 'AI run activity', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'AI run status summary' })).toContainText(
    'Recent runs'
  );
  await expect(page.getByText('DWAI·ON work agent')).toBeVisible();
  await expect(page.getByText('Risk L0 · 4 sources · 820 ms')).toBeVisible();
  await expect(page.getByText(question)).toHaveCount(0);
  await expect(
    page.getByText('Question and answer content is not shown in plaintext in this run list.')
  ).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('agent inbox keeps proactive proposals evidence-led and under explicit user control', async ({
  page,
}, testInfo) => {
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 }
  );
  let accepted = false;
  let decisionRequests = 0;
  let actionPreviewRequests = 0;
  const proposal = {
    proposalId: '019d8cb0-27a6-7b11-82d1-9eb8a26c1201',
    kind: 'RISK',
    priority: 'HIGH',
    state: 'PENDING',
    revision: 1,
    agentKey: 'DWP_ASSISTANT',
    actionKey: 'SERVICE.REQUEST.CREATE',
    content: {
      title: 'Review project delivery risk',
      summary: 'Two incomplete work items are approaching their deadline.',
      rationale: 'DWAI·ON evaluated deadline and completion signals together.',
      actionInputs: {
        serviceCategory: 'WORK_SUPPORT',
        requestSummary: 'Request support for delivery risk',
      },
      evidence: [
        {
          sourceType: 'WORK_ITEM',
          referenceId: 'work-100',
          label: 'Customer migration plan',
          occurredAt: null,
        },
      ],
    },
    proposedAt: '2026-08-27T08:00:00Z',
    availableAt: '2026-08-27T08:00:00Z',
    expiresAt: '2026-08-29T08:00:00Z',
    snoozedUntil: null,
    decidedAt: null,
  };
  await page.route('**/api/agent/v1/actions/*/preview', (route) => {
    actionPreviewRequests += 1;
    return route.abort();
  });
  await page.route('**/api/agent/v1/proposals**', async (route) => {
    if (route.request().method() === 'POST') {
      decisionRequests += 1;
      const request = route.request().postDataJSON() as {
        decision: string;
        expectedRevision: number;
      };
      expect(request).toMatchObject({ decision: 'ACCEPT', expectedRevision: 1 });
      accepted = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            proposal: {
              ...proposal,
              state: 'ACCEPTED',
              revision: 2,
              decidedAt: '2026-08-27T08:05:00Z',
            },
            actionReviewRequired: true,
          },
        }),
      });
    }
    const active =
      !accepted && new URL(route.request().url()).searchParams.get('view') === 'ACTIVE';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: active ? [proposal] : [],
          summary: {
            active: active ? 1 : 0,
            highPriority: active ? 1 : 0,
            snoozed: 0,
            handled: accepted ? 1 : 0,
          },
          nextCursor: null,
        },
      }),
    });
  });

  await page.goto('/dwaion/proposals');
  await expect(page.getByRole('heading', { name: 'AI proposals', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Review project delivery risk/ }).click();
  await expect(page.getByRole('heading', { name: 'Review project delivery risk' })).toBeVisible();
  await expect(page.getByText('Customer migration plan')).toBeVisible();
  await expect(page.getByText('Why this was proposed')).toBeVisible();
  if (process.env.DWP_CAPTURE_VISUAL_EVIDENCE === 'true') {
    await page.screenshot({
      path: `/tmp/dwaion-proposals-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Accept for review' }).click();

  await expect(page.getByRole('button', { name: 'Continue to action review' })).toBeVisible();
  expect(decisionRequests).toBe(1);
  expect(actionPreviewRequests).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});
