import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
  mockDwaionRoutineConflictRuntime,
  mockDwaionRoutineRecoveryRuntime,
} from './support/dwaion-personal-intelligence-fixtures';
import {
  ATTACHMENT_CONVERSATION_ID,
  ATTACHMENT_FILES,
  ATTACHMENT_IDS,
  mockAttachmentRuntime,
  mockResearchRuntime,
  PLAN_ID,
  RECEIPT_ID,
  RUN_ID,
} from './support/dwaion-user-families-runtime-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const OUTPUT = join(process.cwd(), 'output', 'dwaion-frontend-final-pass-20260917');
const browserRuntimeFailures = new WeakMap<Page, string[]>();

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
        request.method() === 'DELETE' &&
        new URL(request.url()).pathname.endsWith(`/${ATTACHMENT_IDS[0]}`)
    );
    await page.getByRole('button', { name: '첨부 영구 삭제', exact: true }).first().click();
    const firstDelete = await deleteRequest;
    await expect(page.getByText(/저장소 삭제 확인 대기 · 시도 1회/)).toBeVisible();
    const retryDeleteRequest = page.waitForRequest(
      (request) =>
        request.method() === 'DELETE' &&
        new URL(request.url()).pathname.endsWith(`/${ATTACHMENT_IDS[0]}`)
    );
    await page.getByRole('button', { name: '첨부 영구 삭제 다시 시도', exact: true }).click();
    const retriedDelete = await retryDeleteRequest;
    const firstDeleteBody = firstDelete.postDataJSON() as {
      commandId: string;
      expectedRevision: number;
    };
    expect(retriedDelete.postDataJSON()).toMatchObject(firstDeleteBody);
    expect(firstDeleteBody.expectedRevision).toBe(3);
    await expect(page.getByText('infra-architecture-v3.4.pdf', { exact: true })).toHaveCount(0);
  });

  test(`U02 deep research result, receipts, and capability recovery are responsive at ${width}px`, async ({
    page,
  }) => {
    await prepare(page, width, false, 'ko');
    await mockResearchRuntime(page, 'ko');
    await page.goto(`/dwaion/new?mode=research&researchPlan=${PLAN_ID}&researchRun=${RUN_ID}`);
    await expect(page.getByTestId('dwaion-deep-research-run')).toBeVisible();
    await expect(page.getByText(RECEIPT_ID, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '영수증 ID 복사' }).first()).toBeVisible();
    const receiptBoundary = page.getByTestId('dwaion-receipt-contract-boundary');
    await expect(receiptBoundary).toBeVisible();
    await expect(receiptBoundary).toContainText('미제공');
    await page.getByRole('button', { name: '보고서 전체 화면' }).click();
    const reportDialog = page.getByRole('dialog', { name: '검증 완료 보고서' });
    await expect(reportDialog).toBeVisible();
    await expect(reportDialog.getByRole('table', { name: '리서치 보고서 데이터' })).toBeVisible();
    await expect(reportDialog).toContainText('거버넌스 기반 권고안');
    await expect(reportDialog).toContainText('의사결정 가드레일');
    await captureViewport(page, `U02-deep-research-report-${width}.png`);
    await reportDialog.getByRole('button', { name: '전체 화면 닫기' }).click();
    await verifySurface(page, '[data-testid="dwaion-deep-research-run"]');
    await captureViewport(page, `U02-deep-research-viewport-${width}.png`);
    await capture(page, `U02-deep-research-${width}.png`);
    await expect(page.getByRole('button', { name: '산출물로 저장' })).toBeEnabled();
    await expect(page.getByRole('button', { name: '파일 내보내기' })).toBeEnabled();
    for (const label of ['AI 제안 생성', '업무 앱으로 인계', '팀에 공유', '정기 루틴 등록']) {
      await expect(page.getByRole('button', { name: label })).toBeDisabled();
    }
    await expect(
      page.getByText('관리자에게 검증형 리서치 공급자 설정을 요청해 주세요.').first()
    ).toBeVisible();
    await exerciseResearchDownloads(page, 'ko');
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
            .getByRole('button', { name: /아침 우선순위 검토/ })
            .first()
            .click();
        }
        await expect(page.getByText('서버 버전·건전성·감사 증거')).toBeVisible();
        await expect(page.getByText('리비전 7 · UPDATE')).toBeVisible();
        const dryRunInspection = page.getByTestId('dwaion-routine-dry-run-inspection');
        await expect(dryRunInspection).toContainText('5단계');
        const runWorkbench = page.getByTestId('dwaion-routine-run-workbench');
        await expect(runWorkbench).toContainText('5단계 실행 DAG');
        await expect(runWorkbench).toContainText('Zero-Write 검증');
        await expect(runWorkbench).toContainText('트레이스·감사 원장');
        await expect(runWorkbench).toContainText('사용 토큰');
        await expect(runWorkbench).toContainText('실행 지연');
        await expect(runWorkbench).toContainText('멱등성 증거');
        await expect(runWorkbench).toContainText('자동 격리 보증 증거');
        await expect(runWorkbench).toContainText('구성됨');
        await expect(
          page.getByRole('button', { name: '로그 원본 다운로드 (JSONL)' })
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: '격리 건 제외 후 계속 (Skip & Continue)' })
        ).toHaveCount(0);
        for (const label of [
          'OAuth 재인증 토큰 갱신',
          '임시 한도 증액 요청',
          '담당자에게 긴급 전달 (Escalate)',
        ]) {
          await expect(page.getByRole('button', { name: label })).toBeDisabled();
        }
        await dryRunInspection.scrollIntoViewIfNeeded();
        await captureViewport(page, `U03-dry-run-inspection-${width}.png`);
        await runWorkbench.scrollIntoViewIfNeeded();
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
        await search.fill('결산');
        const routineList = page.locator('section[aria-label*="AI 루틴"]');
        await expect(routineList.getByText('결산 예외 접근 재확인', { exact: true })).toBeVisible();
        await expect(routineList.getByText('아침 우선순위 검토', { exact: true })).toHaveCount(0);
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
    const conflictRuntime = await mockDwaionRoutineConflictRuntime(page, { locale: 'ko' });
    await page.goto('/dwaion/routines');
    await expect(
      page.getByRole('heading', {
        name: '내 AI 루틴: 지능형 자동화 및 조건형 실행 거버넌스',
      })
    ).toBeVisible();
    if (width === 390) {
      await page
        .getByRole('button', { name: /아침 우선순위 검토/ })
        .first()
        .click();
    }
    await page.getByRole('button', { name: '설정 편집' }).click();
    const editor = page.getByRole('dialog', { name: '내 AI 루틴 편집기' });
    await editor.getByLabel('루틴 이름').fill('아침 우선순위 검토 v8');
    await editor.getByRole('button', { name: '초안 임시 저장' }).click();
    await expect(
      page.getByText('다른 곳에서 설정이 변경되었습니다.', { exact: false })
    ).toBeVisible();
    await expect(editor).toBeHidden();
    if (width === 390) {
      await page.getByRole('button', { name: '상세 닫기' }).click();
    }
    const conflictHeading = page.getByRole('heading', {
      name: '활성화 파이프라인 중단: 원격 리비전 충돌',
      level: 2,
    });
    const workbench = page.getByTestId('dwaion-routine-conflict-workbench');
    await expect(conflictHeading).toBeVisible();
    await expect(workbench.getByText('아침 우선순위 검토 v8', { exact: true })).toBeVisible();
    await expect(
      workbench.getByText('아침 우선순위 검토 · 서버 정본', { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByRole('radio', { name: /새 버전으로 분기 저장/ })).toBeEnabled();
    await expect(page.getByRole('radio', { name: /서버 최신본 적용/ })).toBeEnabled();
    await expect(page.getByRole('radio', { name: /필드별 선택적 병합/ })).toBeEnabled();
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      const main = document.getElementById('dwp-main-content');
      if (main) main.scrollTop = 0;
    });
    await conflictHeading.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await verifySurface(page, '#dwp-main-content');
    await captureViewport(page, `U03-activation-conflict-${width}.png`);

    if (width === 390) {
      await page.getByRole('radio', { name: /필드별 선택적 병합/ }).click();
      const identityGroup = page.locator('fieldset').filter({ hasText: '이름·목적' });
      await identityGroup.getByRole('radio', { name: '로컬 초안 사용' }).click();
      const triggerGroup = page.locator('fieldset').filter({ hasText: '트리거·실행 시점' });
      await triggerGroup.getByRole('radio', { name: '서버 최신본 사용' }).click();
    }
    await page.getByRole('button', { name: '선택한 전략으로 충돌 해결 및 저장' }).click();
    const receipt = page.getByTestId('dwaion-routine-conflict-receipt');
    await expect(receipt).toBeVisible();
    await expect(receipt).toContainText(width === 390 ? '필드별 선택 병합' : '새 루틴 분기 생성');
    await expect(receipt).toContainText('명령 ID');
    await expect(receipt).toContainText('무결성 지문');
    expect(
      conflictRuntime.writes.some((write) =>
        width === 390
          ? write.method === 'PUT' && write.expectedRevision === 8
          : write.method === 'POST' && write.path === '/api/agent/v1/routines'
      )
    ).toBe(true);
    await verifySurface(page, '#dwp-main-content');
    await capture(page, `U03-conflict-receipt-${width}.png`);
  });
}

