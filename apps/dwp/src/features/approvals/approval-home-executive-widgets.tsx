import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FilePenLine,
  FilePlus2,
  Gauge,
  Radar,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n/lib/formatters';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, darken, lighten } from '@mui/material/styles';

import { ApprovalSurface, PriorityChip, StatusChip, approvalTone } from './approval-ui';
import { approvalHomeRiskColor } from './approval-home-model';

import type { LucideIcon } from 'lucide-react';
import type { Theme } from '@mui/material/styles';
import type { ApprovalHome, ApprovalRequest, ApprovalTask } from '@dwp-frontend/shared-utils';
import type { ApprovalExperience } from './use-approval-experience';

type HomeAccess = Pick<
  ApprovalExperience,
  'canViewTasks' | 'canViewRequests' | 'canStartRequests' | 'canManageDelegations'
>;

type MetricTone = 'primary' | 'warning' | 'teal' | 'success' | 'violet';

function metricColor(theme: Theme, tone: MetricTone) {
  const variant = theme.palette.mode === 'dark' ? 'light' : 'dark';
  if (tone === 'success') return theme.palette.success[variant];
  if (tone === 'warning') return theme.palette.warning[variant];
  if (tone === 'teal') return theme.palette.info[variant];
  if (tone === 'violet') {
    const color = foundationTokens.color.data.violet;
    return theme.palette.mode === 'dark' ? lighten(color, 0.45) : darken(color, 0.1);
  }
  return theme.palette.primary[variant];
}

