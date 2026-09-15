import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import {
  diagnosticCard,
  diagnosticDetails,
  diagnosticFixtureDraftId,
  diagnosticFixtureId,
  diagnosticFixtureNow,
  diagnosticFixtureSha,
  diagnosticOverview,
  diagnosticPolicy,
} from '../libs/shared-utils/src/api/approval-signature-diagnostics.test-support';
import type {
  SignatureProviderCard,
  SignatureProviderDiagnostics,
  SignatureProviderOverview,
  SignatureProviderScope,
} from '../libs/shared-utils/src/api/approval-signature-diagnostics-contract';
import type { SignatureProviderPolicyView } from '../libs/shared-utils/src/api/approval-signature-provider-policy-contract';
import { mockShellSession } from './support/shell-session';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import {
  broadcastProductSurfaceRevision,
  mockApprovalProductSurfaceAuthority,
} from './support/product-surface-authority';
import { mockApprovalHighRiskNetwork } from './support/approval-high-risk';

const managementScope = 'scope:approvals:tenant';
const adobeId = '33333333-3333-4333-8333-333333333333';
const policyId = '55555555-5555-4555-8555-555555555555';
const trustBundleId = '66666666-6666-4666-8666-666666666666';
const observationId = '77777777-7777-4777-8777-777777777777';
const wormEvidenceId = '88888888-8888-4888-8888-888888888888';
const sourceSha = diagnosticFixtureSha;
const docusignSha = 'b'.repeat(64);
const policySha = 'c'.repeat(64);
const kmsSha = 'd'.repeat(64);
const wormSha = 'e'.repeat(64);
const validUntil = '2030-09-15T00:00:00Z';

type NativeState = {
  failure: null | { status: number; code: string };
  diagnosticsReads: number;
  failedReads: number;
  legacyReads: number;
  providerProbeWrites: unknown[];
  kmsProbeWrites: unknown[];
  policyDraftWrites: Array<{ body: Record<string, unknown>; headers: Record<string, string> }>;
  wormWrites: Array<{ body: Record<string, unknown>; headers: Record<string, string> }>;
  attachmentRequests: string[];
  providerProbed: boolean;
  kmsProbed: boolean;
  revision: () => string;
};

function scope(revision: string): SignatureProviderScope {
  return {
    ...diagnosticOverview().scope,
    contextScopeKey: managementScope,
    decisionRevision: revision,
    registrySha256: revision.slice(4),
    sourceRevision: `sigp-${sourceSha}`,
    sourceSha256: sourceSha,
    evaluatedAt: diagnosticFixtureNow,
  };
}

function providerCheck(passed: boolean) {
  return {
    checkKey: 'PRODUCTION_CONNECTIVITY',
    state: passed ? ('PASS' as const) : ('FAIL' as const),
    reasonCodes: passed ? [] : ['PRODUCTION_PROBE_FAILED'],
    observedAt: diagnosticFixtureNow,
    validUntil,
    evidenceId: observationId,
    evidenceSha256: diagnosticFixtureSha,
  };
}

function policy(revision: string): SignatureProviderPolicyView {
  const base = diagnosticPolicy();
  const configurationBinding = {
    sourceId: diagnosticFixtureDraftId,
    version: 4,
    sha256: docusignSha,
  };
  const rules = {
    ...base.published!.rules,
    signingEnabled: true,
    requiredProviderKinds: ['DOCUSIGN'] as const,
    allowedClassifications: ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const,
    trustBundleId,
    configurationBinding,
  };
  return {
    ...base,
    scope: scope(revision),
    policyId,
    version: 3,
    workingDraft: { ...base.workingDraft!, revision: 3, rules, rulesSha256: policySha },
    published: { ...base.published!, revision: 2, rules, rulesSha256: policySha },
    publishReview: {
      draftVersionId: base.workingDraft!.versionId,
      policyVersion: 3,
      draftRevision: 3,
      reviewContentSha256: policySha,
      eligibility: 'ELIGIBLE',
      reasonCodes: [],
      stepUpRequired: true,
      validUntil,
    },
  };
}

