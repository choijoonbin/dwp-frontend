import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const OUTPUT = join(process.cwd(), 'output', 'dwaion-user-advancement-final');
const PLAN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const RUN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const RECEIPT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const DELIVERY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
const ATTACHMENT_CONVERSATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba0';
const ATTACHMENT_IDS = [
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
] as const;

test.beforeAll(() => mkdirSync(OUTPUT, { recursive: true }));
test.setTimeout(60_000);

for (const width of [1440, 390] as const) {
  test(`U01 secure attachment evidence and recovery are responsive at ${width}px`, async ({
    page,
  }) => {
    await prepare(page, width, false, 'ko');
    await mockAttachmentRuntime(page);
    await page.goto('/dwaion/new');
    await page.locator('input[type="file"]').setInputFiles([
      {
        name: 'infra-architecture-v3.4.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('DWAI.ON governed architecture evidence'),
      },
      {
        name: 'q3-budget-simulation-draft.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('DWAI.ON governed budget evidence'),
      },
      {
        name: 'cluster-topology-diagram.png',
        mimeType: 'image/png',
        buffer: Buffer.from('DWAI.ON governed topology evidence'),
      },
    ]);
    for (const name of [
      'infra-architecture-v3.4.pdf',
      'q3-budget-simulation-draft.xlsx',
      'cluster-topology-diagram.png',
    ]) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    const pipeline = page.getByTestId('dwaion-attachment-pipeline');
    await expect(pipeline).toContainText('3건 중 3건 검증 완료');
    await expect(pipeline).toContainText('첨부 데이터 보안 및 거버넌스');
    await expect(pipeline).toContainText('KMS 키 ID');
    for (const stage of ['업로드', '악성코드', 'DLP', '문서 파서', 'OCR', '인덱스']) {
      await expect(pipeline).toContainText(stage);
    }
    for (const format of ['형식 · PDF', '형식 · XLSX', '형식 · PNG']) {
      await expect(page.getByText(format, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('자동 삭제', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '전체 첨부 해제' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '마스킹 내역' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '보안 검사 감사 로그' })).toBeVisible();
    await expect(page.getByRole('button', { name: '서명 보안 검증 리포트 발급' })).toBeDisabled();

    const askRequest = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        new URL(request.url()).pathname.endsWith('/api/agent/v1/ask/stream')
    );
    await page
      .getByRole('textbox', { name: '업무 질문', exact: true })
      .fill('검증된 아키텍처, 예산, 토폴로지 첨부 근거를 대조해 주세요.');
    await page.getByRole('button', { name: '질문 보내기', exact: true }).click();
    const body = (await askRequest).postDataJSON() as { attachmentIds?: string[] };
    expect([...(body.attachmentIds ?? [])].sort()).toEqual([...ATTACHMENT_IDS].sort());
    await expect(page).toHaveURL(`/dwaion/conversations/${ATTACHMENT_CONVERSATION_ID}`);
    await expect(page.getByTestId('dwaion-workspace-answer')).toContainText(
      '아키텍처는 프라이빗 멀티 존 엔드포인트를 사용합니다'
    );
    await expect(page.getByText('infra-architecture-v3.4.pdf', { exact: true })).toBeVisible();
    await expect(page.getByText('q3-budget-simulation-draft.xlsx', { exact: true })).toBeVisible();
    await expect(page.getByText('cluster-topology-diagram.png', { exact: true })).toBeVisible();
    await expect(page.getByTestId('dwaion-attachment-pipeline')).toBeVisible();

    await page.getByRole('button', { name: 'OCR 뷰어', exact: true }).click();
    const ocrDialog = page.getByRole('dialog', { name: 'OCR 뷰어', exact: true });
    await expect(ocrDialog).toBeVisible();
    for (const label of [
      '프라이빗 멀티 존 아키텍처 근거',
      '3분기 예산 대조 근거',
      '게이트웨이 토폴로지 근거',
    ]) {
      await expect(ocrDialog).toContainText(label);
    }
    await ocrDialog.getByRole('button', { name: '증거 닫기', exact: true }).click();

    await page.getByRole('button', { name: '보안 검사 감사 로그', exact: true }).click();
    const evidenceDialog = page.getByRole('dialog', {
      name: '보안 검사 감사 로그',
      exact: true,
    });
    await expect(evidenceDialog).toBeVisible();
    for (const attachmentId of ATTACHMENT_IDS)
      await expect(evidenceDialog).toContainText(attachmentId);
    await evidenceDialog.getByRole('button', { name: '증거 닫기', exact: true }).click();
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      const main = document.getElementById('dwp-main-content');
      if (main) main.scrollTop = 0;
    });
    await verifySurface(page, '[data-testid="dwaion-studio"]');
    await capture(page, `U01-secure-attachment-${width}.png`);

    const deleteRequest = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        new URL(request.url()).pathname.endsWith(`/${ATTACHMENT_IDS[0]}/delete`)
    );
    await page.getByRole('button', { name: '첨부 영구 삭제', exact: true }).first().click();
    await deleteRequest;
    await expect(page.getByText('infra-architecture-v3.4.pdf', { exact: true })).toHaveCount(0);
  });

  test(`U02 deep research result, receipts, and capability recovery are responsive at ${width}px`, async ({
    page,
  }) => {
    await prepare(page, width);
    await mockResearchRuntime(page);
    await page.goto(`/dwaion/new?mode=research&researchPlan=${PLAN_ID}&researchRun=${RUN_ID}`);
    await expect(page.getByTestId('dwaion-deep-research-run')).toBeVisible();
    await expect(page.getByText(RECEIPT_ID, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy receipt ID' })).toBeVisible();
    const receiptBoundary = page.getByTestId('dwaion-receipt-contract-boundary');
    await expect(receiptBoundary).toBeVisible();
    await expect(receiptBoundary).toContainText('Unavailable');
    await page.getByRole('button', { name: 'View report full screen' }).click();
    const reportDialog = page.getByRole('dialog', { name: 'Verified report' });
    await expect(reportDialog).toBeVisible();
    await capture(page, `U02-deep-research-report-${width}.png`);
    await reportDialog.getByRole('button', { name: 'Close full screen' }).click();
    await verifySurface(page, '[data-testid="dwaion-deep-research-run"]');
    await capture(page, `U02-deep-research-${width}.png`);
    await exerciseResearchDownloads(page);
  });

  for (const surface of [
    {
      id: 'U03-routines',
      path: '/dwaion/routines',
      heading: '내 AI 루틴: 지능형 자동화 및 조건형 실행 거버넌스',
    },
    { id: 'U04-artifacts', path: '/dwaion/artifacts', heading: 'Artifact studio' },
    { id: 'U05-personal-controls', path: '/dwaion/personal-controls', heading: 'My AI controls' },
  ] as const) {
    test(`${surface.id} normal and provider recovery states are responsive at ${width}px`, async ({
      page,
    }) => {
      await prepare(page, width, true, surface.id === 'U03-routines' ? 'ko' : 'en');
      await page.goto(surface.path);
      await expect(page.getByRole('heading', { name: surface.heading })).toBeVisible();
      await expect(page.locator('#dwp-main-content .MuiSkeleton-root')).toHaveCount(0);
      await verifySurface(page, '#dwp-main-content');
      if (surface.id === 'U03-routines') {
        await captureViewport(page, `${surface.id}-${width}.png`);
      } else {
        await capture(page, `${surface.id}-${width}.png`);
      }
      if (surface.id === 'U03-routines') {
        await expect(page.getByRole('button', { name: '버전 변경 이력(Audit Log)' })).toBeVisible();
        await expect(page.getByRole('button', { name: '전체 건전성 진단' })).toBeVisible();
        await expect(page.getByRole('button', { name: '새 루틴 생성' })).toBeVisible();
        await expect(page.getByRole('button', { name: /^전체 \d+$/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /^스케줄 \d+$/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /^이벤트 \d+$/ })).toBeVisible();
        if (width === 390) {
          await page
            .getByRole('button', { name: /Morning priority review/ })
            .first()
            .click();
        }
        await expect(page.getByText('서버 버전·건전성·감사 증거')).toBeVisible();
        await expect(page.getByText('리비전 7 · UPDATE')).toBeVisible();
        await expect(
          page.getByRole('button', { name: '로그 원본 다운로드 (JSONL)' })
        ).toBeVisible();
        for (const label of [
          '격리 건 제외 후 계속 (Skip & Continue)',
          'OAuth 재인증 토큰 갱신',
          '임시 한도 증액 요청',
          '담당자에게 긴급 전달 (Escalate)',
        ]) {
          await expect(page.getByRole('button', { name: label })).toBeDisabled();
        }
        await page.getByText('최근 실제 실행', { exact: true }).scrollIntoViewIfNeeded();
        await captureViewport(page, `U03-routine-run-recovery-${width}.png`);
        await page.getByRole('button', { name: '설정 편집' }).click();
        const editor = page.getByRole('dialog', { name: '내 AI 루틴 편집기' });
        await expect(editor).toBeVisible();
        for (const section of [
          '1. 루틴 식별 및 실행 시점',
          '2. 에이전트 및 그라운딩 소스',
          '3. 산출물 전달 경로 및 실행 안전 정책',
          '4. 비용 및 연산 예산 가드레일',
          '5. 변경 검토, 시뮬레이션 및 승인',
        ]) {
          await expect(editor.locator('h3').getByText(section, { exact: true })).toBeVisible();
        }
        await expect(editor.getByLabel('트리거 오케스트레이션 유형')).toBeVisible();
        await expect(editor.getByText('Zero-Write Guard', { exact: true })).toBeVisible();
        await expect(editor.getByText('결과 전달 파이프라인 (복수 선택)')).toBeVisible();
        await expect(
          editor.getByText('AI 제안함 라우팅 · /dwaion/proposals', { exact: true })
        ).toBeVisible();
        await expect(editor.getByText('WORM 볼트 영구 포크', { exact: true })).toBeVisible();
        await expect(editor.getByLabel('월 최대 실행 횟수')).toBeVisible();
        await expect(editor.getByLabel('실행당 최대 토큰')).toBeVisible();
        await expect(editor.getByLabel('실행당 최대 시간(분)')).toBeVisible();
        await expect(
          editor.getByRole('button', { name: '변경 승인 요청 (Maker-Checker)' })
        ).toBeDisabled();
        const editorContent = editor.locator('.MuiDialogContent-root');
        await editorContent.evaluate((node) => {
          node.scrollTop = 0;
        });
        await captureViewport(page, `U03-routine-editor-${width}.png`);
        await editor.getByLabel('트리거 오케스트레이션 유형').click();
        await page.getByRole('option', { name: 'Event Trigger (비동기 웹훅)' }).click();
        await editor.getByLabel('웹훅 이벤트 유형').fill('ERP.LEDGER_CLOSE');
        await editor.getByLabel('웹훅 엔드포인트 참조').fill('hook://erp-ledger-close');
        await expect(editor.getByText('변경 1건', { exact: true })).toBeVisible();
        await captureViewport(page, `U03-routine-editor-webhook-${width}.png`);
        await editorContent.evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        await captureViewport(page, `U03-routine-editor-governance-${width}.png`);
        await editor.getByRole('button', { name: '취소' }).click();
        if (width === 390) {
          await page.getByRole('button', { name: '상세 닫기' }).click();
        }
        const search = page.getByRole('searchbox', { name: '루틴 검색' });
        await search.fill('Finance close');
        const routineList = page.locator('section[aria-label*="AI 루틴"]');
        await expect(
          routineList.getByText('Finance close exception monitor', { exact: true })
        ).toBeVisible();
        await expect(routineList.getByText('Morning priority review', { exact: true })).toHaveCount(
          0
        );
        await captureViewport(page, `U03-routines-search-${width}.png`);
      }
      if (surface.id === 'U05-personal-controls') {
        await exerciseMemoryScopeAndExpiry(page, width);
      }
    });
  }
}

for (const width of [1440, 390] as const) {
  test(`U03 revision conflict recovery is explicit at ${width}px`, async ({ page }) => {
    await prepare(page, width, true, 'ko');
    await page.route(/\/api\/agent\/v1\/routines\/[0-9a-f-]+$/u, async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'CONFLICT',
          success: false,
          message: 'REVISION_CONFLICT',
          data: null,
        }),
      });
    });
    await page.goto('/dwaion/routines');
    await expect(
      page.getByRole('heading', {
        name: '내 AI 루틴: 지능형 자동화 및 조건형 실행 거버넌스',
      })
    ).toBeVisible();
    if (width === 390) {
      await page
        .getByRole('button', { name: /Morning priority review/ })
        .first()
        .click();
    }
    await page.getByRole('button', { name: '설정 편집' }).click();
    const editor = page.getByRole('dialog', { name: '내 AI 루틴 편집기' });
    await editor.getByLabel('루틴 이름').fill('Morning priority review v8');
    await editor.getByRole('button', { name: '초안 임시 저장' }).click();
    await expect(
      page.getByText('다른 곳에서 설정이 변경되었습니다.', { exact: false })
    ).toBeVisible();
    await expect(editor).toBeHidden();
    if (width === 390) {
      await page.getByRole('button', { name: '상세 닫기' }).click();
    }
    await expect(
      page.getByRole('heading', {
        name: '활성화 파이프라인 중단: 원격 리비전 충돌',
        level: 2,
      })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '서버 최신본 적용' })).toBeVisible();
    await expect(page.getByRole('button', { name: '스냅샷 롤백 보기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '새 버전으로 분기 저장' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '필드별 선택적 병합' })).toBeDisabled();
    await verifySurface(page, '#dwp-main-content');
    await captureViewport(page, `U03-activation-conflict-${width}.png`);
  });
}

