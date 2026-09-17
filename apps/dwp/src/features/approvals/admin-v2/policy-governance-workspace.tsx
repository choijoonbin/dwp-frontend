import { BellRing, FileDiff, Play, Send, ShieldCheck, UserRoundCog } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  AdminV2FactGrid,
  AdminV2GovernedAction,
  AdminV2InspectorPaper,
  AdminV2MetricStrip,
  AdminV2RecordButton,
  AdminV2Section,
  AdminV2StateBoundary,
  AdminV2StatusPill,
  AdminV2Timeline,
  AdminV2ViewTabs,
  AdminV2WorkspaceFrame,
} from './admin-v2-foundation';
import { ApprovalAdminV2ActionDeck } from './approval-admin-v2-action-deck';

import type { AdminV2WorkspaceActionDeck } from './approval-admin-v2-action-deck';
import type {
  AdminV2Fact,
  AdminV2Metric,
  AdminV2SourceState,
  AdminV2StateCopy,
  AdminV2Status,
  AdminV2WorkspaceHeader,
} from './admin-v2-types';

export type PolicyGovernanceView = 'catalog' | 'calendar' | 'delivery' | 'delegation';

export type ApprovalGovernancePolicy = {
  id: string;
  name: string;
  description: string;
  familyLabel: string;
  scopeLabel: string;
  versionLabel: string;
  status: AdminV2Status;
  facts: readonly AdminV2Fact[];
  impactFacts: readonly AdminV2Fact[];
  highRisk: boolean;
  highRiskReason?: string;
};

export type NotificationProviderRecord = {
  id: string;
  name: string;
  channelLabel: string;
  lastVerifiedLabel: string;
  status: AdminV2Status;
};

export type BusinessCalendarRecord = {
  id: string;
  name: string;
  timezoneLabel: string;
  effectiveLabel: string;
  weekdaysLabel: string;
  holidayCountLabel: string;
  exceptionCountLabel: string;
  status: AdminV2Status;
  facts: readonly AdminV2Fact[];
};

export type NotificationDeliveryPreview = {
  id: string;
  channelLabel: string;
  localeLabel: string;
  recipientLabel: string;
  subject: string;
  body: string;
  fallbackLabel: string;
  redactionLabel: string;
  status: AdminV2Status;
};

export type EscalationTimelineStep = {
  id: string;
  title: string;
  detail: string;
  meta?: string;
  status: AdminV2Status;
};

export type DelegationReviewRecord = {
  id: string;
  title: string;
  description: string;
  scopeLabel: string;
  effectiveLabel: string;
  auditLabel: string;
  status: AdminV2Status;
  facts: readonly AdminV2Fact[];
};

export type PolicyGovernanceCopy = {
  header: AdminV2WorkspaceHeader;
  state: AdminV2StateCopy;
  navigationLabel: string;
  catalogTab: string;
  calendarTab: string;
  deliveryTab: string;
  delegationTab: string;
  catalogTitle: string;
  catalogDescription: string;
  policyDetailTitle: string;
  policyDetailDescription: string;
  impactTitle: string;
  impactDescription: string;
  providersTitle: string;
  providersDescription: string;
  calendarTitle: string;
  calendarDescription: string;
  simulationTitle: string;
  simulationDescription: string;
  deliveryTitle: string;
  deliveryDescription: string;
  escalationTitle: string;
  escalationDescription: string;
  delegationTitle: string;
  delegationDescription: string;
  noSelectionLabel: string;
  editPolicyLabel: string;
  runSimulationLabel: string;
  submitReviewLabel: string;
  mobileReviewLabel: string;
  mobileReviewReason: string;
  mobileEditLabel: string;
  mobileEditReason: string;
  reviewDelegationLabel: string;
  highRiskTitle: string;
  providerTruthTitle: string;
  providerTruthDescription: string;
};

