import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import {
  APPROVAL_FORM_DETAIL_FIXTURE,
  APPROVAL_FORM_FIXTURE,
  APPROVAL_REQUEST_DETAIL_FIXTURE,
  APPROVAL_REQUEST_FIXTURE,
  APPROVAL_WORKFLOW_DETAIL_FIXTURE,
  APPROVAL_WORKFLOW_FIXTURE,
} from './support/product-area-fixtures';

type DownloadedDraftBackup = Readonly<{
  format: string;
  schemaVersion: number;
  source: Readonly<Record<string, unknown>>;
  binding: Readonly<Record<string, unknown>>;
  inputSnapshot: Readonly<{ payload: Record<string, unknown> }>;
  lifecycle: Readonly<Record<string, unknown>>;
  integrity: Readonly<{ sourceSha256: string }>;
}>;

const base = '/api/approvals/v1';
const id = '10101010-1010-4010-8010-101010101010';
const migratedId = '12121212-1212-4212-8212-121212121212';
const targetFormId = '13131313-1313-4313-8313-131313131313';
const targetFormVersionId = '14141414-1414-4414-8414-141414141414';
const targetWorkflowId = '15151515-1515-4515-8515-151515151515';
const targetWorkflowVersionId = '16161616-1616-4616-8616-161616161616';
const sourceFormId = '19191919-1919-4919-8919-191919191919';
const sourceFormVersionId = '21212121-2121-4121-8121-212121212121';
const sourceWorkflowId = '20202020-2020-4020-8020-202020202020';
const targetFormHash = '8'.repeat(64);
const targetWorkflowHash = '9'.repeat(64);
const at = '2026-09-14T00:00:00Z';
function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}
function pageResult(items: unknown[], size = 20) {
  return {
    items,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    page: 0,
    size,
    hasNext: false,
    evaluatedAt: at,
  };
}

