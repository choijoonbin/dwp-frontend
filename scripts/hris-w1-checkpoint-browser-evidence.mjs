import { readdirSync } from 'node:fs';
import path from 'node:path';

import {
  BROWSER_SCHEMA,
  PAYROLL_ROUTES,
  SHA256,
  UUID,
  canonicalJson,
  exactKeys,
  hold,
  instant,
  readAttestedRegular,
  record,
  safeApiPath,
  textValue,
} from './hris-w1-checkpoint-core.mjs';
import {
  HRIS_W1_AUTHORITY_EVALUATION_PATH,
  buildHrisW1ActiveEvaluationContracts,
  isExactHrisW1AuthorityResponseEvidence,
  isExactHrisW1ExpectedBlockedSideEffect,
  isHrisW1BackgroundPageEvaluationTuple,
} from '../e2e/support/hris-w1-browser-firewall-contract.mjs';

function relativeInside(root, candidate, location) {
  const absolute = path.resolve(candidate);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    hold(`${location} is outside the owned browser artifact.`);
  }
  const file = readAttestedRegular(absolute, location);
  return { absolute, relative, file };
}

export function selectBrowserPayrollResponse(network, configurationId, location = 'browser PAY') {
  if (!Array.isArray(network)) hold(`${location}.network must be an array.`);
  const matches = network.filter(
    (item) =>
      item?.method === 'GET' &&
      item.path === PAYROLL_ROUTES.list.path &&
      item.status === 200 &&
      item.fromServiceWorker !== true &&
      Array.isArray(item.payrollConfigurationIds) &&
      item.payrollConfigurationIds.length === 1 &&
      item.payrollConfigurationIds[0] === configurationId &&
      SHA256.test(String(item.responseBodySha256 ?? '')) &&
      item.bodyByteLength > 0
  );
  if (matches.length !== 1) {
    hold(`${location} must contain exactly one response for the exact payroll configuration.`);
  }
  return structuredClone(matches[0]);
}

function validateNetwork(routeEvidence, routeConfig, location, payrollConfigurationId) {
  if (!Array.isArray(routeEvidence.network)) hold(`${location}.network must be an array.`);
  for (let index = 0; index < routeEvidence.network.length; index += 1) {
    const item = record(routeEvidence.network[index], `${location}.network[${index}]`);
    const allowedKeys = [
      'method',
      'path',
      'contextScopeKey',
      'status',
      'bodyByteLength',
      'responseBodySha256',
      'payrollConfigurationIds',
      'fromServiceWorker',
    ];
    if (Object.keys(item).some((key) => !allowedKeys.includes(key))) {
      hold(`${location}.network[${index}] contains an unsupported field.`);
    }
    if (
      !['GET', 'HEAD', 'OPTIONS', 'POST'].includes(item.method) ||
      safeApiPath(item.path, `${location}.network[${index}].path`) !== item.path ||
      !(
        item.contextScopeKey === null ||
        (typeof item.contextScopeKey === 'string' && item.contextScopeKey)
      ) ||
      (item.status !== undefined &&
        (!Number.isSafeInteger(item.status) || item.status < 100 || item.status > 599)) ||
      (item.bodyByteLength !== undefined &&
        (!Number.isSafeInteger(item.bodyByteLength) || item.bodyByteLength < 0)) ||
      (item.fromServiceWorker !== undefined && typeof item.fromServiceWorker !== 'boolean')
    ) {
      hold(`${location}.network[${index}] is not a strict browser request/response record.`);
    }
    if (item.status !== undefined) {
      if (!SHA256.test(String(item.responseBodySha256 ?? ''))) {
        hold(`${location}.network[${index}] response lacks a body digest.`);
      }
    } else if (
      item.responseBodySha256 !== undefined ||
      item.payrollConfigurationIds !== undefined
    ) {
      hold(`${location}.network[${index}] request cannot claim response content.`);
    }
    if (item.payrollConfigurationIds !== undefined) {
      if (
        item.method !== 'GET' ||
        item.path !== PAYROLL_ROUTES.list.path ||
        item.status !== 200 ||
        !Array.isArray(item.payrollConfigurationIds) ||
        item.payrollConfigurationIds.length !== 1 ||
        item.payrollConfigurationIds[0] !== payrollConfigurationId ||
        !UUID.test(item.payrollConfigurationIds[0])
      ) {
        hold(`${location}.network[${index}] has an invalid payroll content lineage.`);
      }
    }
  }
  for (const expected of routeConfig.api) {
    const found = routeEvidence.network.some(
      (item) =>
        item?.method === expected.method &&
        item.path === expected.path &&
        expected.statuses.includes(item.status) &&
        SHA256.test(String(item.responseBodySha256 ?? '')) &&
        (expected.method !== 'GET' ||
          (item.contextScopeKey === routeConfig.expectedScopeKey && item.bodyByteLength > 0)) &&
        item.fromServiceWorker !== true
    );
    if (!found) hold(`${location} lacks the exact ${expected.method} ${expected.path} response.`);
  }
}

