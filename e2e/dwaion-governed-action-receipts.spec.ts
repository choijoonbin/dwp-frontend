import { expect, test, type Page, type Route } from '@playwright/test';

import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const ROUTINE_ID = '11111111-1111-4111-8111-111111111111';
const ARTIFACT_ID = '33333333-3333-4333-8333-333333333333';
const DELETION_JOB_ID = '66666666-6666-4666-8666-666666666667';

test('U03 advanced runtime action returns a provider-bound receipt', async ({ page }) => {
  await prepare(page);
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/agent/v1/routines**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/routines/capabilities')) {
      return success(route, routineCapabilities());
    }
    if (request.method() === 'POST' && path.endsWith(`/${ROUTINE_ID}/advanced-commands`)) {
      const body = request.postDataJSON() as Record<string, unknown>;
      requests.push(body);
      const payload = body.payload as { kind: string };
      return success(
        route,
        {
          commandId: body.commandId,
          routineId: ROUTINE_ID,
          ownerUserId: '1',
          kind: payload.kind,
          state: 'SUCCEEDED',
          expectedRevision: body.expectedRevision,
          version: 2,
          makerUserId: '1',
          checkerUserId: null,
          canApprove: false,
          proposedDefinition: null,
          problem: null,
          receipt: {
            receiptId: '10101010-1010-4010-8010-101010101010',
            commandId: body.commandId,
            routineId: ROUTINE_ID,
            kind: payload.kind,
            state: 'SUCCEEDED',
            providerReceiptId: 'worm-vault-receipt-20260917',
            resultSha256: 'a'.repeat(64),
            providerOutcome: {
              routineId: ROUTINE_ID,
              expectedRevision: body.expectedRevision,
              kind: payload.kind,
              outcome: 'APPLIED',
              appliedPayload: body.payload,
              evidenceRef: 'worm-evidence:archive-20260917',
            },
            appliedRevision: null,
            completedAt: '2026-09-17T03:01:00Z',
          },
          createdAt: '2026-09-17T03:00:00Z',
          updatedAt: '2026-09-17T03:01:00Z',
        },
        201
      );
    }
    return route.fallback();
  });

  await page.goto('/dwaion/routines');
  const button = page.getByRole('button', { name: 'Permanent WORM vault fork', exact: true });
  await expect(button).toBeEnabled();
  await button.click();

  await expect(page.getByText('WORM_EVIDENCE_DELIVERY · SUCCEEDED', { exact: true })).toBeVisible();
  await expect(page.getByText('worm-vault-receipt-20260917', { exact: true })).toBeVisible();
  await expect.poll(() => requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    expectedRevision: 7,
    reasonCode: 'USER_WORM_EVIDENCE_DELIVERY',
    payload: {
      kind: 'WORM_EVIDENCE_DELIVERY',
      evidenceScope: 'FULL_AUDIT',
      retentionDays: 1825,
      legalHold: false,
    },
  });
});

test('U04 masking runs on the server and displays its immutable receipt', async ({ page }) => {
  await prepare(page);
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/agent/v1/artifact-collaboration/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/capabilities')) {
      return success(route, artifactCapabilities());
    }
    if (request.method() === 'POST' && path.endsWith(`/${ARTIFACT_ID}/remediation-actions`)) {
      const body = request.postDataJSON() as Record<string, unknown>;
      requests.push(body);
      return success(
        route,
        {
          receiptId: '20202020-2020-4020-8020-202020202020',
          commandId: body.commandId,
          artifactId: ARTIFACT_ID,
          action: body.action,
          state: 'SUCCEEDED',
          artifactRevision: 5,
          workspaceRevision: null,
          affectedCount: 3,
          providerReceiptId: null,
          sourceContentFingerprint: 'c'.repeat(64),
          findingManifestSha256: 'd'.repeat(64),
          resultContentSha256: 'e'.repeat(64),
          remediatedCodes: ['EMAIL_ADDRESS', 'KOREAN_RESIDENT_ID', 'PHONE_NUMBER'],
          residualFindingCount: 0,
          resultSha256: 'b'.repeat(64),
          completedAt: '2026-09-17T03:02:00Z',
        },
        201
      );
    }
    return route.fallback();
  });

  await page.goto('/dwaion/artifacts');
  const button = page.getByRole('button', { name: 'Mask all', exact: true });
  await expect(button).toBeEnabled();
  await button.click();

  const receipt = page.getByTestId('artifact-remediation-receipt');
  await expect(receipt).toContainText('AUTOMATIC_MASKING · SUCCEEDED');
  await expect(receipt).toContainText('20202020-2020-4020-8020-202020202020 · 3');
  await expect.poll(() => requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    expectedRevision: 4,
    reasonCode: 'USER_CONFIRMED_ARTIFACT_AUTOMATIC_MASKING',
    action: 'AUTOMATIC_MASKING',
    stageId: null,
  });
});

