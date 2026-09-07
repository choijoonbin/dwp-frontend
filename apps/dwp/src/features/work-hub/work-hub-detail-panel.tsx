import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowUpRight, CalendarClock, History, Sparkles } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workHubUrgency, type WorkHubActionKind, type WorkHubItem } from './work-hub-contracts';

export type WorkHubDetailPanelProps = {
  item: WorkHubItem;
  now: number;
  mobile: boolean;
  busyAction?: WorkHubActionKind | null;
  commandsDisabled?: boolean;
  specializedContent?: React.ReactNode;
  outcome?: React.ReactNode;
  inTodayPlan: boolean;
  canManagePlan: boolean;
  canSchedule: boolean;
  canAskAi: boolean;
  onBack: () => void;
  onAction: (kind: WorkHubActionKind) => void;
  onTogglePlan: () => void;
  onSchedule: () => void;
  onAskAi: () => void;
  onOpenActivity?: () => void;
};

const personalActionKinds: WorkHubActionKind[] = [
  'PERSONAL_START',
  'PERSONAL_WAIT',
  'PERSONAL_COMPLETE',
  'PERSONAL_REOPEN',
  'PERSONAL_ARCHIVE',
];

export function WorkHubDetailPanel({
  item,
  now,
  mobile,
  busyAction,
  commandsDisabled = false,
  specializedContent,
  outcome,
  inTodayPlan,
  canManagePlan,
  canSchedule,
  canAskAi,
  onBack,
  onAction,
  onTogglePlan,
  onSchedule,
  onAskAi,
  onOpenActivity,
}: WorkHubDetailPanelProps) {
  const { t } = useTranslation('work');
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const urgency = workHubUrgency(item, now);
  const available = new Set(
    item.actions
      .filter((action) => action.availability === 'AVAILABLE')
      .map((action) => action.kind)
  );
  const active = !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(item.lifecycle);
  const commandBusy = Boolean(busyAction) || commandsDisabled;

  useEffect(() => {
    if (!mobile) return;
    const frame = requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [item.key, mobile]);

  return (
    <Box
      component="article"
      aria-labelledby={titleId}
      sx={{
        minWidth: 0,
        bgcolor: 'background.paper',
        minHeight: { xs: 'calc(100dvh - 150px)', lg: 560 },
      }}
    >
      <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        {mobile && (
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<ArrowLeft size={17} />}
            onClick={onBack}
            sx={{ mb: 1.5, minHeight: 44 }}
          >
            {t('workHub.actions.backToQueue')}
          </ActionButton>
        )}
        <Stack direction="row" justifyContent="space-between" gap={2} alignItems="flex-start">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="primary.main">
              {t(`workHub.sources.${item.reference.sourceSystem}`, {
                defaultValue: t('workHub.sources.OTHER'),
              })}
            </Typography>
            <Typography
              ref={titleRef}
              id={titleId}
              component="h2"
              variant="h5"
              tabIndex={mobile ? -1 : undefined}
              sx={{ overflowWrap: 'anywhere' }}
            >
              {item.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('workHub.detail.verifiedAt', {
                date: item.updatedAt
                  ? formatDate(item.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })
                  : t('workHub.detail.unknownTime'),
              })}
            </Typography>
          </Box>
          <Stack direction="row" gap={0.75} flexWrap="wrap" justifyContent="flex-end">
            <Chip
              size="small"
              label={t(`workHub.lifecycle.${item.lifecycle}`)}
              color={
                item.lifecycle === 'COMPLETED'
                  ? 'success'
                  : item.lifecycle === 'WAITING'
                    ? 'warning'
                    : 'info'
              }
            />
            {active && (
              <Chip
                size="small"
                variant="outlined"
                label={t(`workHub.urgency.${urgency}`)}
                color={
                  urgency === 'OVERDUE' ? 'error' : urgency === 'DUE_SOON' ? 'warning' : 'default'
                }
              />
            )}
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5 }}>
        {outcome}
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {[
            [t('workHub.detail.status'), t(`workHub.lifecycle.${item.lifecycle}`)],
            [t('workHub.detail.priority'), t(`workHub.priority.${item.priority}`)],
            [
              t('workHub.detail.due'),
              item.dueAt
                ? formatDate(item.dueAt, { dateStyle: 'medium', timeStyle: 'short' })
                : t('workHub.urgency.NO_DUE_DATE'),
            ],
            [t('workHub.detail.responsibility'), t(`workHub.responsibility.${item.waitingFor}`)],
          ].map(([label, value]) => (
            <Box key={label} sx={{ minWidth: 0 }}>
              <Typography component="dt" variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography
                component="dd"
                variant="body2"
                sx={{ m: 0, mt: 0.35, fontWeight: 'fontWeightBold', overflowWrap: 'anywhere' }}
              >
                {value}
              </Typography>
            </Box>
          ))}
        </Box>

        {(item.summary || item.reason) && (
          <Box
            sx={{
              mt: 3,
              p: 2,
              bgcolor: 'action.hover',
              borderInlineStart: 3,
              borderColor: 'primary.main',
              borderRadius: 'shape.borderRadius',
            }}
          >
            {item.reason && (
              <>
                <Typography variant="caption" color="text.secondary">
                  {t('workHub.detail.whyAssigned')}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.35 }}>
                  {item.reason}
                </Typography>
              </>
            )}
            {item.summary && (
              <>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: item.reason ? 1.5 : 0 }}
                >
                  {t('workHub.detail.summary')}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.35, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {item.summary}
                </Typography>
              </>
            )}
          </Box>
        )}

        {specializedContent && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 3 }} />
            {specializedContent}
          </Box>
        )}

        <Divider sx={{ my: 3 }} />
        <Stack
          direction="row"
          gap={1}
          flexWrap="wrap"
          sx={{ '& .MuiButton-root': { minHeight: 44 } }}
        >
          {personalActionKinds.map((kind) =>
            available.has(kind) ? (
              <ActionButton
                key={kind}
                intent={
                  kind === 'PERSONAL_ARCHIVE'
                    ? 'quiet'
                    : kind === 'PERSONAL_COMPLETE'
                      ? 'primary'
                      : 'secondary'
                }
                loading={busyAction === kind}
                loadingLabel={t('workHub.actions.processing')}
                disabled={commandBusy && busyAction !== kind}
                onClick={() => onAction(kind)}
              >
                {t(`workHub.actions.${kind}`)}
              </ActionButton>
            ) : null
          )}
          {available.has('WORKSPACE_START') && (
            <ActionButton
              intent="primary"
              loading={busyAction === 'WORKSPACE_START'}
              disabled={commandBusy && busyAction !== 'WORKSPACE_START'}
              onClick={() => onAction('WORKSPACE_START')}
            >
              {t('workHub.actions.WORKSPACE_START')}
            </ActionButton>
          )}
          {available.has('WORKSPACE_COMPLETE') && (
            <ActionButton
              intent="secondary"
              loading={busyAction === 'WORKSPACE_COMPLETE'}
              disabled={commandBusy && busyAction !== 'WORKSPACE_COMPLETE'}
              onClick={() => onAction('WORKSPACE_COMPLETE')}
            >
              {t('workHub.actions.WORKSPACE_COMPLETE')}
            </ActionButton>
          )}
          {available.has('OPEN_SOURCE') && (
            <ActionButton
              intent="secondary"
              disabled={commandBusy}
              endIcon={<ArrowUpRight size={16} />}
              onClick={() => onAction('OPEN_SOURCE')}
            >
              {t('workHub.actions.OPEN_SOURCE')}
            </ActionButton>
          )}
          {onOpenActivity && (
            <ActionButton
              intent="secondary"
              disabled={commandBusy}
              startIcon={<History size={16} aria-hidden="true" />}
              onClick={onOpenActivity}
            >
              {t('workHub.actions.OPEN_ACTIVITY')}
            </ActionButton>
          )}
          {active && (canManagePlan || canSchedule || canAskAi) && (
            <>
              {canManagePlan && (
                <ActionButton
                  intent={inTodayPlan ? 'secondary' : 'quiet'}
                  disabled={commandBusy}
                  onClick={onTogglePlan}
                >
                  {inTodayPlan
                    ? t('workHub.actions.removeFromPlan')
                    : t('workHub.actions.addToPlan')}
                </ActionButton>
              )}
              {canSchedule && (
                <ActionButton
                  intent="quiet"
                  disabled={commandBusy}
                  startIcon={<CalendarClock size={16} />}
                  onClick={onSchedule}
                >
                  {t('workHub.actions.schedule')}
                </ActionButton>
              )}
              {canAskAi && (
                <ActionButton
                  intent="quiet"
                  startIcon={<Sparkles size={16} />}
                  disabled={commandBusy}
                  onClick={onAskAi}
                >
                  {t('workHub.actions.askAi')}
                </ActionButton>
              )}
            </>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          {item.reference.sourceSystem === 'PERSONAL_TASK'
            ? t('workHub.detail.personalOwnerNotice')
            : t('workHub.detail.sourceOwnerNotice')}
        </Typography>
      </Box>
    </Box>
  );
}
