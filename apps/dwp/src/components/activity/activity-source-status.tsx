import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleAlert, LockKeyhole } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import type { ActivitySourceState } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

/** Source availability describes the received page, never connector health or SLA. */
export function ActivitySourceStatus({
  sources,
  partial = false,
}: {
  sources?: ActivitySourceState[];
  partial?: boolean;
}) {
  const { t } = useTranslation('work');
  if (!sources?.length) return null;
  return (
    <Box aria-label={t('activityFoundation.sources.title')} sx={{ mt: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {sources.map((source) => {
          const Icon =
            source.status === 'AVAILABLE'
              ? CheckCircle2
              : source.status === 'FORBIDDEN'
                ? LockKeyhole
                : CircleAlert;
          return (
            <Chip
              key={source.sourceScope}
              size="small"
              variant="outlined"
              icon={<Icon size={14} aria-hidden="true" />}
              label={`${source.sourceScope === 'DWAI_ON' ? 'DWAI·ON' : 'DWP Workspace'} · ${t(`activityFoundation.sources.${source.status}`)}`}
              title={
                source.generatedAt
                  ? t('activityFoundation.lastRefresh', {
                      at: formatDate(source.generatedAt, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    })
                  : undefined
              }
              sx={{
                maxWidth: '100%',
                height: 'auto',
                minHeight: 28,
                '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 },
                color: (theme) =>
                  source.status === 'UNAVAILABLE'
                    ? theme.palette.mode === 'light'
                      ? theme.palette.warning.dark
                      : theme.palette.warning.light
                    : theme.palette.text.secondary,
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
          );
        })}
      </Box>
      {partial && (
        <Typography role="status" variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          {t('activityFoundation.sources.partial')}
        </Typography>
      )}
    </Box>
  );
}
