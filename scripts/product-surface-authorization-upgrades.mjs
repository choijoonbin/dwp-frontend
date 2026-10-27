import { canonicalJson, fail, isRecord } from './product-surface-authorization-values.mjs';

const V30_RESEARCH_AUTHORITY_UPGRADE_ROUTES = new Set([
  'route.dwaion.work.research-audit-download.data',
  'route.dwaion.work.research-deliveries.data',
  'route.dwaion.work.research-output.action',
  'route.dwaion.work.research-plan-create.action',
  'route.dwaion.work.research-plan-update.action',
  'route.dwaion.work.research-plans.data',
  'route.dwaion.work.research-raw-download.data',
  'route.dwaion.work.research-receipt-download.data',
  'route.dwaion.work.research-run-command.action',
  'route.dwaion.work.research-run-execute.action',
  'route.dwaion.work.research-run-start.action',
  'route.dwaion.work.research-runs.data',
]);
const V30_RESEARCH_READ_AUTHORITY_UPGRADE_ROUTES = new Set(
  [...V30_RESEARCH_AUTHORITY_UPGRADE_ROUTES].filter((key) => key.endsWith('.data'))
);
const V49_PAYROLL_CAPABILITY_HARDENING = Object.freeze({
  'hcm.operations.payroll-run.execute': Object.freeze({
    riskTier: 'CRITICAL',
    activationPolicy: 'STEPUP-MGMT-HIGH-V1',
  }),
  'hcm.operations.payroll-support.view': Object.freeze({
    riskTier: 'HIGH',
    activationPolicy: 'STEPUP-MGMT-HIGH-V1',
  }),
});
const V49_PAYROLL_CALCULATE_ROUTE = 'route.hcm.operations.payroll-run-calculate.action';
const V49_PAYROLL_CALCULATE_STEP_UP = Object.freeze([
  Object.freeze({
    audience: 'dwp-payroll-server',
    bindingKey: 'route.hcm.operations.payroll-run-calculate.action.binding.01',
    expectedObjectVersionName: 'X-DWP-Expected-Object-Version',
    expectedObjectVersionSource: 'COMMAND_HEADER',
    ownerServiceKey: 'payroll',
    targetIdPathParameter: 'runId',
    targetType: 'PAYROLL_RUN',
  }),
]);
const V50_TIM007_ROUTE_RESPONSES = Object.freeze([
  Object.freeze({
    routeContractKey: 'route.hcm.operations.time-command-center.page',
    profileKey: 'time-operations-reader',
    responseSchemaKey: 'TimeCommandCenterProjectionV1',
    apiBindingKey: 'route.hcm.operations.time-command-center.page.binding.01',
    projectionPolicyKey:
      'route.hcm.operations.time-command-center.page.time-operations-reader.projection.v1',
    openApiSchemaSha256: 'b9f8e20f38dc265df0b65ae498c5728536e9634b719bae11dad4aeb53f3afd8e',
  }),
  Object.freeze({
    routeContractKey: 'route.hcm.operations.time-daily-close.page',
    profileKey: 'time-operations-reader',
    responseSchemaKey: 'TimeDailyCloseProjectionV1',
    apiBindingKey: 'route.hcm.operations.time-daily-close.page.binding.01',
    projectionPolicyKey:
      'route.hcm.operations.time-daily-close.page.time-operations-reader.projection.v1',
    openApiSchemaSha256: '7ad4402e9fd26c2d76fc38f9554a6f8370562e536879e516084c32d57c85e039',
  }),
  Object.freeze({
    routeContractKey: 'route.hcm.operations.time-monthly-close.page',
    profileKey: 'time-operations-reader',
    responseSchemaKey: 'TimeMonthlyCloseProjectionV1',
    apiBindingKey: 'route.hcm.operations.time-monthly-close.page.binding.01',
    projectionPolicyKey:
      'route.hcm.operations.time-monthly-close.page.time-operations-reader.projection.v1',
    openApiSchemaSha256: '985741661b4d879f242bfcbeb9310af40ae917411ae817bf1eb6239766e580c9',
  }),
  Object.freeze({
    routeContractKey: 'route.hcm.operations.time-payroll-handoff.data',
    profileKey: 'time-close-operator',
    responseSchemaKey: 'PayrollTimeHandoffStatusV1',
  }),
  Object.freeze({
    routeContractKey: 'route.hcm.time.command-receipt.data',
    profileKey: 'originating-command',
    responseSchemaKey: 'TimeCommandReceiptLookupV1',
  }),
]);

