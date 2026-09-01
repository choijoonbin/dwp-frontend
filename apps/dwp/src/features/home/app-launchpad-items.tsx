import { useTranslation } from 'react-i18next';
import { DragOverlay, useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Folder, Minus } from 'lucide-react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { AppGlyph } from './app-glyph';
import { folderTargetId } from './app-launchpad-dnd';
import { isLaunchpadContextMenuKeyboardEvent } from './app-launchpad-context-menu';
import {
  LAUNCHPAD_TILE_HEIGHT_CSS,
  LAUNCHPAD_TILE_WIDTH,
  launchpadInteractionFrameSx,
  launchpadLabelFontSize,
  launchpadTileSx,
} from './app-launchpad-styles';
import { AppManagementAction } from './app-management-action';

import type { DOMAttributes, KeyboardEventHandler, MutableRefObject, ReactNode } from 'react';
import type {
  HomeAppDefinition,
  HomeAppGroupId,
  LaunchpadFolder,
  LaunchpadLayout,
} from '../../components/workspace-composer/app-launchpad-model';
import type { LaunchpadContextMenuAnchor } from './app-launchpad-context-menu';

const launchpadRemoveControlSx = {
  position: 'absolute',
  top: -17,
  left: 'calc(50% - 52px)',
  zIndex: 4,
  width: 44,
  height: 44,
  p: 0,
  display: 'grid',
  placeItems: 'center',
  borderRadius: '50%',
  bgcolor: 'transparent',
  border: 0,
  color: 'text.primary',
  cursor: 'pointer',
  '&::before': {
    content: '""',
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: '50%',
    bgcolor: 'background.paper',
    border: 1,
    borderColor: 'divider',
    boxShadow: '0 3px 10px rgba(15,23,42,0.16)',
    transition: 'transform 120ms ease, background-color 120ms ease',
  },
  '& > svg': { position: 'relative', zIndex: 1 },
  '&:hover': { color: 'error.main' },
  '&:hover::before': {
    bgcolor: 'action.hover',
    borderColor: 'error.main',
    transform: 'scale(1.06)',
  },
  '&:active::before': { transform: 'scale(0.94)' },
  '&:focus-visible': {
    outline: '2px solid var(--dwp-focus-ring, currentColor)',
    outlineOffset: 2,
  },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
} as const;

type SortableItemShellProps = {
  itemId: string;
  groupId: HomeAppGroupId;
  activeId: string | null;
  canReceiveApp: boolean;
  dragDisabled: boolean;
  previewSlot: boolean;
  detachedOrigin?: boolean;
  label: string;
  children: (props: {
    targetRef: (element: HTMLElement | null) => void;
    targetActive: boolean;
    activatorRef: (element: HTMLElement | null) => void;
    activatorAttributes: ReturnType<typeof useSortable>['attributes'];
    activatorListeners: ReturnType<typeof useSortable>['listeners'];
  }) => ReactNode;
};

