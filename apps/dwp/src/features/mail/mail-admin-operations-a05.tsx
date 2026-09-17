import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArchiveX, LockKeyhole, Plus } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  buildMailPurgeGateEvidence,
  getMailPurgeAvailability,
} from './mail-admin-operations-model';
import {
  EvidenceChip,
  Facts,
  FormattedTime,
  Section,
  StateChip,
} from './mail-admin-operations-ui-shared';

import type { MailAdminOverview } from '@dwp-frontend/shared-utils';
import type {
  MailLegalHold,
  MailLegalHoldInput,
  MailPurgeGateEvidence,
  MailRetentionSnapshot,
} from './mail-admin-operations-model';
import type { MailAdminOperationsContentProps } from './mail-admin-operations-ui-shared';

function HoldEditor({
  open,
  hold,
  policyVersion,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  hold: MailLegalHold | null;
  policyVersion: number;
  busy: boolean;
  onClose: () => void;
  onSave: (input: MailLegalHoldInput) => void;
}) {
  const { t } = useTranslation('mail');
  const [name, setName] = useState(hold?.name ?? '');
  const [safeCaseRef, setSafeCaseRef] = useState(hold?.safeCaseRef ?? '');
  const [scope, setScope] = useState(
    hold ? (typeof hold.scope === 'string' ? hold.scope : JSON.stringify(hold.scope)) : ''
  );
  const [expiresAt, setExpiresAt] = useState(hold?.expiresAt?.slice(0, 10) ?? '');
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('admin.operationsWorkspace.a05.createHold', {
          defaultValue: hold ? 'Edit legal hold' : 'Create legal hold',
        })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={t('admin.operationsWorkspace.a05.holdName', { defaultValue: 'Hold name' })}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label={t('admin.operationsWorkspace.a05.caseReference', {
              defaultValue: 'Safe case reference',
            })}
            value={safeCaseRef}
            onChange={(event) => setSafeCaseRef(event.target.value)}
          />
          <TextField
            label={t('admin.operationsWorkspace.a05.scope', { defaultValue: 'Resource scope' })}
            value={scope}
            onChange={(event) => setScope(event.target.value)}
          />
          <TextField
            label={t('admin.operationsWorkspace.a05.expiresAt', {
              defaultValue: 'Expiry (optional)',
            })}
            type="date"
            slotProps={{ inputLabel: { shrink: true } }}
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <ActionButton intent="quiet" onClick={onClose}>
          {t('actions.cancel')}
        </ActionButton>
        <ActionButton
          intent="primary"
          loading={busy}
          disabled={!name.trim() || !safeCaseRef.trim() || !scope.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              safeCaseRef: safeCaseRef.trim(),
              scope: scope.trim(),
              startsAt: hold?.startsAt,
              expiresAt: expiresAt ? `${expiresAt}T23:59:59.999Z` : null,
              version: hold?.version ?? policyVersion,
            })
          }
        >
          {t('actions.save')}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}

export function RetentionSurface({
  overview,
  retention,
  fallbackEvidence,
  canManageHolds,
  canAuthorizePurge,
  canExecutePurge,
  busyAction,
  onCreateHold,
  onUpdateHold,
  onReleaseHold,
  onPreview,
  onApprove,
  onExecute,
}: {
  overview: MailAdminOverview;
  retention?: MailRetentionSnapshot;
  fallbackEvidence?: MailPurgeGateEvidence;
  canManageHolds: boolean;
  canAuthorizePurge: boolean;
  canExecutePurge: boolean;
  busyAction?: string | null;
  onCreateHold?: MailAdminOperationsContentProps['onCreateLegalHold'];
  onUpdateHold?: MailAdminOperationsContentProps['onUpdateLegalHold'];
  onReleaseHold?: MailAdminOperationsContentProps['onReleaseLegalHold'];
  onPreview?: () => void;
  onApprove?: MailAdminOperationsContentProps['onApprovePurge'];
  onExecute?: MailAdminOperationsContentProps['onExecutePurge'];
}) {
  const { t } = useTranslation('mail');
  const [holdEditor, setHoldEditor] = useState<{ hold: MailLegalHold | null } | null>(null);
  const candidate = canAuthorizePurge || canExecutePurge ? retention?.candidate : undefined;
  const gate = fallbackEvidence ?? buildMailPurgeGateEvidence(retention, true);
  const availability = getMailPurgeAvailability(gate);
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
      >
        {retention?.resourcePolicies.length ? (
          retention.resourcePolicies.map((policy, index) => (
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
          ))
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
                  <Typography variant="caption" color="text.secondary">
                    {hold.safeCaseRef} ·{' '}
                    {typeof hold.scope === 'string' ? hold.scope : JSON.stringify(hold.scope)} ·{' '}
                    <FormattedTime value={hold.startsAt} />
                  </Typography>
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
                  disabled={!canManageHolds || hold.status !== 'ACTIVE' || !onReleaseHold}
                  onClick={() => onReleaseHold?.(hold.holdId, hold.version)}
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
          defaultValue:
            'A current immutable candidate snapshot and two distinct approvals are required.',
        })}${
          retention
            ? ''
            : ` · ${t('admin.operationsWorkspace.unavailable', { defaultValue: 'Unavailable' })}`
        }`}
      >
        {candidate ? (
          <>
            <Facts
              items={[
                {
                  label: 'Candidate snapshot',
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
                  detail: `Expires ${candidate.expiresAt}`,
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
            disabled={!canAuthorizePurge || !availability.previewEnabled || !onPreview}
            onClick={onPreview}
          >
            {t('admin.operationsWorkspace.a05.preview', { defaultValue: 'Preview purge' })}
          </ActionButton>
          <ActionButton
            intent="secondary"
            loading={busyAction === 'approve-purge'}
            disabled={
              !canAuthorizePurge || !candidate || candidate.distinctApproverCount >= 2 || !onApprove
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
        {canAuthorizePurge
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
    </Stack>
  );
}
