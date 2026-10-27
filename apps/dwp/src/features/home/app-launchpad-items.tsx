import { useTranslation } from 'react-i18next';
import { foundationTokens } from '@dwp-frontend/design-system';
import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { DragOverlay, useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Folder, FolderPlus, LockKeyhole, Minus, MoreHorizontal } from 'lucide-react';
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
    boxShadow: (theme: Theme) => theme.shadows[2],
    transition: (theme: Theme) =>
      theme.transitions.create(['transform', 'background-color'], {
        duration: theme.transitions.duration.shortest,
      }),
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

const launchpadMoreControlSx = {
  position: 'absolute',
  top: -7,
  right: -4,
  zIndex: 5,
  width: 28,
  height: 28,
  p: 0,
  display: 'grid',
  placeItems: 'center',
  borderRadius: '50%',
  border: 1,
  borderColor: 'divider',
  color: 'text.secondary',
  bgcolor: 'background.paper',
  boxShadow: (theme: Theme) => theme.shadows[2],
  cursor: 'pointer',
  transition: (theme: Theme) =>
    theme.transitions.create(['color', 'background-color', 'transform'], {
      duration: theme.transitions.duration.shortest,
    }),
  '&:hover': {
    color: 'primary.main',
    bgcolor: 'action.hover',
    transform: 'scale(1.06)',
  },
  '&:active': { transform: 'scale(0.94)' },
  '&:disabled': { opacity: 0.48, cursor: 'default', transform: 'none' },
  '&:focus-visible': {
    outline: '2px solid var(--dwp-focus-ring, currentColor)',
    outlineOffset: 2,
  },
  '@media (forced-colors: active)': {
    borderColor: 'ButtonText',
    color: 'ButtonText',
    boxShadow: 'none',
  },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
} as const;

type LaunchpadMoreActionsProps = {
  itemId: string;
  itemName: string;
  disabled: boolean;
  onOpenContextMenu?: (itemId: string, anchor: LaunchpadContextMenuAnchor) => void;
};

function LaunchpadMoreActions({
  itemId,
  itemName,
  disabled,
  onOpenContextMenu,
}: LaunchpadMoreActionsProps) {
  const { t } = useTranslation('home');
  if (!onOpenContextMenu) return null;

  const label = t('launchpad.contextMenu.moreActions', { item: itemName });
  return (
    <Tooltip title={label}>
      <Box
        component="button"
        type="button"
        disabled={disabled}
        aria-label={label}
        data-launchpad-more-actions={itemId}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const bounds = event.currentTarget.getBoundingClientRect();
          onOpenContextMenu(itemId, { top: bounds.bottom + 4, left: bounds.right });
        }}
        sx={launchpadMoreControlSx}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </Box>
    </Tooltip>
  );
}

function FolderDropFeedback({
  state,
  targetKind,
}: {
  state: 'candidate' | 'ready';
  targetKind: 'app' | 'folder';
}) {
  const { t } = useTranslation('home');
  const ready = state === 'ready';
  const label = t(
    targetKind === 'folder'
      ? ready
        ? 'launchpad.drag.addToFolderReady'
        : 'launchpad.drag.addToFolderCandidate'
      : ready
        ? 'launchpad.drag.folderReady'
        : 'launchpad.drag.folderCandidate'
  );

  return (
    <Box
      component="span"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-launchpad-folder-feedback={state}
      sx={{
        position: 'absolute',
        left: '50%',
        top: 'calc(100% - 9px)',
        zIndex: 6,
        minWidth: 'max-content',
        maxWidth: 156,
        minHeight: 24,
        px: 0.75,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        border: 1,
        borderStyle: ready ? 'solid' : 'dashed',
        borderColor: ready ? 'primary.main' : 'divider',
        borderRadius: foundationTokens.home.radius.surface,
        color: ready ? 'primary.main' : 'text.secondary',
        bgcolor: 'background.paper',
        boxShadow: (theme: Theme) => theme.shadows[ready ? 3 : 1],
        fontSize: foundationTokens.home.typography.compactSize,
        fontWeight: foundationTokens.home.typography.weightHeavy,
        lineHeight: foundationTokens.home.typography.tightLineHeight,
        whiteSpace: 'nowrap',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        '@media (forced-colors: active)': {
          borderColor: ready ? 'Highlight' : 'CanvasText',
          color: ready ? 'Highlight' : 'CanvasText',
          bgcolor: 'Canvas',
          boxShadow: 'none',
        },
      }}
    >
      <FolderPlus size={13} aria-hidden="true" />
      {label}
    </Box>
  );
}