for (const view of [
  { name: '1280', width: 1280, height: 900 },
  { name: '768', width: 768, height: 900 },
  { name: '320', width: 320, height: 844 },
  { name: '200-percent', width: 640, height: 844 },
  { name: 'forced-colors', width: 390, height: 844, forcedColors: true },
] as const) {
  test(`representative U04 surface passes ${view.name} layout and accessibility`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: view.width, height: view.height });
    await prepareSession(page, true);
    if ('forcedColors' in view) await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/dwaion/artifacts');
    await expect(page.getByRole('heading', { name: 'Artifact studio' })).toBeVisible();
    await expect(page.locator('#dwp-main-content .MuiSkeleton-root')).toHaveCount(0);
    if (view.name === '200-percent') {
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    }
    await verifySurface(page, '#dwp-main-content');
    await capture(page, `representative-U04-${view.name}.png`);
  });
}

async function prepare(page: Page, width: number, personal = false, locale: 'en' | 'ko' = 'en') {
  await page.setViewportSize({ width, height: width >= 900 ? 1000 : 844 });
  await prepareSession(page, personal, locale);
}

async function prepareSession(page: Page, personal: boolean, locale: 'en' | 'ko' = 'en') {
  await page.clock.setFixedTime(new Date('2026-09-17T03:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light', forcedColors: 'none' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale,
    displayName: 'Mina Kim',
    permissions: [...FULL_PRODUCT_PERMISSIONS, ...DWAION_PERSONAL_PERMISSIONS],
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await page.route('**/api/platform/v1/workspace/work-items**', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
  if (personal) await mockDwaionPersonalIntelligence(page);
}

async function verifySurface(page: Page, selector: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth + 1)
  );
  const audit = await new AxeBuilder({ page }).include(selector).analyze();
  expect(
    audit.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
  ).toEqual([]);
}

async function capture(page: Page, fileName: string) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.screenshot({
    path: join(OUTPUT, fileName),
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });
}

