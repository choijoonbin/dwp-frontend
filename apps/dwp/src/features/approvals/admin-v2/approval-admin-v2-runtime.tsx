import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  getApprovalAuditExportInput,
  getApprovalConnectorProbeInput,
  getApprovalDeploymentPromotionInput,
  getApprovalIncidentStageInput,
  readApprovalDeploymentPackage,
} from '@dwp-frontend/shared-utils/api/approval-admin-v2-action-api';
import {
  getApprovalAdminV2AuditEventDetail,
  getApprovalAdminV2IncidentDetail,
} from '@dwp-frontend/shared-utils/api/approval-admin-v2-api';
import {
  approvalAuditExportCommand,
  approvalConnectorProbeCommand,
  approvalDeploymentActivationCommand,
  approvalIncidentStageStartCommand,
} from '@dwp-frontend/shared-utils/api/approval-admin-v2-command-api';
import Stack from '@mui/material/Stack';

import { AdminV2ViewTabs } from './admin-v2-foundation';
import { AnalyticsInsightsWorkspace } from './analytics-insights-workspace';
import { approvalAdminV2Copy } from './approval-admin-v2-copy';
import {
  ApprovalAdminV2RuntimeLayer,
  useApprovalAdminV2RuntimeFeedback,
} from './approval-admin-v2-runtime-feedback';
import { AuditRecordsEvidenceWorkspace } from './audit-records-evidence-workspace';
import { DeploymentCanaryWorkspace } from './deployment-canary-workspace';
import { IntegrationAutomationWorkspace } from './integration-automation-workspace';
import { OperationsIncidentRecoveryWorkspace } from './operations-incident-recovery-workspace';
import { PolicyGovernanceWorkspace } from './policy-governance-workspace';
import {
  approvalAdminV2SourceState,
  retryApprovalAdminV2Read,
} from './approval-admin-v2-runtime-model';
import { useApprovalAdminV2Command } from './use-approval-admin-v2-command';
import { useApprovalAdminV2Source } from './use-approval-admin-v2-source';

import type { AnalyticsInsightsCopy } from './analytics-insights-workspace';
import type { ReactNode } from 'react';
import type { AuditRecordsView } from './audit-records-evidence-workspace';
import type { DeploymentCanaryView } from './deployment-canary-workspace';
import type { IntegrationAutomationView } from './integration-automation-workspace';
import type { OperationsIncidentView } from './operations-incident-recovery-workspace';
import type { PolicyGovernanceView } from './policy-governance-workspace';

function selectedId<T extends { id: string }>(items: readonly T[], selected: string | null) {
  return items.some((item) => item.id === selected) ? selected : (items[0]?.id ?? null);
}

function retry(source: { refetch: () => unknown }) {
  return () => void source.refetch();
}

function requestOptions(source: { requestScope: { contextScopeKey?: string } }) {
  return source.requestScope.contextScopeKey
    ? { contextScopeKey: source.requestScope.contextScopeKey }
    : {};
}

function AdminWorkspaceTabs<T extends string>({
  label,
  value,
  options,
  onChange,
  children,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  children: React.ReactNode;
}) {
  return (
    <Stack gap={2.5}>
      <AdminV2ViewTabs label={label} value={value} options={options} onChange={onChange} />
      {children}
    </Stack>
  );
}

export {
  ApprovalAdminFormsRuntime,
  ApprovalAdminRoutingRuntime,
} from './approval-admin-v2-form-routing-runtime';

