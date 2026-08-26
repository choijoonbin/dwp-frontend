import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder } from 'lucide-react';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { AppGlyph } from '../app-glyph';
import { AppManagementAction } from '../app-management-action';
import { LAUNCHPAD_LONG_PRESS_DELAY_MS } from '../app-launchpad-long-press';

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
    let remaining = itemLimit;
    return groups
      .map((group) => {
        const itemIds = (layout.groups[group.id] ?? [])
          .filter((itemId) => Boolean(layout.folders[itemId] || appById.has(itemId)))
          .slice(0, remaining);
        remaining = Math.max(0, remaining - itemIds.length);
        return { ...group, itemIds };
      })
      .filter((group) => group.itemIds.length > 0);
  }, [appById, groups, itemLimit, layout.folders, layout.groups]);

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
        '@container flow-dock (min-width: 640px)': {
          display: 'flex',
          alignItems: 'stretch',
          gap: 2,
        },
      }}
    >
      {itemGroups.map((group, groupIndex) => (
        <Box
          component="section"
          key={group.id}
          aria-labelledby={`flow-dock-group-${group.id}`}
          data-flow-dock-group={group.id}
          sx={{
            display: 'contents',
            '@container flow-dock (min-width: 640px)': {
              display: 'flex',
              flexDirection: 'column',
              minWidth: 104,
              pl: groupIndex === 0 ? 0 : 2,
              borderInlineStart: groupIndex === 0 ? 0 : 1,
              borderColor: 'rgba(255,255,255,0.14)',
            },
          }}
        >
          <Typography
            id={`flow-dock-group-${group.id}`}
            title={group.name}
            variant="caption"
            fontWeight={750}
            sx={{
              display: 'none',
              minHeight: 18,
              px: 0.5,
              letterSpacing: '0.01em',
              color: 'rgba(248,250,252,0.72)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              '@container flow-dock (min-width: 640px)': { display: 'block' },
            }}
          >
            {group.name}
          </Typography>
          <Box
            component="ul"
            sx={{
              display: 'contents',
              p: 0,
              m: 0,
              listStyle: 'none',
              '@container flow-dock (min-width: 640px)': {
                display: 'flex',
                alignItems: 'start',
                gap: 0.75,
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
                    '@container flow-dock (min-width: 640px)': { width: 76 },
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
                      '@container flow-dock (min-width: 640px)': {
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
                            minWidth: 22,
                            height: 22,
                            px: 0.5,
                            display: 'grid',
                            placeItems: 'center',
                            borderRadius: 11,
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
                            fontSize: 10,
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
                      variant="caption"
                      fontWeight={700}
                      sx={{
                        width: 1,
                        minHeight: 17,
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.3,
                        wordBreak: 'keep-all',
                        overflowWrap: 'break-word',
                        fontSize: 11.5,
                        '@container flow-dock (min-width: 640px)': {
                          minHeight: 17,
                          WebkitLineClamp: 1,
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
