import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keyframes } from '@emotion/react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AppWindow, Folder, Pencil, Settings2, X } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import type { SxProps, Theme } from '@mui/material/styles';

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
  LAUNCHPAD_POST_DRAG_CLICK_GUARD_MS,
  launchpadMouseActivationConstraint,
  launchpadTouchActivationConstraint,
} from './app-launchpad-long-press';

import type { DragEndEvent, DragStartEvent, CollisionDetection } from '@dnd-kit/core';
import type {
  HomeAppDefinition,
  HomeAppGroup,
  HomeAppGroupId,
  LaunchpadFolder,
  LaunchpadLayout,
} from '../../components/workspace-composer/app-launchpad-model';

const FOLDER_TARGET_PREFIX = 'folder-target::';
const GROUP_TARGET_PREFIX = 'group-target::';
const LAUNCHPAD_TILE_WIDTH = 72;
const LAUNCHPAD_TILE_HEIGHT = 84;
const LAUNCHPAD_VISIBLE_COLUMNS = 5;
const LAUNCHPAD_VISIBLE_ROWS = 3;
const LAUNCHPAD_ROW_GAP = 2;
const LAUNCHPAD_GRID_TOP_INSET = 8;
const LAUNCHPAD_GRID_HEIGHT =
  LAUNCHPAD_GRID_TOP_INSET +
  LAUNCHPAD_TILE_HEIGHT * LAUNCHPAD_VISIBLE_ROWS +
  LAUNCHPAD_ROW_GAP * (LAUNCHPAD_VISIBLE_ROWS - 1);
const LAUNCHPAD_GROUP_MIN_HEIGHT = LAUNCHPAD_GRID_HEIGHT + 82;
const FOLDER_POINTER_ACTION_DELAY_MS = 75;

function launchpadLabelFontSize(label: string) {
  return label.length > 8 ? '0.625rem' : '0.6875rem';
}

const appWiggle = keyframes`
  0% { transform: translate3d(-0.35px, 0, 0) rotate(-1.15deg); }
  50% { transform: translate3d(0.35px, -0.25px, 0) rotate(1.05deg); }
  100% { transform: translate3d(-0.2px, 0.2px, 0) rotate(-0.8deg); }
`;

function launchpadTileSx(editing: boolean, motionDelayMs: number): SxProps<Theme> {
  return {
    width: 1,
    height: LAUNCHPAD_TILE_HEIGHT,
    boxSizing: 'border-box',
    px: 0.25,
    py: 0.125,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: 0.25,
    position: 'relative',
    overflow: 'visible',
    border: '1px solid',
    borderColor: 'transparent',
    borderRadius: 1,
    bgcolor: 'transparent',
    textAlign: 'center',
    cursor: editing ? 'grab' : 'pointer',
    touchAction: 'manipulation',
    transition: (theme) =>
      theme.transitions.create(['background-color', 'border-color', 'box-shadow', 'transform'], {
        duration: theme.transitions.duration.shorter,
      }),
    '& [data-launchpad-glyph]': {
      transition: (theme) =>
        theme.transitions.create('transform', { duration: theme.transitions.duration.shorter }),
      transformOrigin: 'center',
      animation: editing ? `${appWiggle} 380ms ease-in-out infinite` : 'none',
      animationDelay: editing ? `${motionDelayMs}ms` : '0ms',
      willChange: editing ? 'transform' : 'auto',
    },
    '&:hover': editing
      ? {
          bgcolor: 'action.hover',
          borderColor: 'divider',
          boxShadow: '0 8px 20px rgba(15,23,42,0.10)',
        }
      : {
          bgcolor: 'action.hover',
          borderColor: 'divider',
          boxShadow: '0 8px 20px rgba(15,23,42,0.10)',
          transform: 'translateY(-2px)',
        },
    '&:hover [data-launchpad-glyph]': editing
      ? undefined
      : { transform: 'translateY(-1px) scale(1.035)' },
    '&:focus-visible': {
      outline: 'none',
      borderColor: 'primary.main',
      boxShadow: '0 0 0 2px rgba(37,99,235,0.20), 0 10px 24px rgba(15,23,42,0.10)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      transform: 'none',
      '& [data-launchpad-glyph]': {
        animation: 'none',
        transition: 'none',
        transform: 'none',
        willChange: 'auto',
      },
    },
  };
}

