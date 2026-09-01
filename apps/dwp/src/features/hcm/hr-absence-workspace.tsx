import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, Clock, RotateCcw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  DatePickerField,
  EmptyState,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  createHrLeaveRequest,
  getHrAbsence,
  useToast,
  withdrawHrLeaveRequest,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  DomainSection,
  ProgressSignal,
  QueryBoundary,
  ReferenceNotice,
  StatusChip,
} from './hr-domain-components';
import type { HrLeaveRequest } from '@dwp-frontend/shared-utils';
import { useProductActionMutation } from '../../components/use-product-action-mutation';

function minutesToDays(minutes: number): string {
  const days = minutes / 480;
  return Number.isInteger(days) ? String(days) : days.toFixed(1);
}

export function HrAbsenceWorkspace() {
  const { t } = useTranslation('hcm');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useQuery({
    queryKey: ['hcm', 'absence'],
    queryFn: getHrAbsence,
    staleTime: 20_000,
  });
  const [requestOpen, setRequestOpen] = useState(false);
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hours, setHours] = useState(8);
  const [reason, setReason] = useState('');
  const [withdrawing, setWithdrawing] = useState<HrLeaveRequest | null>(null);
  const [withdrawalNote, setWithdrawalNote] = useState('');
  const createLeave = useProductActionMutation('route.hcm.personal.absence-create.action');
  const withdrawLeave = useProductActionMutation('route.hcm.personal.absence-withdraw.action');

  useEffect(() => {
    if (searchParams.get('request') !== 'open') return;
    setRequestOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!planId && query.data?.balances[0]) setPlanId(query.data.balances[0].planId);
  }, [planId, query.data?.balances]);

  const createMutation = useMutation({
    mutationFn: () =>
      createLeave((authority) =>
        createHrLeaveRequest(
          {
            planId,
            startAt: new Date(`${startDate}T09:00:00`).toISOString(),
            endAt: new Date(`${endDate}T18:00:00`).toISOString(),
            requestedMinutes: hours * 60,
            reason: reason.trim() || undefined,
          },
          authority
        )
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['hcm'] });
      setRequestOpen(false);
      setReason('');
      toast.success(t('domains.absence.submitted'));
    },
    onError: () => toast.error(t('domains.absence.submitError')),
  });
  const withdrawMutation = useMutation({
    mutationFn: () =>
      withdrawLeave((authority) =>
        withdrawHrLeaveRequest(
          withdrawing!.requestId,
          { note: withdrawalNote.trim(), version: withdrawing!.version },
          authority
        )
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(['hcm', 'absence'], data);
      void queryClient.invalidateQueries({ queryKey: ['hcm', 'home-overview'] });
      setWithdrawing(null);
      setWithdrawalNote('');
      toast.success(t('domains.absence.withdrawn'));
    },
    onError: () => toast.error(t('domains.absence.withdrawError')),
  });
  const requestValid =
    Boolean(planId && startDate && endDate) &&
    new Date(endDate).getTime() >= new Date(startDate).getTime() &&
    hours > 0 &&
    hours <= 240;
  return (
    <QueryBoundary
      loading={query.isLoading}
      error={query.error}
      retrying={query.isFetching}
      onRetry={() => void query.refetch()}
    >
      <Stack gap={2}>
        {query.data?.balances.some((balance) => balance.dataOrigin === 'REFERENCE') && (
          <ReferenceNotice />
        )}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          {(query.data?.balances ?? []).slice(0, 3).map((balance) => (
            <ProgressSignal
              key={balance.planId}
              label={balance.planName}
              value={t('domains.absence.daysAvailable', {
                value: minutesToDays(balance.availableMinutes),
              })}
              detail={t('domains.absence.balanceDetail', {
                used: minutesToDays(balance.usedMinutes),
                pending: minutesToDays(balance.pendingMinutes),
              })}
              progress={
                balance.grantedMinutes ? (balance.usedMinutes / balance.grantedMinutes) * 100 : 0
              }
              tone={balance.availableMinutes > 0 ? 'success' : 'warning'}
            />
          ))}
          {!query.data?.balances.length && (
            <EmptyState
              title={t('domains.absence.noBalanceTitle')}
              description={t('domains.absence.noBalanceDescription')}
            />
          )}
        </Box>

        <DomainSection
          title={t('domains.absence.historyTitle')}
          description={t('domains.absence.historyDescription')}
          action={
            <ActionButton
              intent="primary"
              size="small"
              startIcon={<CalendarPlus size={16} />}
              disabled={!query.data?.balances.length}
              onClick={() => setRequestOpen(true)}
            >
              {t('domains.absence.request')}
            </ActionButton>
          }
        >
          {query.data?.requests.length ? (
            <Box>
              {query.data.requests.map((request, index) => (
                <Box key={request.requestId}>
                  {index > 0 && <Divider />}
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                    gap={1.5}
                    sx={{ px: 2, py: 1.5 }}
                  >
                    <Box minWidth={0} flex={1}>
                      <Typography variant="body2" fontWeight={750}>
                        {request.planName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(request.startAt, { dateStyle: 'medium' })} -{' '}
                        {formatDate(request.endAt, { dateStyle: 'medium' })}
                      </Typography>
                    </Box>
                    <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        <Clock size={14} aria-hidden="true" />
                        <Typography variant="caption" fontWeight={700}>
                          {t('domains.absence.hours', {
                            value: request.requestedMinutes / 60,
                          })}
                        </Typography>
                      </Stack>
                      <StatusChip status={request.status} />
                      {request.status === 'SUBMITTED' && (
                        <ActionButton
                          intent="quiet"
                          size="small"
                          startIcon={<RotateCcw size={14} />}
                          onClick={() => {
                            setWithdrawing(request);
                            setWithdrawalNote('');
                          }}
                        >
                          {t('domains.actions.withdraw')}
                        </ActionButton>
                      )}
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Box>
          ) : (
            <EmptyState
              size="compact"
              title={t('domains.absence.noRequestsTitle')}
              description={t('domains.absence.noRequestsDescription')}
            />
          )}
        </DomainSection>
      </Stack>

      <FormDialog
        open={requestOpen}
        title={t('domains.absence.requestTitle')}
        cancelLabel={t('domains.actions.cancel')}
        submitLabel={t('domains.absence.submit')}
        busy={createMutation.isPending}
        submitDisabled={!requestValid}
        onClose={() => setRequestOpen(false)}
        onSubmit={() => createMutation.mutate()}
      >
        <Stack gap={2}>
          <SelectField
            label={t('domains.absence.plan')}
            value={planId}
            onValueChange={(value) => setPlanId(String(value))}
            options={(query.data?.balances ?? []).map((balance) => ({
              value: balance.planId,
              label: `${balance.planName} · ${t('domains.absence.daysAvailable', {
                value: minutesToDays(balance.availableMinutes),
              })}`,
            }))}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            <DatePickerField
              label={t('domains.absence.startDate')}
              value={startDate || null}
              onValueChange={(value) => setStartDate(value ?? '')}
            />
            <DatePickerField
              label={t('domains.absence.endDate')}
              value={endDate || null}
              onValueChange={(value) => setEndDate(value ?? '')}
              minDate={startDate || null}
            />
          </Box>
          <FormField
            type="number"
            label={t('domains.absence.durationHours')}
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
            slotProps={{ htmlInput: { min: 1, max: 240, step: 1 } }}
          />
          <FormField
            multiline
            minRows={3}
            label={t('domains.absence.reason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </Stack>
      </FormDialog>

      <FormDialog
        open={Boolean(withdrawing)}
        title={t('domains.absence.withdrawTitle')}
        description={
          withdrawing
            ? t('domains.absence.withdrawDescription', { plan: withdrawing.planName })
            : undefined
        }
        cancelLabel={t('domains.actions.cancel')}
        submitLabel={t('domains.actions.withdraw')}
        submitIntent="danger"
        busy={withdrawMutation.isPending}
        submitDisabled={withdrawalNote.trim().length < 3}
        onClose={() => setWithdrawing(null)}
        onSubmit={() => withdrawMutation.mutate()}
      >
        <FormField
          autoFocus
          multiline
          minRows={3}
          label={t('domains.absence.withdrawReason')}
          value={withdrawalNote}
          onChange={(event) => setWithdrawalNote(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
      </FormDialog>
    </QueryBoundary>
  );
}