export function ApprovalExecutiveBriefing({
  data,
  access,
}: {
  data: ApprovalHome;
  access: Pick<HomeAccess, 'canViewTasks' | 'canViewRequests'>;
}) {
  const { t } = useTranslation('approvals');
  const navigate = useNavigate();
  const leadTask = data.focusQueue[0];
  const hasUrgentTask = data.focusQueue.some((task) => task.priority === 'URGENT');
  const metrics: ReadonlyArray<{
    key: string;
    label: string;
    value: string | number;
    unit?: string;
    detail: string;
    icon: LucideIcon;
    tone: MetricTone;
    route?: string;
  }> = [
    {
      key: 'pending',
      label: t('metrics.pending'),
      value: data.metrics.pending,
      detail: t('home.commandCenter.metricPendingRiskDetail', {
        count: data.metrics.overdue,
      }),
      icon: ClipboardCheck,
      tone: 'primary',
      route: access.canViewTasks ? '/approvals/inbox?queue=ALL' : undefined,
    },
    {
      key: 'due-today',
      label: t('metrics.dueToday'),
      value: data.metrics.dueToday,
      detail: t('home.commandCenter.metricDueDetail'),
      icon: CalendarClock,
      tone: data.metrics.dueToday > 0 ? 'warning' : 'teal',
      route: access.canViewTasks ? '/approvals/inbox?queue=DUE_TODAY' : undefined,
    },
    {
      key: 'in-flight',
      label: t('metrics.inFlight'),
      value: data.metrics.myRequestsInFlight,
      detail: t('home.commandCenter.metricInFlightDetail'),
      icon: Send,
      tone: 'violet',
      route: access.canViewRequests ? '/approvals/requests/submitted' : undefined,
    },
    {
      key: 'cycle-time',
      label: t('metrics.averageCycle'),
      value: formatNumber(data.metrics.averageCycleHours),
      unit: t('metrics.hoursUnit'),
      detail: t('home.commandCenter.metricCycleDetail', {
        percent: formatNumber(data.metrics.slaCompliancePercent),
      }),
      icon: Clock3,
      tone: data.metrics.slaCompliancePercent >= 95 ? 'success' : 'warning',
    },
  ];

  return (
    <Box
      component="section"
      aria-labelledby="approval-decision-pulse-title"
      data-testid="approval-daily-briefing"
      sx={{ display: 'grid', gap: 1.5, minWidth: 0 }}
    >
      <Box
        data-testid="approval-briefing-band"
        style={{ borderRadius: foundationTokens.radius.surface }}
        sx={(theme) => ({
          position: 'relative',
          overflow: 'hidden',
          px: { xs: 1.75, md: 2.5 },
          py: { xs: 1.75, md: 2.25 },
          border: 1,
          borderLeft: 4,
          borderColor: alpha(
            theme.palette.primary.main,
            theme.palette.mode === 'dark' ? 0.5 : 0.28
          ),
          borderLeftColor: 'primary.main',
          bgcolor: 'background.paper',
          boxShadow: theme.shadows[0],
          '@media (forced-colors: active)': {
            borderColor: 'CanvasText',
            borderLeftColor: 'Highlight',
            boxShadow: 'none',
          },
        })}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ md: 'flex-start' }}
          justifyContent="space-between"
          gap={2}
        >
          <Box sx={{ minWidth: 0, maxWidth: 780 }}>
            <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
              <Radar size={16} aria-hidden="true" />
              <Typography variant="overline" color="primary.main">
                {t('home.briefing.eyebrow')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(data.generatedAt, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Typography>
            </Stack>
            <Typography
              id="approval-decision-pulse-title"
              component="h2"
              variant="h6"
              sx={{ mt: 0.5 }}
            >
              {t('home.briefing.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('home.briefing.description', {
                pending: data.metrics.pending,
                overdue: data.metrics.overdue,
                dueToday: data.metrics.dueToday,
              })}
            </Typography>
            {leadTask ? (
              <LeadApprovalTask task={leadTask} />
            ) : (
              <Stack direction="row" gap={1} alignItems="center" sx={{ mt: 1.5 }}>
                <CheckCircle2 size={18} color={approvalTone.teal} aria-hidden="true" />
                <Typography variant="body2">{t('home.briefing.clear')}</Typography>
              </Stack>
            )}
          </Box>
          {access.canViewTasks && (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              gap={1}
              sx={{ width: { xs: 1, sm: 'auto' }, flex: '0 0 auto', flexWrap: 'wrap' }}
            >
              {leadTask && (
                <ActionButton
                  intent="primary"
                  endIcon={<ArrowRight size={16} />}
                  onClick={() =>
                    navigate(`/approvals/inbox?task=${encodeURIComponent(leadTask.taskId)}`)
                  }
                >
                  {t('actions.reviewInbox')}
                </ActionButton>
              )}
              <ActionButton
                intent="secondary"
                startIcon={hasUrgentTask ? <ShieldAlert size={16} /> : <ClipboardCheck size={16} />}
                onClick={() =>
                  navigate(`/approvals/inbox?queue=${hasUrgentTask ? 'URGENT' : 'ALL'}`)
                }
              >
                {t(
                  hasUrgentTask
                    ? 'home.briefing.reviewUrgent'
                    : 'navigation.items.approvals.inbox.label'
                )}
              </ActionButton>
            </Stack>
          )}
        </Stack>
      </Box>

      <Box
        component="section"
        aria-label={t('home.commandCenter.metricsLabel')}
        data-testid="approval-kpi-grid"
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 1.25,
        }}
      >
        {metrics.map(({ key, route, ...metric }) => (
          <ApprovalMetricCard
            key={key}
            {...metric}
            onSelect={route ? () => navigate(route) : undefined}
          />
        ))}
      </Box>
    </Box>
  );
}

