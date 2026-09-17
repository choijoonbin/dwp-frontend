import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, FileClock, History, ScanLine, ShieldCheck } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import {
  buildMailGovernancePolicyViews,
  mailGovernanceEvidenceCounts,
  mailGovernanceRowsForDomain,
} from './mail-admin-operations-a04-model';
import { EvidenceChip, FormattedTime, Section, StateChip } from './mail-admin-operations-ui-shared';

import type { MailAdminOverview } from '@dwp-frontend/shared-utils';
import type {
  MailGovernancePolicyView,
  MailGovernanceTab,
} from './mail-admin-operations-a04-model';
import type { MailPolicyGovernance, MailPolicyHistoryItem } from './mail-admin-operations-model';

const TAB_IDS: readonly MailGovernanceTab[] = ['content', 'ai', 'evidence', 'history'];
const READ_ONLY_STATE = 'READ_ONLY';

const POLICY_LABELS: Readonly<Record<string, string>> = {
  externalSenderBanner: 'External sender banner',
  blockRemoteImages: 'Remote image blocking',
  allowSharedInboxes: 'Shared inbox availability',
  maximumAttachmentMb: 'Maximum attachment size',
  retentionDays: 'Retention policy reference',
  allowedAttachmentTypes: 'Allowed attachment types',
  attachmentInspectionReadiness: 'Malware inspection readiness',
  dlpReadiness: 'DLP inspection readiness',
  aiAssistanceEnabled: 'AI assistance',
  aiCrossAppActionsEnabled: 'Cross-app AI actions',
  aiAutoExecuteEnabled: 'Automatic AI execution',
  aiContentGeneration: 'AI content generation',
  aiTargetApplications: 'Target applications',
  aiDataScopes: 'Permitted data scopes',
  aiExternalTransfer: 'External data transfer',
  aiReviewRequirement: 'Human review requirement',
};

const POLICY_DESCRIPTIONS: Readonly<Record<string, string>> = {
  externalSenderBanner: 'Marks messages reported as external without claiming client enforcement.',
  blockRemoteImages: 'Controls remote content loading in the Mail reader.',
  allowSharedInboxes: 'Controls whether shared inbox workflows are available.',
  maximumAttachmentMb: 'Saved upload limit; inspection readiness is evaluated separately.',
  retentionDays: 'Reference only. Effective retention, legal holds, and purge are managed in A05.',
  allowedAttachmentTypes: 'The server must provide the allowed and blocked attachment type policy.',
  attachmentInspectionReadiness:
    'Requires current scanner health, result semantics, and an enforcement source.',
  dlpReadiness: 'Requires current DLP policy, inspection coverage, and enforcement evidence.',
  aiAssistanceEnabled: 'Controls AI assistance without implying generation or action authority.',
  aiCrossAppActionsEnabled: 'Controls cross-app actions; target scope and review remain separate.',
  aiAutoExecuteEnabled: 'Automatic execution remains blocked unless effective evidence proves it.',
  aiContentGeneration: 'Generation authority must be distinct from general AI assistance.',
  aiTargetApplications: 'The exact applications an AI action may reach must be projected.',
  aiDataScopes: 'Permitted Mail and cross-app data categories must be projected.',
  aiExternalTransfer: 'External model or processor transfer status requires explicit evidence.',
  aiReviewRequirement:
    'Review and approval requirements must be effective policy, not model confidence.',
};

function formatPolicyValue(
  value: string | null | undefined,
  labels: { unavailable: string; on: string; off: string }
) {
  if (value == null || value.trim() === '') return labels.unavailable;
  if (value.toLowerCase() === 'true') return labels.on;
  if (value.toLowerCase() === 'false') return labels.off;
  return value;
}

function PolicyValue({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {value ? (
        <Typography
          variant="body2"
          fontWeight="fontWeightBold"
          sx={{ mt: 0.25, overflowWrap: 'anywhere' }}
        >
          {value}
        </Typography>
      ) : null}
      {children}
    </Box>
  );
}