type SortableItemShellProps = {
  itemId: string;
  groupId: HomeAppGroupId;
  activeId: string | null;
  canReceiveApp: boolean;
  dragDisabled: boolean;
  previewSlot: boolean;
  folderDropReady?: boolean;
  detachedOrigin?: boolean;
  label: string;
  children: (props: {
    targetRef: (element: HTMLElement | null) => void;
    folderDropState: 'idle' | 'candidate' | 'ready';
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
  folderDropReady = false,
  detachedOrigin = false,
  label,
  children,
}: SortableItemShellProps) {
  const { t } = useTranslation('home');
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
      data-launchpad-reorder-indicator={previewSlot ? 'true' : undefined}
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
          bgcolor: alpha(foundationTokens.home.color.heroFocus, 0.18),
          borderColor: foundationTokens.home.color.heroFocus,
          borderStyle: 'dashed',
          boxShadow: (theme: Theme) => theme.shadows[2],
        },
        '&[data-launchpad-reorder-indicator="true"]::before': {
          content: '""',
          position: 'absolute',
          top: 4,
          bottom: 18,
          left: -4,
          width: 4,
          borderRadius: foundationTokens.home.radius.surface,
          bgcolor: 'primary.main',
          boxShadow: (theme: Theme) => theme.shadows[2],
          pointerEvents: 'none',
        },
        '@media (forced-colors: active)': {
          '&[data-launchpad-reorder-indicator="true"]::before': {
            bgcolor: 'Highlight',
            boxShadow: 'none',
          },
        },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      {children({
        targetRef: target.setNodeRef,
        folderDropState: target.isOver ? (folderDropReady ? 'ready' : 'candidate') : 'idle',
        activatorRef: setActivatorNodeRef,
        activatorAttributes: attributes,
        activatorListeners: listeners,
      })}
      {previewSlot && (
        <Box
          component="span"
          role="status"
          aria-live="polite"
          data-launchpad-reorder-feedback
          sx={{
            position: 'absolute',
            left: '50%',
            bottom: -4,
            zIndex: 6,
            minWidth: 'max-content',
            px: 0.75,
            py: 0.25,
            borderRadius: foundationTokens.home.radius.surface,
            color: 'primary.main',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'primary.main',
            boxShadow: (theme: Theme) => theme.shadows[2],
            fontSize: foundationTokens.home.typography.compactSize,
            fontWeight: foundationTokens.home.typography.weightHeavy,
            lineHeight: foundationTokens.home.typography.tightLineHeight,
            whiteSpace: 'nowrap',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            '@media (forced-colors: active)': {
              color: 'Highlight',
              bgcolor: 'Canvas',
              borderColor: 'Highlight',
              boxShadow: 'none',
            },
          }}
        >
          {t('launchpad.drag.reorderReady')}
        </Box>
      )}
    </Box>
  );
}

type AppTileProps = {
  app: HomeAppDefinition;
  disabled?: boolean;
  groupId: HomeAppGroupId;
  immersive: boolean;
  editing: boolean;
  motionDelayMs: number;
  activeId: string | null;
  activeIsApp: boolean;
  dragDisabled: boolean;
  previewSlot: boolean;
  folderDropReady?: boolean;
  detachedOrigin?: boolean;
  suppressLaunch: MutableRefObject<boolean>;
  onLaunch: (app: HomeAppDefinition) => void;
  onManage?: (app: HomeAppDefinition) => void;
  onRemove: (appId: string) => void;
  onOpenContextMenu?: (itemId: string, anchor: LaunchpadContextMenuAnchor) => void;
};

