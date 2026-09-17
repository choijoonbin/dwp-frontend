import { useState } from 'react';
import { Ban, FileCheck2, ShieldAlert, UserRoundCog } from 'lucide-react';
import {
  ActionButton,
  FormDialog,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  AdminV2FactGrid,
  AdminV2InspectorPaper,
  AdminV2MetricStrip,
  AdminV2RecordButton,
  AdminV2Section,
  AdminV2StateBoundary,
  AdminV2StatusPill,
  AdminV2WorkspaceFrame,
} from './admin-v2-foundation';

import type {
  ApprovalDelegationGovernanceDetail,
  ApprovalDelegationGovernanceReview,
  ApprovalDelegationReviewDisposition,
} from '@dwp-frontend/shared-utils/api/approval-admin-v2-delegation-api';
import type { DelegationReviewRecord } from './policy-governance-workspace';
import type {
  AdminV2Metric,
  AdminV2SourceState,
  AdminV2StateCopy,
  AdminV2Status,
  AdminV2WorkspaceHeader,
} from './admin-v2-types';

export type DelegationGovernanceCopy = Readonly<{
  header: AdminV2WorkspaceHeader;
  state: AdminV2StateCopy;
  listTitle: string;
  listDescription: string;
  detailTitle: string;
  detailDescription: string;
  auditTitle: string;
  auditDescription: string;
  noSelection: string;
  createLabel: string;
  editLabel: string;
  revokeLabel: string;
  cancelLabel: string;
  killSwitchLabel: string;
  unsupportedTitle: string;
  unsupportedReason: string;
  reviewLabel: string;
  reviewDescription: string;
  dispositionLabel: string;
  evidenceLabel: string;
  submitLabel: string;
  submittingLabel: string;
  closeLabel: string;
  findingsTitle: string;
  truthTitle: string;
  effectivePeriodLabel: string;
  rolesLabel: string;
  truthLabels: Readonly<Record<keyof ApprovalDelegationGovernanceDetail['truths'], string>>;
}>;

function status(label: string): AdminV2Status {
  if (label === 'VERIFIED' || label === 'IN_EFFECT') return { label, tone: 'success' };
  if (label === 'VIOLATED' || label === 'BLOCKED' || label === 'REVOKED') {
    return { label, tone: 'danger' };
  }
  return { label, tone: 'warning' };
}

