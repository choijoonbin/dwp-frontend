import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  Check,
  CheckCircle2,
  Database,
  Download,
  Fingerprint,
  GitPullRequest,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  TimerReset,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAuditPolicyRevision,
  createAuditCheckpoint,
  decideAuditPolicyRevision,
  getAuditPolicy,
  listAuditIntegrity,
  listAuditPolicyRevisions,
  publishAuditPolicyRevision,
  rollbackAuditPolicyRevision,
  submitAuditPolicyRevision,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import { ActionButton, ActionIconButton, FormField } from '@dwp-frontend/design-system';

import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';

import type {
  AuditIntegrityCheckpoint,
  AuditPolicyRevision,
  AuditRetentionPolicy,
} from '@dwp-frontend/shared-utils';

type EditablePolicy = Pick<
  AuditRetentionPolicy,
  | 'standardRetentionDays'
  | 'extendedRetentionDays'
  | 'exportLimitRows'
  | 'requireExportReason'
  | 'integrityEnabled'
  | 'highRiskThreshold'
>;

function AssuranceItem({
  icon: Icon,
  label,
  value,
  state = 'success',
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  state?: 'success' | 'warning';
}) {
  return (
    <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0, px: 2, py: 1.5 }}>
      <Box
        sx={(theme) => ({
          display: 'grid',
          placeItems: 'center',
          width: 32,
          height: 32,
          flex: '0 0 auto',
          bgcolor: alpha(theme.palette[state].main, 0.1),
          color: `${state}.main`,
        })}
      >
        <Icon size={17} />
      </Box>
      <Box minWidth={0}>
        <Typography variant="caption" color="text.secondary" noWrap display="block">
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={750} noWrap>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

function LifecycleStep({
  icon: Icon,
  title,
  detail,
  last = false,
}: {
  icon: typeof Database;
  title: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <Stack direction="row" alignItems="center" flex={1} minWidth={0}>
      <Stack alignItems="center" gap={0.75} minWidth={112} textAlign="center">
        <Box
          sx={(theme) => ({
            display: 'grid',
            placeItems: 'center',
            width: 40,
            height: 40,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.background.paper,
            color: theme.palette.primary.main,
          })}
        >
          <Icon size={19} />
        </Box>
        <Typography component="p" variant="subtitle2">
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      </Stack>
      {!last && <Box sx={{ flex: 1, minWidth: 24, height: 1, mx: 1, bgcolor: 'divider' }} />}
    </Stack>
  );
}

