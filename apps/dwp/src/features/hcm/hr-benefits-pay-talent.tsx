import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  FileLock2,
  HeartHandshake,
  LifeBuoy,
  Pencil,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, EmptyState, FormDialog } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  getHrBenefits,
  getHrPay,
  getHrTalent,
  updateHrGoal,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  DomainSection,
  ProgressSignal,
  QueryBoundary,
  ReferenceNotice,
  StatusChip,
} from './hr-domain-components';

import type { HrGoal } from '@dwp-frontend/shared-utils';
import { useProductActionMutation } from '../../components/use-product-action-mutation';

export function HrBenefitsWorkspace() {
  const { t } = useTranslation('hcm');
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['hcm', 'benefits'],
    queryFn: getHrBenefits,
    staleTime: 60_000,
  });
  return (
    <QueryBoundary
      loading={query.isLoading}
      error={query.error}
      retrying={query.isFetching}
      onRetry={() => void query.refetch()}
    >
      <Stack gap={2}>
        {query.data?.referenceData && <ReferenceNotice />}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          <ProgressSignal
            label={t('domains.benefits.activePlans')}
            value={String(query.data?.plans.filter((plan) => plan.status === 'ACTIVE').length ?? 0)}
            detail={t('domains.benefits.activePlansDetail')}
            progress={query.data?.plans.length ? 100 : 0}
            tone="success"
          />
          <ProgressSignal
            label={t('domains.benefits.enrollmentWindows')}
            value={String(query.data?.windows.length ?? 0)}
            detail={t('domains.benefits.enrollmentWindowsDetail')}
            progress={query.data?.windows.length ? 100 : 0}
            tone={query.data?.windows.length ? 'warning' : 'primary'}
          />
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('domains.benefits.coverageStatus')}
                </Typography>
                <Typography variant="h5" fontWeight={780} sx={{ mt: 0.5 }}>
                  {query.data?.plans.length
                    ? t('domains.benefits.covered')
                    : t('domains.benefits.notEnrolled')}
                </Typography>
              </Box>
              <HeartHandshake size={28} color="#1F7A55" aria-hidden="true" />
            </Stack>
          </Paper>
        </Box>

        <DomainSection
          title={t('domains.benefits.plansTitle')}
          description={t('domains.benefits.plansDescription')}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<LifeBuoy size={15} />}
              onClick={() =>
                navigate(
                  '/services/discover?category=PEOPLE&service=people.benefits-life-event&source=hr'
                )
              }
            >
              {t('domains.benefits.reportLifeEvent')}
            </ActionButton>
          }
        >
          {query.data?.plans.length ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {query.data.plans.map((plan, index) => (
                <Stack
                  key={plan.planId}
                  direction="row"
                  alignItems="flex-start"
                  gap={1.25}
                  sx={{
                    p: 2,
                    borderTop: { xs: index ? 1 : 0, md: index > 1 ? 1 : 0 },
                    borderLeft: { xs: 0, md: index % 2 ? 1 : 0 },
                    borderColor: 'divider',
                  }}
                >
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      flex: '0 0 38px',
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: 'success.light',
                      color: 'success.dark',
                      borderRadius: 1,
                    }}
                  >
                    <ShieldCheck size={19} />
                  </Box>
                  <Box minWidth={0} flex={1}>
                    <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                      <Typography variant="body2" fontWeight={760}>
                        {plan.name}
                      </Typography>
                      <StatusChip status={plan.status} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {[plan.planType, plan.providerName].filter(Boolean).join(' · ')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('domains.benefits.effectivePeriod', {
                        start: formatDate(plan.effectiveStart, { dateStyle: 'medium' }),
                        end: plan.effectiveEnd
                          ? formatDate(plan.effectiveEnd, { dateStyle: 'medium' })
                          : t('domains.benefits.current'),
                      })}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`domains.benefits.coverage.${plan.coverageLevel}`, {
                        defaultValue: plan.coverageLevel,
                      })}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Stack>
              ))}
            </Box>
          ) : (
            <EmptyState
              title={t('domains.benefits.emptyTitle')}
              description={t('domains.benefits.emptyDescription')}
            />
          )}
        </DomainSection>

        <DomainSection
          title={t('domains.benefits.windowsTitle')}
          description={t('domains.benefits.windowsDescription')}
        >
          {query.data?.windows.length ? (
            <Box>
              {query.data.windows.map((window, index) => (
                <Box key={window.windowId}>
                  {index > 0 && <Divider />}
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    gap={1.25}
                    sx={{ px: 2, py: 1.5 }}
                  >
                    <Stack direction="row" alignItems="flex-start" gap={1.25} minWidth={0} flex={1}>
                      <CalendarClock size={18} aria-hidden="true" />
                      <Box minWidth={0}>
                        <Typography variant="body2" fontWeight={750}>
                          {window.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('domains.benefits.windowPeriod', {
                            start: formatDate(window.opensAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }),
                            end: formatDate(window.closesAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }),
                          })}
                        </Typography>
                      </Box>
                    </Stack>
                    <StatusChip status={window.lifecycleState} />
                  </Stack>
                </Box>
              ))}
            </Box>
          ) : (
            <EmptyState
              size="compact"
              title={t('domains.benefits.noWindowTitle')}
              description={t('domains.benefits.noWindowDescription')}
            />
          )}
        </DomainSection>
      </Stack>
    </QueryBoundary>
  );
}

