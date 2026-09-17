import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  approveAdminWorkplaceVisit,
  confirmAdminWorkplaceVisitCheckout,
  createWorkplaceIdempotencyKey,
  getAdminWorkplaceVisit,
  getAdminWorkplaceVisitExceptions,
  notifyAdminWorkplaceVisitHost,
  resolveIdempotentMutationIntent,
  retryAdminWorkplaceVisitAccess,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  EmptyState,
  FormField,
  InlineFeedback,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading } from './rooms-ui';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { WorkplaceMobileReservationInspector } from './workplace-mobile-reservation-inspector';
import {
  adminVisitAction,
  isGetOnlyVisitRecovery,
  workplaceVisitTone,
} from './workplace-visits-ui-model';

import type { IdempotentMutationIntent } from '@dwp-frontend/shared-utils';
import type { WorkplaceVisitAction } from './workplace-visits-ui-model';

type AdminAction = Extract<
  WorkplaceVisitAction,
  'APPROVE' | 'RETRY_ACCESS' | 'NOTIFY_HOST' | 'CONFIRM_CHECKOUT'
>;

export function WorkplaceVisitAdmin() {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const capabilities = useRoomsCapabilities();
  const authority = useProductSurfaceAuthority();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('visit');
  const [reason, setReason] = useState('Resolve the verified visitor access exception');
  const [confirmed, setConfirmed] = useState(false);
  const intentRef = useRef<IdempotentMutationIntent | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const canMutate = capabilities.canManageWorkplaceAdmin && elevated;

  const exceptionsQuery = useQuery({
    queryKey: ['workplace', 'visits', 'admin', 'exceptions'],
    queryFn: getAdminWorkplaceVisitExceptions,
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    retry: false,
    refetchInterval: 30_000,
  });
  const exceptions = useMemo(
    () => exceptionsQuery.data?.items ?? [],
    [exceptionsQuery.data?.items]
  );
  useEffect(() => {
    if (!selectedId || exceptions.some((item) => item.visitId === selectedId)) return;
    const next = new URLSearchParams(params);
    next.delete('visit');
    setParams(next, { replace: true });
  }, [exceptions, params, selectedId, setParams]);
  const detailQuery = useQuery({
    queryKey: ['workplace', 'visits', 'admin', selectedId],
    queryFn: () => getAdminWorkplaceVisit(selectedId!),
    enabled: Boolean(selectedId),
    retry: false,
  });
  const selectedException = exceptions.find((item) => item.visitId === selectedId) ?? null;
  const selected = detailQuery.data ?? null;
  const proposedAction = selectedException
    ? (adminVisitAction(selectedException.kind) as AdminAction | null)
    : null;
  const action = selected && !isGetOnlyVisitRecovery(selected.state) ? proposedAction : null;

  const mutation = useMutation({
    mutationFn: (nextAction: AdminAction) => {
      if (!selected || !canMutate || !reason.trim() || !confirmed) {
        throw new Error('VISIT_ADMIN_COMMAND_BLOCKED');
      }
      const input = {
        expectedVersion: selected.version,
        reason: reason.trim(),
        explicitConfirmation: true as const,
      };
      const fingerprint = { action: nextAction, visitId: selected.visitId, ...input };
      const intent = resolveIdempotentMutationIntent(intentRef.current, fingerprint, () =>
        createWorkplaceIdempotencyKey(`visit-admin-${nextAction.toLowerCase()}`)
      );
      intentRef.current = intent;
      const options = { idempotencyKey: intent.key, activeAccessMode: 'ELEVATED' as const };
      if (nextAction === 'APPROVE') {
        return approveAdminWorkplaceVisit(selected.visitId, { ...input, approved: true }, options);
      }
      if (nextAction === 'RETRY_ACCESS') {
        return retryAdminWorkplaceVisitAccess(selected.visitId, input, options);
      }
      if (nextAction === 'NOTIFY_HOST') {
        return notifyAdminWorkplaceVisitHost(selected.visitId, input, options);
      }
      return confirmAdminWorkplaceVisitCheckout(selected.visitId, input, options);
    },
    retry: false,
    onSuccess: async () => {
      intentRef.current = null;
      setConfirmed(false);
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'visits', 'admin'] });
    },
    onError: () =>
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'visits', 'admin'] }),
  });

  const selectVisit = (visitId: string, trigger: HTMLElement) => {
    openerRef.current = trigger;
    const next = new URLSearchParams(params);
    next.set('visit', visitId);
    setParams(next, { replace: true });
  };
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete('visit');
    setParams(next, { replace: true });
  };

  return (
    <PageCanvas topInset="compact" data-testid="workplace-visit-admin">
      <RoomsPageHeading
        eyebrow={t('workplace.visits.admin.eyebrow')}
        title={t('workplace.visits.admin.title')}
        description={t('workplace.visits.admin.description')}
        actions={
          <ActionButton
            intent="secondary"
            startIcon={<RefreshCw size={16} />}
            loading={exceptionsQuery.isFetching}
            onClick={() => void exceptionsQuery.refetch()}
          >
            {t('actions.refresh')}
          </ActionButton>
        }
      />
      <Typography ref={headingRef} component="h2" variant="subtitle1" tabIndex={-1} sx={{ mb: 1 }}>
        {t('workplace.visits.admin.queue', { count: exceptions.length })}
      </Typography>
      {!capabilities.canManageWorkplaceAdmin && (
        <InlineFeedback severity="info" sx={{ mb: 1.5 }}>
          {t('workplace.visits.admin.readOnly')}
        </InlineFeedback>
      )}
      {capabilities.canManageWorkplaceAdmin && !elevated && (
        <InlineFeedback severity="warning" icon={<ShieldAlert size={18} />} sx={{ mb: 1.5 }}>
          {t('workplace.visits.admin.elevationRequired')}
        </InlineFeedback>
      )}
      {exceptionsQuery.isLoading ? (
        <LoadingState
          embedded
          variant="skeleton"
          skeletonRows={5}
          label={t('workplace.visits.loading')}
        />
      ) : exceptionsQuery.isError ? (
        <InlineFeedback severity="error">{t('workplace.visits.admin.loadError')}</InlineFeedback>
      ) : exceptions.length === 0 ? (
        <EmptyState
          title={t('workplace.visits.admin.emptyTitle')}
          description={t('workplace.visits.admin.emptyDescription')}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: selectedId ? 'minmax(0, 1.4fr) minmax(320px, 1fr)' : '1fr',
            },
            gap: 2,
          }}
        >
          <TableContainer sx={(theme) => workplaceMemberCard(theme)}>
            <Table aria-label={t('workplace.visits.admin.tableLabel')} size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('workplace.visits.admin.columns.guest')}</TableCell>
                  <TableCell>{t('workplace.visits.admin.columns.exception')}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    {t('workplace.visits.admin.columns.start')}
                  </TableCell>
                  <TableCell align="right">{t('workplace.visits.admin.columns.action')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {exceptions.map((item) => (
                  <TableRow key={item.visitId} selected={item.visitId === selectedId}>
                    <TableCell sx={{ overflowWrap: 'anywhere' }}>{item.maskedGuestLabel}</TableCell>
                    <TableCell>
                      <Stack gap={0.5} alignItems="flex-start">
                        <Chip
                          size="small"
                          color={workplaceVisitTone(item.state)}
                          label={t(`workplace.visits.exceptionKinds.${item.kind}`)}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {t(`workplace.visits.states.${item.state}`)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      {formatDate(
                        item.startsAt,
                        { dateStyle: 'short', timeStyle: 'short' },
                        locale
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <ActionButton
                        size="small"
                        intent="quiet"
                        onClick={(event) => selectVisit(item.visitId, event.currentTarget)}
                      >
                        {t('workplace.visits.admin.inspect')}
                      </ActionButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {selectedId && (
            <WorkplaceMobileReservationInspector
              label={t('workplace.visits.admin.inspector')}
              closeLabel={t('actions.close')}
              fallbackFocusRef={headingRef}
              openerRef={openerRef}
              onClose={close}
            >
              <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                {detailQuery.isLoading ? (
                  <LoadingState embedded label={t('workplace.visits.loading')} />
                ) : detailQuery.isError || !selected ? (
                  <InlineFeedback severity="error">
                    {t('workplace.visits.admin.detailError')}
                  </InlineFeedback>
                ) : (
                  <Stack spacing={1.5}>
                    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                      <Chip
                        size="small"
                        color={workplaceVisitTone(selected.state)}
                        label={t(`workplace.visits.states.${selected.state}`)}
                      />
                      <Typography component="h3" variant="h6">
                        {selected.guests[0]?.maskedLabel ?? t('workplace.visits.maskedGuest')}
                      </Typography>
                    </Stack>
                    <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}>
                      <Typography variant="body2">
                        {t('workplace.visits.admin.requester', {
                          id: selected.requesterUserId,
                        })}
                      </Typography>
                      <Typography variant="body2">
                        {t('workplace.visits.admin.zones', {
                          count: selected.zoneIds.length,
                        })}
                      </Typography>
                      {selected.limitationCode && (
                        <Typography variant="body2" color="warning.main">
                          {selected.limitationCode}
                        </Typography>
                      )}
                    </Box>
                    {isGetOnlyVisitRecovery(selected.state) && (
                      <InlineFeedback severity="warning" icon={<AlertTriangle size={18} />}>
                        {t('workplace.visits.recovery.getOnly')}
                        <ActionButton
                          intent="quiet"
                          size="small"
                          onClick={() => void detailQuery.refetch()}
                        >
                          {t('workplace.visits.actions.refreshStatus')}
                        </ActionButton>
                      </InlineFeedback>
                    )}
                    {action && (
                      <>
                        <FormField
                          label={t('workplace.visits.fields.reason')}
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={confirmed}
                              onChange={(event) => setConfirmed(event.target.checked)}
                            />
                          }
                          label={t('workplace.visits.admin.confirmation')}
                        />
                        <ActionButton
                          intent="primary"
                          disabled={!canMutate || !confirmed || !reason.trim()}
                          loading={mutation.isPending}
                          onClick={() => mutation.mutate(action)}
                        >
                          {t(`workplace.visits.actions.${action}`)}
                        </ActionButton>
                      </>
                    )}
                    {mutation.isError && (
                      <InlineFeedback severity="error">
                        {t('workplace.visits.commandError')}
                      </InlineFeedback>
                    )}
                    <Box>
                      <Typography component="h4" variant="subtitle2" fontWeight="fontWeightBold">
                        {t('workplace.visits.timeline')}
                      </Typography>
                      {selected.timeline.map((item) => (
                        <Typography key={item.eventId} variant="body2" sx={{ mt: 0.75 }}>
                          {t(`workplace.visits.states.${item.state}`)} · {item.eventType}
                        </Typography>
                      ))}
                    </Box>
                  </Stack>
                )}
              </Box>
            </WorkplaceMobileReservationInspector>
          )}
        </Box>
      )}
    </PageCanvas>
  );
}
