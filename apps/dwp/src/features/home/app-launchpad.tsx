import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Folder, Minus } from 'lucide-react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import {
  addAppToLaunchpadFolder,
  createLaunchpadFolder,
  hideLaunchpadApp,
  moveLaunchpadItemToGroup,
  localizeHomeAppGroups,
  renameLaunchpadFolder,
  ungroupLaunchpadFolder,
} from '../../components/workspace-composer/app-launchpad-model';
import { AppGlyph } from './app-glyph';
import {
  createLaunchpadCollisionDetection,
  folderTargetId,
  groupIdFromTarget,
  isLaunchpadOriginTarget,
  targetItemId,
} from './app-launchpad-dnd';
import {
  LAUNCHPAD_POST_DRAG_CLICK_GUARD_MS,
  launchpadMouseActivationConstraint,
  launchpadTouchActivationConstraint,
} from './app-launchpad-long-press';
import {
  LAUNCHPAD_TILE_HEIGHT,
  LAUNCHPAD_TILE_WIDTH,
  launchpadInteractionFrameSx,
  launchpadLabelFontSize,
  launchpadTileSx,
} from './app-launchpad-styles';
import { FlowAppDockList } from './flow-home/flow-app-dock-list';
import { AppLaunchpadGroupList } from './app-launchpad-group-list';
import { AppLaunchpadFolderDialog } from './app-launchpad-folder-dialog';
import { AppLaunchpadCrossGroupPreview } from './app-launchpad-cross-group-preview';
import {
  AppLaunchpadContextMenu,
  isLaunchpadContextMenuKeyboardEvent,
} from './app-launchpad-context-menu';
import { AppManagementAction } from './app-management-action';

import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import type {
  HomeAppDefinition,
  HomeAppGroup,
  HomeAppGroupId,
  LaunchpadFolder,
  LaunchpadLayout,
} from '../../components/workspace-composer/app-launchpad-model';
import type {
  LaunchpadContextMenuAnchor,
  LaunchpadContextMenuRequest,
  LaunchpadFolderCreationRequest,
} from './app-launchpad-context-menu';

const LAUNCHPAD_VISIBLE_ROWS = 3;
const LAUNCHPAD_ROW_GAP = 2;
const LAUNCHPAD_GRID_TOP_INSET = 8;
const LAUNCHPAD_GRID_HEIGHT =
  LAUNCHPAD_GRID_TOP_INSET +
  LAUNCHPAD_TILE_HEIGHT * LAUNCHPAD_VISIBLE_ROWS +
  LAUNCHPAD_ROW_GAP * (LAUNCHPAD_VISIBLE_ROWS - 1);
const LAUNCHPAD_GROUP_MIN_HEIGHT = LAUNCHPAD_GRID_HEIGHT + 82;
const FOLDER_POINTER_ACTION_DELAY_MS = 75;
const FOLDER_HOVER_ACTIVATION_MS = 240;

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

type AppLaunchpadProps = {
  apps: readonly HomeAppDefinition[];
  groups?: readonly HomeAppGroup[];
  layout: LaunchpadLayout;
  editing: boolean;
  reorderable?: boolean;
  onLaunch: (app: HomeAppDefinition) => void;
  onManage?: (app: HomeAppDefinition) => void;
  onStartEditing?: () => void;
  onLayoutChange: (layout: LaunchpadLayout) => void;
  customizationBusy?: boolean;
  immersive?: boolean;
  title?: string;
  onImageBackground?: boolean;
  variant?: 'classic' | 'flow';
  flowItemLimit?: number;
};

type PendingFolderCreation = LaunchpadFolderCreationRequest | null;

type DragPreview = {
  layout: LaunchpadLayout;
  targetGroupId: HomeAppGroupId;
  targetItemId: string | null;
} | null;

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
  }) => React.ReactNode;
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
        height: detachedOrigin ? 0 : LAUNCHPAD_TILE_HEIGHT,
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
  suppressLaunch: React.MutableRefObject<boolean>;
  onLaunch: (app: HomeAppDefinition) => void;
  onManage?: (app: HomeAppDefinition) => void;
  onRemove: (appId: string) => void;
  onOpenContextMenu?: (itemId: string, anchor: LaunchpadContextMenuAnchor) => void;
};