export type PolicyGovernanceWorkspaceProps = {
  state: AdminV2SourceState;
  copy: PolicyGovernanceCopy;
  metrics: readonly AdminV2Metric[];
  view: PolicyGovernanceView;
  policies: readonly ApprovalGovernancePolicy[];
  selectedPolicyId: string | null;
  providers: readonly NotificationProviderRecord[];
  calendars: readonly BusinessCalendarRecord[];
  selectedCalendarId: string | null;
  deliveryPreview: NotificationDeliveryPreview | null;
  escalationSteps: readonly EscalationTimelineStep[];
  delegations: readonly DelegationReviewRecord[];
  editPolicyReady: boolean;
  editPolicyDisabledReason?: string;
  submitReviewReady: boolean;
  submitReviewDisabledReason?: string;
  delegationReviewReady: boolean;
  delegationReviewDisabledReason?: string;
  simulationReady: boolean;
  simulationDisabledReason?: string;
  actionDeck?: AdminV2WorkspaceActionDeck;
  onViewChange: (view: PolicyGovernanceView) => void;
  onSelectPolicy: (policyId: string) => void;
  onSelectCalendar: (calendarId: string) => void;
  onEditPolicy: (policyId: string) => void;
  onRunSimulation: () => void;
  onSubmitReview: () => void;
  onReviewDelegation: (delegationId: string) => void;
  onRetry?: () => void;
  onResolveConflict?: () => void;
};

