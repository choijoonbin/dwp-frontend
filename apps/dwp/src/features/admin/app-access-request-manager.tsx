import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, FileCheck2, KeyRound, RefreshCw, ShieldCheck, ShieldOff, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  decideAppAccessRequest,
  fulfillAppAccessRequest,
  listAppAccessRequests,
  listIdentityUsers,
  revokeAppAccessRequest,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  GuidedEmptyState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { hasFullTenantAdminRole } from '@dwp-frontend/shared-utils/auth/control-plane-access';

import type { AppAccessRequest, IdentityUserAccess } from '@dwp-frontend/shared-utils';

type RequestState = AppAccessRequest['state'] | 'ALL';
type FulfillmentOperation = 'FULFILL' | 'REVOKE';

const STATES: RequestState[] = [
  'PENDING',
  'APPROVED',
  'REVOKED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'ALL',
];

function DecisionDialog({
  request,
  decision,
  busy,
  onClose,
  onSubmit,
}: {
  request: AppAccessRequest | null;
  decision: 'APPROVED' | 'REJECTED' | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [note, setNote] = useState('');
  const valid = note.trim().length >= 10;
  return (
    <FormDialog
      open={Boolean(request && decision)}
      title={t(`appAccess.decision.${decision === 'APPROVED' ? 'approveTitle' : 'rejectTitle'}`, {
        app: request?.appName ?? '',
      })}
      description={t(
        `appAccess.decision.${decision === 'APPROVED' ? 'approveDescription' : 'rejectDescription'}`
      )}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t(`appAccess.decision.${decision === 'APPROVED' ? 'approve' : 'reject'}`)}
      submittingLabel={t('appAccess.decision.saving')}
      submitDisabled={!valid}
      busy={busy}
      onClose={onClose}
      onSubmit={() => onSubmit(note.trim())}
      maxWidth="sm"
    >
      <FormField
        label={t('appAccess.decision.note')}
        multiline
        minRows={4}
        required
        value={note}
        onChange={(event) => setNote(event.target.value)}
        supportingText={t('appAccess.decision.noteHelp')}
        slotProps={{ htmlInput: { maxLength: 1000 } }}
      />
    </FormDialog>
  );
}

function FulfillmentDialog({
  request,
  operation,
  busy,
  onClose,
  onSubmit,
}: {
  request: AppAccessRequest | null;
  operation: FulfillmentOperation | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [note, setNote] = useState('');
  const action = operation === 'REVOKE' ? 'revoke' : 'fulfill';
  return (
    <FormDialog
      open={Boolean(request && operation)}
      title={t(`appAccess.fulfillment.${action}Title`, { app: request?.appName ?? '' })}
      description={t(`appAccess.fulfillment.${action}Description`)}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t(`appAccess.fulfillment.${action}`)}
      submittingLabel={t('appAccess.fulfillment.saving')}
      submitDisabled={note.trim().length < 10}
      busy={busy}
      onClose={onClose}
      onSubmit={() => onSubmit(note.trim())}
      submitIntent={operation === 'REVOKE' ? 'danger' : 'primary'}
      maxWidth="sm"
    >
      <FormField
        label={t('appAccess.fulfillment.note')}
        multiline
        minRows={4}
        required
        value={note}
        onChange={(event) => setNote(event.target.value)}
        supportingText={t('appAccess.fulfillment.noteHelp')}
        slotProps={{ htmlInput: { maxLength: 1000 } }}
      />
    </FormDialog>
  );
}