type AppLaunchpadProps = {
  apps: readonly HomeAppDefinition[];
  groups?: readonly HomeAppGroup[];
  layout: LaunchpadLayout;
  editing: boolean;
  onLaunch: (app: HomeAppDefinition) => void;
  onBrowseAll: () => void;
  onStartEditing: () => void;
  onLayoutChange: (layout: LaunchpadLayout) => void;
  customizationBusy?: boolean;
  immersive?: boolean;
  title?: string;
  description?: string;
};

type PendingFolderCreation = {
  groupId: HomeAppGroupId;
  firstAppId: string;
  secondAppId: string;
  folderId: string;
} | null;

function folderTargetId(itemId: string): string {
  return `${FOLDER_TARGET_PREFIX}${itemId}`;
}

function targetItemId(droppableId: string): string | null {
  return droppableId.startsWith(FOLDER_TARGET_PREFIX)
    ? droppableId.slice(FOLDER_TARGET_PREFIX.length)
    : null;
}

function groupTargetId(groupId: HomeAppGroupId): string {
  return `${GROUP_TARGET_PREFIX}${groupId}`;
}

function groupIdFromTarget(droppableId: string): HomeAppGroupId | null {
  if (!droppableId.startsWith(GROUP_TARGET_PREFIX)) return null;
  const groupId = droppableId.slice(GROUP_TARGET_PREFIX.length);
  return groupId || null;
}

const launchpadCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const folderTarget = pointerCollisions.find((collision) =>
    String(collision.id).startsWith(FOLDER_TARGET_PREFIX)
  );
  if (folderTarget) return [folderTarget];

  const itemTarget = pointerCollisions.find(
    (collision) => !String(collision.id).startsWith(GROUP_TARGET_PREFIX)
  );
  if (itemTarget) return [itemTarget];

  const groupTarget = pointerCollisions.find((collision) =>
    String(collision.id).startsWith(GROUP_TARGET_PREFIX)
  );
  if (groupTarget) {
    const nearestItem = closestCenter(args).find((collision) => {
      const id = String(collision.id);
      return (
        id !== String(args.active.id) &&
        !id.startsWith(GROUP_TARGET_PREFIX) &&
        !id.startsWith(FOLDER_TARGET_PREFIX)
      );
    });
    return nearestItem ? [nearestItem] : [groupTarget];
  }
  return closestCenter(args);
};

type LaunchpadGroupListProps = {
  groupId: HomeAppGroupId;
  groupName: string;
  itemIds: string[];
  immersive: boolean;
  dragDisabled: boolean;
  children: React.ReactNode;
};

function LaunchpadGroupList({
  groupId,
  groupName,
  itemIds,
  immersive,
  dragDisabled,
  children,
}: LaunchpadGroupListProps) {
  const dropTarget = useDroppable({
    id: groupTargetId(groupId),
    data: { groupId, type: 'group-target' },
    disabled: dragDisabled,
  });

  return (
    <SortableContext items={itemIds} strategy={rectSortingStrategy}>
      <Box
        component="ul"
        ref={dropTarget.setNodeRef}
        data-launchpad-group-target={groupId}
        aria-label={groupName}
        sx={{
          '--launchpad-tile-width': immersive ? '100%' : `${LAUNCHPAD_TILE_WIDTH}px`,
          p: 0,
          pt: immersive ? `${LAUNCHPAD_GRID_TOP_INSET}px` : 0,
          mt: immersive ? 0.75 : { xs: 0.75, md: 0.5 },
          mb: 0,
          boxSizing: 'border-box',
          listStyle: 'none',
          display: immersive ? 'grid' : 'flex',
          gridTemplateColumns: immersive
            ? `repeat(${LAUNCHPAD_VISIBLE_COLUMNS}, minmax(0, 1fr))`
            : undefined,
          gridAutoRows: immersive ? `${LAUNCHPAD_TILE_HEIGHT}px` : undefined,
          flexWrap: immersive ? undefined : 'wrap',
          columnGap: 0,
          rowGap: `${LAUNCHPAD_ROW_GAP}px`,
          height: immersive ? `${LAUNCHPAD_GRID_HEIGHT}px` : 'auto',
          minHeight: immersive ? undefined : LAUNCHPAD_TILE_HEIGHT,
          alignContent: 'start',
          overflowX: immersive ? 'hidden' : 'visible',
          overflowY: immersive ? 'auto' : 'visible',
          overscrollBehavior: immersive ? 'contain' : 'auto',
          scrollbarGutter: immersive ? 'stable' : 'auto',
          scrollbarWidth: immersive ? 'thin' : 'auto',
          scrollbarColor: immersive ? 'rgba(255,255,255,0.38) transparent' : 'auto',
          outline: dropTarget.isOver ? '2px solid rgba(141,184,255,0.88)' : '2px solid transparent',
          outlineOffset: -2,
          borderRadius: 0.75,
          backgroundColor: dropTarget.isOver ? 'rgba(78,165,255,0.12)' : 'transparent',
          transition: (theme) =>
            theme.transitions.create(['background-color', 'outline-color'], {
              duration: theme.transitions.duration.shorter,
            }),
          '&::-webkit-scrollbar': immersive ? { width: 6 } : undefined,
          '&::-webkit-scrollbar-track': immersive ? { backgroundColor: 'transparent' } : undefined,
          '&::-webkit-scrollbar-thumb': immersive
            ? {
                borderRadius: 3,
                backgroundColor: 'rgba(255,255,255,0.34)',
              }
            : undefined,
          '&::-webkit-scrollbar-thumb:hover': immersive
            ? { backgroundColor: 'rgba(255,255,255,0.52)' }
            : undefined,
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }}
      >
        {children}
      </Box>
    </SortableContext>
  );
}