function overview(state: NativeState): SignatureProviderOverview {
  const base = diagnosticOverview();
  const currentScope = scope(state.revision());
  const policyView = policy(state.revision());
  const internal: SignatureProviderCard = {
    ...diagnosticCard('INTERNAL'),
    providerId: diagnosticFixtureId,
    displayName: 'DWP Internal SELF Evidence',
    providerVersion: 2,
    providerSha256: diagnosticFixtureSha,
    adapterInstalled: true,
    configurationRegistered: true,
    environment: 'INTERNAL',
    readiness: 'VERIFIED_INTERNAL_KEY',
    requiredByPolicy: false,
    gateReasonCodes: [],
    checks: [providerCheck(true)],
  };
  const docusign: SignatureProviderCard = {
    ...diagnosticCard('DOCUSIGN'),
    providerId: diagnosticFixtureDraftId,
    displayName: 'DocuSign Enterprise',
    providerVersion: 4,
    providerSha256: docusignSha,
    adapterInstalled: true,
    configurationRegistered: true,
    credentialRegistered: true,
    credentialVerified: state.providerProbed,
    requiredByPolicy: true,
    environment: 'PRODUCTION',
    readiness: state.providerProbed ? 'VERIFIED_PRODUCTION' : 'NOT_VERIFIED',
    gateReasonCodes: state.providerProbed ? [] : ['PRODUCTION_PROBE_FAILED'],
    lastProbeAt: diagnosticFixtureNow,
    checks: [providerCheck(state.providerProbed)],
  };
  const adobe: SignatureProviderCard = {
    ...diagnosticCard('ADOBE_SIGN'),
    providerId: adobeId,
    displayName: 'Adobe Acrobat Sign',
    providerVersion: 1,
    providerSha256: policySha,
    adapterInstalled: true,
    requiredByPolicy: false,
    readiness: 'CONFIGURATION_REQUIRED',
  };
  return {
    ...base,
    scope: currentScope,
    policy: {
      sourceState: 'AVAILABLE',
      pin: {
        sourceId: policyView.published!.versionId,
        version: policyView.published!.revision,
        sha256: policyView.published!.rulesSha256,
      },
      requiredProviderKinds: ['DOCUSIGN'],
      maxProbeAgeSeconds: 3600,
      probeIntervalSeconds: 900,
      retentionFloorSeconds: 31_536_000,
    },
    kpis: {
      registeredProviderCount: 3,
      configuredProviderCount: 2,
      verifiedProductionProviderCount: state.providerProbed ? 1 : 0,
      requiredProviderCount: 1,
      requiredProviderKinds: ['DOCUSIGN'],
      externalGateState: 'BLOCKED',
      gateReasonCodes: state.kmsProbed ? ['WORM_EVIDENCE_REQUIRED'] : ['KMS_BINDING_REQUIRED'],
      lastProbeAt: diagnosticFixtureNow,
      probeIntervalSeconds: 900,
    },
    providers: [internal, docusign, adobe],
    phases: [
      { ...base.phases[0]!, gateState: 'ELIGIBLE' },
      {
        ...base.phases[1]!,
        gateState: 'BLOCKED',
        reasonCodes: ['EXTERNAL_PROVIDER_GATE_BLOCKED'],
      },
      {
        ...base.phases[2]!,
        gateState: 'BLOCKED',
        reasonCodes: ['VERIFIED_CALLBACK_AND_WORM_REQUIRED'],
      },
    ],
    kms: state.kmsProbed
      ? {
          backend: 'AWS_KMS',
          verificationKind: 'CONFIGURED_KMS',
          state: 'PASS',
          algorithm: 'ECDSA_P384_SHA384',
          keySha256: kmsSha,
          source: 'AWS_KMS_DESCRIBE_KEY',
          checkedAt: diagnosticFixtureNow,
          validUntil,
          evidenceId: observationId,
          evidenceSha256: kmsSha,
          reasonCodes: [],
        }
      : {
          backend: 'AWS_KMS',
          verificationKind: 'CONFIGURED_KMS',
          state: 'FAIL',
          algorithm: 'ECDSA_P384_SHA384',
          keySha256: null,
          source: 'AWS_KMS_DESCRIBE_KEY',
          checkedAt: diagnosticFixtureNow,
          validUntil,
          evidenceId: observationId,
          evidenceSha256: kmsSha,
          reasonCodes: ['KMS_BINDING_NOT_VERIFIED'],
        },
    worm: {
      state: 'FAIL',
      storageLocatorSha256: wormSha,
      objectVersionSha256: wormSha,
      objectLockMode: 'COMPLIANCE',
      retainUntil: '2031-09-14T00:00:00Z',
      legalHold: false,
      policy: { sourceId: policyId, version: 3, sha256: policySha },
      retentionFloorSeconds: 31_536_000,
      checkedAt: diagnosticFixtureNow,
      validUntil,
      evidenceId: wormEvidenceId,
      evidenceSha256: wormSha,
      reasonCodes: ['LEGAL_REVIEW_PENDING'],
    },
  };
}

