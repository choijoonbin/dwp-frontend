type ApprovalRelease15ActionContract = Readonly<{
  apiFunction: string;
  routeContractKey: `route.approvals.${string}.action`;
  method: 'POST' | 'PUT';
  path: string;
}>;

const ADMIN = '/api/approvals/v1/admin';

export const APPROVAL_RELEASE15_HIGH_RISK_ROUTE_OPERATIONS = [
  {
    operation: 'APPROVAL_AUDIT_EXPORT_ATTESTATION',
    routeContractKey: 'route.approvals.admin.audit-export-attestation.action',
  },
  {
    operation: 'APPROVAL_AUDIT_EXPORT_CREATE',
    routeContractKey: 'route.approvals.admin.audit-export-create.action',
  },
  {
    operation: 'APPROVAL_AUDIT_SAVED_VIEW_CREATE',
    routeContractKey: 'route.approvals.admin.audit-saved-view-create.action',
  },
  {
    operation: 'APPROVAL_CONNECTOR_COMMAND',
    routeContractKey: 'route.approvals.admin.connector-command.action',
  },
  {
    operation: 'APPROVAL_DEPLOYMENT_ACTIVATION_EVIDENCE',
    routeContractKey: 'route.approvals.admin.deployment-activation-evidence.action',
  },
  {
    operation: 'APPROVAL_DEPLOYMENT_ACTIVATION',
    routeContractKey: 'route.approvals.admin.deployment-activation.action',
  },
  {
    operation: 'APPROVAL_DEPLOYMENT_PACKAGE_CREATE',
    routeContractKey: 'route.approvals.admin.deployment-package-create.action',
  },
  {
    operation: 'APPROVAL_DEPLOYMENT_PROMOTION_CREATE',
    routeContractKey: 'route.approvals.admin.deployment-promotion-create.action',
  },
  {
    operation: 'APPROVAL_DEPLOYMENT_PROMOTION_REVIEW',
    routeContractKey: 'route.approvals.admin.deployment-promotion-review.action',
  },
  {
    operation: 'APPROVAL_DEPLOYMENT_PROMOTION_SCHEDULE',
    routeContractKey: 'route.approvals.admin.deployment-promotion-schedule.action',
  },
  {
    operation: 'APPROVAL_DEPLOYMENT_ROLLBACK_EVIDENCE',
    routeContractKey: 'route.approvals.admin.deployment-rollback-evidence.action',
  },
  {
    operation: 'APPROVAL_DEPLOYMENT_ROLLBACK',
    routeContractKey: 'route.approvals.admin.deployment-rollback.action',
  },
  {
    operation: 'APPROVAL_INCIDENT_COMMAND',
    routeContractKey: 'route.approvals.admin.incident-command.action',
  },
  {
    operation: 'APPROVAL_POLICY_AUTOMATION_PUBLISH',
    routeContractKey: 'route.approvals.admin.policy-automation-publish.action',
  },
  {
    operation: 'APPROVAL_ROUTING_DIRECTORY_PUBLISH',
    routeContractKey: 'route.approvals.admin.routing-directory-publish.action',
  },
  {
    operation: 'APPROVAL_ROUTING_DIRECTORY_RETIRE',
    routeContractKey: 'route.approvals.admin.routing-directory-retire.action',
  },
] as const;

