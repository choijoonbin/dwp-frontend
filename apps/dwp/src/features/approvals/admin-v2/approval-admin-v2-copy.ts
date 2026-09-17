import type { TFunction } from 'i18next';
import type { AnalyticsInsightsCopy } from './analytics-insights-workspace';
import type { ApproverRoutingCopy } from './approver-routing-workspace';
import type { AuditRecordsCopy } from './audit-records-evidence-workspace';
import type { DeploymentCanaryCopy } from './deployment-canary-workspace';
import type { FormStudioV3Copy } from './form-studio-v3-workspace';
import type { IntegrationAutomationCopy } from './integration-automation-workspace';
import type { OperationsIncidentCopy } from './operations-incident-recovery-workspace';
import type { PolicyGovernanceCopy } from './policy-governance-workspace';
import type { TemplateLibraryCopy } from './template-library-workspace';
import type { AdminV2StateCopy, AdminV2WorkspaceHeader } from './admin-v2-types';

export type ApprovalAdminV2Copy = Readonly<{
  tabs: Readonly<{
    label: string;
    mature: string;
    templates: string;
    studio: string;
    policy: string;
    automation: string;
    delivery: string;
    incidents: string;
  }>;
  templates: TemplateLibraryCopy;
  form: FormStudioV3Copy;
  routing: ApproverRoutingCopy;
  policy: PolicyGovernanceCopy;
  integration: IntegrationAutomationCopy;
  incident: OperationsIncidentCopy;
  audit: AuditRecordsCopy;
  analytics: AnalyticsInsightsCopy;
  deployment: DeploymentCanaryCopy;
}>;

function translator(t: TFunction<'approvals'>) {
  return (key: string) => t(`adminV2.${key}`);
}

function stateCopy(tx: (key: string) => string): AdminV2StateCopy {
  return {
    loadingTitle: tx('state.loadingTitle'),
    loadingDescription: tx('state.loadingDescription'),
    emptyTitle: tx('state.emptyTitle'),
    emptyDescription: tx('state.emptyDescription'),
    forbiddenTitle: tx('state.forbiddenTitle'),
    forbiddenDescription: tx('state.forbiddenDescription'),
    conflictTitle: tx('state.conflictTitle'),
    conflictDescription: tx('state.conflictDescription'),
    conflictAction: tx('state.conflictAction'),
    unavailableTitle: tx('state.unavailableTitle'),
    unavailableDescription: tx('state.unavailableDescription'),
    retryAction: tx('state.retryAction'),
    staleTitle: tx('state.staleTitle'),
    staleDescription: tx('state.staleDescription'),
    staleAction: tx('state.staleAction'),
  };
}

function header(tx: (key: string) => string, section: string): AdminV2WorkspaceHeader {
  return {
    eyebrow: tx('common.eyebrow'),
    title: tx(`${section}.title`),
    description: tx(`${section}.description`),
    evidenceLabel: tx(`${section}.evidenceLabel`),
  };
}

function fields<const T extends readonly string[]>(
  tx: (key: string) => string,
  section: string,
  names: T
): { [K in T[number]]: string } {
  return Object.fromEntries(names.map((name) => [name, tx(`${section}.${name}`)])) as {
    [K in T[number]]: string;
  };
}

