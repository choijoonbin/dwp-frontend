import { useTranslation } from 'react-i18next';
import { CalendarDays, CircleAlert, Mail, PlugZap } from 'lucide-react';
import { InlineFeedback, SectionHeader } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { WorkspaceActivitySourceStatusReport } from '@dwp-frontend/shared-utils';

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
}: {
  report?: WorkspaceActivitySourceStatusReport;
  loading: boolean;
  failed: boolean;
}) {
  const { t } = useTranslation('work');
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
      {failed ? (
        <InlineFeedback
          severity="warning"
          title={t('activityFoundation.connectorStatus.unavailableTitle')}
          sx={accessibleFeedbackSx}
        >
          {t('activityFoundation.connectorStatus.unavailableDescription')}
        </InlineFeedback>
      ) : loading && !report ? (
        <Typography role="status" variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          {t('activityFoundation.connectorStatus.loading')}
        </Typography>
      ) : !report?.sources.length ? (
        <Typography role="status" variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          {t('activityFoundation.connectorStatus.empty')}
        </Typography>
      ) : (
        <Stack gap={1} sx={{ mt: 1.25 }}>
          {report.sources.map((source) => {
            const Icon = source.resourceKind === 'MAIL' ? Mail : CalendarDays;
            const needsAttention = source.status !== 'READY' && source.status !== 'SYNCING';
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
                  p: 1.25,
                  bgcolor: 'action.hover',
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
                      color={
                        needsAttention ? 'warning' : source.status === 'READY' ? 'success' : 'info'
                      }
                      icon={
                        needsAttention ? <CircleAlert size={13} aria-hidden="true" /> : undefined
                      }
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
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="p"
                    sx={{ mt: 0.35 }}
                  >
                    {source.lastSuccessAt
                      ? t('activityFoundation.connectorStatus.lastSuccess', {
                          at: formatDate(source.lastSuccessAt, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                        })
                      : t('activityFoundation.connectorStatus.noSuccess')}
                  </Typography>
                </Box>
              </Box>
            );
          })}
          <Typography variant="caption" color="text.secondary" component="p">
            {t('activityFoundation.connectorStatus.observedAt', {
              at: formatDate(report.observedAt, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
            })}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