function isAppendOnlySuperset(previous, next) {
  if (Array.isArray(previous)) {
    return (
      Array.isArray(next) &&
      next.length >= previous.length &&
      previous.every((value, index) => isAppendOnlySuperset(value, next[index]))
    );
  }
  if (isRecord(previous)) {
    return (
      isRecord(next) &&
      Object.entries(previous).every(
        ([field, value]) => Object.hasOwn(next, field) && isAppendOnlySuperset(value, next[field])
      )
    );
  }
  return Object.is(previous, next);
}

export function validateNoDroppedContracts(previous, next, sectionKeys) {
  for (const [section, key] of Object.entries(sectionKeys)) {
    const nextByKey = new Map(next[section].map((record) => [record[key], record]));
    for (const record of previous[section]) {
      const candidate = nextByKey.get(record[key]);
      if (!candidate)
        fail(`v${next.version} dropped v${previous.version} ${section} ${record[key]}`);
      const previousDescriptor = structuredClone(record);
      const candidateDescriptor = structuredClone(candidate);
      const previousRouteKeys = previousDescriptor.routeContractKeys ?? [];
      const candidateRouteKeys = candidateDescriptor.routeContractKeys ?? [];
      delete previousDescriptor.routeContractKeys;
      delete candidateDescriptor.routeContractKeys;
      const routeReferencesAreMonotonic =
        Array.isArray(previousRouteKeys) &&
        Array.isArray(candidateRouteKeys) &&
        previousRouteKeys.every((routeKey) => candidateRouteKeys.includes(routeKey));
      if (
        (!routeReferencesAreMonotonic ||
          !isAppendOnlySuperset(previousDescriptor, candidateDescriptor)) &&
        !isV30ResearchAuthorityUpgrade(next.version, section, record[key], record, candidate) &&
        !isV35PerformanceAuthorityUpgrade(next.version, section, record[key], record, candidate) &&
        !isV36PerformanceFreezeAuthorityUpgrade(
          next.version,
          section,
          record[key],
          record,
          candidate
        ) &&
        !isV37TimeVoidProfileRemoval(next.version, section, record[key], record, candidate) &&
        !isV49PayrollSecurityHardening(next.version, section, record[key], record, candidate) &&
        !isV50Tim007ResponseUpgrade(next.version, section, record[key], record, candidate)
      ) {
        fail(
          `v${next.version} non-monotonically changed v${previous.version} ${section} ${record[key]}`
        );
      }
    }
  }
}

function isV30ResearchAuthorityUpgrade(version, section, key, previous, candidate) {
  if (version !== 30) return false;
  const normalized = structuredClone(candidate);
  if (section === 'accessPolicies' && key === 'dwaion.work-access.v1') {
    normalized.routeContractKeys = [
      ...new Set([
        ...(normalized.routeContractKeys ?? []),
        ...V30_RESEARCH_READ_AUTHORITY_UPGRADE_ROUTES,
      ]),
    ].sort();
    const prior = structuredClone(previous);
    return isAppendOnlySuperset(normalized, prior);
  }
  if (section !== 'routes' || !V30_RESEARCH_AUTHORITY_UPGRADE_ROUTES.has(key)) {
    return false;
  }
  const capability = V30_RESEARCH_READ_AUTHORITY_UPGRADE_ROUTES.has(key)
    ? 'dwaion.work.research.read'
    : 'dwaion.work.research.manage';
  const expected = {
    type: 'CAPABILITY_EXPRESSION',
    mode: 'ALL',
    capabilityContractKeys: ['dwaion.work.ask.execute', capability],
  };
  const previousProfiles = new Map(
    previous.accessProfiles.map((profile) => [profile.profileKey, profile])
  );
  for (const profile of normalized.accessProfiles) {
    const inherited = previousProfiles.get(profile.profileKey);
    if (!inherited || canonicalJson(profile.requiredAccess) !== canonicalJson(expected)) {
      return false;
    }
    profile.requiredAccess = structuredClone(inherited.requiredAccess);
  }
  return isAppendOnlySuperset(normalized, previous);
}