export function DelegationGovernanceWorkspace({
  state,
  copy,
  metrics,
  delegations,
  selectedDelegationId,
  detail,
  reviews,
  detailLoading,
  reviewReady,
  reviewBusy,
  reviewDisabledReason,
  onSelectDelegation,
  onReview,
  onRetry,
  onResolveConflict,
}: {
  state: AdminV2SourceState;
  copy: DelegationGovernanceCopy;
  metrics: readonly AdminV2Metric[];
  delegations: readonly DelegationReviewRecord[];
  selectedDelegationId: string | null;
  detail: ApprovalDelegationGovernanceDetail | null;
  reviews: readonly ApprovalDelegationGovernanceReview[];
  detailLoading: boolean;
  reviewReady: boolean;
  reviewBusy: boolean;
  reviewDisabledReason?: string;
  onSelectDelegation: (delegationId: string) => void;
  onReview: (
    disposition: ApprovalDelegationReviewDisposition,
    evidenceSha256: string
  ) => Promise<boolean>;
  onRetry?: () => void;
  onResolveConflict?: () => void;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [disposition, setDisposition] =
    useState<ApprovalDelegationReviewDisposition>('ACKNOWLEDGED_FINDINGS');
  const [evidenceSha256, setEvidenceSha256] = useState('');
  const digestValid = /^[0-9a-f]{64}$/iu.test(evidenceSha256.trim());

  const submitReview = async () => {
    const completed = await onReview(disposition, evidenceSha256);
    if (completed) {
      setReviewOpen(false);
      setEvidenceSha256('');
    }
  };

  return (
    <AdminV2WorkspaceFrame
      header={copy.header}
      icon={UserRoundCog}
      primaryAction={
        <Stack alignItems={{ xs: 'stretch', sm: 'flex-end' }} gap={0.5}>
          <ActionButton
            intent="primary"
            startIcon={<FileCheck2 size={16} />}
            disabled={!reviewReady}
            onClick={() => setReviewOpen(true)}
          >
            {copy.reviewLabel}
          </ActionButton>
          {!reviewReady && reviewDisabledReason ? (
            <Typography variant="caption" color="text.secondary" textAlign={{ sm: 'right' }}>
              {reviewDisabledReason}
            </Typography>
          ) : null}
        </Stack>
      }
    >
      <AdminV2StateBoundary
        state={state}
        copy={copy.state}
        actions={{ onRetry, onResolveConflict }}
      >
        <AdminV2MetricStrip metrics={metrics} />
        <InlineFeedback severity="info" title={copy.unsupportedTitle} icon={<Ban size={18} />}>
          <Stack gap={0.75} sx={{ mt: 0.5 }}>
            <Typography variant="body2">{copy.unsupportedReason}</Typography>
            <Stack direction="row" gap={0.75} flexWrap="wrap">
              {[
                copy.createLabel,
                copy.editLabel,
                copy.revokeLabel,
                copy.cancelLabel,
                copy.killSwitchLabel,
              ].map((label) => (
                <ActionButton key={label} size="small" intent="secondary" disabled>
                  {label}
                </ActionButton>
              ))}
            </Stack>
          </Stack>
        </InlineFeedback>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0,1fr)',
              lg: 'minmax(250px,.7fr) minmax(340px,1.2fr) minmax(300px,1fr)',
            },
            gap: { xs: 1.5, lg: 2 },
            alignItems: 'start',
          }}
        >
          <AdminV2InspectorPaper>
            <AdminV2Section
              title={copy.listTitle}
              description={copy.listDescription}
              labelledBy="admin-v2-delegation-list"
            >
              <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                {delegations.map((delegation) => (
                  <Box component="li" key={delegation.id}>
                    <AdminV2RecordButton
                      selected={delegation.id === selectedDelegationId}
                      title={delegation.title}
                      description={delegation.description}
                      meta={`${delegation.scopeLabel} · ${delegation.effectiveLabel}`}
                      status={delegation.status}
                      onClick={() => onSelectDelegation(delegation.id)}
                    />
                  </Box>
                ))}
              </Box>
            </AdminV2Section>
          </AdminV2InspectorPaper>

          <AdminV2InspectorPaper>
            <AdminV2Section
              title={detail?.delegateDisplayName ?? copy.detailTitle}
              description={detail?.reason ?? copy.detailDescription}
              labelledBy="admin-v2-delegation-detail"
              action={
                detail ? <AdminV2StatusPill status={status(detail.effectiveState)} /> : undefined
              }
            >
              {detail ? (
                <Stack divider={<Divider flexItem />}>
                  <AdminV2FactGrid
                    facts={[
                      {
                        id: 'period',
                        label: copy.effectivePeriodLabel,
                        value: `${detail.startsAt} → ${detail.endsAt}`,
                      },
                      {
                        id: 'roles',
                        label: copy.rolesLabel,
                        value: detail.delegatedRoleCodes.join(', '),
                      },
                      {
                        id: 'scope',
                        label: copy.listTitle,
                        value: detail.workflowKey ?? detail.scopeType,
                      },
                    ]}
                  />
                  <Box sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight="fontWeightBold" sx={{ mb: 1 }}>
                      {copy.truthTitle}
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
                        gap: 1,
                      }}
                    >
                      {(
                        Object.entries(detail.truths) as [
                          keyof ApprovalDelegationGovernanceDetail['truths'],
                          ApprovalDelegationGovernanceDetail['truths'][keyof ApprovalDelegationGovernanceDetail['truths']],
                        ][]
                      ).map(([key, value]) => (
                        <Stack
                          key={key}
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          gap={1}
                          sx={{ p: 1, borderBlockEnd: 1, borderColor: 'divider' }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {copy.truthLabels[key]}
                          </Typography>
                          <AdminV2StatusPill status={status(value)} />
                        </Stack>
                      ))}
                    </Box>
                  </Box>
                  <Box sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight="fontWeightBold" sx={{ mb: 0.75 }}>
                      {copy.findingsTitle}
                    </Typography>
                    {detail.findings.length > 0 ? (
                      <Stack component="ul" gap={0.5} sx={{ m: 0, pl: 2.25 }}>
                        {detail.findings.map((finding) => (
                          <Typography component="li" variant="body2" key={finding}>
                            {finding}
                          </Typography>
                        ))}
                      </Stack>
                    ) : (
                      <AdminV2StatusPill status={status('VERIFIED')} />
                    )}
                  </Box>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  {detailLoading ? copy.state.loadingDescription : copy.noSelection}
                </Typography>
              )}
            </AdminV2Section>
          </AdminV2InspectorPaper>

          <AdminV2InspectorPaper>
            <AdminV2Section
              title={copy.auditTitle}
              description={copy.auditDescription}
              labelledBy="admin-v2-delegation-audit"
              action={<ShieldAlert size={18} aria-hidden="true" />}
            >
              <Stack divider={<Divider flexItem />}>
                {reviews.map((review) => (
                  <Box key={review.reviewId} sx={{ p: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography variant="body2" fontWeight="fontWeightBold">
                        {review.disposition}
                      </Typography>
                      <AdminV2StatusPill status={status(review.complianceState)} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {review.reviewedAt} · {review.reviewEvidenceSha256}
                    </Typography>
                  </Box>
                ))}
                {reviews.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                    {copy.auditDescription}
                  </Typography>
                ) : null}
              </Stack>
            </AdminV2Section>
          </AdminV2InspectorPaper>
        </Box>
      </AdminV2StateBoundary>
      <FormDialog
        open={reviewOpen}
        title={copy.reviewLabel}
        description={copy.reviewDescription}
        cancelLabel={copy.closeLabel}
        submitLabel={copy.submitLabel}
        submittingLabel={copy.submittingLabel}
        busy={reviewBusy}
        submitDisabled={!digestValid || !reviewReady}
        mobileFullScreen
        onClose={() => setReviewOpen(false)}
        onSubmit={submitReview}
      >
        <Stack gap={1.5}>
          <SelectField
            size="small"
            label={copy.dispositionLabel}
            value={disposition}
            options={[
              { value: 'ACKNOWLEDGED_FINDINGS', label: 'ACKNOWLEDGED_FINDINGS' },
              { value: 'REMEDIATION_REQUESTED', label: 'REMEDIATION_REQUESTED' },
            ]}
            onValueChange={(value) => value && setDisposition(value)}
          />
          <FormField
            size="small"
            label={copy.evidenceLabel}
            value={evidenceSha256}
            errorMessage={evidenceSha256 && !digestValid ? copy.reviewDescription : undefined}
            slotProps={{ htmlInput: { maxLength: 64, autoComplete: 'off' } }}
            onChange={(event) => setEvidenceSha256(event.target.value)}
          />
        </Stack>
      </FormDialog>
    </AdminV2WorkspaceFrame>
  );
}
