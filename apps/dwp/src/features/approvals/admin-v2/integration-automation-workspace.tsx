import { Activity, Cable, FlaskConical, RefreshCw, Rocket, ShieldAlert } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
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

export type IntegrationAutomationView = 'catalog' | 'mapping' | 'health';

export type ApprovalConnectorProbe = {
  id: string;
  title: string;
  detail: string;
  meta?: string;
  status: AdminV2Status;
};

export type ApprovalConnectorMapping = {
  id: string;
  source: string;
  target: string;
  transformation: string;
  status: AdminV2Status;
};

export type ApprovalConnectorRecord = {
  id: string;
  name: string;
  summary: string;
  typeLabel: string;
  lifecycle: AdminV2Status;
  versionLabel: string;
  updatedLabel: string;
  facts: readonly AdminV2Fact[];
  mappings: readonly ApprovalConnectorMapping[];
  probes: readonly ApprovalConnectorProbe[];
  probeReady: boolean;
  publishReady: boolean;
  probeDisabledReason?: string;
  publishDisabledReason?: string;
};

export type IntegrationAutomationCopy = {
  header: AdminV2WorkspaceHeader;
  state: AdminV2StateCopy;
  navigationLabel: string;
  catalogTab: string;
  mappingTab: string;
  healthTab: string;
  catalogTitle: string;
  catalogDescription: string;
  detailTitle: string;
  detailDescription: string;
  mappingTitle: string;
  mappingDescription: string;
  fieldLabel: string;
  sourceLabel: string;
  targetLabel: string;
  transformLabel: string;
  statusLabel: string;
  probesTitle: string;
  probesDescription: string;
  noSelectionLabel: string;
  refreshLabel: string;
  probeLabel: string;
  publishLabel: string;
  mobilePublishLabel: string;
  mobilePublishReason: string;
  staleEvidenceTitle: string;
  staleEvidenceDescription: string;
  secretsTitle: string;
  secretsDescription: string;
};

export type IntegrationAutomationWorkspaceProps = {
  state: AdminV2SourceState;
  copy: IntegrationAutomationCopy;
  metrics: readonly AdminV2Metric[];
  view: IntegrationAutomationView;
  connectors: readonly ApprovalConnectorRecord[];
  selectedConnectorId: string | null;
  actionDeck?: AdminV2WorkspaceActionDeck;
  onViewChange: (view: IntegrationAutomationView) => void;
  onSelectConnector: (connectorId: string) => void;
  onRefresh: () => void;
  onProbe: (connectorId: string) => void;
  onPublish: (connectorId: string) => void;
  onRetry?: () => void;
  onResolveConflict?: () => void;
};