function PolicyAutomationRuntime() {
  const { t } = useTranslation('approvals');
  const copy = approvalAdminV2Copy(t).policy;
  const source = useApprovalAdminV2Source(
    'policies',
    (data) => data.policies.length + data.calendars.length + data.delegations.length === 0
  );
  const feedback = useApprovalAdminV2RuntimeFeedback();
  const [view, setView] = useState<PolicyGovernanceView>('delegation');
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const data = source.data;
  return (
    <ApprovalAdminV2RuntimeLayer
      feedback={feedback.feedback}
      dismissLabel={t('adminV2.feedback.dismiss')}
      onDismiss={feedback.clearFeedback}
    >
      <PolicyGovernanceWorkspace
        state={source.state}
        copy={copy}
        metrics={data?.metrics ?? []}
        view={view}
        policies={data?.policies ?? []}
        selectedPolicyId={selectedId(data?.policies ?? [], policyId)}
        providers={data?.providers ?? []}
        calendars={data?.calendars ?? []}
        selectedCalendarId={selectedId(data?.calendars ?? [], calendarId)}
        deliveryPreview={data?.deliveryPreview ?? null}
        escalationSteps={data?.escalationSteps ?? []}
        delegations={data?.delegations ?? []}
        editPolicyReady={false}
        editPolicyDisabledReason={t('adminV2.feedback.policyEditUnavailable')}
        submitReviewReady={false}
        submitReviewDisabledReason={t('adminV2.feedback.policyPublishUnavailable')}
        delegationReviewReady={false}
        delegationReviewDisabledReason={t('adminV2.feedback.delegationReviewUnavailable')}
        simulationReady={false}
        simulationDisabledReason={t('adminV2.feedback.policySimulationUnavailable')}
        onViewChange={setView}
        onSelectPolicy={setPolicyId}
        onSelectCalendar={setCalendarId}
        onEditPolicy={() => undefined}
        onRunSimulation={() => undefined}
        onSubmitReview={() => undefined}
        onReviewDelegation={() => undefined}
        onRetry={retry(source)}
        onResolveConflict={retry(source)}
      />
    </ApprovalAdminV2RuntimeLayer>
  );
}

export function ApprovalAdminPoliciesRuntime({
  policyWorkspace,
  documentWorkspace,
}: {
  policyWorkspace: ReactNode;
  documentWorkspace: ReactNode;
}) {
  const { t } = useTranslation('approvals');
  const tabs = approvalAdminV2Copy(t).tabs;
  const [view, setView] = useState<'policy' | 'automation'>('automation');
  return (
    <AdminWorkspaceTabs
      label={tabs.label}
      value={view}
      onChange={setView}
      options={[
        { value: 'policy', label: tabs.policy },
        { value: 'automation', label: tabs.automation },
      ]}
    >
      {view === 'policy' ? (
        <Stack gap={3}>
          {policyWorkspace}
          {documentWorkspace}
        </Stack>
      ) : (
        <PolicyAutomationRuntime />
      )}
    </AdminWorkspaceTabs>
  );
}

export function ApprovalAdminIntegrationsRuntime() {
  const { t } = useTranslation('approvals');
  const copy = approvalAdminV2Copy(t).integration;
  const source = useApprovalAdminV2Source('connectors', (data) => data.connectors.length === 0);
  const command = useApprovalAdminV2Command(source);
  const feedback = useApprovalAdminV2RuntimeFeedback({
    severity: 'info',
    title: t('adminV2.feedback.unsupportedTitle'),
    detail: t('adminV2.feedback.connectorPublish'),
  });
  const [view, setView] = useState<IntegrationAutomationView>('catalog');
  const [selection, setSelection] = useState<string | null>(null);
  const connectors = (source.data?.connectors ?? []).map((item) => ({
    ...item,
    probeReady: item.probeCommand.commandReady,
    publishReady: item.publishCommand.commandReady,
    probeDisabledReason: t('adminV2.feedback.connectorProbeUnavailable'),
    publishDisabledReason: t('adminV2.feedback.connectorPublish'),
  }));
  const probe = async (connectorId: string) => {
    try {
      const input = await getApprovalConnectorProbeInput(connectorId, requestOptions(source));
      await command.begin(
        approvalConnectorProbeCommand({
          ...input,
          probeId: globalThis.crypto.randomUUID(),
        })
      );
    } catch (caught) {
      command.reject(caught);
    }
  };
  return (
    <ApprovalAdminV2RuntimeLayer
      feedback={feedback.feedback}
      dismissLabel={t('adminV2.feedback.dismiss')}
      onDismiss={feedback.clearFeedback}
      controller={command.controller}
    >
      <IntegrationAutomationWorkspace
        state={command.failureState ?? source.state}
        copy={copy}
        metrics={source.data?.metrics ?? []}
        view={view}
        connectors={connectors}
        selectedConnectorId={selectedId(connectors, selection)}
        onViewChange={setView}
        onSelectConnector={setSelection}
        onRefresh={retry(source)}
        onProbe={(connectorId) => void probe(connectorId)}
        onPublish={() =>
          feedback.unsupported(
            t('adminV2.feedback.unsupportedTitle'),
            t('adminV2.feedback.connectorPublish')
          )
        }
        onRetry={retry(source)}
        onResolveConflict={() => {
          command.clearFailure();
          void source.refetch();
        }}
      />
    </ApprovalAdminV2RuntimeLayer>
  );
}

