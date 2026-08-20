import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Bot,
  Clock3,
  MessageSquareText,
  ShieldCheck,
  ThumbsUp,
  UsersRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { ActionButton, FormField, PageCanvas } from '@dwp-frontend/design-system';
import { formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  getDwaionOperationsOverview,
  getDwaionRetentionPolicy,
  updateDwaionRetentionPolicy,
  usePermissions,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DwaionAdminPageHeader } from './dwaion-admin-ui';

export function DwaionAdminOverview() {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'overview', 30],
    queryFn: () => getDwaionOperationsOverview(30),
    staleTime: 30_000,
  });
  const data = query.data;
  const completionRate = data?.runCount
    ? Math.round((data.completedRunCount / data.runCount) * 100)
    : 0;
  const positiveFeedbackRate =
    data && data.feedbackUpCount + data.feedbackDownCount > 0
      ? Math.round((data.feedbackUpCount / (data.feedbackUpCount + data.feedbackDownCount)) * 100)
      : 0;

  return (
    <PageCanvas>
      <DwaionAdminPageHeader
        title={t('dwaionAdmin.overview.title')}
        description={t('dwaionAdmin.overview.description')}
      />
      {query.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionAdmin.overview.loadError')}
        </Alert>
      )}

      <Box
        component="section"
        aria-label={t('dwaionAdmin.overview.summaryLabel')}
        sx={{
          mt: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        {query.isLoading ? (
          [0, 1, 2, 3].map((index) => <Skeleton key={index} height={132} />)
        ) : (
          <>
            <AdminMetric
              icon={Activity}
              label={t('dwaionAdmin.overview.runs')}
              value={data?.runCount ?? 0}
              detail={t('dwaionAdmin.overview.period', { count: data?.periodDays ?? 30 })}
            />
            <AdminMetric
              icon={ShieldCheck}
              label={t('dwaionAdmin.overview.completionRate')}
              value={`${completionRate}%`}
              detail={t('dwaionAdmin.overview.failed', { count: data?.failedRunCount ?? 0 })}
            />
            <AdminMetric
              icon={UsersRound}
              label={t('dwaionAdmin.overview.activeUsers')}
              value={data?.activeUserCount ?? 0}
              detail={t('dwaionAdmin.overview.permissionScoped')}
            />
            <AdminMetric
              icon={MessageSquareText}
              label={t('dwaionAdmin.overview.conversations')}
              value={data?.conversationCount ?? 0}
              detail={t('dwaionAdmin.overview.contentHidden')}
            />
          </>
        )}
      </Box>

      {data && (
        <Box
          sx={{
            mt: 3,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
            gap: 3,
          }}
        >
          <SignalSection
            icon={Workflow}
            title={t('dwaionAdmin.overview.policy.title')}
            description={t('dwaionAdmin.overview.policy.description')}
            signals={[
              { label: t('dwaionAdmin.overview.policy.allowed'), value: data.allowedRunCount },
              { label: t('dwaionAdmin.overview.policy.handoff'), value: data.handedOffRunCount },
              { label: t('dwaionAdmin.overview.policy.denied'), value: data.deniedRunCount },
            ]}
          />
          <SignalSection
            icon={Bot}
            title={t('dwaionAdmin.overview.answer.title')}
            description={t('dwaionAdmin.overview.answer.description')}
            signals={[
              {
                label: t('dwaionAdmin.overview.answer.grounded'),
                value: data.groundedAnswerCount,
              },
              {
                label: t('dwaionAdmin.overview.answer.abstained'),
                value: data.abstainedAnswerCount,
              },
              {
                label: t('dwaionAdmin.overview.answer.configuration'),
                value: data.configurationRequiredCount,
              },
            ]}
          />
          <SignalSection
            icon={Clock3}
            title={t('dwaionAdmin.overview.performance.title')}
            description={t('dwaionAdmin.overview.performance.description')}
            signals={[
              {
                label: t('dwaionAdmin.overview.performance.latency'),
                value: `${formatNumber(data.averageLatencyMs, undefined, locale)} ms`,
              },
              {
                label: t('dwaionAdmin.overview.performance.tokens'),
                value: formatNumber(data.totalTokens, undefined, locale),
              },
            ]}
          />
          <SignalSection
            icon={ThumbsUp}
            title={t('dwaionAdmin.overview.feedback.title')}
            description={t('dwaionAdmin.overview.feedback.description')}
            signals={[
              {
                label: t('dwaionAdmin.overview.feedback.positiveRate'),
                value: `${positiveFeedbackRate}%`,
              },
              {
                label: t('dwaionAdmin.overview.feedback.positive'),
                value: data.feedbackUpCount,
              },
              {
                label: t('dwaionAdmin.overview.feedback.negative'),
                value: data.feedbackDownCount,
              },
            ]}
          />
        </Box>
      )}

      <Alert severity="info" icon={<ShieldCheck size={20} />} sx={{ mt: 3 }}>
        {t('dwaionAdmin.overview.scopeNotice')}
      </Alert>
    </PageCanvas>
  );
}