async function captureViewport(page: Page, fileName: string) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.screenshot({
    path: join(OUTPUT, fileName),
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
  });
}

async function exerciseMemoryScopeAndExpiry(page: Page, width: number) {
  await page.getByRole('button', { name: 'Narrow application scope' }).click();
  const scopeDialog = page.getByRole('dialog', { name: 'Narrow application scope' });
  await expect(scopeDialog).toBeVisible();
  await scopeDialog.getByRole('checkbox', { name: 'AI proposals' }).uncheck();
  await verifySurface(page, '[role="dialog"]');
  await capture(page, `U05-memory-scope-dialog-${width}.png`);
  const scopeRequest = page.waitForRequest(
    (request) => request.method() === 'PUT' && request.url().includes('/ai-controls/memories/')
  );
  await scopeDialog.getByRole('button', { name: 'Save' }).click();
  expect((await scopeRequest).postDataJSON()).toMatchObject({ scope: ['ASK', 'RESEARCH'] });

  await page.getByRole('button', { name: 'Reset expiry' }).click();
  const expiryDialog = page.getByRole('dialog', { name: 'Reset expiry' });
  await expect(expiryDialog).toBeVisible();
  await expiryDialog.getByRole('switch', { name: 'Remove user-set expiry' }).check();
  await verifySurface(page, '[role="dialog"]');
  await capture(page, `U05-memory-expiry-dialog-${width}.png`);
  const expiryRequest = page.waitForRequest(
    (request) => request.method() === 'PUT' && request.url().includes('/ai-controls/memories/')
  );
  await expiryDialog.getByRole('button', { name: 'Save' }).click();
  expect((await expiryRequest).postDataJSON()).toMatchObject({ expiresAt: null });
}