export function HrPayWorkspace() {
  const { t } = useTranslation('hcm');
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['hcm', 'pay'], queryFn: getHrPay, staleTime: 60_000 });
  const cycle = query.data?.nextCycle;
  const dDay = cycle
    ? Math.max(0, Math.ceil((new Date(cycle.payDate).getTime() - Date.now()) / 86_400_000))
    : null;
  const readiness = cycle
    ? [
        ['time', cycle.timeValidated],
        ['absence', cycle.absenceValidated],
        ['source', cycle.sourceConfirmed],
      ]
    : [];
  return (
    <QueryBoundary
      loading={query.isLoading}
      error={query.error}
      retrying={query.isFetching}
      onRetry={() => void query.refetch()}
    >
      <Stack gap={2}>
        <Stack
          direction="row"
          alignItems="flex-start"
          gap={1}
          sx={{ p: 1.5, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}
        >
          <FileLock2 size={17} aria-hidden="true" />
          <Box>
            <Typography variant="body2" fontWeight={700}>
              {t('domains.pay.privacyTitle')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('domains.pay.privacyDescription')}
            </Typography>
          </Box>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 0.8fr) minmax(0, 1.2fr)' },
            gap: 1,
          }}
        >
          <Paper variant="outlined" sx={{ p: 2.25 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('domains.pay.nextPayDay')}
                </Typography>
                <Typography variant="h4" fontWeight={790} sx={{ mt: 0.5 }}>
                  {dDay === null ? '-' : t('domains.pay.dDay', { value: dDay })}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {cycle ? formatDate(cycle.payDate, { dateStyle: 'long' }) : '-'}
                </Typography>
              </Box>
              <ReceiptText size={34} color="#2463D4" aria-hidden="true" />
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2.25 }}>
            <Typography variant="caption" color="text.secondary">
              {t('domains.pay.readiness')}
            </Typography>
            <Stack gap={1.2} sx={{ mt: 1.25 }}>
              {readiness.map(([key, complete]) => (
                <Stack key={String(key)} direction="row" alignItems="center" gap={1}>
                  {complete ? (
                    <CheckCircle2 size={17} color="#1F7A55" />
                  ) : (
                    <CircleDashed size={17} color="#8A5A00" />
                  )}
                  <Typography variant="body2" flex={1}>
                    {t(`domains.pay.readinessItems.${key}`)}
                  </Typography>
                  <StatusChip status={complete ? 'COMPLETED' : 'IN_PROGRESS'} />
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Box>

        <DomainSection
          title={t('domains.pay.statementsTitle')}
          description={t('domains.pay.statementsDescription')}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<LifeBuoy size={15} />}
              onClick={() =>
                navigate(
                  '/services/discover?category=PEOPLE&service=people.payroll-inquiry&source=hr'
                )
              }
            >
              {t('domains.pay.askPayroll')}
            </ActionButton>
          }
        >
          {query.data?.statements.length ? (
            <Box>
              {query.data.statements.map((statement, index) => (
                <Box key={statement.statementId}>
                  {index > 0 && <Divider />}
                  <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2, py: 1.5 }}>
                    <ReceiptText size={19} aria-hidden="true" />
                    <Box minWidth={0} flex={1}>
                      <Typography variant="body2" fontWeight={750}>
                        {statement.periodLabel}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {statement.publishedAt
                          ? formatDate(statement.publishedAt, { dateStyle: 'medium' })
                          : t('domains.pay.awaitingPublication')}
                      </Typography>
                    </Box>
                    <StatusChip status={statement.availabilityState} />
                    <ActionButton
                      intent="secondary"
                      size="small"
                      disabled={!statement.downloadable}
                    >
                      {t('domains.pay.openStatement')}
                    </ActionButton>
                  </Stack>
                </Box>
              ))}
            </Box>
          ) : (
            <EmptyState
              title={t('domains.pay.emptyTitle')}
              description={t('domains.pay.emptyDescription')}
            />
          )}
        </DomainSection>
      </Stack>
    </QueryBoundary>
  );
}