test('U03 applies the latest server version with keyboard controls and English copy', async ({
  page,
}) => {
  await prepare(page, 1440, true, 'en');
  const conflictRuntime = await mockDwaionRoutineConflictRuntime(page, { locale: 'en' });
  await page.goto('/dwaion/routines');
  await page.getByRole('button', { name: 'Edit settings' }).click();
  const editor = page.getByRole('dialog', { name: 'My AI routine editor' });
  await editor.getByLabel('Routine name').fill('Morning priority review v8');
  await editor.getByRole('button', { name: 'Save draft' }).click();
  const workbench = page.getByTestId('dwaion-routine-conflict-workbench');
  await expect(workbench).toContainText('Conflict recovery workbench');
  const serverStrategy = page.getByRole('radio', { name: /Apply latest server version/ });
  await serverStrategy.focus();
  await page.keyboard.press('Space');
  await expect(serverStrategy).toBeChecked();
  const resolve = page.getByRole('button', {
    name: 'Resolve and save with selected strategy',
  });
  await resolve.focus();
  await page.keyboard.press('Enter');
  const receipt = page.getByTestId('dwaion-routine-conflict-receipt');
  await expect(receipt).toContainText('Apply latest server version');
  expect(conflictRuntime.writes).toHaveLength(1);
  await verifySurface(page, '#dwp-main-content');
});