function isV35PerformanceAuthorityUpgrade(version, section, key, previous, candidate) {
  if (version !== 35) return false;
  const previewRoute = 'route.hcm.operations.performance-cycle-population-preview.action';
  const normalized = structuredClone(candidate);
  if (section === 'capabilities' && key === 'hcm.operations.talent.update') {
    normalized.routeContractKeys = [
      ...new Set([...(normalized.routeContractKeys ?? []), previewRoute]),
    ].sort();
    return isAppendOnlySuperset(normalized, previous);
  }
  if (section !== 'routes' || key !== previewRoute) return false;
  const profiles = new Map(
    normalized.accessProfiles.map((profile) => [profile.profileKey, profile])
  );
  const inherited = new Map(
    previous.accessProfiles.map((profile) => [profile.profileKey, profile])
  );
  const profile = profiles.get('full-management');
  const prior = inherited.get('full-management');
  if (
    profiles.size !== 1 ||
    !profile ||
    !prior ||
    canonicalJson(profile.requiredAccess) !==
      canonicalJson({
        type: 'CAPABILITY',
        capabilityContractKey: 'hcm.operations.performance.update',
      })
  ) {
    return false;
  }
  profile.requiredAccess = structuredClone(prior.requiredAccess);
  return isAppendOnlySuperset(normalized, previous);
}

function isV36PerformanceFreezeAuthorityUpgrade(version, section, key, previous, candidate) {
  if (version !== 36) return false;
  const freezeRoute = 'route.hcm.operations.performance-population-freeze.action';
  const normalized = structuredClone(candidate);
  if (section === 'capabilities' && key === 'hcm.operations.performance.update') {
    normalized.routeContractKeys = [
      ...new Set([...(normalized.routeContractKeys ?? []), freezeRoute]),
    ].sort();
    return isAppendOnlySuperset(normalized, previous);
  }
  if (section !== 'routes' || key !== freezeRoute) return false;
  const profiles = new Map(
    normalized.accessProfiles.map((profile) => [profile.profileKey, profile])
  );
  const inherited = new Map(
    previous.accessProfiles.map((profile) => [profile.profileKey, profile])
  );
  const profile = profiles.get('full-management');
  const prior = inherited.get('full-management');
  const expectedStepUp = [
    {
      audience: 'dwp-people-server',
      bindingKey: `${freezeRoute}.binding.01`,
      expectedObjectVersionName: 'X-DWP-Expected-Object-Version',
      expectedObjectVersionSource: 'COMMAND_HEADER',
      ownerServiceKey: 'people',
      targetIdPathParameter: 'cycleId',
      targetType: 'PERFORMANCE_CYCLE',
    },
  ];
  if (
    profiles.size !== 1 ||
    !profile ||
    !prior ||
    canonicalJson(profile.requiredAccess) !==
      canonicalJson({
        type: 'CAPABILITY',
        capabilityContractKey: 'hcm.operations.performance.freeze',
      }) ||
    canonicalJson(normalized.stepUpCommandBindings) !== canonicalJson(expectedStepUp)
  ) {
    return false;
  }
  profile.requiredAccess = structuredClone(prior.requiredAccess);
  if (Object.hasOwn(previous, 'stepUpCommandBindings')) {
    normalized.stepUpCommandBindings = structuredClone(previous.stepUpCommandBindings);
  } else {
    delete normalized.stepUpCommandBindings;
  }
  return isAppendOnlySuperset(normalized, previous);
}

function isV37TimeVoidProfileRemoval(version, section, key, previous, candidate) {
  if (version !== 37) return false;
  const voidRoute = 'route.hcm.operations.time-clock-event-void.action';
  if (section === 'capabilities' && key === 'hcm.personal.time.submit') {
    const previousRoutes = previous.routeContractKeys ?? [];
    const candidateRoutes = candidate.routeContractKeys ?? [];
    if (
      new Set(previousRoutes).size !== previousRoutes.length ||
      new Set(candidateRoutes).size !== candidateRoutes.length ||
      previousRoutes.length !== candidateRoutes.length + 1 ||
      !previousRoutes.includes(voidRoute) ||
      candidateRoutes.includes(voidRoute) ||
      candidateRoutes.some((route) => !previousRoutes.includes(route))
    ) {
      return false;
    }
    const normalized = structuredClone(candidate);
    normalized.routeContractKeys = structuredClone(previousRoutes);
    return canonicalJson(normalized) === canonicalJson(previous);
  }
  if (section !== 'routes' || key !== voidRoute) return false;
  const previousProfiles = new Map(
    previous.accessProfiles.map((profile) => [profile.profileKey, profile])
  );
  const candidateProfiles = new Map(
    candidate.accessProfiles.map((profile) => [profile.profileKey, profile])
  );
  if (
    previousProfiles.size !== 2 ||
    !previousProfiles.has('full-management') ||
    !previousProfiles.has('self-service') ||
    candidateProfiles.size !== 1 ||
    !candidateProfiles.has('full-management') ||
    canonicalJson(candidateProfiles.get('full-management')) !==
      canonicalJson(previousProfiles.get('full-management'))
  ) {
    return false;
  }
  const normalized = structuredClone(candidate);
  normalized.accessProfiles = structuredClone(previous.accessProfiles);
  return canonicalJson(normalized) === canonicalJson(previous);
}

