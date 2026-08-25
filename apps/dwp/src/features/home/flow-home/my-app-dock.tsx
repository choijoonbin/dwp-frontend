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
import type { HomePresentation } from '@dwp-frontend/shared-utils';

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
  onBrowseAll,
  onLaunch,
  onManage,
  onStartEditing,
  onLayoutChange,
}: MyAppDockProps) {
  const { t } = useTranslation('home');
  const narrowViewport = useMediaQuery('(max-width:599.95px)', { noSsr: true });
  const expressiveViewport = useMediaQuery('(min-width:1200px)', { noSsr: true });
  const wideViewport = useMediaQuery('(min-width:1600px)', { noSsr: true });
  const itemLimit =
    compact || narrowViewport
      ? 4
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
  const preferredDockWidth = Math.min(1120, Math.max(400, 156 + visibleItemCount * 72));
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
        alignSelf: 'center',
        minHeight: 0,
        color: 'text.primary',
        px: compact ? 1 : { xs: 1, sm: 1.25, md: 1.5 },
        py: compact ? 0.75 : { xs: 0.75, md: 0.75 },
        containerName: 'flow-dock',
        containerType: 'inline-size',
        borderRadius: compact ? 3 : 'calc(var(--flow-surface-radius) - 2px)',
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(17,26,38,0.94)' : 'rgba(255,255,255,0.94)',
        border: 1,
        borderColor: editing
          ? 'primary.main'
          : theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.2)'
            : 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(18px) saturate(115%)',
        WebkitBackdropFilter: 'blur(18px) saturate(115%)',
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 14px 32px rgba(0,0,0,0.28)'
            : '0 14px 32px rgba(10,30,58,0.16)',
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
          bgcolor: 'background.paper',
          boxShadow: 'none',
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
          rowGap: 0.25,
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
            color="text.secondary"
            sx={{
              mt: 0.25,
              maxWidth: 720,
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
        <Box sx={{ gridArea: 'apps', minWidth: 0 }}>
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
            <Typography variant="body2" color="text.secondary" sx={{ minHeight: 44, py: 1.25 }}>
              {t('flow.dock.empty')}
            </Typography>
          )}
        </Box>
        <ActionButton
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
                color: 'text.secondary',
                bgcolor: 'action.selected',
                fontWeight: 750,
                fontVariantNumeric: 'tabular-nums',
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
