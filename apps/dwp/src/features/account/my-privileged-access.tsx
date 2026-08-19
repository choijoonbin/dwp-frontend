import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3, KeyRound, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listMyPrivilegedAccessRequests,
  listMyPrivilegedRoleEligibilities,
  redirectToSignIn,
  requestPrivilegedAccess,
  revokePrivilegedAccessRequest,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate, useRoleDisplay } from '@dwp-frontend/shared-i18n';
import { ActionButton, FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  PrivilegedAccessRequest,
  PrivilegedRoleEligibility,
} from '@dwp-frontend/shared-utils';
import type { TFunction } from 'i18next';

function dateTime(value?: string | null) {
  return value ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
}

function stateColor(state: PrivilegedAccessRequest['lifecycleState']) {
  if (state === 'ACTIVE') return 'success' as const;
  if (state === 'PENDING_APPROVAL') return 'warning' as const;
  if (state === 'DENIED' || state === 'REVOKED') return 'error' as const;
  return 'default' as const;
}

function scopeLabel(value: PrivilegedRoleEligibility['scopeType'], t: TFunction<'account'>) {
  if (value === 'ORG_UNIT') return t('security.privileged.scope.ORG_UNIT');
  if (value === 'RESOURCE') return t('security.privileged.scope.RESOURCE');
  return t('security.privileged.scope.TENANT');
}

function requestStateLabel(
  value: PrivilegedAccessRequest['lifecycleState'],
  t: TFunction<'account'>
) {
  if (value === 'PENDING_APPROVAL') return t('security.privileged.state.PENDING_APPROVAL');
  if (value === 'DENIED') return t('security.privileged.state.DENIED');
  if (value === 'CANCELLED') return t('security.privileged.state.CANCELLED');
  if (value === 'REVOKED') return t('security.privileged.state.REVOKED');
  if (value === 'EXPIRED') return t('security.privileged.state.EXPIRED');
  return t('security.privileged.state.ACTIVE');
}