async function exerciseResearchDownloads(page: Page) {
  for (const [label, kind] of [
    ['Extract raw dataset (JSON)', 'raw'],
    ['Download receipt', 'receipt'],
    ['Open execution audit ledger', 'audit'],
  ] as const) {
    const request = page.waitForRequest((candidate) =>
      new URL(candidate.url()).pathname.endsWith(`/runs/${RUN_ID}/downloads/${kind}`)
    );
    await page.getByRole('button', { name: label }).click();
    await request;
  }
}

async function mockAttachmentRuntime(page: Page) {
  const digestByAttachmentId = new Map<string, string>();
  await page.route('**/api/agent/v1/attachments**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST' && path.endsWith('/attachments')) {
      const body = request.postDataJSON() as { sourceSha256: string; fileName: string };
      const value = attachment(body.fileName, body.sourceSha256);
      digestByAttachmentId.set(value.attachmentId, body.sourceSha256);
      return success(route, value);
    }
    if (request.method() === 'GET' && path.endsWith('/evidence')) {
      const attachmentId = path.split('/').at(-2) ?? '';
      const index = ATTACHMENT_IDS.indexOf(attachmentId as (typeof ATTACHMENT_IDS)[number]);
      if (index < 0)
        return route.fulfill({ status: 404, json: { detail: 'Attachment evidence not found.' } });
      const file = ATTACHMENT_FILES[index];
      const value = attachment(
        file.name,
        digestByAttachmentId.get(attachmentId) ?? String(index + 1).repeat(64)
      );
      return success(route, {
        attachmentId: value.attachmentId,
        sourceSha256: value.sourceSha256,
        stages: value.stages,
        citations: value.citations,
        inspectionLog: [
          {
            eventId: ATTACHMENT_EVENT_IDS[index],
            eventType: 'ATTACHMENT_SCAN_COMPLETED',
            previousState: 'SCANNING',
            currentState: 'READY',
            revision: 3,
            safeErrorCode: null,
            occurredAt: '2026-09-17T02:58:00Z',
          },
        ],
        maskingHistory: [],
        ocrEvidence: value.citations,
      });
    }
    if (request.method() === 'POST' && path.endsWith('/delete')) {
      const attachmentId = path.split('/').at(-2) ?? '';
      const index = ATTACHMENT_IDS.indexOf(attachmentId as (typeof ATTACHMENT_IDS)[number]);
      if (index < 0)
        return route.fulfill({ status: 404, json: { detail: 'Attachment not found.' } });
      const file = ATTACHMENT_FILES[index];
      return success(route, {
        ...attachment(
          file.name,
          digestByAttachmentId.get(attachmentId) ?? String(index + 1).repeat(64)
        ),
        revision: 4,
        state: 'DELETED',
        updatedAt: '2026-09-17T03:00:00Z',
        deletedAt: '2026-09-17T03:00:00Z',
      });
    }
    return route.fulfill({ status: 501, json: { detail: 'Attachment command is not mocked.' } });
  });

  await page.route('**/api/agent/v1/ask/stream', (route) => {
    const request = route.request().postDataJSON() as { requestId?: string };
    const response = attachmentAnswer(request.requestId ?? 'request-attachment-review');
    return route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: `event: result\ndata: ${JSON.stringify({ data: response })}\n\n`,
    });
  });
}