export function AppAccessRequestManager() {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [state, setState] = useState<RequestState>('PENDING');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [fulfillmentOperation, setFulfillmentOperation] = useState<FulfillmentOperation | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const requestsQuery = useQuery({
    queryKey: ['admin', 'app-access-requests'],
    queryFn: () => listAppAccessRequests('ALL'),
  });
  const usersQuery = useQuery({
    queryKey: ['admin', 'identity-users', 'app-access'],
    queryFn: () => listIdentityUsers(),
    enabled: hasFullTenantAdminRole(auth.user?.roles ?? []),
  });
  const allRequests = requestsQuery.data ?? [];
  const requests =
    state === 'ALL' ? allRequests : allRequests.filter((request) => request.state === state);
  const selected =
    requests.find((request) => request.requestId === selectedId) ?? requests[0] ?? null;
  const users = useMemo(
    () => new Map((usersQuery.data?.content ?? []).map((user) => [user.userId, user])),
    [usersQuery.data]
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'app-access-requests'] });
  };

  const saveDecision = async (note: string) => {
    if (!selected || !decision) return;
    setBusy(true);
    try {
      await decideAppAccessRequest(selected, decision, note);
      await refresh();
      setDecision(null);
      toast.success(t(`appAccess.toasts.${decision === 'APPROVED' ? 'approved' : 'rejected'}`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.operationError'));
    } finally {
      setBusy(false);
    }
  };

  const saveFulfillment = async (note: string) => {
    if (!selected || !fulfillmentOperation) return;
    setBusy(true);
    try {
      const updated =
        fulfillmentOperation === 'FULFILL'
          ? await fulfillAppAccessRequest(selected, note)
          : await revokeAppAccessRequest(selected, note);
      await refresh();
      setFulfillmentOperation(null);
      if (updated.fulfillmentState === 'FAILED') {
        toast.error(t('appAccess.toasts.fulfillmentFailed'));
      } else {
        toast.success(
          t(`appAccess.toasts.${fulfillmentOperation === 'FULFILL' ? 'fulfilled' : 'revoked'}`)
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.operationError'));
    } finally {
      setBusy(false);
    }
  };

  if (requestsQuery.isLoading || (usersQuery.isLoading && usersQuery.fetchStatus !== 'idle')) {
    return <ManagementPanelLoading label={t('appAccess.loading')} />;
  }
  if (requestsQuery.isError || (usersQuery.isError && usersQuery.fetchStatus !== 'idle')) {
    const error = requestsQuery.error ?? usersQuery.error;
    return (
      <ManagementPanelError
        message={error instanceof Error ? error.message : t('common.operationError')}
      />
    );
  }

  const selectedUser: IdentityUserAccess | null = selected
    ? (users.get(selected.userId) ?? null)
    : null;
  const counts = STATES.slice(0, -1).map((candidate) => ({
    state: candidate,
    count: allRequests.filter((request) => request.state === candidate).length,
  }));
  const canDecideSelected = Boolean(
    selected &&
    (auth.user?.resourceRoles ?? []).some(
      (role) =>
        role.responsibilityCode === 'APP_ACCESS_APPROVER' &&
        role.resourceKey === selected.resourceKey
    ) &&
    selected.userId !== auth.user?.userId
  );
  const hasManagerScope = Boolean(
    selected &&
    (auth.user?.resourceRoles ?? []).some(
      (role) =>
        role.responsibilityCode === 'APP_ACCESS_MANAGER' &&
        role.resourceKey === selected.resourceKey
    )
  );
  const canFulfillSelected = Boolean(
    selected &&
    hasManagerScope &&
    selected.userId !== auth.user?.userId &&
    selected.decidedBy !== auth.user?.userId &&
    selected.state === 'APPROVED' &&
    ['PENDING', 'FAILED'].includes(selected.fulfillmentState)
  );
  const canRevokeSelected = Boolean(
    selected &&
    hasManagerScope &&
    selected.userId !== auth.user?.userId &&
    selected.state === 'APPROVED' &&
    selected.fulfillmentState === 'SUCCEEDED'
  );

  return (
    <>
      <Stack gap={2.5}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(6, minmax(0, 1fr))',
            },
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
                {t(`appAccess.states.${candidate}`)}
              </Typography>
              <Typography variant="h6" sx={{ mt: 0.25 }}>
                {count}
              </Typography>
            </Box>
          ))}
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          gap={1}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={state}
            onChange={(_event, value: RequestState | null) => {
              if (!value) return;
              setState(value);
              setSelectedId(null);
            }}
            aria-label={t('appAccess.filterLabel')}
            sx={{
              maxWidth: '100%',
              overflowX: 'auto',
              alignSelf: 'flex-start',
              '& .MuiToggleButton-root': {
                flex: '0 0 auto',
                minHeight: 44,
                whiteSpace: 'nowrap',
              },
            }}
          >
            {STATES.map((candidate) => (
              <ToggleButton key={candidate} value={candidate}>
                {t(`appAccess.states.${candidate}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <ActionIconButton label={t('common.actions.refresh')} onClick={() => void refresh()}>
            <RefreshCw size={18} />
          </ActionIconButton>
        </Stack>

        {requests.length ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(360px, 0.9fr) minmax(0, 1.35fr)' },
              minHeight: 480,
              borderTop: 1,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Stack
              component="ul"
              sx={{ p: 0, m: 0, listStyle: 'none', borderRight: { lg: 1 }, borderColor: 'divider' }}
              divider={<Divider flexItem />}
            >
              {requests.map((request) => {
                const user = users.get(request.userId);
                return (
                  <Box component="li" key={request.requestId}>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setSelectedId(request.requestId)}
                      sx={{
                        width: 1,
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
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" noWrap>
                            {request.appName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {user?.displayName ??
                              t('appAccess.userFallback', { id: request.userId })}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          variant="outlined"
                          color={
                            request.state === 'PENDING'
                              ? 'warning'
                              : request.state === 'APPROVED'
                                ? 'success'
                                : 'default'
                          }
                          label={t(`appAccess.states.${request.state}`)}
                        />
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mt: 1 }}
                      >
                        {formatDate(request.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Stack>

            {selected ? (
              <Stack gap={2.25} sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack
                  direction="row"
                  alignItems="flex-start"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Box>
                    <Typography component="h2" variant="h6">
                      {selected.appName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selected.resourceKey}:{selected.requestedPermissionCode}
                    </Typography>
                  </Box>
                  <Chip
                    label={t(`appAccess.states.${selected.state}`)}
                    color={
                      selected.state === 'PENDING'
                        ? 'warning'
                        : selected.state === 'APPROVED'
                          ? 'success'
                          : 'default'
                    }
                  />
                </Stack>

                <Box sx={{ display: 'grid', gridTemplateColumns: '130px minmax(0, 1fr)', gap: 1 }}>
                  {[
                    [
                      t('appAccess.fields.requester'),
                      selectedUser?.displayName ??
                        t('appAccess.userFallback', { id: selected.userId }),
                    ],
                    [
                      t('appAccess.fields.email'),
                      selectedUser?.email ?? t('appAccess.notAvailable'),
                    ],
                    [
                      t('appAccess.fields.requestedUntil'),
                      selected.requestedUntil
                        ? formatDate(selected.requestedUntil, { dateStyle: 'medium' })
                        : t('appAccess.noExpiry'),
                    ],
                    [
                      t('appAccess.fields.requestedAt'),
                      formatDate(selected.createdAt, { dateStyle: 'medium', timeStyle: 'short' }),
                    ],
                    [
                      t('appAccess.fields.fulfillment'),
                      t(`appAccess.fulfillmentStates.${selected.fulfillmentState}`),
                    ],
                    [t('appAccess.fields.attempts'), String(selected.fulfillmentAttempts)],
                  ].map(([label, value]) => (
                    <Box key={String(label)} sx={{ display: 'contents' }}>
                      <Typography variant="caption" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography variant="body2">{value}</Typography>
                    </Box>
                  ))}
                </Box>

                <Box>
                  <Typography variant="subtitle2">{t('appAccess.fields.justification')}</Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}
                  >
                    {selected.justification}
                  </Typography>
                </Box>

                {selected.decisionNote ? (
                  <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', py: 1.5 }}>
                    <Stack direction="row" gap={1} alignItems="center">
                      <FileCheck2 size={17} />
                      <Typography variant="subtitle2">{t('appAccess.fields.decision')}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                      {selected.decisionNote}
                    </Typography>
                  </Box>
                ) : null}

                {selected.lastFulfillmentError ? (
                  <Box sx={{ borderLeft: 3, borderColor: 'error.main', pl: 1.5, py: 0.5 }}>
                    <Typography variant="subtitle2" color="error.main">
                      {t('appAccess.fulfillment.failureEvidence')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                      {selected.lastFulfillmentError}
                    </Typography>
                  </Box>
                ) : null}

                {selected.state === 'PENDING' && canDecideSelected ? (
                  <Stack direction="row" gap={1} justifyContent="flex-end">
                    <ActionButton
                      intent="danger"
                      startIcon={<X size={16} />}
                      onClick={() => setDecision('REJECTED')}
                    >
                      {t('appAccess.decision.reject')}
                    </ActionButton>
                    <ActionButton
                      intent="primary"
                      startIcon={<Check size={16} />}
                      onClick={() => setDecision('APPROVED')}
                    >
                      {t('appAccess.decision.approve')}
                    </ActionButton>
                  </Stack>
                ) : selected.state === 'APPROVED' ? (
                  <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                    <Stack direction="row" gap={1} alignItems="flex-start">
                      <ShieldCheck size={18} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2">
                          {t('appAccess.fulfillment.title')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                          {t(`appAccess.fulfillmentDescriptions.${selected.fulfillmentState}`)}
                        </Typography>
                      </Box>
                      {canFulfillSelected ? (
                        <ActionButton
                          intent="primary"
                          startIcon={<KeyRound size={16} />}
                          onClick={() => setFulfillmentOperation('FULFILL')}
                        >
                          {t(
                            `appAccess.fulfillment.${selected.fulfillmentState === 'FAILED' ? 'retry' : 'fulfill'}`
                          )}
                        </ActionButton>
                      ) : canRevokeSelected ? (
                        <ActionButton
                          intent="danger"
                          startIcon={<ShieldOff size={16} />}
                          onClick={() => setFulfillmentOperation('REVOKE')}
                        >
                          {t('appAccess.fulfillment.revoke')}
                        </ActionButton>
                      ) : null}
                    </Stack>
                  </Box>
                ) : null}
              </Stack>
            ) : null}
          </Box>
        ) : (
          <GuidedEmptyState
            kind="empty"
            title={t('appAccess.empty.title')}
            description={t('appAccess.empty.description')}
            size="standard"
          />
        )}
      </Stack>

      <DecisionDialog
        key={`decision:${selected?.requestId ?? 'none'}:${decision ?? 'none'}`}
        request={selected}
        decision={decision}
        busy={busy}
        onClose={() => setDecision(null)}
        onSubmit={saveDecision}
      />
      <FulfillmentDialog
        key={`fulfillment:${selected?.requestId ?? 'none'}:${fulfillmentOperation ?? 'none'}`}
        request={selected}
        operation={fulfillmentOperation}
        busy={busy}
        onClose={() => setFulfillmentOperation(null)}
        onSubmit={saveFulfillment}
      />
    </>
  );
}