function expectedFinalPath(route) {
  return route.outcome === 'redirected' ? route.redirectPath : route.path;
}

function validateBrowserRoute(routeEvidence, routeConfig, options, location) {
  const evidence = record(routeEvidence, location);
  const routeFields = [
    'id',
    'module',
    'requestedPath',
    'finalPath',
    'outcome',
    'screenshot',
    'network',
  ];
  if (routeConfig.outcome === 'denied' || routeConfig.outcome === 'authority-unavailable') {
    routeFields.push('accessState');
  }
  if (routeConfig.highRiskPreview) routeFields.push('highRiskScreenshot', 'highRiskEvaluation');
  exactKeys(evidence, routeFields, location);
  if (
    evidence.id !== routeConfig.id ||
    evidence.module !== routeConfig.module ||
    evidence.requestedPath !== routeConfig.path ||
    evidence.outcome !== routeConfig.outcome ||
    evidence.finalPath !== expectedFinalPath(routeConfig)
  ) {
    hold(`${location} is not bound to its exact route matrix record.`);
  }
  if (
    routeConfig.outcome === 'denied' &&
    !routeConfig.accessStates.includes(evidence.accessState)
  ) {
    hold(`${location}.accessState is not an expected fail-closed state.`);
  }
  const screenshot = relativeInside(
    options.artifactRoot,
    evidence.screenshot,
    `${location}.screenshot`
  );
  validateNetwork(evidence, routeConfig, location, options.payrollConfigurationId);
  const result = {
    id: routeConfig.id,
    outcome: routeConfig.outcome,
    finalPath: evidence.finalPath,
    screenshot: { path: screenshot.relative, sha256: screenshot.file.sha256 },
    network: structuredClone(evidence.network),
  };
  if (routeConfig.highRiskPreview) {
    const high = record(evidence.highRiskEvaluation, `${location}.highRiskEvaluation`);
    const highKeys = [
      'status',
      'routeContractKey',
      'operation',
      'decision',
      'reasonCode',
      'requiredAssurance',
      'decisionRevision',
      'revalidateAt',
      'observedAt',
    ];
    if (high.requestPolicyRef !== undefined) highKeys.push('requestPolicyRef');
    if (high.validUntil !== undefined) highKeys.push('validUntil');
    exactKeys(high, highKeys, `${location}.highRiskEvaluation`);
    if (
      high.status !== 200 ||
      high.routeContractKey !== routeConfig.highRiskPreview.expectedRouteContractKey ||
      high.operation !== routeConfig.highRiskPreview.expectedOperation ||
      high.decision !== 'STEP_UP_REQUIRED' ||
      high.reasonCode !== 'STEP_UP_REQUIRED' ||
      high.requiredAssurance !== 'urn:dwp:assurance:high' ||
      typeof high.decisionRevision !== 'string' ||
      !high.decisionRevision
    ) {
      hold(`${location}.highRiskEvaluation is not exact STEP_UP_REQUIRED evidence.`);
    }
    instant(high.observedAt, `${location}.highRiskEvaluation.observedAt`);
    instant(high.revalidateAt, `${location}.highRiskEvaluation.revalidateAt`);
    if (
      Date.parse(high.observedAt) > Date.parse(options.manifestGeneratedAt) ||
      Date.parse(high.revalidateAt) <= Date.parse(high.observedAt)
    ) {
      hold(`${location}.highRiskEvaluation freshness lineage is invalid.`);
    }
    if (high.validUntil !== undefined) {
      instant(high.validUntil, `${location}.highRiskEvaluation.validUntil`);
      if (Date.parse(high.validUntil) <= Date.parse(high.observedAt)) {
        hold(`${location}.highRiskEvaluation.validUntil was stale when observed.`);
      }
    }
    const highScreenshot = relativeInside(
      options.artifactRoot,
      evidence.highRiskScreenshot,
      `${location}.highRiskScreenshot`
    );
    result.highRisk = {
      ...structuredClone(high),
      screenshot: { path: highScreenshot.relative, sha256: highScreenshot.file.sha256 },
    };
  }
  return result;
}

