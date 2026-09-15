import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import {
  diagnosticCard,
  diagnosticFixtureSha,
  diagnosticOverview,
} from '../libs/shared-utils/src/api/approval-signature-diagnostics.test-support';
import { mockApprovalHighRiskNetwork } from './support/approval-high-risk';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import {
  approvalDocumentRequestDetail,
  approvalDocumentRequestId,
} from './support/approval-request-document-fixtures';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { mockShellSession } from './support/shell-session';

const base = '/api/approvals/v1';
const workScope = 'scope:approvals:self';
const signatureRequestId = '11111111-1111-4111-8111-111111111111';
const providerId = '22222222-2222-4222-8222-222222222222';
const policyId = '44444444-4444-4444-8444-444444444444';
const policyVersionId = '55555555-5555-4555-8555-555555555555';
const artifactId = '66666666-6666-4666-8666-666666666666';
const sourceSha = diagnosticFixtureSha;
const now = '2026-09-15T00:00:00Z';
const validUntil = '2030-09-15T00:00:00Z';

function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

function scope(revision: string) {
  return {
    ...diagnosticOverview().scope,
    contextScopeKey: workScope,
    decisionRevision: revision,
    registrySha256: revision.slice(4),
    sourceRevision: `sigp-${sourceSha}`,
    sourceSha256: sourceSha,
    evaluatedAt: now,
  };
}

function provider() {
  return {
    ...diagnosticCard('DOCUSIGN'),
    providerId,
    displayName: 'DocuSign Enterprise Verified Production Provider',
    providerVersion: 5,
    providerSha256: sourceSha,
    adapterInstalled: true,
    configurationRegistered: true,
    credentialRegistered: true,
    credentialVerified: true,
    requiredByPolicy: true,
    environment: 'PRODUCTION' as const,
    readiness: 'VERIFIED_PRODUCTION' as const,
    gateReasonCodes: [],
    lastProbeAt: now,
    checks: [],
  };
}

function externalContext(revision: string) {
  return {
    scope: scope(revision),
    source: {
      requestId: approvalDocumentRequestId,
      requestVersion: 3,
      resourceSetKey: 'RS_APPROVALS',
      dataClassification: 'CONFIDENTIAL',
      workflowVersionId: policyVersionId,
      formVersionId: policyId,
      payloadRevision: 1,
      payloadSha256: sourceSha,
      sourceSha256: sourceSha,
    },
    policy: {
      sourceState: 'AVAILABLE',
      pin: { sourceId: policyVersionId, version: 2, sha256: sourceSha },
      requiredProviderKinds: ['DOCUSIGN'],
      maxProbeAgeSeconds: 3600,
      probeIntervalSeconds: 300,
      retentionFloorSeconds: 31_536_000,
    },
    providers: [provider()],
    gateState: 'ELIGIBLE',
    reasonCodes: [],
    evaluatedAt: now,
  };
}

function externalRequest(revision: string, state: string, version: number) {
  const context = externalContext(revision);
  return {
    scope: context.scope,
    signatureRequestId,
    source: context.source,
    provider: {
      providerId,
      expectedProviderVersion: 5,
      expectedProviderSha256: sourceSha,
      expectedConfiguration: { sourceId: providerId, version: 5, sha256: sourceSha },
    },
    policyId,
    policyVersionId,
    policySha256: sourceSha,
    state,
    version,
    remoteReferenceSha256: state === 'COMPLETED_VERIFIED' ? sourceSha : null,
    reasonCodes: [],
    createdAt: now,
    updatedAt: '2026-09-15T00:00:01Z',
  };
}

function receipt(request: ReturnType<typeof externalRequest>) {
  return {
    receiptId: policyId,
    outcome: 'COMMITTED',
    committedAt: '2026-09-15T00:00:02Z',
    signatureRequest: request,
  };
}

function workDecision(revision: string, capability: string) {
  const selectedScope = {
    key: workScope,
    kind: 'SELF',
    displayName: '나의 결재',
    isDefault: true,
    readOnly: false,
    validUntil: null,
  };
  return {
    decision: 'ALLOWED',
    reasonCode: null,
    decisionRevision: revision,
    context: {
      contextKey: 'ctx:approvals:work',
      productKey: 'approvals',
      surfaceKey: 'approvals.work',
      plane: 'work',
      accessMode: 'NORMAL',
      accessSource: 'ENTITLEMENT',
      appResourceKey: 'APP.APPROVALS',
      effectiveGrants: [
        {
          grantKind: 'CAPABILITY',
          capabilityContractKey: capability,
          resolvedCapabilityCode: capability,
          authorityMode: 'PERMISSION_AND_RELATIONSHIP',
          predicatePolicyKeys: [],
          responsibilityRequirement: 'REQUIRED',
          responsibility: { code: 'REQUEST_OWNER', resourceSetKey: 'RS_APPROVALS' },
          scopeKeys: [workScope],
          requiresProductEntitlement: false,
          readOnly: false,
          activationState: 'ACTIVE',
          validUntil: null,
        },
      ],
      scopes: [selectedScope],
      revalidateAt: validUntil,
    },
    routeGrantRef: `grant:${capability}`,
    scope: selectedScope,
    effectiveReadOnly: false,
    validUntil: null,
    revalidateAt: validUntil,
  };
}

