import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppWindow, Settings2, ShieldCheck } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import type { HomeBackgroundPosition, HomeAudienceProfile } from '@dwp-frontend/shared-utils';

type HomeDayRailProps = {
  audience: HomeAudienceProfile;
  currentDate: string;
  headline: string;
  subheadline: string;
  backgroundUrl: string;
  usesDefaultBackground: boolean;
  backgroundPosition: HomeBackgroundPosition;
  overlayOpacity: number;
  workspaceTools?: ReactNode;
  assignedAppCount: number;
  onBrowseAll: () => void;
  personalizationBusy?: boolean;
  onStartEditing?: () => void;
};

const audienceTone = {
  MEMBER: '#176B68',
  MANAGER: '#7A4FC4',
  OPERATOR: '#A14B14',
} as const;

export function HomeDayRail({
  audience,
  currentDate,
  headline,
  subheadline,
  backgroundUrl,
  usesDefaultBackground,
  backgroundPosition,
  overlayOpacity,
  workspaceTools,
  assignedAppCount,
  onBrowseAll,
  personalizationBusy = false,
  onStartEditing,
}: HomeDayRailProps) {
  const { t } = useTranslation('home');
  const backgroundAlignment = usesDefaultBackground
    ? 'center center'
    : `${backgroundPosition.toLowerCase()} center`;
  const backgroundOverlay = Math.min(0.8, Math.max(0, overlayOpacity / 100));
  const mobileScrim = Math.max(0.58, backgroundOverlay);
  const desktopImageScrim = Math.min(0.05, backgroundOverlay);

  return (
    <Box
      component="section"
      aria-label={t('page.personalWorkspace')}
      data-testid="home-command-center"
      sx={{
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.default' : '#FAF8FF'),
      }}
    >
      <Box
        data-testid="home-hero"
        sx={{
          position: 'relative',
          isolation: 'isolate',
          overflow: 'hidden',
          minHeight: { xs: 180, md: 144 },
          bgcolor: { xs: '#DAE2FF', md: '#E2E2EB' },
          backgroundImage: `url(${backgroundUrl})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: backgroundAlignment,
          backgroundSize: 'cover',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            background: (theme) => {
              const scrimColor =
                theme.palette.mode === 'dark'
                  ? foundationTokens.color.neutral[900]
                  : foundationTokens.color.neutral[25];
              return {
                xs: alpha(scrimColor, mobileScrim),
                md: alpha(scrimColor, desktopImageScrim),
              };
            },
            pointerEvents: 'none',
          },
          '@media (forced-colors: active)': {
            bgcolor: 'Canvas',
            backgroundImage: 'none',
            '&::before': { display: 'none' },
          },
        }}
      >
        <Box
          sx={{
            width: 1,
            maxWidth: 2240,
            minHeight: { xs: 180, md: 144 },
            mx: 'auto',
            px: { xs: 2, md: '50px' },
            py: { xs: 2, md: 3 },
            display: 'flex',
            alignItems: 'center',
            color: (theme) =>
              theme.palette.mode === 'dark' ? '#F8FAFC' : { xs: '#191B22', md: '#F8FAFC' },
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Stack
            width={1}
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'flex-start', md: 'flex-end' }}
            justifyContent="space-between"
            gap={2}
          >
            <Box minWidth={0}>
              <Stack
                data-home-hero-context
                direction="row"
                alignItems="center"
                gap={1}
                flexWrap="wrap"
              >
                <Typography
                  variant="overline"
                  sx={{
                    color: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(248,250,252,0.78)'
                        : { xs: '#434653', md: 'rgba(248,250,252,0.82)' },
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 11,
                    textShadow: { md: '0 1px 3px rgba(0,0,0,0.42)' },
                  }}
                >
                  {currentDate}
                </Typography>
                <Chip
                  size="small"
                  icon={<ShieldCheck size={14} aria-hidden="true" />}
                  label={t(`dayRail.audience.${audience.toLowerCase()}`)}
                  sx={{
                    color: audienceTone[audience],
                    bgcolor: 'common.white',
                    border: 1,
                    borderColor: 'divider',
                    '& .MuiChip-icon': { color: 'inherit' },
                  }}
                />
              </Stack>
              <Typography
                component="h1"
                sx={{
                  mt: 0.5,
                  color: (theme) =>
                    theme.palette.mode === 'dark' ? '#F8FAFC' : { xs: '#001946', md: '#F8FAFC' },
                  fontSize: { xs: 24, md: 32 },
                  fontWeight: 600,
                  lineHeight: { xs: '32px', md: '40px' },
                  textShadow: { md: '0 2px 8px rgba(0,0,0,0.42)' },
                }}
              >
                {headline}
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  mt: 0.5,
                  maxWidth: 760,
                  color: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(248,250,252,0.8)'
                      : { xs: '#00419E', md: 'rgba(248,250,252,0.84)' },
                  fontSize: { xs: 14, md: 16 },
                  lineHeight: { xs: '20px', md: '24px' },
                  display: '-webkit-box',
                  WebkitLineClamp: { xs: 2, md: 1 },
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textShadow: { md: '0 1px 4px rgba(0,0,0,0.42)' },
                }}
              >
                {subheadline}
              </Typography>
            </Box>
            <Stack
              data-launchpad-actions
              data-home-action-placement="hero"
              role="group"
              aria-label={t('launchpad.actionsLabel')}
              direction="row"
              alignItems="stretch"
              gap={0}
              alignSelf={{ xs: 'flex-end', md: 'auto' }}
              sx={{
                flex: '0 0 auto',
                minHeight: 38,
                maxWidth: '100%',
                overflow: 'hidden',
                color: '#FFFFFF',
                bgcolor: 'rgba(7,18,42,0.46)',
                border: 1,
                borderColor: 'rgba(255,255,255,0.34)',
                borderRadius: 1,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.13), 0 8px 24px rgba(0,7,24,0.16)',
                backdropFilter: 'blur(16px) saturate(145%)',
                WebkitBackdropFilter: 'blur(16px) saturate(145%)',
                '& .MuiButton-root': {
                  minHeight: 38,
                  px: { xs: 1, sm: 1.25 },
                  borderRadius: 0,
                  color: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: '18px',
                  whiteSpace: 'nowrap',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                  '&:focus-visible': {
                    outline: '2px solid #8DB8FF',
                    outlineOffset: -3,
                  },
                },
                '@media (prefers-reduced-transparency: reduce), (forced-colors: active)': {
                  bgcolor: '#15233B',
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                  boxShadow: 'none',
                },
              }}
            >
              <Box
                data-launchpad-assignment-count
                aria-label={t('launchpad.assignedCount', { count: assignedAppCount })}
                sx={{
                  minHeight: 38,
                  px: { xs: 1, sm: 1.25 },
                  display: 'flex',
                  alignItems: 'center',
                  borderRight: 1,
                  borderColor: 'rgba(255,255,255,0.22)',
                }}
              >
                <Typography
                  component="span"
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.76)',
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: '18px',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('launchpad.assignedCount', { count: assignedAppCount })}
                </Typography>
              </Box>
              <ActionButton
                intent="quiet"
                startIcon={<AppWindow size={17} strokeWidth={1.8} aria-hidden="true" />}
                onClick={onBrowseAll}
                sx={{
                  borderRight: onStartEditing ? 1 : 0,
                  borderColor: 'rgba(255,255,255,0.22)',
                }}
              >
                {t('launchpad.allApps')}
              </ActionButton>
              {onStartEditing && (
                <ActionButton
                  data-home-edit-trigger
                  data-home-action-policy="PERSONAL"
                  intent="quiet"
                  startIcon={<Settings2 size={17} strokeWidth={1.8} aria-hidden="true" />}
                  disabled={personalizationBusy}
                  onClick={onStartEditing}
                >
                  {t('launchpad.editHome')}
                </ActionButton>
              )}
            </Stack>
          </Stack>
        </Box>

        {workspaceTools && (
          <Box
            data-home-zone="workspace-tools"
            data-home-zone-policy="PERSONAL"
            sx={{
              width: 1,
              maxWidth: 2240,
              mx: 'auto',
              px: { xs: 2, md: '50px' },
              pb: { xs: 2, md: 3 },
              position: 'relative',
              zIndex: 1,
            }}
          >
            {workspaceTools}
          </Box>
        )}
      </Box>
    </Box>
  );
}