function ActivationDialog({
  eligibility,
  busy,
  onClose,
  onSubmit,
}: {
  eligibility: PrivilegedRoleEligibility | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (durationMinutes: number, justification: string, ticketReference?: string) => void;
}) {
  const { t } = useTranslation('account');
  const displayRole = useRoleDisplay();
  const roleName = eligibility ? displayRole(eligibility.roleCode, eligibility.roleName).name : '';
  const [duration, setDuration] = useState('60');
  const [ticket, setTicket] = useState('');
  const [justification, setJustification] = useState('');
  return (
    <FormDialog
      open={Boolean(eligibility)}
      title={t('security.privileged.activateTitle', { role: roleName })}
      description={t('security.privileged.activateDescription')}
      cancelLabel={t('security.actions.cancel')}
      submitLabel={t('security.privileged.activate')}
      submittingLabel={t('security.privileged.activating')}
      busy={busy}
      submitDisabled={justification.trim().length < 10}
      onClose={onClose}
      onSubmit={() => onSubmit(Number(duration), justification.trim(), ticket.trim() || undefined)}
    >
      <Stack gap={2}>
        <SelectField
          label={t('security.privileged.duration')}
          value={duration}
          options={[30, 60, 120, 240].map((minutes) => ({
            value: String(minutes),
            label: t('security.privileged.minutes', { count: minutes }),
          }))}
          onValueChange={(value) => value && setDuration(value)}
        />
        <FormField
          label={t('security.privileged.ticket')}
          supportingText={t('security.privileged.ticketHelp')}
          value={ticket}
          inputProps={{ maxLength: 160 }}
          onChange={(event) => setTicket(event.target.value)}
        />
        <FormField
          autoFocus
          required
          multiline
          minRows={3}
          label={t('security.privileged.justification')}
          supportingText={t('security.privileged.justificationHelp')}
          value={justification}
          inputProps={{ maxLength: 1000 }}
          onChange={(event) => setJustification(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

function RevokeDialog({
  request,
  busy,
  onClose,
  onSubmit,
}: {
  request: PrivilegedAccessRequest | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const { t } = useTranslation('account');
  const displayRole = useRoleDisplay();
  const roleName = request ? displayRole(request.roleCode, request.roleName).name : '';
  const [reason, setReason] = useState('');
  return (
    <FormDialog
      open={Boolean(request)}
      title={t('security.privileged.revokeTitle', { role: roleName })}
      description={t('security.privileged.revokeDescription')}
      cancelLabel={t('security.actions.cancel')}
      submitLabel={
        request?.lifecycleState === 'PENDING_APPROVAL'
          ? t('security.privileged.cancelRequest')
          : t('security.privileged.revoke')
      }
      submitIntent="danger"
      busy={busy}
      submitDisabled={reason.trim().length < 10}
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim())}
    >
      <FormField
        autoFocus
        required
        multiline
        minRows={3}
        label={t('security.privileged.revokeReason')}
        value={reason}
        inputProps={{ maxLength: 1000 }}
        onChange={(event) => setReason(event.target.value)}
      />
    </FormDialog>
  );
}

export function MyPrivilegedAccess() {
  const { t } = useTranslation('account');
  const displayRole = useRoleDisplay();
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [activation, setActivation] = useState<PrivilegedRoleEligibility | null>(null);
  const [revocation, setRevocation] = useState<PrivilegedAccessRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const eligibilities = useQuery({
    queryKey: ['account', 'privileged-access', 'eligibilities'],
    queryFn: listMyPrivilegedRoleEligibilities,
  });
  const requests = useQuery({
    queryKey: ['account', 'privileged-access', 'requests'],
    queryFn: listMyPrivilegedAccessRequests,
  });
  const openRequests = useMemo(
    () =>
      (requests.data ?? []).filter((request) =>
        ['ACTIVE', 'PENDING_APPROVAL'].includes(request.lifecycleState)
      ),
    [requests.data]
  );
  const requestsByEligibility = useMemo(
    () => new Map(openRequests.map((request) => [request.eligibilityId, request])),
    [openRequests]
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['account', 'privileged-access'] });
  };

  const requestActivation = async (
    durationMinutes: number,
    justification: string,
    ticketReference?: string
  ) => {
    if (!activation) return;
    setBusy(true);
    try {
      const result = await requestPrivilegedAccess({
        eligibilityId: activation.eligibilityId,
        requestType: 'JIT',
        durationMinutes,
        justification,
        ticketReference,
      });
      setActivation(null);
      if (result.lifecycleState === 'ACTIVE') {
        toast.success(t('security.privileged.activatedReauthenticate'));
        auth.invalidateSession();
        redirectToSignIn(navigate, location);
        return;
      }
      toast.success(t('security.privileged.requested'));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('security.privileged.requestError'));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (reason: string) => {
    if (!revocation) return;
    setBusy(true);
    try {
      const result = await revokePrivilegedAccessRequest(revocation, reason);
      setRevocation(null);
      if (revocation.lifecycleState === 'ACTIVE' || result.lifecycleState === 'REVOKED') {
        toast.success(t('security.privileged.revokedReauthenticate'));
        auth.invalidateSession();
        redirectToSignIn(navigate, location);
        return;
      }
      toast.success(t('security.privileged.cancelled'));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('security.privileged.revokeError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box component="section" sx={{ mt: 5 }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <KeyRound size={20} strokeWidth={1.8} aria-hidden="true" />
        <Typography component="h2" variant="h6">
          {t('security.privileged.title')}
        </Typography>
        {!eligibilities.isLoading && (
          <Chip size="small" variant="outlined" label={eligibilities.data?.length ?? 0} />
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {t('security.privileged.description')}
      </Typography>
      <Alert severity="info" icon={<ShieldCheck size={20} />} sx={{ mt: 1.5 }}>
        {t('security.privileged.reauthenticationNotice')}
      </Alert>

      {eligibilities.isLoading || requests.isLoading ? (
        <Box sx={{ minHeight: 140, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={26} aria-label={t('security.privileged.loading')} />
        </Box>
      ) : eligibilities.isError || requests.isError ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('security.privileged.loadError')}
        </Alert>
      ) : (eligibilities.data ?? []).length === 0 ? (
        <Box sx={{ py: 4, borderBottom: 1, borderColor: 'divider' }}>
          <Typography component="h3" variant="subtitle2">
            {t('security.privileged.emptyTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('security.privileged.emptyDescription')}
          </Typography>
        </Box>
      ) : (
        <Stack
          divider={<Divider flexItem />}
          sx={{ mt: 1.5, borderTop: 1, borderColor: 'divider' }}
        >
          {(eligibilities.data ?? []).map((eligibility) => {
            const request = requestsByEligibility.get(eligibility.eligibilityId);
            const roleName = displayRole(eligibility.roleCode, eligibility.roleName).name;
            return (
              <Box
                key={eligibility.eligibilityId}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 1fr) 1fr auto' },
                  alignItems: 'center',
                  gap: 2,
                  py: 2.5,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography variant="subtitle2">{roleName}</Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={scopeLabel(eligibility.scopeType, t)}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {eligibility.roleCode}
                  </Typography>
                </Box>
                <Box>
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Clock3 size={15} aria-hidden="true" />
                    <Typography variant="body2">
                      {eligibility.validTo
                        ? t('security.privileged.eligibleUntil', {
                            date: dateTime(eligibility.validTo),
                          })
                        : t('security.privileged.eligibilityNoExpiry')}
                    </Typography>
                  </Stack>
                  {request && (
                    <Chip
                      size="small"
                      color={stateColor(request.lifecycleState)}
                      variant="outlined"
                      label={requestStateLabel(request.lifecycleState, t)}
                      sx={{ mt: 0.75 }}
                    />
                  )}
                </Box>
                {request ? (
                  <ActionButton
                    intent={request.lifecycleState === 'ACTIVE' ? 'danger' : 'quiet'}
                    onClick={() => setRevocation(request)}
                  >
                    {request.lifecycleState === 'ACTIVE'
                      ? t('security.privileged.revoke')
                      : t('security.privileged.cancelRequest')}
                  </ActionButton>
                ) : (
                  <ActionButton intent="primary" onClick={() => setActivation(eligibility)}>
                    {t('security.privileged.activate')}
                  </ActionButton>
                )}
              </Box>
            );
          })}
        </Stack>
      )}

      <ActivationDialog
        key={`activation-${activation?.eligibilityId ?? 'closed'}`}
        eligibility={activation}
        busy={busy}
        onClose={() => setActivation(null)}
        onSubmit={(duration, justification, ticket) =>
          void requestActivation(duration, justification, ticket)
        }
      />
      <RevokeDialog
        key={`revocation-${revocation?.requestId ?? 'closed'}`}
        request={revocation}
        busy={busy}
        onClose={() => setRevocation(null)}
        onSubmit={(reason) => void revoke(reason)}
      />
    </Box>
  );
}