function GovernancePolicyRow({ row }: { row: MailGovernancePolicyView }) {
  const { t } = useTranslation('mail');
  const unavailable = t('admin.operationsWorkspace.a04.unavailableValue', {
    defaultValue: 'Unavailable',
  });
  const valueLabels = {
    unavailable,
    on: t('admin.operationsWorkspace.a04.on', { defaultValue: 'On' }),
    off: t('admin.operationsWorkspace.a04.off', { defaultValue: 'Off' }),
  };
  const title = t(`admin.operationsWorkspace.a04.policy.${row.policyKey}`, {
    defaultValue: POLICY_LABELS[row.policyKey] ?? row.policyKey,
  });
  const description = t(`admin.operationsWorkspace.a04.policyDescription.${row.policyKey}`, {
    defaultValue: POLICY_DESCRIPTIONS[row.policyKey] ?? '',
  });

  return (
    <Box sx={{ px: { xs: 1.75, sm: 2.25 }, py: 2 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 1.25, md: 2 }}
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
      >
        <Box sx={{ flex: '1 1 32%', minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" fontWeight="fontWeightBold">
              {title}
            </Typography>
            {row.missingContract ? (
              <Chip
                size="small"
                variant="outlined"
                label={t('admin.operationsWorkspace.a04.contractMissing', {
                  defaultValue: 'Evidence unavailable',
                })}
              />
            ) : null}
          </Stack>
          {description ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4 }}>
              {description}
            </Typography>
          ) : null}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.8 }}>
            {t('admin.operationsWorkspace.a04.scope', {
              defaultValue: 'Scope: {{scope}}',
              scope: row.scope || unavailable,
            })}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
            {t('admin.operationsWorkspace.a04.applicabilityUnavailable', {
              defaultValue:
                'Authoritative inheritance, lock source, and policy exception evidence is unavailable.',
            })}
          </Typography>
        </Box>
        <Box
          sx={{
            flex: '1 1 68%',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: { xs: 1.25, sm: 2 },
            minWidth: 0,
          }}
        >
          <PolicyValue
            label={t('admin.operationsWorkspace.a04.configured', {
              defaultValue: 'Configured value',
            })}
            value={formatPolicyValue(row.configuredValue, valueLabels)}
          />
          <PolicyValue
            label={t('admin.operationsWorkspace.a04.effectiveValueLabel', {
              defaultValue: 'Effective value',
            })}
            value={formatPolicyValue(row.effectiveValue, valueLabels)}
          >
            <Box sx={{ mt: 0.65 }}>
              <StateChip label={row.effectiveState} />
            </Box>
          </PolicyValue>
          <PolicyValue
            label={t('admin.operationsWorkspace.a04.evidenceLabel', {
              defaultValue: 'Enforcement evidence',
            })}
            value={row.evidenceSource || unavailable}
          >
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ mt: 0.65 }}
            >
              <EvidenceChip state={row.evidenceState} />
              <Typography variant="caption" color="text.secondary">
                <FormattedTime value={row.evidenceAt} />
              </Typography>
            </Stack>
          </PolicyValue>
        </Box>
      </Stack>
      {row.errorCode ? (
        <Typography
          variant="caption"
          color={row.missingContract ? 'text.secondary' : 'warning.main'}
          sx={{ display: 'block', mt: 1, overflowWrap: 'anywhere' }}
        >
          {t('admin.operationsWorkspace.a04.evidenceCode', {
            defaultValue: 'Evidence status: {{code}}',
            code: row.errorCode,
          })}
        </Typography>
      ) : null}
    </Box>
  );
}

function PolicyList({ rows }: { rows: readonly MailGovernancePolicyView[] }) {
  return (
    <Box>
      {rows.map((row, index) => (
        <Box key={row.id}>
          {index > 0 ? <Divider /> : null}
          <GovernancePolicyRow row={row} />
        </Box>
      ))}
    </Box>
  );
}