function IntegrityLedger({ items }: { items: AuditIntegrityCheckpoint[] }) {
  const { t } = useTranslation('admin');
  if (!items.length) {
    return (
      <Stack alignItems="center" gap={1} sx={{ py: 6 }}>
        <Fingerprint size={27} />
        <Typography variant="body2" color="text.secondary">
          {t('auditControl.governance.noCheckpoints')}
        </Typography>
      </Stack>
    );
  }
  return (
    <Stack>
      {items.map((item, index) => (
        <Stack
          key={item.checkpointId}
          direction="row"
          gap={1.5}
          sx={{ position: 'relative', px: 2.25, py: 1.75, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box sx={{ width: 20, position: 'relative', flex: '0 0 auto' }}>
            {index < items.length - 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  left: 9,
                  top: 18,
                  bottom: -28,
                  width: 1,
                  bgcolor: 'divider',
                }}
              />
            )}
            <Box
              sx={{
                position: 'absolute',
                top: 3,
                left: 3,
                display: 'grid',
                placeItems: 'center',
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: item.verificationStatus === 'VERIFIED' ? 'success.main' : 'warning.main',
                color: 'common.white',
              }}
            >
              {item.verificationStatus === 'VERIFIED' && <CheckCircle2 size={10} />}
            </Box>
          </Box>
          <Box minWidth={0} flex={1}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Typography component="p" variant="subtitle2">
                {item.checkpointDate}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                color={
                  item.verificationStatus === 'VERIFIED'
                    ? 'success'
                    : item.verificationStatus === 'FAILED'
                      ? 'error'
                      : 'warning'
                }
                label={t(`auditControl.integrityStatus.${item.verificationStatus}`)}
              />
            </Stack>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              gap={{ xs: 0.5, sm: 2 }}
              sx={{ mt: 0.75 }}
            >
              <Typography variant="caption" color="text.secondary">
                {t('auditControl.governance.recordCount', { count: item.recordCount })}
              </Typography>
              <Stack direction="row" alignItems="center" gap={0.6} minWidth={0}>
                <KeyRound size={13} />
                <Typography variant="caption" color="text.secondary" fontFamily="monospace" noWrap>
                  {item.checkpointHash.slice(0, 20)}…
                </Typography>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

type PolicyRevisionAction = 'submit' | 'approve' | 'reject' | 'publish' | 'rollback';

function revisionColor(state: string): 'default' | 'info' | 'warning' | 'success' | 'error' {
  if (state === 'PUBLISHED' || state === 'APPROVED') return 'success';
  if (state === 'IN_REVIEW' || state === 'DRAFT') return 'warning';
  if (state === 'REJECTED' || state === 'CANCELLED') return 'error';
  if (state === 'SUPERSEDED') return 'info';
  return 'default';
}

function PolicyRevisionLedger({
  items,
  activeRevisionId,
  reason,
  busy,
  onAction,
}: {
  items: AuditPolicyRevision[];
  activeRevisionId?: string | null;
  reason: string;
  busy: boolean;
  onAction: (revision: AuditPolicyRevision, action: PolicyRevisionAction) => void;
}) {
  const { t } = useTranslation('admin');
  const display = useDisplayDictionary();
  if (!items.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, py: 4 }}>
        {t('auditControl.governance.revisions.empty')}
      </Typography>
    );
  }
  return (
    <Stack divider={<Divider flexItem />}>
      {items.map((revision) => {
        const active = revision.revisionId === activeRevisionId;
        const changedFields = Object.keys(revision.diff);
        return (
          <Box key={revision.revisionId} sx={{ px: 2.5, py: 2 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ md: 'flex-start' }}
              justifyContent="space-between"
              gap={2}
            >
              <Box minWidth={0} flex={1}>
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                  <Typography component="h3" variant="subtitle2">
                    {t('auditControl.governance.revisions.revision', {
                      number: revision.revisionNumber,
                    })}
                  </Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={revisionColor(revision.lifecycleState)}
                    label={display('states', revision.lifecycleState)}
                  />
                  {active && (
                    <Chip
                      size="small"
                      color="success"
                      label={t('auditControl.governance.revisions.active')}
                    />
                  )}
                  {revision.rollbackOfRevisionId && (
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={<RotateCcw size={13} />}
                      label={t('auditControl.governance.revisions.rollbackDraft')}
                    />
                  )}
                </Stack>
                <Typography variant="body2" sx={{ mt: 0.75 }}>
                  {revision.changeReason}
                </Typography>
                <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
                  {changedFields.length ? (
                    changedFields.map((field) => (
                      <Chip
                        key={field}
                        size="small"
                        variant="outlined"
                        label={t(`auditControl.governance.revisions.fields.${field}`, {
                          defaultValue: field,
                        })}
                      />
                    ))
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {t('auditControl.governance.revisions.baseline')}
                    </Typography>
                  )}
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={{ xs: 0.25, sm: 2 }} mt={1}>
                  <Typography variant="caption" color="text.secondary">
                    {t('auditControl.governance.revisions.author', {
                      actor: revision.createdBy,
                      time: formatDate(revision.createdAt, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('auditControl.governance.revisions.hashLabel')}{' '}
                    <Box component="code" sx={{ fontFamily: 'monospace' }}>
                      {revision.contentSha256.slice(0, 12)}…
                    </Box>
                  </Typography>
                </Stack>
              </Box>
              <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="flex-end">
                {revision.lifecycleState === 'DRAFT' && (
                  <ActionButton
                    intent="secondary"
                    size="small"
                    startIcon={<Send size={15} />}
                    disabled={busy || !reason.trim()}
                    onClick={() => onAction(revision, 'submit')}
                  >
                    {t('auditControl.governance.revisions.submit')}
                  </ActionButton>
                )}
                {revision.lifecycleState === 'IN_REVIEW' && (
                  <>
                    <ActionButton
                      intent="danger"
                      size="small"
                      startIcon={<X size={15} />}
                      disabled={busy || !reason.trim()}
                      onClick={() => onAction(revision, 'reject')}
                    >
                      {t('auditControl.governance.revisions.reject')}
                    </ActionButton>
                    <ActionButton
                      intent="primary"
                      size="small"
                      startIcon={<Check size={15} />}
                      disabled={busy || !reason.trim()}
                      onClick={() => onAction(revision, 'approve')}
                    >
                      {t('auditControl.governance.revisions.approve')}
                    </ActionButton>
                  </>
                )}
                {revision.lifecycleState === 'APPROVED' && (
                  <ActionButton
                    intent="primary"
                    size="small"
                    startIcon={<ShieldCheck size={15} />}
                    disabled={busy || !reason.trim()}
                    onClick={() => onAction(revision, 'publish')}
                  >
                    {t('auditControl.governance.revisions.publish')}
                  </ActionButton>
                )}
                {revision.lifecycleState === 'SUPERSEDED' && (
                  <ActionButton
                    intent="secondary"
                    size="small"
                    startIcon={<RotateCcw size={15} />}
                    disabled={busy || !reason.trim()}
                    onClick={() => onAction(revision, 'rollback')}
                  >
                    {t('auditControl.governance.revisions.rollback')}
                  </ActionButton>
                )}
              </Stack>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}

export function AuditGovernance() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const policyQuery = useQuery({ queryKey: ['audit-control', 'policy'], queryFn: getAuditPolicy });
  const revisionsQuery = useQuery({
    queryKey: ['audit-control', 'policy-revisions'],
    queryFn: listAuditPolicyRevisions,
  });
  const integrityQuery = useQuery({
    queryKey: ['audit-control', 'integrity'],
    queryFn: listAuditIntegrity,
  });
  const [policy, setPolicy] = useState<EditablePolicy | null>(null);
  const [reason, setReason] = useState('');
  const [incidentCaseId, setIncidentCaseId] = useState('');

  useEffect(() => {
    if (!policyQuery.data) return;
    setPolicy({
      standardRetentionDays: policyQuery.data.standardRetentionDays,
      extendedRetentionDays: policyQuery.data.extendedRetentionDays,
      exportLimitRows: policyQuery.data.exportLimitRows,
      requireExportReason: policyQuery.data.requireExportReason,
      integrityEnabled: policyQuery.data.integrityEnabled,
      highRiskThreshold: policyQuery.data.highRiskThreshold,
    });
  }, [policyQuery.data]);

  const refreshPolicy = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['audit-control', 'policy'] }),
      queryClient.invalidateQueries({ queryKey: ['audit-control', 'policy-revisions'] }),
    ]);
  };
  const createRevisionMutation = useMutation({
    mutationFn: () =>
      createAuditPolicyRevision({
        ...policy!,
        reason: reason.trim(),
        incidentCaseId: incidentCaseId.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success(t('auditControl.governance.revisions.created'));
      setReason('');
      setIncidentCaseId('');
      await refreshPolicy();
    },
    onError: () => toast.error(t('common.operationError')),
  });
  const revisionActionMutation = useMutation({
    mutationFn: async ({
      revision,
      action,
    }: {
      revision: AuditPolicyRevision;
      action: PolicyRevisionAction;
    }) => {
      if (action === 'submit') return submitAuditPolicyRevision(revision, reason.trim());
      if (action === 'approve') {
        return decideAuditPolicyRevision(revision, 'APPROVED', reason.trim());
      }
      if (action === 'reject') {
        return decideAuditPolicyRevision(revision, 'REJECTED', reason.trim());
      }
      if (action === 'publish') return publishAuditPolicyRevision(revision, reason.trim());
      return rollbackAuditPolicyRevision(
        revision,
        reason.trim(),
        incidentCaseId.trim() || undefined
      );
    },
    onSuccess: async () => {
      toast.success(t('auditControl.governance.revisions.transitioned'));
      setReason('');
      setIncidentCaseId('');
      await refreshPolicy();
    },
    onError: () => toast.error(t('common.operationError')),
  });
  const checkpointMutation = useMutation({
    mutationFn: createAuditCheckpoint,
    onSuccess: async () => {
      toast.success(t('auditControl.governance.checkpointCreated'));
      await queryClient.invalidateQueries({ queryKey: ['audit-control', 'integrity'] });
    },
    onError: () => toast.error(t('common.operationError')),
  });

  const latestCheckpoint = useMemo(() => integrityQuery.data?.[0], [integrityQuery.data]);

  if (policyQuery.isLoading || revisionsQuery.isLoading || integrityQuery.isLoading || !policy) {
    return <ManagementPanelLoading label={t('auditControl.loading')} />;
  }
  if (policyQuery.isError || revisionsQuery.isError || integrityQuery.isError) {
    return <ManagementPanelError message={t('auditControl.loadError')} />;
  }

  const setNumber = (field: keyof EditablePolicy, value: string) => {
    setPolicy((current) => (current ? { ...current, [field]: Number(value) } : current));
  };
  const activePolicy = policyQuery.data;
  const policyChanged =
    Boolean(activePolicy) &&
    (policy.standardRetentionDays !== activePolicy?.standardRetentionDays ||
      policy.extendedRetentionDays !== activePolicy?.extendedRetentionDays ||
      policy.exportLimitRows !== activePolicy?.exportLimitRows ||
      policy.requireExportReason !== activePolicy?.requireExportReason ||
      policy.integrityEnabled !== activePolicy?.integrityEnabled ||
      policy.highRiskThreshold !== activePolicy?.highRiskThreshold);

  return (
    <Box
      sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
          '& > *:not(:last-child)': { borderRight: { sm: 1 }, borderColor: 'divider' },
        }}
      >
        <AssuranceItem
          icon={LockKeyhole}
          label={t('auditControl.governance.storeControl')}
          value={t('auditControl.governance.appendOnlyActive')}
        />
        <AssuranceItem
          icon={Fingerprint}
          label={t('auditControl.governance.integrityControl')}
          value={
            latestCheckpoint?.verificationStatus === 'VERIFIED'
              ? t('auditControl.governance.lastVerified', { date: latestCheckpoint.checkpointDate })
              : t('auditControl.governance.awaitingCheckpoint')
          }
          state={latestCheckpoint?.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}
        />
        <AssuranceItem
          icon={Download}
          label={t('auditControl.governance.exportControl')}
          value={
            policy.requireExportReason
              ? t('auditControl.governance.reasonRequired')
              : t('auditControl.governance.reasonOptional')
          }
          state={policy.requireExportReason ? 'success' : 'warning'}
        />
        <AssuranceItem
          icon={Archive}
          label={t('auditControl.governance.retentionControl')}
          value={t('auditControl.governance.retentionSummary', {
            standard: policy.standardRetentionDays,
            extended: policy.extendedRetentionDays,
          })}
        />
      </Box>

      <Box
        role="region"
        aria-label={t('auditControl.governance.lifecycle')}
        tabIndex={0}
        sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider', overflowX: 'auto' }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
          sx={{ mb: 2.5 }}
        >
          <Box>
            <Typography component="h2" variant="subtitle1">
              {t('auditControl.governance.lifecycle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('auditControl.governance.lifecycleHint')}
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            color="success"
            label={t('auditControl.governance.revisions.activeRevision', {
              number: policyQuery.data?.activeRevisionNumber ?? 1,
            })}
          />
        </Stack>
        <Stack direction="row" alignItems="flex-start" sx={{ minWidth: 760 }}>
          <LifecycleStep
            icon={Database}
            title={t('auditControl.governance.stageCapture')}
            detail={t('auditControl.governance.stageCaptureHint')}
          />
          <LifecycleStep
            icon={LockKeyhole}
            title={t('auditControl.governance.stageImmutable')}
            detail={t('auditControl.governance.stageImmutableHint')}
          />
          <LifecycleStep
            icon={Archive}
            title={t('auditControl.governance.stageStandard')}
            detail={t('auditControl.governance.days', { count: policy.standardRetentionDays })}
          />
          <LifecycleStep
            icon={Archive}
            title={t('auditControl.governance.stageExtended')}
            detail={t('auditControl.governance.days', { count: policy.extendedRetentionDays })}
          />
          <LifecycleStep
            icon={TimerReset}
            title={t('auditControl.governance.stageDisposition')}
            detail={t('auditControl.governance.stageDispositionHint')}
            last
          />
        </Stack>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          gap={1}
          sx={{ px: 2.5, py: 1.75, bgcolor: 'background.default' }}
        >
          <Box>
            <Stack direction="row" alignItems="center" gap={1}>
              <GitPullRequest size={18} />
              <Typography component="h2" variant="subtitle1">
                {t('auditControl.governance.revisions.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {t('auditControl.governance.revisions.description')}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t('auditControl.governance.revisions.reasonShared')}
          </Typography>
        </Stack>
        <PolicyRevisionLedger
          items={revisionsQuery.data ?? []}
          activeRevisionId={policyQuery.data?.activeRevisionId}
          reason={reason}
          busy={revisionActionMutation.isPending}
          onAction={(revision, action) => revisionActionMutation.mutate({ revision, action })}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.05fr) minmax(420px, 0.95fr)' },
        }}
      >
        <Box sx={{ borderRight: { xl: 1 }, borderColor: 'divider' }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={2}
            sx={{ minHeight: 64, px: 2.5 }}
          >
            <Box minWidth={0}>
              <Typography component="h2" variant="subtitle1">
                {t('auditControl.governance.policy')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('auditControl.governance.policyUpdated', {
                  actor: policyQuery.data?.updatedBy || '—',
                  time: policyQuery.data?.updatedAt
                    ? formatDate(policyQuery.data.updatedAt, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '—',
                })}
              </Typography>
            </Box>
            <ActionButton
              intent="primary"
              startIcon={<Save size={17} />}
              disabled={createRevisionMutation.isPending || !policyChanged || !reason.trim()}
              onClick={() => createRevisionMutation.mutate()}
            >
              {t('auditControl.governance.revisions.create')}
            </ActionButton>
          </Stack>
          <Divider />
          <Box sx={{ p: 2.5 }}>
            <Typography variant="overline" color="text.secondary">
              {t('auditControl.governance.retention')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t('auditControl.governance.retentionHint')}
            </Typography>
            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}
            >
              <FormField
                type="number"
                label={t('auditControl.governance.standardDays')}
                value={policy.standardRetentionDays}
                onChange={(event) => setNumber('standardRetentionDays', event.target.value)}
                slotProps={{ htmlInput: { min: 90, max: 3650 } }}
              />
              <FormField
                type="number"
                label={t('auditControl.governance.extendedDays')}
                value={policy.extendedRetentionDays}
                onChange={(event) => setNumber('extendedRetentionDays', event.target.value)}
                slotProps={{ htmlInput: { min: 365, max: 3650 } }}
              />
            </Box>
            <Divider sx={{ my: 3 }} />
            <Typography variant="overline" color="text.secondary">
              {t('auditControl.governance.riskAndExport')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t('auditControl.governance.riskAndExportHint')}
            </Typography>
            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}
            >
              <FormField
                type="number"
                label={t('auditControl.governance.riskThreshold')}
                value={policy.highRiskThreshold}
                onChange={(event) => setNumber('highRiskThreshold', event.target.value)}
                slotProps={{ htmlInput: { min: 50, max: 100 } }}
              />
              <FormField
                type="number"
                label={t('auditControl.governance.exportLimit')}
                value={policy.exportLimitRows}
                onChange={(event) => setNumber('exportLimitRows', event.target.value)}
                slotProps={{ htmlInput: { min: 100, max: 500000 } }}
              />
            </Box>
            <Stack sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={policy.requireExportReason}
                    onChange={(event) =>
                      setPolicy((current) =>
                        current
                          ? { ...current, requireExportReason: event.target.checked }
                          : current
                      )
                    }
                  />
                }
                label={t('auditControl.governance.requireReason')}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={policy.integrityEnabled}
                    onChange={(event) =>
                      setPolicy((current) =>
                        current ? { ...current, integrityEnabled: event.target.checked } : current
                      )
                    }
                  />
                }
                label={t('auditControl.governance.integrityEnabled')}
              />
            </Stack>
            <Divider sx={{ my: 3 }} />
            <Typography variant="overline" color="text.secondary">
              {t('auditControl.governance.revisions.changeEvidence')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t('auditControl.governance.revisions.changeEvidenceHint')}
            </Typography>
            <Stack gap={2}>
              <FormField
                multiline
                minRows={2}
                label={t('auditControl.governance.revisions.reason')}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 1000 } }}
              />
              <FormField
                label={t('auditControl.governance.revisions.incidentCase')}
                supportingText={t('auditControl.governance.revisions.incidentCaseHint')}
                value={incidentCaseId}
                onChange={(event) => setIncidentCaseId(event.target.value)}
              />
            </Stack>
          </Box>
        </Box>

        <Box>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={2}
            sx={{ minHeight: 64, px: 2.5 }}
          >
            <Box minWidth={0}>
              <Typography component="h2" variant="subtitle1">
                {t('auditControl.governance.integrityLedger')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('auditControl.governance.integrityDescription')}
              </Typography>
            </Box>
            <Stack direction="row" gap={0.5}>
              <ActionIconButton
                label={t('common.actions.refresh')}
                onClick={() => void integrityQuery.refetch()}
              >
                <RefreshCw size={18} />
              </ActionIconButton>
              <ActionButton
                intent="secondary"
                startIcon={<Fingerprint size={17} />}
                disabled={checkpointMutation.isPending || !policy.integrityEnabled}
                onClick={() => checkpointMutation.mutate()}
              >
                {t('auditControl.governance.verify')}
              </ActionButton>
            </Stack>
          </Stack>
          <Divider />
          <Box
            sx={(theme) => ({
              p: 2.25,
              bgcolor: alpha(theme.palette.success.main, 0.045),
              borderBottom: 1,
              borderColor: 'divider',
            })}
          >
            <Stack direction="row" gap={1.25}>
              <Box
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 38,
                  height: 38,
                  bgcolor: 'success.main',
                  color: 'success.contrastText',
                }}
              >
                <ShieldCheck size={20} />
              </Box>
              <Box>
                <Typography component="h3" variant="subtitle2">
                  {t('auditControl.governance.appendOnly')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('auditControl.governance.appendOnlyStatus')}
                </Typography>
              </Box>
            </Stack>
          </Box>
          <IntegrityLedger items={integrityQuery.data ?? []} />
        </Box>
      </Box>
    </Box>
  );
}
