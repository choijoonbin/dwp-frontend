import { useTranslation } from 'react-i18next';
import {
  foundationTokens,
  getProductExperienceProfile,
  PRODUCT_EXPERIENCE_SOFT_OPACITY,
  resolveProductExperienceTones,
  useAppearance,
} from '@dwp-frontend/design-system';
import { alpha, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type GovernanceReviewRow = { label: string; current: string; proposed: string };

export function WorkplaceGovernanceValueComparison({
  rows,
  stacked = false,
}: {
  rows: GovernanceReviewRow[];
  stacked?: boolean;
}) {
  const { t } = useTranslation('rooms');
  const theme = useTheme();
  const { preference } = useAppearance();
  const profile = getProductExperienceProfile('rooms');
  const dark = theme.palette.mode === 'dark';
  const tones = resolveProductExperienceTones(profile, {
    mode: theme.palette.mode,
    highContrast: preference.highContrast,
    canvas: dark ? theme.palette.background.default : profile.canvas,
    sidebar: dark ? theme.palette.background.paper : profile.sidebar,
  });
  const proposedSurface = dark
    ? alpha(tones.accent, PRODUCT_EXPERIENCE_SOFT_OPACITY)
    : profile.softSurface;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: stacked ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
        gap: { xs: 1, sm: 1.5 },
      }}
    >
      {(['current', 'proposed'] as const).map((side) => (
        <Box
          key={side}
          component="section"
          aria-label={t(
            `workplace.experience.${side === 'current' ? 'currentValues' : 'proposedValues'}`
          )}
          sx={{
            p: { xs: 1, sm: 1.5 },
            border: 1,
            borderColor: side === 'current' ? 'info.main' : tones.accent,
            borderRadius: foundationTokens.radius.control + 'px',
            bgcolor:
              side === 'current'
                ? alpha(theme.palette.info.main, PRODUCT_EXPERIENCE_SOFT_OPACITY)
                : proposedSurface,
            minWidth: 0,
          }}
        >
          <Typography
            variant="overline"
            fontWeight="fontWeightBold"
            color={side === 'current' ? (dark ? 'info.light' : 'info.dark') : tones.accent}
          >
            {t(`workplace.experience.${side === 'current' ? 'currentValues' : 'proposedValues'}`)}
          </Typography>
          <Stack component="dl" spacing={0} sx={{ m: 0, mt: 1 }}>
            {rows.map((row) => (
              <Box
                key={row.label}
                sx={{
                  py: stacked ? 0.75 : 1,
                  borderTop: 1,
                  borderColor: 'divider',
                  minWidth: 0,
                  ...(stacked
                    ? {
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, .8fr) minmax(0, 1.2fr)',
                        gap: 1,
                      }
                    : {}),
                }}
              >
                <Typography component="dt" variant="caption" color="text.secondary">
                  {row.label}
                </Typography>
                <Typography
                  component="dd"
                  variant="body2"
                  sx={{ m: 0, overflowWrap: 'anywhere' }}
                  fontWeight={
                    side === 'proposed' && row.current !== row.proposed
                      ? 'fontWeightBold'
                      : 'fontWeightRegular'
                  }
                >
                  {row[side]}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}