function DomainPanel({
  id,
  title,
  description,
  unavailableMessage,
  rows,
}: {
  id: MailGovernanceTab;
  title: string;
  description: string;
  unavailableMessage: string;
  rows: readonly MailGovernancePolicyView[];
}) {
  return (
    <Box
      role="tabpanel"
      id={`mail-governance-panel-${id}`}
      aria-labelledby={`mail-governance-tab-${id}`}
    >
      <Box sx={{ px: { xs: 1.75, sm: 2.25 }, pt: 2, pb: 1 }}>
        <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {description}
        </Typography>
        <Box sx={{ mt: 1.5 }}>
          <InlineFeedback severity="warning">{unavailableMessage}</InlineFeedback>
        </Box>
      </Box>
      <PolicyList rows={rows} />
    </Box>
  );
}

function EvidencePanel({ rows }: { rows: readonly MailGovernancePolicyView[] }) {
  const { t } = useTranslation('mail');
  const counts = mailGovernanceEvidenceCounts(rows);
  return (
    <Box
      role="tabpanel"
      id="mail-governance-panel-evidence"
      aria-labelledby="mail-governance-tab-evidence"
    >
      <Box sx={{ px: { xs: 1.75, sm: 2.25 }, py: 2 }}>
        <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
          {t('admin.operationsWorkspace.a04.evidenceTitle', {
            defaultValue: 'Effective policy evidence',
          })}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {t('admin.operationsWorkspace.a04.evidenceDescription', {
            defaultValue:
              'Counts show evidence availability, not a security score. Review each source and timestamp.',
          })}
        </Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
          <Chip
            size="small"
            color="success"
            variant="outlined"
            label={t('admin.operationsWorkspace.a04.verifiedCount', {
              defaultValue: '{{count}} verified',
              count: counts.VERIFIED,
            })}
          />
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            label={t('admin.operationsWorkspace.a04.partialCount', {
              defaultValue: '{{count}} partial or reported',
              count: counts.PARTIAL + counts.REPORTED + counts.STALE,
            })}
          />
          <Chip
            size="small"
            variant="outlined"
            label={t('admin.operationsWorkspace.a04.unavailableCount', {
              defaultValue: '{{count}} unavailable',
              count: counts.UNAVAILABLE,
            })}
          />
        </Stack>
        <Box sx={{ mt: 1.5 }}>
          <InlineFeedback severity="warning">
            {t('admin.operationsWorkspace.a04.controlEvidenceUnavailable', {
              defaultValue:
                'Authoritative inheritance, lock, exception, approval, and recovery evidence is unavailable.',
            })}
          </InlineFeedback>
        </Box>
      </Box>
      <Divider />
      <PolicyList rows={rows} />
    </Box>
  );
}