function IncidentRuntime() {
  const { t } = useTranslation('approvals');
  const copy = approvalAdminV2Copy(t).incident;
  const source = useApprovalAdminV2Source('incidents', (data) => data.incidents.length === 0);
  const feedback = useApprovalAdminV2RuntimeFeedback();
  const [view, setView] = useState<OperationsIncidentView>('incidents');
  const [selection, setSelection] = useState<string | null>(null);
  const data = source.data;
  const selectedIncidentId = selectedId(data?.incidents ?? [], selection);
  const incidentDetail = useQuery({
    queryKey: [
      'approvals',
      'admin-v2',
      'incident-detail',
      selectedIncidentId,
      ...source.requestScope.cacheKey,
    ] as const,
    queryFn: ({ signal }) =>
      getApprovalAdminV2IncidentDetail(
        selectedIncidentId as string,
        source.requestScope.contextScopeKey,
        signal
      ),
    enabled: source.state === 'ready' && source.scopeReady && selectedIncidentId !== null,
    retry: retryApprovalAdminV2Read,
    staleTime: 30_000,
    notifyOnChangeProps: 'all',
  });
  const selectionState =
    source.state !== 'ready'
      ? source.state
      : selectedIncidentId === null
        ? 'empty'
        : approvalAdminV2SourceState(incidentDetail, source.scopeReady, () => false);
  const selectedDetailIncident = incidentDetail.data?.incidents[0];
  const incidents = (data?.incidents ?? []).map((incident) =>
    incident.id === selectedIncidentId && selectedDetailIncident?.id === selectedIncidentId
      ? selectedDetailIncident
      : incident
  );
  const recoveryPlan =
    incidentDetail.data?.recoveryPlan?.incidentId === selectedIncidentId
      ? incidentDetail.data.recoveryPlan
      : null;
  const selectedIncidentRef = useRef(selectedIncidentId);
  const recoveryPlanRef = useRef(recoveryPlan);
  selectedIncidentRef.current = selectedIncidentId;
  recoveryPlanRef.current = recoveryPlan;
  const command = useApprovalAdminV2Command(source, async () => {
    await incidentDetail.refetch();
  });
  const executeRecovery = async (planId: string) => {
    const incidentId = recoveryPlan?.incidentId;
    if (
      selectionState !== 'ready' ||
      !incidentId ||
      incidentId !== selectedIncidentRef.current ||
      recoveryPlan.planId !== planId ||
      recoveryPlan.command.targetId !== planId ||
      recoveryPlan.command.commandReady !== true
    )
      return;
    try {
      const input = await getApprovalIncidentStageInput(incidentId, planId, requestOptions(source));
      if (selectedIncidentRef.current !== incidentId) return;
      const isTargetCurrent = () => {
        const current = recoveryPlanRef.current;
        return (
          selectedIncidentRef.current === incidentId &&
          current?.incidentId === incidentId &&
          current.planId === planId &&
          current.command.targetId === planId &&
          current.command.commandReady === true
        );
      };
      await command.begin(
        approvalIncidentStageStartCommand({
          ...input,
          executionKey: `approval-admin-v2-${globalThis.crypto.randomUUID()}`,
        }),
        isTargetCurrent
      );
    } catch (caught) {
      command.reject(caught);
    }
  };
  return (
    <ApprovalAdminV2RuntimeLayer
      feedback={feedback.feedback}
      dismissLabel={t('adminV2.feedback.dismiss')}
      onDismiss={feedback.clearFeedback}
      controller={command.controller}
    >
      <OperationsIncidentRecoveryWorkspace
        state={command.failureState ?? selectionState}
        copy={copy}
        metrics={data?.metrics ?? []}
        view={view}
        incidents={incidents}
        selectedIncidentId={selectedIncidentId}
        recoveryPlan={recoveryPlan}
        queues={data?.queues ?? []}
        prepareRecoveryReady={false}
        prepareRecoveryDisabledReason={t('adminV2.feedback.incidentPlanUnavailable')}
        executeRecoveryReady={
          selectionState === 'ready' &&
          recoveryPlan?.incidentId === selectedIncidentId &&
          recoveryPlan.command.commandReady === true
        }
        executeRecoveryDisabledReason={t('adminV2.feedback.incidentExecuteUnavailable')}
        pauseQueueReady={false}
        pauseQueueDisabledReason={t('adminV2.feedback.queuePauseUnavailable')}
        onViewChange={setView}
        onSelectIncident={(incidentId) => {
          command.controller.close();
          command.clearFailure();
          setSelection(incidentId);
        }}
        onRefresh={() => {
          void source.refetch();
          void incidentDetail.refetch();
        }}
        onPrepareRecovery={() => undefined}
        onExecuteRecovery={(planId) => void executeRecovery(planId)}
        onPauseQueue={() => undefined}
        onRetry={() =>
          void (source.state === 'ready' ? incidentDetail.refetch() : source.refetch())
        }
        onResolveConflict={() => {
          command.clearFailure();
          void incidentDetail.refetch();
        }}
      />
    </ApprovalAdminV2RuntimeLayer>
  );
}

