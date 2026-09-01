import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Database, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ActionButton, EmptyState, FormDialog, FormField } from '@dwp-frontend/design-system';
import { decideHrRequest, decideHrTeamRequest, useToast } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PersonAvatar } from '../../components/person-avatar';
import { HcmQueryState } from '../../components/hcm-query-state';
import { useProductActionMutation } from '../../components/use-product-action-mutation';
import { useProductSurfaceCapabilityAccess } from '../../components/product-surface-capability-access';
import { canDiscloseHcmApprovalAction } from './hcm-approval-action-access';

import type { HrApprovalItem } from '@dwp-frontend/shared-utils';

export function DomainSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      sx={{ overflow: 'hidden', minWidth: 0 }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ px: 2, py: 1.75 }}
      >
        <Box minWidth={0}>
          <Typography id={titleId} component="h2" variant="subtitle1" fontWeight={760}>
            {title}
          </Typography>
          {description && (
            <Typography id={descriptionId} variant="caption" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      <Divider />
      {children}
    </Paper>
  );
}

export function ProgressSignal({
  label,
  value,
  detail,
  progress,
  tone = 'primary',
}: {
  label: string;
  value: string;
  detail: string;
  progress: number;
  tone?: 'primary' | 'success' | 'warning' | 'error';
}) {
  const detailId = useId();
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography component="p" variant="h5" fontWeight={780}>
          {value}
        </Typography>
      </Stack>
      <LinearProgress
        aria-label={label}
        aria-describedby={detailId}
        aria-valuetext={`${value}. ${detail}`}
        variant="determinate"
        color={tone}
        value={Math.max(0, Math.min(100, progress))}
        sx={{ mt: 1.5, height: 7, borderRadius: 1 }}
      />
      <Typography
        id={detailId}
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ mt: 1 }}
      >
        {detail}
      </Typography>
    </Paper>
  );
}