export function DwaionRetentionPolicy() {
  const { t } = useTranslation('work');
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.DWAION_RETENTION', 'MANAGE');
  const canUpdate = canManage || hasPermission('ADMIN.DWAION_RETENTION', 'UPDATE');
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'retention'],
    queryFn: getDwaionRetentionPolicy,
    staleTime: 30_000,
  });
  const [retentionDays, setRetentionDays] = useState(90);
  const [legalHold, setLegalHold] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!query.data) return;
    setRetentionDays(query.data.retentionDays);
    setLegalHold(query.data.legalHold);
  }, [query.data]);

  const dirty = Boolean(
    query.data && (retentionDays !== query.data.retentionDays || legalHold !== query.data.legalHold)
  );
  const validationError = useMemo(() => {
    if (retentionDays < 30 || retentionDays > 3650) {
      return t('dwaionAdmin.retention.daysError');
    }
    if (dirty && changeReason.trim().length < 10) {
      return t('dwaionAdmin.retention.reasonError');
    }
    return null;
  }, [changeReason, dirty, retentionDays, t]);
  const mutation = useMutation({
    mutationFn: () =>
      updateDwaionRetentionPolicy({
        retentionDays,
        ...(canManage && legalHold !== query.data?.legalHold ? { legalHold } : {}),
        expectedVersion: query.data!.policyVersion,
        changeReason: changeReason.trim(),
      }),
    onSuccess: async (policy) => {
      queryClient.setQueryData(['dwaion', 'admin', 'retention'], policy);
      setChangeReason('');
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'overview'] });
    },
  });

  return (
    <PageCanvas>
      <DwaionAdminPageHeader
        title={t('dwaionAdmin.retention.title')}
        description={t('dwaionAdmin.retention.description')}
      />
      {query.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionAdmin.retention.loadError')}
        </Alert>
      )}
      {mutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionAdmin.retention.saveError')}
        </Alert>
      )}
      {saved && !mutation.isError && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSaved(false)}>
          {t('dwaionAdmin.retention.saved')}
        </Alert>
      )}

      {query.isLoading ? (
        <Skeleton variant="rounded" height={360} sx={{ mt: 3 }} />
      ) : query.data ? (
        <Box component="section" sx={{ mt: 3, maxWidth: 840 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography component="h2" variant="h6" fontWeight={850}>
                {t('dwaionAdmin.retention.policyTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                {t('dwaionAdmin.retention.policyDescription')}
              </Typography>
            </Box>
            <FormField
              type="number"
              label={t('dwaionAdmin.retention.daysLabel')}
              value={String(retentionDays)}
              onChange={(event) => setRetentionDays(Number(event.target.value))}
              disabled={!canUpdate}
              inputProps={{ min: 30, max: 3650 }}
              supportingText={t('dwaionAdmin.retention.daysHelp')}
              sx={{ maxWidth: 360 }}
            />
            <Box sx={{ borderBlock: 1, borderColor: 'divider', py: 1.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={legalHold}
                    disabled={!canManage}
                    onChange={(event) => setLegalHold(event.target.checked)}
                  />
                }
                label={t('dwaionAdmin.retention.legalHoldLabel')}
              />
              <Typography variant="caption" color="text.secondary" component="p" sx={{ pl: 4 }}>
                {t('dwaionAdmin.retention.legalHoldHelp')}
              </Typography>
            </Box>
            <FormField
              label={t('dwaionAdmin.retention.reasonLabel')}
              value={changeReason}
              onChange={(event) => setChangeReason(event.target.value)}
              disabled={!canUpdate || !dirty}
              multiline
              minRows={3}
              inputProps={{ maxLength: 500 }}
              supportingText={t('dwaionAdmin.retention.reasonHelp')}
              errorMessage={dirty ? validationError : null}
            />
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
              <Typography variant="caption" color="text.secondary">
                {t('dwaionAdmin.retention.version', { version: query.data.policyVersion })}
              </Typography>
              <ActionButton
                intent="primary"
                disabled={!canUpdate || !dirty || Boolean(validationError)}
                loading={mutation.isPending}
                loadingLabel={t('dwaionAdmin.retention.saving')}
                onClick={() => mutation.mutate()}
              >
                {t('dwaionAdmin.retention.save')}
              </ActionButton>
            </Stack>
          </Stack>
          <Alert severity="warning" sx={{ mt: 3 }}>
            {t('dwaionAdmin.retention.auditNotice')}
          </Alert>
        </Box>
      ) : null}
    </PageCanvas>
  );
}

function AdminMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <Stack spacing={0.55} sx={{ px: 2, py: 2, borderRight: 1, borderColor: 'divider' }}>
      <Icon size={17} color="var(--dwp-product-accent)" aria-hidden="true" />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4">{value}</Typography>
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    </Stack>
  );
}

function SignalSection({
  icon: Icon,
  title,
  description,
  signals,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  signals: Array<{ label: string; value: number | string }>;
}) {
  return (
    <Box component="section">
      <Stack direction="row" spacing={1} alignItems="center">
        <Icon size={18} color="var(--dwp-product-accent)" aria-hidden="true" />
        <Box>
          <Typography component="h2" variant="subtitle1" fontWeight={850}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {description}
          </Typography>
        </Box>
      </Stack>
      <Box sx={{ mt: 1.25, borderBlock: 1, borderColor: 'divider' }}>
        {signals.map((signal, index) => (
          <Box key={signal.label}>
            {index > 0 && <Divider />}
            <Stack direction="row" justifyContent="space-between" alignItems="center" py={1.3}>
              <Typography variant="body2" color="text.secondary">
                {signal.label}
              </Typography>
              <Typography variant="body2" fontWeight={850}>
                {signal.value}
              </Typography>
            </Stack>
          </Box>
        ))}
      </Box>
      <LinearProgress variant="determinate" value={100} sx={{ height: 2, mt: 1 }} />
    </Box>
  );
}