test('U05 SRE evidence escalation executes and renders the sealed command receipt', async ({
  page,
}) => {
  await prepare(page);
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/agent/v1/personal-data/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/capabilities')) {
      return success(route, personalDataCapabilities());
    }
    if (
      request.method() === 'POST' &&
      path.endsWith(`/${DELETION_JOB_ID}/evidence-actions/SRE_ESCALATION`)
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      requests.push(body);
      return success(
        route,
        {
          commandId: body.commandId,
          deletionJobId: DELETION_JOB_ID,
          action: 'SRE_ESCALATION',
          state: 'COMPLETED',
          expectedRevision: body.expectedRevision,
          receiptId: '30303030-3030-4030-8030-303030303030',
          providerReceiptId: 'sre-case-20260917',
          resultFingerprint: 'c'.repeat(64),
          result: {
            schemaVersion: 1,
            caseId: 'SRE-2026-0917',
            queue: 'privacy-sre',
            severity: 'P2',
            state: 'ACCEPTED',
            acceptedAt: '2026-09-17T03:03:00Z',
          },
          safeErrorCode: null,
          recoveryHint: null,
          downloadAvailable: false,
          createdAt: '2026-09-17T03:00:00Z',
          completedAt: '2026-09-17T03:03:00Z',
        },
        201
      );
    }
    return route.fallback();
  });

  await page.goto('/dwaion/personal-controls');
  const button = page.getByRole('button', { name: 'Request SRE security support', exact: true });
  await expect(button).toBeEnabled();
  await button.click();

  await expect(page.getByText(/Evidence command receipt/u)).toContainText(
    '30303030-3030-4030-8030-303030303030'
  );
  await expect(page.getByTestId('personal-data-evidence-outcome')).toContainText(
    'SRE case: SRE-2026-0917 · privacy-sre · P2'
  );
  await expect.poll(() => requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    expectedRevision: 1,
    reasonCode: 'USER_SRE_ESCALATION',
    parameters: { priority: 'P2' },
  });
});

test('U05 backup ledger downloads a typed snapshot bound to the deletion job', async ({ page }) => {
  await prepare(page);
  await page.route('**/api/agent/v1/personal-data/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/capabilities')) {
      return success(route, personalDataCapabilities());
    }
    if (
      request.method() === 'POST' &&
      path.endsWith(`/${DELETION_JOB_ID}/evidence-actions/BACKUP_LEDGER`)
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      return success(
        route,
        {
          commandId: body.commandId,
          deletionJobId: DELETION_JOB_ID,
          action: 'BACKUP_LEDGER',
          state: 'COMPLETED',
          expectedRevision: body.expectedRevision,
          receiptId: '40404040-4040-4040-8040-404040404040',
          providerReceiptId: 'backup-ledger-20260917',
          resultFingerprint: 'd'.repeat(64),
          result: {
            schemaVersion: 1,
            ledgerScope: 'latest',
            destroyedPartitionIds: ['backup-partition-1'],
            retainedPartitionIds: ['legal-hold-partition-2'],
            ledgerEntryIds: ['ledger-entry-1', 'ledger-entry-2'],
            observedAt: '2026-09-17T03:04:00Z',
          },
          safeErrorCode: null,
          recoveryHint: null,
          downloadAvailable: false,
          createdAt: '2026-09-17T03:00:00Z',
          completedAt: '2026-09-17T03:04:00Z',
        },
        201
      );
    }
    return route.fallback();
  });

  await page.goto('/dwaion/personal-controls');
  const downloadEvent = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export current backup-disposition snapshot (JSON)', exact: true })
    .click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(`dwaion-backup-ledger-${DELETION_JOB_ID}.json`);
  const stream = await download.createReadStream();
  let contents = '';
  for await (const chunk of stream) contents += chunk.toString();
  expect(JSON.parse(contents)).toMatchObject({
    schema: 'dwp.personal-data.backup-ledger-snapshot.v1',
    deletionJobId: DELETION_JOB_ID,
    receiptId: '40404040-4040-4040-8040-404040404040',
    providerReceiptId: 'backup-ledger-20260917',
    result: { ledgerEntryIds: ['ledger-entry-1', 'ledger-entry-2'] },
  });
  await expect(page.getByTestId('personal-data-evidence-outcome')).toContainText(
    'Backup ledger entries: 2 · Destroyed partitions: 1 · Retained partitions: 1'
  );
});