export function ReferenceNotice() {
  const { t } = useTranslation('hcm');
  const titleId = useId();
  return (
    <Stack
      component="aside"
      role="note"
      aria-labelledby={titleId}
      direction="row"
      alignItems="flex-start"
      gap={1}
      sx={{ p: 1.5, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}
    >
      <Database size={17} aria-hidden="true" />
      <Box>
        <Typography id={titleId} variant="body2" fontWeight={700}>
          {t('domains.reference.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('domains.reference.description')}
        </Typography>
      </Box>
    </Stack>
  );
}

export function StatusChip({ status }: { status: string }) {
  const { t } = useTranslation('hcm');
  const normalized = status.toUpperCase();
  const color =
    normalized === 'APPROVED' || normalized === 'ACTIVE' || normalized === 'COMPLETED'
      ? 'success'
      : normalized === 'REJECTED' || normalized === 'CANCELLED' || normalized === 'AT_RISK'
        ? 'error'
        : normalized === 'SUBMITTED' || normalized === 'IN_PROGRESS'
          ? 'warning'
          : 'default';
  return (
    <Chip
      size="small"
      color={color}
      variant="outlined"
      label={t(`domains.status.${normalized}`, { defaultValue: normalized })}
    />
  );
}

export function ApprovalQueue({
  domain,
  items,
  title,
  description,
  decisionScope = 'operations',
}: {
  domain: 'time' | 'absence';
  items: HrApprovalItem[];
  title: string;
  description: string;
  decisionScope?: 'operations' | 'team';
}) {
  const { t } = useTranslation('hcm');
  const toast = useToast();
  const queryClient = useQueryClient();
  const capabilityAccess = useProductSurfaceCapabilityAccess();
  const canDecide = canDiscloseHcmApprovalAction(capabilityAccess, decisionScope, domain);
  const [decision, setDecision] = useState<{
    item: HrApprovalItem;
    action: 'APPROVE' | 'REJECT';
  } | null>(null);
  const [note, setNote] = useState('');
  const operationsTimeDecision = useProductActionMutation(
    'route.hcm.operations.time-approve.action'
  );
  const operationsAbsenceDecision = useProductActionMutation(
    'route.hcm.operations.absence-approve.action'
  );
  const teamTimeDecision = useProductActionMutation('route.hcm.team.time-decision.action');
  const teamAbsenceDecision = useProductActionMutation('route.hcm.team.absence-decision.action');
  useEffect(() => {
    setDecision(null);
    setNote('');
  }, [capabilityAccess.contextScopeKey]);
  const mutation = useMutation({
    mutationFn: () => {
      if (!canDecide) throw new Error('The approval action is not authorized.');
      const decide = decisionScope === 'team' ? decideHrTeamRequest : decideHrRequest;
      const govern =
        decisionScope === 'team'
          ? domain === 'time'
            ? teamTimeDecision
            : teamAbsenceDecision
          : domain === 'time'
            ? operationsTimeDecision
            : operationsAbsenceDecision;
      return govern((authority) =>
        decide(
          domain,
          decision!.item.itemId,
          {
            decision: decision!.action,
            note: note.trim(),
            version: decision!.item.version,
          },
          authority
        )
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['hcm'] });
      toast.success(t('domains.approvals.saved'));
      setDecision(null);
      setNote('');
    },
    onError: () => toast.error(t('domains.approvals.error')),
  });

  return (
    <>
      <DomainSection title={title} description={description}>
        {items.length ? (
          <Box>
            {items.map((item, index) => (
              <Box key={item.itemId}>
                {index > 0 && <Divider />}
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  gap={1.5}
                  sx={{ px: 2, py: 1.5 }}
                >
                  <Stack direction="row" alignItems="center" gap={1.25} minWidth={0} flex={1}>
                    <PersonAvatar name={item.employeeName} size={38} />
                    <Box minWidth={0}>
                      <Typography variant="body2" fontWeight={750} noWrap>
                        {item.employeeName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {[item.employeeTitle, item.summary].filter(Boolean).join(' · ')}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <StatusChip status={item.status} />
                    {canDecide && (
                      <>
                        <ActionButton
                          intent="secondary"
                          size="small"
                          startIcon={<X size={15} aria-hidden="true" />}
                          aria-label={t('domains.approvals.rejectFor', {
                            name: item.employeeName,
                          })}
                          onClick={() => setDecision({ item, action: 'REJECT' })}
                        >
                          {t('domains.approvals.reject')}
                        </ActionButton>
                        <ActionButton
                          intent="primary"
                          size="small"
                          startIcon={<Check size={15} aria-hidden="true" />}
                          aria-label={t('domains.approvals.approveFor', {
                            name: item.employeeName,
                          })}
                          onClick={() => setDecision({ item, action: 'APPROVE' })}
                        >
                          {t('domains.approvals.approve')}
                        </ActionButton>
                      </>
                    )}
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Box>
        ) : (
          <EmptyState
            size="compact"
            title={t('domains.approvals.emptyTitle')}
            description={t('domains.approvals.emptyDescription')}
          />
        )}
      </DomainSection>

      <FormDialog
        open={Boolean(decision) && canDecide}
        title={t(
          `domains.approvals.${decision?.action === 'APPROVE' ? 'approveTitle' : 'rejectTitle'}`
        )}
        description={
          decision ? `${decision.item.employeeName} · ${decision.item.summary}` : undefined
        }
        cancelLabel={t('domains.actions.cancel')}
        submitLabel={t('domains.actions.confirm')}
        submitIntent={decision?.action === 'APPROVE' ? 'primary' : 'danger'}
        busy={mutation.isPending}
        submitDisabled={note.trim().length < 3}
        onClose={() => setDecision(null)}
        onSubmit={() => mutation.mutate()}
      >
        <FormField
          autoFocus
          multiline
          minRows={3}
          label={t('domains.approvals.note')}
          supportingText={t('domains.approvals.noteHint')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
      </FormDialog>
    </>
  );
}

export function QueryBoundary({
  loading,
  error,
  retrying = false,
  onRetry,
  children,
}: {
  loading: boolean;
  error: unknown;
  retrying?: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (loading || error) {
    return <HcmQueryState loading={loading} error={error} retrying={retrying} onRetry={onRetry} />;
  }
  return (
    <Box data-testid="hcm-query-state" data-query-state="ready" minWidth={0}>
      {children}
    </Box>
  );
}