function CatalogView({
  copy,
  policies,
  selectedPolicyId,
  selectedPolicy,
  providers,
  commandReady,
  editPolicyReady,
  editPolicyDisabledReason,
  onSelectPolicy,
  onEditPolicy,
}: Pick<
  PolicyGovernanceWorkspaceProps,
  | 'copy'
  | 'policies'
  | 'selectedPolicyId'
  | 'providers'
  | 'editPolicyReady'
  | 'editPolicyDisabledReason'
  | 'onSelectPolicy'
  | 'onEditPolicy'
> & {
  selectedPolicy: ApprovalGovernancePolicy | null;
  commandReady: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(280px,.8fr) minmax(0,1.6fr)' },
        gap: { xs: 1.5, lg: 2 },
        alignItems: 'start',
      }}
    >
      <Stack gap={1.5}>
        <AdminV2InspectorPaper>
          <AdminV2Section
            title={copy.catalogTitle}
            description={copy.catalogDescription}
            labelledBy="admin-v2-policy-catalog"
          >
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
              {policies.map((policy) => (
                <Box component="li" key={policy.id}>
                  <AdminV2RecordButton
                    selected={policy.id === selectedPolicyId}
                    title={policy.name}
                    description={policy.description}
                    meta={`${policy.familyLabel} · ${policy.scopeLabel} · ${policy.versionLabel}`}
                    status={policy.status}
                    onClick={() => onSelectPolicy(policy.id)}
                  />
                </Box>
              ))}
            </Box>
          </AdminV2Section>
        </AdminV2InspectorPaper>

        <AdminV2InspectorPaper>
          <AdminV2Section
            title={copy.providersTitle}
            description={copy.providersDescription}
            labelledBy="admin-v2-policy-providers"
          >
            <Stack divider={<Divider flexItem />}>
              {providers.map((provider) => (
                <Stack key={provider.id} direction="row" gap={1} sx={{ p: 1.25 }}>
                  <BellRing size={17} aria-hidden="true" />
                  <Box minWidth={0} flex={1}>
                    <Typography variant="body2" fontWeight="fontWeightBold">
                      {provider.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {provider.channelLabel} · {provider.lastVerifiedLabel}
                    </Typography>
                  </Box>
                  <AdminV2StatusPill status={provider.status} />
                </Stack>
              ))}
            </Stack>
            <Box sx={{ p: 1.25, borderBlockStart: 1, borderColor: 'divider' }}>
              <InlineFeedback severity="info" title={copy.providerTruthTitle}>
                {copy.providerTruthDescription}
              </InlineFeedback>
            </Box>
          </AdminV2Section>
        </AdminV2InspectorPaper>
      </Stack>

      <AdminV2InspectorPaper>
        <AdminV2Section
          title={selectedPolicy?.name ?? copy.policyDetailTitle}
          description={selectedPolicy?.description ?? copy.policyDetailDescription}
          labelledBy="admin-v2-policy-detail"
          action={selectedPolicy ? <AdminV2StatusPill status={selectedPolicy.status} /> : undefined}
        >
          {selectedPolicy ? (
            <>
              {selectedPolicy.highRisk ? (
                <Box sx={{ p: 1.5, borderBlockEnd: 1, borderColor: 'divider' }}>
                  <InlineFeedback severity="warning" title={copy.highRiskTitle}>
                    {selectedPolicy.highRiskReason}
                  </InlineFeedback>
                </Box>
              ) : null}
              <AdminV2FactGrid facts={selectedPolicy.facts} />
              <Box sx={{ px: 1.5, py: 1.25, borderBlock: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight="fontWeightBold">
                  {copy.impactTitle}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {copy.impactDescription}
                </Typography>
              </Box>
              <AdminV2FactGrid facts={selectedPolicy.impactFacts} />
              <Box sx={{ p: 1.5 }}>
                <AdminV2GovernedAction
                  desktopLabel={copy.editPolicyLabel}
                  mobileLabel={copy.mobileEditLabel}
                  mobileReason={copy.mobileEditReason}
                  disabled={!commandReady || !editPolicyReady}
                  disabledReason={editPolicyDisabledReason}
                  onAction={() => onEditPolicy(selectedPolicy.id)}
                  icon={<FileDiff size={16} />}
                />
              </Box>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {copy.noSelectionLabel}
            </Typography>
          )}
        </AdminV2Section>
      </AdminV2InspectorPaper>
    </Box>
  );
}

function CalendarView({
  copy,
  calendars,
  selectedCalendarId,
  selectedCalendar,
  escalationSteps,
  simulationReady,
  simulationDisabledReason,
  onSelectCalendar,
  onRunSimulation,
}: Pick<
  PolicyGovernanceWorkspaceProps,
  | 'copy'
  | 'calendars'
  | 'selectedCalendarId'
  | 'escalationSteps'
  | 'simulationReady'
  | 'simulationDisabledReason'
  | 'onSelectCalendar'
  | 'onRunSimulation'
> & { selectedCalendar: BusinessCalendarRecord | null }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(280px,.8fr) minmax(0,1.6fr)' },
        gap: { xs: 1.5, lg: 2 },
        alignItems: 'start',
      }}
    >
      <AdminV2InspectorPaper>
        <AdminV2Section
          title={copy.calendarTitle}
          description={copy.calendarDescription}
          labelledBy="admin-v2-policy-calendar"
        >
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {calendars.map((calendar) => (
              <Box component="li" key={calendar.id}>
                <AdminV2RecordButton
                  selected={calendar.id === selectedCalendarId}
                  title={calendar.name}
                  description={`${calendar.timezoneLabel} · ${calendar.effectiveLabel}`}
                  meta={`${calendar.weekdaysLabel} · ${calendar.holidayCountLabel} · ${calendar.exceptionCountLabel}`}
                  status={calendar.status}
                  onClick={() => onSelectCalendar(calendar.id)}
                />
              </Box>
            ))}
          </Box>
        </AdminV2Section>
      </AdminV2InspectorPaper>

      <AdminV2InspectorPaper>
        <AdminV2Section
          title={selectedCalendar?.name ?? copy.simulationTitle}
          description={copy.simulationDescription}
          labelledBy="admin-v2-policy-calendar-simulation"
          action={
            <Stack alignItems="flex-end" gap={0.5}>
              <ActionButton
                intent="primary"
                size="small"
                startIcon={<Play size={15} />}
                disabled={!simulationReady}
                onClick={onRunSimulation}
              >
                {copy.runSimulationLabel}
              </ActionButton>
              {!simulationReady && simulationDisabledReason ? (
                <Typography variant="caption" color="text.secondary">
                  {simulationDisabledReason}
                </Typography>
              ) : null}
            </Stack>
          }
        >
          {selectedCalendar ? <AdminV2FactGrid facts={selectedCalendar.facts} /> : null}
          <Box sx={{ px: 1.5, py: 1.25, borderBlock: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight="fontWeightBold">
              {copy.escalationTitle}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {copy.escalationDescription}
            </Typography>
          </Box>
          <AdminV2Timeline items={escalationSteps} />
        </AdminV2Section>
      </AdminV2InspectorPaper>
    </Box>
  );
}