async function setup(
  page: Page,
  options: { loseDeleteResponse?: boolean; migrationUnavailableOnce?: boolean } = {}
) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  let version = 3;
  let deleted = false;
  let title = APPROVAL_REQUEST_FIXTURE.title;
  let nextDetail: 'CURRENT' | 'STALE' | 'DENIED' = 'CURRENT';
  const commands: { kind: string; body: Record<string, unknown> }[] = [];
  const migrationCommands: { key?: string; body: Record<string, unknown> }[] = [];
  let migrationPreviewChanged = false;
  const request = () => ({
    ...APPROVAL_REQUEST_FIXTURE,
    requestId: id,
    status: 'DRAFT',
    version,
    title,
  });
  const state = () => ({
    requestId: id,
    version,
    payloadRevision: 2,
    deletedAt: deleted ? at : null,
    deletedBy: deleted ? 1 : null,
  });
  const revision = (number: number) => ({
    revision: number,
    payloadSha256: 'a'.repeat(64),
    changeType: number === 2 ? 'DRAFT_UPDATED' : 'DRAFT_CREATED',
    changedBy: 1,
    reason: 'Saved draft revision',
    createdAt: at,
    recoverable: number === 2,
    recoveryReason: number === 1 ? 'LEGACY_NO_DRAFT_SNAPSHOT' : null,
  });
  await page.route(
    (url) => url.pathname === `${base}/requests/search`,
    (route) => {
      const view = new URL(route.request().url()).searchParams.get('view');
      return success(route, pageResult((view === 'DELETED') === deleted ? [request()] : []));
    }
  );
  await page.route(
    (url) => url.pathname === `${base}/catalog/forms`,
    (route) =>
      success(route, [
        {
          ...APPROVAL_FORM_FIXTURE,
          formId: targetFormId,
          nameKo: '현재 운영 권한 연장 신청서',
          nameEn: 'Current access extension form',
          lifecycleState: 'PUBLISHED',
          currentVersion: 7,
        },
      ])
  );
  await page.route(
    (url) => url.pathname === `${base}/catalog/forms/${targetFormId}/template`,
    (route) =>
      success(route, {
        workflow: {
          ...APPROVAL_WORKFLOW_FIXTURE,
          workflowId: targetWorkflowId,
          nameKo: '현재 운영 권한 결재 경로',
          nameEn: 'Current access approval route',
          lifecycleState: 'PUBLISHED',
          currentVersion: 9,
        },
        routeDefinition: APPROVAL_WORKFLOW_DETAIL_FIXTURE.definition,
        form: {
          ...APPROVAL_FORM_DETAIL_FIXTURE,
          form: {
            ...APPROVAL_FORM_FIXTURE,
            formId: targetFormId,
            nameKo: '현재 운영 권한 연장 신청서',
            nameEn: 'Current access extension form',
          },
          formVersionId: targetFormVersionId,
          schemaHash: targetFormHash,
        },
      })
  );
  const targetBinding = () => ({
    formId: targetFormId,
    formVersionId: migrationPreviewChanged
      ? '17171717-1717-4717-8717-171717171717'
      : targetFormVersionId,
    formVersion: migrationPreviewChanged ? 8 : 7,
    formSchemaSha256: migrationPreviewChanged ? 'a'.repeat(64) : targetFormHash,
    formNameKo: '현재 운영 권한 연장 신청서',
    formNameEn: 'Current access extension form',
    workflowId: targetWorkflowId,
    workflowVersionId: targetWorkflowVersionId,
    workflowVersion: 9,
    workflowDefinitionSha256: targetWorkflowHash,
    workflowNameKo: '현재 운영 권한 결재 경로',
    workflowNameEn: 'Current access approval route',
  });
  await page.route(
    (url) => url.pathname === `${base}/requests/${id}/draft/migration-preview`,
    (route) => {
      const query = new URL(route.request().url()).searchParams;
      expect(query.get('targetFormId')).toBe(targetFormId);
      expect(query.get('targetWorkflowId')).toBe(targetWorkflowId);
      return success(route, {
        sourceRequestId: id,
        sourceVersion: version,
        source: {
          formId: sourceFormId,
          formVersionId: sourceFormVersionId,
          formVersion: 2,
          formSchemaSha256: '7'.repeat(64),
          formNameKo: '폐기된 운영 권한 신청서',
          formNameEn: 'Retired access form',
          workflowId: sourceWorkflowId,
          workflowVersionId: '18181818-1818-4818-8818-181818181818',
          workflowVersion: 2,
          workflowDefinitionSha256: '6'.repeat(64),
          workflowNameKo: '폐기된 결재 경로',
          workflowNameEn: 'Retired approval route',
        },
        target: targetBinding(),
        migrationRequired: true,
        routeCompatible: true,
        mappedFields: ['summary', 'amount'],
        droppedFields: ['legacyCostCode'],
        incompatibleFields: [],
        requiredFieldsToComplete: ['costCenter'],
        evaluatedAt: at,
      });
    }
  );
  await page.route(
    (url) => url.pathname === `${base}/requests/${id}/draft/migrate`,
    (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      migrationCommands.push({ key: route.request().headers()['idempotency-key'], body });
      if (options.migrationUnavailableOnce && migrationCommands.length === 1) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Authority temporarily unavailable' }),
        });
      }
      return success(route, {
        draft: {
          ...request(),
          requestId: migratedId,
          requestNumber: 'APR-MIGRATED-1',
          workflowNameKo: '현재 운영 권한 결재 경로',
          workflowNameEn: 'Current access approval route',
          version: 0,
        },
        sourceRequestId: id,
        sourceVersion: version,
        target: targetBinding(),
        mappedFields: ['summary', 'amount'],
        droppedFields: ['legacyCostCode'],
        incompatibleFields: [],
        requiredFieldsToComplete: ['costCenter'],
      });
    }
  );
  await page.route(
    (url) => url.pathname === `${base}/requests/${id}/detail`,
    (route) => {
      const result = nextDetail;
      nextDetail = 'CURRENT';
      if (result === 'DENIED') {
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Owner authority changed' }),
        });
      }
      return deleted
        ? route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'ERROR', message: 'Deleted draft not available' }),
          })
        : success(route, {
            ...APPROVAL_REQUEST_DETAIL_FIXTURE,
            request: {
              ...request(),
              version: result === 'STALE' ? version + 1 : version,
            },
            formVersionId: '00000000-0000-0000-0000-000000000703',
            formSchemaSha256: '7'.repeat(64),
          });
    }
  );
  await page.route(
    (url) => url.pathname === `${base}/requests/${id}/draft/revisions`,
    (route) => success(route, pageResult([revision(2), revision(1)], 10))
  );
  await page.route(
    (url) => url.pathname.startsWith(`${base}/requests/${id}/draft/revisions/`),
    (route) => {
      const number = Number(new URL(route.request().url()).pathname.split('/').at(-1));
      return success(route, {
        revision: revision(number),
        payload: APPROVAL_REQUEST_DETAIL_FIXTURE.payload,
        draftSnapshot:
          number === 2
            ? {
                workflowId: APPROVAL_REQUEST_DETAIL_FIXTURE.workflowId,
                formId: APPROVAL_REQUEST_DETAIL_FIXTURE.formId,
                title: '이력에서 복구한 초안',
                summary: '저장된 이전 입력 내용',
              }
            : {},
      });
    }
  );
  await page.route(
    (url) => /\/draft\/(delete|restore|recover)$/u.test(url.pathname),
    (route) => {
      const kind = new URL(route.request().url()).pathname.split('/').at(-1)!;
      const body = route.request().postDataJSON() as Record<string, unknown>;
      commands.push({ kind, body });
      expect(body.expectedVersion).toBe(version);
      expect(route.request().headers()['idempotency-key']).toBe(body.idempotencyKey);
      version += 1;
      if (kind === 'delete') deleted = true;
      if (kind === 'restore') deleted = false;
      if (kind === 'recover') title = '이력에서 복구한 초안';
      if (kind === 'delete' && options.loseDeleteResponse) return route.abort('connectionfailed');
      return success(route, state());
    }
  );
  await page.route(
    (url) => url.pathname.startsWith(`${base}/draft-commands/`),
    (route) => {
      const key = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1)!);
      const command = commands.find((entry) => entry.body.idempotencyKey === key);
      return success(route, {
        idempotencyKey: key,
        receipts: command
          ? [
              {
                commandType: command.kind.toUpperCase(),
                route: `POST /v1/requests/${id}/draft/${command.kind}`,
                draft: state(),
                completedAt: at,
              },
            ]
          : [],
      });
    }
  );
  return {
    commands,
    migrationCommands,
    changeMigrationPreview: () => {
      migrationPreviewChanged = true;
    },
    failNextBackupRead: (result: 'STALE' | 'DENIED') => {
      nextDetail = result;
    },
  };
}

