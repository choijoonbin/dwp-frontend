import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Grid2X2,
  LockKeyhole,
  Newspaper,
  PanelsTopLeft,
  RefreshCw,
  Settings2,
  Sparkles,
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
  communicationState: ClassicCommunicationState;
  workspaceTools?: ReactNode;
  assignedAppCount: number;
  onBrowseAll: () => void;
  onOpenOrganizationUpdates: () => void;
  personalizationBusy?: boolean;
  onStartEditing?: () => void;
  onOpenStudio?: () => void;
};

export type ClassicCommunicationState =
  | 'initial-loading'
  | 'background-refresh'
  | 'empty'
  | 'forbidden'
  | 'stale'
  | 'widget-error'
  | null;

const CANONICAL_MEDIA_PREFIX = '/assets/home/wave2/classic-';

function ClassicFeaturedImage({ story, fallback }: { story: CommunicationItem; fallback: string }) {
  const src = story.coverImageUrl || fallback;
  const canonical = src.startsWith(CANONICAL_MEDIA_PREFIX);
  return (
    <Box
      component="picture"
      sx={{ display: 'block', width: 1, height: 1, minWidth: 0, overflow: 'hidden' }}
    >
      {canonical && (
        <>
          <source
            media="(max-width: 340px)"
            srcSet="/assets/home/wave2/classic-mobile-c04-hero.jpg"
          />
          <source
            media="(max-width: 600px)"
            srcSet="/assets/home/wave2/classic-mobile-c03-hero.jpg"
          />
          <source media="(max-width: 1320px)" srcSet="/assets/home/wave2/classic-c02-hero.jpg" />
          <source media="(min-width: 1321px)" srcSet="/assets/home/wave2/classic-c01-hero.jpg" />
        </>
      )}
      <Box
        component="img"
        src={src}
        alt=""
        sx={{
          display: 'block',
          width: 1,
          height: 1,
          minHeight: { xs: 112, sm: 148, md: 230 },
          maxHeight: { xs: 148, md: 252 },
          objectFit: 'cover',
          objectPosition: 'center',
        }}
      />
    </Box>
  );
}