export function approvalAdminV2Copy(t: TFunction<'approvals'>): ApprovalAdminV2Copy {
  const tx = translator(t);
  const state = stateCopy(tx);
  return {
    tabs: fields(tx, 'tabs', [
      'label',
      'mature',
      'templates',
      'studio',
      'policy',
      'automation',
      'delivery',
      'incidents',
    ]),
    templates: {
      header: header(tx, 'templates'),
      state,
      ...fields(tx, 'templates', [
        'searchLabel',
        'categoriesLabel',
        'allCategoryLabel',
        'catalogTitle',
        'catalogDescription',
        'detailTitle',
        'detailDescription',
        'factsTitle',
        'dependenciesTitle',
        'releaseNotesTitle',
        'featuredLabel',
        'installedLabel',
        'importLabel',
        'compareLabel',
        'installLabel',
        'mobileInstallLabel',
        'mobileInstallReason',
        'installReadyTitle',
        'installReadyDescription',
      ]),
    },
    form: {
      header: header(tx, 'form'),
      state,
      ...fields(tx, 'form', [
        'navigationLabel',
        'builderTab',
        'rulesTab',
        'validationTab',
        'reviewTab',
        'structureTitle',
        'structureDescription',
        'canvasTitle',
        'canvasDescription',
        'inspectorTitle',
        'inspectorDescription',
        'rulesTitle',
        'rulesDescription',
        'validationTitle',
        'validationDescription',
        'reviewTitle',
        'reviewDescription',
        'fieldRequiredLabel',
        'fieldOptionalLabel',
        'addFieldLabel',
        'saveDraftLabel',
        'validateLabel',
        'submitReviewLabel',
        'mobileReviewLabel',
        'mobileReviewReason',
        'schemaTitle',
        'schemaDescription',
        'deterministicLabel',
        'changeBeforeLabel',
        'changeAfterLabel',
        'noSelectionLabel',
      ]),
    },
    routing: {
      header: header(tx, 'routing'),
      state,
      ...fields(tx, 'routing', [
        'navigationLabel',
        'directoryTab',
        'simulationTab',
        'exceptionsTab',
        'directoryTitle',
        'directoryDescription',
        'groupDetailTitle',
        'groupDetailDescription',
        'membersTitle',
        'membersDescription',
        'simulationTitle',
        'simulationDescription',
        'simulationInputsTitle',
        'simulationRouteTitle',
        'explanationTitle',
        'exceptionsTitle',
        'exceptionsDescription',
        'noSelectionLabel',
        'runSimulationLabel',
        'refreshDirectoryLabel',
        'editGroupLabel',
        'publishGroupLabel',
        'mobileEditGroupLabel',
        'mobilePublishGroupLabel',
        'mobileCommandReason',
        'retireGroupLabel',
        'mobileRetireLabel',
        'mobileRetireReason',
        'requestRemediationLabel',
        'failClosedTitle',
        'failClosedDescription',
      ]),
    },
    policy: {
      header: header(tx, 'policy'),
      state,
      ...fields(tx, 'policy', [
        'navigationLabel',
        'catalogTab',
        'calendarTab',
        'deliveryTab',
        'delegationTab',
        'catalogTitle',
        'catalogDescription',
        'policyDetailTitle',
        'policyDetailDescription',
        'impactTitle',
        'impactDescription',
        'providersTitle',
        'providersDescription',
        'calendarTitle',
        'calendarDescription',
        'simulationTitle',
        'simulationDescription',
        'deliveryTitle',
        'deliveryDescription',
        'escalationTitle',
        'escalationDescription',
        'delegationTitle',
        'delegationDescription',
        'noSelectionLabel',
        'editPolicyLabel',
        'runSimulationLabel',
        'submitReviewLabel',
        'mobileReviewLabel',
        'mobileReviewReason',
        'mobileEditLabel',
        'mobileEditReason',
        'reviewDelegationLabel',
        'highRiskTitle',
        'providerTruthTitle',
        'providerTruthDescription',
      ]),
    },
    integration: {
      header: header(tx, 'integration'),
      state,
      ...fields(tx, 'integration', [
        'navigationLabel',
        'catalogTab',
        'mappingTab',
        'healthTab',
        'catalogTitle',
        'catalogDescription',
        'detailTitle',
        'detailDescription',
        'mappingTitle',
        'mappingDescription',
        'fieldLabel',
        'sourceLabel',
        'targetLabel',
        'transformLabel',
        'statusLabel',
        'probesTitle',
        'probesDescription',
        'noSelectionLabel',
        'refreshLabel',
        'probeLabel',
        'publishLabel',
        'mobilePublishLabel',
        'mobilePublishReason',
        'staleEvidenceTitle',
        'staleEvidenceDescription',
        'secretsTitle',
        'secretsDescription',
      ]),
    },
    incident: {
      header: header(tx, 'incident'),
      state,
      ...fields(tx, 'incident', [
        'navigationLabel',
        'incidentsTab',
        'recoveryTab',
        'queuesTab',
        'incidentsTitle',
        'incidentsDescription',
        'incidentDetailTitle',
        'incidentDetailDescription',
        'evidenceTitle',
        'evidenceDescription',
        'recoveryTitle',
        'recoveryDescription',
        'eligibilityTitle',
        'stepsTitle',
        'payloadTitle',
        'payloadDescription',
        'queuesTitle',
        'queuesDescription',
        'noSelectionLabel',
        'refreshLabel',
        'prepareRecoveryLabel',
        'executeRecoveryLabel',
        'mobileExecuteLabel',
        'mobileExecuteReason',
        'pauseQueueLabel',
        'mobilePauseLabel',
        'mobilePauseReason',
        'serverEvidenceTitle',
        'serverEvidenceDescription',
      ]),
    },
    audit: {
      header: header(tx, 'audit'),
      state,
      ...fields(tx, 'audit', [
        'navigationLabel',
        'explorerTab',
        'evidenceTab',
        'retentionTab',
        'explorerTitle',
        'explorerDescription',
        'eventDetailTitle',
        'eventDetailDescription',
        'evidenceTitle',
        'evidenceDescription',
        'timelineTitle',
        'manifestsTitle',
        'manifestsDescription',
        'retentionTitle',
        'retentionDescription',
        'noSelectionLabel',
        'refreshLabel',
        'verifyLabel',
        'prepareExportLabel',
        'mobileExportLabel',
        'mobileExportReason',
        'requestHoldReviewLabel',
        'mobileHoldLabel',
        'mobileHoldReason',
        'truthTitle',
        'truthDescription',
      ]),
    },
    analytics: {
      header: header(tx, 'analytics'),
      state,
      ...fields(tx, 'analytics', [
        'coverageTitle',
        'coverageDescription',
        'cohortTitle',
        'cohortDescription',
        'cohortDetailTitle',
        'cohortDetailDescription',
        'bottleneckTitle',
        'bottleneckDescription',
        'recommendationsTitle',
        'recommendationsDescription',
        'noSelectionLabel',
        'refreshLabel',
        'rangeLabel',
        'filterLabel',
        'suppressedTitle',
        'suppressedDescription',
        'readOnlyTitle',
        'readOnlyDescription',
        'stageLabel',
        'p50Label',
        'p90Label',
        'sampleLabel',
      ]),
    },
    deployment: {
      header: header(tx, 'deployment'),
      state,
      ...fields(tx, 'deployment', [
        'navigationLabel',
        'packagesTab',
        'promotionTab',
        'canaryTab',
        'rollbackTab',
        'packagesTitle',
        'packagesDescription',
        'packageDetailTitle',
        'packageDetailDescription',
        'dependenciesTitle',
        'promotionTitle',
        'promotionDescription',
        'gatesTitle',
        'canaryTitle',
        'canaryDescription',
        'observationsTitle',
        'rollbackTitle',
        'rollbackDescription',
        'blockersTitle',
        'noSelectionLabel',
        'refreshLabel',
        'validatePackageLabel',
        'submitPromotionLabel',
        'mobilePromotionLabel',
        'mobilePromotionReason',
        'pauseCanaryLabel',
        'mobilePauseLabel',
        'mobilePauseReason',
        'requestRollbackLabel',
        'mobileRollbackLabel',
        'mobileRollbackReason',
        'evidenceTruthTitle',
        'evidenceTruthDescription',
      ]),
    },
  };
}