test('U03 reports a partial fork failure with the current server revision', async ({ page }) => {
  await prepare(page, 390, true, 'en');
  await mockDwaionRoutineConflictRuntime(page, { locale: 'en', failConsentAttempt: 2 });
  await page.goto('/dwaion/routines');
  await page
    .getByRole('button', { name: /Morning priority review/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Edit settings' }).click();
  const editor = page.getByRole('dialog', { name: 'My AI routine editor' });
  await editor.getByLabel('Routine name').fill('Morning priority review partial fork');
  await editor.getByRole('button', { name: 'Save draft' }).click();
  await page.getByRole('button', { name: 'Close detail' }).click();
  await page.getByRole('button', { name: 'Resolve and save with selected strategy' }).click();
  await expect(
    page.getByRole('heading', { name: 'Conflict recovery could not be completed.' })
  ).toBeVisible();
  await expect(
    page.getByText('Some commands were applied, so the server state was reloaded.')
  ).toBeVisible();
  await expect(page.getByText(/Revision 2/)).toBeVisible();
  await expect(page.getByTestId('dwaion-routine-conflict-receipt')).toHaveCount(0);
  await verifySurface(page, '#dwp-main-content');
});

for (const width of [1440, 390] as const) {
  test(`U03 skips quarantined items with a server-bound receipt at ${width}px`, async ({
    page,
  }) => {
    await prepare(page, width, true, 'ko');
    const recovery = await mockDwaionRoutineRecoveryRuntime(page, { locale: 'ko' });
    await page.goto('/dwaion/routines');
    if (width === 390) {
      await page
        .getByRole('button', { name: /아침 우선순위 검토/ })
        .first()
        .click();
    }
    const workbench = page.getByTestId('dwaion-routine-run-workbench');
    await expect(workbench).toContainText('PARTIAL');
    await expect(workbench).toContainText('자동 격리 보증 증거');
    await expect(workbench).toContainText('PROVIDER_ITEM_QUARANTINED');
    await expect(
      workbench.getByRole('button', { name: '격리 건 제외 후 계속 (Skip & Continue)' })
    ).toBeEnabled();
    await expect(
      workbench.getByRole('button', { name: '즉시 안전 취소 및 롤백 (Safe Cancel)' })
    ).toBeEnabled();
    await workbench.scrollIntoViewIfNeeded();
    await verifySurface(page, '#dwp-main-content');
    await captureViewport(page, `U03-run-recovery-${width}.png`);

    await workbench.getByRole('button', { name: '격리 건 제외 후 계속 (Skip & Continue)' }).click();
    const dialog = page.getByRole('dialog', {
      name: '격리 건 제외 후 계속 (Skip & Continue)',
    });
    await expect(dialog).toContainText(
      '격리된 실패 항목은 보존하고 검증을 통과한 결과만 계속 처리합니다.'
    );
    await dialog.getByRole('button', { name: '격리 건 제외 후 계속 (Skip & Continue)' }).click();

    const receipt = page.getByTestId('dwaion-routine-recovery-receipt');
    await expect(receipt).toBeVisible({ timeout: 8_000 });
    await expect(receipt).toContainText('SKIP_QUARANTINED_AND_CONTINUE');
    await expect(receipt).toContainText('복구 명령 ID');
    expect(recovery.commands).toHaveLength(1);
    expect(recovery.commands[0]).toMatchObject({
      action: 'SKIP_QUARANTINED_AND_CONTINUE',
      expectedRevision: 5,
    });
    await verifySurface(page, '#dwp-main-content');
    await captureViewport(page, `U03-run-recovery-completed-${width}.png`);
  });
}

test('U03 preserves the recovery command identity after a provider-evidence 409', async ({
  page,
}) => {
  await prepare(page, 390, true, 'en');
  const recovery = await mockDwaionRoutineRecoveryRuntime(page, {
    locale: 'en',
    rejectFirstCommand: true,
  });
  await page.goto('/dwaion/routines');
  await page
    .getByRole('button', { name: /Morning priority review/ })
    .first()
    .click();
  const skip = page.getByRole('button', { name: 'Skip quarantined items and continue' });
  await skip.focus();
  await page.keyboard.press('Enter');
  let dialog = page.getByRole('dialog', { name: 'Skip quarantined items and continue' });
  await dialog.getByRole('button', { name: 'Skip quarantined items and continue' }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page
      .getByText('Provider quarantine evidence changed, so the recovery command was rejected.')
      .first()
  ).toBeVisible();
  await expect(skip).toBeEnabled();

  await skip.click();
  dialog = page.getByRole('dialog', { name: 'Skip quarantined items and continue' });
  await dialog.getByRole('button', { name: 'Skip quarantined items and continue' }).click();
  await expect(page.getByTestId('dwaion-routine-recovery-receipt')).toBeVisible({ timeout: 8_000 });
  expect(recovery.commands).toHaveLength(2);
  expect(recovery.commands[0]?.commandId).toBe(recovery.commands[1]?.commandId);
  await verifySurface(page, '#dwp-main-content');
});

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

test('U01 governed detach and signed audit report return server receipts', async ({ page }) => {
  await prepare(page, 1440, false, 'ko');
  const probe = await mockAttachmentRuntime(page, { advancedActions: true });
  await page.goto('/dwaion/new');
  await page.locator('input[type="file"]').setInputFiles({
    name: ATTACHMENT_FILES[0].name,
    mimeType: ATTACHMENT_FILES[0].mediaType,
    buffer: Buffer.from('DWAI.ON governed architecture evidence'),
  });
  await expect(page.getByText(ATTACHMENT_FILES[0].name, { exact: true })).toBeVisible();
  await page
    .getByRole('textbox', { name: '업무 질문', exact: true })
    .fill('첨부 근거를 검증해 주세요.');
  await page.getByRole('button', { name: '질문 보내기', exact: true }).click();
  await expect(page).toHaveURL(`/dwaion/conversations/${ATTACHMENT_CONVERSATION_ID}`);

  const auditButton = page.getByRole('button', {
    name: '서명 보안 검증 리포트 발급',
    exact: true,
  });
  await expect(auditButton).toBeEnabled();
  await auditButton.click();
  await expect(page.getByText(/서명 보고서 영수증/u)).toBeVisible();
  await expect.poll(() => probe.auditRequests).toHaveLength(1);
  expect(probe.auditRequests[0]).toMatchObject({
    attachments: [{ attachmentId: ATTACHMENT_IDS[0], expectedRevision: 3 }],
  });

  const detachButton = page.getByRole('button', { name: '전체 첨부 해제', exact: true });
  await expect(detachButton).toBeEnabled();
  await detachButton.click();
  await expect(page.getByText(/첨부 해제 영수증/u)).toBeVisible();
  await expect.poll(() => probe.detachRequests).toHaveLength(1);
  expect(probe.detachRequests[0]).toMatchObject({
    attachments: [{ attachmentId: ATTACHMENT_IDS[0], expectedRevision: 3 }],
  });
});

test('U02 governed recovery displays the immutable fork receipt', async ({ page }) => {
  await prepare(page, 1440, false, 'en');
  const probe = await mockResearchRuntime(page, 'en', { recoveryAvailable: true });
  await page.goto(`/dwaion/new?mode=research&researchPlan=${PLAN_ID}&researchRun=${RUN_ID}`);

  const button = page.getByRole('button', { name: 'Save as a new fork', exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'SAVE_AS_FORK · 71717171-7171-4171-8171-717171717171' })
  ).toBeVisible();
  await expect.poll(() => probe.recoveryRequests).toHaveLength(1);
  expect(probe.recoveryRequests[0]).toMatchObject({
    expectedVersion: 5,
    action: 'SAVE_AS_FORK',
    localDefinition: null,
  });
});

async function prepare(page: Page, width: number, personal = false, locale: 'en' | 'ko' = 'en') {
  await page.setViewportSize({ width, height: width >= 900 ? 1000 : 844 });
  await prepareSession(page, personal, locale);
}

async function prepareSession(page: Page, personal: boolean, locale: 'en' | 'ko' = 'en') {
  if (!browserRuntimeFailures.has(page)) {
    const failures: string[] = [];
    browserRuntimeFailures.set(page, failures);
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !message.text().startsWith('Failed to load resource: the server responded with a status of')
      ) {
        failures.push(`console: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
    page.on('response', (response) => {
      if (response.status() >= 500) {
        failures.push(`response ${response.status()}: ${new URL(response.url()).pathname}`);
      }
    });
  }
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
  await page.route('**/api/platform/v1/observability/web-vitals', (route) =>
    route.fulfill({ status: 202, json: { success: true } })
  );
  if (personal) await mockDwaionPersonalIntelligence(page, { locale });
}

async function verifySurface(page: Page, selector: string) {
  expect(browserRuntimeFailures.get(page) ?? []).toEqual([]);
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
  await page.mouse.move(0, 0);
  await page.waitForTimeout(60);
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
  await page.mouse.move(0, 0);
  await page.waitForTimeout(60);
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

async function exerciseResearchDownloads(page: Page, locale: 'en' | 'ko' = 'en') {
  for (const [label, kind] of [
    [locale === 'ko' ? '원시 데이터셋 추출 (JSON)' : 'Extract raw dataset (JSON)', 'raw'],
    [locale === 'ko' ? '영수증 다운로드' : 'Download receipt', 'receipt'],
    [locale === 'ko' ? '실행 원장 감사기록' : 'Open execution audit ledger', 'audit'],
  ] as const) {
    const request = page.waitForRequest((candidate) =>
      new URL(candidate.url()).pathname.endsWith(`/runs/${RUN_ID}/downloads/${kind}`)
    );
    await page.getByRole('button', { name: label }).click();
    await request;
  }
}