export function HrTalentWorkspace() {
  const { t } = useTranslation('hcm');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const updateGoal = useProductActionMutation('route.hcm.personal.talent-goal-update.action');
  const query = useQuery({
    queryKey: ['hcm', 'talent'],
    queryFn: getHrTalent,
    staleTime: 30_000,
  });
  const [goal, setGoal] = useState<HrGoal | null>(null);
  const [progress, setProgress] = useState(0);
  const mutation = useMutation({
    mutationFn: () =>
      updateGoal((authority) =>
        updateHrGoal(
          goal!.goalId,
          {
            progressPercent: progress,
            status: progress === 100 ? 'COMPLETED' : goal!.status,
            version: goal!.version,
          },
          authority
        )
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(['hcm', 'talent'], data);
      void queryClient.invalidateQueries({ queryKey: ['hcm', 'home-overview'] });
      setGoal(null);
      toast.success(t('domains.talent.saved'));
    },
    onError: () => toast.error(t('domains.talent.saveError')),
  });
  const editGoal = (selected: HrGoal) => {
    setGoal(selected);
    setProgress(selected.progressPercent);
  };

  return (
    <QueryBoundary
      loading={query.isLoading}
      error={query.error}
      retrying={query.isFetching}
      onRetry={() => void query.refetch()}
    >
      <Stack gap={2}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          <ProgressSignal
            label={t('domains.talent.journeys')}
            value={String(query.data?.journeys.length ?? 0)}
            detail={t('domains.talent.journeysDetail')}
            progress={query.data?.journeys[0]?.progressPercent ?? 0}
          />
          <ProgressSignal
            label={t('domains.talent.goals')}
            value={String(query.data?.goals.length ?? 0)}
            detail={t('domains.talent.goalsDetail')}
            progress={
              query.data?.goals.length
                ? query.data.goals.reduce((total, item) => total + item.progressPercent, 0) /
                  query.data.goals.length
                : 0
            }
            tone="success"
          />
          <ProgressSignal
            label={t('domains.talent.learning')}
            value={String(query.data?.learning.length ?? 0)}
            detail={t('domains.talent.learningDetail')}
            progress={query.data?.learning[0]?.progressPercent ?? 0}
            tone="warning"
          />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <DomainSection
            title={t('domains.talent.goalsTitle')}
            description={t('domains.talent.goalsDescription')}
          >
            {query.data?.goals.length ? (
              query.data.goals.map((item, index) => (
                <Box key={item.goalId}>
                  {index > 0 && <Divider />}
                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Sparkles size={17} aria-hidden="true" />
                      <Box minWidth={0} flex={1}>
                        <Typography variant="body2" fontWeight={750} noWrap>
                          {item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.dueDate
                            ? formatDate(item.dueDate, { dateStyle: 'medium' })
                            : t('domains.talent.noDueDate')}
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={760}>
                        {item.progressPercent}%
                      </Typography>
                      <ActionButton
                        intent="quiet"
                        size="small"
                        startIcon={<Pencil size={14} />}
                        onClick={() => editGoal(item)}
                      >
                        {t('domains.actions.update')}
                      </ActionButton>
                    </Stack>
                    <LinearProgress
                      aria-label={item.title}
                      variant="determinate"
                      value={item.progressPercent}
                      sx={{ mt: 1.25, height: 6, borderRadius: 1 }}
                    />
                  </Box>
                </Box>
              ))
            ) : (
              <EmptyState
                size="compact"
                title={t('domains.talent.noGoalsTitle')}
                description={t('domains.talent.noGoalsDescription')}
              />
            )}
          </DomainSection>

          <DomainSection
            title={t('domains.talent.learningTitle')}
            description={t('domains.talent.learningDescription')}
            action={
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<LifeBuoy size={15} aria-hidden="true" />}
                onClick={() =>
                  navigate(
                    '/services/discover?category=PEOPLE&service=people.learning-support&source=hr'
                  )
                }
              >
                {t('domains.talent.learningSupport')}
              </ActionButton>
            }
          >
            {query.data?.learning.length ? (
              query.data.learning.map((item, index) => (
                <Box key={item.learningId}>
                  {index > 0 && <Divider />}
                  <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2, py: 1.5 }}>
                    <BookOpenCheck size={18} aria-hidden="true" />
                    <Box minWidth={0} flex={1}>
                      <Typography variant="body2" fontWeight={750} noWrap>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[item.providerName, item.dueDate].filter(Boolean).join(' · ')}
                      </Typography>
                    </Box>
                    {item.required && <Chip size="small" label={t('domains.talent.required')} />}
                    <StatusChip status={item.status} />
                  </Stack>
                </Box>
              ))
            ) : (
              <EmptyState
                size="compact"
                title={t('domains.talent.noLearningTitle')}
                description={t('domains.talent.noLearningDescription')}
              />
            )}
          </DomainSection>
        </Box>

        <DomainSection
          title={t('domains.talent.journeyTitle')}
          description={t('domains.talent.journeyDescription')}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<LifeBuoy size={15} />}
              onClick={() =>
                navigate(
                  '/services/discover?category=PEOPLE&service=people.onboarding-transition-help&source=hr'
                )
              }
            >
              {t('domains.talent.getJourneyHelp')}
            </ActionButton>
          }
        >
          {query.data?.journeys.length ? (
            query.data.journeys.map((journey, index) => (
              <Box key={journey.journeyId}>
                {index > 0 && <Divider />}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  gap={1.25}
                  sx={{ px: 2, py: 1.5 }}
                >
                  <Stack direction="row" alignItems="center" gap={1.25} minWidth={0} flex={1}>
                    <CalendarClock size={18} aria-hidden="true" />
                    <Box minWidth={0} flex={1}>
                      <Typography variant="body2" fontWeight={750}>
                        {journey.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {journey.targetDate
                          ? formatDate(journey.targetDate, { dateStyle: 'medium' })
                          : journey.journeyType}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight={760}>
                      {journey.progressPercent}%
                    </Typography>
                    <StatusChip status={journey.status} />
                  </Stack>
                </Stack>
              </Box>
            ))
          ) : (
            <EmptyState
              size="compact"
              title={t('domains.talent.noJourneyTitle')}
              description={t('domains.talent.noJourneyDescription')}
            />
          )}
        </DomainSection>
      </Stack>

      <FormDialog
        open={Boolean(goal)}
        title={t('domains.talent.updateGoalTitle')}
        cancelLabel={t('domains.actions.cancel')}
        submitLabel={t('domains.actions.save')}
        busy={mutation.isPending}
        submitDisabled={progress === goal?.progressPercent}
        onClose={() => setGoal(null)}
        onSubmit={() => mutation.mutate()}
      >
        <Typography variant="body2" fontWeight={750} sx={{ mb: 2 }}>
          {goal?.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('domains.talent.progress')}
        </Typography>
        <Slider
          value={progress}
          onChange={(_, value) => setProgress(value as number)}
          step={5}
          min={0}
          max={100}
          valueLabelDisplay="on"
          sx={{ mt: 3 }}
        />
      </FormDialog>
    </QueryBoundary>
  );
}