async function prepare(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.clock.setFixedTime(new Date('2026-09-17T03:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
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
  await mockDwaionPersonalIntelligence(page, { locale: 'en' });
}

function routineCapabilities() {
  const available = providerCapability();
  return {
    lifecycleMode: 'GOVERNED_RUNTIME',
    activationAvailable: true,
    schedulingAvailable: true,
    backgroundExecutionAvailable: true,
    dryRunAvailable: true,
    pauseResumeAvailable: true,
    oneTimeScheduleAvailable: true,
    activeWindowPreviewAvailable: true,
    quietHoursPreviewAvailable: true,
    quietHoursDeliveryEnforcementAvailable: true,
    holidayPolicyAvailable: true,
    costBudgetAvailable: true,
    runtimeBudgetAvailable: true,
    notificationDeliveryAvailable: true,
    proposalDeliveryAvailable: true,
    externalWriteAvailable: false,
    webhookTriggerAvailable: true,
    agentKernelBinding: available,
    whitelistedSourceBinding: available,
    blockedSourcePolicy: available,
    zeroWritePolicy: available,
    semanticVersionDiff: available,
    runtimeBudgetRetry: available,
    automaticQuarantine: available,
    changeApproval: available,
    agentSwitching: available,
    wormDelivery: available,
    oauthReauthorization: available,
    temporaryBudgetIncrease: available,
    operatorEscalation: available,
    providerRollback: available,
    executionProviderState: 'AVAILABLE',
    recoveryHint: null,
    supportedCadences: ['DAILY', 'WEEKDAYS', 'WEEKLY'],
    consentScopes: ['SOURCE_ACCESS', 'ANALYSIS', 'PROPOSAL_DELIVERY'],
  };
}

function artifactCapabilities() {
  const available = providerCapability();
  return {
    teamWorkspaceAvailable: true,
    aclPreflightAvailable: true,
    accessRequestAvailable: true,
    collaborationAvailable: true,
    conflictResolutionAvailable: true,
    internalSharingAvailable: true,
    externalSharingAvailable: false,
    shareExpiryAvailable: true,
    shareRevocationAvailable: true,
    inlineComments: available,
    stagedReview: available,
    signedWormReceipt: unavailableCapability('SIGNED_WORM_RECEIPT_NOT_CONFIGURED'),
    automaticMasking: available,
    syntheticReplacement: available,
    reviewNotification: available,
    reviewRejection: available,
    providerState: 'AVAILABLE',
    recoveryHint: null,
  };
}

function personalDataCapabilities() {
  const available = providerCapability();
  return {
    supportedDeletionDomains: ['ROUTINE', 'MEMORY', 'ARTIFACT', 'ARTIFACT_EXPORT'],
    deletionRequestAvailable: true,
    deletionExecutionAvailable: true,
    deletionCompletionClaimAvailable: true,
    proposalClearManagedSeparately: true,
    proposalClearRoute: '/v1/proposals/clear',
    sourceSystemDataAffected: false,
    auditMetadataMayBeRetained: true,
    analysisReceiptClearAvailable: false,
    backupDestructionLog: available,
    sreSupport: available,
    legalHoldEvidence: available,
    legalHoldAppeal: available,
    signedCertificate: available,
    siemSync: available,
  };
}

function providerCapability() {
  return { available: true, configured: true, reasonCode: null, recoveryHint: null };
}

function unavailableCapability(reasonCode: string) {
  return {
    available: false,
    configured: false,
    reasonCode,
    recoveryHint: 'Ask an administrator to configure this governed action.',
  };
}

function success(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, json: { success: true, data } });
}
