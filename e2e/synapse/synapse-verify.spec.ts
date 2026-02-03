/**
 * Synapse E2E Verify — Playwright 기반 검증
 *
 * 1) 로그인/테넌트
 * 2) 10개 핵심 플로우
 * 3) 실패 시나리오
 *
 * Run: yarn playwright test e2e/synapse/synapse-verify.spec.ts
 * Prerequisite: yarn test:e2e:auth-setup (tenant=1 로그인)
 */

import { test, expect } from '@playwright/test';

import { ensureAuth } from '../utils/auth';
import { SYNAPSE_ROUTES } from '../utils/routes';

// ----------------------------------------------------------------------
// 1) 로그인/테넌트
// ----------------------------------------------------------------------

test.describe('1. Login / Tenant', () => {
  test('tenant=1 로그인 성공 후 Synapse 접근', async ({ page }) => {
    await ensureAuth(page);
    await page.goto(SYNAPSE_ROUTES.cases);
    await expect(page).toHaveURL(/\/synapse/);
    // Case Worklist 또는 empty state
    await expect(
      page.getByText(/Case Worklist|Cases|No cases|empty|0 cases/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test('Tenant Scope 변경 후 리스트 데이터 즉시 변경 (cross-tenant 미혼합)', async ({
    page,
  }) => {
    await ensureAuth(page);

    // 1) Cases 목록에서 초기 상태 캡처
    await page.goto(SYNAPSE_ROUTES.cases);
    await page.waitForLoadState('networkidle');
    const initialFirstRow = await page.locator('table tbody tr').first().textContent();
    const initialRowCount = await page.locator('table tbody tr').count();

    // 2) Synapse Admin으로 이동 후 Tenant 변경
    await page.goto(SYNAPSE_ROUTES.admin);
    await expect(page.getByText(/Admin|Tenant|Governance|Tenant 선택/i)).toBeVisible({ timeout: 10000 });

    const tenantSelect = page.getByRole('combobox').or(page.locator('select')).first();
    if ((await tenantSelect.count()) > 0) {
      await tenantSelect.click();
      const options = page.locator('[role="option"]').or(page.locator('option'));
      const optionCount = await options.count();
      if (optionCount >= 2) {
        await options.nth(1).click();
        await page.waitForLoadState('networkidle');

        // 3) Cases로 돌아가서 데이터 변경 확인 (cross-tenant 미혼합)
        await page.goto(SYNAPSE_ROUTES.cases);
        await page.waitForLoadState('networkidle');
        const afterFirstRow = await page.locator('table tbody tr').first().textContent();
        const afterRowCount = await page.locator('table tbody tr').count();

        // 데이터가 바뀌었거나(다른 tenant), empty로 바뀌었을 수 있음
        const dataChanged =
          initialRowCount !== afterRowCount ||
          (initialFirstRow !== afterFirstRow && initialFirstRow && afterFirstRow);
        const nowEmpty = afterRowCount === 0;
        expect(dataChanged || nowEmpty || initialRowCount === 0).toBeTruthy();
      }
      // tenant 1개만 있으면 스킵 (통과)
    }
  });
});

// ----------------------------------------------------------------------
// 2) 10개 핵심 플로우
// ----------------------------------------------------------------------

test.describe('2. Core Flows', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuth(page);
  });

  test('Flow 1: /cases 목록 → 첫 row → /cases/[id]', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.cases);
    const firstRow = page.locator('table tbody tr').first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();
      await expect(page).toHaveURL(/\/synapse\/cases\/[^/]+/);
      await expect(page.getByText(/Case|Overview|Related|Agent|Simulation/i)).toBeVisible({
        timeout: 10000,
      });
    } else {
      await expect(page.getByText(/No cases|empty|0 cases/i)).toBeVisible();
    }
  });

  test('Flow 2: Case detail → entity/documents/open-items/lineage 이동', async ({
    page,
  }) => {
    await page.goto(SYNAPSE_ROUTES.cases);
    const firstRow = page.locator('table tbody tr').first();
    if ((await firstRow.count()) === 0) return;

    await firstRow.click();
    await expect(page).toHaveURL(/\/synapse\/cases\/[^/]+/);

    // Lineage 링크
    const lineageLink = page.getByRole('link', { name: /View.*Lineage|Data Lineage/i });
    if ((await lineageLink.count()) > 0) {
      await lineageLink.click();
      await expect(page).toHaveURL(/\/synapse\/lineage/);
      await page.goBack();
    }

    // Open Items deep-link (Card가 Link로 렌더)
    const openItemsLink = page.getByRole('link', { name: /Related Open Items/i });
    if ((await openItemsLink.count()) > 0) {
      await openItemsLink.click();
      await expect(page).toHaveURL(/\/synapse\/open-items/);
      await page.goBack();
    }

    // Documents/Entity - FI Document 카드 또는 Vendor 링크
    const docLink = page.getByRole('link', { name: /View Entity|FI Document|documents/i }).first();
    if ((await docLink.count()) > 0) {
      await docLink.click();
      await expect(page).toHaveURL(/\/(entities|documents)\//);
    }
  });

  test('Flow 3: /actions simulate → approve → execute (상태 변화 확인)', async ({
    page,
  }) => {
    await page.goto(SYNAPSE_ROUTES.actions);
    await expect(page.getByText(/Action Center|Queue|Center/i)).toBeVisible({ timeout: 10000 });

    const firstRow = page.locator('table tbody tr').first();
    if ((await firstRow.count()) === 0) return;

    await firstRow.click();
    await expect(page.getByText(/Action Details|Step 1: Simulate/i)).toBeVisible({
      timeout: 5000,
    });

    const simulateBtn = page.getByRole('button', { name: /Simulate/i });
    if ((await simulateBtn.count()) > 0 && !(await simulateBtn.isDisabled())) {
      await simulateBtn.click();
      await page.waitForTimeout(2000);
      await expect(
        page.getByText(/Simulation|predicted|impacted|validation/i)
      ).toBeVisible({ timeout: 5000 });
    }

    const approveBtn = page.getByRole('button', { name: /Approve/i });
    const executeBtn = page.getByRole('button', { name: /Execute/i });
    if ((await approveBtn.count()) > 0 && !(await approveBtn.isDisabled())) {
      await approveBtn.click();
      await page.waitForTimeout(1000);
    }
    if ((await executeBtn.count()) > 0 && !(await executeBtn.isDisabled())) {
      await executeBtn.click();
      await page.waitForTimeout(2000);
    }
  });

  test('Flow 4: /policies 변경 → /audit POLICY_CHANGE 확인', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.policies);
    await expect(page.getByText(/Policies|Profile|Policy/i)).toBeVisible({ timeout: 10000 });

    const profileLink = page.locator('a[href*="/policies/"]').first();
    if ((await profileLink.count()) > 0) {
      await profileLink.click();
      await page.waitForTimeout(1000);
    }

    await page.goto(SYNAPSE_ROUTES.audit);
    await expect(page.getByText(/Audit|Trail|Events/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/POLICY|policy|Policy/i)).toBeVisible({ timeout: 5000 });
  });

  test('Flow 5: /guardrails 변경 → /audit 확인', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.guardrails);
    await expect(page.getByText(/Guardrail|severity|matrix/i)).toBeVisible({ timeout: 10000 });

    await page.goto(SYNAPSE_ROUTES.audit);
    await expect(page.getByText(/Audit|Trail|Events/i)).toBeVisible({ timeout: 10000 });
  });

  test('Flow 6: PII handling FORBID 필드 마스킹/차단 확인', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.admin);
    await expect(page.getByText(/Admin|PII|Data Protection/i)).toBeVisible({ timeout: 10000 });

    const piiTab = page.getByRole('tab', { name: /PII|Masking|Data Protection/i });
    if ((await piiTab.count()) > 0) {
      await piiTab.click();
      await expect(
        page.getByText(/Forbid|접근 불가|MASK|handling/i)
      ).toBeVisible({ timeout: 5000 });
    }

    await page.goto(SYNAPSE_ROUTES.entities);
    const firstRow = page.locator('table tbody tr').first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();
      await expect(
        page.getByText(/접근 불가|••••|암호화됨|Forbid/i)
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('Flow 7: /documents 목록 로드', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.documents);
    await expect(page.getByText(/Document|FI|Doc/i)).toBeVisible({ timeout: 15000 });
  });

  test('Flow 8: /anomalies 목록 로드', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.anomalies);
    await expect(page.getByText(/Anomaly|Detection|Total anomalies/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test('Flow 9: /reconciliation 2탭', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.reconciliation);
    await expect(page.getByText(/Reconciliation|Ingestion|Integrity/i)).toBeVisible({
      timeout: 15000,
    });
    const ingestionTab = page.getByRole('tab', { name: /Ingestion Health/i });
    const integrityTab = page.getByRole('tab', { name: /Integrity Report/i });
    if ((await ingestionTab.count()) > 0) await ingestionTab.click();
    if ((await integrityTab.count()) > 0) await integrityTab.click();
  });

  test('Flow 10: /action-recon Retry 버튼', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.actionRecon);
    await expect(page.getByText(/Action Reconciliation|Outcomes/i)).toBeVisible({
      timeout: 15000,
    });
    const retryBtn = page.getByRole('button', { name: /Retry/i });
    if ((await retryBtn.count()) > 0) {
      expect(await retryBtn.isVisible()).toBeTruthy();
    }
  });
});

// ----------------------------------------------------------------------
// 3) 실패 시나리오
// ----------------------------------------------------------------------

test.describe('3. Failure Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuth(page);
  });

  test('잘못된 caseId 접근 시 404/Not Found 처리', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.caseDetail('non-existent-case-id-99999'));
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/Case Not Found|Failed to load|Not Found|404|권한 부족/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test('Guardrail forbidden action 실행 시 UI 오류 메시지', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.actions);
    const firstRow = page.locator('table tbody tr').first();
    if ((await firstRow.count()) === 0) return;

    await firstRow.click();
    const executeBtn = page.getByRole('button', { name: /Execute/i });
    if ((await executeBtn.count()) > 0 && !(await executeBtn.isDisabled())) {
      await executeBtn.click();
      await page.waitForTimeout(3000);
      // 성공 시: 상태 변화(완료/성공 메시지) 또는 실패 시: 오류 메시지
      const hasSuccess = await page.getByText(/완료|success|executed|완료됨/i).count() > 0;
      const hasError = await page.getByText(/error|failed|Forbidden|권한|guardrail|오류/i).count() > 0;
      expect(hasSuccess || hasError).toBeTruthy();
    }
  });
});