export function validateHomeLaunchpadIdentityEvidence(
  value,
  options,
  location = 'tenant-a.homeLaunchpadIdentity'
) {
  const evidence = record(value, location);
  exactKeys(
    evidence,
    [
      'requestedPath',
      'finalPath',
      'appId',
      'visibleLabel',
      'shortLabel',
      'fullLabel',
      'screenshot',
    ],
    location
  );
  if (
    evidence.requestedPath !== '/' ||
    evidence.finalPath !== '/' ||
    evidence.appId !== 'ref-app-people' ||
    evidence.visibleLabel !== 'HRIS' ||
    evidence.shortLabel !== 'HRIS' ||
    evidence.fullLabel !== 'HRIS'
  ) {
    hold(`${location} is not exact Global Home HRIS product-identity evidence.`);
  }
  const screenshot = relativeInside(
    options.artifactRoot,
    evidence.screenshot,
    `${location}.screenshot`
  );
  return Object.freeze({
    requestedPath: '/',
    finalPath: '/',
    appId: 'ref-app-people',
    visibleLabel: 'HRIS',
    shortLabel: 'HRIS',
    fullLabel: 'HRIS',
    screenshot: Object.freeze({ path: screenshot.relative, sha256: screenshot.file.sha256 }),
  });
}

function validateFirewall(value, label, routeMatrix) {
  const firewall = record(value, `${label}.firewall`);
  exactKeys(
    firewall,
    [
      'interceptedHttpRequests',
      'continuedHttpRequests',
      'continuedMutations',
      'evaluationRequests',
      'expectedBlockedSideEffects',
      'blockedMutations',
      'blockedExternalHttp',
      'blockedExternalWebSockets',
    ],
    `${label}.firewall`
  );
  if (
    !Number.isSafeInteger(firewall.interceptedHttpRequests) ||
    firewall.interceptedHttpRequests <= 0 ||
    !Number.isSafeInteger(firewall.continuedHttpRequests) ||
    firewall.continuedHttpRequests <= 0 ||
    firewall.continuedHttpRequests > firewall.interceptedHttpRequests ||
    !Array.isArray(firewall.continuedMutations) ||
    !Array.isArray(firewall.expectedBlockedSideEffects)
  ) {
    hold(`${label}.firewall counters/mutations are invalid.`);
  }
  if (
    firewall.interceptedHttpRequests !==
    firewall.continuedHttpRequests + firewall.expectedBlockedSideEffects.length
  ) {
    hold(`${label}.firewall HTTP requests do not have exactly one terminal action.`);
  }
  for (const item of firewall.continuedMutations) {
    const mutation = record(item, `${label}.firewall.continuedMutations[]`);
    exactKeys(mutation, ['method', 'path'], `${label}.firewall.continuedMutations[]`);
    if (mutation.method !== 'POST' || mutation.path !== HRIS_W1_AUTHORITY_EVALUATION_PATH) {
      hold(`${label}.firewall forwarded a non-authority mutation.`);
    }
  }
  for (const item of firewall.expectedBlockedSideEffects) {
    if (!isExactHrisW1ExpectedBlockedSideEffect(item)) {
      hold(`${label}.firewall contains a malformed expected blocked side effect.`);
    }
  }
  for (const key of ['blockedMutations', 'blockedExternalHttp', 'blockedExternalWebSockets']) {
    if (!Array.isArray(firewall[key]) || firewall[key].length) {
      hold(`${label}.firewall.${key} must be empty.`);
    }
  }
  if (!Array.isArray(firewall.evaluationRequests)) {
    hold(`${label}.firewall.evaluationRequests must be an array.`);
  }
  const activeContracts = buildHrisW1ActiveEvaluationContracts(routeMatrix, label === 'tenant-a');
  let backgroundCount = 0;
  for (const item of firewall.evaluationRequests) {
    const evaluation = record(item, `${label}.firewall.evaluationRequests[]`);
    exactKeys(
      evaluation,
      [
        'routeContractKey',
        'contextScopeKey',
        'subjectType',
        'subjectProductKey',
        'subjectSurfaceKey',
        'action',
        'reason',
        'response',
      ],
      `${label}.firewall.evaluationRequests[]`
    );
    if (
      evaluation.action !== 'CONTINUED' ||
      !['EXACT_PAGE_CONTRACT', 'EXACT_HIGH_CONTRACT', 'EXACT_BACKGROUND_PAGE_CONTRACT'].includes(
        evaluation.reason
      ) ||
      evaluation.subjectType !== 'PRODUCT' ||
      evaluation.subjectProductKey !== 'hcm' ||
      typeof evaluation.subjectSurfaceKey !== 'string' ||
      typeof evaluation.routeContractKey !== 'string' ||
      !isExactHrisW1AuthorityResponseEvidence(evaluation.response)
    ) {
      hold(`${label}.firewall contains an unexpected authority evaluation.`);
    }
    if (evaluation.reason === 'EXACT_BACKGROUND_PAGE_CONTRACT') {
      backgroundCount += 1;
      if (
        evaluation.contextScopeKey !== null ||
        !isHrisW1BackgroundPageEvaluationTuple(
          evaluation.routeContractKey,
          evaluation.subjectSurfaceKey
        )
      ) {
        hold(`${label}.firewall contains a non-official background PAGE evaluation.`);
      }
      continue;
    }
    const kind = evaluation.reason === 'EXACT_PAGE_CONTRACT' ? 'PAGE' : 'HIGH';
    if (
      !activeContracts.some(
        (candidate) =>
          candidate.kind === kind &&
          candidate.routeContractKey === evaluation.routeContractKey &&
          candidate.contextScopeKey === evaluation.contextScopeKey &&
          candidate.productKey === evaluation.subjectProductKey &&
          candidate.surfaceKey === evaluation.subjectSurfaceKey
      )
    ) {
      hold(`${label}.firewall authority evaluation is outside the live route matrix.`);
    }
  }
  if (
    firewall.continuedMutations.length !== firewall.evaluationRequests.length ||
    (label === 'tenant-a' && backgroundCount < 1) ||
    (label === 'tenant-b' && firewall.evaluationRequests.length !== 0)
  ) {
    hold(`${label}.firewall authority evaluation lifecycle is incomplete.`);
  }
  return firewall;
}

