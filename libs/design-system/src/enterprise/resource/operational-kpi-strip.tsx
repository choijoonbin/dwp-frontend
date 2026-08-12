import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

export type OperationalKpiTone = 'neutral' | 'info' | 'success' | 'warning' | 'critical';

const TONE_COLOR: Record<OperationalKpiTone, string> = {
  neutral: 'text.primary',
  info: 'info.main',
  success: 'success.main',
  warning: 'warning.main',
  critical: 'error.main',
};

export type OperationalKpi = {
  key: string;
  label: string;
  value: React.ReactNode;
  detail?: string;
  trend?: string;
  tone?: OperationalKpiTone;
  onSelect?: () => void;
};

export function OperationalKpiStrip({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: OperationalKpi[];
}) {
  return (
    <Box
      aria-label={ariaLabel}
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          lg: `repeat(${Math.min(items.length, 6)}, minmax(0, 1fr))`,
        },
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {items.map((item, index) => {
        const body = (
          <Box sx={{ width: 1, px: { xs: 1.5, md: 2.25 }, py: 1.75, textAlign: 'left' }}>
            <Typography
              component="p"
              variant="h5"
              sx={{ color: TONE_COLOR[item.tone ?? 'neutral'], fontVariantNumeric: 'tabular-nums' }}
            >
              {item.value}
            </Typography>
            <Typography component="p" variant="subtitle2" sx={{ mt: 0.25 }}>
              {item.label}
            </Typography>
            {(item.detail || item.trend) && (
              <Typography variant="caption" color="text.secondary">
                {[item.trend, item.detail].filter(Boolean).join(' · ')}
              </Typography>
            )}
          </Box>
        );
        return (
          <Box
            key={item.key}
            sx={{
              minWidth: 0,
              borderLeft: { xs: index % 2 === 0 ? 0 : 1, lg: index === 0 ? 0 : 1 },
              borderTop: { xs: index > 1 ? 1 : 0, lg: 0 },
              borderColor: 'divider',
            }}
          >
            {item.onSelect ? (
              <ButtonBase
                onClick={item.onSelect}
                sx={{ width: 1, '&:hover': { bgcolor: 'action.hover' } }}
              >
                {body}
              </ButtonBase>
            ) : (
              body
            )}
          </Box>
        );
      })}
    </Box>
  );
}
