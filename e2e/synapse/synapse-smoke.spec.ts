/**
 * Synapse E2E Smoke Tests
 *
 * tenant=1 기준 최소 10개 시나리오
 * @see docs/reference/SYNAPSEX_CONTRACT_AND_VERIFICATION_SPEC.md
 *
 * Run: yarn playwright test e2e/synapse/synapse-smoke.spec.ts
 */

import { test, expect } from '@playwright/test';

import { ensureAuth } from '../utils/auth';
import { SYNAPSE_ROUTES } from '../utils/routes';

test.describe('Synapse Smoke - Cases', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuth(page);
  });

  test('1. Cases list loads', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.cases);
    await expect(page.getByText(/Case Worklist|Anomaly Detection|Cases/i)).toBeVisible({ timeout: 15000 });
    // Table or empty state - no 500
    const hasTable = await page.locator('table').count() > 0;
    const hasEmpty = await page.getByText(/No cases|empty|0 cases/i).count() > 0;
    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('2. Case detail 3-panel - first row click', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.cases);
    const firstRow = page.locator('table tbody tr').first();
    const rowCount = await page.locator('table tbody tr').count();
    if (rowCount > 0) {
      await firstRow.click();
      await expect(page).toHaveURL(/\/synapse\/cases\/[^/]+/);
      await expect(page.getByText(/Case|Overview|Related|Agent|Simulation/i)).toBeVisible({ timeout: 10000 });
    } else {
      // Empty state - no 500
      await expect(page.getByText(/No cases|empty|0 cases/i)).toBeVisible();
    }
  });
});

test.describe('Synapse Smoke - Lineage', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuth(page);
  });

  test('3. View Lineage from case detail', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.cases);
    const firstRow = page.locator('table tbody tr').first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();
      const lineageLink = page.getByRole('link', { name: /View Lineage|Lineage/i });
      if ((await lineageLink.count()) > 0) {
        await lineageLink.click();
        await expect(page).toHaveURL(/\/synapse\/lineage/);
      }
    }
  });
});

test.describe('Synapse Smoke - Entities', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuth(page);
  });

  test('4. Entities list loads', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.entities);
    await expect(page.getByText(/Entities|Entity|Master/i)).toBeVisible({ timeout: 15000 });
  });

  test('5. Entity detail - Related Docs tab', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.entities);
    const firstRow = page.locator('table tbody tr, [role="row"]').first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();
      const relatedTab = page.getByRole('tab', { name: /Related Docs|Documents/i });
      if ((await relatedTab.count()) > 0) {
        await relatedTab.click();
      }
    }
  });
});

test.describe('Synapse Smoke - Actions', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuth(page);
  });

  test('6. Actions list loads', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.actions);
    await expect(page.getByText(/Action|Queue|Center/i)).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Synapse Smoke - Audit', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuth(page);
  });

  test('7. Audit page loads and filters', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.audit);
    await expect(page.getByText(/Audit|Trail|Events/i)).toBeVisible({ timeout: 15000 });
    const filterBtn = page.getByRole('button', { name: /Type|Category|Filter/i });
    if ((await filterBtn.count()) > 0) {
      await filterBtn.first().click();
    }
  });

  test('8. Audit event expand', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.audit);
    const eventRow = page.locator('[role="button"], .MuiCollapse-root').first();
    if ((await eventRow.count()) > 0) {
      await eventRow.click();
    }
  });
});

test.describe('Synapse Smoke - Documents & Anomalies', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuth(page);
  });

  test('9. Documents list loads', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.documents);
    await expect(page.getByText(/Document|FI|Doc/i)).toBeVisible({ timeout: 15000 });
  });

  test('10. Anomalies list loads', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.anomalies);
    await expect(page.getByText(/Anomaly|Detection|Total anomalies/i)).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Synapse Smoke - Reconciliation', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuth(page);
  });

  test('11. Reconciliation 2 tabs', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.reconciliation);
    await expect(page.getByText(/Reconciliation|Ingestion|Integrity/i)).toBeVisible({ timeout: 15000 });
    const ingestionTab = page.getByRole('tab', { name: /Ingestion Health/i });
    const integrityTab = page.getByRole('tab', { name: /Integrity Report/i });
    if ((await ingestionTab.count()) > 0) await ingestionTab.click();
    if ((await integrityTab.count()) > 0) await integrityTab.click();
  });
});

test.describe('Synapse Smoke - Action Recon', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuth(page);
  });

  test('12. Action-recon page loads', async ({ page }) => {
    await page.goto(SYNAPSE_ROUTES.actionRecon);
    await expect(page.getByText(/Action Reconciliation|Outcomes|Success/i)).toBeVisible({ timeout: 15000 });
  });
});