async function setup(page: Page, createFailure = false) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    userId: 1,
    permissions: [
      ...APPROVAL_MEMBER_PERMISSIONS,
      ...['UPDATE', 'SIGN'].map((permissionCode) => ({
        resourceType: 'ACTION',
        resourceKey: 'ACTION.APPROVAL_SIGNATURE',
        permissionCode,
        effect: 'ALLOW' as const,
      })),
    ],
  });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    management: false,
    work: true,
    rolloutState: '111',
    decisionRevisionFormat: 'sha256',
    generatedAt: now,
    revalidateAt: validUntil,
    workCapabilityKeys: [
      'approvals.work.request.read',
      'approvals.work.signature.read',
      'approvals.work.signature.update',
      'approvals.work.signature.sign',
    ],
  });
  const state = {
    request: null as ReturnType<typeof externalRequest> | null,
    writes: [] as Array<{
      path: string;
      body: Record<string, unknown>;
      headers: Record<string, string>;
    }>,
  };

  await page.route('**/api/auth/product-surface-access/evaluate', async (route) => {
    const body = route.request().postDataJSON() as { routeContractKey?: string };
    const routeKey = body.routeContractKey ?? '';
    if (routeKey === 'route.approvals.work.external-signature-handover.action') {
      await success(route, {
        decision: 'STEP_UP_REQUIRED',
        reasonCode: 'STEP_UP_REQUIRED',
        decisionRevision: authority.revision(),
        requiredAssurance: 'urn:dwp:assurance:high',
        revalidateAt: validUntil,
      });
      return;
    }
    const capability =
      routeKey.endsWith('request-create.action') ||
      routeKey.endsWith('refresh.action') ||
      routeKey.endsWith('cancel.action')
        ? 'approvals.work.signature.update'
        : null;
    if (capability) {
      await success(route, workDecision(authority.revision(), capability));
      return;
    }
    await route.fallback();
  });

  const detail = approvalDocumentRequestDetail();
  await page.route(
    (url) => url.pathname === `${base}/requests/search`,
    (route) =>
      success(route, {
        items: [detail.request],
        totalElements: 1,
        totalPages: 1,
        page: 0,
        size: 20,
        hasNext: false,
        evaluatedAt: now,
      })
  );
  await page.route(
    (url) => url.pathname === `${base}/requests/${approvalDocumentRequestId}/detail`,
    (route) => success(route, detail)
  );
  await page.route(
    (url) =>
      url.pathname === `${base}/requests/${approvalDocumentRequestId}/signature-context` ||
      /\/document-tools$|\/comments$|\/attachments$/u.test(url.pathname),
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE' }),
      })
  );
  await page.route(
    (url) => url.pathname.includes('/external-signature'),
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET') {
        if (path.endsWith('/external-signature-context'))
          return success(route, externalContext(authority.revision()));
        if (path.endsWith('/audit'))
          return success(route, {
            items: [
              {
                eventId: policyVersionId,
                sequence: 1,
                action: 'HANDOVER',
                state: state.request?.state ?? 'PREPARED',
                reasonCodes: [],
                evidenceId: policyId,
                evidenceSha256: sourceSha,
                occurredAt: '2026-09-15T00:00:02Z',
              },
            ],
            truncated: false,
          });
        if (path.includes('/artifacts/'))
          return success(route, {
            artifactId,
            kind: 'SIGNED_PDF',
            mediaType: 'application/pdf',
            sha256: sourceSha,
            sizeBytes: 2048,
            storageLocatorSha256: sourceSha,
            objectVersionSha256: sourceSha,
            retainUntil: validUntil,
            evidenceId: policyId,
            evidenceSha256: sourceSha,
            recordedAt: now,
          });
        return success(
          route,
          state.request ?? externalRequest(authority.revision(), 'PREPARED', 0)
        );
      }

      state.writes.push({
        path,
        body: request.postDataJSON() as Record<string, unknown>,
        headers: request.headers(),
      });
      if (createFailure)
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE' }),
        });
      if (path.endsWith('/external-signature-requests'))
        state.request = externalRequest(authority.revision(), 'PREPARED', 0);
      else if (path.endsWith('/refresh'))
        state.request = externalRequest(authority.revision(), 'OUT_FOR_SIGNATURE', 2);
      else if (path.endsWith('/cancel'))
        state.request = externalRequest(authority.revision(), 'CANCEL_PENDING', 2);
      return success(route, receipt(state.request!));
    }
  );

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/approvals/requests/archive?request=${approvalDocumentRequestId}`);
  const panel = page.locator('[data-approval-external-signature-panel]');
  await expect(panel).toBeVisible();
  return { authority, panel, state };
}

test.describe('officially contracted external signature ceremony', () => {
  test('external ceremony freezes provider/source, uses one HIGH handover and exposes retained evidence', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { authority, panel, state } = await setup(page);
    await panel.locator('[data-approval-external-create]').click();
    await expect.poll(() => state.writes.length).toBe(1);
    expect(state.writes[0]!.body).toMatchObject({
      expectedRequestVersion: 3,
      expectedSourceRevision: `sigp-${sourceSha}`,
      expectedSourceSha256: sourceSha,
      provider: {
        providerId,
        expectedProviderVersion: 5,
        expectedProviderSha256: sourceSha,
        expectedConfiguration: { sourceId: providerId, version: 5, sha256: sourceSha },
      },
    });
    expect(state.writes[0]!.headers['x-dwp-expected-object-version']).toBeUndefined();
    expect(state.writes[0]!.headers['x-dwp-step-up-challenge']).toBeUndefined();

    const completed = externalRequest(authority.revision(), 'OUT_FOR_SIGNATURE', 1);
    const network = await mockApprovalHighRiskNetwork(page, {
      commandPath: `${base}/external-signature-requests/${signatureRequestId}/handovers`,
      commandResult: receipt(completed),
      issuerContinuation: false,
      decisionRevision: authority.revision(),
      issuedExpiresAt: [validUntil],
    });
    await panel.locator('[data-approval-external-handover]').click();
    const high = page.getByRole('dialog', { name: '고위험 작업 본인 확인' });
    await high.getByRole('button', { name: '본인 확인' }).click();
    await high.getByRole('button', { name: '작업 확인' }).click();
    await expect(high).toHaveCount(0);
    state.request = completed;
    expect(network.commandRequests).toHaveLength(1);
    expect(network.issuerRequests[0]!.body).toMatchObject({
      commandPath: `${base}/external-signature-requests/${signatureRequestId}/handovers`,
      targetType: 'EXTERNAL_SIGNATURE_REQUEST',
      targetId: signatureRequestId,
      expectedObjectVersion: 0,
    });
    expect(network.commandRequests[0]!.headers['x-dwp-expected-object-version']).toBe('0');
    expect(network.commandRequests[0]!.headers['x-dwp-step-up-challenge']).toBeTruthy();

    await panel.locator('[data-approval-external-audit]').click();
    await expect(panel.getByText(/HANDOVER/u)).toBeVisible();
    await panel.getByLabel('아티팩트 ID').fill(artifactId);
    await panel.locator('[data-approval-external-artifact]').click();
    await expect(panel.getByText(/SIGNED_PDF/u)).toBeVisible();

    const cancel = panel.locator('[data-approval-external-cancel]');
    await cancel.focus();
    await page.keyboard.press('Enter');
    const dialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('button', { name: '취소' }) });
    await expect(dialog).toBeVisible();
    await page.setViewportSize({ width: 320, height: 844 });
    await page.emulateMedia({
      colorScheme: 'dark',
      forcedColors: 'active',
      reducedMotion: 'reduce',
    });
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    ).toBe(true);
    await dialog.evaluate((element) => element.setAttribute('data-external-cancel-a11y', 'true'));
    const audit = await new AxeBuilder({ page })
      .include('[data-external-cancel-a11y="true"]')
      .analyze();
    expect(
      audit.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(cancel).toBeFocused();
  });

  test('first external create 503 locks the original key and never resends the POST', async ({
    page,
  }) => {
    const { panel, state } = await setup(page, true);
    await panel.locator('[data-approval-external-create]').click();
    await expect(panel.getByText(/다시 전송되지 않습니다/u)).toBeVisible();
    expect(state.writes).toHaveLength(1);
    const original = structuredClone(state.writes[0]);
    await page.waitForTimeout(1_100);
    await expect(panel.getByRole('button', { name: '외부서명 원본 다시 불러오기' })).toBeDisabled();
    expect(state.writes).toEqual([original]);
    await expect(panel.locator('[data-approval-external-create]')).toBeDisabled();
  });
});
