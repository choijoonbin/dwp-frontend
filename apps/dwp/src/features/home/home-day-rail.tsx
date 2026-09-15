import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  AppWindow,
  Building2,
  CalendarDays,
  CheckCircle2,
  Newspaper,
  PanelsTopLeft,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import type {
  CommunicationItem,
  HomeAudienceProfile,
  HomeBackgroundPosition,
} from '@dwp-frontend/shared-utils';

type HomeDayRailProps = {
  audience: HomeAudienceProfile;
  currentDate: string;
  headline: string;
  subheadline: string;
  backgroundUrl: string;
  usesDefaultBackground: boolean;
  backgroundPosition: HomeBackgroundPosition;
  overlayOpacity: number;
  featuredStory?: CommunicationItem | null;
  requiredStory?: CommunicationItem | null;
  workspaceTools?: ReactNode;
  assignedAppCount: number;
  onBrowseAll: () => void;
  onOpenOrganizationUpdates: () => void;
  personalizationBusy?: boolean;
  onStartEditing?: () => void;
  onOpenStudio?: () => void;
};

const audienceTone = {
  MEMBER: '#176B68',
  MANAGER: '#7A4FC4',
  OPERATOR: '#A14B14',
} as const;

const darkAudienceTone = {
  MEMBER: '#77E1DB',
  MANAGER: '#D0BCFF',
  OPERATOR: '#FFB77D',
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
  featuredStory,
  requiredStory,
  workspaceTools,
  assignedAppCount,
  onBrowseAll,
  onOpenOrganizationUpdates,
  personalizationBusy = false,
  onStartEditing,
  onOpenStudio,
}: HomeDayRailProps) {
  const { t } = useTranslation('home');
  const backgroundAlignment = usesDefaultBackground
    ? 'center center'
    : `${backgroundPosition.toLowerCase()} center`;
  const backgroundOverlay = Math.min(0.8, Math.max(0, overlayOpacity / 100));

  return (
    <Box
      component="section"
      aria-label={t('classic.portalAriaLabel')}
      data-testid="home-command-center"
      data-home-ia="organization-portal"
      sx={{
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.default' : '#F6F7FB'),
      }}
    >
      <Box
        data-testid="home-hero"
        sx={{
          position: 'relative',
          isolation: 'isolate',
          overflow: 'hidden',
          bgcolor: 'background.default',
          backgroundImage: `url(${backgroundUrl})`,
          backgroundPosition: backgroundAlignment,
          backgroundSize: '0 0',
          backgroundRepeat: 'no-repeat',
          '@media (forced-colors: active)': {
            bgcolor: 'Canvas',
            backgroundImage: 'none',
          },
        }}
      >
        <Box
          sx={{
            width: 1,
            maxWidth: 2240,
            mx: 'auto',
            px: { xs: 2, md: 4 },
            pt: { xs: 2, md: 2.5 },
          }}
        >
          <Stack
            width={1}
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
            gap={1.5}
          >
            <Box minWidth={0}>
              <Stack
                data-home-hero-context
                direction="row"
                alignItems="center"
                gap={1}
                flexWrap="wrap"
              >
                <Chip
                  size="small"
                  icon={<Building2 size={14} aria-hidden="true" />}
                  label={t('classic.portalBadge')}
                  sx={{
                    color: (theme) =>
                      theme.palette.mode === 'dark'
                        ? theme.palette.primary.light
                        : theme.palette.primary.dark,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    '& .MuiChip-icon': { color: 'inherit' },
                  }}
                />
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}
                >
                  {currentDate}
                </Typography>
                <Chip
                  size="small"
                  icon={<ShieldCheck size={14} aria-hidden="true" />}
                  label={t(`dayRail.audience.${audience.toLowerCase()}`)}
                  sx={{
                    color: (theme) =>
                      theme.palette.mode === 'dark'
                        ? darkAudienceTone[audience]
                        : audienceTone[audience],
                    bgcolor: 'background.paper',
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
                  color: 'text.primary',
                  fontSize: { xs: 23, md: 28 },
                  fontWeight: 700,
                  lineHeight: { xs: '31px', md: '36px' },
                }}
              >
                {featuredStory ? t('classic.portalTitle') : headline}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.25, maxWidth: 760, overflowWrap: 'anywhere' }}
              >
                {featuredStory ? t('classic.portalDescription') : subheadline}
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
              sx={{
                flex: '0 0 auto',
                minHeight: { xs: 44, md: 40 },
                maxWidth: '100%',
                overflow: 'hidden',
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: foundationTokens.home.radius.control,
                '& .MuiButton-root': {
                  minHeight: { xs: 44, md: 40 },
                  px: { xs: 1, sm: 1.25 },
                  borderRadius: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: '18px',
                  whiteSpace: 'nowrap',
                },
              }}
            >
              <Box
                data-launchpad-assignment-count
                aria-label={t('launchpad.assignedCount', { count: assignedAppCount })}
                sx={{
                  minHeight: { xs: 44, md: 40 },
                  px: { xs: 1, sm: 1.25 },
                  display: 'flex',
                  alignItems: 'center',
                  borderRight: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                >
                  {t('launchpad.assignedCount', { count: assignedAppCount })}
                </Typography>
              </Box>
              <ActionButton
                intent="quiet"
                startIcon={<AppWindow size={17} strokeWidth={1.8} aria-hidden="true" />}
                onClick={onBrowseAll}
                sx={{ borderRight: onStartEditing || onOpenStudio ? 1 : 0, borderColor: 'divider' }}
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
                  sx={{ borderRight: onOpenStudio ? 1 : 0, borderColor: 'divider' }}
                >
                  {t('launchpad.editHome')}
                </ActionButton>
              )}
              {onOpenStudio && (
                <ActionButton
                  type="button"
                  data-home-studio-trigger
                  data-home-action-policy="PERSONAL"
                  intent="quiet"
                  startIcon={<PanelsTopLeft size={17} strokeWidth={1.8} aria-hidden="true" />}
                  disabled={personalizationBusy}
                  onClick={onOpenStudio}
                >
                  {t('classic.openStudio')}
                </ActionButton>
              )}
            </Stack>
          </Stack>

          <Box
            role="status"
            data-classic-required-notice={requiredStory ? 'required' : 'complete'}
            sx={(theme) => ({
              mt: 1.5,
              minHeight: 44,
              p: 1.25,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              border: 1,
              borderColor: requiredStory ? 'error.light' : 'primary.light',
              borderRadius: foundationTokens.home.radius.control,
              bgcolor: requiredStory
                ? alpha(theme.palette.error.main, backgroundOverlay || 0.06)
                : alpha(theme.palette.primary.main, 0.06),
            })}
          >
            {requiredStory ? (
              <AlertTriangle size={18} color="#DC2626" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={18} color="#2563EB" aria-hidden="true" />
            )}
            <Box minWidth={0} sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                {requiredStory ? t('classic.notice.required') : t('classic.notice.complete')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {requiredStory?.title ?? t('classic.notice.completeDescription')}
              </Typography>
            </Box>
            {requiredStory && (
              <ActionButton
                intent="primary"
                size="small"
                onClick={onOpenOrganizationUpdates}
                sx={{ minHeight: 44, flex: '0 0 auto' }}
              >
                {t('classic.notice.action')}
              </ActionButton>
            )}
          </Box>

          {featuredStory ? (
            <Box
              data-classic-featured-news
              sx={{
                mt: 1.5,
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(280px, 36%) 1fr' },
                bgcolor: 'background.paper',
                color: 'text.primary',
                border: 1,
                borderColor: 'divider',
                borderRadius: foundationTokens.home.radius.control,
                overflow: 'hidden',
                boxShadow: foundationTokens.home.shadow.quietCard,
              }}
            >
              <Box
                component="img"
                src={featuredStory.coverImageUrl || backgroundUrl}
                alt=""
                sx={{
                  width: 1,
                  height: 1,
                  minHeight: { xs: 150, md: 184 },
                  maxHeight: { xs: 210, md: 216 },
                  objectFit: 'cover',
                }}
              />
              <Stack sx={{ minWidth: 0, p: { xs: 2, md: 2.5 } }} gap={0.75}>
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                  <Chip size="small" color="primary" label={t('classic.featuredLabel')} />
                  <Typography variant="caption" color="text.secondary">
                    {featuredStory.publisherName}
                  </Typography>
                  {featuredStory.publishedAt && (
                    <Stack direction="row" alignItems="center" gap={0.5} color="text.secondary">
                      <CalendarDays size={14} aria-hidden="true" />
                      <Typography variant="caption">
                        {formatDate(featuredStory.publishedAt, { dateStyle: 'medium' })}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
                <Typography
                  component="h2"
                  sx={{
                    fontSize: { xs: 20, md: 24 },
                    lineHeight: { xs: '28px', md: '32px' },
                    fontWeight: foundationTokens.home.typography.weightBold,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {featuredStory.title}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ lineHeight: 1.6, overflowWrap: 'anywhere' }}
                >
                  {featuredStory.summary}
                </Typography>
                <ActionButton
                  data-classic-primary-action
                  intent="primary"
                  size="small"
                  startIcon={<Newspaper size={17} aria-hidden="true" />}
                  onClick={onOpenOrganizationUpdates}
                  sx={{ mt: 'auto', alignSelf: 'flex-start', minHeight: 44 }}
                >
                  {t('classic.openFeaturedStory')}
                </ActionButton>
              </Stack>
            </Box>
          ) : (
            <ActionButton
              data-classic-primary-action
              intent="primary"
              size="small"
              startIcon={<Newspaper size={17} aria-hidden="true" />}
              onClick={onOpenOrganizationUpdates}
              sx={{ mt: 1.5, minHeight: 44 }}
            >
              {t('classic.openOrganizationUpdates')}
            </ActionButton>
          )}

          {workspaceTools && (
            <Box
              data-home-zone="workspace-tools"
              data-home-zone-policy="PERSONAL"
              sx={{ py: { xs: 2, md: 2.5 }, position: 'relative', zIndex: 1 }}
            >
              {workspaceTools}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
