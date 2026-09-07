import { useTranslation } from 'react-i18next';
import { BellRing, LayoutGrid, LockKeyhole } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { HOME_LAUNCHPAD_GROUP_ITEM_LIMIT } from '../../../components/workspace-composer/home-launchpad-layout-contract';
import { AppLaunchpad } from '../app-launchpad';
import { HOME_MOTION_TOKENS } from '../../../components/home-surface-tokens';
import {
  resolveFlowAppDockModel,
  summarizeHiddenFlowAppNotifications,
} from './flow-app-dock-model';

import type {
  HomeAppDefinition,
  HomeAppGroup,
  LaunchpadLayout,
} from '../../../components/workspace-composer/app-launchpad-model';
type MyAppDockProps = {
  apps: readonly HomeAppDefinition[];
  groups: readonly HomeAppGroup[];
  layout: LaunchpadLayout;
  editing: boolean;
  customizationEnabled: boolean;
  busy: boolean;
  compact?: boolean;
  priorityCompact?: boolean;
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
  onBrowseAll,
  onLaunch,
  onManage,
  onStartEditing,
  onLayoutChange,
}: MyAppDockProps) {
  const { t } = useTranslation('home');
  const narrowViewport = useMediaQuery('(max-width:599.95px)', { noSsr: true });
  const itemLimitPerGroup = compact || narrowViewport ? undefined : HOME_LAUNCHPAD_GROUP_ITEM_LIMIT;
  const itemLimit = itemLimitPerGroup ? groups.length * itemLimitPerGroup : 4;
  const dockModel = resolveFlowAppDockModel({
    apps,
    groups,
    layout,
    itemLimit,
    itemLimitPerGroup,
  });
  const visibleItemCount = dockModel.visibleItemCount;
  const hiddenItemCount = dockModel.hiddenItemCount;
  const visibleAppIds = new Set(dockModel.visibleAppIds);
  const hiddenAppCount = dockModel.hiddenAppCount;
  const hiddenNotificationSummary = summarizeHiddenFlowAppNotifications(apps, visibleAppIds);
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
      data-flow-dock-group-item-limit={itemLimitPerGroup ?? 0}
      data-flow-dock-visible-count={visibleItemCount}
      data-flow-dock-hidden-count={hiddenAppCount}
      data-flow-dock-hidden-tile-count={hiddenItemCount}
      sx={(theme) => ({
        '--flow-dock-text': theme.palette.text.primary,
        '--flow-dock-muted': theme.palette.text.secondary,
        '--flow-dock-border': theme.palette.divider,
        '--flow-dock-hover': theme.palette.action.hover,
        '--flow-dock-active': theme.palette.action.selected,
        '--flow-dock-focus': theme.palette.primary.main,
        minWidth: 0,
        width: 1,
        alignSelf: 'stretch',
        minHeight: editing ? 0 : { xs: 136, sm: 132 },
        color: 'text.primary',
        px: compact ? 1 : { xs: 1.25, sm: 1.5, md: 1.75 },
        pt: compact ? 0.75 : { xs: 1, md: 1.25 },
        pb: compact ? 0.75 : { xs: 1, md: 1.25 },
        containerName: 'flow-dock',
        containerType: 'inline-size',
        borderRadius: '12px',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: editing ? 'primary.main' : 'divider',
        boxShadow: '0 1px 3px rgba(15,23,42,0.035)',
        '& [data-flow-dock-meta] .MuiTypography-root': { color: 'text.primary' },
        '& [data-flow-app-dock-list]': { color: 'text.primary' },
        '& [data-launchpad-item-label]': { color: 'text.primary' },
        '& [data-flow-dock-launch]': {
          transition: `transform ${HOME_MOTION_TOKENS.quick} ${HOME_MOTION_TOKENS.easing}, background-color ${HOME_MOTION_TOKENS.quick} ${HOME_MOTION_TOKENS.easing}`,
        },
        '& [data-flow-dock-launch]:hover': {
          transform: HOME_MOTION_TOKENS.lift,
        },
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
        '@media (prefers-reduced-motion: reduce)': {
          '& [data-flow-dock-launch], & [data-flow-dock-launch]:hover': {
            transition: 'none',
            transform: 'none',
          },
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
          rowGap: 0,
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
                label={t('flow.dock.editingCount', { count: dockModel.totalValidAppCount })}
                aria-label={t('flow.dock.visibleCount', {
                  visible: dockModel.totalValidAppCount,
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
              color: 'text.secondary',
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
              flowItemLimitPerGroup={itemLimitPerGroup}
              onLayoutChange={onLayoutChange}
              onLaunch={onLaunch}
              onManage={onManage}
              onStartEditing={onStartEditing}
            />
          ) : (
            <Typography variant="body2" sx={{ minHeight: 44, py: 1.25, color: 'text.secondary' }}>
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
                  hidden: hiddenAppCount,
                })
              : hiddenAppCount > 0
                ? t('flow.dock.allAppsWithCount', { count: hiddenAppCount })
                : t('launchpad.allApps')
          }
          sx={{
            gridArea: 'action',
            minHeight: 44,
            justifySelf: 'end',
            whiteSpace: 'nowrap',
            color: 'primary.main',
            '&:hover': { bgcolor: 'action.hover' },
            '&:active': { bgcolor: 'action.selected' },
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: 2,
            },
            '[data-flow-large-text="true"] &': {
              maxWidth: '100%',
              flexWrap: 'wrap',
              whiteSpace: 'normal',
              lineHeight: 1.2,
            },
          }}
        >
          {visibleItemCount === 0 ? t('flow.dock.emptyAction') : t('launchpad.allApps')}
          {hiddenAppCount > 0 && (
            <Box
              component="span"
              aria-hidden="true"
              data-flow-dock-hidden-app-count
              sx={{
                minWidth: '1.5rem',
                minHeight: '1.375rem',
                height: 'auto',
                px: '0.4em',
                py: '0.125em',
                display: 'inline-grid',
                placeItems: 'center',
                borderRadius: 999,
                color: 'text.secondary',
                bgcolor: 'action.hover',
                fontWeight: 750,
                fontVariantNumeric: 'tabular-nums',
                fontSize: '0.65625rem',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              {t('flow.dock.moreApps', { count: hiddenAppCount })}
            </Box>
          )}
          {hiddenNotificationSummary.total > 0 && (
            <Box
              component="span"
              aria-hidden="true"
              data-hidden-notification-intent={hiddenBadgeIntent}
              sx={{
                minWidth: '1.75rem',
                minHeight: '1.375rem',
                height: 'auto',
                px: '0.4em',
                py: '0.125em',
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
                fontSize: '0.625rem',
                lineHeight: 1.2,
                fontWeight: 800,
                whiteSpace: 'nowrap',
              }}
            >
              <BellRing size="1em" strokeWidth={2.4} aria-hidden="true" />
              {Math.min(99, hiddenBadgeCount)}
              {hiddenBadgeCount > 99 ? '+' : ''}
            </Box>
          )}
        </ActionButton>
      </Box>
    </Box>
  );
}
