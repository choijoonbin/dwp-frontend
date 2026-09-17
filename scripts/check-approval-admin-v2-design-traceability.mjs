import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  readApprovalStitchExtensionManifest,
  validateApprovalStitchExtensionManifest,
} from './check-approval-stitch-extension-source.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, '..');
export const APPROVAL_ADMIN_V2_TRACEABILITY_PATH = path.resolve(
  REPOSITORY_ROOT,
  'e2e/support/approval-admin-v2-design-traceability.json'
);

const ROUTES_FILE = 'apps/dwp/src/routes/approvals-routes.tsx';
const NAVIGATION_FILE = 'apps/dwp/src/features/approvals/approval-navigation.ts';
const ENDPOINTS_FILE = 'libs/shared-utils/src/api/approval-admin-v2-endpoints.ts';
const ACTION_CONTRACTS_FILE = 'libs/shared-utils/src/api/approval-release15-action-contracts.ts';
const CANONICAL_MUTATION_FILE =
  'libs/shared-utils/src/api/approval-admin-v2-canonical-mutation-api.ts';
const EXPECTED_STATES = [
  'loading',
  'empty',
  'forbidden',
  'conflict',
  'unavailable',
  'stale',
  'ready',
];
const EXPECTED_AREAS = [
  'template-library',
  'form-studio-v3',
  'routing-studio',
  'delegation-proxy-governance',
  'policy-sla-governance',
  'operations-incident-recovery',
  'audit-legal-compliance',
  'deployment-canary-release',
];
const EXPECTED_FRAME_AREAS = Object.fromEntries(
  [
    ['APR-17', 'template-library'],
    ['APR-18', 'form-studio-v3'],
    ['APR-19', 'routing-studio'],
    ['APR-20', 'delegation-proxy-governance'],
    ['APR-21', 'policy-sla-governance'],
    ['APR-22', 'operations-incident-recovery'],
    ['APR-23', 'audit-legal-compliance'],
    ['APR-24', 'deployment-canary-release'],
  ].flatMap(([apr, area]) => ['A', 'B', 'C'].map((suffix) => [`${apr}${suffix}`, area]))
);
const EXPECTED_VISUAL_SURFACES = [
  'APR-17',
  'APR-18',
  'APR-19',
  'APR-20',
  'APR-21',
  'APR-22',
  'APR-23',
  'APR-24',
];
const EXPECTED_SUPPLEMENTAL_VISUALS = ['integration-automation', 'analytics-insights'];
const EXPECTED_COMMAND_IDS = [
  'template.compare',
  'template.install',
  'form.save-draft',
  'form.validate',
  'form.submit-review',
  'routing.simulate',
  'routing.save-draft',
  'routing.publish',
  'routing.retire',
  'connector.probe',
  'incident.execute-stage',
  'audit.prepare-export',
  'deployment.activate',
];
const EXPECTED_UNAVAILABLE_CONTROL_IDS = [
  'templates.importPackage',
  'routing.requestRemediation',
  'policies.editWithoutCompleteDraft',
  'policies.publishWithoutIndependentReview',
  'policies.reviewDelegationWithoutDisposition',
  'incidents.prepareWithoutAuthoredPlan',
  'incidents.pauseQueue',
  'audit.verifyExternalIntegrity',
  'audit.linkExternalAttestationWithoutSignedReceipt',
  'audit.requestLegalHoldReview',
  'deployments.pauseCanary',
  'deployments.rollbackWithoutBoundReason',
];

export class ApprovalAdminV2TraceabilityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApprovalAdminV2TraceabilityError';
  }
}