export function AppTile({
  app,
  disabled = false,
  groupId,
  immersive,
  editing,
  motionDelayMs,
  activeId,
  activeIsApp,
  dragDisabled,
  previewSlot,
  folderDropReady = false,
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
      dragDisabled={dragDisabled || disabled}
      previewSlot={previewSlot}
      folderDropReady={folderDropReady}
      detachedOrigin={detachedOrigin}
      label={app.name}
    >
      {({ targetRef, folderDropState, activatorRef, activatorAttributes, activatorListeners }) => (
        <>
          <ButtonBase
            component="button"
            type="button"
            ref={activatorRef}
            disabled={disabled}
            disableRipple
            {...(editing && !disabled ? activatorAttributes : {})}
            {...(!disabled ? (activatorListeners as DOMAttributes<HTMLButtonElement>) : {})}
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
            data-launchpad-app-disabled={disabled ? app.id : undefined}
            aria-label={
              disabled
                ? t('launchpad.forbiddenApp', { app: app.name })
                : editing
                  ? t('launchpad.dragApp', { app: app.name })
                  : t(app.managementOnly ? 'launchpad.manageApp' : 'launchpad.openApp', {
                      app: app.name,
                    })
            }
            onClick={() => {
              if (!disabled && !editing && !suppressLaunch.current) onLaunch(app);
            }}
            title={disabled ? t('launchpad.forbiddenApp', { app: app.name }) : undefined}
            sx={launchpadTileSx(editing, motionDelayMs, disabled)}
          >
            <Box
              ref={targetRef}
              data-folder-target={app.id}
              data-launchpad-folder-drop={folderDropState === 'idle' ? undefined : folderDropState}
              data-launchpad-edit-frame
              sx={launchpadInteractionFrameSx(editing, folderDropState)}
            >
              <Box data-launchpad-glyph sx={{ position: 'relative', width: 52, height: 52 }}>
                <AppGlyph app={app} variant={immersive ? 'glass' : 'soft'} />
                {app.badge && !editing && (
                  <Box
                    component="span"
                    data-launchpad-badge
                    sx={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      minWidth: 18,
                      height: 18,
                      px: 0.375,
                      boxSizing: 'border-box',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: foundationTokens.home.radius.surface,
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      color: 'text.primary',
                      fontSize: foundationTokens.home.typography.compactSize,
                      fontWeight: foundationTokens.home.typography.weightHeavy,
                      lineHeight: foundationTokens.home.typography.tightLineHeight,
                      textAlign: 'center',
                      fontVariantNumeric: 'tabular-nums',
                      boxShadow: (theme: Theme) => theme.shadows[2],
                      zIndex: 2,
                    }}
                  >
                    {app.badge}
                  </Box>
                )}
                {disabled && (
                  <Box
                    component="span"
                    data-launchpad-app-lock
                    aria-hidden="true"
                    sx={{
                      position: 'absolute',
                      right: -8,
                      bottom: -6,
                      width: 22,
                      height: 22,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: '50%',
                      color: 'text.secondary',
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <LockKeyhole size={13} />
                  </Box>
                )}
              </Box>
              {folderDropState !== 'idle' && (
                <FolderDropFeedback state={folderDropState} targetKind="app" />
              )}
            </Box>
            <Typography
              component="span"
              data-launchpad-item-label
              variant="caption"
              fontWeight="fontWeightBold"
              sx={{
                width: 1,
                height: editing ? 'var(--launchpad-label-height, 24px)' : 28,
                position: 'relative',
                zIndex: 2,
                fontSize: launchpadLabelFontSize(app.shortName),
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: editing
                  ? 'var(--launchpad-label-line-height, 12px)'
                  : foundationTokens.home.typography.tightLineHeight,
                wordBreak: 'normal',
                overflowWrap: 'anywhere',
                '& [data-launchpad-label-full]': { display: 'none' },
              }}
            >
              <Box component="span" data-launchpad-label-short aria-hidden="true">
                {app.shortName}
              </Box>
              <Box component="span" data-launchpad-label-full aria-hidden="true">
                {app.name}
              </Box>
            </Typography>
          </ButtonBase>
          {!disabled && !editing && app.managementRoute && onManage && (
            <AppManagementAction app={app} variant="overlay" onManage={onManage} />
          )}
          {editing && (
            <LaunchpadMoreActions
              itemId={app.id}
              itemName={app.name}
              disabled={dragDisabled}
              onOpenContextMenu={onOpenContextMenu}
            />
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
  folderDropReady?: boolean;
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
  folderDropReady = false,
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
      folderDropReady={folderDropReady}
      detachedOrigin={detachedOrigin}
      label={folder.name}
    >
      {({ targetRef, folderDropState, activatorRef, activatorListeners }) => (
        <>
          <ButtonBase
            ref={activatorRef}
            disableRipple
            {...(activatorListeners as DOMAttributes<HTMLButtonElement>)}
            onKeyDown={(event) => {
              if (onOpenContextMenu && isLaunchpadContextMenuKeyboardEvent(event)) {
                event.preventDefault();
                event.stopPropagation();
                const bounds = event.currentTarget.getBoundingClientRect();
                onOpenContextMenu(folder.id, { top: bounds.bottom, left: bounds.left });
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
              data-launchpad-folder-drop={folderDropState === 'idle' ? undefined : folderDropState}
              data-launchpad-edit-frame
              sx={launchpadInteractionFrameSx(editing, folderDropState)}
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
                  borderColor: folderDropState !== 'idle' ? 'primary.main' : 'divider',
                  borderRadius: foundationTokens.radius.control + 'px',
                  bgcolor: folderDropState !== 'idle' ? 'action.selected' : 'action.hover',
                  boxShadow: (theme: Theme) => theme.shadows[2],
                }}
              >
                {folderApps.slice(0, 4).map((app) => (
                  <AppGlyph key={app.id} app={app} size={20} />
                ))}
              </Box>
              {folderDropState !== 'idle' && (
                <FolderDropFeedback state={folderDropState} targetKind="folder" />
              )}
            </Box>
            <Typography
              component="span"
              data-launchpad-item-label
              variant="caption"
              fontWeight="fontWeightBold"
              sx={{
                width: 1,
                height: editing ? 'var(--launchpad-label-height, 24px)' : 28,
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: editing
                  ? 'var(--launchpad-label-line-height, 12px)'
                  : foundationTokens.home.typography.tightLineHeight,
              }}
            >
              {folder.name}
            </Typography>
          </ButtonBase>
          {editing && (
            <LaunchpadMoreActions
              itemId={folder.id}
              itemName={folder.name}
              disabled={dragDisabled}
              onOpenContextMenu={onOpenContextMenu}
            />
          )}
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
            borderColor: immersive
              ? alpha(foundationTokens.home.color.heroFocus, 0.82)
              : 'primary.main',
            borderRadius: foundationTokens.radius.control + 'px',
            bgcolor: immersive
              ? alpha(foundationTokens.home.color.heroBase, 0.94)
              : 'background.paper',
            color: immersive ? foundationTokens.home.color.heroOn : 'text.primary',
            backdropFilter: immersive ? 'blur(18px) saturate(145%)' : 'none',
            WebkitBackdropFilter: immersive ? 'blur(18px) saturate(145%)' : 'none',
            boxShadow: (theme: Theme) => theme.shadows[immersive ? 8 : 6],
            pointerEvents: 'none',
            '@media (prefers-reduced-transparency: reduce), (forced-colors: active)': immersive
              ? {
                  bgcolor: foundationTokens.color.neutral[900],
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
                fontWeight="fontWeightBold"
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
                  lineHeight: foundationTokens.home.typography.tightLineHeight,
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
                fontWeight="fontWeightBold"
                textAlign="center"
                sx={{
                  width: 1,
                  height: 28,
                  display: '-webkit-box',
                  overflow: 'hidden',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: foundationTokens.home.typography.tightLineHeight,
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