export const APPROVAL_RELEASE15_ACTION_CONTRACTS = [
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:audit-export-attestation',
    routeContractKey: 'route.approvals.admin.audit-export-attestation.action',
    method: 'POST',
    path: `${ADMIN}/operations/audit-records/exports/{exportId}/external-attestations`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:audit-export-create',
    routeContractKey: 'route.approvals.admin.audit-export-create.action',
    method: 'POST',
    path: `${ADMIN}/operations/audit-records/exports`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:audit-saved-view-create',
    routeContractKey: 'route.approvals.admin.audit-saved-view-create.action',
    method: 'POST',
    path: `${ADMIN}/operations/audit-records/saved-views`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:connector-draft',
    routeContractKey: 'route.approvals.admin.connector-command.action',
    method: 'PUT',
    path: `${ADMIN}/operations/connectors/{connectorId}/draft`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:connector-probe-start',
    routeContractKey: 'route.approvals.admin.connector-command.action',
    method: 'POST',
    path: `${ADMIN}/operations/connectors/{connectorId}/probes`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:connector-probe-complete',
    routeContractKey: 'route.approvals.admin.connector-command.action',
    method: 'POST',
    path: `${ADMIN}/operations/connectors/{connectorId}/probes/{probeId}/complete`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:connector-publish',
    routeContractKey: 'route.approvals.admin.connector-command.action',
    method: 'POST',
    path: `${ADMIN}/operations/connectors/{connectorId}/publish`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:connector-lifecycle',
    routeContractKey: 'route.approvals.admin.connector-command.action',
    method: 'POST',
    path: `${ADMIN}/operations/connectors/{connectorId}/lifecycle`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:deployment-activation-evidence',
    routeContractKey: 'route.approvals.admin.deployment-activation-evidence.action',
    method: 'POST',
    path: `${ADMIN}/operations/deployments/promotions/{promotionId}/activation-evidence`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:deployment-activation',
    routeContractKey: 'route.approvals.admin.deployment-activation.action',
    method: 'POST',
    path: `${ADMIN}/operations/deployments/promotions/{promotionId}/activation`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:deployment-package-create',
    routeContractKey: 'route.approvals.admin.deployment-package-create.action',
    method: 'POST',
    path: `${ADMIN}/operations/deployments/packages`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:deployment-promotion-create',
    routeContractKey: 'route.approvals.admin.deployment-promotion-create.action',
    method: 'POST',
    path: `${ADMIN}/operations/deployments/promotions`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:deployment-promotion-review',
    routeContractKey: 'route.approvals.admin.deployment-promotion-review.action',
    method: 'POST',
    path: `${ADMIN}/operations/deployments/promotions/{promotionId}/approval`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:deployment-promotion-schedule',
    routeContractKey: 'route.approvals.admin.deployment-promotion-schedule.action',
    method: 'POST',
    path: `${ADMIN}/operations/deployments/promotions/{promotionId}/schedule`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:deployment-rollback-evidence',
    routeContractKey: 'route.approvals.admin.deployment-rollback-evidence.action',
    method: 'POST',
    path: `${ADMIN}/operations/deployments/promotions/{promotionId}/rollback-evidence`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:deployment-rollback',
    routeContractKey: 'route.approvals.admin.deployment-rollback.action',
    method: 'POST',
    path: `${ADMIN}/operations/deployments/promotions/{promotionId}/rollback`,
  },
  {
    apiFunction: 'cloneApprovalFormStudioDraft',
    routeContractKey: 'route.approvals.admin.form-studio-draft.action',
    method: 'POST',
    path: `${ADMIN}/forms/studio-v3/{sourceFormId}/draft`,
  },
  {
    apiFunction: 'saveApprovalFormStudioDraft',
    routeContractKey: 'route.approvals.admin.form-studio-draft.action',
    method: 'PUT',
    path: `${ADMIN}/forms/studio-v3/{formId}/draft`,
  },
  {
    apiFunction: 'archiveApprovalFormStudioDraft',
    routeContractKey: 'route.approvals.admin.form-studio-draft.action',
    method: 'POST',
    path: `${ADMIN}/forms/studio-v3/{formId}/archive`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:incident-open',
    routeContractKey: 'route.approvals.admin.incident-command.action',
    method: 'POST',
    path: `${ADMIN}/operations/incidents`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:incident-status',
    routeContractKey: 'route.approvals.admin.incident-command.action',
    method: 'POST',
    path: `${ADMIN}/operations/incidents/{incidentId}/status`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:incident-diagnostic',
    routeContractKey: 'route.approvals.admin.incident-command.action',
    method: 'POST',
    path: `${ADMIN}/operations/incidents/{incidentId}/diagnostics`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:incident-plan-create',
    routeContractKey: 'route.approvals.admin.incident-command.action',
    method: 'POST',
    path: `${ADMIN}/operations/incidents/{incidentId}/recovery-plans`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:incident-plan-dry-run',
    routeContractKey: 'route.approvals.admin.incident-command.action',
    method: 'POST',
    path: `${ADMIN}/operations/incidents/{incidentId}/recovery-plans/{planId}/dry-run`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:incident-stage-start',
    routeContractKey: 'route.approvals.admin.incident-command.action',
    method: 'POST',
    path: `${ADMIN}/operations/incidents/{incidentId}/recovery-plans/{planId}/stages/{stageNumber}/start`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:incident-stage-complete',
    routeContractKey: 'route.approvals.admin.incident-command.action',
    method: 'POST',
    path: `${ADMIN}/operations/incidents/{incidentId}/recovery-plans/{planId}/stages/{stageNumber}/complete`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:incident-plan-reconcile',
    routeContractKey: 'route.approvals.admin.incident-command.action',
    method: 'POST',
    path: `${ADMIN}/operations/incidents/{incidentId}/recovery-plans/{planId}/reconcile`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:incident-postmortem',
    routeContractKey: 'route.approvals.admin.incident-command.action',
    method: 'POST',
    path: `${ADMIN}/operations/incidents/{incidentId}/postmortem`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:policy-automation-publish',
    routeContractKey: 'route.approvals.admin.policy-automation-publish.action',
    method: 'POST',
    path: `${ADMIN}/policies/automation/rules/{policyId}/publish`,
  },
  {
    apiFunction: 'saveApprovalAutomationCalendar',
    routeContractKey: 'route.approvals.admin.policy-automation-update.action',
    method: 'PUT',
    path: `${ADMIN}/policies/automation/calendars/{calendarId}`,
  },
  {
    apiFunction: 'saveApprovalAutomationChannel',
    routeContractKey: 'route.approvals.admin.policy-automation-update.action',
    method: 'PUT',
    path: `${ADMIN}/policies/automation/channels/{channelId}`,
  },
  {
    apiFunction: 'recordApprovalAutomationChannelObservation',
    routeContractKey: 'route.approvals.admin.policy-automation-update.action',
    method: 'POST',
    path: `${ADMIN}/policies/automation/channels/{channelId}/observations`,
  },
  {
    apiFunction: 'saveApprovalAutomationPolicyDraft',
    routeContractKey: 'route.approvals.admin.policy-automation-update.action',
    method: 'PUT',
    path: `${ADMIN}/policies/automation/rules/{policyId}/draft`,
  },
  {
    apiFunction: 'reviewApprovalAutomationDelegation',
    routeContractKey: 'route.approvals.admin.policy-automation-update.action',
    method: 'POST',
    path: `${ADMIN}/policies/automation/delegations/{delegationId}/reviews`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:routing-publish',
    routeContractKey: 'route.approvals.admin.routing-directory-publish.action',
    method: 'POST',
    path: `${ADMIN}/workflows/routing-directory/groups/{groupId}/publish`,
  },
  {
    apiFunction: 'executeApprovalAdminV2HighRiskCommand:routing-retire',
    routeContractKey: 'route.approvals.admin.routing-directory-retire.action',
    method: 'POST',
    path: `${ADMIN}/workflows/routing-directory/groups/{groupId}/retire`,
  },
  {
    apiFunction: 'saveApprovalRoutingResolver',
    routeContractKey: 'route.approvals.admin.routing-directory-update.action',
    method: 'PUT',
    path: `${ADMIN}/workflows/routing-directory/resolvers/{resolverId}`,
  },
  {
    apiFunction: 'recordApprovalRoutingResolverObservation',
    routeContractKey: 'route.approvals.admin.routing-directory-update.action',
    method: 'POST',
    path: `${ADMIN}/workflows/routing-directory/resolvers/{resolverId}/observations`,
  },
  {
    apiFunction: 'saveApprovalRoutingGroup',
    routeContractKey: 'route.approvals.admin.routing-directory-update.action',
    method: 'PUT',
    path: `${ADMIN}/workflows/routing-directory/groups/{groupId}`,
  },
  {
    apiFunction: 'recordApprovalRoutingGroupUsage',
    routeContractKey: 'route.approvals.admin.routing-directory-update.action',
    method: 'POST',
    path: `${ADMIN}/workflows/routing-directory/groups/{groupId}/usages`,
  },
  {
    apiFunction: 'cloneApprovalTemplateDraft',
    routeContractKey: 'route.approvals.admin.template-draft.action',
    method: 'POST',
    path: `${ADMIN}/forms/templates/{templateId}/draft`,
  },
  {
    apiFunction: 'installApprovalTemplateDraft',
    routeContractKey: 'route.approvals.admin.template-draft.action',
    method: 'POST',
    path: `${ADMIN}/forms/templates/versions/{templateVersionId}/install`,
  },
] as const satisfies readonly ApprovalRelease15ActionContract[];