function AppTile({
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
            {...(activatorListeners as React.DOMAttributes<HTMLButtonElement>)}
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
                    React.KeyboardEventHandler<HTMLButtonElement> | undefined
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
              variant="caption"
              fontWeight={700}
              sx={{
                width: 1,
                height: editing ? 24 : 28,
                fontSize: launchpadLabelFontSize(app.shortName),
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: editing ? '12px' : 1.2,
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
  suppressLaunch: React.MutableRefObject<boolean>;
  onOpen: (folderId: string) => void;
  onRemove: (folderId: string) => void;
  onOpenContextMenu?: (itemId: string, anchor: LaunchpadContextMenuAnchor) => void;
};

function FolderTile({
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
            {...(activatorListeners as React.DOMAttributes<HTMLButtonElement>)}
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
                    React.KeyboardEventHandler<HTMLButtonElement> | undefined
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
              variant="caption"
              fontWeight={700}
              sx={{
                width: 1,
                height: editing ? 24 : 28,
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: editing ? '12px' : 1.2,
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

export function AppLaunchpad({
  apps,
  groups,
  layout,
  editing,
  reorderable = true,
  onLaunch,
  onManage,
  onStartEditing,
  onLayoutChange,
  customizationBusy = false,
  immersive = false,
  title,
  onImageBackground = false,
  variant = 'classic',
  flowItemLimit,
}: AppLaunchpadProps) {
  const { t } = useTranslation('home');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [keyboardDragging, setKeyboardDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<DragPreview>(null);
  const [pendingFolderCreation, setPendingFolderCreation] = useState<PendingFolderCreation>(null);
  const [folderPointerActionReady, setFolderPointerActionReady] = useState(false);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<LaunchpadContextMenuRequest>(null);
  const [folderName, setFolderName] = useState('');
  const suppressLaunch = useRef(false);
  const launchSuppressionTimer = useRef<number | null>(null);
  const folderPointerActionTimer = useRef<number | null>(null);
  const folderHoverTimer = useRef<number | null>(null);
  const folderHoverTargetRef = useRef<string | null>(null);
  const folderIntentTargetRef = useRef<string | null>(null);
  const dragPreviewRef = useRef<DragPreview>(null);
  const lastItemCollisionRef = useRef<ReturnType<CollisionDetection>>([]);
  const enteredEditingFromLongPressRef = useRef(false);
  const keyboardDraggingRef = useRef(false);
  const keyboardHorizontalDirectionRef = useRef<-1 | 0 | 1>(0);

  useEffect(
    () => () => {
      if (folderPointerActionTimer.current !== null) {
        window.clearTimeout(folderPointerActionTimer.current);
      }
      if (folderHoverTimer.current !== null) {
        window.clearTimeout(folderHoverTimer.current);
      }
    },
    []
  );

  const appById = useMemo(() => new Map(apps.map((app) => [app.id, app])), [apps]);
  const localizedGroups = useMemo(
    () => (groups?.length ? [...groups] : localizeHomeAppGroups(t)),
    [groups, t]
  );
  const groupById = useMemo(
    () => new Map(localizedGroups.map((group) => [group.id, group])),
    [localizedGroups]
  );
  const resolvedTitle = title ?? t('launchpad.defaultTitle');
  const activeIsApp = Boolean(activeId && appById.has(activeId));
  const openFolder = openFolderId ? layout.folders[openFolderId] : undefined;
  const activeSourceGroupId = activeId
    ? (localizedGroups.find((group) => layout.groups[group.id]?.includes(activeId))?.id ?? null)
    : null;
  const crossGroupPreview = Boolean(
    dragPreview && activeSourceGroupId && dragPreview.targetGroupId !== activeSourceGroupId
  );
  const renderedLayout = crossGroupPreview ? layout : (dragPreview?.layout ?? layout);
  const flow = variant === 'flow';

  const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
    keyboardHorizontalDirectionRef.current =
      event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
    return sortableKeyboardCoordinates(event, args);
  };
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: launchpadMouseActivationConstraint(editing),
    }),
    useSensor(TouchSensor, {
      activationConstraint: launchpadTouchActivationConstraint(editing),
    }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates })
  );

  const findGroupId = (itemId: string): HomeAppGroupId | null => {
    const group = localizedGroups.find((candidate) =>
      layout.groups[candidate.id]?.includes(itemId)
    );
    return group?.id ?? null;
  };
  const detectLaunchpadCollision = createLaunchpadCollisionDetection(
    lastItemCollisionRef,
    findGroupId
  );

  const restoreTileFocus = (itemId: string) => {
    window.requestAnimationFrame(() => {
      const item = Array.from(document.querySelectorAll<HTMLElement>('[data-launchpad-item]')).find(
        (candidate) => candidate.dataset.launchpadItem === itemId
      );
      item?.querySelector<HTMLElement>('[data-launchpad-tile]')?.focus();
    });
  };

  const openLaunchpadContextMenu = (itemId: string, anchor: LaunchpadContextMenuAnchor) => {
    if (customizationBusy || !reorderable || (!editing && !onStartEditing)) return;
    const groupId = findGroupId(itemId);
    if (!groupId) return;
    if (!editing) onStartEditing?.();
    setContextMenu({ itemId, groupId, anchor });
  };

  const closeLaunchpadContextMenu = (restoreFocus = true) => {
    const itemId = contextMenu?.itemId;
    setContextMenu(null);
    if (restoreFocus && itemId) restoreTileFocus(itemId);
  };

  const applyContextMenuLayout = (nextLayout: LaunchpadLayout, restoreFocus = true) => {
    const itemId = contextMenu?.itemId;
    setContextMenu(null);
    onLayoutChange(nextLayout);
    if (restoreFocus && itemId) restoreTileFocus(itemId);
  };

  const itemName = (itemId: string): string =>
    appById.get(itemId)?.name ?? layout.folders[itemId]?.name ?? t('launchpad.fallbackApp');

  const dropTargetName = (droppableId: string): string => {
    const folderTarget = targetItemId(droppableId);
    if (folderTarget) return itemName(folderTarget);
    const groupTarget = groupIdFromTarget(droppableId);
    return groupTarget
      ? (groupById.get(groupTarget)?.name ?? t('launchpad.fallbackApp'))
      : itemName(droppableId);
  };

  const releaseLaunchSuppression = () => {
    suppressLaunch.current = true;
    if (launchSuppressionTimer.current !== null) {
      window.clearTimeout(launchSuppressionTimer.current);
    }
    launchSuppressionTimer.current = window.setTimeout(() => {
      suppressLaunch.current = false;
      launchSuppressionTimer.current = null;
    }, LAUNCHPAD_POST_DRAG_CLICK_GUARD_MS);
  };

  const updateDragPreview = (preview: DragPreview) => {
    dragPreviewRef.current = preview;
    setDragPreview(preview);
  };

  const clearFolderHoverIntent = () => {
    if (folderHoverTimer.current !== null) {
      window.clearTimeout(folderHoverTimer.current);
      folderHoverTimer.current = null;
    }
    folderHoverTargetRef.current = null;
    folderIntentTargetRef.current = null;
  };

  const scheduleFolderHoverIntent = (targetId: string) => {
    if (folderHoverTargetRef.current === targetId) return;
    clearFolderHoverIntent();
    folderHoverTargetRef.current = targetId;
    folderHoverTimer.current = window.setTimeout(() => {
      if (folderHoverTargetRef.current === targetId) {
        folderIntentTargetRef.current = targetId;
        updateDragPreview(null);
      }
      folderHoverTimer.current = null;
    }, FOLDER_HOVER_ACTIVATION_MS);
  };

  const prepareFolderCreation = (creation: NonNullable<PendingFolderCreation>, name: string) => {
    setFolderName(name);
    setFolderPointerActionReady(false);
    setPendingFolderCreation(creation);
    if (folderPointerActionTimer.current !== null) {
      window.clearTimeout(folderPointerActionTimer.current);
    }
    folderPointerActionTimer.current = window.setTimeout(() => {
      setFolderPointerActionReady(true);
      folderPointerActionTimer.current = null;
    }, FOLDER_POINTER_ACTION_DELAY_MS);
  };

  const closeFolderCreation = () => {
    if (folderPointerActionTimer.current !== null) {
      window.clearTimeout(folderPointerActionTimer.current);
      folderPointerActionTimer.current = null;
    }
    setPendingFolderCreation(null);
    setFolderName('');
    setFolderPointerActionReady(false);
  };

  const handleDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    if (launchSuppressionTimer.current !== null) {
      window.clearTimeout(launchSuppressionTimer.current);
      launchSuppressionTimer.current = null;
    }
    suppressLaunch.current = true;
    enteredEditingFromLongPressRef.current = !editing;
    if (!editing) onStartEditing?.();
    keyboardDraggingRef.current = activatorEvent instanceof KeyboardEvent;
    keyboardHorizontalDirectionRef.current = 0;
    lastItemCollisionRef.current = [];
    clearFolderHoverIntent();
    updateDragPreview(null);
    setActiveId(String(active.id));
    setKeyboardDragging(keyboardDraggingRef.current);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (keyboardDraggingRef.current) return;

    const draggedId = String(active.id);
    const overId = over ? String(over.id) : null;
    if (!overId) {
      clearFolderHoverIntent();
      updateDragPreview(null);
      return;
    }
    if (isLaunchpadOriginTarget(draggedId, overId)) {
      clearFolderHoverIntent();
      updateDragPreview(null);
      return;
    }

    const folderTarget = targetItemId(overId);
    if (folderTarget) {
      scheduleFolderHoverIntent(folderTarget);
      return;
    }

    clearFolderHoverIntent();

    const sourceGroupId = findGroupId(draggedId);
    const directTargetGroupId = groupIdFromTarget(overId);
    const targetGroupId = directTargetGroupId ?? findGroupId(overId);
    if (!sourceGroupId || !targetGroupId) {
      updateDragPreview(null);
      return;
    }

    const targetItem = directTargetGroupId ? null : overId;
    const currentPreview = dragPreviewRef.current;
    if (
      currentPreview?.targetGroupId === targetGroupId &&
      currentPreview.targetItemId === targetItem
    ) {
      return;
    }

    updateDragPreview({
      layout: moveLaunchpadItemToGroup(
        layout,
        sourceGroupId,
        targetGroupId,
        draggedId,
        targetItem ?? undefined
      ),
      targetGroupId,
      targetItemId: targetItem,
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const draggedId = String(active.id);
    const overId = over ? String(over.id) : null;
    const sourceGroupId = findGroupId(draggedId);
    const keyboardDirection = keyboardHorizontalDirectionRef.current;
    const wasKeyboardDragging = keyboardDraggingRef.current;
    const completedPreview = dragPreviewRef.current;
    const completedFolderIntent = folderIntentTargetRef.current;
    const enteredEditingFromLongPress = enteredEditingFromLongPressRef.current;
    enteredEditingFromLongPressRef.current = false;
    keyboardDraggingRef.current = false;
    keyboardHorizontalDirectionRef.current = 0;
    clearFolderHoverIntent();
    updateDragPreview(null);
    setActiveId(null);
    setKeyboardDragging(false);
    releaseLaunchSuppression();
    lastItemCollisionRef.current = [];
    if (enteredEditingFromLongPress) return;
    if (!sourceGroupId) return;

    if (wasKeyboardDragging && keyboardDirection !== 0) {
      const sourceItems = layout.groups[sourceGroupId] ?? [];
      const activeIndex = sourceItems.indexOf(draggedId);
      const targetId = sourceItems[activeIndex + keyboardDirection];
      if (targetId) {
        onLayoutChange(
          moveLaunchpadItemToGroup(layout, sourceGroupId, sourceGroupId, draggedId, targetId)
        );
      }
      return;
    }

    if (!overId || isLaunchpadOriginTarget(draggedId, overId)) return;

    const folderTarget = targetItemId(overId);

    const directTargetGroupId = groupIdFromTarget(overId);
    if (directTargetGroupId) {
      onLayoutChange(
        moveLaunchpadItemToGroup(layout, sourceGroupId, directTargetGroupId, draggedId)
      );
      return;
    }

    if (folderTarget && completedFolderIntent === folderTarget) {
      const targetGroupId = findGroupId(folderTarget);
      if (!targetGroupId) return;
      const targetFolder = layout.folders[folderTarget];
      if (appById.has(draggedId) && targetFolder) {
        onLayoutChange(addAppToLaunchpadFolder(layout, draggedId, folderTarget));
        return;
      }

      const targetApp = appById.get(folderTarget);
      if (appById.has(draggedId) && targetApp) {
        const groupName = groupById.get(targetGroupId)?.name ?? t('launchpad.fallbackApp');
        prepareFolderCreation(
          {
            groupId: targetGroupId,
            firstAppId: draggedId,
            secondAppId: folderTarget,
            folderId: `folder-${crypto.randomUUID()}`,
          },
          t('launchpad.groupFolder', { group: groupName })
        );
        return;
      }

      onLayoutChange(
        moveLaunchpadItemToGroup(layout, sourceGroupId, targetGroupId, draggedId, folderTarget)
      );
      return;
    }

    if (folderTarget) {
      const targetGroupId = findGroupId(folderTarget);
      if (!targetGroupId) return;
      onLayoutChange(
        moveLaunchpadItemToGroup(layout, sourceGroupId, targetGroupId, draggedId, folderTarget)
      );
      return;
    }

    if (completedPreview) {
      onLayoutChange(completedPreview.layout);
      return;
    }

    const targetGroupId = findGroupId(overId);
    if (!targetGroupId) return;
    onLayoutChange(
      moveLaunchpadItemToGroup(layout, sourceGroupId, targetGroupId, draggedId, overId)
    );
  };

  const handleCreateFolder = () => {
    if (!pendingFolderCreation || !folderName.trim()) return;
    const nextLayout = createLaunchpadFolder(
      layout,
      pendingFolderCreation.groupId,
      pendingFolderCreation.firstAppId,
      pendingFolderCreation.secondAppId,
      pendingFolderCreation.folderId,
      folderName
    );
    onLayoutChange(nextLayout);
    closeFolderCreation();
  };

  const openRenameDialog = (folder: LaunchpadFolder) => {
    setFolderName(folder.name);
    setRenameFolderId(folder.id);
    setOpenFolderId(null);
  };

  const handleRenameFolder = () => {
    if (!renameFolderId) return;
    onLayoutChange(renameLaunchpadFolder(layout, renameFolderId, folderName));
    setRenameFolderId(null);
  };

  return (
    <Box
      component={flow ? 'div' : 'section'}
      aria-label={flow ? undefined : resolvedTitle}
      data-launchpad-surface={immersive ? 'immersive' : flow ? 'flow-dock' : 'page'}
      data-launchpad-editing={editing ? 'true' : 'false'}
      sx={
        immersive
          ? {
              width: 1,
              color: '#FFFFFF',
            }
          : flow
            ? { width: 1, color: 'text.primary' }
            : {
                mt: 0,
                mx: 0,
                color: onImageBackground ? '#FFFFFF' : 'text.primary',
                px: { md: onImageBackground ? 0 : 2.5 },
                py: { md: onImageBackground ? 0 : 2.5 },
                border: { md: onImageBackground ? 0 : 1 },
                borderColor: {
                  md: onImageBackground ? 'rgba(255,255,255,0.72)' : 'divider',
                },
                borderRadius: { md: '8px' },
                bgcolor: (theme) =>
                  onImageBackground
                    ? 'transparent'
                    : theme.palette.mode === 'dark'
                      ? '#141D28'
                      : '#F3F4F6',
                boxShadow: 'none',
              }
      }
    >
      <DndContext
        sensors={sensors}
        collisionDetection={detectLaunchpadCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={() => {
          keyboardDraggingRef.current = false;
          keyboardHorizontalDirectionRef.current = 0;
          clearFolderHoverIntent();
          lastItemCollisionRef.current = [];
          enteredEditingFromLongPressRef.current = false;
          updateDragPreview(null);
          setActiveId(null);
          setKeyboardDragging(false);
          releaseLaunchSuppression();
        }}
        onDragEnd={handleDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable: t('launchpad.drag.instructions'),
          },
          announcements: {
            onDragStart: ({ active }) =>
              t('launchpad.drag.pickedUp', { item: itemName(String(active.id)) }),
            onDragOver: ({ over }) =>
              over
                ? t('launchpad.drag.over', { item: dropTargetName(String(over.id)) })
                : t('launchpad.drag.notOver'),
            onDragEnd: ({ active, over }) =>
              over
                ? t('launchpad.drag.placed', {
                    item: itemName(String(active.id)),
                    target: dropTargetName(String(over.id)),
                  })
                : t('launchpad.drag.returned', { item: itemName(String(active.id)) }),
            onDragCancel: ({ active }) =>
              t('launchpad.drag.cancelled', { item: itemName(String(active.id)) }),
          },
        }}
      >
        {flow && !editing ? (
          <FlowAppDockList
            apps={apps}
            groups={localizedGroups}
            layout={layout}
            itemLimit={flowItemLimit}
            onLaunch={onLaunch}
            onManage={onManage}
            onOpenFolder={setOpenFolderId}
            onStartEditing={reorderable ? onStartEditing : undefined}
            onOpenContextMenu={reorderable && onStartEditing ? openLaunchpadContextMenu : undefined}
          />
        ) : (
          <Box
            sx={{
              width: 1,
              maxWidth: immersive ? 1540 : 'none',
              mx: 'auto',
              px: immersive ? { xs: 2, md: 3, xl: 4 } : 0,
              display: 'grid',
              gridTemplateColumns: flow
                ? {
                    xs: 'minmax(0, 1fr)',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    lg: 'repeat(4, minmax(0, 1fr))',
                  }
                : {
                    xs: 'minmax(0, 1fr)',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    lg: 'repeat(4, minmax(0, 1fr))',
                  },
              gap: flow
                ? { xs: 1, md: 1.25 }
                : { xs: immersive ? 1.5 : 1, md: immersive ? 1.5 : 2 },
              pb: { xs: immersive ? 4 : 0, md: immersive ? 4 : 0 },
              overflowX: 'visible',
              scrollSnapType: 'none',
              border: 0,
              borderColor: 'divider',
              borderRadius: 0,
              overflowY: 'hidden',
              bgcolor: 'transparent',
            }}
          >
            {localizedGroups.map((group) => {
              const destinationPreviewIds = dragPreview?.layout.groups[group.id] ?? [];
              const isCrossGroupDestination = Boolean(
                crossGroupPreview && dragPreview?.targetGroupId === group.id
              );
              const itemIds = isCrossGroupDestination
                ? destinationPreviewIds
                : (renderedLayout.groups[group.id] ?? []);
              const sortableItemIds = isCrossGroupDestination
                ? itemIds.filter((itemId) => itemId !== activeId)
                : itemIds;
              if (itemIds.length === 0 && !editing) return null;
              return (
                <Box
                  component="section"
                  aria-labelledby={`app-group-${group.id}`}
                  key={group.id}
                  sx={{
                    minWidth: 0,
                    minHeight: flow
                      ? 'auto'
                      : immersive
                        ? LAUNCHPAD_GROUP_MIN_HEIGHT
                        : { xs: 170, lg: 228 },
                    color: immersive ? '#FFFFFF' : 'text.primary',
                    px: immersive ? 1 : { xs: 1.25, lg: 2.25 },
                    py: immersive ? 1.5 : { xs: 1.25, lg: 2 },
                    border: flow
                      ? '1px dashed'
                      : immersive
                        ? '1px solid rgba(255,255,255,0.16)'
                        : 1,
                    borderColor: flow
                      ? 'divider'
                      : immersive
                        ? 'rgba(255,255,255,0.16)'
                        : onImageBackground
                          ? (theme) =>
                              theme.palette.mode === 'dark'
                                ? 'rgba(255,255,255,0.20)'
                                : 'rgba(255,255,255,0.44)'
                          : 'divider',
                    borderRadius: flow ? 2 : immersive ? 1 : '8px',
                    position: 'relative',
                    overflow: 'hidden',
                    bgcolor: flow
                      ? 'transparent'
                      : immersive
                        ? 'rgba(9,18,38,0.54)'
                        : onImageBackground
                          ? (theme) =>
                              theme.palette.mode === 'dark'
                                ? 'rgba(10,19,33,0.20)'
                                : 'rgba(255,255,255,0.20)'
                          : 'background.paper',
                    backgroundImage: immersive
                      ? 'linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.035) 50%, rgba(78,165,255,0.08))'
                      : 'none',
                    backdropFilter: immersive ? 'blur(24px) saturate(155%)' : 'none',
                    WebkitBackdropFilter: immersive ? 'blur(24px) saturate(155%)' : 'none',
                    boxShadow: immersive
                      ? 'inset 0 1px 0 rgba(255,255,255,0.22), 0 22px 54px rgba(0,7,24,0.24)'
                      : onImageBackground
                        ? 'inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 24px rgba(15,23,42,0.08)'
                        : '0 1px 2px rgba(15,23,42,0.06)',
                    '&:hover': immersive
                      ? {
                          bgcolor: 'rgba(15,29,56,0.64)',
                          borderColor: 'rgba(255,255,255,0.28)',
                        }
                      : undefined,
                    '@media (prefers-reduced-transparency: reduce), (forced-colors: active)':
                      immersive
                        ? {
                            bgcolor: '#15233B',
                            backgroundImage: 'none',
                            backdropFilter: 'none',
                            WebkitBackdropFilter: 'none',
                          }
                        : undefined,
                    scrollSnapAlign: 'none',
                  }}
                >
                  <Typography
                    id={`app-group-${group.id}`}
                    component={flow ? 'h3' : 'h2'}
                    variant="subtitle2"
                  >
                    {group.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={immersive ? 'rgba(255,255,255,0.68)' : 'text.secondary'}
                    sx={{
                      display: 'block',
                      minHeight: immersive ? 30 : { xs: 20, lg: 24 },
                      mt: 0.25,
                      whiteSpace: { xs: 'nowrap', lg: 'normal' },
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {group.description}
                  </Typography>
                  <AppLaunchpadGroupList
                    groupId={group.id}
                    groupName={t('launchpad.groupApps', { group: group.name })}
                    itemIds={itemIds}
                    sortableItemIds={sortableItemIds}
                    immersive={Boolean(immersive)}
                    flow={flow}
                    dragDisabled={Boolean(customizationBusy || !reorderable)}
                    previewActive={dragPreview?.targetGroupId === group.id}
                  >
                    {itemIds.map((itemId, itemIndex) => {
                      const folder = layout.folders[itemId] ?? dragPreview?.layout.folders[itemId];
                      if (isCrossGroupDestination && itemId === activeId) {
                        const previewApp = appById.get(itemId);
                        return (
                          <AppLaunchpadCrossGroupPreview
                            key={`drop-preview-${itemId}`}
                            itemId={itemId}
                            groupId={group.id}
                            label={previewApp?.name ?? folder?.name ?? t('launchpad.fallbackApp')}
                            app={previewApp}
                            immersive={Boolean(immersive)}
                          />
                        );
                      }
                      if (folder) {
                        return (
                          <FolderTile
                            key={folder.id}
                            folder={folder}
                            apps={apps}
                            editing={editing}
                            motionDelayMs={(itemIndex % 4) * -55}
                            activeId={activeId}
                            activeIsApp={activeIsApp && !keyboardDragging}
                            dragDisabled={customizationBusy || !reorderable}
                            previewSlot={
                              activeId === itemId && dragPreview?.targetGroupId === group.id
                            }
                            detachedOrigin={Boolean(
                              crossGroupPreview &&
                              activeSourceGroupId === group.id &&
                              activeId === itemId
                            )}
                            suppressLaunch={suppressLaunch}
                            onOpen={setOpenFolderId}
                            onRemove={(folderId) =>
                              onLayoutChange(ungroupLaunchpadFolder(layout, folderId))
                            }
                            onOpenContextMenu={
                              reorderable && (editing || onStartEditing)
                                ? openLaunchpadContextMenu
                                : undefined
                            }
                          />
                        );
                      }
                      const app = appById.get(itemId);
                      return app ? (
                        <AppTile
                          key={app.id}
                          app={app}
                          groupId={group.id}
                          immersive={Boolean(immersive)}
                          editing={editing}
                          motionDelayMs={(itemIndex % 4) * -55}
                          activeId={activeId}
                          activeIsApp={activeIsApp && !keyboardDragging}
                          dragDisabled={customizationBusy || !reorderable}
                          previewSlot={
                            activeId === itemId && dragPreview?.targetGroupId === group.id
                          }
                          detachedOrigin={Boolean(
                            crossGroupPreview &&
                            activeSourceGroupId === group.id &&
                            activeId === itemId
                          )}
                          suppressLaunch={suppressLaunch}
                          onLaunch={onLaunch}
                          onManage={onManage}
                          onRemove={(appId) => onLayoutChange(hideLaunchpadApp(layout, appId))}
                          onOpenContextMenu={
                            reorderable && (editing || onStartEditing)
                              ? openLaunchpadContextMenu
                              : undefined
                          }
                        />
                      ) : null;
                    })}
                  </AppLaunchpadGroupList>
                </Box>
              );
            })}
          </Box>
        )}

        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <Box
              aria-hidden="true"
              sx={{
                width: LAUNCHPAD_TILE_WIDTH,
                height: LAUNCHPAD_TILE_HEIGHT,
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
      </DndContext>

      <AppLaunchpadContextMenu
        request={contextMenu}
        apps={apps}
        groups={localizedGroups}
        layout={layout}
        busy={customizationBusy}
        onClose={closeLaunchpadContextMenu}
        onApply={applyContextMenuLayout}
        onRenameFolder={openRenameDialog}
        onPrepareFolderCreation={prepareFolderCreation}
      />

      <Dialog
        open={Boolean(pendingFolderCreation)}
        onClose={closeFolderCreation}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t('launchpad.folder.create')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t('launchpad.folder.name')}
            value={folderName}
            onChange={(event) => setFolderName(event.target.value.slice(0, 42))}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleCreateFolder();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeFolderCreation}>{t('actions.cancel', { ns: 'common' })}</Button>
          <Button
            variant="contained"
            disabled={!folderName.trim() || !folderPointerActionReady}
            onClick={handleCreateFolder}
          >
            {t('actions.create', { ns: 'common' })}
          </Button>
        </DialogActions>
      </Dialog>

      <AppLaunchpadFolderDialog
        folder={openFolder}
        apps={apps}
        editing={editing}
        onClose={() => setOpenFolderId(null)}
        onRename={openRenameDialog}
        onLaunch={onLaunch}
        onManage={onManage}
        onRemoveApp={(app) => {
          onLayoutChange(hideLaunchpadApp(layout, app.id));
          if (openFolder && openFolder.appIds.length <= 2) setOpenFolderId(null);
        }}
      />

      <Dialog
        open={Boolean(renameFolderId)}
        onClose={() => setRenameFolderId(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t('launchpad.folder.rename')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t('launchpad.folder.name')}
            value={folderName}
            onChange={(event) => setFolderName(event.target.value.slice(0, 42))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleRenameFolder();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameFolderId(null)}>
            {t('actions.cancel', { ns: 'common' })}
          </Button>
          <Button variant="contained" disabled={!folderName.trim()} onClick={handleRenameFolder}>
            {t('actions.save', { ns: 'common' })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