type SortableItemShellProps = {
  itemId: string;
  groupId: HomeAppGroupId;
  activeId: string | null;
  canReceiveApp: boolean;
  dragDisabled: boolean;
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
    // Keep targets registered before drag start so dnd-kit can measure them for pointer drops.
    disabled: dragDisabled || Boolean(activeId && (activeId === itemId || !canReceiveApp)),
    data: { groupId, itemId, type: 'folder-target' },
  });

  return (
    <Box
      component="li"
      ref={setNodeRef}
      data-launchpad-item={itemId}
      aria-label={label}
      sx={{
        position: 'relative',
        width: `var(--launchpad-tile-width, ${LAUNCHPAD_TILE_WIDTH}px)`,
        minWidth: `var(--launchpad-tile-width, ${LAUNCHPAD_TILE_WIDTH}px)`,
        height: LAUNCHPAD_TILE_HEIGHT,
        opacity: isDragging ? 0.28 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : 1,
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
  editing: boolean;
  motionDelayMs: number;
  activeId: string | null;
  activeIsApp: boolean;
  dragDisabled: boolean;
  suppressLaunch: React.MutableRefObject<boolean>;
  onLaunch: (app: HomeAppDefinition) => void;
  onRemove: (appId: string) => void;
};

function AppTile({
  app,
  groupId,
  editing,
  motionDelayMs,
  activeId,
  activeIsApp,
  dragDisabled,
  suppressLaunch,
  onLaunch,
  onRemove,
}: AppTileProps) {
  const { t } = useTranslation('home');

  return (
    <SortableItemShell
      itemId={app.id}
      groupId={groupId}
      activeId={activeId}
      canReceiveApp={activeIsApp}
      dragDisabled={dragDisabled}
      label={app.name}
    >
      {({ targetRef, targetActive, activatorRef, activatorAttributes, activatorListeners }) => (
        <>
          <ButtonBase
            ref={activatorRef}
            {...(editing ? activatorAttributes : {})}
            {...(activatorListeners as React.DOMAttributes<HTMLButtonElement>)}
            onKeyDown={
              editing
                ? (activatorListeners?.onKeyDown as
                    | React.KeyboardEventHandler<HTMLButtonElement>
                    | undefined)
                : undefined
            }
            onContextMenu={(event) => event.preventDefault()}
            data-launchpad-tile
            aria-label={
              editing
                ? t('launchpad.dragApp', { app: app.name })
                : t('launchpad.openApp', { app: app.name })
            }
            onClick={() => {
              if (!editing && !suppressLaunch.current) onLaunch(app);
            }}
            sx={launchpadTileSx(editing, motionDelayMs)}
          >
            <Box
              ref={targetRef}
              data-folder-target={app.id}
              data-launchpad-glyph
              sx={{ position: 'relative', borderRadius: 1 }}
            >
              <AppGlyph app={app} />
              {app.badge && !editing && (
                <Box
                  component="span"
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
              {targetActive && (
                <Box
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    inset: -7,
                    border: 2,
                    borderColor: 'primary.main',
                    borderRadius: 1,
                    bgcolor: 'action.selected',
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
                height: 28,
                fontSize: launchpadLabelFontSize(app.shortName),
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.2,
                wordBreak: 'normal',
                overflowWrap: 'normal',
              }}
            >
              {app.shortName}
            </Typography>
          </ButtonBase>
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
                sx={{
                  position: 'absolute',
                  top: -7,
                  right: 0,
                  zIndex: 4,
                  width: 22,
                  height: 22,
                  p: 0,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  bgcolor: 'grey.800',
                  border: 1,
                  borderColor: 'rgba(255,255,255,0.82)',
                  color: 'common.white',
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(2,6,23,0.28)',
                  '&:hover': { bgcolor: 'error.main' },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.light',
                    outlineOffset: 2,
                  },
                }}
              >
                <X size={13} strokeWidth={2.4} aria-hidden="true" />
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
  suppressLaunch: React.MutableRefObject<boolean>;
  onOpen: (folderId: string) => void;
  onRemove: (folderId: string) => void;
};

function FolderTile({
  folder,
  apps,
  editing,
  motionDelayMs,
  activeId,
  activeIsApp,
  dragDisabled,
  suppressLaunch,
  onOpen,
  onRemove,
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
      label={folder.name}
    >
      {({ targetRef, targetActive, activatorRef, activatorAttributes, activatorListeners }) => (
        <>
          <ButtonBase
            ref={activatorRef}
            {...(editing ? activatorAttributes : {})}
            {...(activatorListeners as React.DOMAttributes<HTMLButtonElement>)}
            onKeyDown={
              editing
                ? (activatorListeners?.onKeyDown as
                    | React.KeyboardEventHandler<HTMLButtonElement>
                    | undefined)
                : undefined
            }
            onContextMenu={(event) => event.preventDefault()}
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
              data-launchpad-glyph
              sx={{
                width: 52,
                height: 52,
                p: 0.5,
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 0.5,
                border: targetActive ? 2 : 1,
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
            <Typography
              component="span"
              variant="caption"
              fontWeight={700}
              sx={{
                width: 1,
                height: 28,
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.2,
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
                sx={{
                  position: 'absolute',
                  top: -7,
                  right: 0,
                  zIndex: 4,
                  width: 22,
                  height: 22,
                  p: 0,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  bgcolor: 'grey.800',
                  border: 1,
                  borderColor: 'rgba(255,255,255,0.82)',
                  color: 'common.white',
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(2,6,23,0.28)',
                  '&:hover': { bgcolor: 'error.main' },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.light',
                    outlineOffset: 2,
                  },
                }}
              >
                <X size={13} strokeWidth={2.4} aria-hidden="true" />
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
  onLaunch,
  onBrowseAll,
  onStartEditing,
  onLayoutChange,
  customizationBusy = false,
  immersive = false,
  title,
  description,
}: AppLaunchpadProps) {
  const { t } = useTranslation('home');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [keyboardDragging, setKeyboardDragging] = useState(false);
  const [pendingFolderCreation, setPendingFolderCreation] = useState<PendingFolderCreation>(null);
  const [folderPointerActionReady, setFolderPointerActionReady] = useState(false);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const suppressLaunch = useRef(false);
  const launchSuppressionTimer = useRef<number | null>(null);
  const folderPointerActionTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (folderPointerActionTimer.current !== null) {
        window.clearTimeout(folderPointerActionTimer.current);
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
  const resolvedDescription = description ?? t('launchpad.defaultDescription');
  const activeIsApp = Boolean(activeId && appById.has(activeId));
  const openFolder = openFolderId ? layout.folders[openFolderId] : undefined;

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: launchpadMouseActivationConstraint(editing),
    }),
    useSensor(TouchSensor, {
      activationConstraint: launchpadTouchActivationConstraint(editing),
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findGroupId = (itemId: string): HomeAppGroupId | null => {
    const group = localizedGroups.find((candidate) =>
      layout.groups[candidate.id]?.includes(itemId)
    );
    return group?.id ?? null;
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

  const prepareFolderCreation = (creation: NonNullable<PendingFolderCreation>, name: string) => {
    setFolderName(name);
    setFolderPointerActionReady(false);
    setPendingFolderCreation(creation);
    if (folderPointerActionTimer.current !== null) {
      window.clearTimeout(folderPointerActionTimer.current);
    }
    // dnd-kit retains a document click guard for 50ms after a pointer drag ends.
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
    if (!editing) onStartEditing();
    setActiveId(String(active.id));
    setKeyboardDragging(activatorEvent instanceof KeyboardEvent);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const draggedId = String(active.id);
    const overId = over ? String(over.id) : null;
    const sourceGroupId = findGroupId(draggedId);
    setActiveId(null);
    setKeyboardDragging(false);
    releaseLaunchSuppression();
    if (!overId || !sourceGroupId) return;

    const folderTarget = targetItemId(overId);
    if (overId === draggedId || folderTarget === draggedId) return;

    const directTargetGroupId = groupIdFromTarget(overId);
    if (directTargetGroupId) {
      onLayoutChange(
        moveLaunchpadItemToGroup(layout, sourceGroupId, directTargetGroupId, draggedId)
      );
      return;
    }

    if (folderTarget) {
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

    const directTargetApp = appById.get(overId);
    if (!keyboardDragging && draggedId !== overId && appById.has(draggedId) && directTargetApp) {
      const targetGroupId = findGroupId(overId);
      if (!targetGroupId) return;
      const groupName = groupById.get(targetGroupId)?.name ?? t('launchpad.fallbackApp');
      prepareFolderCreation(
        {
          groupId: targetGroupId,
          firstAppId: draggedId,
          secondAppId: overId,
          folderId: `folder-${crypto.randomUUID()}`,
        },
        t('launchpad.groupFolder', { group: groupName })
      );
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
      component="section"
      aria-labelledby="assigned-apps-heading"
      data-launchpad-surface={immersive ? 'immersive' : 'page'}
      data-launchpad-editing={editing ? 'true' : 'false'}
      sx={
        immersive
          ? {
              width: 1,
              color: '#FFFFFF',
              '& [data-launchpad-tile]:hover': {
                bgcolor: 'rgba(255,255,255,0.12)',
                borderColor: 'rgba(255,255,255,0.28)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 12px 28px rgba(0,7,24,0.24)',
              },
              '& [data-launchpad-tile]:focus-visible': {
                borderColor: '#8DB8FF',
                boxShadow: '0 0 0 2px rgba(141,184,255,0.34), 0 12px 28px rgba(0,7,24,0.24)',
              },
            }
          : {
              mt: { xs: 2, md: 1.5 },
              mx: { xs: -2, md: -3, xl: -4 },
              borderTop: 1,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }
      }
    >
      <Box
        sx={{
          width: immersive ? 'calc(100% - 32px)' : 1,
          maxWidth: immersive ? 1540 : 'none',
          minHeight: immersive ? 76 : { xs: 64, md: 56 },
          mx: immersive ? 'auto' : 0,
          mb: immersive ? 2 : 0,
          px: { xs: 2, md: 3, xl: 4 },
          py: immersive ? 1.5 : { xs: 1.25, md: 1 },
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          border: immersive ? '1px solid rgba(255,255,255,0.16)' : 0,
          borderBottom: 1,
          borderColor: immersive ? 'rgba(255,255,255,0.16)' : 'divider',
          borderRadius: immersive ? 1 : 0,
          position: 'relative',
          overflow: 'hidden',
          bgcolor: immersive ? 'rgba(9,18,38,0.52)' : 'transparent',
          backgroundImage: immersive
            ? 'linear-gradient(135deg, rgba(255,255,255,0.13), rgba(255,255,255,0.035) 48%, rgba(112,186,255,0.08))'
            : 'none',
          backdropFilter: immersive ? 'blur(24px) saturate(155%)' : 'none',
          WebkitBackdropFilter: immersive ? 'blur(24px) saturate(155%)' : 'none',
          boxShadow: immersive
            ? 'inset 0 1px 0 rgba(255,255,255,0.24), 0 18px 50px rgba(0,7,24,0.18)'
            : 'none',
          '@media (prefers-reduced-transparency: reduce), (forced-colors: active)': immersive
            ? {
                bgcolor: '#15233B',
                backgroundImage: 'none',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              }
            : undefined,
        }}
      >
        <Box sx={{ minWidth: 0, mr: 'auto' }}>
          <Typography id="assigned-apps-heading" component={immersive ? 'h1' : 'h2'} variant="h6">
            {resolvedTitle}
          </Typography>
          <Typography
            variant="caption"
            color={immersive ? 'rgba(255,255,255,0.72)' : 'text.secondary'}
          >
            {resolvedDescription}
          </Typography>
        </Box>
        <Chip
          label={t('launchpad.assignedCount', { count: apps.length })}
          size="small"
          variant="outlined"
          sx={immersive ? { color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.34)' } : undefined}
        />
        {editing ? (
          <Chip
            label={t('editor.editing')}
            size="small"
            sx={immersive ? { color: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.14)' } : undefined}
          />
        ) : (
          <>
            <Button
              variant="text"
              startIcon={<AppWindow size={17} strokeWidth={1.8} />}
              onClick={onBrowseAll}
              sx={immersive ? { color: '#FFFFFF' } : undefined}
            >
              {t('launchpad.allApps')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Settings2 size={17} strokeWidth={1.8} />}
              onClick={onStartEditing}
              disabled={customizationBusy}
              sx={
                immersive
                  ? {
                      color: '#FFFFFF',
                      borderColor: 'rgba(255,255,255,0.48)',
                      '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.10)' },
                    }
                  : undefined
              }
            >
              {t('launchpad.editHome')}
            </Button>
          </>
        )}
      </Box>

      <DndContext
        sensors={sensors}
        collisionDetection={launchpadCollisionDetection}
        onDragStart={handleDragStart}
        onDragCancel={() => {
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
        <Box
          sx={{
            width: 1,
            maxWidth: immersive ? 1540 : 'none',
            mx: 'auto',
            px: { xs: 2, md: 3, xl: 4 },
            display: 'grid',
            gridTemplateColumns: {
              xs: immersive ? 'repeat(4, minmax(270px, 82vw))' : 'minmax(0, 1fr)',
              md: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))',
            },
            gap: immersive ? 1.5 : 0,
            pb: immersive ? 4 : 0,
            overflowX: immersive ? { xs: 'auto', md: 'visible' } : 'visible',
            scrollSnapType: immersive ? { xs: 'x mandatory', md: 'none' } : 'none',
            scrollbarWidth: 'thin',
          }}
        >
          {localizedGroups.map((group, groupIndex) => {
            const itemIds = layout.groups[group.id] ?? [];
            if (itemIds.length === 0 && !editing) return null;
            return (
              <Box
                component="section"
                aria-labelledby={`app-group-${group.id}`}
                key={group.id}
                sx={{
                  minWidth: 0,
                  minHeight: immersive ? LAUNCHPAD_GROUP_MIN_HEIGHT : 'auto',
                  px: immersive ? 1 : { xs: 0, md: 2 },
                  py: immersive ? 1.5 : { xs: 2, md: 1.5 },
                  borderLeft: {
                    xs: 0,
                    md: immersive ? 0 : groupIndex % 2 === 0 ? 0 : 1,
                    lg: immersive ? 0 : groupIndex === 0 ? 0 : 1,
                  },
                  borderTop: {
                    xs: groupIndex === 0 ? 0 : 1,
                    md: immersive ? 0 : groupIndex < 2 ? 0 : 1,
                    lg: 0,
                  },
                  border: immersive ? '1px solid rgba(255,255,255,0.16)' : undefined,
                  borderColor: immersive ? 'rgba(255,255,255,0.16)' : 'divider',
                  borderRadius: immersive ? 1 : 0,
                  position: 'relative',
                  overflow: 'hidden',
                  bgcolor: immersive ? 'rgba(9,18,38,0.54)' : 'transparent',
                  backgroundImage: immersive
                    ? 'linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.035) 50%, rgba(78,165,255,0.08))'
                    : 'none',
                  backdropFilter: immersive ? 'blur(24px) saturate(155%)' : 'none',
                  WebkitBackdropFilter: immersive ? 'blur(24px) saturate(155%)' : 'none',
                  boxShadow: immersive
                    ? 'inset 0 1px 0 rgba(255,255,255,0.22), 0 22px 54px rgba(0,7,24,0.24)'
                    : 'none',
                  transition: (theme) =>
                    theme.transitions.create(['background-color', 'border-color', 'transform']),
                  '&:hover': immersive
                    ? {
                        bgcolor: 'rgba(15,29,56,0.64)',
                        borderColor: 'rgba(255,255,255,0.28)',
                        transform: 'translateY(-2px)',
                      }
                    : undefined,
                  '@media (prefers-reduced-motion: reduce)': {
                    transition: 'none',
                    transform: 'none',
                  },
                  '@media (prefers-reduced-transparency: reduce), (forced-colors: active)':
                    immersive
                      ? {
                          bgcolor: '#15233B',
                          backgroundImage: 'none',
                          backdropFilter: 'none',
                          WebkitBackdropFilter: 'none',
                        }
                      : undefined,
                  scrollSnapAlign: immersive ? 'center' : 'none',
                }}
              >
                <Typography
                  id={`app-group-${group.id}`}
                  component={immersive ? 'h2' : 'h3'}
                  variant="subtitle2"
                >
                  {group.name}
                </Typography>
                <Typography
                  variant="caption"
                  color={immersive ? 'rgba(255,255,255,0.68)' : 'text.secondary'}
                  sx={{
                    display: 'block',
                    minHeight: immersive ? 30 : { xs: 30, md: 24 },
                    mt: 0.25,
                  }}
                >
                  {group.description}
                </Typography>
                <LaunchpadGroupList
                  groupId={group.id}
                  groupName={t('launchpad.groupApps', { group: group.name })}
                  itemIds={itemIds}
                  immersive={Boolean(immersive)}
                  dragDisabled={Boolean(customizationBusy)}
                >
                  {itemIds.map((itemId, itemIndex) => {
                    const folder = layout.folders[itemId];
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
                          dragDisabled={customizationBusy}
                          suppressLaunch={suppressLaunch}
                          onOpen={setOpenFolderId}
                          onRemove={(folderId) =>
                            onLayoutChange(ungroupLaunchpadFolder(layout, folderId))
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
                        editing={editing}
                        motionDelayMs={(itemIndex % 4) * -55}
                        activeId={activeId}
                        activeIsApp={activeIsApp && !keyboardDragging}
                        dragDisabled={customizationBusy}
                        suppressLaunch={suppressLaunch}
                        onLaunch={onLaunch}
                        onRemove={(appId) => onLayoutChange(hideLaunchpadApp(layout, appId))}
                      />
                    ) : null;
                  })}
                </LaunchpadGroupList>
              </Box>
            );
          })}
        </Box>

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

      <Dialog
        open={Boolean(openFolder)}
        onClose={() => setOpenFolderId(null)}
        fullWidth
        maxWidth="xs"
      >
        {openFolder && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Folder size={20} strokeWidth={1.8} />
              <Box component="span" sx={{ flex: 1 }}>
                {openFolder.name}
              </Box>
              {editing && (
                <Tooltip title={t('launchpad.folder.rename')}>
                  <IconButton
                    aria-label={t('launchpad.folder.renameLabel', { folder: openFolder.name })}
                    onClick={() => openRenameDialog(openFolder)}
                  >
                    <Pencil size={17} />
                  </IconButton>
                </Tooltip>
              )}
            </DialogTitle>
            <DialogContent dividers>
              <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
                {openFolder.appIds.map((appId) => {
                  const app = appById.get(appId);
                  if (!app) return null;
                  return (
                    <Box
                      component="li"
                      key={app.id}
                      sx={{
                        minHeight: 64,
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                        alignItems: 'center',
                        borderTop: 1,
                        borderColor: 'divider',
                        '&:first-of-type': { borderTop: 0 },
                      }}
                    >
                      <ButtonBase
                        aria-label={t('launchpad.openApp', { app: app.name })}
                        onClick={() => {
                          if (!editing) onLaunch(app);
                        }}
                        sx={{
                          minWidth: 0,
                          minHeight: 64,
                          px: 1,
                          display: 'grid',
                          gridTemplateColumns: '40px minmax(0, 1fr)',
                          gap: 1.5,
                          textAlign: 'left',
                        }}
                      >
                        <AppGlyph app={app} size={40} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography component="span" variant="subtitle2">
                            {app.name}
                          </Typography>
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block' }}
                          >
                            {app.description}
                          </Typography>
                        </Box>
                      </ButtonBase>
                      {editing && (
                        <Tooltip title={t('launchpad.removeApp')}>
                          <IconButton
                            aria-label={t('launchpad.removeAppLabel', { app: app.name })}
                            color="error"
                            onClick={() => {
                              onLayoutChange(hideLaunchpadApp(layout, app.id));
                              if (openFolder.appIds.length <= 2) setOpenFolderId(null);
                            }}
                          >
                            <X size={17} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenFolderId(null)}>
                {t('actions.close', { ns: 'common' })}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

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