async function openMobilePreview(page: Page, title = APPROVAL_REQUEST_FIXTURE.title) {
  if (page.viewportSize()!.width < 1200) {
    await page
      .locator('main')
      .getByRole('list')
      .filter({ hasText: title })
      .getByRole('button')
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: '결재 상세' })).toBeVisible();
  }
}

test('초안은 사유와 최신 버전에 결속해 휴지통으로 이동하고 동일 문서로 복원된다', async ({
  page,
}) => {
  const { commands } = await setup(page);
  await page.goto('/approvals/requests/drafts');
  await openMobilePreview(page);
  const remove = page.getByRole('button', { name: '초안 휴지통으로 이동' });
  await expect(remove).toBeEnabled();
  await expect(page.locator('.MuiTouchRipple-childLeaving')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('draft-workspace.png'), fullPage: false });
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(
    a11y.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))
  ).toEqual([]);
  await remove.click();
  const dialog = page.getByRole('dialog', { name: '초안을 휴지통으로 이동할까요?' });
  await dialog.getByLabel('변경 사유').fill('중복 작성한 초안을 복원 가능하도록 정리합니다.');
  await dialog.getByRole('button', { name: '초안 휴지통으로 이동' }).dblclick();
  await expect(dialog).not.toBeVisible();
  expect(commands).toHaveLength(1);
  expect(commands[0]!.body).toMatchObject({
    expectedVersion: 3,
    reason: '중복 작성한 초안을 복원 가능하도록 정리합니다.',
  });
  await page.getByRole('tab', { name: '휴지통' }).click();
  await openMobilePreview(page);
  await page.getByRole('button', { name: '초안 복원' }).click();
  const restore = page.getByRole('dialog', { name: '초안을 복원할까요?' });
  await restore.getByLabel('변경 사유').fill('중복이 아니어서 작성 중인 초안으로 복원합니다.');
  await restore.getByRole('button', { name: '초안 복원' }).click();
  await expect(restore).not.toBeVisible();
  expect(commands).toHaveLength(2);
  expect(commands[1]!.body.expectedVersion).toBe(4);
  await page.getByRole('tab', { name: '작성 중' }).click();
  await expect(page.locator('main')).toContainText(APPROVAL_REQUEST_FIXTURE.requestNumber);
});

