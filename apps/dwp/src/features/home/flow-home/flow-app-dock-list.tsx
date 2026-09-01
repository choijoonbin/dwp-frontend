import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder } from 'lucide-react';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import {
  HOME_LAUNCHPAD_FIVE_COLUMN_DOCK_MIN_WIDTH,
  HOME_LAUNCHPAD_FOUR_COLUMN_DOCK_MIN_WIDTH,
  HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH,
  HOME_LAUNCHPAD_VISIBLE_COLUMNS,
} from '../../../components/workspace-composer/home-launchpad-layout-contract';
import { AppGlyph } from '../app-glyph';
import { AppManagementAction } from '../app-management-action';
import { LAUNCHPAD_LONG_PRESS_DELAY_MS } from '../app-launchpad-long-press';
import { LAUNCHPAD_TILE_HEIGHT_CSS, LAUNCHPAD_TILE_WIDTH } from '../app-launchpad-styles';
import { preserveFlowAppDockGroupSurfaces, resolveFlowAppDockModel } from './flow-app-dock-model';

import type {
  HomeAppDefinition,
  HomeAppGroup,
  LaunchpadLayout,
} from '../../../components/workspace-composer/app-launchpad-model';

type FlowAppDockListProps = {
  apps: readonly HomeAppDefinition[];
  groups: readonly HomeAppGroup[];
  layout: LaunchpadLayout;
  itemLimit?: number;
  itemLimitPerGroup?: number;
  onLaunch: (app: HomeAppDefinition) => void;
  onManage?: (app: HomeAppDefinition) => void;
  onOpenFolder: (folderId: string) => void;
  onStartEditing?: () => void;
  onOpenContextMenu?: (itemId: string, anchor: Readonly<{ top: number; left: number }>) => void;
};

type PressState = {
  timer: number;
  pointerId: number;
  startX: number;
  startY: number;
};