export function ApprovalAdminOperationsRuntime({
  deliveryWorkspace,
}: {
  deliveryWorkspace: ReactNode;
}) {
  const { t } = useTranslation('approvals');
  const tabs = approvalAdminV2Copy(t).tabs;
  const [view, setView] = useState<'delivery' | 'incidents'>('delivery');
  return (
    <AdminWorkspaceTabs
      label={tabs.label}
      value={view}
      onChange={setView}
      options={[
        { value: 'delivery', label: tabs.delivery },
        { value: 'incidents', label: tabs.incidents },
      ]}
    >
      {view === 'delivery' ? deliveryWorkspace : <IncidentRuntime />}
    </AdminWorkspaceTabs>
  );
}

export function ApprovalAdminAuditRuntime() {
  const { t } = useTranslation('approvals');
  const copy = approvalAdminV2Copy(t).audit;
  const source = useApprovalAdminV2Source('audit', (data) => data.events.length === 0);
  const feedback = useApprovalAdminV2RuntimeFeedback();
  const [view, setView] = useState<AuditRecordsView>('explorer');
  const [selection, setSelection] = useState<string | null>(null);
  const data = source.data;
  const selectedEventId = selectedId(data?.events ?? [], selection);
  const eventDetail = useQuery({
    queryKey: [
      'approvals',
      'admin-v2',
      'audit-event-detail',
      selectedEventId,
      ...source.requestScope.cacheKey,
    ] as const,
    queryFn: ({ signal }) =>
      getApprovalAdminV2AuditEventDetail(
        selectedEventId as string,
        source.requestScope.contextScopeKey,
        signal
      ),
    enabled: source.state === 'ready' && source.scopeReady && selectedEventId !== null,
    retry: retryApprovalAdminV2Read,
    staleTime: 30_000,
    notifyOnChangeProps: 'all',
  });
  const selectionState =
    source.state !== 'ready'
      ? source.state
      : selectedEventId === null
        ? 'empty'
        : approvalAdminV2SourceState(eventDetail, source.scopeReady, () => false);
  const evidenceBundle =
    eventDetail.data?.evidenceBundle?.eventId === selectedEventId
      ? eventDetail.data.evidenceBundle
      : null;
  const selectedRetentionRecord = eventDetail.data?.retentionRecords[0];
  const retentionRecords = (data?.retentionRecords ?? []).map((record) =>
    record.id === selectedEventId && selectedRetentionRecord?.id === selectedEventId
      ? selectedRetentionRecord
      : record
  );
  const selectedEventRef = useRef(selectedEventId);
  const evidenceBundleRef = useRef(evidenceBundle);
  selectedEventRef.current = selectedEventId;
  evidenceBundleRef.current = evidenceBundle;
  const command = useApprovalAdminV2Command(source, async () => {
    await eventDetail.refetch();
  });
  const readSelectedEvent = async () => {
    const eventId = evidenceBundle?.eventId;
    const requestId = evidenceBundle?.requestId;
    if (
      selectionState !== 'ready' ||
      !eventId ||
      !requestId ||
      eventId !== selectedEventRef.current ||
      evidenceBundle.exportCommand.targetId !== eventId ||
      evidenceBundle.exportCommand.commandReady !== true
    )
      return null;
    const input = await getApprovalAuditExportInput(eventId, requestId, requestOptions(source));
    const current = evidenceBundleRef.current;
    return selectedEventRef.current === eventId &&
      current?.eventId === eventId &&
      current.requestId === requestId &&
      input.eventId === eventId &&
      input.requestId === requestId
      ? input
      : null;
  };
  const verifyEvidence = async () => {
    try {
      if (!(await readSelectedEvent())) return;
      feedback.success(t('adminV2.feedback.successTitle'), t('adminV2.feedback.auditRefreshed'));
      void source.refetch();
    } catch (caught) {
      command.reject(caught);
    }
  };
  const prepareExport = async () => {
    try {
      const input = await readSelectedEvent();
      if (!input) return;
      const isTargetCurrent = () => {
        const current = evidenceBundleRef.current;
        return (
          selectedEventRef.current === input.eventId &&
          current?.eventId === input.eventId &&
          current.requestId === input.requestId &&
          current.exportCommand.targetId === input.eventId &&
          current.exportCommand.commandReady === true
        );
      };
      await command.begin(
        approvalAuditExportCommand({
          exportId: globalThis.crypto.randomUUID(),
          requestId: input.requestId,
          from: input.from,
          to: input.to,
        }),
        isTargetCurrent
      );
    } catch (caught) {
      command.reject(caught);
    }
  };
  return (
    <ApprovalAdminV2RuntimeLayer
      feedback={feedback.feedback}
      dismissLabel={t('adminV2.feedback.dismiss')}
      onDismiss={feedback.clearFeedback}
      controller={command.controller}
    >
      <AuditRecordsEvidenceWorkspace
        state={command.failureState ?? selectionState}
        copy={copy}
        metrics={data?.metrics ?? []}
        view={view}
        events={data?.events ?? []}
        selectedEventId={selectedEventId}
        evidenceBundle={evidenceBundle}
        retentionRecords={retentionRecords}
        exportReady={
          selectionState === 'ready' &&
          evidenceBundle?.eventId === selectedEventId &&
          evidenceBundle.exportCommand.commandReady === true
        }
        exportDisabledReason={t('adminV2.feedback.auditExportUnavailable')}
        holdReviewReady={false}
        holdReviewDisabledReason={t('adminV2.feedback.auditHold')}
        onViewChange={setView}
        onSelectEvent={(eventId) => {
          command.controller.close();
          command.clearFailure();
          setSelection(eventId);
        }}
        onRefresh={() => {
          void source.refetch();
          void eventDetail.refetch();
        }}
        onVerifyEvidence={() => void verifyEvidence()}
        onPrepareExport={() => void prepareExport()}
        onRequestHoldReview={() =>
          feedback.unsupported(
            t('adminV2.feedback.unsupportedTitle'),
            t('adminV2.feedback.auditHold')
          )
        }
        onRetry={() => void (source.state === 'ready' ? eventDetail.refetch() : source.refetch())}
        onResolveConflict={() => {
          command.clearFailure();
          void eventDetail.refetch();
        }}
      />
    </ApprovalAdminV2RuntimeLayer>
  );
}