const ATTACHMENT_FILES = [
  {
    name: 'infra-architecture-v3.4.pdf',
    mediaType: 'application/pdf',
    sizeBytes: 14_200_000,
    locator: 'page:4',
    label: '프라이빗 멀티 존 아키텍처 근거',
  },
  {
    name: 'q3-budget-simulation-draft.xlsx',
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: 4_800_000,
    locator: 'sheet:Q3 Summary!C12:F24',
    label: '3분기 예산 대조 근거',
  },
  {
    name: 'cluster-topology-diagram.png',
    mediaType: 'image/png',
    sizeBytes: 8_100_000,
    locator: 'image:block-12',
    label: '게이트웨이 토폴로지 근거',
  },
] as const;

const ATTACHMENT_EVENT_IDS = [
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc2',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc3',
] as const;

const ATTACHMENT_ALLOWED_MEDIA_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/png',
  'image/jpeg',
  'text/plain',
] as const;

function attachment(fileName: string, sourceSha256: string) {
  const index = Math.max(
    0,
    ATTACHMENT_FILES.findIndex((file) => file.name === fileName)
  );
  const file = ATTACHMENT_FILES[index];
  const capability = {
    available: true,
    configured: true,
    reasonCode: null,
    recoveryHint: null,
  };
  const unavailable = {
    available: false,
    configured: false,
    reasonCode: 'PROVIDER_NOT_CONFIGURED',
    recoveryHint: '관리자가 해당 보안 증거 제공자를 구성하고 검증해야 합니다.',
  };
  const observedAt = '2026-09-17T02:58:00Z';
  return {
    attachmentId: ATTACHMENT_IDS[index],
    conversationId: null,
    fileName,
    mediaType: file.mediaType,
    sizeBytes: file.sizeBytes,
    sourceSha256,
    revision: 3,
    state: 'READY',
    stages: [
      ['UPLOAD', 'PASSED'],
      ['AV', 'PASSED'],
      ['DLP', 'PASSED'],
      ['PARSER', 'PASSED'],
      ['OCR', 'PASSED'],
      ['INDEX', 'PASSED'],
    ].map(([key, state]) => ({
      key,
      state,
      providerCode: `${key}_OK`,
      observedAt,
      safeErrorCode: null,
      recoveryHint: null,
    })),
    citations: [
      {
        citationId: `attachment-${index + 1}-evidence-1`,
        locator: file.locator,
        label: file.label,
        contentSha256: String(index + 4).repeat(64),
      },
    ],
    retentionExpiresAt: '2026-09-18T03:00:00Z',
    capabilities: {
      upload: capability,
      antivirus: capability,
      dlp: capability,
      parser: capability,
      ocr: capability,
      index: capability,
      deletion: capability,
      detachAll: unavailable,
      inspectionLog: capability,
      maskingHistory: unavailable,
      ocrViewer: capability,
      signedAuditReport: unavailable,
      maximumFileBytes: 104_857_600,
      allowedMediaTypes: ATTACHMENT_ALLOWED_MEDIA_TYPES,
    },
    uploadTicket: null,
    createdAt: '2026-09-17T02:57:00Z',
    updatedAt: observedAt,
    deletedAt: null,
  };
}

