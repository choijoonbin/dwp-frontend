/**
 * Workbench Stream — agent_activity_log 실시간 터미널 스타일, 350px
 * API: useDashboardAgentActivityQuery (GET /api/synapse/dashboard/agent-stream)
 */

import type { Theme, SxProps } from '@mui/material/styles';

import { varAlpha } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useDashboardAgentActivityQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { ErrorStateWithRetry } from '../../../components/ux/error-state-with-retry';
import { mapAgentActivity , getAgentEventTypeLabelKey } from '../../dashboard/adapters/dashboard-adapter';

export type WorkbenchStreamPanelProps = {
  getGlassPanelSx: (theme: Theme) => Record<string, unknown>;
  sx?: SxProps<Theme>;
};

export const WorkbenchStreamPanel = ({ getGlassPanelSx, sx }: WorkbenchStreamPanelProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const { data: rawItems, isLoading, error, refetch } = useDashboardAgentActivityQuery('6h', 50);
  const activities = mapAgentActivity(rawItems);

  return (
    <Box
      sx={{
        ...getGlassPanelSx(theme),
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderRadius: 0,
        borderLeft: `1px solid ${varAlpha(theme.vars.palette.dividerChannel, 0.12)}`,
        ...sx,
      }}
    >
      <Box
        sx={{
          height: 'var(--workbench-panel-header-height, 56px)',
          minHeight: 'var(--workbench-panel-header-height, 56px)',
          pt: 0,
          px: 2,
          pb: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          {t('workbench.streamTitle')}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {error && (
          <ErrorStateWithRetry
            message={error instanceof Error ? error.message : undefined}
            onRetry={() => refetch()}
          />
        )}

        {!error && (
          <Box
            component="pre"
            sx={{
              flex: 1,
              m: 0,
              p: 1.5,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              overflow: 'auto',
              bgcolor: varAlpha(theme.vars.palette.grey['900Channel'], theme.palette.mode === 'dark' ? 0.6 : 0.08),
              color: 'text.secondary',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              mx: 1.5,
              mb: 1.5,
            }}
          >
            {isLoading && (
              <Typography component="span" variant="caption" color="text.secondary">
                {t('workbench.streamLoading', 'Loading agent activity...')}
              </Typography>
            )}
            {!isLoading && activities.length === 0 && (
              <Typography component="span" variant="caption" color="text.secondary">
                {t('workbench.streamHint')}
              </Typography>
            )}
            {!isLoading &&
              activities.length > 0 &&
              activities.map((a) => {
                const time = new Date(a.timestamp).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                const labelKey = `dashboard.agentStream.eventType.${getAgentEventTypeLabelKey(a.action)}`;
                const label = t(labelKey);
                const line = `[${time}] ${label}: ${a.message || a.status}`;
                return (
                  <Box
                    component="span"
                    key={a.id}
                    sx={{ display: 'block', color: 'text.secondary' }}
                  >
                    {line}
                  </Box>
                );
              })}
          </Box>
        )}
      </Box>
    </Box>
  );
};