function validateRuntimeDiagnostics(value, label) {
  const diagnostics = record(value, `${label}.diagnostics`);
  exactKeys(
    diagnostics,
    ['consoleErrorCount', 'consoleErrorSha256', 'pageErrorCount', 'pageErrorSha256'],
    `${label}.diagnostics`
  );
  if (
    !Number.isSafeInteger(diagnostics.consoleErrorCount) ||
    !Number.isSafeInteger(diagnostics.pageErrorCount) ||
    !Array.isArray(diagnostics.consoleErrorSha256) ||
    !Array.isArray(diagnostics.pageErrorSha256) ||
    diagnostics.consoleErrorCount !== diagnostics.consoleErrorSha256.length ||
    diagnostics.pageErrorCount !== diagnostics.pageErrorSha256.length ||
    !diagnostics.consoleErrorSha256.every((digest) => SHA256.test(String(digest))) ||
    !diagnostics.pageErrorSha256.every((digest) => SHA256.test(String(digest))) ||
    diagnostics.consoleErrorCount !== 0 ||
    diagnostics.pageErrorCount !== 0
  ) {
    hold(`${label}.diagnostics must prove a zero-error browser runtime.`);
  }
  return diagnostics;
}

function validateHomeRuntime(value, label, enabled) {
  if (!enabled) {
    if (value !== null) hold(`${label}.homeRuntime must be null while Home is not exercised.`);
    return null;
  }
  const runtime = record(value, `${label}.homeRuntime`);
  exactKeys(
    runtime,
    ['runtimeState', 'renderAuthority', 'actionAuthority'],
    `${label}.homeRuntime`
  );
  if (
    runtime.runtimeState !== 'SHADOW_COMPARE' ||
    runtime.renderAuthority !== 'LEGACY' ||
    runtime.actionAuthority !== 'DISABLED'
  ) {
    hold(`${label}.homeRuntime is not the exact safe SHADOW_COMPARE boundary.`);
  }
  return runtime;
}

