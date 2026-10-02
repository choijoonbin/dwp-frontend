import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  REQUIRED_ASSERTIONS,
  hold,
  sha256Bytes,
  sha256Canonical,
} from './hris-w1-checkpoint-core.mjs';

async function atomicJson(pathname, value) {
  const temporary = `${pathname}.tmp-${process.pid}-${randomUUID()}`;
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' });
  await chmod(temporary, 0o600);
  await rename(temporary, pathname);
  await chmod(pathname, 0o600);
  return { sha256: sha256Bytes(bytes), byteCount: bytes.byteLength };
}

function pathLineageObservation(input) {
  const payrollResponse = input.browserSummary.payrollResponse;
  if (
    payrollResponse.responseBodySha256 === undefined ||
    payrollResponse.payrollConfigurationIds?.length !== 1 ||
    payrollResponse.payrollConfigurationIds[0] !== input.runtimeFixture.configurationId ||
    input.ownerChain.initial.configurationId !== input.runtimeFixture.configurationId ||
    input.ownerChain.initial.legalEntityId !== input.payrollProjection.legalEntityId
  ) {
    hold('Browser, Gateway owner, runtime fixture, and DB projection lineage is incomplete.');
  }
  const observation = {
    source: 'BROWSER_GATEWAY_OWNER_DB',
    tenantId: input.environment.tenants[0].tenantId,
    configurationId: input.runtimeFixture.configurationId,
    preflightObservationSha256: input.databaseObservation.observationSha256,
    workspaceResponseSha256: payrollResponse.responseBodySha256,
    payrollConfigurationIds: [...payrollResponse.payrollConfigurationIds],
    updateCommandId: input.ownerChain.update.commandId,
    updateResponseSha256: input.ownerChain.update.resultSha256,
    simulateCommandId: input.ownerChain.simulate.commandId,
    simulateResponseSha256: input.ownerChain.simulate.resultSha256,
    expectedFinalVersion: input.runtimeFixture.version + 2,
  };
  return Object.freeze({ ...observation, observationSha256: sha256Canonical(observation) });
}

export function generalOwnerApiObservations(input) {
  return [
    input.sessionA.authentication,
    input.ownerChain.contextBinding,
    {
      pageAuthority: input.contracts.payrollPage,
      readAuthority: input.contracts.payrollRead,
      actionAuthority: input.contracts.payrollUpdate,
    },
    input.timeOwnerRead,
    input.ownerChain.initial,
    input.ownerChain.final,
  ];
}

function assertionObservations(input) {
  const browserA = input.browserSummary.tenants.find((tenant) => tenant.label === 'tenant-a');
  const browserB = input.browserSummary.tenants.find((tenant) => tenant.label === 'tenant-b');
  if (!browserA || !browserB) hold('Validated browser summary lost a tenant binding.');
  const highRoute = browserA.routes.find((route) => route.id === 'tenant-a-pay-high-preview');
  if (!highRoute?.highRisk) hold('Validated browser summary lost the PAY HIGH preview.');
  const negatives = Object.fromEntries(
    input.negativeObservations.observations.map((item) => [item.assertionName, item])
  );
  return new Map([
    ['tenant-a.general-owner-api', generalOwnerApiObservations(input)],
    ['tenant-a.high-assurance-step-up', [input.contracts.publishPreview, highRoute.highRisk]],
    [
      'tenant-a.receipt-lineage',
      [
        input.ownerChain.update,
        input.ownerChain.simulate,
        input.ownerChain.receipt,
        input.ownerChain.final,
      ],
    ],
    ['tenant-a.idempotency-replay', [input.ownerChain.update, input.ownerChain.replay]],
    [
      'tenant-a.separation-of-duties',
      [input.ownerChain.separationOfDuties, input.ownerChain.simulate, input.ownerChain.final],
    ],
    [
      'tenant-b.feature-off',
      [
        {
          tenantId: input.environment.tenants[1].tenantId,
          rollout: input.contracts.rolloutB,
          featureOff: input.contracts.featureOff,
          browserRollout: {
            state: browserB.rolloutState,
            authorityStatus: browserB.authorityStatus,
            flags: browserB.rolloutFlags,
          },
        },
      ],
    ],
    [
      'tenant-b.denied',
      [
        {
          tenantId: input.environment.tenants[1].tenantId,
          routes: browserB.routes.map((route) => ({
            id: route.id,
            outcome: route.outcome,
            finalPath: route.finalPath,
            screenshot: route.screenshot,
          })),
        },
      ],
    ],
    [
      'isolation.cross-tenant-denied',
      [input.crossTenant, browserA.crossTenantMe, browserB.crossTenantMe],
    ],
    ['isolation.population-boundary', [input.populationBoundary]],
    ['negative.stale-evidence-denied', [negatives['negative.stale-evidence-denied']]],
    ['negative.expired-evidence-denied', [negatives['negative.expired-evidence-denied']]],
    ['negative.revoked-evidence-denied', [negatives['negative.revoked-evidence-denied']]],
    ['negative.unmapped-route-denied', [input.unmappedBoundary, input.contracts.deniedPage]],
    ['path.browser-gateway-owner-db', [pathLineageObservation(input)]],
    [
      'rollout.flag-off',
      [
        {
          tenantId: input.environment.tenants[1].tenantId,
          state: input.contracts.rolloutB.state,
          flags: input.contracts.rolloutB.flags,
          authorityStatus: input.contracts.rolloutB.authorityStatus,
          featureOff: input.contracts.featureOff,
        },
      ],
    ],
  ]);
}

export async function writeEvidenceBundle(input) {
  const assertionDir = path.join(input.environment.evidenceDir, 'checkpoint', 'assertions');
  if (existsSync(assertionDir)) hold('Checkpoint assertion directory already exists.');
  await mkdir(assertionDir, { mode: 0o700 });
  await chmod(assertionDir, 0o700);
  const observations = assertionObservations(input);
  if (
    observations.size !== REQUIRED_ASSERTIONS.length ||
    REQUIRED_ASSERTIONS.some((name) => !observations.has(name))
  ) {
    hold('Internal checkpoint assertion construction is incomplete.');
  }
  const provenance = Object.freeze({
    frontend: input.provenance.frontend,
    runtimeManifest: input.provenance.runtimeManifest,
    browser: input.provenance.browser,
  });
  const assertions = [];
  for (const name of REQUIRED_ASSERTIONS) {
    const records = observations.get(name);
    if (!Array.isArray(records) || !records.length || records.some((item) => !item)) {
      hold(`${name} has no honest observation.`);
    }
    const relativePath = path.posix.join('checkpoint', 'assertions', `${name}.json`);
    const evidence = {
      schemaVersion: 1,
      runId: input.environment.runId,
      syntheticOnly: true,
      assertionName: name,
      status: 'PASS',
      activeBundle: input.environment.activeBundle,
      endpoints: input.environment.endpoints,
      provenance,
      observations: records,
    };
    const written = await atomicJson(
      path.join(input.environment.evidenceDir, relativePath),
      evidence
    );
    assertions.push({
      name,
      status: 'PASS',
      evidencePath: relativePath,
      evidenceSha256: written.sha256,
    });
  }
  await atomicJson(input.environment.checkpointManifest, {
    schemaVersion: 1,
    runId: input.environment.runId,
    syntheticOnly: true,
    status: 'PASS',
    activeBundle: input.environment.activeBundle,
    endpoints: input.environment.endpoints,
    generatedAt: new Date().toISOString(),
    provenance,
    assertions,
  });
}
