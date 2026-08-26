import { useTranslation } from 'react-i18next';
import { BellRing, LayoutGrid, LockKeyhole } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { AppLaunchpad } from '../app-launchpad';

import type {
  HomeAppDefinition,
  HomeAppGroup,
  LaunchpadLayout,
} from '../../../components/workspace-composer/app-launchpad-model';
import type { HomeBackgroundPosition, HomePresentation } from '@dwp-frontend/shared-utils';

type MyAppDockProps = {
  apps: readonly HomeAppDefinition[];
  groups: readonly HomeAppGroup[];
  layout: LaunchpadLayout;
  editing: boolean;
  customizationEnabled: boolean;
  busy: boolean;
  compact?: boolean;
  priorityCompact?: boolean;
  presentation: HomePresentation;
  backgroundPosition: HomeBackgroundPosition;
  onBrowseAll: () => void;
  onLaunch: (app: HomeAppDefinition) => void;
  onManage?: (app: HomeAppDefinition) => void;
  onStartEditing?: () => void;
  onLayoutChange: (layout: LaunchpadLayout) => void;
};

export function MyAppDock({
  apps,
  groups,
  layout,
  editing,
  customizationEnabled,
  busy,
  compact = false,
  priorityCompact = false,
  presentation,
  backgroundPosition,
  onBrowseAll,
  onLaunch,
  onManage,
  onStartEditing,
  onLayoutChange,
}: MyAppDockProps) {
  const { t } = useTranslation('home');
  const narrowViewport = useMediaQuery('(max-width:599.95px)', { noSsr: true });
  const tabletViewport = useMediaQuery('(min-width:900px) and (max-width:1199.95px)', {
    noSsr: true,
  });
  const expressiveViewport = useMediaQuery('(min-width:1200px)', { noSsr: true });
  const wideViewport = useMediaQuery('(min-width:1600px)', { noSsr: true });
  const itemLimit =
    compact || narrowViewport
      ? 4
      : tabletViewport
        ? 6
        : presentation === 'expressive'
          ? wideViewport
            ? 12
            : expressiveViewport
              ? 10
              : 8
          : 8;
  const availableItemIds = new Set([...apps.map((app) => app.id), ...Object.keys(layout.folders)]);
  const orderedItemIds = groups
    .flatMap((group) => layout.groups[group.id] ?? [])
    .filter((itemId) => availableItemIds.has(itemId));
  const visibleItemIds = orderedItemIds.slice(0, itemLimit);
  const visibleItemCount = visibleItemIds.length;
  const hiddenItemCount = Math.max(0, orderedItemIds.length - visibleItemCount);
  const preferredDockWidth = Math.min(1120, Math.max(540, 240 + visibleItemCount * 78));
  const visibleAppIds = new Set(
    visibleItemIds.flatMap((itemId) => layout.folders[itemId]?.appIds ?? [itemId])
  );
  const hiddenNotificationSummary = apps
    .filter((app) => !visibleAppIds.has(app.id))
    .reduce(
      (summary, app) => ({
        total: summary.total + (app.badgeMetadata?.totalUnread ?? 0),
        actionable: summary.actionable + (app.badgeMetadata?.actionableUnread ?? 0),
        urgent: summary.urgent + (app.badgeMetadata?.urgentUnread ?? 0),
      }),
      { total: 0, actionable: 0, urgent: 0 }
    );
  const hiddenBadgeIntent =
    hiddenNotificationSummary.urgent > 0
      ? 'urgent'
      : hiddenNotificationSummary.actionable > 0
        ? 'actionable'
        : 'unread';
  const hiddenBadgeCount =
    hiddenBadgeIntent === 'urgent'
      ? hiddenNotificationSummary.urgent
      : hiddenBadgeIntent === 'actionable'
        ? hiddenNotificationSummary.actionable
        : hiddenNotificationSummary.total;
  return (
    <Box
      component="section"
      aria-labelledby="flow-app-dock-heading"
      data-flow-section="app-dock"
      data-flow-dock-shell
      data-flow-dock-item-limit={itemLimit}
      data-flow-dock-visible-count={visibleItemCount}
      data-flow-dock-hidden-count={hiddenItemCount}
      sx={(theme) => ({
        minWidth: 0,
        width: editing ? 1 : { xs: 1, md: `min(100%, ${preferredDockWidth}px)` },
        alignSelf: editing
          ? 'stretch'
          : backgroundPosition === 'LEFT'
            ? { xs: 'stretch', md: 'flex-end' }
            : backgroundPosition === 'CENTER'
              ? { xs: 'stretch', md: 'center' }
              : { xs: 'stretch', md: 'flex-start' },
        minHeight: editing ? 0 : { xs: 136, sm: 132 },
        color: '#F8FAFC',
        px: compact ? 1 : { xs: 1.25, sm: 1.5, md: 1.75 },
        pt: compact ? 0.75 : { xs: 1, md: 1.5 },
        pb: compact ? 0.75 : { xs: 1, md: 1.25 },
        containerName: 'flow-dock',
        containerType: 'inline-size',
        borderRadius: compact ? '14px' : '16px',
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(5,16,35,0.86)' : 'rgba(8,24,52,0.78)',
        border: 1,
        borderColor: editing ? '#93C5FD' : 'rgba(255,255,255,0.22)',
        backdropFilter: 'blur(24px) saturate(130%)',
        WebkitBackdropFilter: 'blur(24px) saturate(130%)',
        boxShadow:
          theme.palette.mode === 'dark'
            ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 30px rgba(0,0,0,0.42)'
            : 'inset 0 1px 0 rgba(255,255,255,0.10), 0 12px 30px rgba(1,10,28,0.30)',
        '& [data-flow-dock-meta] .MuiTypography-root': { color: '#F8FAFC' },
        '& [data-flow-app-dock-list]': { color: '#F8FAFC' },
        ...(priorityCompact
          ? {
              py: 1,
              '& [data-flow-dock-launch]': {
                minHeight: '72px !important',
                py: '0 !important',
                gap: '2px !important',
              },
            }
          : {}),
        '@media (forced-colors: active)': {
          bgcolor: 'Canvas',
          borderColor: 'CanvasText',
          boxShadow: 'none',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        },
        '@media (prefers-reduced-transparency: reduce)': {
          bgcolor: theme.palette.mode === 'dark' ? '#071426' : '#10284D',
          boxShadow: '0 6px 18px rgba(0,0,0,0.24)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        },
      })}
    >
      <Box
        sx={{
          width: 1,
          maxWidth: 'none',
          mx: 'auto',
          minWidth: 0,
          display: 'grid',
          gridTemplateAreas: '"meta action" "apps apps"',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'center',
          columnGap: 1,
          rowGap: 0.5,
          ...(!editing && itemLimit <= 10
            ? {
                '@container flow-dock (min-width: 800px)': {
                  gridTemplateAreas: '"meta apps action"',
                  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                  columnGap: 2,
                  rowGap: 0,
                },
              }
            : {}),
        }}
      >
        <Box data-flow-dock-meta sx={{ gridArea: 'meta', minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography
              id="flow-app-dock-heading"
              component="h2"
              variant="subtitle2"
              fontWeight={750}
            >
              {t('flow.dock.title')}
            </Typography>
            {editing && (
              <Chip
                size="small"
                label={t('flow.dock.editingCount', { count: orderedItemIds.length })}
                aria-label={t('flow.dock.visibleCount', {
                  visible: orderedItemIds.length,
                  total: apps.length,
                })}
                sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
              />
            )}
            {editing && (
              <Chip
                size="small"
                variant="outlined"
                icon={<LockKeyhole size={13} aria-hidden="true" />}
                label={t('flow.dock.positionLocked')}
                sx={{ maxWidth: 1 }}
              />
            )}
          </Stack>
          <Typography
            data-flow-dock-description
            variant="body2"
            sx={{
              mt: 0.25,
              maxWidth: 720,
              color: 'rgba(248,250,252,0.72)',
              lineHeight: 1.35,
              wordBreak: 'keep-all',
              overflowWrap: 'break-word',
              display: editing && !narrowViewport && !compact ? '-webkit-box' : 'none',
              overflow: 'hidden',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {t('flow.dock.description')}
          </Typography>
        </Box>
        <Box
          sx={{
            gridArea: 'apps',
            minWidth: 0,
            ...(!editing && itemLimit <= 10
              ? {
                  '@container flow-dock (min-width: 800px)': {
                    display: 'flex',
                    alignItems: 'center',
                  },
                }
              : {}),
          }}
        >
          {visibleItemCount > 0 || editing ? (
            <AppLaunchpad
              apps={apps}
              groups={groups}
              layout={layout}
              editing={editing}
              reorderable={customizationEnabled}
              customizationBusy={busy}
              title={t('flow.dock.title')}
              variant="flow"
              flowItemLimit={itemLimit}
              onLayoutChange={onLayoutChange}
              onLaunch={onLaunch}
              onManage={onManage}
              onStartEditing={onStartEditing}
            />
          ) : (
            <Typography
              variant="body2"
              sx={{ minHeight: 44, py: 1.25, color: 'rgba(248,250,252,0.72)' }}
            >
              {t('flow.dock.empty')}
            </Typography>
          )}
        </Box>
        <ActionButton
          data-flow-dock-action
          intent="quiet"
          size="small"
          startIcon={<LayoutGrid size={16} aria-hidden="true" />}
          onClick={onBrowseAll}
          aria-label={
            hiddenNotificationSummary.total > 0
              ? t('flow.dock.allAppsNotifications', {
                  ...hiddenNotificationSummary,
                  hidden: hiddenItemCount,
                })
              : hiddenItemCount > 0
                ? t('flow.dock.allAppsWithCount', { count: hiddenItemCount })
                : t('launchpad.allApps')
          }
          sx={{
            gridArea: 'action',
            minHeight: 44,
            justifySelf: 'end',
            whiteSpace: 'nowrap',
            color: '#F8FAFC',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
            '&:active': { bgcolor: 'rgba(255,255,255,0.14)' },
            '&:focus-visible': { outline: '2px solid #93C5FD', outlineOffset: 2 },
          }}
        >
          {visibleItemCount === 0 ? t('flow.dock.emptyAction') : t('launchpad.allApps')}
          {hiddenItemCount > 0 && (
            <Box
              component="span"
              aria-hidden="true"
              sx={{
                minWidth: 24,
                height: 22,
                px: 0.5,
                display: 'inline-grid',
                placeItems: 'center',
                borderRadius: 999,
                color: '#E2E8F0',
                bgcolor: 'rgba(255,255,255,0.12)',
                fontWeight: 750,
                fontVariantNumeric: 'tabular-nums',
                fontSize: 10.5,
              }}
            >
              {t('flow.dock.moreApps', { count: hiddenItemCount })}
            </Box>
          )}
          {hiddenNotificationSummary.total > 0 && (
            <Box
              component="span"
              aria-hidden="true"
              data-hidden-notification-intent={hiddenBadgeIntent}
              sx={{
                minWidth: 28,
                height: 22,
                px: 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.25,
                borderRadius: 999,
                bgcolor:
                  hiddenBadgeIntent === 'urgent'
                    ? 'error.main'
                    : hiddenBadgeIntent === 'actionable'
                      ? 'warning.main'
                      : 'primary.main',
                color:
                  hiddenBadgeIntent === 'urgent'
                    ? 'error.contrastText'
                    : hiddenBadgeIntent === 'actionable'
                      ? 'warning.contrastText'
                      : 'primary.contrastText',
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              <BellRing size={11} strokeWidth={2.4} aria-hidden="true" />
              {Math.min(99, hiddenBadgeCount)}
              {hiddenBadgeCount > 99 ? '+' : ''}
            </Box>
          )}
        </ActionButton>
      </Box>
    </Box>
  );
}