test('수정 이력은 실제 스냅샷을 미리보고 legacy 복구를 막으며 복구는 새 버전을 만든다', async ({
  page,
}) => {
  const { commands } = await setup(page);
  await page.goto('/approvals/requests/drafts');
  await openMobilePreview(page);
  const history = page.getByRole('region', { name: '수정 이력' });
  await history.getByRole('button').filter({ hasText: '리비전 1' }).click();
  await expect(history).toContainText('이전 입력에 전체 초안 스냅샷이 없어');
  await expect(history.getByRole('button', { name: '이 버전으로 복구' })).toHaveCount(0);
  await history.getByRole('button').filter({ hasText: '리비전 2' }).click();
  await expect(history).toContainText('이력에서 복구한 초안');
  await history.getByRole('button', { name: '이 버전으로 복구' }).click();
  const dialog = page.getByRole('dialog', { name: '이 버전으로 초안을 복구할까요?' });
  await dialog.getByLabel('변경 사유').fill('확인한 이전 입력으로 새 초안 버전을 복구합니다.');
  await dialog.getByRole('button', { name: '이 버전으로 복구' }).click();
  await expect(dialog).not.toBeVisible();
  expect(commands).toHaveLength(1);
  expect(commands[0]!.body).toMatchObject({ expectedVersion: 3, revision: 2 });
  await expect(page.locator('main')).toContainText('이력에서 복구한 초안');
});

test('삭제 응답 유실은 원래 명령 receipt를 확인하기 전 재삭제를 차단한다', async ({ page }) => {
  const { commands } = await setup(page, { loseDeleteResponse: true });
  await page.goto('/approvals/requests/drafts');
  await openMobilePreview(page);
  await page.getByRole('button', { name: '초안 휴지통으로 이동' }).click();
  const dialog = page.getByRole('dialog', { name: '초안을 휴지통으로 이동할까요?' });
  await dialog.getByLabel('변경 사유').fill('결과 확인이 필요한 휴지통 이동');
  await dialog.getByRole('button', { name: '초안 휴지통으로 이동' }).click();
  await expect(dialog).toContainText('변경 결과가 불명확합니다');
  await expect(dialog.getByRole('button', { name: '초안 휴지통으로 이동' })).toBeDisabled();
  await dialog.getByRole('button', { name: '저장 결과 확인' }).click();
  await expect(dialog).not.toBeVisible();
  expect(commands).toHaveLength(1);
});

test('소유자 최신 초안은 버전·양식·워크플로·입력에 결속된 실제 UTF-8 JSON으로 백업한다', async ({
  page,
}) => {
  const { commands } = await setup(page);
  await page.goto('/approvals/requests/drafts');
  await openMobilePreview(page);
  const button = page.getByRole('button', { name: 'JSON 데이터 백업', exact: true });
  await expect(button).toBeEnabled();
  const downloaded = page.waitForEvent('download');
  await button.dblclick();
  const download = await downloaded;
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Actual draft backup download missing');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  const backup = JSON.parse(bytes.toString('utf8')) as DownloadedDraftBackup;

  expect(download.suggestedFilename()).toMatch(/^dwp-approval-draft-.*-v3\.json$/u);
  expect(backup).toMatchObject({
    format: 'DWP_APPROVAL_DRAFT_BACKUP',
    schemaVersion: 1,
    source: {
      authority: 'CURRENT_OWNER_DETAIL_REVALIDATED',
      requestId: id,
      expectedVersion: 3,
      status: 'DRAFT',
    },
    binding: {
      workflowId: APPROVAL_REQUEST_DETAIL_FIXTURE.workflowId,
      formId: APPROVAL_REQUEST_DETAIL_FIXTURE.formId,
      formVersionId: '00000000-0000-0000-0000-000000000703',
      formSchemaSha256: '7'.repeat(64),
    },
    inputSnapshot: { payload: APPROVAL_REQUEST_DETAIL_FIXTURE.payload },
    lifecycle: {
      discardContract: 'RESTORABLE_SOFT_DELETE',
      physicalDeletionPerformed: false,
      revisionHistoryPreserved: true,
    },
  });
  expect(backup.integrity.sourceSha256).toMatch(/^[0-9a-f]{64}$/u);
  expect(commands).toHaveLength(0);
});

