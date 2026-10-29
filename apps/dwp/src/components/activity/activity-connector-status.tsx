import { useTranslation } from 'react-i18next';
import { ArrowUpRight, CalendarDays, CircleAlert, Mail, PlugZap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ActionButton, InlineFeedback, SectionHeader } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  WorkspaceActivitySourceStatus,
  WorkspaceActivitySourceStatusReport,
} from '@dwp-frontend/shared-utils';

const accessibleFeedbackSx = {
  mt: 1.25,
  color: 'text.primary',
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  '& .MuiAlert-icon': { color: 'text.primary' },
} as const;

export function ActivityConnectorStatus({
  report,
  loading,
  failed,
  onRetry,
  retrying = false,
}: {
  report?: WorkspaceActivitySourceStatusReport;
  loading: boolean;
  failed: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { t } = useTranslation('work');
  const formatTimestamp = (value: string) =>
    formatDate(value, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const renderSource = (source: WorkspaceActivitySourceStatus, compact = false) => {
    const Icon = source.resourceKind === 'MAIL' ? Mail : CalendarDays;
    const needsResolution = source.status !== 'READY' && source.status !== 'SYNCING';
    const route = source.resourceKind === 'MAIL' ? '/mail/accounts' : '/calendar/settings';
    return (
      <Box
        key={`${source.resourceKind}:${source.sourceId}`}
        data-connector-status={source.status}
        data-connector-provenance={source.semantics}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gap: 1,
          alignItems: 'start',
          p: compact ? 1 : 1.25,
          bgcolor: compact ? 'transparent' : 'action.hover',
          borderRadius: (theme) => `${theme.shape.borderRadius}px`,
        }}
      >
        <Icon size={17} aria-hidden="true" />
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            <Typography
              variant="body2"
              fontWeight="fontWeightMedium"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {source.label}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              color={needsResolution ? 'warning' : source.status === 'READY' ? 'success' : 'info'}
              icon={needsResolution ? <CircleAlert size={13} aria-hidden="true" /> : undefined}
              label={t(`activityFoundation.connectorStatus.states.${source.status}`)}
              sx={{ color: 'text.primary', '& .MuiChip-icon': { color: 'inherit' } }}
            />
            {source.semantics === 'LOCAL_FIXTURE' && (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={t('activityFoundation.connectorStatus.localFixture')}
                sx={{ color: 'text.primary' }}
              />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.35 }}>
            {source.lastAttemptAt
              ? t('activityFoundation.connectorStatus.lastAttempt', {
                  at: formatTimestamp(source.lastAttemptAt),
                })
              : t('activityFoundation.connectorStatus.noAttempt')}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p">
            {source.lastSuccessAt
              ? t('activityFoundation.connectorStatus.lastSuccess', {
                  at: formatTimestamp(source.lastSuccessAt),
                })
              : t('activityFoundation.connectorStatus.noSuccess')}
          </Typography>
          {needsResolution && (
            <ActionButton
              component={Link}
              to={route}
              intent="quiet"
              size="small"
              endIcon={<ArrowUpRight size={14} aria-hidden="true" />}
              sx={{ mt: 0.75 }}
            >
              {t(
                source.resourceKind === 'MAIL'
                  ? 'activityFoundation.connectorStatus.resolveMail'
                  : 'activityFoundation.connectorStatus.resolveCalendar'
              )}
            </ActionButton>
          )}
        </Box>
      </Box>
    );
  };
  return (
    <Box
      component="section"
      aria-labelledby="activity-connector-status-title"
      sx={{
        mt: 3,
        p: { xs: 1.5, sm: 2 },
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <SectionHeader
        id="activity-connector-status-title"
        icon={PlugZap}
        title={t('activityFoundation.connectorStatus.title')}
        headingComponent="h2"
        density="compact"
      />
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
        {t('activityFoundation.connectorStatus.description')}
      </Typography>
      {failed && (
        <InlineFeedback
          severity="warning"
          title={t('activityFoundation.connectorStatus.unavailableTitle')}
          sx={accessibleFeedbackSx}
        >
          {t(
            report
              ? 'activityFoundation.connectorStatus.cachedDescription'
              : 'activityFoundation.connectorStatus.unavailableDescription'
          )}
          {onRetry && (
            <Box sx={{ mt: 1 }}>
              <ActionButton intent="secondary" size="small" onClick={onRetry} disabled={retrying}>
                {t('activityPage.retry')}
              </ActionButton>
            </Box>
          )}
        </InlineFeedback>
      )}
      {loading && !report ? (
        <Typography role="status" variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          {t('activityFoundation.connectorStatus.loading')}
        </Typography>
      ) : !report && failed ? null : !report?.sources.length ? (
        <Typography role="status" variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          {t('activityFoundation.connectorStatus.empty')}
        </Typography>
      ) : (
        <Stack gap={1} sx={{ mt: 1.25 }}>
          {report.sources
            .filter((source) => source.status !== 'READY')
            .map((source) => renderSource(source))}
          {report.sources.some((source) => source.status === 'READY') && (
            <Box
              component="details"
              sx={{
                border: 1,
                borderColor: 'divider',
                '& > summary': {
                  minHeight: 44,
                  display: 'list-item',
                  alignContent: 'center',
                  px: 1.25,
                  cursor: 'pointer',
                },
              }}
            >
              <Typography component="summary" variant="body2" fontWeight="fontWeightMedium">
                {t('activityFoundation.connectorStatus.readySummary', {
                  count: report.sources.filter((source) => source.status === 'READY').length,
                })}
              </Typography>
              <Stack gap={0.5} sx={{ px: 0.5, pb: 0.5 }}>
                {report.sources
                  .filter((source) => source.status === 'READY')
                  .map((source) => renderSource(source, true))}
              </Stack>
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" component="p">
            {t('activityFoundation.connectorStatus.observedAt', {
              at: formatTimestamp(report.observedAt),
            })}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