function SortableItemShell({
  itemId,
  groupId,
  activeId,
  canReceiveApp,
  dragDisabled,
  previewSlot,
  detachedOrigin = false,
  label,
  children,
}: SortableItemShellProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId, data: { groupId }, disabled: dragDisabled });
  const target = useDroppable({
    id: folderTargetId(itemId),
    disabled: dragDisabled || Boolean(activeId && (activeId === itemId || !canReceiveApp)),
    data: { groupId, itemId, type: 'folder-target' },
  });

  return (
    <Box
      component="li"
      ref={setNodeRef}
      data-launchpad-item={detachedOrigin ? undefined : itemId}
      data-launchpad-drag-origin={detachedOrigin ? itemId : undefined}
      data-launchpad-group-id={groupId}
      data-launchpad-drop-preview={previewSlot ? 'true' : undefined}
      aria-label={label}
      sx={{
        position: detachedOrigin ? 'absolute' : 'relative',
        inset: detachedOrigin ? 0 : undefined,
        width: `var(--launchpad-tile-width, ${LAUNCHPAD_TILE_WIDTH}px)`,
        minWidth: `var(--launchpad-tile-width, ${LAUNCHPAD_TILE_WIDTH}px)`,
        height: detachedOrigin ? 0 : LAUNCHPAD_TILE_HEIGHT_CSS,
        overflow: detachedOrigin ? 'hidden' : 'visible',
        pointerEvents: detachedOrigin ? 'none' : 'auto',
        opacity: detachedOrigin ? 0 : previewSlot ? 0.58 : isDragging ? 0.28 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : 1,
        '&[data-launchpad-drop-preview="true"] [data-launchpad-edit-frame]': {
          bgcolor: 'rgba(78,165,255,0.18)',
          borderColor: '#8DB8FF',
          borderStyle: 'dashed',
          boxShadow: '0 0 0 3px rgba(78,165,255,0.18), inset 0 1px 0 rgba(255,255,255,0.30)',
        },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      {children({
        targetRef: target.setNodeRef,
        targetActive: target.isOver,
        activatorRef: setActivatorNodeRef,
        activatorAttributes: attributes,
        activatorListeners: listeners,
      })}
    </Box>
  );
}

type AppTileProps = {
  app: HomeAppDefinition;
  groupId: HomeAppGroupId;
  immersive: boolean;
  editing: boolean;
  motionDelayMs: number;
  activeId: string | null;
  activeIsApp: boolean;
  dragDisabled: boolean;
  previewSlot: boolean;
  detachedOrigin?: boolean;
  suppressLaunch: MutableRefObject<boolean>;
  onLaunch: (app: HomeAppDefinition) => void;
  onManage?: (app: HomeAppDefinition) => void;
  onRemove: (appId: string) => void;
  onOpenContextMenu?: (itemId: string, anchor: LaunchpadContextMenuAnchor) => void;
};

export function AppTile({
  app,
  groupId,
  immersive,
  editing,
  motionDelayMs,
  activeId,
  activeIsApp,
  dragDisabled,
  previewSlot,
  detachedOrigin = false,
  suppressLaunch,
  onLaunch,
  onManage,
  onRemove,
  onOpenContextMenu,
}: AppTileProps) {
  const { t } = useTranslation('home');

  return (
    <SortableItemShell
      itemId={app.id}
      groupId={groupId}
      activeId={activeId}
      canReceiveApp={activeIsApp}
      dragDisabled={dragDisabled}
      previewSlot={previewSlot}
      detachedOrigin={detachedOrigin}
      label={app.name}
    >
      {({ targetRef, targetActive, activatorRef, activatorAttributes, activatorListeners }) => (
        <>
          <ButtonBase
            ref={activatorRef}
            disableRipple
            {...(editing ? activatorAttributes : {})}
            {...(activatorListeners as DOMAttributes<HTMLButtonElement>)}
            onKeyDown={(event) => {
              if (onOpenContextMenu && isLaunchpadContextMenuKeyboardEvent(event)) {
                event.preventDefault();
                event.stopPropagation();
                const bounds = event.currentTarget.getBoundingClientRect();
                onOpenContextMenu(app.id, { top: bounds.bottom, left: bounds.left });
                return;
              }
              if (editing) {
                (
                  activatorListeners?.onKeyDown as
                    KeyboardEventHandler<HTMLButtonElement> | undefined
                )?.(event);
              }
            }}
            onContextMenu={(event) => {
              if (!onOpenContextMenu) return;
              event.preventDefault();
              event.stopPropagation();
              onOpenContextMenu(app.id, { top: event.clientY, left: event.clientX });
            }}
            data-launchpad-tile
            aria-label={
              editing
                ? t('launchpad.dragApp', { app: app.name })
                : t(app.managementOnly ? 'launchpad.manageApp' : 'launchpad.openApp', {
                    app: app.name,
                  })
            }
            onClick={() => {
              if (!editing && !suppressLaunch.current) onLaunch(app);
            }}
            sx={launchpadTileSx(editing, motionDelayMs)}
          >
            <Box
              ref={targetRef}
              data-folder-target={app.id}
              data-launchpad-edit-frame
              sx={launchpadInteractionFrameSx(editing)}
            >
              <Box data-launchpad-glyph sx={{ position: 'relative', width: 52, height: 52 }}>
                <AppGlyph app={app} variant={immersive ? 'glass' : 'soft'} />
                {app.badge && !editing && (
                  <Box
                    component="span"
                    data-launchpad-badge
                    sx={{
                      position: 'absolute',
                      top: -6,
                      right: -8,
                      minWidth: 22,
                      height: 22,
                      px: 0.5,
                      boxSizing: 'border-box',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 11,
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      color: 'text.primary',
                      fontSize: 10,
                      fontWeight: 800,
                      lineHeight: 1,
                      textAlign: 'center',
                      fontVariantNumeric: 'tabular-nums',
                      boxShadow: '0 3px 8px rgba(15,23,42,0.16)',
                    }}
                  >
                    {app.badge}
                  </Box>
                )}
              </Box>
              {targetActive && (
                <Box
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    border: 2,
                    borderColor: 'primary.main',
                    borderRadius: 1,
                    bgcolor: 'action.selected',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </Box>
            <Typography
              component="span"
              data-launchpad-item-label
              variant="caption"
              fontWeight={700}
              sx={{
                width: 1,
                height: editing ? 'var(--launchpad-label-height, 24px)' : 28,
                fontSize: launchpadLabelFontSize(app.shortName),
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: editing ? 'var(--launchpad-label-line-height, 12px)' : 1.2,
                wordBreak: 'normal',
                overflowWrap: 'normal',
              }}
            >
              {app.shortName}
            </Typography>
          </ButtonBase>
          {!editing && app.managementRoute && onManage && (
            <AppManagementAction app={app} variant="overlay" onManage={onManage} />
          )}
          {editing && (
            <Tooltip title={t('launchpad.removeApp')}>
              <Box
                component="button"
                type="button"
                aria-label={t('launchpad.removeAppLabel', { app: app.name })}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(app.id);
                }}
                data-launchpad-remove-control="minus"
                sx={launchpadRemoveControlSx}
              >
                <Minus size={12} strokeWidth={3} aria-hidden="true" />
              </Box>
            </Tooltip>
          )}
        </>
      )}
    </SortableItemShell>
  );
}

type FolderTileProps = {
  folder: LaunchpadFolder;
  apps: readonly HomeAppDefinition[];
  editing: boolean;
  motionDelayMs: number;
  activeId: string | null;
  activeIsApp: boolean;
  dragDisabled: boolean;
  previewSlot: boolean;
  detachedOrigin?: boolean;
  suppressLaunch: MutableRefObject<boolean>;
  onOpen: (folderId: string) => void;
  onRemove: (folderId: string) => void;
  onOpenContextMenu?: (itemId: string, anchor: LaunchpadContextMenuAnchor) => void;
};

export function FolderTile({
  folder,
  apps,
  editing,
  motionDelayMs,
  activeId,
  activeIsApp,
  dragDisabled,
  previewSlot,
  detachedOrigin = false,
  suppressLaunch,
  onOpen,
  onRemove,
  onOpenContextMenu,
}: FolderTileProps) {
  const { t } = useTranslation('home');
  const folderApps = folder.appIds
    .map((appId) => apps.find((app) => app.id === appId))
    .filter((app): app is HomeAppDefinition => Boolean(app));

  return (
    <SortableItemShell
      itemId={folder.id}
      groupId={folder.groupId}
      activeId={activeId}
      canReceiveApp={activeIsApp}
      dragDisabled={dragDisabled}
      previewSlot={previewSlot}
      detachedOrigin={detachedOrigin}
      label={folder.name}
    >
      {({ targetRef, targetActive, activatorRef, activatorAttributes, activatorListeners }) => (
        <>
          <ButtonBase
            ref={activatorRef}
            disableRipple
            {...(editing ? activatorAttributes : {})}
            {...(activatorListeners as DOMAttributes<HTMLButtonElement>)}
            onKeyDown={(event) => {
              if (onOpenContextMenu && isLaunchpadContextMenuKeyboardEvent(event)) {
                event.preventDefault();
                event.stopPropagation();
                const bounds = event.currentTarget.getBoundingClientRect();
                onOpenContextMenu(folder.id, { top: bounds.bottom, left: bounds.left });
                return;
              }
              if (editing) {
                (
                  activatorListeners?.onKeyDown as
                    KeyboardEventHandler<HTMLButtonElement> | undefined
                )?.(event);
              }
            }}
            onContextMenu={(event) => {
              if (!onOpenContextMenu) return;
              event.preventDefault();
              event.stopPropagation();
              onOpenContextMenu(folder.id, { top: event.clientY, left: event.clientX });
            }}
            data-launchpad-tile
            aria-label={t('launchpad.openFolder', { folder: folder.name })}
            onClick={() => {
              if (!suppressLaunch.current) onOpen(folder.id);
            }}
            sx={launchpadTileSx(editing, motionDelayMs)}
          >
            <Box
              ref={targetRef}
              data-folder-target={folder.id}
              data-launchpad-edit-frame
              sx={launchpadInteractionFrameSx(editing)}
            >
              <Box
                data-launchpad-glyph
                sx={{
                  width: 52,
                  height: 52,
                  p: 0.5,
                  boxSizing: 'border-box',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 0.5,
                  border: 1,
                  borderColor: targetActive ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  bgcolor: targetActive ? 'action.selected' : 'action.hover',
                  boxShadow: '0 7px 18px rgba(15,23,42,0.10)',
                }}
              >
                {folderApps.slice(0, 4).map((app) => (
                  <AppGlyph key={app.id} app={app} size={20} />
                ))}
              </Box>
            </Box>
            <Typography
              component="span"
              data-launchpad-item-label
              variant="caption"
              fontWeight={700}
              sx={{
                width: 1,
                height: editing ? 'var(--launchpad-label-height, 24px)' : 28,
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: editing ? 'var(--launchpad-label-line-height, 12px)' : 1.2,
              }}
            >
              {folder.name}
            </Typography>
          </ButtonBase>
          {editing && (
            <Tooltip title={t('launchpad.folder.ungroup')}>
              <Box
                component="button"
                type="button"
                aria-label={t('launchpad.folder.ungroupLabel', { folder: folder.name })}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(folder.id);
                }}
                data-launchpad-remove-control="minus"
                sx={launchpadRemoveControlSx}
              >
                <Minus size={12} strokeWidth={3} aria-hidden="true" />
              </Box>
            </Tooltip>
          )}
        </>
      )}
    </SortableItemShell>
  );
}