export function validateBrowserRuntimeObservation(value, expectedLabel, routeMatrix, homeEnabled) {
  const observation = record(value, `${expectedLabel}.runtimeObservation`);
  exactKeys(
    observation,
    ['label', 'firewall', 'homeRuntime', 'diagnostics'],
    `${expectedLabel}.runtimeObservation`
  );
  if (observation.label !== expectedLabel) {
    hold(`${expectedLabel}.runtimeObservation label is invalid.`);
  }
  const firewall = validateFirewall(observation.firewall, expectedLabel, routeMatrix);
  const homeRuntime = validateHomeRuntime(observation.homeRuntime, expectedLabel, homeEnabled);
  validateRuntimeDiagnostics(observation.diagnostics, expectedLabel);
  if (firewall.expectedBlockedSideEffects.length !== (homeRuntime ? 1 : 0)) {
    hold(`${expectedLabel} expected blocked side-effect count is not runtime-bound.`);
  }
  return Object.freeze({ firewall, homeRuntime });
}

export function validateBrowserManifest(manifestValue, options) {
  const manifest = record(manifestValue, 'browser manifest');
  exactKeys(
    manifest,
    [
      'schemaVersion',
      'runId',
      'generatedAt',
      'status',
      'boundary',
      'tenants',
      'runtimeObservations',
      'failures',
    ],
    'browser manifest'
  );
  if (
    manifest.schemaVersion !== BROWSER_SCHEMA ||
    manifest.runId !== options.environment.runId ||
    manifest.status !== 'PASS'
  ) {
    hold('Browser manifest schema/run/status is not an exact PASS binding.');
  }
  instant(manifest.generatedAt, 'browser manifest.generatedAt');
  if (!Array.isArray(manifest.failures) || manifest.failures.length)
    hold('Browser manifest contains failures.');
  const boundary = record(manifest.boundary, 'browser manifest.boundary');
  exactKeys(
    boundary,
    [
      'frontendOrigin',
      'gatewayOrigin',
      'serviceWorkers',
      'requestBoundaryEvidence',
      'trace',
      'traceReason',
      'rawHarPolicy',
    ],
    'browser manifest.boundary'
  );
  textValue(boundary.traceReason, 'browser boundary.traceReason', 500);
  textValue(boundary.rawHarPolicy, 'browser boundary.rawHarPolicy', 500);
  if (
    boundary.frontendOrigin !== options.frontendOrigin ||
    boundary.gatewayOrigin !== options.environment.endpoints.gateway ||
    boundary.serviceWorkers !== 'blocked' ||
    boundary.trace !== 'NOT_CAPTURED_SECURITY_POLICY'
  ) {
    hold('Browser manifest boundary does not match the owned live runtime.');
  }
  const requestBoundary = record(boundary.requestBoundaryEvidence, 'browser request boundary');
  exactKeys(
    requestBoundary,
    [
      'interceptionPolicy',
      'interceptedHttpRequestCount',
      'continuedHttpRequestCount',
      'forwardedAuthorityEvaluationCount',
      'forwardedOwnerMutationCount',
      'expectedBlockedSideEffects',
      'blockedOwnerMutationAttempts',
      'blockedExternalHttp',
      'blockedExternalWebSockets',
      'unexpectedAuthorityEvaluations',
    ],
    'browser request boundary'
  );
  if (
    requestBoundary.interceptionPolicy !==
      'CONTINUE_READS_AND_EXACT_AUTHORITY_EVALUATIONS_ABORT_OTHER_SAME_ORIGIN_NON_READS' ||
    !Number.isSafeInteger(requestBoundary.interceptedHttpRequestCount) ||
    requestBoundary.interceptedHttpRequestCount <= 0 ||
    !Number.isSafeInteger(requestBoundary.continuedHttpRequestCount) ||
    requestBoundary.continuedHttpRequestCount <= 0 ||
    !Number.isSafeInteger(requestBoundary.forwardedAuthorityEvaluationCount) ||
    requestBoundary.forwardedAuthorityEvaluationCount <= 0 ||
    requestBoundary.forwardedOwnerMutationCount !== 0 ||
    !Array.isArray(requestBoundary.expectedBlockedSideEffects) ||
    requestBoundary.expectedBlockedSideEffects.length !== 1 ||
    !requestBoundary.expectedBlockedSideEffects.every(isExactHrisW1ExpectedBlockedSideEffect) ||
    !Array.isArray(requestBoundary.blockedOwnerMutationAttempts) ||
    requestBoundary.blockedOwnerMutationAttempts.length ||
    !Array.isArray(requestBoundary.blockedExternalHttp) ||
    requestBoundary.blockedExternalHttp.length ||
    !Array.isArray(requestBoundary.blockedExternalWebSockets) ||
    requestBoundary.blockedExternalWebSockets.length ||
    !Array.isArray(requestBoundary.unexpectedAuthorityEvaluations) ||
    requestBoundary.unexpectedAuthorityEvaluations.length
  ) {
    hold('Browser request firewall boundary did not pass exactly.');
  }
  if (!Array.isArray(manifest.tenants) || manifest.tenants.length !== 2) {
    hold('Browser manifest must contain exactly two tenant records.');
  }
  const routeMatrices = [options.routeMatrices.tenantA, options.routeMatrices.tenantB];
  const tenantSummaries = [];
  for (let index = 0; index < 2; index += 1) {
    const expectedTenant = options.environment.tenants[index];
    const tenant = record(manifest.tenants[index], `browser tenants[${index}]`);
    const enabled = index === 0;
    const tenantFields = [
      'label',
      'tenantId',
      'loginStatus',
      'verifiedSubjectId',
      'crossTenantMe',
      'rolloutState',
      'authorityStatus',
      'rolloutFlags',
      'routes',
      'har',
      'trace',
    ];
    if (enabled) tenantFields.push('homeLaunchpadIdentity');
    exactKeys(tenant, tenantFields, `browser tenants[${index}]`);
    if (
      tenant.label !== expectedTenant.label ||
      tenant.tenantId !== String(expectedTenant.tenantId) ||
      tenant.loginStatus !== 200 ||
      tenant.verifiedSubjectId !== String(expectedTenant.userId)
    ) {
      hold(`${expectedTenant.label} browser identity binding is invalid.`);
    }
    const other = options.environment.tenants[1 - index];
    const crossTenantMe = record(tenant.crossTenantMe, `${expectedTenant.label}.crossTenantMe`);
    exactKeys(
      crossTenantMe,
      ['requestedTenantId', 'status', 'outcome'],
      `${expectedTenant.label}.crossTenantMe`
    );
    const rolloutFlags = record(tenant.rolloutFlags, `${expectedTenant.label}.rolloutFlags`);
    exactKeys(
      rolloutFlags,
      ['contextShadow', 'capabilityEnforcement', 'surfaceUi'],
      `${expectedTenant.label}.rolloutFlags`
    );
    if (
      crossTenantMe.requestedTenantId !== String(other.tenantId) ||
      ![401, 403].includes(crossTenantMe.status) ||
      crossTenantMe.outcome !== 'DENIED' ||
      tenant.rolloutState !== (enabled ? '111' : '000') ||
      tenant.authorityStatus !== (enabled ? 'AVAILABLE' : 'NOT_EVALUATED') ||
      rolloutFlags.contextShadow !== enabled ||
      rolloutFlags.capabilityEnforcement !== enabled ||
      rolloutFlags.surfaceUi !== enabled ||
      tenant.trace !== 'NOT_CAPTURED_SECURITY_POLICY'
    ) {
      hold(`${expectedTenant.label} browser tenant/rollout binding is invalid.`);
    }
    const homeLaunchpadIdentity = enabled
      ? validateHomeLaunchpadIdentityEvidence(
          tenant.homeLaunchpadIdentity,
          options,
          `${expectedTenant.label}.homeLaunchpadIdentity`
        )
      : undefined;
    const matrix = routeMatrices[index];
    if (!Array.isArray(tenant.routes) || tenant.routes.length !== matrix.length) {
      hold(`${expectedTenant.label} browser route evidence count is invalid.`);
    }
    const routes = matrix.map((route, routeIndex) =>
      validateBrowserRoute(
        tenant.routes[routeIndex],
        route,
        { ...options, manifestGeneratedAt: manifest.generatedAt },
        `${expectedTenant.label}.routes[${routeIndex}]`
      )
    );
    const har = relativeInside(options.artifactRoot, tenant.har, `${expectedTenant.label}.har`);
    tenantSummaries.push({
      label: expectedTenant.label,
      tenantId: expectedTenant.tenantId,
      crossTenantMe: structuredClone(crossTenantMe),
      rolloutState: tenant.rolloutState,
      authorityStatus: tenant.authorityStatus,
      rolloutFlags: structuredClone(rolloutFlags),
      ...(homeLaunchpadIdentity ? { homeLaunchpadIdentity } : {}),
      routes,
      har: { path: har.relative, sha256: har.file.sha256 },
    });
  }
  if (!Array.isArray(manifest.runtimeObservations) || manifest.runtimeObservations.length !== 2) {
    hold('Browser runtime observations must contain exactly two tenant firewalls.');
  }
  const runtimeBoundaries = manifest.runtimeObservations.map((candidate, index) => {
    return validateBrowserRuntimeObservation(
      candidate,
      options.environment.tenants[index].label,
      routeMatrices[index],
      index === 0
    );
  });
  const firewalls = runtimeBoundaries.map(({ firewall }) => firewall);
  const expectedBlockedSideEffects = firewalls.flatMap(
    (firewall) => firewall.expectedBlockedSideEffects
  );
  const totals = {
    intercepted: firewalls.reduce((total, item) => total + item.interceptedHttpRequests, 0),
    continued: firewalls.reduce((total, item) => total + item.continuedHttpRequests, 0),
    authority: firewalls.reduce((total, item) => total + item.continuedMutations.length, 0),
  };
  if (
    requestBoundary.interceptedHttpRequestCount !== totals.intercepted ||
    requestBoundary.continuedHttpRequestCount !== totals.continued ||
    requestBoundary.forwardedAuthorityEvaluationCount !== totals.authority ||
    canonicalJson(requestBoundary.expectedBlockedSideEffects) !==
      canonicalJson(expectedBlockedSideEffects)
  ) {
    hold('Browser boundary counters do not equal the exact tenant firewall totals.');
  }
  const tenantAPay = tenantSummaries[0].routes.find(
    (route) => route.id === 'tenant-a-pay-high-preview'
  );
  const payrollResponse = selectBrowserPayrollResponse(
    tenantAPay?.network,
    options.payrollConfigurationId,
    'tenant-a PAY browser response'
  );
  return Object.freeze({
    schemaVersion: BROWSER_SCHEMA,
    status: 'PASS',
    generatedAt: manifest.generatedAt,
    requestBoundary: structuredClone(requestBoundary),
    tenants: Object.freeze(tenantSummaries),
    payrollResponse,
  });
}

export function scanBrowserArtifact(artifactRoot, secrets) {
  const findings = [];
  const rawHar = [];
  const closure = {};
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      const candidate = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) hold('Browser artifact cannot contain symlinks.');
      if (entry.isDirectory()) visit(candidate);
      else if (entry.isFile()) {
        if (entry.name.endsWith('-raw.har')) rawHar.push(candidate);
        const file = readAttestedRegular(candidate, `browser artifact ${entry.name}`);
        closure[path.relative(artifactRoot, candidate).split(path.sep).join('/')] = {
          sha256: file.sha256,
          byteCount: file.byteCount,
        };
        for (const secret of secrets) {
          if (file.bytes.includes(Buffer.from(secret, 'utf8'))) findings.push(candidate);
        }
      } else {
        hold('Browser artifact contains an unsupported filesystem entry.');
      }
    }
  };
  visit(artifactRoot);
  if (rawHar.length) hold('Raw HAR remains after browser teardown.');
  if (findings.length) hold('Browser artifact contains a synthetic credential value.');
  return Object.freeze(closure);
}
