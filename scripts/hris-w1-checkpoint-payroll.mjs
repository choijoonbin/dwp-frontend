import { randomUUID } from 'node:crypto';

import {
  PAYROLL_ROUTES,
  canonicalJson,
  hold,
  record,
  responseSummary,
  sha256Canonical,
  textValue,
} from './hris-w1-checkpoint-core.mjs';
import {
  assertReceipt,
  assertSameScopeBinding,
  configurationById,
  dataFromSuccess,
  evaluateExact,
  mutationJson,
  requestJson,
} from './hris-w1-checkpoint-live.mjs';

function commandHeaders(commandId, decisionRevision) {
  return {
    'Idempotency-Key': commandId,
    'X-Correlation-ID': `w1-checkpoint-${commandId}`,
    'X-DWP-Expected-Decision-Revision': decisionRevision,
  };
}

export async function runPayrollOwnerChain(
  sessionA,
  contracts,
  runtimeFixture,
  payrollProjection,
  databaseObservation
) {
  const initialBinding = assertSameScopeBinding(
    'PAY page/read/action',
    contracts.payrollPage,
    contracts.payrollRead,
    contracts.payrollUpdate
  );
  const scoped = (pathname) =>
    `${pathname}?contextScopeKey=${encodeURIComponent(initialBinding.contextScopeKey)}`;
  const initialResponse = await requestJson(sessionA, 'GET', scoped(PAYROLL_ROUTES.list.path));
  const initialWorkspace = dataFromSuccess(initialResponse, 'initial payroll workspace');
  const initial = configurationById(
    initialWorkspace,
    runtimeFixture.configurationId,
    'initial payroll workspace'
  );
  const legalEntity = record(
    record(initial.definition, 'initial payroll definition').legalEntity,
    'initial payroll definition.legalEntity'
  );
  if (
    initial.version !== runtimeFixture.version ||
    initial.version !== databaseObservation.currentVersion ||
    initial.status !== 'SIMULATED' ||
    initial.authorId !== runtimeFixture.authorActorId ||
    initial.authorId !== databaseObservation.authorId ||
    initial.authorId === sessionA.tenant.userId ||
    initial.lastCommandId !== databaseObservation.lastCommandId ||
    legalEntity.id !== payrollProjection.legalEntityId ||
    legalEntity.id !== databaseObservation.legalEntityId ||
    initial.access?.canPublish !== true ||
    initial.access?.publishDenialCode != null ||
    initial.freshness?.state !== 'LIVE'
  ) {
    hold('Initial payroll owner read does not match the attested runtime/DB fixture.');
  }
  const definition = structuredClone(record(initial.definition, 'initial payroll definition'));
  const originalName = textValue(
    definition.legalEntity?.displayName,
    'initial payroll definition legalEntity.displayName',
    180
  );
  definition.legalEntity.displayName = `${originalName} · W1`;
  if (definition.legalEntity.displayName.length > 200) {
    hold('Payroll fixture display name leaves no bounded update room.');
  }

  const updateAuthority = await evaluateExact(
    sessionA,
    PAYROLL_ROUTES.update.surfaceKey,
    PAYROLL_ROUTES.update.routeContractKey,
    'ALLOWED'
  );
  assertSameScopeBinding('PAY update binding', contracts.payrollPage, updateAuthority);
  const updateCommandId = randomUUID();
  const updatePath = scoped(
    `${PAYROLL_ROUTES.list.path}/${encodeURIComponent(runtimeFixture.configurationId)}`
  );
  const updateBody = { expectedVersion: initial.version, definition };
  const updateHeaders = commandHeaders(updateCommandId, updateAuthority.decisionRevision);
  const updateResponse = await mutationJson(sessionA, 'PUT', updatePath, updateBody, updateHeaders);
  const updateResult = dataFromSuccess(updateResponse, 'payroll update');
  const updated = assertReceipt(
    updateResult,
    {
      commandId: updateCommandId,
      commandType: 'UPDATE',
      configurationId: runtimeFixture.configurationId,
      resultVersion: initial.version + 1,
    },
    'payroll update'
  );
  if (
    updated.configuration.status !== 'DRAFT' ||
    updated.configuration.authorId !== sessionA.tenant.userId
  ) {
    hold('Payroll update did not establish the browser actor as the latest author.');
  }

  const replayResponse = await mutationJson(sessionA, 'PUT', updatePath, updateBody, updateHeaders);
  const replayResult = dataFromSuccess(replayResponse, 'payroll update replay');
  assertReceipt(
    replayResult,
    {
      commandId: updateCommandId,
      commandType: 'UPDATE',
      configurationId: runtimeFixture.configurationId,
      resultVersion: initial.version + 1,
    },
    'payroll update replay'
  );
  if (canonicalJson(updateResult) !== canonicalJson(replayResult)) {
    hold('Exact payroll idempotency replay returned a different command result.');
  }

  const simulateAuthority = await evaluateExact(
    sessionA,
    PAYROLL_ROUTES.simulate.surfaceKey,
    PAYROLL_ROUTES.simulate.routeContractKey,
    'ALLOWED'
  );
  assertSameScopeBinding('PAY simulate binding', contracts.payrollPage, simulateAuthority);
  const simulateCommandId = randomUUID();
  const simulatePath = scoped(
    `${PAYROLL_ROUTES.list.path}/${encodeURIComponent(runtimeFixture.configurationId)}/simulations`
  );
  const simulateResponse = await mutationJson(
    sessionA,
    'POST',
    simulatePath,
    { expectedVersion: initial.version + 1 },
    commandHeaders(simulateCommandId, simulateAuthority.decisionRevision)
  );
  const simulateResult = dataFromSuccess(simulateResponse, 'payroll simulation');
  const simulated = assertReceipt(
    simulateResult,
    {
      commandId: simulateCommandId,
      commandType: 'SIMULATE',
      configurationId: runtimeFixture.configurationId,
      resultVersion: initial.version + 2,
    },
    'payroll simulation'
  );
  if (
    simulated.configuration.status !== 'SIMULATED' ||
    simulated.configuration.authorId !== sessionA.tenant.userId ||
    simulated.configuration.simulation?.successful !== true ||
    simulated.configuration.simulation?.configurationVersion !== initial.version + 2
  ) {
    hold('Payroll simulation did not produce the exact owner-native result.');
  }

  const receiptAuthority = await evaluateExact(
    sessionA,
    PAYROLL_ROUTES.receipt.surfaceKey,
    PAYROLL_ROUTES.receipt.routeContractKey,
    'ALLOWED'
  );
  assertSameScopeBinding('PAY receipt binding', contracts.payrollPage, receiptAuthority);
  const receiptPath = scoped(
    `/api/payroll/v1/hris/payroll/foundation/receipts/${encodeURIComponent(simulateCommandId)}`
  );
  const receiptResponse = await requestJson(sessionA, 'GET', receiptPath);
  const receiptResult = dataFromSuccess(receiptResponse, 'payroll receipt lookup');
  assertReceipt(
    receiptResult,
    {
      commandId: simulateCommandId,
      commandType: 'SIMULATE',
      configurationId: runtimeFixture.configurationId,
      resultVersion: initial.version + 2,
    },
    'payroll receipt lookup'
  );
  if (canonicalJson(receiptResult) !== canonicalJson(simulateResult)) {
    hold('Payroll receipt GET did not reproduce the exact committed command result.');
  }

  const detailAuthority = await evaluateExact(
    sessionA,
    PAYROLL_ROUTES.detail.surfaceKey,
    PAYROLL_ROUTES.detail.routeContractKey,
    'ALLOWED'
  );
  const binding = assertSameScopeBinding(
    'PAY page/read/action/receipt/detail',
    contracts.payrollPage,
    contracts.payrollRead,
    contracts.payrollUpdate,
    updateAuthority,
    simulateAuthority,
    receiptAuthority,
    detailAuthority
  );
  const detailPath = scoped(
    `${PAYROLL_ROUTES.list.path}/${encodeURIComponent(runtimeFixture.configurationId)}`
  );
  const detailResponse = await requestJson(sessionA, 'GET', detailPath);
  const detail = dataFromSuccess(detailResponse, 'final payroll detail');
  if (
    detail.configurationId !== runtimeFixture.configurationId ||
    detail.version !== initial.version + 2 ||
    detail.status !== 'SIMULATED' ||
    detail.authorId !== sessionA.tenant.userId ||
    detail.lastCommandId !== simulateCommandId ||
    detail.access?.canPublish !== false ||
    detail.access?.publishDenialCode !== 'AUTHOR_PUBLISHER_SOD'
  ) {
    hold('Final payroll read model does not prove author=self separation of duties denial.');
  }
  return Object.freeze({
    contextBinding: binding,
    databasePreflight: structuredClone(databaseObservation),
    initial: {
      response: responseSummary(initialResponse),
      workspaceResponseSha256: initialResponse.bodySha256,
      configurationId: initial.configurationId,
      version: initial.version,
      status: initial.status,
      authorId: initial.authorId,
      lastCommandId: initial.lastCommandId,
      legalEntityId: legalEntity.id,
      canPublish: initial.access.canPublish,
    },
    update: {
      response: responseSummary(updateResponse),
      authority: updateAuthority,
      commandId: updateCommandId,
      resultVersion: updated.receipt.resultVersion,
      resultSha256: sha256Canonical(updateResult),
    },
    replay: {
      response: responseSummary(replayResponse),
      commandId: updateCommandId,
      resultVersion: replayResult.receipt.resultVersion,
      resultSha256: sha256Canonical(replayResult),
      exactResultMatch: true,
    },
    simulate: {
      response: responseSummary(simulateResponse),
      authority: simulateAuthority,
      commandId: simulateCommandId,
      resultVersion: simulated.receipt.resultVersion,
      status: simulated.configuration.status,
      resultSha256: sha256Canonical(simulateResult),
    },
    receipt: {
      response: responseSummary(receiptResponse),
      authority: receiptAuthority,
      commandId: simulateCommandId,
      commandType: receiptResult.receipt.commandType,
      resultVersion: receiptResult.receipt.resultVersion,
      exactResultMatch: true,
    },
    separationOfDuties: {
      evidenceKind: 'READ_MODEL_DENIAL',
      publishCommandAttempted: false,
      denialCode: detail.access.publishDenialCode,
      reason:
        'Publish authority requires a HIGH step-up challenge unavailable to this synthetic checkpoint.',
    },
    final: {
      response: responseSummary(detailResponse),
      authority: detailAuthority,
      configurationId: detail.configurationId,
      version: detail.version,
      authorId: detail.authorId,
      lastCommandId: detail.lastCommandId,
      canPublish: detail.access.canPublish,
      publishDenialCode: detail.access.publishDenialCode,
    },
  });
}