export function FlowAppDockList({
  apps,
  groups,
  layout,
  itemLimit = 8,
  itemLimitPerGroup,
  onLaunch,
  onManage,
  onOpenFolder,
  onStartEditing,
  onOpenContextMenu,
}: FlowAppDockListProps) {
  const { t } = useTranslation('home');
  const appById = useMemo(() => new Map(apps.map((app) => [app.id, app])), [apps]);
  const press = useRef<PressState | null>(null);
  const suppressClickUntil = useRef(0);
  const itemGroups = useMemo(() => {
    const selectedGroups = resolveFlowAppDockModel({
      apps,
      groups,
      layout,
      itemLimit,
      itemLimitPerGroup,
    }).groups;
    return preserveFlowAppDockGroupSurfaces(groups, selectedGroups);
  }, [apps, groups, itemLimit, itemLimitPerGroup, layout]);

  const cancelLongPress = () => {
    if (!press.current) return;
    window.clearTimeout(press.current.timer);
    press.current = null;
  };

  useEffect(
    () => () => {
      if (press.current) window.clearTimeout(press.current.timer);
    },
    []
  );

  const pointerHandlers = {
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || !onStartEditing) return;
      cancelLongPress();
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      event.currentTarget.setPointerCapture(pointerId);
      const timer = window.setTimeout(() => {
        if (press.current?.pointerId !== pointerId) return;
        suppressClickUntil.current = Date.now() + 500;
        press.current = null;
        onStartEditing();
      }, LAUNCHPAD_LONG_PRESS_DELAY_MS);
      press.current = { timer, pointerId, startX, startY };
    },
    onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => {
      const current = press.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (
        Math.abs(event.clientX - current.startX) > 10 ||
        Math.abs(event.clientY - current.startY) > 10
      ) {
        cancelLongPress();
      }
    },
    onPointerLeave: cancelLongPress,
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      cancelLongPress();
    },
    onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      cancelLongPress();
    },
  };

  return (
    <Box
      role="group"
      aria-label={t('flow.dock.listLabel')}
      data-flow-app-dock-list
      sx={{
        p: 0,
        m: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        justifyContent: 'stretch',
        columnGap: 0.75,
        rowGap: 0.5,
        overflow: 'visible',
        [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH}px)`]: {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 1.25,
          gridAutoRows: '1fr',
        },
        [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_FOUR_COLUMN_DOCK_MIN_WIDTH}px)`]: {
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        },
      }}
    >
      {itemGroups.map((group) => (
        <Box
          component="section"
          key={group.id}
          aria-labelledby={`flow-dock-group-${group.id}`}
          data-flow-dock-group={group.id}
          sx={{
            display: 'contents',
            [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH}px)`]: {
              display: 'flex',
              flexDirection: 'column',
              gap: 0.75,
              minWidth: 0,
              height: '100%',
              boxSizing: 'border-box',
              px: 1.25,
              py: 1,
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '12px',
              bgcolor: 'rgba(255,255,255,0.035)',
              backgroundImage:
                'linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.012) 62%, rgba(78,165,255,0.035))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
              '&:focus-within': {
                borderColor: 'rgba(147,197,253,0.72)',
                bgcolor: 'rgba(78,165,255,0.07)',
              },
            },
            [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_FOUR_COLUMN_DOCK_MIN_WIDTH}px)`]: {
              px: 1.5,
              py: 1.25,
            },
            '@media (prefers-reduced-transparency: reduce)': {
              bgcolor: '#10284D',
              backgroundImage: 'none',
              boxShadow: 'none',
            },
            '@media (forced-colors: active)': {
              borderColor: 'CanvasText',
              bgcolor: 'Canvas',
              backgroundImage: 'none',
              boxShadow: 'none',
            },
          }}
        >
          <Typography
            id={`flow-dock-group-${group.id}`}
            data-flow-dock-group-label
            title={group.name}
            component="h3"
            variant="caption"
            fontWeight={750}
            sx={{
              display: 'none',
              minHeight: 18,
              letterSpacing: '0.01em',
              color: 'rgba(248,250,252,0.72)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH}px)`]: {
                display: 'block',
              },
            }}
          >
            {group.name}
          </Typography>
          <Typography
            component="p"
            data-flow-dock-group-description
            variant="caption"
            sx={{
              display: 'none',
              minHeight: '1.25em',
              color: 'rgba(226,232,240,0.62)',
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH}px)`]: {
                display: 'block',
              },
              '@media (forced-colors: active)': { color: 'CanvasText' },
            }}
          >
            {group.description}
          </Typography>
          <Box
            component="ul"
            sx={{
              display: 'contents',
              p: 0,
              pt: 1,
              m: 0,
              listStyle: 'none',
              [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH}px)`]: {
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, ${LAUNCHPAD_TILE_WIDTH}px)`,
                alignItems: 'start',
                justifyContent: 'start',
                columnGap: 0.75,
                rowGap: 0.75,
              },
              [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_FIVE_COLUMN_DOCK_MIN_WIDTH}px)`]:
                {
                  gridTemplateColumns: `repeat(${HOME_LAUNCHPAD_VISIBLE_COLUMNS}, ${LAUNCHPAD_TILE_WIDTH}px)`,
                },
            }}
          >
            {group.itemIds.map((itemId) => {
              const folder = layout.folders[itemId];
              const app = appById.get(itemId);
              if (!folder && !app) return null;
              const label = folder?.name ?? app!.shortName;
              const folderApps = folder
                ? folder.appIds.map((appId) => appById.get(appId)).filter(Boolean)
                : [];
              const folderTotal = folderApps.reduce(
                (total, folderApp) => total + (folderApp?.badgeMetadata?.totalUnread ?? 0),
                0
              );
              const folderActionable = folderApps.reduce(
                (total, folderApp) => total + (folderApp?.badgeMetadata?.actionableUnread ?? 0),
                0
              );
              const folderUrgent = folderApps.reduce(
                (total, folderApp) => total + (folderApp?.badgeMetadata?.urgentUnread ?? 0),
                0
              );
              const folderBadge =
                folderTotal > 99 ? '99+' : folderTotal > 0 ? String(folderTotal) : null;
              const badgeIntent = app?.badgeMetadata?.intent
                ? app.badgeMetadata.intent
                : folderUrgent > 0
                  ? 'urgent'
                  : folderActionable > 0
                    ? 'actionable'
                    : 'unread';
              const itemBadge = app?.badgeMetadata
                ? app.badgeMetadata.urgentUnread > 0
                  ? String(Math.min(99, app.badgeMetadata.urgentUnread)) +
                    (app.badgeMetadata.urgentUnread > 99 ? '+' : '')
                  : app.badgeMetadata.actionableUnread > 0
                    ? String(Math.min(99, app.badgeMetadata.actionableUnread)) +
                      (app.badgeMetadata.actionableUnread > 99 ? '+' : '')
                    : app.badge
                : folderUrgent > 0
                  ? String(Math.min(99, folderUrgent)) + (folderUrgent > 99 ? '+' : '')
                  : folderActionable > 0
                    ? String(Math.min(99, folderActionable)) + (folderActionable > 99 ? '+' : '')
                    : folderBadge;
              const visibleBadge = itemBadge
                ? badgeIntent === 'urgent'
                  ? `!${itemBadge}`
                  : badgeIntent === 'actionable'
                    ? `•${itemBadge}`
                    : itemBadge
                : null;
              const badgeAriaLabel = app?.badgeMetadata
                ? app.badgeMetadata.urgentUnread > 0
                  ? t('flow.dock.openAppUrgent', {
                      app: app.name,
                      count: app.badgeMetadata.totalUnread,
                      urgent: app.badgeMetadata.urgentUnread,
                    })
                  : app.badgeMetadata.actionableUnread > 0
                    ? t('flow.dock.openAppActionable', {
                        app: app.name,
                        count: app.badgeMetadata.totalUnread,
                        actionable: app.badgeMetadata.actionableUnread,
                      })
                    : t('flow.dock.openApp', {
                        app: app.name,
                        count: app.badgeMetadata.totalUnread,
                      })
                : folder && folderUrgent > 0
                  ? t('flow.dock.openFolderUrgent', {
                      folder: folder.name,
                      count: folderTotal,
                      urgent: folderUrgent,
                    })
                  : folder && folderActionable > 0
                    ? t('flow.dock.openFolderActionable', {
                        folder: folder.name,
                        count: folderTotal,
                        actionable: folderActionable,
                      })
                    : folder && folderTotal > 0
                      ? t('flow.dock.openFolderUnread', {
                          folder: folder.name,
                          count: folderTotal,
                        })
                      : t('flow.dock.openApp', { app: app?.name ?? '', count: '0' });
              return (
                <Box
                  component="li"
                  key={itemId}
                  data-flow-dock-item={itemId}
                  sx={{
                    position: 'relative',
                    minWidth: 0,
                    [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH}px)`]:
                      {
                        width: LAUNCHPAD_TILE_WIDTH,
                        height: LAUNCHPAD_TILE_HEIGHT_CSS,
                      },
                  }}
                >
                  <ButtonBase
                    data-flow-dock-launch
                    {...pointerHandlers}
                    onContextMenu={(event) => {
                      if (!onOpenContextMenu) return;
                      event.preventDefault();
                      event.stopPropagation();
                      cancelLongPress();
                      onOpenContextMenu(itemId, { top: event.clientY, left: event.clientX });
                    }}
                    onKeyDown={(event) => {
                      if (
                        !onOpenContextMenu ||
                        (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey))
                      ) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      cancelLongPress();
                      const bounds = event.currentTarget.getBoundingClientRect();
                      onOpenContextMenu(itemId, { top: bounds.bottom, left: bounds.left });
                    }}
                    aria-label={
                      folder
                        ? folderTotal > 0
                          ? badgeAriaLabel
                          : t('launchpad.openFolder', { folder: folder.name })
                        : app?.managementOnly
                          ? t('launchpad.manageApp', { app: app.name })
                          : badgeAriaLabel
                    }
                    title={label}
                    onClick={() => {
                      if (Date.now() < suppressClickUntil.current) return;
                      if (folder) onOpenFolder(folder.id);
                      else onLaunch(app!);
                    }}
                    sx={{
                      width: 1,
                      minWidth: 44,
                      minHeight: 80,
                      px: 0.5,
                      py: 0.5,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: 0.5,
                      borderRadius: 2,
                      color: '#F8FAFC',
                      [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH}px)`]:
                        {
                          height: 1,
                          minHeight: 72,
                          py: 0.25,
                        },
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                      '&:active': { bgcolor: 'rgba(255,255,255,0.14)' },
                      '&:focus-visible': {
                        outline: '2px solid #93C5FD',
                        outlineOffset: 2,
                      },
                      '@media (forced-colors: active)': {
                        color: 'CanvasText',
                        '&:focus-visible': { outlineColor: 'Highlight' },
                      },
                    }}
                  >
                    <Box sx={{ position: 'relative', width: 44, height: 44 }}>
                      {folder ? (
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            display: 'grid',
                            placeItems: 'center',
                            borderRadius: 2,
                            bgcolor: 'rgba(255,255,255,0.10)',
                            color: '#BFDBFE',
                            border: '1px solid rgba(255,255,255,0.16)',
                          }}
                        >
                          <Folder size={23} strokeWidth={1.8} aria-hidden="true" />
                        </Box>
                      ) : (
                        <AppGlyph app={app!} size={44} variant="soft" />
                      )}
                      {visibleBadge && (
                        <Box
                          component="span"
                          aria-hidden="true"
                          data-badge-intent={badgeIntent}
                          sx={{
                            position: 'absolute',
                            top: -5,
                            right: -7,
                            minWidth: '1.375rem',
                            minHeight: '1.375rem',
                            height: 'auto',
                            px: '0.35em',
                            py: '0.1em',
                            display: 'grid',
                            placeItems: 'center',
                            borderRadius: 999,
                            bgcolor:
                              badgeIntent === 'urgent'
                                ? 'error.main'
                                : badgeIntent === 'actionable'
                                  ? 'warning.main'
                                  : 'primary.main',
                            color:
                              badgeIntent === 'urgent'
                                ? 'error.contrastText'
                                : badgeIntent === 'actionable'
                                  ? 'warning.contrastText'
                                  : 'primary.contrastText',
                            border: 2,
                            borderColor: '#10284D',
                            fontSize: '0.625rem',
                            lineHeight: 1.15,
                            fontWeight: 800,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {visibleBadge}
                        </Box>
                      )}
                    </Box>
                    <Typography
                      component="span"
                      data-flow-dock-item-label
                      variant="caption"
                      fontWeight={700}
                      sx={{
                        width: 1,
                        minHeight: '1.3em',
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.3,
                        wordBreak: 'keep-all',
                        overflowWrap: 'break-word',
                        fontSize: '0.71875rem',
                        [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH}px)`]:
                          {
                            minHeight: '2.6em',
                            WebkitLineClamp: 2,
                          },
                        '[data-flow-large-text="true"] &': {
                          minHeight: '2.6em',
                          WebkitLineClamp: 2,
                          overflow: 'visible',
                        },
                      }}
                    >
                      {label}
                    </Typography>
                  </ButtonBase>
                  {app?.managementRoute && onManage && (
                    <AppManagementAction app={app} variant="overlay" onManage={onManage} />
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
