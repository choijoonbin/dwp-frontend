import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, History, LockKeyhole, Send, X } from 'lucide-react';
import type { createProviderSubscriptionRenewal } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  DateTimePickerField,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { formatProviderDate, ProviderStatusChip } from './provider-ui';

import type {
  ProviderServicePlanPortfolio,
  ProviderSubscriptionPortfolio,
  ProviderSubscriptionRenewalRevision,
} from '@dwp-frontend/shared-utils';

export type RenewalDecision = 'APPROVED' | 'REJECTED';

export function RenewalProposalDialog({
  subscription,
  plans,
  busy,
  onClose,
  onSubmit,
}: {
  subscription: ProviderSubscriptionPortfolio;
  plans: ProviderServicePlanPortfolio[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (request: Parameters<typeof createProviderSubscriptionRenewal>[0]) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [targetPlanKey, setTargetPlanKey] = useState(subscription.planKey);
  const [endsAt, setEndsAt] = useState<string | null>(
    subscription.endsAt ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  );
  const [contractReference, setContractReference] = useState(subscription.contractReference ?? '');
  const [reason, setReason] = useState('');
  const [requestKey] = useState(() => `commercial-renewal-${crypto.randomUUID()}`);
  const targetPlan = plans.find((plan) => plan.planKey === targetPlanKey);
  const validDate = endsAt && new Date(endsAt).getTime() > Date.now();

  return (
    <FormDialog
      open
      maxWidth="md"
      title={t('commercial.renewals.createTitle', { company: subscription.organizationName })}
      description={t('commercial.renewals.createDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('commercial.actions.submitRenewal')}
      submittingLabel={t('commercial.actions.submittingRenewal')}
      busy={busy}
      submitDisabled={
        !targetPlanKey || !validDate || !contractReference.trim() || reason.trim().length < 10
      }
      onClose={onClose}
      onSubmit={() =>
        onSubmit({
          subscriptionId: subscription.subscriptionId,
          targetPlanKey,
          proposedEndsAt: endsAt!,
          proposedContractReference: contractReference.trim(),
          reason: reason.trim(),
          requestKey,
          subscriptionVersion: subscription.version,
        })
      }
    >
      <Stack gap={2}>
        <Alert severity="info">{t('commercial.renewals.approvalGuidance')}</Alert>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t('commercial.renewals.currentPlan')}
            </Typography>
            <Typography variant="subtitle2">{subscription.planName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('commercial.renewals.currentTerm', {
                date: subscription.endsAt
                  ? formatProviderDate(subscription.endsAt)
                  : t('commercial.noEndDate'),
              })}
            </Typography>
          </Box>
          <Box sx={{ p: 1.5, bgcolor: 'action.selected', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t('commercial.renewals.proposedPlan')}
            </Typography>
            <Typography variant="subtitle2">{targetPlan?.planName ?? t('notAvailable')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {targetPlan
                ? t('commercial.plans.version', {
                    key: targetPlan.planKey,
                    version: targetPlan.planVersion,
                  })
                : t('notAvailable')}
            </Typography>
          </Box>
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5}>
          <SelectField
            required
            label={t('commercial.renewals.fields.targetPlan')}
            value={targetPlanKey}
            options={plans
              .filter((plan) => plan.lifecycleState === 'ACTIVE')
              .map((plan) => ({
                value: plan.planKey,
                label: `${plan.planName} · ${t(`tiers.${plan.serviceTier}`, {
                  defaultValue: plan.serviceTier,
                })}`,
              }))}
            onValueChange={setTargetPlanKey}
          />
          <DateTimePickerField
            required
            label={t('commercial.renewals.fields.endsAt')}
            value={endsAt}
            errorMessage={
              endsAt && !validDate ? t('commercial.renewals.validation.futureDate') : undefined
            }
            onValueChange={setEndsAt}
          />
        </Stack>
        <FormField
          required
          label={t('commercial.renewals.fields.contractReference')}
          value={contractReference}
          inputProps={{ maxLength: 160 }}
          supportingText={t('commercial.renewals.contractReferenceHelp')}
          onChange={(event) => setContractReference(event.target.value)}
        />
        <FormField
          required
          multiline
          minRows={3}
          label={t('commercial.renewals.fields.reason')}
          value={reason}
          inputProps={{ maxLength: 1000 }}
          supportingText={t('commercial.renewals.reasonHelp')}
          onChange={(event) => setReason(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

export function RenewalDecisionDialog({
  revision,
  decision,
  busy,
  onClose,
  onSubmit,
}: {
  revision: ProviderSubscriptionRenewalRevision;
  decision: RenewalDecision;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [reason, setReason] = useState('');
  const action = decision === 'APPROVED' ? 'approve' : 'reject';
  return (
    <FormDialog
      open
      title={t(`commercial.decision.${action}.title`)}
      description={t('commercial.decision.description', {
        company: revision.organizationName,
        revision: revision.revisionNumber,
      })}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(`commercial.actions.${action}`)}
      submitIntent={decision === 'REJECTED' ? 'danger' : 'primary'}
      submitDisabled={reason.trim().length < 10}
      busy={busy}
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim())}
    >
      <FormField
        autoFocus
        required
        multiline
        minRows={3}
        label={t('commercial.renewals.fields.decisionReason')}
        value={reason}
        inputProps={{ maxLength: 1000 }}
        supportingText={t('commercial.decision.reasonHelp')}
        onChange={(event) => setReason(event.target.value)}
      />
    </FormDialog>
  );
}

export function RenewalInspector({
  revision,
  operatorId,
  canWrite,
  canApprove,
  busy,
  onDecision,
  onPublish,
  onAudit,
}: {
  revision: ProviderSubscriptionRenewalRevision;
  operatorId?: number;
  canWrite: boolean;
  canApprove: boolean;
  busy: boolean;
  onDecision: (decision: RenewalDecision) => void;
  onPublish: () => void;
  onAudit: () => void;
}) {
  const { t } = useTranslation('provider');
  const selfApproval =
    revision.lifecycleState === 'PENDING_APPROVAL' && revision.requestedBy === operatorId;
  return (
    <Paper component="aside" variant="outlined" sx={{ minWidth: 0, p: 2 }}>
      <Stack gap={2}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Box minWidth={0}>
            <Typography variant="overline" color="text.secondary">
              {t('commercial.renewals.revision', { revision: revision.revisionNumber })}
            </Typography>
            <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
              {revision.organizationName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {revision.organizationKey} · {revision.proposedContractReference}
            </Typography>
          </Box>
          <ProviderStatusChip state={revision.lifecycleState} />
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            borderBlock: 1,
            borderColor: 'divider',
          }}
        >
          {[
            [t('commercial.renewals.currentPlan'), revision.currentPlanName],
            [t('commercial.renewals.proposedPlan'), revision.targetPlanName],
            [
              t('commercial.renewals.currentEnd'),
              revision.currentEndsAt
                ? formatProviderDate(revision.currentEndsAt)
                : t('commercial.noEndDate'),
            ],
            [t('commercial.renewals.proposedEnd'), formatProviderDate(revision.proposedEndsAt)],
          ].map(([label, value], index) => (
            <Box
              key={label}
              sx={{
                py: 1.25,
                px: index % 2 ? 1.5 : 0,
                borderLeft: { sm: index % 2 ? 1 : 0 },
                borderTop: index > 1 ? 1 : 0,
                borderColor: 'divider',
                minWidth: 0,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box>
          <Typography variant="subtitle2">{t('commercial.renewals.entitlementImpact')}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('commercial.renewals.tenantImpact', { count: revision.impactedTenants })}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
            {revision.addedEntitlements.map((entitlement) => (
              <Chip
                key={`added:${entitlement}`}
                size="small"
                color="success"
                variant="outlined"
                label={t('commercial.renewals.added', { entitlement })}
              />
            ))}
            {revision.removedEntitlements.map((entitlement) => (
              <Chip
                key={`removed:${entitlement}`}
                size="small"
                color="error"
                variant="outlined"
                label={t('commercial.renewals.removed', { entitlement })}
              />
            ))}
            {!revision.addedEntitlements.length && !revision.removedEntitlements.length && (
              <Chip
                size="small"
                variant="outlined"
                label={t('commercial.renewals.noRightsChange')}
              />
            )}
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle2">{t('commercial.renewals.businessReason')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {revision.reason}
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2">{t('commercial.renewals.controlEvidence')}</Typography>
          <Stack divider={<Divider flexItem />} sx={{ mt: 0.5 }}>
            {[
              [
                t('commercial.renewals.requestedBy'),
                t('commercial.renewals.actorAt', {
                  actor: revision.requestedByName,
                  time: formatProviderDate(revision.requestedAt),
                }),
              ],
              [t('commercial.renewals.decisionDue'), formatProviderDate(revision.decisionDueAt)],
              [
                t('commercial.renewals.decidedBy'),
                revision.decidedByName
                  ? t('commercial.renewals.actorAt', {
                      actor: revision.decidedByName,
                      time: formatProviderDate(revision.decidedAt),
                    })
                  : t('commercial.renewals.awaitingDecision'),
              ],
              [
                t('commercial.renewals.publishedBy'),
                revision.publishedByName
                  ? t('commercial.renewals.actorAt', {
                      actor: revision.publishedByName,
                      time: formatProviderDate(revision.publishedAt),
                    })
                  : t('commercial.renewals.notPublished'),
              ],
              [t('commercial.renewals.evidenceHash'), revision.contentSha256],
            ].map(([label, value]) => (
              <Stack
                key={label}
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                gap={0.5}
                sx={{ py: 0.75 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ overflowWrap: 'anywhere', textAlign: { sm: 'right' }, maxWidth: '70%' }}
                >
                  {value}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        {revision.lifecycleState === 'PUBLISHED' &&
          revision.executionState === 'MANUAL_ACTION_REQUIRED' && (
            <Alert severity="warning" icon={<LockKeyhole size={19} />}>
              {t('commercial.renewals.externalExecutionLocked')}
            </Alert>
          )}
        {selfApproval && <Alert severity="info">{t('commercial.renewals.selfApproval')}</Alert>}

        <Stack direction="row" flexWrap="wrap" gap={1}>
          {revision.lifecycleState === 'PENDING_APPROVAL' && canApprove && !selfApproval && (
            <>
              <ActionButton
                intent="primary"
                startIcon={<Check size={16} />}
                disabled={busy}
                onClick={() => onDecision('APPROVED')}
              >
                {t('commercial.actions.approve')}
              </ActionButton>
              <ActionButton
                intent="secondary"
                startIcon={<X size={16} />}
                disabled={busy}
                onClick={() => onDecision('REJECTED')}
              >
                {t('commercial.actions.reject')}
              </ActionButton>
            </>
          )}
          {revision.lifecycleState === 'APPROVED' && canWrite && (
            <ActionButton
              intent="primary"
              startIcon={<Send size={16} />}
              disabled={busy}
              onClick={onPublish}
            >
              {t('commercial.actions.publish')}
            </ActionButton>
          )}
          <ActionButton intent="quiet" startIcon={<History size={16} />} onClick={onAudit}>
            {t('commercial.actions.viewAudit')}
          </ActionButton>
        </Stack>
      </Stack>
    </Paper>
  );
}
