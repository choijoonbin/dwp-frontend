import {
  Download,
  Fingerprint,
  History,
  RefreshCcw,
  Scale,
  SearchCheck,
  ShieldCheck,
} from 'lucide-react';
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

export type AuditRecordsView = 'explorer' | 'evidence' | 'retention';

export type ApprovalAuditEvent = {
  id: string;
  title: string;
  description: string;
  eventTimeLabel: string;
  actorLabel: string;
  targetLabel: string;
  correlationLabel: string;
  classificationLabel: string;
  status: AdminV2Status;
  integrityStatus: AdminV2Status;
};

export type ApprovalEvidenceBundle = {
  eventId: string;
  requestId: string;
  bundleId: string;
  title: string;
  description: string;
  generatedAtLabel: string;
  sourceRevisionLabel: string;
  integrityStatus: AdminV2Status;
  archiveStatus: AdminV2Status;
  integrityStatement: string;
  facts: readonly AdminV2Fact[];
  timeline: readonly {
    id: string;
    title: string;
    detail: string;
    meta?: string;
    status: AdminV2Status;
  }[];
  manifests: readonly {
    id: string;
    name: string;
    digestLabel: string;
    sourceLabel: string;
    status: AdminV2Status;
  }[];
};

export type ApprovalRetentionRecord = {
  id: string;
  title: string;
  description: string;
  retainUntilLabel: string;
  legalHoldLabel: string;
  purgeStageLabel: string;
  foreignCopyLabel: string;
  status: AdminV2Status;
  evidenceStatus: AdminV2Status;
  facts: readonly AdminV2Fact[];
};

export type AuditRecordsCopy = {
  header: AdminV2WorkspaceHeader;
  state: AdminV2StateCopy;
  navigationLabel: string;
  explorerTab: string;
  evidenceTab: string;
  retentionTab: string;
  explorerTitle: string;
  explorerDescription: string;
  eventDetailTitle: string;
  eventDetailDescription: string;
  evidenceTitle: string;
  evidenceDescription: string;
  timelineTitle: string;
  manifestsTitle: string;
  manifestsDescription: string;
  retentionTitle: string;
  retentionDescription: string;
  noSelectionLabel: string;
  refreshLabel: string;
  verifyLabel: string;
  prepareExportLabel: string;
  mobileExportLabel: string;
  mobileExportReason: string;
  requestHoldReviewLabel: string;
  mobileHoldLabel: string;
  mobileHoldReason: string;
  truthTitle: string;
  truthDescription: string;
};

export type AuditRecordsEvidenceWorkspaceProps = {
  state: AdminV2SourceState;
  copy: AuditRecordsCopy;
  metrics: readonly AdminV2Metric[];
  view: AuditRecordsView;
  events: readonly ApprovalAuditEvent[];
  selectedEventId: string | null;
  evidenceBundle: ApprovalEvidenceBundle | null;
  retentionRecords: readonly ApprovalRetentionRecord[];
  onViewChange: (view: AuditRecordsView) => void;
  onSelectEvent: (eventId: string) => void;
  onRefresh: () => void;
  onVerifyEvidence: (bundleId: string) => void;
  onPrepareExport: (bundleId: string) => void;
  onRequestHoldReview: (recordId: string) => void;
  exportReady: boolean;
  exportDisabledReason?: string;
  holdReviewReady: boolean;
  holdReviewDisabledReason?: string;
  actionDeck?: AdminV2WorkspaceActionDeck;
  onRetry?: () => void;
  onResolveConflict?: () => void;
};