function DeliveryView({
  copy,
  providers,
  deliveryPreview,
  escalationSteps,
  simulationReady,
  simulationDisabledReason,
  onRunSimulation,
}: Pick<
  PolicyGovernanceWorkspaceProps,
  | 'copy'
  | 'providers'
  | 'deliveryPreview'
  | 'escalationSteps'
  | 'simulationReady'
  | 'simulationDisabledReason'
  | 'onRunSimulation'
>) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,1.1fr) minmax(280px,.9fr)' },
        gap: { xs: 1.5, lg: 2 },
        alignItems: 'start',
      }}
    >
      <AdminV2InspectorPaper>
        <AdminV2Section
          title={copy.deliveryTitle}
          description={copy.deliveryDescription}
          labelledBy="admin-v2-policy-delivery"
          action={
            deliveryPreview ? <AdminV2StatusPill status={deliveryPreview.status} /> : undefined
          }
        >
          <Stack divider={<Divider flexItem />}>
            {providers.map((provider) => (
              <Stack
                key={provider.id}
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                gap={1}
                sx={{ p: 1.5 }}
              >
                <Box minWidth={0}>
                  <Typography variant="subtitle2" fontWeight="fontWeightBold">
                    {provider.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {provider.channelLabel} · {provider.lastVerifiedLabel}
                  </Typography>
                </Box>
                <AdminV2StatusPill status={provider.status} />
              </Stack>
            ))}
          </Stack>
          {deliveryPreview ? (
            <Stack gap={1.25} sx={{ p: 1.5, borderBlockStart: 1, borderColor: 'divider' }}>
              <Stack direction="row" gap={1} flexWrap="wrap">
                <AdminV2StatusPill status={{ label: deliveryPreview.channelLabel, tone: 'info' }} />
                <Typography variant="caption" color="text.secondary">
                  {deliveryPreview.localeLabel} · {deliveryPreview.recipientLabel}
                </Typography>
              </Stack>
              <Box>
                <Typography variant="subtitle2" fontWeight="fontWeightBold">
                  {deliveryPreview.subject}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.75, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {deliveryPreview.body}
                </Typography>
              </Box>
              <InlineFeedback severity="info" title={deliveryPreview.fallbackLabel}>
                {deliveryPreview.redactionLabel}
              </InlineFeedback>
            </Stack>
          ) : providers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {copy.deliveryDescription}
            </Typography>
          ) : null}
        </AdminV2Section>
      </AdminV2InspectorPaper>

      <AdminV2InspectorPaper>
        <AdminV2Section
          title={copy.escalationTitle}
          description={copy.escalationDescription}
          labelledBy="admin-v2-policy-delivery-timeline"
          action={
            <Stack alignItems="flex-end" gap={0.5}>
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<Play size={15} />}
                disabled={!simulationReady}
                onClick={onRunSimulation}
              >
                {copy.runSimulationLabel}
              </ActionButton>
              {!simulationReady && simulationDisabledReason ? (
                <Typography variant="caption" color="text.secondary">
                  {simulationDisabledReason}
                </Typography>
              ) : null}
            </Stack>
          }
        >
          <AdminV2Timeline items={escalationSteps} />
        </AdminV2Section>
      </AdminV2InspectorPaper>
    </Box>
  );
}