export function IntegrationAutomationWorkspace({
  state,
  copy,
  metrics,
  view,
  connectors,
  selectedConnectorId,
  actionDeck,
  onViewChange,
  onSelectConnector,
  onRefresh,
  onProbe,
  onPublish,
  onRetry,
  onResolveConflict,
}: IntegrationAutomationWorkspaceProps) {
  const selected = connectors.find((connector) => connector.id === selectedConnectorId) ?? null;
  const latestProbe = selected?.probes[0] ?? null;
  const verified = latestProbe?.status.tone === 'success';

  return (
    <AdminV2WorkspaceFrame
      header={copy.header}
      icon={Cable}
      primaryAction={
        <ActionButton intent="secondary" startIcon={<RefreshCw size={16} />} onClick={onRefresh}>
          {copy.refreshLabel}
        </ActionButton>
      }
    >
      <AdminV2StateBoundary
        state={state}
        copy={copy.state}
        actions={{ onRetry, onResolveConflict }}
      >
        <AdminV2MetricStrip metrics={metrics} />
        {actionDeck ? <ApprovalAdminV2ActionDeck state={state} deck={actionDeck} /> : null}
        <AdminV2ViewTabs
          label={copy.navigationLabel}
          value={view}
          onChange={onViewChange}
          options={[
            { value: 'catalog', label: copy.catalogTab, count: connectors.length },
            {
              value: 'mapping',
              label: copy.mappingTab,
              count: selected?.mappings.length ?? 0,
            },
            { value: 'health', label: copy.healthTab, count: selected?.probes.length ?? 0 },
          ]}
        />

        {view === 'catalog' ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0,1fr)',
                lg: 'minmax(280px,.8fr) minmax(0,1.4fr)',
              },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <AdminV2InspectorPaper>
              <AdminV2Section
                title={copy.catalogTitle}
                description={copy.catalogDescription}
                labelledBy="approval-integration-catalog"
              >
                <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                  {connectors.map((connector) => (
                    <Box component="li" key={connector.id}>
                      <AdminV2RecordButton
                        selected={connector.id === selectedConnectorId}
                        title={connector.name}
                        description={connector.summary}
                        meta={`${connector.typeLabel} · ${connector.versionLabel} · ${connector.updatedLabel}`}
                        status={connector.lifecycle}
                        onClick={() => onSelectConnector(connector.id)}
                      />
                    </Box>
                  ))}
                </Box>
              </AdminV2Section>
            </AdminV2InspectorPaper>

            <AdminV2InspectorPaper>
              <AdminV2Section
                title={selected?.name ?? copy.detailTitle}
                description={selected?.summary ?? copy.detailDescription}
                labelledBy="approval-integration-detail"
                action={selected ? <AdminV2StatusPill status={selected.lifecycle} /> : undefined}
              >
                {selected ? (
                  <Stack gap={0}>
                    <AdminV2FactGrid facts={selected.facts} />
                    <Box sx={{ px: 1.5, py: 1.25 }}>
                      <InlineFeedback
                        severity="info"
                        title={copy.secretsTitle}
                        icon={<ShieldAlert size={18} />}
                      >
                        {copy.secretsDescription}
                      </InlineFeedback>
                    </Box>
                    {!verified ? (
                      <Box sx={{ px: 1.5, pb: 1.25 }}>
                        <InlineFeedback severity="warning" title={copy.staleEvidenceTitle}>
                          {copy.staleEvidenceDescription}
                        </InlineFeedback>
                      </Box>
                    ) : null}
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      gap={1}
                      sx={{ px: 1.5, py: 1.25, borderBlockStart: 1, borderColor: 'divider' }}
                    >
                      <ActionButton
                        intent="secondary"
                        startIcon={<FlaskConical size={16} />}
                        disabled={!selected.probeReady || state !== 'ready'}
                        onClick={() => onProbe(selected.id)}
                      >
                        {copy.probeLabel}
                      </ActionButton>
                      {!selected.probeReady && selected.probeDisabledReason ? (
                        <Typography variant="caption" color="text.secondary">
                          {selected.probeDisabledReason}
                        </Typography>
                      ) : null}
                      <AdminV2GovernedAction
                        desktopLabel={copy.publishLabel}
                        mobileLabel={copy.mobilePublishLabel}
                        mobileReason={copy.mobilePublishReason}
                        disabled={!selected.publishReady || !verified || state !== 'ready'}
                        disabledReason={selected.publishDisabledReason}
                        onAction={() => onPublish(selected.id)}
                        icon={<Rocket size={16} />}
                      />
                    </Stack>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                    {copy.noSelectionLabel}
                  </Typography>
                )}
              </AdminV2Section>
            </AdminV2InspectorPaper>
          </Box>
        ) : null}

        {view === 'mapping' ? (
          <AdminV2InspectorPaper>
            <AdminV2Section
              title={copy.mappingTitle}
              description={copy.mappingDescription}
              labelledBy="approval-integration-mapping"
            >
              {selected ? (
                <Box sx={{ overflowX: 'auto' }}>
                  <Box
                    component="table"
                    sx={{ width: 1, minWidth: 720, borderCollapse: 'collapse' }}
                  >
                    <Box component="thead" sx={{ bgcolor: 'action.hover' }}>
                      <Box component="tr">
                        {[
                          ['field', copy.fieldLabel],
                          ['source', copy.sourceLabel],
                          ['target', copy.targetLabel],
                          ['transform', copy.transformLabel],
                          ['status', copy.statusLabel],
                        ].map(([key, label]) => (
                          <Box
                            component="th"
                            key={key}
                            sx={{
                              p: 1.25,
                              textAlign: 'start',
                              borderBlockEnd: 1,
                              borderColor: 'divider',
                            }}
                          >
                            <Typography variant="caption" fontWeight="fontWeightBold">
                              {label}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {selected.mappings.map((mapping) => (
                        <Box component="tr" key={mapping.id}>
                          {[
                            ['field', mapping.id],
                            ['source', mapping.source],
                            ['target', mapping.target],
                            ['transform', mapping.transformation],
                          ].map(([key, value]) => (
                            <Box
                              component="td"
                              key={key}
                              sx={{ p: 1.25, borderBlockEnd: 1, borderColor: 'divider' }}
                            >
                              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                                {value}
                              </Typography>
                            </Box>
                          ))}
                          <Box
                            component="td"
                            sx={{ p: 1.25, borderBlockEnd: 1, borderColor: 'divider' }}
                          >
                            <AdminV2StatusPill status={mapping.status} />
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  {copy.noSelectionLabel}
                </Typography>
              )}
            </AdminV2Section>
          </AdminV2InspectorPaper>
        ) : null}

        {view === 'health' ? (
          <AdminV2InspectorPaper>
            <AdminV2Section
              title={copy.probesTitle}
              description={copy.probesDescription}
              labelledBy="approval-integration-health"
              action={<Activity size={18} aria-hidden="true" />}
            >
              {selected ? (
                <AdminV2Timeline items={selected.probes} />
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  {copy.noSelectionLabel}
                </Typography>
              )}
            </AdminV2Section>
          </AdminV2InspectorPaper>
        ) : null}
      </AdminV2StateBoundary>
    </AdminV2WorkspaceFrame>
  );
}