function EventExplorer({
  copy,
  events,
  selectedEventId,
  selectedEvent,
  onSelectEvent,
  onRefresh,
}: Pick<
  AuditRecordsEvidenceWorkspaceProps,
  'copy' | 'events' | 'selectedEventId' | 'onSelectEvent' | 'onRefresh'
> & { selectedEvent: ApprovalAuditEvent | null }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(310px,.9fr) minmax(0,1.4fr)' },
        gap: { xs: 1.5, lg: 2 },
        alignItems: 'start',
      }}
    >
      <AdminV2InspectorPaper>
        <AdminV2Section
          title={copy.explorerTitle}
          description={copy.explorerDescription}
          labelledBy="admin-v2-audit-explorer"
          action={
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<RefreshCcw size={15} />}
              onClick={onRefresh}
            >
              {copy.refreshLabel}
            </ActionButton>
          }
        >
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {events.map((event) => (
              <Box component="li" key={event.id}>
                <AdminV2RecordButton
                  selected={event.id === selectedEventId}
                  title={event.title}
                  description={event.description}
                  meta={`${event.eventTimeLabel} · ${event.actorLabel} · ${event.classificationLabel}`}
                  status={event.status}
                  onClick={() => onSelectEvent(event.id)}
                />
              </Box>
            ))}
          </Box>
        </AdminV2Section>
      </AdminV2InspectorPaper>

      <AdminV2InspectorPaper>
        <AdminV2Section
          title={selectedEvent?.title ?? copy.eventDetailTitle}
          description={selectedEvent?.description ?? copy.eventDetailDescription}
          labelledBy="admin-v2-audit-event-detail"
          action={
            selectedEvent ? <AdminV2StatusPill status={selectedEvent.integrityStatus} /> : undefined
          }
        >
          {selectedEvent ? (
            <AdminV2FactGrid
              facts={[
                {
                  id: 'actor',
                  label: selectedEvent.actorLabel,
                  value: selectedEvent.eventTimeLabel,
                },
                {
                  id: 'target',
                  label: selectedEvent.targetLabel,
                  value: selectedEvent.correlationLabel,
                },
                {
                  id: 'classification',
                  label: selectedEvent.classificationLabel,
                  value: selectedEvent.status.label,
                  tone: selectedEvent.status.tone,
                },
              ]}
            />
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

function EvidenceView({
  copy,
  evidenceBundle,
  exportReady,
  exportDisabledReason,
  onVerifyEvidence,
  onPrepareExport,
}: Pick<
  AuditRecordsEvidenceWorkspaceProps,
  | 'copy'
  | 'evidenceBundle'
  | 'exportReady'
  | 'exportDisabledReason'
  | 'onVerifyEvidence'
  | 'onPrepareExport'
>) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,1.4fr) minmax(300px,.6fr)' },
        gap: { xs: 1.5, lg: 2 },
        alignItems: 'start',
      }}
    >
      <AdminV2InspectorPaper>
        <AdminV2Section
          title={copy.evidenceTitle}
          description={copy.evidenceDescription}
          labelledBy="admin-v2-audit-evidence"
          action={
            evidenceBundle ? (
              <AdminV2StatusPill status={evidenceBundle.integrityStatus} />
            ) : undefined
          }
        >
          {evidenceBundle ? (
            <>
              <Box sx={{ px: 1.5, pt: 1.5 }}>
                <Typography variant="subtitle2" fontWeight="fontWeightBold">
                  {evidenceBundle.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {evidenceBundle.description}
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, borderBlockEnd: 1, borderColor: 'divider' }}>
                <InlineFeedback
                  severity={
                    evidenceBundle.integrityStatus.tone === 'success' ? 'success' : 'warning'
                  }
                  title={copy.truthTitle}
                >
                  {evidenceBundle.integrityStatement}
                </InlineFeedback>
              </Box>
              <AdminV2FactGrid facts={evidenceBundle.facts} />
              <Box sx={{ px: 1.5, py: 1.25, borderBlock: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight="fontWeightBold">
                  {copy.timelineTitle}
                </Typography>
              </Box>
              <AdminV2Timeline items={evidenceBundle.timeline} />
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="flex-end"
                gap={1}
                sx={{ p: 1.5, borderBlockStart: 1, borderColor: 'divider' }}
              >
                <ActionButton
                  intent="secondary"
                  startIcon={<SearchCheck size={16} />}
                  onClick={() => onVerifyEvidence(evidenceBundle.bundleId)}
                >
                  {copy.verifyLabel}
                </ActionButton>
                <AdminV2GovernedAction
                  desktopLabel={copy.prepareExportLabel}
                  mobileLabel={copy.mobileExportLabel}
                  mobileReason={copy.mobileExportReason}
                  disabled={!exportReady}
                  disabledReason={exportDisabledReason}
                  onAction={() => onPrepareExport(evidenceBundle.bundleId)}
                  icon={<Download size={16} />}
                />
              </Stack>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {copy.evidenceDescription}
            </Typography>
          )}
        </AdminV2Section>
      </AdminV2InspectorPaper>

      <AdminV2InspectorPaper>
        <AdminV2Section
          title={copy.manifestsTitle}
          description={copy.manifestsDescription}
          labelledBy="admin-v2-audit-manifests"
        >
          <Stack divider={<Divider flexItem />}>
            {evidenceBundle?.manifests.map((manifest) => (
              <Stack key={manifest.id} direction="row" gap={1} sx={{ p: 1.25 }}>
                <Fingerprint size={17} aria-hidden="true" />
                <Box minWidth={0} flex={1}>
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    {manifest.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {manifest.digestLabel} · {manifest.sourceLabel}
                  </Typography>
                </Box>
                <AdminV2StatusPill status={manifest.status} />
              </Stack>
            ))}
          </Stack>
          {evidenceBundle ? (
            <Box sx={{ p: 1.25, borderBlockStart: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                {evidenceBundle.sourceRevisionLabel} · {evidenceBundle.generatedAtLabel}
              </Typography>
            </Box>
          ) : null}
        </AdminV2Section>
      </AdminV2InspectorPaper>
    </Box>
  );
}

function RetentionView({
  copy,
  records,
  commandReady,
  disabledReason,
  onRequestHoldReview,
}: {
  copy: AuditRecordsCopy;
  records: readonly ApprovalRetentionRecord[];
  commandReady: boolean;
  disabledReason?: string;
  onRequestHoldReview: (recordId: string) => void;
}) {
  return (
    <AdminV2InspectorPaper>
      <AdminV2Section
        title={copy.retentionTitle}
        description={copy.retentionDescription}
        labelledBy="admin-v2-audit-retention"
      >
        <Stack divider={<Divider flexItem />}>
          {records.map((record) => (
            <Box key={record.id} sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                <Box minWidth={0}>
                  <Typography variant="subtitle2" fontWeight="fontWeightBold">
                    {record.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {record.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {record.retainUntilLabel} · {record.legalHoldLabel} · {record.purgeStageLabel}
                  </Typography>
                </Box>
                <Stack direction="row" gap={0.75} flexWrap="wrap">
                  <AdminV2StatusPill status={record.status} />
                  <AdminV2StatusPill status={record.evidenceStatus} />
                </Stack>
              </Stack>
              <Box
                sx={{
                  mt: 1.25,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 1.5}px`,
                }}
              >
                <AdminV2FactGrid facts={record.facts} />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {record.foreignCopyLabel}
              </Typography>
              <Box sx={{ mt: 1.25 }}>
                <AdminV2GovernedAction
                  desktopLabel={copy.requestHoldReviewLabel}
                  mobileLabel={copy.mobileHoldLabel}
                  mobileReason={copy.mobileHoldReason}
                  disabled={!commandReady}
                  disabledReason={disabledReason}
                  onAction={() => onRequestHoldReview(record.id)}
                  icon={<Scale size={16} />}
                />
              </Box>
            </Box>
          ))}
        </Stack>
      </AdminV2Section>
    </AdminV2InspectorPaper>
  );
}

export function AuditRecordsEvidenceWorkspace({
  state,
  copy,
  metrics,
  view,
  events,
  selectedEventId,
  evidenceBundle,
  retentionRecords,
  onViewChange,
  onSelectEvent,
  onRefresh,
  onVerifyEvidence,
  onPrepareExport,
  onRequestHoldReview,
  onRetry,
  onResolveConflict,
  exportReady,
  exportDisabledReason,
  holdReviewReady,
  holdReviewDisabledReason,
  actionDeck,
}: AuditRecordsEvidenceWorkspaceProps) {
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const selectedEvidenceBundle =
    evidenceBundle?.eventId === selectedEventId ? evidenceBundle : null;
  const commandReady = state === 'ready';

  return (
    <AdminV2WorkspaceFrame
      header={copy.header}
      icon={History}
      primaryAction={
        <ActionButton intent="secondary" startIcon={<RefreshCcw size={16} />} onClick={onRefresh}>
          {copy.refreshLabel}
        </ActionButton>
      }
    >
      <AdminV2StateBoundary
        state={state}
        copy={copy.state}
        actions={{ onRetry, onResolveConflict }}
      >
        <InlineFeedback severity="info" title={copy.truthTitle} icon={<ShieldCheck size={18} />}>
          {copy.truthDescription}
        </InlineFeedback>
        <AdminV2MetricStrip metrics={metrics} />
        {actionDeck ? <ApprovalAdminV2ActionDeck state={state} deck={actionDeck} /> : null}
        <AdminV2InspectorPaper>
          <AdminV2ViewTabs
            label={copy.navigationLabel}
            value={view}
            options={[
              { value: 'explorer', label: copy.explorerTab, count: events.length },
              { value: 'evidence', label: copy.evidenceTab, count: selectedEvidenceBundle ? 1 : 0 },
              { value: 'retention', label: copy.retentionTab, count: retentionRecords.length },
            ]}
            onChange={onViewChange}
          />
          <Box sx={{ p: { xs: 1.25, sm: 1.75 } }}>
            {view === 'explorer' ? (
              <EventExplorer
                copy={copy}
                events={events}
                selectedEventId={selectedEventId}
                selectedEvent={selectedEvent}
                onSelectEvent={onSelectEvent}
                onRefresh={onRefresh}
              />
            ) : null}
            {view === 'evidence' ? (
              <EvidenceView
                copy={copy}
                evidenceBundle={selectedEvidenceBundle}
                exportReady={commandReady && Boolean(selectedEvidenceBundle) && exportReady}
                exportDisabledReason={exportDisabledReason}
                onVerifyEvidence={onVerifyEvidence}
                onPrepareExport={onPrepareExport}
              />
            ) : null}
            {view === 'retention' ? (
              <RetentionView
                copy={copy}
                records={retentionRecords}
                commandReady={commandReady && holdReviewReady}
                disabledReason={holdReviewDisabledReason}
                onRequestHoldReview={onRequestHoldReview}
              />
            ) : null}
          </Box>
        </AdminV2InspectorPaper>
      </AdminV2StateBoundary>
    </AdminV2WorkspaceFrame>
  );
}