function LeadApprovalTask({ task }: { task: ApprovalTask }) {
  const { t } = useTranslation('approvals');
  return (
    <Box
      sx={{
        mt: 1.5,
        pl: 1.5,
        borderLeft: 2,
        borderColor: task.riskScore >= 70 ? approvalHomeRiskColor(task.riskScore) : 'divider',
      }}
    >
      <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
        <PriorityChip priority={task.priority} />
        <Typography variant="caption" color="text.secondary">
          {task.requestNumber}
        </Typography>
        <Typography
          variant="caption"
          color={approvalHomeRiskColor(task.riskScore)}
          fontWeight="fontWeightBold"
        >
          {t('home.commandCenter.riskCompact', { score: task.riskScore })}
        </Typography>
      </Stack>
      <Typography component="p" variant="subtitle2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
        {task.title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {task.summary}
      </Typography>
    </Box>
  );
}

function ApprovalMetricCard({
  label,
  value,
  unit,
  detail,
  icon: Icon,
  tone,
  onSelect,
}: {
  label: string;
  value: string | number;
  unit?: string;
  detail: string;
  icon: LucideIcon;
  tone: MetricTone;
  onSelect?: () => void;
}) {
  const content = (
    <Box sx={{ width: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={0.75}>
        <Typography component="p" variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
          {label}
        </Typography>
        <Box
          sx={(theme) => ({
            flex: '0 0 auto',
            color: metricColor(theme, tone),
            '@media (forced-colors: active)': { color: 'CanvasText' },
          })}
        >
          <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
        </Box>
      </Stack>
      <Stack direction="row" alignItems="baseline" flexWrap="wrap" gap={0.5} sx={{ mt: 0.75 }}>
        <Typography
          component="p"
          variant="h4"
          sx={(theme) => ({
            color: metricColor(theme, tone),
            fontVariantNumeric: 'tabular-nums',
            minWidth: 0,
            overflowWrap: 'anywhere',
          })}
        >
          {value}
        </Typography>
        {unit && (
          <Typography
            component="span"
            variant="caption"
            color="text.secondary"
            sx={{ whiteSpace: 'nowrap' }}
          >
            {unit}
          </Typography>
        )}
      </Stack>
      <Typography component="p" variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
        {detail}
      </Typography>
    </Box>
  );
  const sx = (theme: Theme) => {
    const color = metricColor(theme, tone);
    return {
      position: 'relative',
      minWidth: 0,
      minHeight: 108,
      p: { xs: 1.5, md: 1.75 },
      overflow: 'hidden',
      textAlign: 'left',
      border: 1,
      borderColor: 'divider',
      bgcolor: 'background.paper',
      boxShadow: theme.shadows[0],
      '&::before': {
        content: '""',
        position: 'absolute',
        inset: '0 auto 0 0',
        width: 3,
        bgcolor: color,
      },
      ...(onSelect && {
        '&:hover': { bgcolor: 'action.hover', borderColor: color },
      }),
      '&.Mui-focusVisible, &:focus-visible': { outlineOffset: -3 },
      '@media (forced-colors: active)': {
        boxShadow: 'none',
        '&::before': { bgcolor: 'Highlight' },
      },
    };
  };
  return onSelect ? (
    <ButtonBase
      data-testid="approval-kpi-card"
      onClick={onSelect}
      style={{ borderRadius: foundationTokens.radius.surface }}
      sx={sx}
    >
      {content}
    </ButtonBase>
  ) : (
    <Box
      data-testid="approval-kpi-card"
      style={{ borderRadius: foundationTokens.radius.surface }}
      sx={sx}
    >
      {content}
    </Box>
  );
}

export function ApprovalQuickActions({ access }: { access: HomeAccess }) {
  const { t } = useTranslation('approvals');
  const navigate = useNavigate();
  const actions = [
    access.canStartRequests
      ? {
          key: 'newRequest',
          icon: FilePlus2,
          route: '/approvals/requests/new',
        }
      : null,
    access.canViewTasks ? { key: 'inbox', icon: ClipboardCheck, route: '/approvals/inbox' } : null,
    access.canViewRequests
      ? { key: 'drafts', icon: FilePenLine, route: '/approvals/requests/drafts' }
      : null,
    access.canManageDelegations
      ? { key: 'delegations', icon: BadgeCheck, route: '/approvals/delegations' }
      : null,
  ].filter((action): action is NonNullable<typeof action> => action !== null);

  return (
    <ApprovalSurface
      appearance="executive"
      title={t('home.widgets.quick-actions.label')}
      meta={t('home.widgets.quick-actions.description')}
    >
      {actions.length === 0 ? (
        <ApprovalHomeEmptyState icon={FilePlus2} text={t('home.quickActions.empty')} />
      ) : (
        <Box
          data-testid="approval-quick-actions"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 1,
            p: 1.5,
            '@container (max-width: 20rem)': {
              gridTemplateColumns: 'minmax(0, 1fr)',
            },
          }}
        >
          {actions.map(({ key, icon: Icon, route }) => (
            <ButtonBase
              key={key}
              aria-label={`${t(`home.quickActions.${key}.label`)}: ${t(
                `home.quickActions.${key}.description`
              )}`}
              onClick={() => navigate(route)}
              style={{ borderRadius: foundationTokens.radius.control }}
              sx={(theme) => ({
                minWidth: 0,
                minHeight: 88,
                p: 1.25,
                border: 1,
                borderColor: alpha(
                  theme.palette.text.primary,
                  theme.palette.mode === 'dark' ? 0.16 : 0.08
                ),
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                gap: 1,
                textAlign: 'left',
                '&:hover': { bgcolor: 'action.hover' },
                '&.Mui-focusVisible, &:focus-visible': { outlineOffset: -3 },
                '@media (forced-colors: active)': { borderColor: 'ButtonText' },
              })}
            >
              <Box sx={{ color: 'primary.main', mt: 0.15, flex: '0 0 auto' }}>
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography component="p" variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                  {t(`home.quickActions.${key}.label`)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.35, overflowWrap: 'anywhere' }}
                >
                  {t(`home.quickActions.${key}.description`)}
                </Typography>
              </Box>
              <ArrowUpRight size={14} aria-hidden="true" />
            </ButtonBase>
          ))}
        </Box>
      )}
    </ApprovalSurface>
  );
}

