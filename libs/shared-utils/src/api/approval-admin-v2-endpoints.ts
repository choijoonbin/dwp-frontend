const BASE = '/api/approvals/v1/admin';

function segment(value: string): string {
  return encodeURIComponent(value);
}

export const APPROVAL_ADMIN_V2_ENDPOINTS = {
  templates: {
    catalog: `${BASE}/forms/templates`,
    detail: (templateId: string) => `${BASE}/forms/templates/${segment(templateId)}`,
    comparison: (templateId: string) => `${BASE}/forms/templates/${segment(templateId)}/comparison`,
    cloneDraft: (templateId: string) => `${BASE}/forms/templates/${segment(templateId)}/draft`,
    installDraft: (templateVersionId: string) =>
      `${BASE}/forms/templates/versions/${segment(templateVersionId)}/install`,
  },
  formStudio: {
    workspaces: `${BASE}/forms/studio-v3`,
    detail: (formId: string) => `${BASE}/forms/studio-v3/${segment(formId)}`,
    versions: (formId: string) => `${BASE}/forms/studio-v3/${segment(formId)}/versions`,
    validate: `${BASE}/forms/studio-v3/validate`,
    review: (formId: string) => `${BASE}/forms/studio-v3/${segment(formId)}/review`,
    evaluate: (formId: string) => `${BASE}/forms/studio-v3/${segment(formId)}/evaluate`,
    cloneDraft: (formId: string) => `${BASE}/forms/studio-v3/${segment(formId)}/draft`,
    updateDraft: (formId: string) => `${BASE}/forms/studio-v3/${segment(formId)}/draft`,
    archive: (formId: string) => `${BASE}/forms/studio-v3/${segment(formId)}/archive`,
  },
  routing: {
    groups: `${BASE}/workflows/routing-directory/groups`,
    group: (groupId: string) => `${BASE}/workflows/routing-directory/groups/${segment(groupId)}`,
    resolution: (groupId: string) =>
      `${BASE}/workflows/routing-directory/groups/${segment(groupId)}/resolution`,
    retirementImpact: (groupId: string) =>
      `${BASE}/workflows/routing-directory/groups/${segment(groupId)}/retirement-impact`,
    resolvers: `${BASE}/workflows/routing-directory/resolvers`,
    resolver: (resolverId: string) =>
      `${BASE}/workflows/routing-directory/resolvers/${segment(resolverId)}`,
    resolverObservations: (resolverId: string) =>
      `${BASE}/workflows/routing-directory/resolvers/${segment(resolverId)}/observations`,
    publishGroup: (groupId: string) =>
      `${BASE}/workflows/routing-directory/groups/${segment(groupId)}/publish`,
    groupUsages: (groupId: string) =>
      `${BASE}/workflows/routing-directory/groups/${segment(groupId)}/usages`,
    retireGroup: (groupId: string) =>
      `${BASE}/workflows/routing-directory/groups/${segment(groupId)}/retire`,
  },
  policies: {
    root: `${BASE}/policies`,
    policy: (policyId: string) => `${BASE}/policies/${segment(policyId)}`,
    impact: (policyId: string) => `${BASE}/policies/${segment(policyId)}/impact`,
    versions: (policyId: string) => `${BASE}/policies/${segment(policyId)}/versions`,
    publish: (policyId: string) => `${BASE}/policies/${segment(policyId)}/publish`,
    calendars: `${BASE}/policies/automation/calendars`,
    calendar: (calendarId: string) =>
      `${BASE}/policies/automation/calendars/${segment(calendarId)}`,
    deadline: (calendarId: string) =>
      `${BASE}/policies/automation/calendars/${segment(calendarId)}/deadline`,
    channels: `${BASE}/policies/automation/channels`,
    channel: (channelId: string) => `${BASE}/policies/automation/channels/${segment(channelId)}`,
    channelObservations: (channelId: string) =>
      `${BASE}/policies/automation/channels/${segment(channelId)}/observations`,
    rules: `${BASE}/policies/automation/rules`,
    rule: (policyId: string) => `${BASE}/policies/automation/rules/${segment(policyId)}`,
    ruleDraft: (policyId: string) => `${BASE}/policies/automation/rules/${segment(policyId)}/draft`,
    publishRule: (policyId: string) =>
      `${BASE}/policies/automation/rules/${segment(policyId)}/publish`,
    delegations: `${BASE}/policies/automation/delegations`,
    delegation: (delegationId: string) =>
      `${BASE}/policies/automation/delegations/${segment(delegationId)}`,
    delegationReviews: (delegationId: string) =>
      `${BASE}/policies/automation/delegations/${segment(delegationId)}/reviews`,
  },
  connectors: {
    list: `${BASE}/operations/connectors`,
    detail: (connectorId: string) => `${BASE}/operations/connectors/${segment(connectorId)}`,
    draft: (connectorId: string) => `${BASE}/operations/connectors/${segment(connectorId)}/draft`,
    probes: (connectorId: string) => `${BASE}/operations/connectors/${segment(connectorId)}/probes`,
    probe: (connectorId: string, probeId: string) =>
      `${BASE}/operations/connectors/${segment(connectorId)}/probes/${segment(probeId)}`,
    completeProbe: (connectorId: string, probeId: string) =>
      `${BASE}/operations/connectors/${segment(connectorId)}/probes/${segment(probeId)}/complete`,
    publish: (connectorId: string) =>
      `${BASE}/operations/connectors/${segment(connectorId)}/publish`,
    lifecycle: (connectorId: string) =>
      `${BASE}/operations/connectors/${segment(connectorId)}/lifecycle`,
  },
  incidents: {
    list: `${BASE}/operations/incidents`,
    detail: (incidentId: string) => `${BASE}/operations/incidents/${segment(incidentId)}`,
    recoveryPlan: (incidentId: string, planId: string) =>
      `${BASE}/operations/incidents/${segment(incidentId)}/recovery-plans/${segment(planId)}`,
    status: (incidentId: string) => `${BASE}/operations/incidents/${segment(incidentId)}/status`,
    diagnostics: (incidentId: string) =>
      `${BASE}/operations/incidents/${segment(incidentId)}/diagnostics`,
    recoveryPlans: (incidentId: string) =>
      `${BASE}/operations/incidents/${segment(incidentId)}/recovery-plans`,
    dryRun: (incidentId: string, planId: string) =>
      `${BASE}/operations/incidents/${segment(incidentId)}/recovery-plans/${segment(planId)}/dry-run`,
    startStage: (incidentId: string, planId: string, stageNumber: number) =>
      `${BASE}/operations/incidents/${segment(incidentId)}/recovery-plans/${segment(planId)}/stages/${stageNumber}/start`,
    completeStage: (incidentId: string, planId: string, stageNumber: number) =>
      `${BASE}/operations/incidents/${segment(incidentId)}/recovery-plans/${segment(planId)}/stages/${stageNumber}/complete`,
    reconcile: (incidentId: string, planId: string) =>
      `${BASE}/operations/incidents/${segment(incidentId)}/recovery-plans/${segment(planId)}/reconcile`,
    postmortem: (incidentId: string) =>
      `${BASE}/operations/incidents/${segment(incidentId)}/postmortem`,
  },
  audit: {
    events: `${BASE}/operations/audit-records/events`,
    event: (eventId: string) => `${BASE}/operations/audit-records/events/${segment(eventId)}`,
    retentionLinkage: (requestId: string) =>
      `${BASE}/operations/audit-records/requests/${segment(requestId)}/retention-linkage`,
    savedViews: `${BASE}/operations/audit-records/saved-views`,
    savedView: (savedViewId: string) =>
      `${BASE}/operations/audit-records/saved-views/${segment(savedViewId)}`,
    exports: `${BASE}/operations/audit-records/exports`,
    export: (exportId: string) => `${BASE}/operations/audit-records/exports/${segment(exportId)}`,
    externalAttestations: (exportId: string) =>
      `${BASE}/operations/audit-records/exports/${segment(exportId)}/external-attestations`,
  },
  analytics: {
    metricDefinitions: `${BASE}/operations/analytics/metric-definitions`,
    dashboard: `${BASE}/operations/analytics/dashboard`,
    representatives: (cohortKey: string) =>
      `${BASE}/operations/analytics/cohorts/${segment(cohortKey)}/representatives`,
  },
  deployments: {
    dashboard: `${BASE}/operations/deployments/dashboard`,
    packages: `${BASE}/operations/deployments/packages`,
    package: (packageId: string) => `${BASE}/operations/deployments/packages/${segment(packageId)}`,
    packageDiff: `${BASE}/operations/deployments/package-diff`,
    promotions: `${BASE}/operations/deployments/promotions`,
    promotion: (promotionId: string) =>
      `${BASE}/operations/deployments/promotions/${segment(promotionId)}`,
    approval: (promotionId: string) =>
      `${BASE}/operations/deployments/promotions/${segment(promotionId)}/approval`,
    schedule: (promotionId: string) =>
      `${BASE}/operations/deployments/promotions/${segment(promotionId)}/schedule`,
    activation: (promotionId: string) =>
      `${BASE}/operations/deployments/promotions/${segment(promotionId)}/activation`,
    activationEvidence: (promotionId: string) =>
      `${BASE}/operations/deployments/promotions/${segment(promotionId)}/activation-evidence`,
    rollbackFeasibility: (promotionId: string) =>
      `${BASE}/operations/deployments/promotions/${segment(promotionId)}/rollback-feasibility`,
    rollback: (promotionId: string) =>
      `${BASE}/operations/deployments/promotions/${segment(promotionId)}/rollback`,
    rollbackEvidence: (promotionId: string) =>
      `${BASE}/operations/deployments/promotions/${segment(promotionId)}/rollback-evidence`,
  },
} as const;

export const APPROVAL_ADMIN_V2_UNSUPPORTED_CONTROLS = [
  'templates.importPackage',
  'routing.requestRemediation',
  'policies.editWithoutCompleteDraft',
  'policies.publishWithoutIndependentReview',
  'policies.reviewDelegationWithoutDisposition',
  'policies.createDelegationFromAdminGovernance',
  'policies.editDelegationFromAdminGovernance',
  'policies.revokeDelegationFromAdminGovernance',
  'policies.cancelDelegationFromAdminGovernance',
  'policies.delegationKillSwitch',
  'incidents.prepareWithoutAuthoredPlan',
  'incidents.pauseQueue',
  'audit.verifyExternalIntegrity',
  'audit.linkExternalAttestationWithoutSignedReceipt',
  'audit.requestLegalHoldReview',
  'deployments.pauseCanary',
  'deployments.rollbackWithoutBoundReason',
] as const;