function isV49PayrollSecurityHardening(version, section, key, previous, candidate) {
  if (version !== 49) return false;
  const capabilityHardening = V49_PAYROLL_CAPABILITY_HARDENING[key];
  if (section === 'capabilities' && capabilityHardening) {
    if (
      candidate.riskTier !== capabilityHardening.riskTier ||
      candidate.activationPolicy !== capabilityHardening.activationPolicy
    ) {
      return false;
    }
    const previousRoutes = previous.routeContractKeys ?? [];
    const candidateRoutes = candidate.routeContractKeys ?? [];
    if (
      new Set(candidateRoutes).size !== candidateRoutes.length ||
      !previousRoutes.every((routeKey) => candidateRoutes.includes(routeKey))
    ) {
      return false;
    }
    const normalized = structuredClone(candidate);
    normalized.riskTier = previous.riskTier;
    normalized.activationPolicy = previous.activationPolicy;
    normalized.routeContractKeys = structuredClone(previousRoutes);
    return canonicalJson(normalized) === canonicalJson(previous);
  }
  if (section !== 'routes' || key !== V49_PAYROLL_CALCULATE_ROUTE) return false;
  const normalized = structuredClone(candidate);
  const candidateProfiles = new Map(
    normalized.accessProfiles.map((profile) => [profile.profileKey, profile])
  );
  const previousProfiles = new Map(
    previous.accessProfiles.map((profile) => [profile.profileKey, profile])
  );
  const candidateProfile = candidateProfiles.get('payroll-run-operator');
  const previousProfile = previousProfiles.get('payroll-run-operator');
  if (
    candidateProfiles.size !== 1 ||
    previousProfiles.size !== 1 ||
    !candidateProfile ||
    !previousProfile ||
    canonicalJson(candidateProfile.activeAccessModes) !== canonicalJson(['ELEVATED']) ||
    canonicalJson(normalized.stepUpCommandBindings) !== canonicalJson(V49_PAYROLL_CALCULATE_STEP_UP)
  ) {
    return false;
  }
  candidateProfile.activeAccessModes = structuredClone(previousProfile.activeAccessModes);
  if (Object.hasOwn(previous, 'stepUpCommandBindings')) {
    normalized.stepUpCommandBindings = structuredClone(previous.stepUpCommandBindings);
  } else {
    delete normalized.stepUpCommandBindings;
  }
  return canonicalJson(normalized) === canonicalJson(previous);
}

function isV50Tim007ResponseUpgrade(version, section, key, previous, candidate) {
  if (version !== 50 || section !== 'routes') return false;
  const patch = V50_TIM007_ROUTE_RESPONSES.find((entry) => entry.routeContractKey === key);
  if (!patch) return false;
  const normalized = structuredClone(candidate);
  const previousProfiles = new Map(
    previous.accessProfiles.map((profile) => [profile.profileKey, profile])
  );
  const candidateProfiles = new Map(
    normalized.accessProfiles.map((profile) => [profile.profileKey, profile])
  );
  if (
    previousProfiles.size !== candidateProfiles.size ||
    [...previousProfiles.keys()].some((profileKey) => !candidateProfiles.has(profileKey))
  ) {
    return false;
  }
  const previousProfile = previousProfiles.get(patch.profileKey);
  const candidateProfile = candidateProfiles.get(patch.profileKey);
  if (!previousProfile || !candidateProfile) return false;
  const previousBindings = previousProfile.responseProjectionBindings;
  let expectedBindings;
  if (patch.openApiSchemaSha256) {
    expectedBindings = [
      {
        additionalProperties: false,
        apiBindingKey: patch.apiBindingKey,
        openApiSchemaSha256: patch.openApiSchemaSha256,
        projectionPolicyKey: patch.projectionPolicyKey,
        responseSchemaKey: patch.responseSchemaKey,
        schemaVersion: 1,
      },
    ];
  } else {
    expectedBindings = structuredClone(previousBindings);
    if (expectedBindings.length !== 1) return false;
    expectedBindings[0].responseSchemaKey = patch.responseSchemaKey;
  }
  if (
    canonicalJson(candidateProfile.responseProjectionBindings) !== canonicalJson(expectedBindings)
  ) {
    return false;
  }
  candidateProfile.responseProjectionBindings = structuredClone(previousBindings);
  return canonicalJson(normalized) === canonicalJson(previous);
}
