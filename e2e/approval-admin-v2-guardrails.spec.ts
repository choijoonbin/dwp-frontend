import { expect, test, type Page } from '@playwright/test';

import { IDS, mockAdminV2, type FixtureState } from './support/approval-admin-v2-fixtures';

async function expectUnavailableControl(page: Page, state: FixtureState, label: string) {
  const button = page.getByRole('button', { name: label, exact: true });
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();
  const describedBy = await button.getAttribute('aria-describedby');
  const reason = describedBy
    ? page.locator(`xpath=//*[@id=${JSON.stringify(describedBy)}]`)
    : button.locator('xpath=following-sibling::*[normalize-space()][1]');
  await expect(reason).toBeVisible();
  expect((await reason.textContent())?.trim().length).toBeGreaterThan(0);
  await button.evaluate((element: HTMLButtonElement) => element.click());
  expect(state.writes).toEqual([]);
}

test.describe('selected incident and audit detail fencing', () => {
  for (const detailStatus of [403, 409, 503] as const) {
    test(`APR-22 selected incident detail ${detailStatus} keeps recovery POST at zero`, async ({
      page,
    }) => {
      const state = await mockAdminV2(page, {
        selectedDetailStatus: detailStatus,
        multipleSelections: true,
      });
      await page.goto('/approvals/admin/operations');
      await page.getByRole('tab', { name: 'Incident recovery', exact: true }).click();
      await page.getByRole('button', { name: /Approval secondary provider lag/u }).click();
      await expect
        .poll(() =>
          state.requests.some(
            (request) =>
              request.path === `/api/approvals/v1/admin/operations/incidents/${IDS.incidentB}`
          )
        )
        .toBe(true);
      const stateTitle =
        detailStatus === 403
          ? 'Access denied'
          : detailStatus === 409
            ? 'Version conflict'
            : 'Source unavailable';
      await expect(page.getByText(stateTitle, { exact: true })).toBeVisible();
      expect(state.writes).toEqual([]);
    });
  }

  test('APR-22 selected incident loading keeps recovery POST at zero', async ({ page }) => {
    const loading = await mockAdminV2(page, {
      selectedDetailDelayMs: 1_500,
      multipleSelections: true,
    });
    await page.goto('/approvals/admin/operations');
    await page.getByRole('tab', { name: 'Incident recovery', exact: true }).click();
    await page.getByRole('button', { name: /Approval secondary provider lag/u }).click();
    await expect(page.getByText('Loading workspace', { exact: true })).toBeVisible();
    expect(loading.writes).toEqual([]);
  });

  test('APR-22 mismatched selected incident detail keeps recovery POST at zero', async ({
    page,
  }) => {
    const mismatch = await mockAdminV2(page, {
      mismatchIncidentDetail: true,
      multipleSelections: true,
    });
    await page.goto('/approvals/admin/operations');
    await page.getByRole('tab', { name: 'Incident recovery', exact: true }).click();
    await page.getByRole('button', { name: /Approval secondary provider lag/u }).click();
    await expect(page.getByText('Source unavailable', { exact: true })).toBeVisible();
    expect(mismatch.writes).toEqual([]);
  });

  test('APR-23 mismatched selected event detail keeps export POST at zero', async ({ page }) => {
    const state = await mockAdminV2(page, {
      mismatchAuditDetail: true,
      multipleSelections: true,
    });
    await page.goto('/approvals/admin/audit');
    await page.getByRole('button', { name: /REQUEST_REJECTED/u }).click();
    await expect(page.getByText('Source unavailable', { exact: true })).toBeVisible();
    expect(state.writes).toEqual([]);
  });

  test('APR-22 cancels an in-flight authority preflight when the selected incident changes', async ({
    page,
    isMobile,
  }) => {
    const state = await mockAdminV2(page, {
      blockAuthorityPreflight: true,
      multipleSelections: true,
    });
    await page.goto('/approvals/admin/operations');
    await page.getByRole('tab', { name: 'Incident recovery', exact: true }).click();
    await page.getByRole('tab', { name: /^Recovery plan/u }).click();
    if (isMobile) {
      await expect(
        page.getByRole('button', { name: 'Execution requires desktop review', exact: true })
      ).toBeDisabled();
      await page.getByRole('tab', { name: /^Incidents/u }).click();
      await page.getByRole('button', { name: /Approval secondary provider lag/u }).click();
      state.releaseAuthority();
      expect(
        state.evaluations.some(
          (evaluation) =>
            evaluation.routeContractKey === 'route.approvals.admin.incident-command.action'
        )
      ).toBe(false);
      expect(state.issuerRequests).toEqual([]);
      expect(state.writes).toEqual([]);
      return;
    }
    await page.getByRole('button', { name: 'Execute next recovery stage', exact: true }).click();
    await expect
      .poll(() =>
        state.evaluations.some(
          (evaluation) =>
            evaluation.routeContractKey === 'route.approvals.admin.incident-command.action'
        )
      )
      .toBe(true);

    await page.getByRole('tab', { name: /^Incidents/u }).click();
    await page.getByRole('button', { name: /Approval secondary provider lag/u }).click();
    state.releaseAuthority();
    await expect.poll(() => state.authorityResponses).toBe(1);

    await expect(
      page.getByRole('dialog', { name: 'Verify this high-risk action', exact: true })
    ).toHaveCount(0);
    expect(state.issuerRequests).toEqual([]);
    expect(state.writes).toEqual([]);
  });

  test('APR-23 cancels an in-flight authority preflight when the selected event changes', async ({
    page,
    isMobile,
  }) => {
    const state = await mockAdminV2(page, {
      blockAuthorityPreflight: true,
      multipleSelections: true,
    });
    await page.goto('/approvals/admin/audit');
    await page.getByRole('tab', { name: /^Export evidence/u }).click();
    if (isMobile) {
      await expect(
        page.getByRole('button', { name: 'Export requires desktop review', exact: true })
      ).toBeDisabled();
      await page.getByRole('tab', { name: /^Audit explorer/u }).click();
      await page.getByRole('button', { name: /REQUEST_REJECTED/u }).click();
      state.releaseAuthority();
      expect(
        state.evaluations.some(
          (evaluation) =>
            evaluation.routeContractKey === 'route.approvals.admin.audit-export-create.action'
        )
      ).toBe(false);
      expect(state.issuerRequests).toEqual([]);
      expect(state.writes).toEqual([]);
      return;
    }
    await page.getByRole('button', { name: 'Prepare governed export', exact: true }).click();
    await expect
      .poll(() =>
        state.evaluations.some(
          (evaluation) =>
            evaluation.routeContractKey === 'route.approvals.admin.audit-export-create.action'
        )
      )
      .toBe(true);

    await page.getByRole('tab', { name: /^Audit explorer/u }).click();
    await page.getByRole('button', { name: /REQUEST_REJECTED/u }).click();
    state.releaseAuthority();
    await expect.poll(() => state.authorityResponses).toBe(1);

    await expect(
      page.getByRole('dialog', { name: 'Verify this high-risk action', exact: true })
    ).toHaveCount(0);
    expect(state.issuerRequests).toEqual([]);
    expect(state.writes).toEqual([]);
  });

  test('APR-23 rejects export when the selected event request binding changes at preflight', async ({
    page,
    isMobile,
  }) => {
    const state = await mockAdminV2(page, {
      driftAuditPreflightRequestBinding: true,
      multipleSelections: true,
    });
    await page.goto('/approvals/admin/audit');
    await page.getByRole('button', { name: /REQUEST_REJECTED/u }).click();
    await expect
      .poll(() =>
        state.requests.some(
          (request) =>
            request.path ===
            `/api/approvals/v1/admin/operations/audit-records/requests/${IDS.requestB}/retention-linkage`
        )
      )
      .toBe(true);
    await page.getByRole('tab', { name: /^Export evidence/u }).click();
    if (isMobile) {
      await expect(
        page.getByRole('button', { name: 'Export requires desktop review', exact: true })
      ).toBeDisabled();
      expect(state.issuerRequests).toEqual([]);
      expect(state.writes).toEqual([]);
      return;
    }
    await page.getByRole('button', { name: 'Prepare governed export', exact: true }).click();

    await expect(page.getByText('Source unavailable', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('dialog', { name: 'Verify this high-risk action', exact: true })
    ).toHaveCount(0);
    expect(state.issuerRequests).toEqual([]);
    expect(state.writes).toEqual([]);
  });
});

test.describe('control availability and fail-closed guardrails', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    void browserName;
    test.skip(testInfo.project.name !== 'chromium', 'desktop control inventory');
  });

  test('APR-17 package import is disabled with a visible reason and zero posts', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/forms');
    await page.getByRole('tab', { name: 'Template library', exact: true }).click();
    await expectUnavailableControl(page, state, 'Import package');
  });

  test('APR-18 add-field opens the local editor without posting before an explicit save', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/forms');
    await page.getByRole('tab', { name: 'Form Studio V3', exact: true }).click();
    await page.getByRole('button', { name: 'Add field', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Add field', exact: true })).toBeVisible();
    expect(state.writes).toEqual([]);
  });

  test('APR-19 remediation is visibly unavailable because no canonical command exists', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/routing');
    await page.getByRole('tab', { name: /^Exceptions/u }).click();
    await expectUnavailableControl(page, state, 'Review impact');
  });

  test('connector publication is disabled until a verified exact-revision probe exists', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/integrations');
    await expectUnavailableControl(page, state, 'Publish verified revision');
  });

  test('APR-20 delegation review is disabled until independent review evidence is collected', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/policies');
    await expectUnavailableControl(page, state, 'Open delegation governance');
  });

  test('APR-21 policy edit and publication are disabled until complete draft and review evidence exists', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/policies');
    await page
      .getByRole('tab')
      .filter({ hasText: /^Policies\s*1$/u })
      .click();
    await expectUnavailableControl(page, state, 'Edit policy draft');
    await expectUnavailableControl(page, state, 'Publish reviewed policy');
  });

  test('APR-22 queue pause is visibly unavailable because the owner API exposes no command', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/operations');
    await page.getByRole('tab', { name: 'Incident recovery', exact: true }).click();
    await page.getByRole('tab', { name: /^Queues/u }).click();
    await expectUnavailableControl(page, state, 'Pause queue');
  });

  test('APR-23 legal-hold controls remain disabled with owner-workspace guidance', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/audit');
    await page.getByRole('tab', { name: /^Retention linkage/u }).click();
    await expectUnavailableControl(page, state, 'Open retention controls');
  });

  test('APR-24 pause and rollback controls are both unavailable with explicit reasons', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/deployments');
    await page.getByRole('tab', { name: /^Activation evidence/u }).click();
    await expectUnavailableControl(page, state, 'Pause canary progression');
    await page.getByRole('tab', { name: /^Rollback assessment/u }).click();
    await expectUnavailableControl(page, state, 'Request governed rollback');
  });
});
