import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Database, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  FormDialog,
  FormField,
  LoadingState,
} from '@dwp-frontend/design-system';
import { decideHrRequest, useToast } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PersonAvatar } from '../../components/person-avatar';

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
  return (
    <Paper component="section" variant="outlined" sx={{ overflow: 'hidden', minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ px: 2, py: 1.75 }}
      >
        <Box minWidth={0}>
          <Typography component="h2" variant="subtitle1" fontWeight={760}>
            {title}
          </Typography>
          {description && (
            <Typography variant="caption" color="text.secondary">
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
        variant="determinate"
        color={tone}
        value={Math.max(0, Math.min(100, progress))}
        sx={{ mt: 1.5, height: 7, borderRadius: 1 }}
      />
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
        {detail}
      </Typography>
    </Paper>
  );
}

export function ReferenceNotice() {
  const { t } = useTranslation('hcm');
  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      gap={1}
      sx={{ p: 1.5, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}
    >
      <Database size={17} aria-hidden="true" />
      <Box>
        <Typography variant="body2" fontWeight={700}>
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
}: {
  domain: 'time' | 'absence';
  items: HrApprovalItem[];
  title: string;
  description: string;
}) {
  const { t } = useTranslation('hcm');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<{
    item: HrApprovalItem;
    action: 'APPROVE' | 'REJECT';
  } | null>(null);
  const [note, setNote] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      decideHrRequest(domain, decision!.item.itemId, {
        decision: decision!.action,
        note: note.trim(),
        version: decision!.item.version,
      }),
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
                    <ActionButton
                      intent="secondary"
                      size="small"
                      startIcon={<X size={15} />}
                      onClick={() => setDecision({ item, action: 'REJECT' })}
                    >
                      {t('domains.approvals.reject')}
                    </ActionButton>
                    <ActionButton
                      intent="primary"
                      size="small"
                      startIcon={<Check size={15} />}
                      onClick={() => setDecision({ item, action: 'APPROVE' })}
                    >
                      {t('domains.approvals.approve')}
                    </ActionButton>
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
        open={Boolean(decision)}
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
  onRetry,
  children,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation('hcm');
  if (loading) return <LoadingState size="standard" label={t('domains.loading')} />;
  if (error) {
    return (
      <ErrorState
        size="standard"
        title={t('common.loadError')}
        description={t('domains.loadError')}
        retryLabel={t('common.retry')}
        onRetry={onRetry}
      />
    );
  }
  return children;
}