function attachmentAnswer(requestId: string) {
  return {
    runId: 'run-attachment-review-20260917',
    auditId: 'AUD-ATTACHMENT-REVIEW-20260917',
    requestId,
    correlationId: 'correlation-attachment-review-20260917',
    conversationId: ATTACHMENT_CONVERSATION_ID,
    userMessageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbd1',
    assistantMessageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbd2',
    state: 'COMPLETED',
    answer:
      '1. 인프라 및 보안 검토\n아키텍처는 프라이빗 멀티 존 엔드포인트를 사용합니다. 토폴로지 근거에서는 게이트웨이 인그레스가 통제된 네트워크 경계 안에 있음을 확인했습니다.\n\n2. 예산 대조 분석\n검증된 워크북은 14.8% 증가를 나타내며 인용된 셀 범위가 검토 근거입니다.\n\n3. 근거 경계\n이 답변은 필수 보안 검사와 색인을 완료한 첨부 인용 3건만 사용했습니다.',
    confidence: 'HIGH',
    citations: ATTACHMENT_FILES.map((file, index) => ({
      sourceId: `src-0${index + 1}`,
      sourceType: 'ATTACHMENT',
      title: `${file.name}: ${file.label}`,
      sourceSystem: 'DWAI_ON_ATTACHMENT',
      route: null,
      occurredAt: '2026-09-17T02:58:00Z',
      excerpt: null,
    })),
    sourceCount: 3,
    policy: {
      outcome: 'ALLOW',
      riskTier: 'L1',
      code: 'READ_ONLY_GROUNDED_ANSWER',
      explanation: '검증된 세션 범위에서 읽기 전용 첨부 근거만 사용했습니다.',
      modelAllowed: true,
      mutationAllowed: false,
    },
    modelRoute: {
      state: 'COMPLETED',
      provider: 'OPENAI',
      model: 'gpt-test-2026-09-01',
      inputTokens: 1_112,
      outputTokens: 186,
      totalTokens: 1_298,
      latencyMs: 1_840,
    },
    agentRegistry: {
      entryKey: 'DWP_ASSISTANT',
      revision: 4,
      artifactVersion: 'ask-runtime-v4',
      riskTier: 'MEDIUM',
      resolution: 'ACTIVE',
    },
    statusCode: 'ANSWER_GROUNDED',
    completedAt: '2026-09-17T02:59:00Z',
  };
}

