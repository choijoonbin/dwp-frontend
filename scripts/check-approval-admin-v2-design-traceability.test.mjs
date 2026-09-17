import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ApprovalAdminV2TraceabilityError,
  readApprovalAdminV2Traceability,
  runApprovalAdminV2DesignTraceabilityCheck,
  validateApprovalAdminV2Traceability,
} from './check-approval-admin-v2-design-traceability.mjs';

test('tracked APR-17 through APR-24 design contract maps all source frames to product code', async () => {
  assert.deepEqual(await runApprovalAdminV2DesignTraceabilityCheck(), {
    frameCount: 24,
    canonicalAreaCount: 8,
    supplementalAreaCount: 2,
    stateCount: 7,
    visualCaptureCount: 20,
    supportedCommandCount: 13,
    unavailableControlCount: 12,
    ownerActionContractCount: 42,
    ownerHighRiskRouteCount: 16,
  });
});

test('traceability rejects a missing source frame even when remaining entries are valid', async () => {
  const traceability = structuredClone(await readApprovalAdminV2Traceability());
  traceability.frames.pop();
  await assert.rejects(
    validateApprovalAdminV2Traceability(traceability),
    (error) =>
      error instanceof ApprovalAdminV2TraceabilityError &&
      error.message === 'traceability must map all 24 source frames'
  );
});

test('traceability rejects prompt-taxonomy relabeling of immutable archive frames', async () => {
  const traceability = structuredClone(await readApprovalAdminV2Traceability());
  traceability.frames.find((frame) => frame.id === 'APR-20A').areaId = 'audit-legal-compliance';
  await assert.rejects(
    validateApprovalAdminV2Traceability(traceability),
    (error) =>
      error instanceof ApprovalAdminV2TraceabilityError &&
      error.message === 'APR-20A is mapped to the wrong canonical APR area'
  );
});

test('traceability rejects a substituted source pair and source viewport', async () => {
  const traceability = structuredClone(await readApprovalAdminV2Traceability());
  traceability.frames[0].pairPath = traceability.frames[1].pairPath;
  await assert.rejects(
    validateApprovalAdminV2Traceability(traceability),
    (error) =>
      error instanceof ApprovalAdminV2TraceabilityError &&
      error.message === 'APR-17A pairPath differs from source manifest'
  );
});

test('supplemental product areas cannot claim an APR source frame', async () => {
  const traceability = structuredClone(await readApprovalAdminV2Traceability());
  traceability.numberingResolution.supplementalSurfaces[0].sourceFrameIds = ['APR-20A'];
  await assert.rejects(
    validateApprovalAdminV2Traceability(traceability),
    (error) =>
      error instanceof ApprovalAdminV2TraceabilityError &&
      error.message === 'integration-automation must not claim an APR source frame'
  );
});

test('traceability rejects incomplete canonical viewport evidence', async () => {
  const traceability = structuredClone(await readApprovalAdminV2Traceability());
  traceability.visualEvidenceContract.totalCaptureCount = 19;
  await assert.rejects(
    validateApprovalAdminV2Traceability(traceability),
    (error) =>
      error instanceof ApprovalAdminV2TraceabilityError &&
      error.message === 'total visual capture count must be 20'
  );
});

test('traceability rejects a missing backend-supported command contract', async () => {
  const traceability = structuredClone(await readApprovalAdminV2Traceability());
  traceability.commandEvidenceContract.supported.pop();
  await assert.rejects(
    validateApprovalAdminV2Traceability(traceability),
    (error) =>
      error instanceof ApprovalAdminV2TraceabilityError &&
      error.message === 'supported command evidence inventory differs'
  );
});

test('traceability rejects an overstated owner action contract inventory', async () => {
  const traceability = structuredClone(await readApprovalAdminV2Traceability());
  traceability.commandEvidenceContract.ownerActionInventory.actionContractCount = 41;
  await assert.rejects(
    validateApprovalAdminV2Traceability(traceability),
    (error) =>
      error instanceof ApprovalAdminV2TraceabilityError &&
      error.message === 'owner action contract count differs'
  );
});

test('traceability rejects a missing evidence-gated unavailable control', async () => {
  const traceability = structuredClone(await readApprovalAdminV2Traceability());
  traceability.commandEvidenceContract.evidenceGatedUnavailable.pop();
  await assert.rejects(
    validateApprovalAdminV2Traceability(traceability),
    (error) =>
      error instanceof ApprovalAdminV2TraceabilityError &&
      error.message === 'evidence-gated unavailable command inventory differs'
  );
});

test('traceability requires every unavailable control to be owned by one canonical area', async () => {
  const traceability = structuredClone(await readApprovalAdminV2Traceability());
  traceability.areas['deployment-canary-release'].unsupportedControlIds.pop();
  await assert.rejects(
    validateApprovalAdminV2Traceability(traceability),
    (error) =>
      error instanceof ApprovalAdminV2TraceabilityError &&
      error.message === 'canonical area unavailable control coverage differs'
  );
});