export function ApprovalAdminAnalyticsRuntime() {
  const { t } = useTranslation('approvals');
  const copy: AnalyticsInsightsCopy = approvalAdminV2Copy(t).analytics;
  const source = useApprovalAdminV2Source('analytics', (data) => data.cohorts.length === 0);
  const [selection, setSelection] = useState<string | null>(null);
  const data = source.data;
  return (
    <AnalyticsInsightsWorkspace
      state={source.state}
      copy={copy}
      metrics={data?.metrics ?? []}
      coverageFacts={data?.coverageFacts ?? []}
      cohorts={data?.cohorts ?? []}
      selectedCohortId={selectedId(data?.cohorts ?? [], selection)}
      stages={data?.stages ?? []}
      recommendations={data?.recommendations ?? []}
      onSelectCohort={setSelection}
      onRefresh={retry(source)}
      onChangeRange={retry(source)}
      onChangeFilter={retry(source)}
      onRetry={retry(source)}
      onResolveConflict={retry(source)}
    />
  );
}

export function ApprovalAdminDeploymentsRuntime() {
  const { t } = useTranslation('approvals');
  const copy = approvalAdminV2Copy(t).deployment;
  const source = useApprovalAdminV2Source('deployments', (data) => data.packages.length === 0);
  const command = useApprovalAdminV2Command(source);
  const feedback = useApprovalAdminV2RuntimeFeedback();
  const [view, setView] = useState<DeploymentCanaryView>('packages');
  const [selection, setSelection] = useState<string | null>(null);
  const data = source.data;
  const validatePackage = async (packageId: string) => {
    try {
      await readApprovalDeploymentPackage(packageId, requestOptions(source));
      feedback.success(t('adminV2.feedback.successTitle'), t('adminV2.feedback.packageReviewed'));
    } catch (caught) {
      command.reject(caught);
    }
  };
  const submitPromotion = async (promotionId: string) => {
    try {
      const input = await getApprovalDeploymentPromotionInput(promotionId, requestOptions(source));
      if (!['APPROVED', 'SCHEDULED'].includes(input.status)) {
        feedback.unsupported(
          t('adminV2.feedback.unsupportedTitle'),
          t('adminV2.feedback.deploymentReview')
        );
        return;
      }
      await command.begin(
        approvalDeploymentActivationCommand(input.promotionId, input.expectedVersion)
      );
    } catch (caught) {
      command.reject(caught);
    }
  };
  return (
    <ApprovalAdminV2RuntimeLayer
      feedback={feedback.feedback}
      dismissLabel={t('adminV2.feedback.dismiss')}
      onDismiss={feedback.clearFeedback}
      controller={command.controller}
    >
      <DeploymentCanaryWorkspace
        state={command.failureState ?? source.state}
        copy={copy}
        metrics={data?.metrics ?? []}
        view={view}
        packages={data?.packages ?? []}
        selectedPackageId={selectedId(data?.packages ?? [], selection)}
        promotionPlan={data?.promotionPlan ?? null}
        canaryEvidence={data?.canaryEvidence ?? null}
        rollbackAssessment={data?.rollbackAssessment ?? null}
        promotionReady={data?.promotionPlan?.command.commandReady === true}
        promotionDisabledReason={t('adminV2.feedback.deploymentActivationUnavailable')}
        pauseReady={false}
        pauseDisabledReason={t('adminV2.feedback.deploymentPause')}
        rollbackReady={false}
        rollbackDisabledReason={t('adminV2.feedback.deploymentRollback')}
        onViewChange={setView}
        onSelectPackage={setSelection}
        onRefresh={retry(source)}
        onValidatePackage={(packageId) => void validatePackage(packageId)}
        onSubmitPromotion={(promotionId) => void submitPromotion(promotionId)}
        onPauseCanary={() =>
          feedback.unsupported(
            t('adminV2.feedback.unsupportedTitle'),
            t('adminV2.feedback.deploymentPause')
          )
        }
        onRequestRollback={() =>
          feedback.unsupported(
            t('adminV2.feedback.unsupportedTitle'),
            t('adminV2.feedback.deploymentRollback')
          )
        }
        onRetry={retry(source)}
        onResolveConflict={() => {
          command.clearFailure();
          void source.refetch();
        }}
      />
    </ApprovalAdminV2RuntimeLayer>
  );
}