for (const [failure, message] of [
  ['STALE', '서버 초안이 목록 또는 미리보기 이후 변경되었습니다'],
  ['DENIED', '현재 계정의 초안 소유권 또는 열람 권한을 확인할 수 없어'],
] as const) {
  test(`${failure} 최신 소유자 재검증 실패는 파일과 변경 요청을 모두 차단한다`, async ({
    page,
  }) => {
    const state = await setup(page);
    let downloads = 0;
    page.on('download', () => {
      downloads += 1;
    });
    await page.goto('/approvals/requests/drafts');
    await openMobilePreview(page);
    const backup = page.getByRole('button', { name: 'JSON 데이터 백업', exact: true });
    await expect(backup).toBeEnabled();
    state.failNextBackupRead(failure);
    await backup.click();
    await expect(page.locator('main')).toContainText(message);
    expect(downloads).toBe(0);
    expect(state.commands).toHaveLength(0);
  });
}

async function openDraftMigration(page: Page) {
  await openMobilePreview(page);
  await page.getByRole('button', { name: '최신 양식으로 복구' }).click();
  const dialog = page.getByRole('dialog', {
    name: '현재 게시 양식으로 초안을 복구할까요?',
  });
  await dialog.getByLabel('복구 대상 게시 양식').click();
  await page.getByRole('option', { name: '현재 운영 권한 연장 신청서', exact: true }).click();
  await expect(dialog).toContainText('현재 게시 버전과 결재 경로로 복구할 수 있습니다');
  return dialog;
}

test('폐기 양식 초안은 필드 손실을 미리 고지하고 현재 게시 버전에 별도 초안으로 복구한다', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/approvals/requests/drafts');
  const dialog = await openDraftMigration(page);
  await expect(dialog).toContainText('legacyCostCode');
  await expect(dialog).toContainText('costCenter');
  const a11y = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(
    a11y.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))
  ).toEqual([]);
  await dialog
    .getByLabel('복구 사유')
    .fill('폐기된 양식을 현재 게시 버전으로 안전하게 전환합니다.');
  await dialog.getByRole('button', { name: '새 복구 초안 만들기' }).click();

  await expect(page).toHaveURL(new RegExp(`/approvals/requests/new\\?draft=${migratedId}$`, 'u'));
  expect(state.migrationCommands).toHaveLength(1);
  expect(state.migrationCommands[0]!.body).toMatchObject({
    expectedVersion: 3,
    targetFormId,
    targetFormVersionId,
    targetFormSchemaSha256: targetFormHash,
    targetWorkflowId,
    targetWorkflowVersionId,
    targetWorkflowDefinitionSha256: targetWorkflowHash,
    reason: '폐기된 양식을 현재 게시 버전으로 안전하게 전환합니다.',
  });
});

test('미리보기 뒤 대상 게시 버전이 바뀌면 입력을 보존하고 migration POST를 보내지 않는다', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/approvals/requests/drafts');
  const dialog = await openDraftMigration(page);
  await dialog.getByLabel('복구 사유').fill('대상 버전 변경을 검증합니다.');
  state.changeMigrationPreview();
  await dialog.getByRole('button', { name: '새 복구 초안 만들기' }).click();

  await expect(dialog).toContainText('원본 초안 또는 대상 게시 버전이 변경되었습니다');
  await expect(dialog.getByLabel('복구 사유')).toHaveValue('대상 버전 변경을 검증합니다.');
  expect(state.migrationCommands).toHaveLength(0);
});

test('503 결과 불명 상태는 같은 원래 idempotency key로만 재시도해 중복 초안을 막는다', async ({
  page,
}) => {
  const state = await setup(page, { migrationUnavailableOnce: true });
  await page.goto('/approvals/requests/drafts');
  const dialog = await openDraftMigration(page);
  await dialog.getByLabel('복구 사유').fill('동일 명령 재시도 계약을 검증합니다.');
  await dialog.getByRole('button', { name: '새 복구 초안 만들기' }).click();

  await expect(dialog).toContainText('현재 권한 또는 명령 결과를 확인할 수 없습니다');
  await dialog.getByRole('button', { name: '원래 명령 다시 확인' }).click();
  await expect(page).toHaveURL(new RegExp(`/approvals/requests/new\\?draft=${migratedId}$`, 'u'));
  expect(state.migrationCommands).toHaveLength(2);
  expect(state.migrationCommands[0]!.key).toBeTruthy();
  expect(state.migrationCommands[1]!.key).toBe(state.migrationCommands[0]!.key);
  expect(state.migrationCommands[1]!.body).toEqual(state.migrationCommands[0]!.body);
});
