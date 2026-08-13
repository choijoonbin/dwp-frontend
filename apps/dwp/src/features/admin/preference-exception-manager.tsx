import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, RefreshCw, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  decidePreferenceException,
  listAdminPreferenceExceptions,
  listIdentityUsers,
  useToast,
  type IdentityUserAccess,
  type PreferenceExceptionRequest,
  type PreferenceExceptionState,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  DetailInspector,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
  GuidedEmptyState,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';

import type { GridColDef } from '@mui/x-data-grid';

type QueueState = PreferenceExceptionState | 'ALL';
type Decision = 'APPROVED' | 'REJECTED';

const STATES: QueueState[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'ALL'];
const TERMINAL_STATES: PreferenceExceptionState[] = [
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
];

const stateColor: Record<PreferenceExceptionState, 'warning' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
  EXPIRED: 'default',
};

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '—';
  return JSON.stringify(value);
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ py: 1.5 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="div" variant="body2" sx={{ mt: 0.4, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}

function DecisionDialog({
  request,
  decision,
  busy,
  onClose,
  onSubmit,
}: {
  request: PreferenceExceptionRequest | null;
  decision: Decision | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string, evidenceRef: string) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [reason, setReason] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const approve = decision === 'APPROVED';

  return (
    <FormDialog
      open={Boolean(request && decision)}
      title={t(
        approve
          ? 'preferenceExceptions.decision.approveTitle'
          : 'preferenceExceptions.decision.rejectTitle'
      )}
      description={t(
        approve
          ? 'preferenceExceptions.decision.approveDescription'
          : 'preferenceExceptions.decision.rejectDescription'
      )}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t(
        approve ? 'preferenceExceptions.actions.approve' : 'preferenceExceptions.actions.reject'
      )}
      submittingLabel={t('preferenceExceptions.decision.saving')}
      submitIntent={approve ? 'primary' : 'danger'}
      submitDisabled={reason.trim().length < 10}
      busy={busy}
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim(), evidenceRef.trim())}
    >
      <Stack gap={2}>
        <FormField
          autoFocus
          required
          multiline
          minRows={4}
          label={t('preferenceExceptions.fields.decisionReason')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          supportingText={t('preferenceExceptions.decision.reasonHelp')}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
        <FormField
          label={t('preferenceExceptions.fields.evidence')}
          value={evidenceRef}
          onChange={(event) => setEvidenceRef(event.target.value)}
          supportingText={t('preferenceExceptions.decision.evidenceHelp')}
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
      </Stack>
    </FormDialog>
  );
}