function providerDetails(state: NativeState, providerId: string): SignatureProviderDiagnostics {
  const current = overview(state);
  const provider = current.providers.find((candidate) => candidate.providerId === providerId);
  if (!provider) throw new Error(`Unknown provider fixture ${providerId}`);
  const base = diagnosticDetails();
  const configured = provider.configurationRegistered;
  return {
    ...base,
    scope: current.scope,
    policy: current.policy,
    provider,
    settings: {
      configuration: configured
        ? {
            sourceId: provider.providerId!,
            version: provider.providerVersion!,
            sha256: provider.providerSha256!,
          }
        : null,
      environment: provider.environment,
      endpointOriginSha256: configured ? diagnosticFixtureSha : null,
      accountBindingSha256: configured ? docusignSha : null,
      credentialRegistered: provider.credentialRegistered,
      callbackAuthenticationMode: configured ? 'MTLS_1_3' : 'NONE',
      configurationOwner: configured ? 'Security Platform Team' : 'UNRECORDED',
    },
    gateReasons: provider.gateReasonCodes,
    guide: {
      sections: [
        {
          sectionKey: 'PROVIDER_CONFIGURATION',
          stepKeys: ['REGISTER_CONFIGURATION', 'VERIFY_CREDENTIAL', 'RUN_PROBE'],
          officialDocumentationLinks:
            provider.kind === 'DOCUSIGN'
              ? ['https://developers.docusign.com/docs/esign-rest-api/']
              : provider.kind === 'ADOBE_SIGN'
                ? ['https://developer.adobe.com/document-services/docs/overview/pdf-services-api/']
                : [],
        },
      ],
    },
    phases: current.phases,
    kms: current.kms,
    worm: current.worm,
  };
}

function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

function currentContext(revision: string) {
  const revalidateAt = validUntil;
  const selectedScope = {
    key: managementScope,
    kind: 'RESOURCE_SET',
    displayName: '전자결재 운영 범위',
    isDefault: true,
    readOnly: false,
    validUntil: null,
  };
  return {
    decision: 'ALLOWED',
    reasonCode: null,
    decisionRevision: revision,
    context: {
      contextKey: 'ctx:approvals:admin',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      plane: 'management',
      accessMode: 'NORMAL',
      accessSource: 'MANAGEMENT',
      appResourceKey: 'APP.APPROVALS',
      effectiveGrants: [
        {
          grantKind: 'CAPABILITY',
          capabilityContractKey: 'approvals.signature.manage',
          resolvedCapabilityCode: 'approvals.signature.manage',
          authorityMode: 'PERMISSION_AND_RELATIONSHIP',
          predicatePolicyKeys: [],
          responsibilityRequirement: 'REQUIRED',
          responsibility: { code: 'APP_CONFIG_ADMIN', resourceSetKey: 'RS_APPROVALS' },
          scopeKeys: [managementScope],
          requiresProductEntitlement: false,
          readOnly: false,
          activationState: 'ACTIVE',
          validUntil: null,
        },
      ],
      scopes: [selectedScope],
      revalidateAt,
    },
    routeGrantRef: 'grant:approvals.signature.manage',
    scope: selectedScope,
    effectiveReadOnly: false,
    validUntil: null,
    revalidateAt,
  };
}