function HistoryPanel({ history }: { history: readonly MailPolicyHistoryItem[] }) {
  const { t } = useTranslation('mail');
  const unavailable = t('admin.operationsWorkspace.a04.unavailableValue', {
    defaultValue: 'Unavailable',
  });
  return (
    <Box
      role="tabpanel"
      id="mail-governance-panel-history"
      aria-labelledby="mail-governance-tab-history"
    >
      <Box sx={{ px: { xs: 1.75, sm: 2.25 }, py: 2 }}>
        <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
          {t('admin.operationsWorkspace.a04.history', {
            defaultValue: 'Policy change history',
          })}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {t('admin.operationsWorkspace.a04.historyDescription', {
            defaultValue:
              'Versioned changes keep actor, approval, application, failure, and recovery evidence separate.',
          })}
        </Typography>
      </Box>
      <Divider />
      {history.length ? (
        history.map((item, index) => (
          <Box key={item.historyId}>
            {index > 0 ? <Divider /> : null}
            <Box sx={{ px: { xs: 1.75, sm: 2.25 }, py: 2 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.25}
                alignItems={{ xs: 'stretch', sm: 'flex-start' }}
              >
                <History size={18} aria-hidden="true" />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    {t('admin.operationsWorkspace.a04.versionLabel', {
                      defaultValue: 'Version {{version}}',
                      version: item.version,
                    })}{' '}
                    · {item.diffSummary}
                  </Typography>
                  <Box
                    component="dl"
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                      columnGap: 2,
                      rowGap: 0.8,
                      m: 0,
                      mt: 1.25,
                    }}
                  >
                    <PolicyValue
                      label={t('admin.operationsWorkspace.a04.actor', {
                        defaultValue: 'Requester / actor projection',
                      })}
                      value={item.changedBy}
                    />
                    <PolicyValue
                      label={t('admin.operationsWorkspace.a04.approver', {
                        defaultValue: 'Approver',
                      })}
                      value={unavailable}
                    />
                    <PolicyValue
                      label={t('admin.operationsWorkspace.a04.changedAt', {
                        defaultValue: 'Changed at',
                      })}
                    >
                      <Typography variant="body2" fontWeight="fontWeightBold" sx={{ mt: 0.25 }}>
                        <FormattedTime value={item.changedAt} />
                      </Typography>
                    </PolicyValue>
                    <PolicyValue
                      label={t('admin.operationsWorkspace.a04.recoveryEvidence', {
                        defaultValue: 'Recovery evidence',
                      })}
                      value={unavailable}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1, overflowWrap: 'anywhere' }}
                  >
                    {t('admin.operationsWorkspace.a04.correlation', {
                      defaultValue: 'Correlation: {{value}}',
                      value: item.correlationId || '—',
                    })}
                  </Typography>
                  {item.result === 'FAILED' || item.result === 'PARTIAL' ? (
                    <Typography
                      variant="caption"
                      color="warning.main"
                      sx={{ display: 'block', mt: 0.5 }}
                    >
                      {t('admin.operationsWorkspace.a04.recoveryUnavailable', {
                        defaultValue:
                          'This result is not presented as recovered because no recovery evidence was provided.',
                      })}
                    </Typography>
                  ) : null}
                </Box>
                <StateChip label={item.result} />
              </Stack>
            </Box>
          </Box>
        ))
      ) : (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('admin.operationsWorkspace.a04.noHistory', {
              defaultValue: 'No policy history was returned.',
            })}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export function GovernanceSurface({
  overview,
  governance,
  canManage,
  onOpenSettings,
}: {
  overview: MailAdminOverview;
  governance?: MailPolicyGovernance;
  canManage: boolean;
  onOpenSettings?: () => void;
}) {
  const { t } = useTranslation('mail');
  const [tab, setTab] = useState<MailGovernanceTab>('content');
  const rows = useMemo(
    () => buildMailGovernancePolicyViews(overview, governance),
    [governance, overview]
  );
  const contentRows = useMemo(() => mailGovernanceRowsForDomain(rows, 'CONTENT'), [rows]);
  const aiRows = useMemo(() => mailGovernanceRowsForDomain(rows, 'AI'), [rows]);

  const tabLabels: Record<MailGovernanceTab, string> = {
    content: t('admin.operationsWorkspace.a04.tabs.content', {
      defaultValue: 'Content security',
    }),
    ai: t('admin.operationsWorkspace.a04.tabs.ai', { defaultValue: 'AI and cross-app' }),
    evidence: t('admin.operationsWorkspace.a04.tabs.evidence', {
      defaultValue: 'Application evidence',
    }),
    history: t('admin.operationsWorkspace.a04.tabs.history', {
      defaultValue: 'Change history',
    }),
  };
  const tabIcons = {
    content: <ScanLine size={17} />,
    ai: <Bot size={17} />,
    evidence: <ShieldCheck size={17} />,
    history: <FileClock size={17} />,
  } satisfies Record<MailGovernanceTab, ReactElement>;

  return (
    <Stack spacing={2.5}>
      {!governance ? (
        <InlineFeedback severity="warning">
          {t('admin.operationsWorkspace.a04.configuredNotEnforced', {
            defaultValue:
              'Saved values are available, but effective enforcement evidence and history could not be loaded.',
          })}
        </InlineFeedback>
      ) : (
        <InlineFeedback severity="info">
          {t('admin.operationsWorkspace.sourceEvidence', {
            defaultValue: 'Evidence generated at {{time}}. Each source is evaluated independently.',
            time: governance.generatedAt,
          })}
        </InlineFeedback>
      )}

      <Section
        title={t('admin.operationsWorkspace.a04.title', {
          defaultValue: 'Security and AI policy governance',
        })}
        description={t('admin.operationsWorkspace.a04.workspaceDescription', {
          defaultValue:
            'Review configured policy, effective values, and source evidence without inferring protection from a saved switch.',
        })}
        action={
          onOpenSettings ? (
            <ActionButton
              intent="primary"
              disabled={!canManage}
              startIcon={<ShieldCheck size={16} />}
              onClick={onOpenSettings}
            >
              {t('admin.shared.configure')}
            </ActionButton>
          ) : undefined
        }
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ px: { xs: 1.75, sm: 2.25 }, py: 1.5, bgcolor: 'action.hover' }}
        >
          <Chip
            size="small"
            variant="outlined"
            label={t('admin.operationsWorkspace.a04.policyVersion', {
              defaultValue: 'Policy v{{version}}',
              version: governance?.policyVersion ?? overview.policy.version,
            })}
          />
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            {t('admin.operationsWorkspace.a04.readinessNotice', {
              defaultValue:
                'Scanner, DLP, inheritance, exception, and approval evidence remains unavailable until an authoritative source is connected.',
            })}
          </Typography>
          {!canManage ? (
            <StateChip
              label={READ_ONLY_STATE}
              displayLabel={t('admin.operationsWorkspace.a04.readOnly', {
                defaultValue: 'Read-only',
              })}
            />
          ) : null}
        </Stack>
        <Divider />
        <Tabs
          value={tab}
          onChange={(_event, value: MailGovernanceTab) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label={t('admin.operationsWorkspace.a04.tabsLabel', {
            defaultValue: 'Policy governance sections',
          })}
          sx={{ px: { xs: 0.5, sm: 1.25 }, borderBottom: 1, borderColor: 'divider' }}
        >
          {TAB_IDS.map((value) => (
            <Tab
              key={value}
              id={`mail-governance-tab-${value}`}
              aria-controls={`mail-governance-panel-${value}`}
              value={value}
              icon={tabIcons[value]}
              iconPosition="start"
              label={tabLabels[value]}
              sx={{ minHeight: 52, textTransform: 'none' }}
            />
          ))}
        </Tabs>

        {tab === 'content' ? (
          <DomainPanel
            id="content"
            title={t('admin.operationsWorkspace.a04.contentTitle', {
              defaultValue: 'Content security policy',
            })}
            description={t('admin.operationsWorkspace.a04.contentDescription', {
              defaultValue:
                'External sender, remote content, attachments, inspection, and retention references are evaluated separately.',
            })}
            unavailableMessage={t('admin.operationsWorkspace.a04.scannerUnavailable', {
              defaultValue:
                'No authoritative malware scanner or DLP readiness evidence was returned. Attachment protection remains unverified.',
            })}
            rows={contentRows}
          />
        ) : null}
        {tab === 'ai' ? (
          <DomainPanel
            id="ai"
            title={t('admin.operationsWorkspace.a04.aiTitle', {
              defaultValue: 'AI and cross-app policy',
            })}
            description={t('admin.operationsWorkspace.a04.aiDescription', {
              defaultValue:
                'Assistance, generation, target applications, data scope, transfer, and review requirements are distinct decisions.',
            })}
            unavailableMessage={t('admin.operationsWorkspace.a04.aiScopeUnavailable', {
              defaultValue:
                'Target applications, permitted data scopes, external transfer, and review requirements were not returned. Cross-app execution cannot be inferred.',
            })}
            rows={aiRows}
          />
        ) : null}
        {tab === 'evidence' ? <EvidencePanel rows={rows} /> : null}
        {tab === 'history' ? <HistoryPanel history={governance?.history ?? []} /> : null}
      </Section>
    </Stack>
  );
}
