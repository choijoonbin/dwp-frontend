import { useTranslation } from 'react-i18next';
import { AlarmClock, CheckCheck, ListTodo, UserRoundCheck } from 'lucide-react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { meetingShape } from './meeting-visual-system';

export function MeetingFollowUpsSummary({
  total,
  visible,
  active,
  urgent,
}: {
  total: number;
  visible: number;
  active: number;
  urgent: number;
}) {
  const { t } = useTranslation('meetings');
  const items = [
    { key: 'scopeTotal', value: total, icon: ListTodo, tone: 'primary' },
    { key: 'pageVisible', value: visible, icon: UserRoundCheck, tone: 'primary' },
    { key: 'pageActive', value: active, icon: CheckCheck, tone: 'success' },
    { key: 'pageUrgent', value: urgent, icon: AlarmClock, tone: 'error' },
  ] as const;
  return (
    <Box
      component="section"
      aria-label={t('followUps.summaryLabel')}
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: { xs: 0.75, sm: 1.25 },
      }}
    >
      {items.map(({ key, value, icon: Icon, tone }) => (
        <Box
          key={key}
          sx={(theme) => ({
            p: { xs: 1, sm: 2 },
            bgcolor:
              tone === 'error' && value
                ? alpha(theme.palette.error.main, 0.055)
                : theme.palette.background.paper,
            borderRadius: meetingShape.card,
            border: `1px solid ${alpha(theme.palette[tone].main, 0.12)}`,
            minWidth: 0,
          })}
        >
          <Stack direction="row" justifyContent="space-between" gap={0.5}>
            <Typography
              variant="caption"
              fontWeight="fontWeightBold"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              {t(`followUps.metrics.${key}`)}
            </Typography>
            <Typography
              variant="caption"
              fontWeight="fontWeightBold"
              sx={{ display: { xs: 'block', sm: 'none' } }}
            >
              {t(`designReview.followUps.metrics.${key}`)}
            </Typography>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Icon size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
            </Box>
          </Stack>
          <Typography
            variant="h3"
            sx={{ my: 0.75, color: `${tone}.main`, fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </Typography>
          <Box
            aria-hidden="true"
            sx={(theme) => ({
              height: 4,
              borderRadius: meetingShape.inset,
              bgcolor: alpha(theme.palette[tone].main, 0.12),
              overflow: 'hidden',
              mb: 0.75,
            })}
          >
            <Box
              sx={{
                height: '100%',
                width: `${Math.min(100, total > 0 ? (value / total) * 100 : 0)}%`,
                bgcolor: `${tone}.main`,
              }}
            />
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ lineHeight: 'caption.lineHeight', display: { xs: 'none', sm: 'block' } }}
          >
            {t(
              key === 'scopeTotal'
                ? 'followUps.metrics.authoritativeScope'
                : 'followUps.metrics.currentPage'
            )}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