type AppLaunchpadDragOverlayProps = {
  activeId: string | null;
  appById: ReadonlyMap<string, HomeAppDefinition>;
  layout: LaunchpadLayout;
  immersive: boolean;
};

export function AppLaunchpadDragOverlay({
  activeId,
  appById,
  layout,
  immersive,
}: AppLaunchpadDragOverlayProps) {
  return (
    <DragOverlay dropAnimation={null}>
      {activeId ? (
        <Box
          aria-hidden="true"
          sx={{
            width: LAUNCHPAD_TILE_WIDTH,
            height: LAUNCHPAD_TILE_HEIGHT_CSS,
            boxSizing: 'border-box',
            px: 0.25,
            py: 0.125,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 0.25,
            overflow: 'visible',
            border: 1,
            borderColor: immersive ? 'rgba(141,184,255,0.82)' : 'primary.main',
            borderRadius: 1,
            bgcolor: immersive ? 'rgba(8,20,48,0.94)' : 'background.paper',
            color: immersive ? '#FFFFFF' : 'text.primary',
            backdropFilter: immersive ? 'blur(18px) saturate(145%)' : 'none',
            WebkitBackdropFilter: immersive ? 'blur(18px) saturate(145%)' : 'none',
            boxShadow: immersive
              ? '0 18px 42px rgba(0,7,24,0.42), inset 0 1px 0 rgba(255,255,255,0.20)'
              : '0 18px 40px rgba(15,23,42,0.22)',
            pointerEvents: 'none',
            '@media (prefers-reduced-transparency: reduce), (forced-colors: active)': immersive
              ? {
                  bgcolor: '#12264B',
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                }
              : undefined,
          }}
        >
          {appById.has(activeId) ? (
            <>
              <AppGlyph app={appById.get(activeId) as HomeAppDefinition} />
              <Typography
                variant="caption"
                fontWeight={700}
                textAlign="center"
                sx={{
                  width: 1,
                  height: 28,
                  fontSize: launchpadLabelFontSize(
                    (appById.get(activeId) as HomeAppDefinition).shortName
                  ),
                  display: '-webkit-box',
                  overflow: 'hidden',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.2,
                  wordBreak: 'normal',
                  overflowWrap: 'normal',
                  color: 'inherit',
                }}
              >
                {appById.get(activeId)?.shortName}
              </Typography>
            </>
          ) : (
            <>
              <Folder size={34} strokeWidth={1.7} />
              <Typography
                variant="caption"
                fontWeight={700}
                textAlign="center"
                sx={{
                  width: 1,
                  height: 28,
                  display: '-webkit-box',
                  overflow: 'hidden',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.2,
                  wordBreak: 'keep-all',
                  overflowWrap: 'break-word',
                  color: 'inherit',
                }}
              >
                {layout.folders[activeId]?.name}
              </Typography>
            </>
          )}
        </Box>
      ) : null}
    </DragOverlay>
  );
}