async function setup(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_AUDITOR'], {
    locale: 'ko',
    permissions: [
      ...APPROVAL_MEMBER_PERMISSIONS,
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.APPROVAL_SIGNATURE',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.APPROVAL_SIGNATURE',
        permissionCode: 'MANAGE',
        effect: 'ALLOW',
      },
    ],
  });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    work: false,
    management: true,
    surfaceUi: true,
    rolloutState: '111',
    decisionRevisionFormat: 'sha256',
    generatedAt: '2026-09-15T00:00:00Z',
    revalidateAt: '2030-09-15T00:00:00Z',
    managementCapabilityKeys: [
      'approvals.signature.read',
      'approvals.signature.manage',
      'approvals.signature.publish',
    ],
  });
  const state: NativeState = {
    failure: null,
    diagnosticsReads: 0,
    failedReads: 0,
    legacyReads: 0,
    providerProbeWrites: [],
    kmsProbeWrites: [],
    policyDraftWrites: [],
    wormWrites: [],
    attachmentRequests: [],
    providerProbed: false,
    kmsProbed: false,
    revision: authority.revision,
  };

  await page.route('**/api/auth/product-surface-access/evaluate', async (route) => {
    const body = route.request().postDataJSON() as { routeContractKey?: string };
    if (body.routeContractKey === 'route.approvals.admin.signature-policy-publish.action') {
      await success(route, {
        decision: 'STEP_UP_REQUIRED',
        reasonCode: 'STEP_UP_REQUIRED',
        decisionRevision: authority.revision(),
        requiredAssurance: 'urn:dwp:assurance:high',
        revalidateAt: validUntil,
      });
      return;
    }
    if (
      body.routeContractKey !== 'route.approvals.admin.signature-probe.action' &&
      body.routeContractKey !== 'route.approvals.admin.signature-kms-probe.action' &&
      body.routeContractKey !== 'route.approvals.admin.signature-policy-draft-update.action' &&
      body.routeContractKey !== 'route.approvals.admin.signature-worm-inspection.action'
    ) {
      await route.fallback();
      return;
    }
    await success(route, currentContext(authority.revision()));
  });

  await page.route(
    (url) => url.pathname.startsWith('/api/approvals/v1/admin/attachments/'),
    (route) => {
      state.attachmentRequests.push(`${route.request().method()} ${route.request().url()}`);
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE' }),
      });
    }
  );

  await page.route(
    (url) => url.pathname.startsWith('/api/approvals/v1/admin/signatures'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      if (path === '/api/approvals/v1/admin/signatures') {
        state.legacyReads += 1;
        await route.fulfill({ status: 410, body: '' });
        return;
      }
      if (
        url.searchParams.get('contextScopeKey') !== managementScope ||
        request.headers()['x-dwp-expected-decision-revision'] !== authority.revision()
      ) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', errorCode: 'DECISION_REVISION_CONFLICT' }),
        });
        return;
      }
      if (path === '/api/approvals/v1/admin/signatures/diagnostics' && request.method() === 'GET') {
        state.diagnosticsReads += 1;
        if (state.failure) {
          const failure = state.failure;
          state.failedReads += 1;
          if (failure.code === 'SCOPE_CONTEXT_EXPIRED') state.failure = null;
          await route.fulfill({
            status: failure.status,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'ERROR',
              errorCode: failure.code,
              message: 'Current native source unavailable',
            }),
          });
          return;
        }
        await success(route, overview(state));
        return;
      }
      if (path.includes('/providers/') && path.endsWith('/diagnostics')) {
        const providerId = path.split('/').at(-2)!;
        await success(route, providerDetails(state, providerId));
        return;
      }
      if (path.endsWith('/diagnostic-history')) {
        await success(route, {
          scope: scope(authority.revision()),
          items: [
            {
              probeRunId: observationId,
              providerId: diagnosticFixtureDraftId,
              sourceRevision: `sigp-${sourceSha}`,
              sourceSha256: sourceSha,
              state: 'COMPLETE',
              occurredAt: diagnosticFixtureNow,
              reasonCodes: [],
              evidenceId: observationId,
              evidenceSha256: diagnosticFixtureSha,
            },
          ],
          nextCursor: null,
          truncated: false,
        });
        return;
      }
      if (path.endsWith('/policy') && request.method() === 'GET') {
        await success(route, policy(authority.revision()));
        return;
      }
      if (path.includes('/policies/') && path.endsWith('/history')) {
        const current = policy(authority.revision());
        const published = current.published!;
        await success(route, {
          scope: current.scope,
          policyId: current.policyId,
          items: [
            {
              ...published,
              state: 'PUBLISHED',
              createdAt: published.publishedAt,
            },
          ],
          nextCursor: null,
          truncated: false,
        });
        return;
      }
      if (path.endsWith('/draft') && request.method() === 'PUT') {
        const body = request.postDataJSON() as Record<string, unknown>;
        state.policyDraftWrites.push({ body, headers: request.headers() });
        const current = policy(authority.revision());
        await success(route, {
          ...current,
          workingDraft: { ...current.workingDraft!, rules: body.rules },
        });
        return;
      }
      if (path.endsWith('/worm-inspections') && request.method() === 'POST') {
        state.wormWrites.push({
          body: request.postDataJSON() as Record<string, unknown>,
          headers: request.headers(),
        });
        await success(route, overview(state));
        return;
      }
      if (path === '/api/approvals/v1/admin/signatures/probes' && request.method() === 'POST') {
        const body = request.postDataJSON() as {
          targets: Array<{ providerId: string }>;
        };
        state.providerProbeWrites.push(body);
        state.providerProbed = true;
        await success(route, {
          scope: scope(authority.revision()),
          probeRunId: observationId,
          state: 'COMPLETE',
          startedAt: diagnosticFixtureNow,
          completedAt: '2026-09-14T00:00:01Z',
          originalBodySha256: diagnosticFixtureSha,
          originalTargets: body.targets,
          providerResults: body.targets.map((target) => ({
            providerId: target.providerId,
            originalTarget: target,
            outcome: 'PASS',
            observedAt: diagnosticFixtureNow,
            cooldownUntil: null,
            reasonCodes: [],
            checks: [providerCheck(true)],
          })),
        });
        return;
      }
      if (path === '/api/approvals/v1/admin/signatures/kms/probes' && request.method() === 'POST') {
        state.kmsProbeWrites.push(request.postDataJSON());
        state.kmsProbed = true;
        await success(route, overview(state));
        return;
      }
      await route.fulfill({ status: 404, body: '' });
    }
  );

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/approvals/admin/signatures');
  await expect(page.getByRole('heading', { name: '서명 제공자 진단' })).toBeVisible();
  return { state, authority };
}