function DelegationView({
  copy,
  delegations,
  delegationReviewReady,
  delegationReviewDisabledReason,
  onReviewDelegation,
}: Pick<
  PolicyGovernanceWorkspaceProps,
  | 'copy'
  | 'delegations'
  | 'delegationReviewReady'
  | 'delegationReviewDisabledReason'
  | 'onReviewDelegation'
>) {
  return (
    <AdminV2InspectorPaper>
      <AdminV2Section
        title={copy.delegationTitle}
        description={copy.delegationDescription}
        labelledBy="admin-v2-policy-delegations"
      >
        <Stack divider={<Divider flexItem />}>
          {delegations.map((delegation) => (
            <Box key={delegation.id} sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                <Box minWidth={0}>
                  <Typography variant="subtitle2" fontWeight="fontWeightBold">
                    {delegation.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {delegation.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {delegation.scopeLabel} · {delegation.effectiveLabel} · {delegation.auditLabel}
                  </Typography>
                </Box>
                <AdminV2StatusPill status={delegation.status} />
              </Stack>
              <Box
                sx={{
                  mt: 1.25,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 1.5}px`,
                }}
              >
                <AdminV2FactGrid facts={delegation.facts} />
              </Box>
              <Stack alignItems="flex-end" sx={{ mt: 1.25 }} gap={0.5}>
                <ActionButton
                  intent="secondary"
                  startIcon={<UserRoundCog size={16} />}
                  disabled={!delegationReviewReady}
                  onClick={() => onReviewDelegation(delegation.id)}
                >
                  {copy.reviewDelegationLabel}
                </ActionButton>
                {!delegationReviewReady && delegationReviewDisabledReason ? (
                  <Typography variant="caption" color="text.secondary" textAlign="right">
                    {delegationReviewDisabledReason}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          ))}
        </Stack>
      </AdminV2Section>
    </AdminV2InspectorPaper>
  );
}

export function PolicyGovernanceWorkspace({
  state,
  copy,
  metrics,
  view,
  policies,
  selectedPolicyId,
  providers,
  calendars,
  selectedCalendarId,
  deliveryPreview,
  escalationSteps,
  delegations,
  editPolicyReady,
  editPolicyDisabledReason,
  submitReviewReady,
  submitReviewDisabledReason,
  delegationReviewReady,
  delegationReviewDisabledReason,
  simulationReady,
  simulationDisabledReason,
  actionDeck,
  onViewChange,
  onSelectPolicy,
  onSelectCalendar,
  onEditPolicy,
  onRunSimulation,
  onSubmitReview,
  onReviewDelegation,
  onRetry,
  onResolveConflict,
}: PolicyGovernanceWorkspaceProps) {
  const selectedPolicy = policies.find((policy) => policy.id === selectedPolicyId) ?? null;
  const selectedCalendar = calendars.find((calendar) => calendar.id === selectedCalendarId) ?? null;
  const commandReady = state === 'ready';

  return (
    <AdminV2WorkspaceFrame
      header={copy.header}
      icon={ShieldCheck}
      primaryAction={
        <AdminV2GovernedAction
          desktopLabel={copy.submitReviewLabel}
          mobileLabel={copy.mobileReviewLabel}
          mobileReason={copy.mobileReviewReason}
          disabled={!commandReady || !submitReviewReady}
          disabledReason={submitReviewDisabledReason}
          onAction={onSubmitReview}
          icon={<Send size={16} />}
        />
      }
    >
      <AdminV2StateBoundary
        state={state}
        copy={copy.state}
        actions={{ onRetry, onResolveConflict }}
      >
        <AdminV2MetricStrip metrics={metrics} />
        {actionDeck ? <ApprovalAdminV2ActionDeck state={state} deck={actionDeck} /> : null}
        <AdminV2InspectorPaper>
          <AdminV2ViewTabs
            label={copy.navigationLabel}
            value={view}
            options={[
              { value: 'catalog', label: copy.catalogTab, count: policies.length },
              { value: 'calendar', label: copy.calendarTab, count: calendars.length },
              { value: 'delivery', label: copy.deliveryTab, count: providers.length },
              { value: 'delegation', label: copy.delegationTab, count: delegations.length },
            ]}
            onChange={onViewChange}
          />
          <Box sx={{ p: { xs: 1.25, sm: 1.75 } }}>
            {view === 'catalog' ? (
              <CatalogView
                copy={copy}
                policies={policies}
                selectedPolicyId={selectedPolicyId}
                selectedPolicy={selectedPolicy}
                providers={providers}
                commandReady={commandReady}
                editPolicyReady={editPolicyReady}
                editPolicyDisabledReason={editPolicyDisabledReason}
                onSelectPolicy={onSelectPolicy}
                onEditPolicy={onEditPolicy}
              />
            ) : null}
            {view === 'calendar' ? (
              <CalendarView
                copy={copy}
                calendars={calendars}
                selectedCalendarId={selectedCalendarId}
                selectedCalendar={selectedCalendar}
                escalationSteps={escalationSteps}
                simulationReady={commandReady && simulationReady}
                simulationDisabledReason={simulationDisabledReason}
                onSelectCalendar={onSelectCalendar}
                onRunSimulation={onRunSimulation}
              />
            ) : null}
            {view === 'delivery' ? (
              <DeliveryView
                copy={copy}
                providers={providers}
                deliveryPreview={deliveryPreview}
                escalationSteps={escalationSteps}
                simulationReady={commandReady && simulationReady}
                simulationDisabledReason={simulationDisabledReason}
                onRunSimulation={onRunSimulation}
              />
            ) : null}
            {view === 'delegation' ? (
              <DelegationView
                copy={copy}
                delegations={delegations}
                delegationReviewReady={delegationReviewReady}
                delegationReviewDisabledReason={delegationReviewDisabledReason}
                onReviewDelegation={onReviewDelegation}
              />
            ) : null}
          </Box>
        </AdminV2InspectorPaper>
      </AdminV2StateBoundary>
    </AdminV2WorkspaceFrame>
  );
}