export function ApprovalRecentActivity({
  requests,
  rowLimit,
  canViewRequests,
}: {
  requests: readonly ApprovalRequest[];
  rowLimit: number;
  canViewRequests: boolean;
}) {
  const { t } = useTranslation('approvals');
  const navigate = useNavigate();
  const visible = requests.slice(0, rowLimit);
  return (
    <ApprovalSurface
      appearance="executive"
      title={t('home.widgets.recent-activity.label')}
      meta={t('home.widgets.recent-activity.description')}
    >
      {visible.length === 0 ? (
        <ApprovalHomeEmptyState icon={Gauge} text={t('home.activity.empty')} />
      ) : (
        <Stack component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {visible.map((request) => (
            <RecentActivityRow
              key={request.requestId}
              request={request}
              onSelect={
                canViewRequests
                  ? () =>
                      navigate(
                        `/approvals/requests/submitted?request=${encodeURIComponent(
                          request.requestId
                        )}`
                      )
                  : undefined
              }
            />
          ))}
        </Stack>
      )}
    </ApprovalSurface>
  );
}

function RecentActivityRow({
  request,
  onSelect,
}: {
  request: ApprovalRequest;
  onSelect?: () => void;
}) {
  const { t } = useTranslation('approvals');
  const timestamp = request.completedAt ?? request.submittedAt;
  const content = (
    <Stack direction="row" gap={1.15} alignItems="flex-start" sx={{ width: 1, minWidth: 0 }}>
      <Box
        sx={{
          width: 9,
          height: 9,
          mt: 0.65,
          flex: '0 0 auto',
          borderRadius: '50%',
          bgcolor: request.status === 'APPROVED' ? 'success.main' : 'primary.main',
          outline: '3px solid',
          outlineColor: request.status === 'APPROVED' ? 'success.light' : 'primary.light',
          '@media (forced-colors: active)': {
            bgcolor: 'Highlight',
            outlineColor: 'CanvasText',
          },
        }}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Typography variant="body2" fontWeight="fontWeightBold" sx={{ overflowWrap: 'anywhere' }}>
            {request.title}
          </Typography>
          <StatusChip status={request.status} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4 }}>
          {request.requestNumber}
          {timestamp
            ? ` · ${t(
                request.completedAt ? 'home.activity.completedAt' : 'home.activity.submittedAt',
                {
                  date: formatDate(timestamp, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                }
              )}`
            : ''}
        </Typography>
      </Box>
    </Stack>
  );
  const sx = {
    width: 1,
    minWidth: 0,
    px: 2,
    py: 1.5,
    textAlign: 'left',
    borderBottom: 1,
    borderColor: 'divider',
    '&:last-of-type': { borderBottom: 0 },
    '&:hover': onSelect ? { bgcolor: 'action.hover' } : undefined,
    '&.Mui-focusVisible, &:focus-visible': { outlineOffset: -3 },
  } as const;
  return (
    <Box component="li">
      {onSelect ? (
        <ButtonBase onClick={onSelect} sx={sx}>
          {content}
        </ButtonBase>
      ) : (
        <Box sx={sx}>{content}</Box>
      )}
    </Box>
  );
}

function ApprovalHomeEmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <Stack role="status" alignItems="center" gap={1} sx={{ px: 2, py: 5, textAlign: 'center' }}>
      <Box sx={{ color: 'text.secondary' }}>
        <Icon size={25} aria-hidden="true" />
      </Box>
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </Stack>
  );
}