function fail(message) {
  throw new ApprovalAdminV2TraceabilityError(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertNonEmptyString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be non-empty`);
}

function assertRelativeFile(value, label) {
  assertNonEmptyString(value, label);
  assert(!path.isAbsolute(value), `${label} must be repository-relative`);
  assert(!value.split('/').includes('..'), `${label} must not escape the repository`);
}

async function sourceText(repositoryRoot, relativeFile) {
  assertRelativeFile(relativeFile, 'source file');
  return readFile(path.resolve(repositoryRoot, relativeFile), 'utf8');
}

export async function readApprovalAdminV2Traceability(
  traceabilityPath = APPROVAL_ADMIN_V2_TRACEABILITY_PATH
) {
  return JSON.parse(await readFile(traceabilityPath, 'utf8'));
}

export async function validateApprovalAdminV2Traceability(
  traceability,
  { manifest: providedManifest, repositoryRoot = REPOSITORY_ROOT } = {}
) {
  const manifest = providedManifest ?? (await readApprovalStitchExtensionManifest());
  validateApprovalStitchExtensionManifest(manifest);
  assert(traceability?.schemaVersion === 2, 'traceability schemaVersion must be 2');
  assert(
    traceability.sourceManifest?.path === 'e2e/support/approval-stitch-extension-manifest.json',
    'traceability must bind the canonical extension manifest'
  );
  assert(
    traceability.sourceManifest.projectId === manifest.sourceProjectId,
    'traceability Stitch project differs from source manifest'
  );
  assert(
    traceability.sourceManifest.delivery === manifest.sourceDelivery,
    'traceability delivery differs from source manifest'
  );
  assert(
    traceability.sourceManifest.integritySha256 === manifest.integritySha256,
    'traceability manifest integrity differs'
  );
  assert(
    traceability.sourceManifest.sourceTreeSha256 === manifest.sourceTreeSha256,
    'traceability source tree differs'
  );
  assert(traceability.sourceManifest.frameCount === 24, 'traceability frame count must be 24');
  assert(
    JSON.stringify(traceability.sharedStateContract) === JSON.stringify(EXPECTED_STATES),
    'shared source state contract differs'
  );
  assert(
    traceability.numberingResolution?.authority === 'immutable-source-manifest',
    'numbering authority must remain the immutable source manifest'
  );

  const visual = traceability.visualEvidenceContract;
  assert(visual?.captureMode === 'viewport', 'visual evidence must use viewport capture');
  assert(
    JSON.stringify(visual.canonicalSurfaceIds) === JSON.stringify(EXPECTED_VISUAL_SURFACES),
    'canonical visual evidence surface inventory differs'
  );
  assert(
    JSON.stringify(visual.supplementalSurfaceIds) === JSON.stringify(EXPECTED_SUPPLEMENTAL_VISUALS),
    'supplemental visual evidence surface inventory differs'
  );
  assert(
    JSON.stringify(visual.viewports) === JSON.stringify(['desktop-1440', 'mobile-390']),
    'visual evidence viewport inventory differs'
  );
  assert(visual.canonicalCaptureCount === 16, 'canonical visual capture count must be 16');
  assert(visual.supplementalCaptureCount === 4, 'supplemental visual capture count must be 4');
  assert(visual.totalCaptureCount === 20, 'total visual capture count must be 20');
  assert(
    Array.isArray(visual.snapshotNames) &&
      visual.snapshotNames.length === 10 &&
      new Set(visual.snapshotNames).size === 10,
    'visual snapshot names must contain ten unique cross-project baselines'
  );

  const commandEvidence = traceability.commandEvidenceContract;
  assertNonEmptyString(commandEvidence?.scope, 'commandEvidenceContract.scope');
  const ownerActions = commandEvidence.ownerActionInventory;
  assert(ownerActions?.source === ACTION_CONTRACTS_FILE, 'owner action inventory source differs');
  assert(
    ownerActions?.canonicalMutationSource === CANONICAL_MUTATION_FILE,
    'canonical mutation source differs'
  );
  const actionContractsSource = await sourceText(repositoryRoot, ACTION_CONTRACTS_FILE);
  const canonicalMutationSource = await sourceText(repositoryRoot, CANONICAL_MUTATION_FILE);
  const actionFunctions = [...actionContractsSource.matchAll(/apiFunction:\s*'([^']+)'/gu)].map(
    (match) => match[1]
  );
  const highRiskRoutes = [...actionContractsSource.matchAll(/operation:\s*'([^']+)'/gu)].map(
    (match) => match[1]
  );
  const canonicalMutationWrappers = [
    ...canonicalMutationSource.matchAll(/^export function\s+([^\s(]+)/gmu),
  ].map((match) => match[1]);
  const unboundMatch = canonicalMutationSource.match(
    /APPROVAL_ADMIN_V2_UNSUPPORTED_MUTATION_API_FUNCTIONS\s*=\s*\[([\s\S]*?)\]\s*as const/u
  );
  assert(unboundMatch, 'intentionally unbound mutation API inventory is missing');
  const intentionallyUnboundFunctions = [...unboundMatch[1].matchAll(/'([^']+)'/gu)].map(
    (match) => match[1]
  );
  assert(
    actionFunctions.length === 42 && new Set(actionFunctions).size === 42,
    'owner action contract inventory must contain 42 unique API functions'
  );
  assert(
    highRiskRoutes.length === 16 && new Set(highRiskRoutes).size === 16,
    'owner high-risk route inventory must contain 16 unique operations'
  );
  assert(
    canonicalMutationWrappers.length === 10 && new Set(canonicalMutationWrappers).size === 10,
    'canonical mutation wrapper inventory must contain 10 unique functions'
  );
  assert(
    intentionallyUnboundFunctions.length === 9 && new Set(intentionallyUnboundFunctions).size === 9,
    'intentionally unbound mutation inventory must contain 9 unique functions'
  );
  assert(ownerActions.actionContractCount === 42, 'owner action contract count differs');
  assert(ownerActions.highRiskRouteCount === 16, 'owner high-risk route count differs');
  assert(
    ownerActions.canonicalMutationWrapperCount === 10,
    'canonical mutation wrapper count differs'
  );
  assert(
    ownerActions.intentionallyUnboundMutationApiFunctionCount === 9,
    'intentionally unbound mutation API function count differs'
  );
  assert(
    JSON.stringify(commandEvidence?.supported?.map((command) => command.id)) ===
      JSON.stringify(EXPECTED_COMMAND_IDS),
    'supported command evidence inventory differs'
  );
  for (const command of commandEvidence.supported) {
    assert(['GET', 'POST', 'PUT'].includes(command.method), `${command.id} method is unsupported`);
    assert(
      typeof command.path === 'string' && command.path.startsWith('/api/approvals/v1/admin/'),
      `${command.id} path is not a canonical Approval administration route`
    );
  }
  assert(
    JSON.stringify(commandEvidence.evidenceGatedUnavailable) ===
      JSON.stringify(EXPECTED_UNAVAILABLE_CONTROL_IDS),
    'evidence-gated unavailable command inventory differs'
  );
  assertNonEmptyString(
    commandEvidence.unsupportedControlRule,
    'commandEvidenceContract.unsupportedControlRule'
  );

  const areas = traceability.areas;
  assert(areas && typeof areas === 'object', 'traceability areas must be an object');
  assert(
    JSON.stringify(Object.keys(areas)) === JSON.stringify(EXPECTED_AREAS),
    'canonical APR area inventory or ordering differs'
  );

  const routeSource = await sourceText(repositoryRoot, ROUTES_FILE);
  const navigationSource = await sourceText(repositoryRoot, NAVIGATION_FILE);
  const endpointSource = await sourceText(repositoryRoot, ENDPOINTS_FILE);
  for (const [areaId, area] of Object.entries(areas)) {
    assertNonEmptyString(area.route, `${areaId}.route`);
    assertNonEmptyString(area.routeContractKey, `${areaId}.routeContractKey`);
    assertNonEmptyString(area.runtimeExport, `${areaId}.runtimeExport`);
    assertNonEmptyString(area.workspaceExport, `${areaId}.workspaceExport`);
    assertNonEmptyString(area.workspaceView, `${areaId}.workspaceView`);
    assertRelativeFile(area.runtimeFile, `${areaId}.runtimeFile`);
    assertRelativeFile(area.workspaceFile, `${areaId}.workspaceFile`);
    const runtimeSource = await sourceText(repositoryRoot, area.runtimeFile);
    const workspaceSource = await sourceText(repositoryRoot, area.workspaceFile);
    assert(
      runtimeSource.includes(`export function ${area.runtimeExport}`),
      `${areaId} runtime export is missing: ${area.runtimeExport}`
    );
    assert(
      runtimeSource.includes(`<${area.workspaceExport}`) ||
        runtimeSource.includes(`import { ${area.workspaceExport}`),
      `${areaId} runtime does not mount ${area.workspaceExport}`
    );
    assert(
      workspaceSource.includes(`export function ${area.workspaceExport}`),
      `${areaId} workspace export is missing: ${area.workspaceExport}`
    );
    assert(routeSource.includes(area.routeContractKey), `${areaId} route contract is not mounted`);
    assert(
      navigationSource.includes(`path: '${area.route}'`),
      `${areaId} navigation route is missing`
    );
    assert(
      Array.isArray(area.requiredHandlers) && area.requiredHandlers.length > 0,
      `${areaId} must bind required handlers`
    );
    assert(
      new Set(area.requiredHandlers).size === area.requiredHandlers.length,
      `${areaId} contains duplicate handler bindings`
    );
    for (const handler of area.requiredHandlers) {
      assertNonEmptyString(handler, `${areaId}.handler`);
      assert(
        workspaceSource.includes(handler),
        `${areaId} workspace is missing required handler ${handler}`
      );
      assert(
        runtimeSource.includes(handler),
        `${areaId} runtime is missing required handler ${handler}`
      );
    }
    assert(
      Array.isArray(area.unsupportedControlIds),
      `${areaId} unsupported controls must be an array`
    );
    for (const controlId of area.unsupportedControlIds) {
      assert(
        endpointSource.includes(`'${controlId}'`),
        `${areaId} unsupported control is not declared fail-closed: ${controlId}`
      );
    }
  }
  const unsupportedControlIds = Object.values(areas).flatMap((area) => area.unsupportedControlIds);
  assert(
    unsupportedControlIds.length === EXPECTED_UNAVAILABLE_CONTROL_IDS.length &&
      new Set(unsupportedControlIds).size === unsupportedControlIds.length &&
      JSON.stringify([...unsupportedControlIds].sort()) ===
        JSON.stringify([...EXPECTED_UNAVAILABLE_CONTROL_IDS].sort()),
    'canonical area unavailable control coverage differs'
  );

  assert(Array.isArray(traceability.frames), 'traceability frames must be an array');
  assert(traceability.frames.length === 24, 'traceability must map all 24 source frames');
  const manifestById = new Map(manifest.frames.map((frame) => [frame.id, frame]));
  const ids = [];
  for (const frame of traceability.frames) {
    assertNonEmptyString(frame.id, 'frame.id');
    ids.push(frame.id);
    const source = manifestById.get(frame.id);
    assert(source, `traceability contains unknown source frame ${frame.id}`);
    assert(frame.pairPath === source.pairPath, `${frame.id} pairPath differs from source manifest`);
    assert(
      frame.viewportIntent === source.viewportIntent,
      `${frame.id} viewport intent differs from source manifest`
    );
    assert(
      frame.areaId === EXPECTED_FRAME_AREAS[frame.id],
      `${frame.id} is mapped to the wrong canonical APR area`
    );
    assert(areas[frame.areaId], `${frame.id} references an unknown area`);
    assertNonEmptyString(frame.sourceIntent, `${frame.id}.sourceIntent`);
    assert(
      Array.isArray(frame.requiredInteractionIds) && frame.requiredInteractionIds.length >= 3,
      `${frame.id} must bind at least three interaction or governance obligations`
    );
    assert(
      new Set(frame.requiredInteractionIds).size === frame.requiredInteractionIds.length,
      `${frame.id} contains duplicate interaction obligations`
    );
    const profile = traceability.verificationProfiles?.[frame.viewportIntent];
    assert(
      Array.isArray(profile) && profile.length >= 7,
      `${frame.id} verification profile is missing`
    );
  }
  assert(
    JSON.stringify(ids) === JSON.stringify(manifest.frames.map((frame) => frame.id)),
    'traceability source frame ordering differs from the immutable manifest'
  );

  const supplemental = traceability.numberingResolution.supplementalSurfaces;
  assert(
    Array.isArray(supplemental) && supplemental.length === 2,
    'expected two supplemental areas'
  );
  for (const surface of supplemental) {
    assert(
      surface.classification === 'product-supplemental-no-stitch-frame',
      `${surface.id} supplemental classification differs`
    );
    assert(
      Array.isArray(surface.sourceFrameIds) && surface.sourceFrameIds.length === 0,
      `${surface.id} must not claim an APR source frame`
    );
    assert(navigationSource.includes(`path: '${surface.route}'`), `${surface.id} route is missing`);
    const runtimeSource = await sourceText(
      repositoryRoot,
      'apps/dwp/src/features/approvals/admin-v2/approval-admin-v2-runtime.tsx'
    );
    assert(
      runtimeSource.includes(`export function ${surface.runtimeExport}`),
      `${surface.id} runtime export is missing`
    );
    assert(
      runtimeSource.includes(surface.workspaceExport),
      `${surface.id} workspace is not mounted by the runtime`
    );
  }

  return {
    frameCount: traceability.frames.length,
    canonicalAreaCount: EXPECTED_AREAS.length,
    supplementalAreaCount: supplemental.length,
    stateCount: EXPECTED_STATES.length,
    visualCaptureCount: visual.totalCaptureCount,
    supportedCommandCount: commandEvidence.supported.length,
    unavailableControlCount: commandEvidence.evidenceGatedUnavailable.length,
    ownerActionContractCount: actionFunctions.length,
    ownerHighRiskRouteCount: highRiskRoutes.length,
  };
}

export async function runApprovalAdminV2DesignTraceabilityCheck(options = {}) {
  const traceability = await readApprovalAdminV2Traceability(options.traceabilityPath);
  return validateApprovalAdminV2Traceability(traceability, options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const summary = await runApprovalAdminV2DesignTraceabilityCheck();
    console.log(
      `Approval APR-17..24 traceability PASS: ${summary.frameCount} frames, ${summary.canonicalAreaCount} canonical areas, ${summary.supplementalAreaCount} supplemental areas, ${summary.stateCount} source states, ${summary.visualCaptureCount} viewport captures, ${summary.supportedCommandCount} supported commands, ${summary.unavailableControlCount} unavailable controls, ${summary.ownerActionContractCount} owner action contracts, ${summary.ownerHighRiskRouteCount} high-risk routes`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
