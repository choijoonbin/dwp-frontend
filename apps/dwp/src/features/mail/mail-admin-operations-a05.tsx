import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArchiveX, Download, LockKeyhole, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { ActionButton, InlineFeedback, SelectField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  buildMailPurgeGateEvidence,
  buildMailLegalHoldScope,
  getMailPurgeAvailability,
  MAIL_PURGE_RESOURCE_TYPES,
} from './mail-admin-operations-model';
import {
  EvidenceChip,
  Facts,
  FormattedTime,
  Section,
  StateChip,
} from './mail-admin-operations-ui-shared';
import { HoldEditor } from './mail-admin-retention-hold-editor';

import type { MailAdminOverview, MailLegalHoldReleasePreview } from '@dwp-frontend/shared-utils';
import type {
  MailLegalHold,
  MailPurgeGateEvidence,
  MailRetentionExport,
  MailRetentionSnapshot,
} from './mail-admin-operations-model';
import type { MailAdminOperationsContentProps } from './mail-admin-operations-ui-shared';

export function RetentionSurface({
  overview,
  retention,
  retentionExport,
  fallbackEvidence,
  canManageHolds,
  canPreviewPurge,
  canAuthorizePurge,
  canExecutePurge,
  canExport,
  now,
  busyAction,
  onCreateHold,
  onUpdateHold,
  onPreviewHoldRelease,
  onApproveHoldRelease,
  onExecuteHoldRelease,
  onPreview,
  onSelectCandidate,
  onApprove,
  onExecute,
  onExport,
  onApproveExport,
  onRefreshExport,
  onDownloadExport,
}: {
  overview: MailAdminOverview;
  retention?: MailRetentionSnapshot;
  retentionExport?: MailRetentionExport;
  fallbackEvidence?: MailPurgeGateEvidence;
  canManageHolds: boolean;
  canPreviewPurge: boolean;
  canAuthorizePurge: boolean;
  canExecutePurge: boolean;
  canExport: boolean;
  now: number;
  busyAction?: string | null;
  onCreateHold?: MailAdminOperationsContentProps['onCreateLegalHold'];
  onUpdateHold?: MailAdminOperationsContentProps['onUpdateLegalHold'];
  onPreviewHoldRelease?: MailAdminOperationsContentProps['onPreviewLegalHoldRelease'];
  onApproveHoldRelease?: MailAdminOperationsContentProps['onApproveLegalHoldRelease'];
  onExecuteHoldRelease?: MailAdminOperationsContentProps['onExecuteLegalHoldRelease'];
  onPreview?: MailAdminOperationsContentProps['onPreviewPurge'];
  onSelectCandidate?: MailAdminOperationsContentProps['onSelectPurgeCandidate'];
  onApprove?: MailAdminOperationsContentProps['onApprovePurge'];
  onExecute?: MailAdminOperationsContentProps['onExecutePurge'];
  onExport?: MailAdminOperationsContentProps['onExportRetentionEvidence'];
  onApproveExport?: MailAdminOperationsContentProps['onApproveRetentionEvidenceExport'];
  onRefreshExport?: MailAdminOperationsContentProps['onRefreshRetentionEvidenceExport'];
  onDownloadExport?: MailAdminOperationsContentProps['onDownloadRetentionEvidenceExport'];
}) {
  const { t } = useTranslation('mail');
  const [holdEditor, setHoldEditor] = useState<{ hold: MailLegalHold | null } | null>(null);
  const [releaseReview, setReleaseReview] = useState<{
    hold: MailLegalHold;
    preview: MailLegalHoldReleasePreview | null;
    acknowledged: boolean;
  } | null>(null);
  const [purgeEditorOpen, setPurgeEditorOpen] = useState(false);
  const [purgeScopeMode, setPurgeScopeMode] = useState<'TENANT' | 'ACCOUNT' | 'THREAD'>('TENANT');
  const [purgeScopeIds, setPurgeScopeIds] = useState('');
  const [purgeResourceTypes, setPurgeResourceTypes] = useState<readonly string[]>([
    ...MAIL_PURGE_RESOURCE_TYPES,
  ]);
  const [purgeBefore, setPurgeBefore] = useState(() => new Date(now).toISOString().slice(0, 10));
  const candidate =
    canPreviewPurge || canAuthorizePurge || canExecutePurge ? retention?.candidate : undefined;
  const gate = fallbackEvidence ?? buildMailPurgeGateEvidence(retention, true, now);
  const availability = getMailPurgeAvailability(gate);
  const candidateExpiresAt = candidate ? Date.parse(candidate.expiresAt) : Number.NaN;
  const candidateExpired = Boolean(
    candidate && (!Number.isFinite(candidateExpiresAt) || candidateExpiresAt <= now)
  );
  const retentionExportExpiresAt = retentionExport
    ? Date.parse(retentionExport.expiresAt)
    : Number.NaN;
  const retentionExportExpired = Boolean(
    retentionExport &&
    (!Number.isFinite(retentionExportExpiresAt) || retentionExportExpiresAt <= now)
  );
  const purgeScope = buildMailLegalHoldScope(purgeScopeMode, purgeScopeIds, purgeResourceTypes);
  const releasePreviewExpiresAt = releaseReview?.preview
    ? Date.parse(releaseReview.preview.expiresAt)
    : Number.NaN;
  const releasePreviewExpired = Boolean(
    releaseReview?.preview &&
    (releaseReview.preview.state === 'EXPIRED' ||
      !Number.isFinite(releasePreviewExpiresAt) ||
      releasePreviewExpiresAt <= now)
  );
  return (
    <Stack spacing={2.5}>
      {!retention ? (
        <InlineFeedback severity="warning">
          {t('admin.operationsWorkspace.a05.unavailable', {
            defaultValue:
              'Retention execution evidence is unavailable. Hold and purge mutations remain blocked.',
          })}
        </InlineFeedback>
      ) : null}
      <Section
        title={t('admin.operationsWorkspace.a05.retentionTitle', {
          defaultValue: 'Resource retention',
        })}
        description={t('admin.operationsWorkspace.a05.retentionDescription', {
          defaultValue: 'Configured periods are shown separately from effective enforcement.',
        })}
        action={
          <ActionButton
            intent="secondary"
            disabled={!canExport || !retention || !onExport}
            loading={busyAction === 'export-retention'}
            startIcon={<Download size={16} />}
            onClick={onExport}
          >
            {t('admin.operationsWorkspace.a05.exportEvidence', {
              defaultValue: 'Export retention evidence',
            })}
          </ActionButton>
        }
      >
        {retention?.resourcePolicies.length ? (
          <>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ px: 2, pt: 2, display: 'block' }}
            >
              {t('admin.operationsWorkspace.a05.resourcePolicyCount', {
                defaultValue: '{{count}} resource policies returned by the server',
                count: retention.resourcePolicies.length,
              })}
            </Typography>
            {retention.resourcePolicies.map((policy, index) => (
              <Box key={policy.resourceType}>
                {index > 0 ? <Divider /> : null}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.25}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  sx={{ p: 2 }}
                >
                  <Typography variant="body2" fontWeight="fontWeightBold" sx={{ flex: 1 }}>
                    {policy.resourceType}
                  </Typography>
                  <Typography variant="body2">
                    {t('admin.operationsWorkspace.a05.configuredDays', {
                      defaultValue: 'Configured {{count}} days',
                      count: policy.configuredDays,
                    })}
                  </Typography>
                  <Typography variant="body2">
                    {policy.effectiveDays == null
                      ? 'Effective unverified'
                      : `Effective ${policy.effectiveDays} days`}
                  </Typography>
                  <EvidenceChip state={policy.evidenceState} />
                </Stack>
              </Box>
            ))}
          </>
        ) : (
          <Facts
            items={[
              {
                label: t('admin.policies.retentionDays'),
                value: overview.policy.retentionDays,
                detail: 'Configured value; enforcement unverified',
              },
            ]}
          />
        )}
        {canExport && retentionExport ? (
          <>
            <Divider />
            <Stack spacing={1.25} sx={{ p: 2 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', sm: 'center' }}
              >
                <ShieldCheck size={17} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    {t('admin.operationsWorkspace.a05.exportReview', {
                      defaultValue: 'Retention evidence export approval',
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('admin.operationsWorkspace.a05.exportSummary', {
                      defaultValue:
                        '{{exportId}} · Policy v{{policyVersion}} · {{approved}}/{{required}} approvals',
                      exportId: retentionExport.exportId,
                      policyVersion: retentionExport.policyVersion,
                      approved: retentionExport.distinctApproverCount,
                      required: retentionExport.requiredApprovals,
                    })}
                  </Typography>
                </Box>
                <StateChip label={retentionExport.approvalState} />
                <StateChip label={retentionExport.state} />
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {t('admin.operationsWorkspace.a05.exportEvidenceDetail', {
                  defaultValue:
                    'Snapshot cutoff {{cutoff}} · expires {{expires}} · payload {{hash}}',
                  cutoff: retentionExport.snapshotCutoff,
                  expires: retentionExport.expiresAt,
                  hash: retentionExport.payloadSha256,
                })}
              </Typography>
              {retentionExport.approvals.map((approval) => (
                <Typography key={approval.approvalId} variant="caption" color="text.secondary">
                  {t('admin.operationsWorkspace.a05.exportApprovalEvidence', {
                    defaultValue: 'Approved by user {{userId}} at {{time}}',
                    userId: approval.approverUserId,
                    time: approval.decidedAt,
                  })}
                </Typography>
              ))}
              {retentionExportExpired ? (
                <InlineFeedback severity="warning">
                  {t('admin.operationsWorkspace.a05.exportExpired', {
                    defaultValue:
                      'This export expired. Refresh or create a new evidence export before downloading.',
                  })}
                </InlineFeedback>
              ) : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                <ActionButton
                  intent="quiet"
                  size="small"
                  startIcon={<RefreshCw size={15} />}
                  disabled={!onRefreshExport}
                  onClick={() => onRefreshExport?.(retentionExport.exportId)}
                >
                  {t('actions.refresh')}
                </ActionButton>
                <ActionButton
                  intent="secondary"
                  size="small"
                  loading={busyAction === 'approve-retention-export'}
                  disabled={!onApproveExport || retentionExport.approvalState === 'APPROVED'}
                  onClick={() => onApproveExport?.(retentionExport.exportId)}
                >
                  {t('admin.operationsWorkspace.a05.approveExport', {
                    defaultValue: 'Approve export',
                  })}
                </ActionButton>
                {retentionExport.approvalState === 'APPROVED' &&
                retentionExport.state === 'READY' &&
                retentionExport.downloadUrl ? (
                  <ActionButton
                    intent="primary"
                    size="small"
                    startIcon={<Download size={15} />}
                    loading={busyAction === 'download-retention-export'}
                    disabled={!onDownloadExport || retentionExportExpired}
                    onClick={() => onDownloadExport?.(retentionExport.exportId)}
                  >
                    {t('admin.operationsWorkspace.a05.downloadExport', {
                      defaultValue: 'Download evidence',
                    })}
                  </ActionButton>
                ) : null}
              </Stack>
            </Stack>
          </>
        ) : null}
      </Section>
      <Section
        title={t('admin.operationsWorkspace.a05.legalHolds', { defaultValue: 'Legal holds' })}
        description={`${t('admin.operationsWorkspace.a05.holdDescription', {
          defaultValue:
            'Held resources are excluded from purge. Releasing a hold never starts purge.',
        })}${
          retention
            ? ''
            : ` · ${t('admin.operationsWorkspace.unavailable', { defaultValue: 'Unavailable' })}`
        }`}
        action={
          <ActionButton
            intent="primary"
            disabled={!canManageHolds || !retention || !onCreateHold}
            startIcon={<Plus size={16} />}
            onClick={() => setHoldEditor({ hold: null })}
          >
            {t('admin.operationsWorkspace.a05.createHold', { defaultValue: 'Create legal hold' })}
          </ActionButton>
        }
      >
        {retention?.holds.length ? (
          retention.holds.map((hold, index) => (
            <Box key={hold.holdId}>
              {index > 0 ? <Divider /> : null}
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.25}
                alignItems={{ xs: 'stretch', md: 'center' }}
                sx={{ p: 2 }}
              >
                <LockKeyhole size={17} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    {hold.name}
                  </Typography>
                  {canManageHolds ? (
                    <Typography variant="caption" color="text.secondary">
                      {hold.safeCaseRef} ·{' '}
                      {typeof hold.scope === 'string' ? hold.scope : JSON.stringify(hold.scope)} ·{' '}
                      <FormattedTime value={hold.startsAt} />
                    </Typography>
                  ) : null}
                </Box>
                <StateChip label={hold.status} />
                <ActionButton
                  size="small"
                  intent="secondary"
                  disabled={!canManageHolds || hold.status !== 'ACTIVE' || !onUpdateHold}
                  onClick={() => setHoldEditor({ hold })}
                >
                  {t('actions.edit', { defaultValue: 'Edit' })}
                </ActionButton>
                <ActionButton
                  size="small"
                  intent="danger"
                  loading={busyAction === `release-hold:${hold.holdId}`}
                  disabled={!canManageHolds || hold.status !== 'ACTIVE' || !onPreviewHoldRelease}
                  onClick={() => {
                    setReleaseReview({ hold, preview: null, acknowledged: false });
                    if (onPreviewHoldRelease) {
                      void onPreviewHoldRelease(hold).then((preview) => {
                        if (!preview) return;
                        setReleaseReview((current) =>
                          current?.hold.holdId === hold.holdId ? { ...current, preview } : current
                        );
                      });
                    }
                  }}
                >
                  {t('admin.operationsWorkspace.a05.releaseHold', { defaultValue: 'Release hold' })}
                </ActionButton>
              </Stack>
            </Box>
          ))
        ) : (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {retention
                ? t('admin.operationsWorkspace.a05.noHolds', {
                    defaultValue: 'No legal holds were returned.',
                  })
                : t('admin.operationsWorkspace.unavailable', { defaultValue: 'Unavailable' })}
            </Typography>
          </Box>
        )}
      </Section>
      <Section
        title={t('admin.operationsWorkspace.a05.purge', {
          defaultValue: 'Purge preview, approval, and execution',
        })}
        description={`${t('admin.operationsWorkspace.a05.purgeDescription', {
          defaultValue: 'A current candidate snapshot and two distinct approvals are required.',
        })}${
          retention
            ? ''
            : ` · ${t('admin.operationsWorkspace.unavailable', { defaultValue: 'Unavailable' })}`
        }`}
      >
        {retention?.candidates?.length ? (
          <Box sx={{ p: 2, pb: 0 }}>
            <SelectField<string>
              size="small"
              label={t('admin.operationsWorkspace.a05.selectCandidate', {
                defaultValue: 'Current purge candidate',
              })}
              value={candidate?.candidateSnapshotId ?? ''}
              options={retention.candidates.map((item) => ({
                value: item.candidateSnapshotId,
                label: `${item.eligibleCount} eligible · ${item.distinctApproverCount}/2 approvals · ${item.expiresAt}`,
                disabled:
                  !Number.isFinite(Date.parse(item.expiresAt)) || Date.parse(item.expiresAt) <= now,
              }))}
              onValueChange={(candidateSnapshotId) => {
                const selected = retention.candidates?.find(
                  (item) => item.candidateSnapshotId === candidateSnapshotId
                );
                const expiresAt = selected ? Date.parse(selected.expiresAt) : Number.NaN;
                if (selected && Number.isFinite(expiresAt) && expiresAt > now) {
                  onSelectCandidate?.(selected);
                }
              }}
            />
            {candidateExpired ? (
              <InlineFeedback severity="warning">
                {t('admin.operationsWorkspace.a05.candidateExpired', {
                  defaultValue:
                    'This candidate snapshot expired. Create a new purge preview before approval or execution.',
                })}
              </InlineFeedback>
            ) : null}
          </Box>
        ) : null}
        {candidate ? (
          <>
            <Facts
              items={[
                {
                  label: 'Immutable candidate snapshot',
                  value: candidate.candidateSnapshotId,
                  detail: candidate.fingerprint,
                },
                {
                  label: 'Eligible',
                  value: candidate.eligibleCount,
                  detail: `${candidate.heldCount} held · ${candidate.totalCandidates} total`,
                },
                {
                  label: 'Approvals',
                  value: `${candidate.distinctApproverCount}/2`,
                  detail: `Policy v${candidate.policyVersion} · ${
                    candidateExpired ? 'Expired' : 'Expires'
                  } ${candidate.expiresAt}`,
                },
                {
                  label: 'Generated',
                  value: candidate.generatedAt,
                  detail: candidate.partialSources.length
                    ? `Partial: ${candidate.partialSources.join(', ')}`
                    : 'All sources complete',
                },
                {
                  label: t('admin.operationsWorkspace.a05.candidateScope', {
                    defaultValue: 'Immutable scope',
                  }),
                  value: JSON.stringify(candidate.scope),
                  detail: candidate.resourceTypes.join(', '),
                },
                {
                  label: t('admin.operationsWorkspace.a05.candidateCutoff', {
                    defaultValue: 'Delete content before',
                  }),
                  value: candidate.before,
                  detail: t('admin.operationsWorkspace.a05.candidateExclusions', {
                    defaultValue: '{{held}} held resources are excluded',
                    held: candidate.heldCount,
                  }),
                },
                ...MAIL_PURGE_RESOURCE_TYPES.map((resourceType) => ({
                  label: resourceType,
                  value: candidate.resourceCounts[resourceType],
                  detail: t('admin.operationsWorkspace.a05.cascadeCount', {
                    defaultValue: 'Immutable cascade count · {{held}} held',
                    held: candidate.heldResourceCounts[resourceType],
                  }),
                })),
                {
                  label: t('admin.operationsWorkspace.a05.legalHoldExclusions', {
                    defaultValue: 'Legal hold exclusions',
                  }),
                  value: candidate.exclusionReasonCounts.LEGAL_HOLD,
                },
                {
                  label: t('admin.operationsWorkspace.a05.immutableEvidenceExclusions', {
                    defaultValue: 'Immutable evidence exclusions',
                  }),
                  value: candidate.exclusionReasonCounts.IMMUTABLE_EVIDENCE,
                },
              ]}
            />
            <Divider />
          </>
        ) : null}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ p: 2 }}
        >
          <ArchiveX size={18} />
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            {availability.blockers.join(' · ') ||
              t('admin.operationsWorkspace.a05.gatesReady', {
                defaultValue: 'All destructive-action gates are satisfied.',
              })}
          </Typography>
          <ActionButton
            intent="secondary"
            loading={busyAction === 'preview-purge'}
            disabled={!canPreviewPurge || !availability.previewEnabled || !onPreview}
            onClick={() => setPurgeEditorOpen(true)}
          >
            {t('admin.operationsWorkspace.a05.preview', { defaultValue: 'Preview purge' })}
          </ActionButton>
          <ActionButton
            intent="secondary"
            loading={busyAction === 'approve-purge'}
            disabled={
              !canAuthorizePurge ||
              !candidate ||
              candidateExpired ||
              candidate.distinctApproverCount >= 2 ||
              !onApprove
            }
            onClick={() => candidate && onApprove?.(candidate)}
          >
            {t('admin.operationsWorkspace.a05.approve', { defaultValue: 'Approve snapshot' })}
          </ActionButton>
          <ActionButton
            intent="danger"
            loading={busyAction === 'execute-purge'}
            disabled={!canExecutePurge || !candidate || !availability.executeEnabled || !onExecute}
            onClick={() => candidate && onExecute?.(candidate)}
          >
            {t('admin.operationsWorkspace.a05.execute', { defaultValue: 'Execute purge' })}
          </ActionButton>
        </Stack>
        {canExecutePurge
          ? retention?.purgeJobs.map((job, index) => (
              <Box key={job.jobId}>
                {index > 0 || Boolean(candidate) ? <Divider /> : null}
                <Stack spacing={1} sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight="fontWeightBold" sx={{ flex: 1 }}>
                      {job.jobId}
                    </Typography>
                    <StateChip label={job.state} />
                    <StateChip label={job.verificationState} />
                  </Stack>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap">
                    {(job.steps ?? job.stepResults ?? []).map((step, index) => {
                      const name = 'step' in step ? String(step.step) : `STEP_${index + 1}`;
                      const state = 'state' in step ? String(step.state) : 'UNKNOWN';
                      return (
                        <Chip
                          key={`${name}:${index}`}
                          size="small"
                          variant="outlined"
                          label={`${name}: ${state}`}
                        />
                      );
                    })}
                  </Stack>
                </Stack>
              </Box>
            ))
          : null}
      </Section>
      {holdEditor ? (
        <HoldEditor
          key={holdEditor.hold?.holdId ?? 'new'}
          open
          hold={holdEditor.hold}
          policyVersion={retention?.policyVersion ?? overview.policy.version}
          resourceTypeOptions={
            retention?.resourcePolicies.map((policy) => policy.resourceType) ?? []
          }
          busy={
            busyAction === 'create-hold' || busyAction === `update-hold:${holdEditor.hold?.holdId}`
          }
          onClose={() => setHoldEditor(null)}
          onSave={(input) => {
            if (holdEditor.hold) onUpdateHold?.(holdEditor.hold.holdId, input);
            else onCreateHold?.(input);
          }}
        />
      ) : null}
      <Dialog
        open={Boolean(releaseReview)}
        onClose={() => setReleaseReview(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {t('admin.operationsWorkspace.a05.releaseReviewTitle', {
            defaultValue: 'Review legal hold release impact',
          })}
        </DialogTitle>
        <DialogContent>
          {releaseReview ? (
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <Typography variant="body2" fontWeight="fontWeightBold">
                {releaseReview.hold.name} · {releaseReview.hold.safeCaseRef}
              </Typography>
              {!releaseReview.preview ? (
                <InlineFeedback severity="info">
                  {busyAction === `preview-release-hold:${releaseReview.hold.holdId}`
                    ? t('admin.operationsWorkspace.a05.releasePreviewLoading', {
                        defaultValue: 'Calculating current release impact…',
                      })
                    : t('admin.operationsWorkspace.a05.releasePreviewUnavailable', {
                        defaultValue:
                          'Current impact evidence could not be loaded. Release remains blocked.',
                      })}
                </InlineFeedback>
              ) : (
                <>
                  <Facts
                    items={[
                      {
                        label: t('admin.operationsWorkspace.a05.releasePreviewId', {
                          defaultValue: 'Release preview',
                        }),
                        value: releaseReview.preview.releasePreviewId,
                        detail: releaseReview.preview.fingerprint,
                      },
                      {
                        label: t('admin.operationsWorkspace.a05.releaseBoundary', {
                          defaultValue: 'Retention boundary',
                        }),
                        value: releaseReview.preview.retentionBoundary,
                        detail: JSON.stringify(releaseReview.preview.holdScope),
                      },
                      ...MAIL_PURGE_RESOURCE_TYPES.map((resourceType) => ({
                        label: resourceType,
                        value: releaseReview.preview!.impact.affectedResourceCounts[resourceType],
                        detail: t('admin.operationsWorkspace.a05.releaseImpactCounts', {
                          defaultValue:
                            '{{held}} held · {{purgeSafe}} purge-safe after release · {{protected}} still protected · {{provider}} need provider capability',
                          held: releaseReview.preview!.impact.currentlyHeldResourceCounts[
                            resourceType
                          ],
                          purgeSafe:
                            releaseReview.preview!.impact.purgeSafeAfterReleaseResourceCounts[
                              resourceType
                            ],
                          protected:
                            releaseReview.preview!.impact.stillProtectedAfterReleaseResourceCounts[
                              resourceType
                            ],
                          provider:
                            releaseReview.preview!.impact.providerCapabilityRequiredResourceCounts[
                              resourceType
                            ],
                        }),
                      })),
                    ]}
                  />
                  <InlineFeedback severity={releasePreviewExpired ? 'warning' : 'info'}>
                    {releasePreviewExpired
                      ? t('admin.operationsWorkspace.a05.releasePreviewExpired', {
                          defaultValue:
                            'This impact preview expired. Close and create a new preview before approval.',
                        })
                      : t('admin.operationsWorkspace.a05.releaseDoesNotPurge', {
                          defaultValue:
                            'Releasing this hold does not start purge. It changes future protection eligibility only.',
                        })}
                  </InlineFeedback>
                  <Typography variant="caption" color="text.secondary">
                    {t('admin.operationsWorkspace.a05.releaseApprovals', {
                      defaultValue:
                        '{{count}} distinct approvals · state {{state}} · expires {{time}}',
                      count: releaseReview.preview.distinctApproverCount,
                      state: releaseReview.preview.state,
                      time: releaseReview.preview.expiresAt,
                    })}
                  </Typography>
                  {['REJECTED', 'EXPIRED', 'RELEASED'].includes(releaseReview.preview.state) ? (
                    <InlineFeedback severity="warning">
                      {t('admin.operationsWorkspace.a05.releasePreviewClosed', {
                        defaultValue:
                          'This release review is closed with state {{state}}. Create a new impact preview before taking another action.',
                        state: releaseReview.preview.state,
                      })}
                    </InlineFeedback>
                  ) : null}
                  {releaseReview.preview.state === 'APPROVED' ? (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={releaseReview.acknowledged}
                          onChange={(event) =>
                            setReleaseReview({
                              ...releaseReview,
                              acknowledged: event.target.checked,
                            })
                          }
                        />
                      }
                      label={t('admin.operationsWorkspace.a05.releaseConfirmation', {
                        defaultValue:
                          'I reviewed the affected scope and understand that release changes future protection without starting purge.',
                      })}
                    />
                  ) : null}
                </>
              )}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ flexDirection: { xs: 'column-reverse', sm: 'row' }, gap: 1 }}>
          <ActionButton intent="quiet" onClick={() => setReleaseReview(null)}>
            {t('actions.cancel')}
          </ActionButton>
          {releaseReview?.preview?.state === 'AWAITING_APPROVAL' ? (
            <ActionButton
              intent="secondary"
              loading={
                busyAction === `approve-release-hold:${releaseReview.preview.releasePreviewId}`
              }
              disabled={releasePreviewExpired || !onApproveHoldRelease}
              onClick={() => {
                const current = releaseReview.preview;
                if (!current || !onApproveHoldRelease) return;
                void onApproveHoldRelease(current).then((preview) => {
                  if (preview)
                    setReleaseReview((review) =>
                      review ? { ...review, preview, acknowledged: false } : review
                    );
                });
              }}
            >
              {t('admin.operationsWorkspace.a05.approveRelease', {
                defaultValue: 'Approve release impact',
              })}
            </ActionButton>
          ) : null}
          {releaseReview?.preview?.state === 'APPROVED' ? (
            <ActionButton
              intent="danger"
              loading={
                busyAction === `execute-release-hold:${releaseReview.preview.releasePreviewId}`
              }
              disabled={
                releasePreviewExpired || !releaseReview.acknowledged || !onExecuteHoldRelease
              }
              onClick={() => {
                const current = releaseReview.preview;
                if (!current || !onExecuteHoldRelease) return;
                void onExecuteHoldRelease(current).then((completed) => {
                  if (completed) setReleaseReview(null);
                });
              }}
            >
              {t('admin.operationsWorkspace.a05.confirmRelease', {
                defaultValue: 'Confirm hold release',
              })}
            </ActionButton>
          ) : null}
        </DialogActions>
      </Dialog>
      <Dialog
        open={purgeEditorOpen}
        onClose={() => setPurgeEditorOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t('admin.operationsWorkspace.a05.previewFormTitle', {
            defaultValue: 'Choose purge preview scope',
          })}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <InlineFeedback severity="warning">
              {t('admin.operationsWorkspace.a05.previewFormDescription', {
                defaultValue:
                  'This creates an evidence-only snapshot. Review eligible and excluded counts before requesting approval.',
              })}
            </InlineFeedback>
            <SelectField
              label={t('admin.operationsWorkspace.a05.scope', { defaultValue: 'Resource scope' })}
              value={purgeScopeMode}
              options={(['TENANT', 'ACCOUNT', 'THREAD'] as const).map((value) => ({
                value,
                label: t(`admin.operationsWorkspace.a05.scopeMode.${value}`, {
                  defaultValue: value,
                }),
              }))}
              onValueChange={(value) => value && setPurgeScopeMode(value)}
            />
            {purgeScopeMode !== 'TENANT' ? (
              <TextField
                label={t(
                  purgeScopeMode === 'ACCOUNT'
                    ? 'admin.operationsWorkspace.a05.accountIds'
                    : 'admin.operationsWorkspace.a05.threadIds'
                )}
                value={purgeScopeIds}
                error={Boolean(purgeScopeIds.trim()) && !purgeScope}
                onChange={(event) => setPurgeScopeIds(event.target.value)}
              />
            ) : null}
            <TextField
              type="date"
              label={t('admin.operationsWorkspace.a05.candidateCutoff', {
                defaultValue: 'Delete content before',
              })}
              slotProps={{ inputLabel: { shrink: true } }}
              value={purgeBefore}
              onChange={(event) => setPurgeBefore(event.target.value)}
            />
            <Box>
              <Typography variant="body2" fontWeight="fontWeightBold">
                {t('admin.operationsWorkspace.a05.scopeResourceTypes', {
                  defaultValue: 'Resource types',
                })}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} useFlexGap flexWrap="wrap">
                {MAIL_PURGE_RESOURCE_TYPES.map((resourceType) => (
                  <FormControlLabel
                    key={resourceType}
                    control={
                      <Checkbox
                        checked={purgeResourceTypes.includes(resourceType)}
                        onChange={() =>
                          setPurgeResourceTypes((current) =>
                            current.includes(resourceType)
                              ? current.filter((item) => item !== resourceType)
                              : [...current, resourceType]
                          )
                        }
                      />
                    }
                    label={resourceType}
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexDirection: { xs: 'column-reverse', sm: 'row' }, gap: 1 }}>
          <ActionButton intent="quiet" onClick={() => setPurgeEditorOpen(false)}>
            {t('actions.cancel')}
          </ActionButton>
          <ActionButton
            intent="primary"
            disabled={!purgeScope || !purgeBefore || !purgeResourceTypes.length || !onPreview}
            loading={busyAction === 'preview-purge'}
            onClick={() => {
              if (!purgeScope || !onPreview) return;
              onPreview({
                scope: purgeScope,
                resourceTypes: [...purgeResourceTypes],
                before: `${purgeBefore}T23:59:59.999Z`,
              });
              setPurgeEditorOpen(false);
            }}
          >
            {t('admin.operationsWorkspace.a05.preview', { defaultValue: 'Preview purge' })}
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