test.describe('officially contracted signature provider runtime', () => {
  test('native Source13 facts, provider history, probe and KMS diagnostics are production reachable', async ({
    page,
  }) => {
    const { state } = await setup(page);
    await expect(page.getByRole('article')).toHaveCount(3);
    await expect(page.getByText('DWP 내부 결재 결정', { exact: true })).toBeVisible();
    await expect(page.getByText('외부 서명식 게이트', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: '서명 키 진단' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'WORM 검사' })).toBeVisible();
    await expect(page.getByText('자격증명 비밀', { exact: false })).toBeVisible();
    expect(await page.locator('body').innerText()).not.toContain('credentialSecret');
    expect(state.legacyReads).toBe(0);

    const docusign = page.getByRole('article', { name: 'DocuSign Enterprise' });
    await docusign.getByRole('button', { name: '제공자 프로브 실행' }).click();
    await expect.poll(() => state.providerProbeWrites.length).toBe(1);
    await expect(docusign.getByText('상용 환경 검증', { exact: true })).toBeVisible();
    expect(JSON.stringify(state.providerProbeWrites)).not.toContain('credential');

    await page.getByRole('button', { name: 'KMS 결속 프로브 실행' }).click();
    await expect.poll(() => state.kmsProbeWrites.length).toBe(1);
    await expect(page.getByRole('region', { name: '서명 키 진단' })).toContainText('검증 관측');

    await page.getByRole('button', { name: '검증 이력' }).click();
    await expect(page.getByRole('dialog', { name: '검증 이력' })).toBeVisible();
    await expect(page.getByText('제공자 검증 이력', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('APR16 policy binding, WORM inspection and HIGH publish use only current native source', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { state, authority } = await setup(page);
    const workspace = page.locator('[data-approval-signature-policy-workspace]');
    await expect(workspace).toBeVisible();

    const edit = workspace.locator('[data-approval-signature-policy-edit]');
    await edit.focus();
    await page.keyboard.press('Enter');
    const editor = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('button', { name: '저장' }) });
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: '저장' }).click();
    await expect.poll(() => state.policyDraftWrites.length).toBe(1);
    expect(state.policyDraftWrites[0]!.body).toMatchObject({
      expectedVersion: 3,
      expectedDraftVersionId: diagnosticFixtureDraftId,
      expectedSourceRevision: `sigp-${sourceSha}`,
      expectedSourceSha256: sourceSha,
      rules: {
        signingEnabled: true,
        configurationBinding: {
          sourceId: diagnosticFixtureDraftId,
          version: 4,
          sha256: docusignSha,
        },
      },
    });
    expect(state.policyDraftWrites[0]!.headers['x-dwp-expected-object-version']).toBeUndefined();

    await workspace.locator('[data-approval-signature-worm]').click();
    const worm = page.getByRole('dialog', { name: 'WORM 검사' });
    await expect(worm).toBeVisible();
    await worm.getByRole('button', { name: 'WORM 증적 검사', exact: true }).click();
    await expect.poll(() => state.wormWrites.length).toBe(1);
    expect(state.wormWrites[0]!.body).toMatchObject({
      expectedSourceRevision: `sigp-${sourceSha}`,
      expectedSourceSha256: sourceSha,
      target: {
        providerId: diagnosticFixtureDraftId,
        expectedProviderVersion: 4,
        expectedProviderSha256: docusignSha,
      },
    });
    expect(state.wormWrites[0]!.headers['x-dwp-step-up-challenge']).toBeUndefined();

    const network = await mockApprovalHighRiskNetwork(page, {
      commandPath: `/api/approvals/v1/admin/signatures/policies/${policyId}/publish`,
      commandResult: policy(authority.revision()),
      issuerContinuation: false,
      decisionRevision: authority.revision(),
      issuedExpiresAt: ['2030-09-15T00:00:00Z'],
    });
    await workspace.locator('[data-approval-signature-policy-publish]').click();
    const high = page.getByRole('dialog', { name: '고위험 작업 본인 확인' });
    await high.getByRole('button', { name: '본인 확인' }).click();
    await high.getByRole('button', { name: '작업 확인' }).click();
    await expect(high).toHaveCount(0);
    expect(network.commandRequests).toHaveLength(1);
    expect(network.issuerRequests[0]!.body).toMatchObject({
      commandPath: `/api/approvals/v1/admin/signatures/policies/${policyId}/publish`,
      targetType: 'SIGNATURE_POLICY',
      targetId: policyId,
      expectedObjectVersion: 3,
    });
    expect(network.commandRequests[0]!.headers['x-dwp-expected-object-version']).toBe('3');
    expect(network.commandRequests[0]!.headers['x-dwp-step-up-challenge']).toBeTruthy();

    await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'none', reducedMotion: 'reduce' });
    await page.reload();
    await expect(workspace).toBeVisible();
    await edit.focus();
    await page.keyboard.press('Enter');
    await expect(editor).toBeVisible();
    await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'none', reducedMotion: 'reduce' });
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    ).toBe(true);
    await editor.evaluate((element) => element.setAttribute('data-signature-policy-a11y', 'true'));
    const audit = await new AxeBuilder({ page })
      .include('[data-signature-policy-a11y="true"]')
      .analyze();
    expect(
      audit.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(edit).toBeFocused();

    await page.emulateMedia({
      colorScheme: 'light',
      forcedColors: 'active',
      reducedMotion: 'reduce',
    });
    await page.reload();
    await expect(workspace).toBeVisible();
    await edit.focus();
    await page.keyboard.press('Enter');
    await expect(editor).toBeVisible();
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await editor.evaluate((element) => element.setAttribute('data-signature-policy-a11y', 'true'));
    await expect
      .poll(() => page.evaluate(() => matchMedia('(forced-colors: active)').matches))
      .toBe(true);
    const forcedAudit = await new AxeBuilder({ page })
      .include('[data-signature-policy-a11y="true"]')
      .analyze();
    expect(
      forcedAudit.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(edit).toBeFocused();
  });

  for (const failure of [
    { status: 403, code: 'FORBIDDEN', retained: false },
    { status: 409, code: 'SCOPE_CONTEXT_EXPIRED', retained: false },
    { status: 503, code: 'AUTHORITY_RESOLUTION_UNAVAILABLE', retained: true },
  ] as const) {
    test(`first ${failure.status}/${failure.code} invalidates current readiness and recovers through the governed authority path`, async ({
      page,
    }) => {
      const { state } = await setup(page);
      state.failure = failure;
      await page.getByRole('button', { name: '새로고침', exact: true }).first().click();
      if (failure.code === 'SCOPE_CONTEXT_EXPIRED') {
        await expect.poll(() => state.failedReads).toBe(1);
        await expect(page.locator('[data-state="VERIFIED_INTERNAL_KEY"]')).toBeVisible();
        expect(state.providerProbeWrites).toEqual([]);
        expect(state.kmsProbeWrites).toEqual([]);
        return;
      }
      await expect(page.locator('[data-state="VERIFIED_INTERNAL_KEY"]')).toHaveCount(0);
      if (failure.retained) {
        await expect(page.getByRole('article', { name: 'DocuSign Enterprise' })).toBeVisible();
        await expect(page.getByText('현재 소스 확인 불가', { exact: true }).first()).toBeVisible();
      } else {
        await expect(page.getByRole('article')).toHaveCount(0);
      }
      await page.waitForTimeout(1_100);
      expect(state.failedReads).toBe(1);
      expect(state.providerProbeWrites).toEqual([]);
      expect(state.kmsProbeWrites).toEqual([]);

      state.failure = null;
      if (failure.retained)
        await page.getByRole('button', { name: '새로고침', exact: true }).first().click();
      else await page.reload();
      await expect(page.locator('[data-state="VERIFIED_INTERNAL_KEY"]')).toBeVisible();
    });
  }

  test('identity revocation removes current facts without another signature command', async ({
    page,
  }) => {
    const { state, authority } = await setup(page);
    const reads = state.diagnosticsReads;
    authority.revoke('approvals.admin');
    await broadcastProductSurfaceRevision(page, authority.revision());
    await expect(page.getByRole('article')).toHaveCount(0);
    expect(state.diagnosticsReads).toBe(reads);
    expect(state.providerProbeWrites).toEqual([]);
    expect(state.kmsProbeWrites).toEqual([]);
  });

  test('signature readiness remains keyboard-usable and overlap-free at 320px, 200%, dark and forced colors', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.emulateMedia({
      colorScheme: 'dark',
      forcedColors: 'active',
      reducedMotion: 'reduce',
    });
    await setup(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });

    const configuration = page
      .getByRole('article', { name: 'DocuSign Enterprise' })
      .getByRole('button', { name: '설정 보기' });
    await configuration.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'DocuSign Enterprise' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('제공자 게이트 가이드', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('link', { name: '공식 제공자 문서 열기' })).toHaveAttribute(
      'href',
      'https://developers.docusign.com/docs/esign-rest-api/'
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    ).toBe(false);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(configuration).toBeFocused();
    await testInfo.attach('approval-signature-source13-320-200-forced-colors', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