export function HomeDayRail({
  audience: _audience,
  currentDate,
  headline: _headline,
  subheadline: _subheadline,
  backgroundUrl,
  usesDefaultBackground: _usesDefaultBackground,
  backgroundPosition: _backgroundPosition,
  overlayOpacity,
  featuredStory,
  requiredStory,
  communicationState,
  workspaceTools,
  assignedAppCount,
  onBrowseAll,
  onOpenOrganizationUpdates,
  personalizationBusy = false,
  onStartEditing,
  onOpenStudio,
}: HomeDayRailProps) {
  const { t } = useTranslation('home');
  const noticeOpacity = Math.min(0.14, Math.max(0.06, overlayOpacity / 500));
  const communicationUnverified = communicationState !== null && communicationState !== 'empty';
  const CommunicationStateIcon =
    communicationState === 'forbidden'
      ? LockKeyhole
      : communicationState === 'background-refresh'
        ? RefreshCw
        : communicationState === 'initial-loading' || communicationState === 'stale'
          ? Clock3
          : AlertTriangle;

  return (
    <Box
      component="section"
      aria-label={t('classic.portalAriaLabel')}
      data-testid="home-command-center"
      data-home-ia="organization-portal"
      sx={{ bgcolor: 'var(--home-canvas)', color: 'text.primary' }}
    >
      <Box
        data-testid="home-hero"
        sx={{
          width: 1,
          maxWidth: 1192,
          mx: 'auto',
          px: { xs: 1.25, sm: 2, md: 3 },
          pt: { xs: 1, md: 2.25 },
          '@media (forced-colors: active)': { bgcolor: 'Canvas', color: 'CanvasText' },
        }}
      >
        <Stack
          data-home-hero-context
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1.5}
          sx={{
            minHeight: { xs: 42, md: 54 },
            px: { xs: 1, md: 2 },
            py: { xs: 0.5, md: 0.75 },
            bgcolor: 'background.paper',
            borderRadius: foundationTokens.home.radius.control,
            boxShadow: foundationTokens.home.shadow.quietCard,
          }}
        >
          <Stack minWidth={0} direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Stack direction="row" alignItems="center" gap={0.75} minWidth={0}>
              <Building2
                size={17}
                color={foundationTokens.color.product.primary}
                aria-hidden="true"
              />
              <Typography
                component="span"
                sx={{
                  color: 'primary.main',
                  fontSize: { xs: 11, md: 15 },
                  fontWeight: foundationTokens.home.typography.weightEmphasis,
                  whiteSpace: { xs: 'nowrap', md: 'normal' },
                }}
              >
                {t('classic.portalTitle')}
              </Typography>
            </Stack>
            <Typography
              component="span"
              color="text.secondary"
              sx={{ display: { xs: 'none', md: 'inline' }, fontSize: 12 }}
            >
              {t('classic.portalMetadata', { currentDate })}
            </Typography>
            <Typography
              component="span"
              color="text.secondary"
              sx={{ display: { xs: 'inline', md: 'none' }, fontSize: 11 }}
            >
              {t('classic.portalTimestamp')}
            </Typography>
          </Stack>

          <Stack
            data-classic-mode-selector
            role="group"
            aria-label={t('classic.modeAriaLabel')}
            direction="row"
            sx={{
              flex: '0 0 auto',
              p: 0.375,
              bgcolor: 'action.hover',
              borderRadius: foundationTokens.home.radius.control,
              '& .MuiButton-root': {
                minWidth: 0,
                minHeight: { xs: 36, md: 38 },
                px: { xs: 1, md: 1.5 },
                fontSize: { xs: 11, md: 12 },
              },
            }}
          >
            <ActionButton
              aria-current="page"
              intent="quiet"
              startIcon={<Building2 size={15} aria-hidden="true" />}
              sx={{ bgcolor: 'background.paper', color: 'primary.main', boxShadow: 1 }}
            >
              <Box
                component="span"
                sx={{ display: { xs: 'none', sm: 'inline' } }}
              >
                {t('classic.classicModePrefix')}
              </Box>
              {t('classic.portalBadge')}
            </ActionButton>
            <ActionButton
              intent="quiet"
              startIcon={<Sparkles size={15} aria-hidden="true" />}
              onClick={onOpenStudio ?? onStartEditing}
              disabled={personalizationBusy || (!onOpenStudio && !onStartEditing)}
              sx={{ display: { xs: 'none', md: 'inline-flex' } }}
            >
              {t('classic.flowModeLabel')}
            </ActionButton>
          </Stack>
        </Stack>

        <Box
          role={communicationState === 'widget-error' ? 'alert' : 'status'}
          aria-busy={
            communicationState === 'initial-loading' || communicationState === 'background-refresh'
              ? 'true'
              : undefined
          }
          data-classic-required-notice={
            communicationUnverified ? communicationState : requiredStory ? 'required' : 'complete'
          }
          sx={(theme) => ({
            mt: { xs: 1, md: 1.5 },
            minHeight: { xs: 42, md: 48 },
            px: { xs: 1.25, md: 2 },
            py: 0.75,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            border: 1,
            borderColor: communicationUnverified
              ? communicationState === 'widget-error'
                ? 'error.light'
                : 'warning.light'
              : requiredStory
                ? 'error.light'
                : 'primary.light',
            borderRadius: foundationTokens.home.radius.control,
            bgcolor: communicationUnverified
              ? alpha(
                  communicationState === 'widget-error'
                    ? theme.palette.error.main
                    : theme.palette.warning.main,
                  noticeOpacity
                )
              : requiredStory
                ? alpha(theme.palette.error.main, noticeOpacity)
                : alpha(theme.palette.primary.main, 0.06),
          })}
        >
          {communicationUnverified ? (
            <CommunicationStateIcon
              size={18}
              color={
                communicationState === 'widget-error'
                  ? foundationTokens.color.status.error
                  : foundationTokens.color.status.warning
              }
              aria-hidden="true"
            />
          ) : requiredStory ? (
            <AlertTriangle
              size={18}
              color={foundationTokens.color.status.error}
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2
              size={18}
              color={foundationTokens.color.product.primary}
              aria-hidden="true"
            />
          )}
          <Box minWidth={0} sx={{ flex: 1 }}>
            <Typography
              component="span"
              sx={{
                fontSize: { xs: 12, md: 13 },
                fontWeight: foundationTokens.home.typography.weightEmphasis,
                color: 'text.primary',
              }}
            >
              {communicationUnverified
                ? t(`states.${communicationState}.title`)
                : requiredStory
                  ? t('classic.notice.required')
                  : t('classic.notice.complete')}
            </Typography>
            <Typography
              component="span"
              color="text.secondary"
              sx={{ ml: { xs: 0.75, md: 2 }, fontSize: 12, display: { xs: 'none', sm: 'inline' } }}
            >
              {communicationUnverified
                ? t(`states.${communicationState}.description`)
                : (requiredStory?.title ?? t('classic.notice.completeDescription'))}
            </Typography>
          </Box>
          {requiredStory && communicationState !== 'forbidden' && (
            <ActionButton
              intent="primary"
              size="small"
              onClick={onOpenOrganizationUpdates}
              sx={{ minHeight: 36, flex: '0 0 auto', px: { xs: 1.25, md: 2 } }}
            >
              {t('classic.notice.action')}
            </ActionButton>
          )}
        </Box>

        {featuredStory ? (
          <Box
            data-classic-featured-news
            component="article"
            sx={{
              mt: { xs: 0.75, md: 2 },
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: 'minmax(320px, 5fr) minmax(0, 7fr)',
              },
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: foundationTokens.home.radius.control,
              overflow: 'hidden',
              boxShadow: foundationTokens.home.shadow.quietCard,
            }}
          >
            <Box sx={{ position: 'relative', minWidth: 0, minHeight: { xs: 112, md: 230 } }}>
              <ClassicFeaturedImage story={featuredStory} fallback={backgroundUrl} />
              <Chip
                size="small"
                color="primary"
                label={t('classic.featuredLabel')}
                sx={{
                  position: 'absolute',
                  top: { xs: 8, md: 12 },
                  left: { xs: 8, md: 12 },
                  height: 26,
                  fontSize: 11,
                }}
              />
            </Box>
            <Stack sx={{ minWidth: 0, p: { xs: 1.25, md: 2.5 } }} gap={{ xs: 0.5, md: 0.75 }}>
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Typography
                  component="span"
                  sx={{
                    px: 1,
                    py: 0.25,
                    bgcolor: 'action.hover',
                    color: 'primary.main',
                    fontSize: 11,
                  }}
                >
                  {t('classic.featuredCategory')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: { md: 'auto' } }}>
                  {featuredStory.publisherName}
                </Typography>
                {featuredStory.publishedAt && (
                  <Stack direction="row" alignItems="center" gap={0.5} color="text.secondary">
                    <CalendarDays size={13} aria-hidden="true" />
                    <Typography variant="caption">
                      {formatDate(featuredStory.publishedAt, { dateStyle: 'medium' })}
                    </Typography>
                  </Stack>
                )}
              </Stack>
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: 16, md: 22 },
                  lineHeight: foundationTokens.home.typography.cardLineHeight,
                  fontWeight: foundationTokens.home.typography.weightBold,
                  overflowWrap: 'anywhere',
                }}
              >
                {featuredStory.title}
              </Typography>
              <Typography
                color="text.secondary"
                sx={{
                  fontSize: { xs: 13, md: 14 },
                  lineHeight: 1.55,
                  overflowWrap: 'anywhere',
                  display: '-webkit-box',
                  WebkitLineClamp: { xs: 2, md: 2 },
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {featuredStory.summary}
              </Typography>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={{
                  mt: 'auto',
                  pt: { xs: 0.5, md: 1.25 },
                  borderTop: { md: 1 },
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: { xs: 'none', sm: 'inline' } }}
                >
                  {t('classic.roadmapMeta')}
                </Typography>
                <ActionButton
                  data-classic-primary-action
                  intent="primary"
                  size="small"
                  startIcon={<Newspaper size={16} aria-hidden="true" />}
                  onClick={onOpenOrganizationUpdates}
                  sx={{ minHeight: 44, ml: 'auto' }}
                >
                  {t('classic.openFeaturedStory')}
                </ActionButton>
              </Stack>
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
            sx={{
              mt: { xs: 1, md: 2.5 },
              p: { xs: 1, md: 2 },
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: foundationTokens.home.radius.control,
              boxShadow: foundationTokens.home.shadow.quietCard,
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
              sx={{ mb: { xs: 0.75, md: 1.25 } }}
            >
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography
                  component="h2"
                  sx={{
                    fontSize: { xs: 16, md: 18 },
                    fontWeight: foundationTokens.home.typography.weightEmphasis,
                  }}
                >
                  {t('page.appsTitle')}
                </Typography>
                <Chip
                  size="small"
                  label={t('launchpad.assignedCount', { count: assignedAppCount })}
                  sx={{ height: 23, fontSize: 11 }}
                />
              </Stack>
              <Stack direction="row" alignItems="center" gap={0.25}>
                {onStartEditing && (
                  <ActionButton
                    data-home-edit-trigger
                    data-home-action-policy="PERSONAL"
                    intent="quiet"
                    aria-label={t('launchpad.editHome')}
                    onClick={onStartEditing}
                    disabled={personalizationBusy}
                    sx={{
                      minWidth: 40,
                      minHeight: 40,
                      px: 0.75,
                      display: { xs: 'none', md: 'inline-flex' },
                    }}
                  >
                    <Settings2 size={17} aria-hidden="true" />
                  </ActionButton>
                )}
                {onOpenStudio && (
                  <ActionButton
                    data-home-studio-trigger
                    data-home-action-policy="PERSONAL"
                    intent="quiet"
                    aria-label={t('classic.openStudio')}
                    onClick={onOpenStudio}
                    disabled={personalizationBusy}
                    sx={{
                      minWidth: 40,
                      minHeight: 40,
                      px: 0.75,
                      display: { xs: 'none', md: 'inline-flex' },
                    }}
                  >
                    <PanelsTopLeft size={17} aria-hidden="true" />
                  </ActionButton>
                )}
                <ActionButton
                  intent="quiet"
                  startIcon={<Grid2X2 size={16} aria-hidden="true" />}
                  onClick={onBrowseAll}
                  sx={{ minHeight: 40, px: 1 }}
                >
                  {t('launchpad.allApps')}
                </ActionButton>
              </Stack>
            </Stack>
            {workspaceTools}
          </Box>
        )}
      </Box>
    </Box>
  );
}