export function PreferenceExceptionManager() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const queryClient = useQueryClient();
  const [state, setState] = useState<QueueState>('PENDING');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);

  const requestsQuery = useQuery({
    queryKey: ['admin', 'preference-exceptions'],
    queryFn: () => listAdminPreferenceExceptions('ALL'),
  });
  const usersQuery = useQuery({
    queryKey: ['admin', 'identity-users', 'preference-exceptions'],
    queryFn: () => listIdentityUsers(),
  });
  const allRequests = requestsQuery.data ?? [];
  const requests =
    state === 'ALL' ? allRequests : allRequests.filter((request) => request.requestState === state);
  const selected =
    allRequests.find((request) => request.requestId === selectedId) ?? requests[0] ?? null;
  const users = useMemo(
    () => new Map((usersQuery.data?.content ?? []).map((user) => [user.userId, user])),
    [usersQuery.data]
  );

  const person = (userId: number): IdentityUserAccess | undefined => users.get(userId);
  const personName = (userId: number) =>
    person(userId)?.displayName ?? t('preferenceExceptions.userFallback', { id: userId });

  const columns = useMemo<GridColDef<PreferenceExceptionRequest>[]>(
    () => [
      {
        field: 'userId',
        headerName: t('preferenceExceptions.columns.requester'),
        minWidth: 180,
        flex: 1,
        valueGetter: (_value, row) =>
          users.get(row.userId)?.displayName ??
          t('preferenceExceptions.userFallback', { id: row.userId }),
      },
      {
        field: 'preferencePath',
        headerName: t('preferenceExceptions.columns.setting'),
        minWidth: 190,
        flex: 1,
        valueFormatter: (value) => t(`preferenceExceptions.paths.${String(value)}`),
      },
      {
        field: 'requestedValue',
        headerName: t('preferenceExceptions.columns.requestedValue'),
        minWidth: 150,
        flex: 0.8,
        valueFormatter: (value) => displayValue(value),
      },
      {
        field: 'requestState',
        headerName: t('preferenceExceptions.columns.state'),
        width: 130,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            color={stateColor[row.requestState]}
            variant={row.requestState === 'PENDING' ? 'filled' : 'outlined'}
            label={t(`preferenceExceptions.states.${row.requestState}`)}
          />
        ),
      },
      {
        field: 'createdAt',
        headerName: t('preferenceExceptions.columns.requestedAt'),
        width: 180,
        valueFormatter: (value) =>
          formatDate(String(value), { dateStyle: 'medium', timeStyle: 'short' }),
      },
    ],
    [t, users]
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'preference-exceptions'] }),
      queryClient.invalidateQueries({
        queryKey: ['admin', 'identity-users', 'preference-exceptions'],
      }),
    ]);
  };

  const submitDecision = async (reason: string, evidenceRef: string) => {
    if (!selected || !decision) return;
    setBusy(true);
    try {
      await decidePreferenceException(selected.requestId, {
        decision,
        reason,
        evidenceRef: evidenceRef || undefined,
        version: selected.version,
      });
      await refresh();
      toast.success(
        t(
          decision === 'APPROVED'
            ? 'preferenceExceptions.toasts.approved'
            : 'preferenceExceptions.toasts.rejected'
        )
      );
      setDecision(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.operationError'));
    } finally {
      setBusy(false);
    }
  };

  if (requestsQuery.isLoading || usersQuery.isLoading) {
    return <AdminPanelLoading label={t('preferenceExceptions.loading')} />;
  }
  if (requestsQuery.isError || usersQuery.isError) {
    const error = requestsQuery.error ?? usersQuery.error;
    return (
      <AdminPanelError
        message={error instanceof Error ? error.message : t('common.operationError')}
      />
    );
  }

  const counts = STATES.filter((candidate) => candidate !== 'ALL').map((candidate) => ({
    state: candidate,
    count: allRequests.filter((request) => request.requestState === candidate).length,
  }));

  return (
    <>
      <Stack gap={2.5}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, 1fr)' },
            borderTop: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {counts.map(({ state: candidate, count }, index) => (
            <Box
              key={candidate}
              sx={{ px: 2, py: 1.5, borderLeft: index ? 1 : 0, borderColor: 'divider' }}
            >
              <Typography variant="caption" color="text.secondary">
                {t(`preferenceExceptions.states.${candidate}`)}
              </Typography>
              <Typography variant="h6" sx={{ mt: 0.25 }}>
                {count}
              </Typography>
            </Box>
          ))}
        </Box>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={1}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={state}
            aria-label={t('preferenceExceptions.filterLabel')}
            onChange={(_event, value: QueueState | null) => {
              if (!value) return;
              setState(value);
              setSelectedId(null);
            }}
          >
            {STATES.map((candidate) => (
              <ToggleButton key={candidate} value={candidate}>
                {t(`preferenceExceptions.states.${candidate}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <ActionIconButton
            label={t('common.actions.refresh')}
            tooltip={t('common.actions.refresh')}
            onClick={() => void refresh()}
          >
            <RefreshCw size={18} />
          </ActionIconButton>
        </Stack>

        {requests.length === 0 ? (
          <GuidedEmptyState
            kind="empty"
            title={t('preferenceExceptions.empty.title')}
            description={t('preferenceExceptions.empty.description')}
            size="standard"
          />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 380px' },
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            {desktop ? (
              <EnterpriseDataGrid
                ariaLabel={t('preferenceExceptions.queueLabel')}
                rows={requests}
                columns={columns}
                getRowId={(row) => row.requestId}
                hideFooter={requests.length <= 25}
                minVisibleRows={5}
                maxVisibleRows={10}
                onRowClick={({ row }) => setSelectedId(row.requestId)}
                sx={{ border: 0, borderRadius: 0 }}
              />
            ) : (
              <Stack
                component="ol"
                aria-label={t('preferenceExceptions.queueLabel')}
                divider={<Divider flexItem />}
                sx={{ listStyle: 'none', p: 0, m: 0 }}
              >
                {requests.map((request) => (
                  <Box component="li" key={request.requestId}>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setSelectedId(request.requestId)}
                      sx={{
                        width: 1,
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                        gap: 1.5,
                        alignItems: 'center',
                        p: 2,
                        border: 0,
                        textAlign: 'left',
                        bgcolor:
                          selected?.requestId === request.requestId
                            ? 'action.selected'
                            : 'transparent',
                        color: 'text.primary',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                        '&:focus-visible': {
                          outline: 2,
                          outlineColor: 'primary.main',
                          outlineOffset: -2,
                        },
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2">
                          {t(`preferenceExceptions.paths.${request.preferencePath}`)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                          {personName(request.userId)} · {displayValue(request.requestedValue)}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={stateColor[request.requestState]}
                        label={t(`preferenceExceptions.states.${request.requestState}`)}
                      />
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
            <Box
              sx={{
                borderLeft: { xs: 0, xl: 1 },
                borderTop: { xs: 1, xl: 0 },
                borderColor: 'divider',
              }}
            >
              {selected && (
                <DetailInspector
                  open
                  title={t(`preferenceExceptions.paths.${selected.preferencePath}`)}
                  subtitle={personName(selected.userId)}
                  closeLabel={t('common.actions.close')}
                  onClose={() => setSelectedId(null)}
                  status={
                    <Chip
                      size="small"
                      color={stateColor[selected.requestState]}
                      label={t(`preferenceExceptions.states.${selected.requestState}`)}
                    />
                  }
                >
                  <Stack divider={<Divider flexItem />}>
                    <DetailRow label={t('preferenceExceptions.fields.requestedValue')}>
                      {displayValue(selected.requestedValue)}
                    </DetailRow>
                    <DetailRow label={t('preferenceExceptions.fields.justification')}>
                      {selected.businessJustification}
                    </DetailRow>
                    <DetailRow label={t('preferenceExceptions.fields.impact')}>
                      {selected.businessImpact}
                    </DetailRow>
                    <DetailRow label={t('preferenceExceptions.fields.owner')}>
                      {selected.assignedOwnerRef}
                    </DetailRow>
                    {selected.requestedUntil && (
                      <DetailRow label={t('preferenceExceptions.fields.requestedUntil')}>
                        {formatDate(selected.requestedUntil, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </DetailRow>
                    )}
                    {selected.decisionReason && (
                      <DetailRow label={t('preferenceExceptions.fields.decisionReason')}>
                        {selected.decisionReason}
                      </DetailRow>
                    )}
                    {selected.decisionEvidenceRef && (
                      <DetailRow label={t('preferenceExceptions.fields.evidence')}>
                        {selected.decisionEvidenceRef}
                      </DetailRow>
                    )}
                  </Stack>
                  {selected.requestState === 'PENDING' && (
                    <>
                      <Alert severity="info" sx={{ mt: 2 }}>
                        {t('preferenceExceptions.approvalNotice')}
                      </Alert>
                      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mt: 2 }}>
                        <ActionButton
                          intent="secondary"
                          startIcon={<X size={16} />}
                          onClick={() => setDecision('REJECTED')}
                        >
                          {t('preferenceExceptions.actions.reject')}
                        </ActionButton>
                        <ActionButton
                          intent="primary"
                          startIcon={<Check size={16} />}
                          onClick={() => setDecision('APPROVED')}
                        >
                          {t('preferenceExceptions.actions.approve')}
                        </ActionButton>
                      </Stack>
                    </>
                  )}
                  {TERMINAL_STATES.includes(selected.requestState) && selected.decidedAt && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 2 }}
                    >
                      {t('preferenceExceptions.decidedAt', {
                        date: formatDate(selected.decidedAt, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }),
                      })}
                    </Typography>
                  )}
                </DetailInspector>
              )}
            </Box>
          </Box>
        )}
      </Stack>
      <DecisionDialog
        key={`${selected?.requestId ?? 'none'}-${decision ?? 'none'}`}
        request={selected}
        decision={decision}
        busy={busy}
        onClose={() => setDecision(null)}
        onSubmit={submitDecision}
      />
    </>
  );
}