async function mockResearchRuntime(page: Page) {
  const providerUnavailable = {
    available: false,
    configured: false,
    reasonCode: 'PROVIDER_NOT_CONFIGURED',
    recoveryHint: 'Ask an administrator to configure this governed research operation.',
  };
  const available = {
    available: true,
    configured: true,
    reasonCode: null,
    recoveryHint: null,
  };
  await page.route('**/api/agent/v1/research/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/research/capabilities')) {
      return success(route, {
        rawExport: available,
        pdfExport: providerUnavailable,
        receiptDownload: available,
        auditDownload: available,
        fork: providerUnavailable,
        merge: providerUnavailable,
        keepLocal: providerUnavailable,
        sensitivityRecalculation: providerUnavailable,
        cacheFallback: providerUnavailable,
      });
    }
    if (path.endsWith(`/plans/${PLAN_ID}`)) return success(route, researchPlan());
    if (path.endsWith(`/runs/${RUN_ID}/downloads/raw`)) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(researchRun().result),
      });
    }
    if (path.endsWith(`/runs/${RUN_ID}/downloads/receipt`)) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ receiptId: RECEIPT_ID, state: 'COMPLETED' }),
      });
    }
    if (path.endsWith(`/runs/${RUN_ID}/downloads/audit`)) {
      return route.fulfill({
        contentType: 'application/x-ndjson',
        body: `${JSON.stringify({ eventType: 'DOWNLOAD', runId: RUN_ID })}\n`,
      });
    }
    if (path.endsWith(`/runs/${RUN_ID}/deliveries`)) {
      return success(route, [
        {
          deliveryId: DELIVERY_ID,
          runId: RUN_ID,
          deliveryType: 'ARTIFACT',
          state: 'COMPLETED',
          receiptId: RECEIPT_ID,
          createdAt: '2026-09-17T02:59:00Z',
          updatedAt: '2026-09-17T02:59:30Z',
          completedAt: '2026-09-17T02:59:30Z',
        },
      ]);
    }
    if (path.endsWith(`/runs/${RUN_ID}`)) return success(route, researchRun());
    return route.fulfill({ status: 501, json: { detail: 'Research command is not mocked.' } });
  });
}

function researchPlan() {
  return {
    planId: PLAN_ID,
    state: 'READY',
    revision: 2,
    definition: {
      goal: 'Compare governed infrastructure options with verified evidence.',
      question: 'Which option offers the best verified value within policy?',
      successCriteria: ['Verify at least three governed sources'],
      deliverableTypes: ['REPORT', 'COMPARISON'],
      sourcePolicies: [{ sourceKey: 'WORK_ITEM', allowed: true, scope: 'Current user work scope' }],
      requireAllAllowedSources: true,
      budget: { maximumMinutes: 45, maximumSources: 30, maximumTokens: 50_000 },
    },
    createdAt: '2026-09-17T02:45:00Z',
    updatedAt: '2026-09-17T02:46:00Z',
  };
}

function researchRun() {
  return {
    runId: RUN_ID,
    planId: PLAN_ID,
    planRevision: 2,
    state: 'COMPLETED',
    version: 5,
    progress: {
      completedSteps: 4,
      totalSteps: 4,
      discoveredSources: 4,
      verifiedCitations: 3,
      failedSources: [],
      recoveryHint: null,
    },
    result: {
      reportMarkdown:
        '## Verified recommendation\n\nThe governed option meets the evidence and budget criteria.',
      citations: [
        {
          citationId: 'work-item-1042',
          locator: 'work-item:1042',
          label: 'Approved infrastructure comparison',
          contentSha256: '3'.repeat(64),
        },
      ],
      resultSha256: '4'.repeat(64),
    },
    receiptId: RECEIPT_ID,
    safeErrorCode: null,
    startedAt: '2026-09-17T02:47:00Z',
    createdAt: '2026-09-17T02:46:30Z',
    updatedAt: '2026-09-17T02:59:00Z',
    completedAt: '2026-09-17T02:59:00Z',
  };
}

function success(route: Route, data: unknown) {
  return route.fulfill({ json: { success: true, status: 'SUCCESS', message: 'OK', data } });
}
