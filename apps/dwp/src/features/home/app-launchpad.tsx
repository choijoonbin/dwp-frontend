import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import {
  AppWindow,
  ArrowLeft,
  ArrowRight,
  Check,
  Folder,
  FolderPlus,
  MoreVertical,
  Pencil,
  RotateCcw,
  Settings2,
} from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ListItemIcon from '@mui/material/ListItemIcon';

import {
  HOME_APP_GROUPS,
  addAppToLaunchpadFolder,
  createLaunchpadFolder,
  moveLaunchpadItem,
  moveLaunchpadItemByOffset,
  localizeHomeAppGroups,
  reconcileLaunchpadLayout,
  removeAppFromLaunchpadFolder,
  renameLaunchpadFolder,
  ungroupLaunchpadFolder,
} from './app-launchpad-model';
import { AppGlyph } from './app-glyph';

import type { DragEndEvent, DragStartEvent, CollisionDetection } from '@dnd-kit/core';
import type {
  HomeAppDefinition,
  HomeAppGroupId,
  LaunchpadFolder,
  LaunchpadLayout,
} from './app-launchpad-model';

const FOLDER_TARGET_PREFIX = 'folder-target::';

type AppLaunchpadProps = {
  apps: readonly HomeAppDefinition[];
  storageKey: string;
  initialLayout?: unknown;
  onLaunch: (app: HomeAppDefinition) => void;
  onBrowseAll: () => void;
  onEditHome?: () => void;
  onLayoutCommit?: (layout: LaunchpadLayout) => void;
  customizationBusy?: boolean;
  immersive?: boolean;
  title?: string;
  description?: string;
};

type ItemMenuState = {
  anchor: HTMLElement;
  itemId: string;
  groupId: HomeAppGroupId;
} | null;

function readStoredLayout(storageKey: string, apps: readonly HomeAppDefinition[]): LaunchpadLayout {
  try {
    const value = window.localStorage.getItem(storageKey);
    return reconcileLaunchpadLayout(value ? JSON.parse(value) : null, apps);
  } catch {
    return reconcileLaunchpadLayout(null, apps);
  }
}

function folderTargetId(itemId: string): string {
  return `${FOLDER_TARGET_PREFIX}${itemId}`;
}

function targetItemId(droppableId: string): string | null {
  return droppableId.startsWith(FOLDER_TARGET_PREFIX)
    ? droppableId.slice(FOLDER_TARGET_PREFIX.length)
    : null;
}

const launchpadCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const folderTarget = pointerCollisions.find((collision) =>
    String(collision.id).startsWith(FOLDER_TARGET_PREFIX)
  );
  return folderTarget ? [folderTarget] : closestCenter(args);
};

type SortableItemShellProps = {
  itemId: string;
  groupId: HomeAppGroupId;
  customizing: boolean;
  activeId: string | null;
  canReceiveApp: boolean;
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
  customizing,
  activeId,
  canReceiveApp,
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
  } = useSortable({ id: itemId, data: { groupId } });
  const target = useDroppable({
    id: folderTargetId(itemId),
    disabled: !activeId || activeId === itemId || !canReceiveApp,
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
        width: { xs: 84, sm: 98 },
        minWidth: { xs: 84, sm: 98 },
        minHeight: { xs: 108, sm: 118 },
        opacity: isDragging ? 0.28 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : 1,
        '&:hover [data-item-menu], &:focus-within [data-item-menu]': { opacity: 1 },
      }}
    >
      {children({
        targetRef: target.setNodeRef,
        targetActive: target.isOver,
        activatorRef: setActivatorNodeRef,
        activatorAttributes: attributes,
        activatorListeners: listeners,
      })}
      {customizing && (
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            inset: -4,
            border: 1,
            borderColor: 'primary.main',
            borderRadius: 1,
            pointerEvents: 'none',
          }}
        />
      )}
    </Box>
  );
}

type AppTileProps = {
  app: HomeAppDefinition;
  groupId: HomeAppGroupId;
  customizing: boolean;
  activeId: string | null;
  activeIsApp: boolean;
  suppressLaunch: React.MutableRefObject<boolean>;
  onLaunch: (app: HomeAppDefinition) => void;
  onMenu: (event: React.MouseEvent<HTMLElement>, itemId: string, groupId: HomeAppGroupId) => void;
};

function AppTile({
  app,
  groupId,
  customizing,
  activeId,
  activeIsApp,
  suppressLaunch,
  onLaunch,
  onMenu,
}: AppTileProps) {
  const { t } = useTranslation('home');

  return (
    <SortableItemShell
      itemId={app.id}
      groupId={groupId}
      customizing={customizing}
      activeId={activeId}
      canReceiveApp={activeIsApp}
      label={app.name}
    >
      {({ targetRef, targetActive, activatorRef, activatorAttributes, activatorListeners }) => (
        <>
          <ButtonBase
            ref={activatorRef}
            {...activatorAttributes}
            {...activatorListeners}
            aria-label={t('launchpad.openApp', { app: app.name })}
            onClick={() => {
              if (!suppressLaunch.current) onLaunch(app);
            }}
            sx={{
              width: 1,
              minHeight: { xs: 108, sm: 118 },
              px: 0.75,
              py: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              gap: 1,
              borderRadius: 1,
              textAlign: 'center',
              cursor: customizing ? 'grab' : 'pointer',
              touchAction: 'manipulation',
              transition: (theme) =>
                theme.transitions.create(['background-color', 'transform', 'box-shadow']),
              '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-2px)' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
            }}
          >
            <Box
              ref={targetRef}
              data-folder-target={app.id}
              sx={{ position: 'relative', borderRadius: 1 }}
            >
              <AppGlyph app={app} />
              {app.badge && (
                <Box
                  component="span"
                  sx={{
                    position: 'absolute',
                    top: -6,
                    right: -8,
                    minWidth: 22,
                    height: 22,
                    px: 0.5,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 11,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    color: 'text.primary',
                    fontSize: 10,
                    fontWeight: 800,
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
                minHeight: 34,
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.35,
              }}
            >
              {app.name}
            </Typography>
          </ButtonBase>
          <Tooltip title={t('launchpad.arrangeApp', { app: app.name })}>
            <IconButton
              data-item-menu
              size="small"
              aria-label={t('launchpad.arrangeApp', { app: app.name })}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => onMenu(event, app.id, groupId)}
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 30,
                height: 30,
                opacity: customizing ? 1 : 0,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                boxShadow: '0 3px 8px rgba(15,23,42,0.12)',
                transition: (theme) => theme.transitions.create('opacity'),
                '&:hover': { bgcolor: 'background.paper' },
              }}
            >
              <MoreVertical size={16} strokeWidth={1.9} />
            </IconButton>
          </Tooltip>
        </>
      )}
    </SortableItemShell>
  );
}

type FolderTileProps = {
  folder: LaunchpadFolder;
  apps: readonly HomeAppDefinition[];
  customizing: boolean;
  activeId: string | null;
  activeIsApp: boolean;
  suppressLaunch: React.MutableRefObject<boolean>;
  onOpen: (folderId: string) => void;
  onMenu: (event: React.MouseEvent<HTMLElement>, itemId: string, groupId: HomeAppGroupId) => void;
};

function FolderTile({
  folder,
  apps,
  customizing,
  activeId,
  activeIsApp,
  suppressLaunch,
  onOpen,
  onMenu,
}: FolderTileProps) {
  const { t } = useTranslation('home');
  const folderApps = folder.appIds
    .map((appId) => apps.find((app) => app.id === appId))
    .filter((app): app is HomeAppDefinition => Boolean(app));

  return (
    <SortableItemShell
      itemId={folder.id}
      groupId={folder.groupId}
      customizing={customizing}
      activeId={activeId}
      canReceiveApp={activeIsApp}
      label={folder.name}
    >
      {({ targetRef, targetActive, activatorRef, activatorAttributes, activatorListeners }) => (
        <>
          <ButtonBase
            ref={activatorRef}
            {...activatorAttributes}
            {...activatorListeners}
            aria-label={t('launchpad.openFolder', { folder: folder.name })}
            onClick={() => {
              if (!suppressLaunch.current) onOpen(folder.id);
            }}
            sx={{
              width: 1,
              minHeight: { xs: 108, sm: 118 },
              px: 0.75,
              py: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              gap: 1,
              borderRadius: 1,
              cursor: customizing ? 'grab' : 'pointer',
              touchAction: 'manipulation',
              transition: (theme) => theme.transitions.create(['background-color', 'transform']),
              '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-2px)' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
            }}
          >
            <Box
              ref={targetRef}
              data-folder-target={folder.id}
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
                minHeight: 34,
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.35,
              }}
            >
              {folder.name}
            </Typography>
          </ButtonBase>
          <Tooltip title={t('launchpad.arrangeFolder', { folder: folder.name })}>
            <IconButton
              data-item-menu
              size="small"
              aria-label={t('launchpad.arrangeFolder', { folder: folder.name })}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => onMenu(event, folder.id, folder.groupId)}
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 30,
                height: 30,
                opacity: customizing ? 1 : 0,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                boxShadow: '0 3px 8px rgba(15,23,42,0.12)',
                transition: (theme) => theme.transitions.create('opacity'),
                '&:hover': { bgcolor: 'background.paper' },
              }}
            >
              <MoreVertical size={16} strokeWidth={1.9} />
            </IconButton>
          </Tooltip>
        </>
      )}
    </SortableItemShell>
  );
}

export function AppLaunchpad({
  apps,
  storageKey,
  initialLayout,
  onLaunch,
  onBrowseAll,
  onEditHome,
  onLayoutCommit,
  customizationBusy = false,
  immersive = false,
  title,
  description,
}: AppLaunchpadProps) {
  const { t } = useTranslation('home');
  const [layout, setLayout] = useState(() =>
    reconcileLaunchpadLayout(
      initialLayout !== undefined ? initialLayout : readStoredLayout(storageKey, apps),
      apps
    )
  );
  const [customizing, setCustomizing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [keyboardDragging, setKeyboardDragging] = useState(false);
  const [itemMenu, setItemMenu] = useState<ItemMenuState>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderPartnerAppId, setFolderPartnerAppId] = useState<string | null>(null);
  const suppressLaunch = useRef(false);
  const appSignature = apps.map((app) => app.id).join('|');

  const appById = useMemo(() => new Map(apps.map((app) => [app.id, app])), [apps]);
  const localizedGroups = useMemo(() => localizeHomeAppGroups(t), [t]);
  const groupById = useMemo(
    () => new Map(localizedGroups.map((group) => [group.id, group])),
    [localizedGroups]
  );
  const resolvedTitle = title ?? t('launchpad.defaultTitle');
  const resolvedDescription = description ?? t('launchpad.defaultDescription');
  const activeIsApp = Boolean(activeId && appById.has(activeId));
  const openFolder = openFolderId ? layout.folders[openFolderId] : undefined;
  const menuFolder = itemMenu ? layout.folders[itemMenu.itemId] : undefined;
  const menuApp = itemMenu ? appById.get(itemMenu.itemId) : undefined;
  const menuItems = itemMenu ? layout.groups[itemMenu.groupId] : [];
  const menuItemIndex = itemMenu ? menuItems.indexOf(itemMenu.itemId) : -1;
  const siblingApps = itemMenu
    ? layout.groups[itemMenu.groupId]
        .filter((itemId) => itemId !== itemMenu.itemId)
        .map((itemId) => appById.get(itemId))
        .filter((app): app is HomeAppDefinition => Boolean(app))
    : [];
  const siblingFolders = itemMenu
    ? Object.values(layout.folders).filter((folder) => folder.groupId === itemMenu.groupId)
    : [];

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 420, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setLayout((current) => reconcileLaunchpadLayout(current, apps));
  }, [appSignature, apps]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch {
      // The reference layout remains usable in memory when browser storage is unavailable.
    }
  }, [layout, storageKey]);

  const findGroupId = (itemId: string): HomeAppGroupId | null => {
    const group = HOME_APP_GROUPS.find((candidate) => layout.groups[candidate.id].includes(itemId));
    return group?.id ?? null;
  };

  const itemName = (itemId: string): string =>
    appById.get(itemId)?.name ?? layout.folders[itemId]?.name ?? t('launchpad.fallbackApp');

  const dropTargetName = (droppableId: string): string => {
    const folderTarget = targetItemId(droppableId);
    return itemName(folderTarget ?? droppableId);
  };

  const releaseLaunchSuppression = () => {
    suppressLaunch.current = true;
    window.setTimeout(() => {
      suppressLaunch.current = false;
    }, 0);
  };

  const handleDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    setActiveId(String(active.id));
    setKeyboardDragging(activatorEvent instanceof KeyboardEvent);
    setCustomizing(true);
  };

  const toggleCustomization = () => {
    if (customizing) onLayoutCommit?.(layout);
    setCustomizing((current) => !current);
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
    if (folderTarget) {
      const targetFolder = layout.folders[folderTarget];
      if (appById.has(draggedId) && targetFolder?.groupId === sourceGroupId) {
        setLayout((current) => addAppToLaunchpadFolder(current, draggedId, folderTarget));
        return;
      }

      const targetApp = appById.get(folderTarget);
      if (appById.has(draggedId) && targetApp?.groupId === sourceGroupId) {
        const groupName = groupById.get(sourceGroupId)?.name ?? t('launchpad.fallbackApp');
        setLayout((current) =>
          createLaunchpadFolder(
            current,
            sourceGroupId,
            draggedId,
            folderTarget,
            `folder-${crypto.randomUUID()}`,
            t('launchpad.groupFolder', { group: groupName })
          )
        );
        return;
      }

      if (layout.groups[sourceGroupId].includes(folderTarget)) {
        setLayout((current) => moveLaunchpadItem(current, sourceGroupId, draggedId, folderTarget));
      }
      return;
    }

    const targetGroupId = findGroupId(overId);
    if (targetGroupId === sourceGroupId) {
      setLayout((current) => moveLaunchpadItem(current, sourceGroupId, draggedId, overId));
    }
  };

  const handleCreateFolder = () => {
    if (!itemMenu || !menuApp || !folderPartnerAppId) return;
    const groupName = groupById.get(itemMenu.groupId)?.name ?? t('launchpad.fallbackApp');
    setLayout((current) =>
      createLaunchpadFolder(
        current,
        itemMenu.groupId,
        menuApp.id,
        folderPartnerAppId,
        `folder-${crypto.randomUUID()}`,
        t('launchpad.groupFolder', { group: groupName })
      )
    );
    setFolderPartnerAppId(null);
    setItemMenu(null);
  };

  const openRenameDialog = (folder: LaunchpadFolder) => {
    setFolderName(folder.name);
    setRenameFolderId(folder.id);
    setOpenFolderId(null);
    setItemMenu(null);
  };

  const handleRenameFolder = () => {
    if (!renameFolderId) return;
    setLayout((current) => renameLaunchpadFolder(current, renameFolderId, folderName));
    setRenameFolderId(null);
  };

  return (
    <Box
      component="section"
      aria-labelledby="assigned-apps-heading"
      data-launchpad-surface={immersive ? 'immersive' : 'page'}
      sx={
        immersive
          ? {
              width: 1,
              color: '#FFFFFF',
              '& [data-launchpad-item] > .MuiButtonBase-root:hover': {
                bgcolor: 'rgba(255,255,255,0.12)',
              },
              '& [data-launchpad-item] > .MuiButtonBase-root:focus-visible': {
                outlineColor: '#8DB8FF',
              },
            }
          : {
              mt: 3,
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
          minHeight: immersive ? 76 : 64,
          mx: immersive ? 'auto' : 0,
          mb: immersive ? 2 : 0,
          px: { xs: 2, md: 3, xl: 4 },
          py: immersive ? 1.5 : 1.25,
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
        {customizing && (
          <Tooltip title={t('launchpad.resetTooltip')}>
            <IconButton
              aria-label={t('launchpad.resetLabel')}
              onClick={() => setLayout(reconcileLaunchpadLayout(null, apps))}
              sx={immersive ? { color: '#FFFFFF' } : undefined}
            >
              <RotateCcw size={18} strokeWidth={1.8} />
            </IconButton>
          </Tooltip>
        )}
        <Button
          variant="text"
          startIcon={<AppWindow size={17} strokeWidth={1.8} />}
          onClick={onBrowseAll}
          sx={immersive ? { color: '#FFFFFF' } : undefined}
        >
          {t('launchpad.allApps')}
        </Button>
        {onEditHome && (
          <Button
            variant="text"
            startIcon={<Settings2 size={17} strokeWidth={1.8} />}
            onClick={onEditHome}
            sx={immersive ? { color: '#FFFFFF' } : undefined}
          >
            {t('launchpad.editHome')}
          </Button>
        )}
        <Button
          variant={customizing ? 'contained' : 'outlined'}
          startIcon={customizing ? <Check size={17} strokeWidth={1.9} /> : <Settings2 size={17} />}
          onClick={toggleCustomization}
          disabled={customizationBusy}
          sx={
            immersive && !customizing
              ? {
                  color: '#FFFFFF',
                  borderColor: 'rgba(255,255,255,0.48)',
                  '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.10)' },
                }
              : undefined
          }
        >
          {customizing ? t('launchpad.done') : t('launchpad.customize')}
        </Button>
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
            const itemIds = layout.groups[group.id];
            if (itemIds.length === 0) return null;
            return (
              <Box
                component="section"
                aria-labelledby={`app-group-${group.id}`}
                key={group.id}
                sx={{
                  minWidth: 0,
                  minHeight: immersive ? 238 : 'auto',
                  px: immersive ? 2 : { xs: 0, md: 2 },
                  py: immersive ? 2 : 2.5,
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
                  sx={{ display: 'block', minHeight: 32, mt: 0.25 }}
                >
                  {group.description}
                </Typography>
                <SortableContext items={itemIds} strategy={rectSortingStrategy}>
                  <Box
                    component="ul"
                    aria-label={t('launchpad.groupApps', { group: group.name })}
                    sx={{
                      p: 0,
                      mt: 1.25,
                      mb: 0,
                      listStyle: 'none',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 0.75,
                    }}
                  >
                    {itemIds.map((itemId) => {
                      const folder = layout.folders[itemId];
                      if (folder) {
                        return (
                          <FolderTile
                            key={folder.id}
                            folder={folder}
                            apps={apps}
                            customizing={customizing}
                            activeId={activeId}
                            activeIsApp={activeIsApp && !keyboardDragging}
                            suppressLaunch={suppressLaunch}
                            onOpen={setOpenFolderId}
                            onMenu={(event, id, groupId) =>
                              setItemMenu({ anchor: event.currentTarget, itemId: id, groupId })
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
                          customizing={customizing}
                          activeId={activeId}
                          activeIsApp={activeIsApp && !keyboardDragging}
                          suppressLaunch={suppressLaunch}
                          onLaunch={onLaunch}
                          onMenu={(event, id, groupId) =>
                            setItemMenu({ anchor: event.currentTarget, itemId: id, groupId })
                          }
                        />
                      ) : null;
                    })}
                  </Box>
                </SortableContext>
              </Box>
            );
          })}
        </Box>

        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <Box
              sx={{
                width: { xs: 84, sm: 98 },
                minHeight: 108,
                p: 1,
                display: 'grid',
                placeItems: 'center',
                border: 1,
                borderColor: 'primary.main',
                borderRadius: 1,
                bgcolor: 'background.paper',
                boxShadow: '0 18px 40px rgba(15,23,42,0.22)',
              }}
            >
              {appById.has(activeId) ? (
                <>
                  <AppGlyph app={appById.get(activeId) as HomeAppDefinition} />
                  <Typography variant="caption" fontWeight={700} textAlign="center">
                    {appById.get(activeId)?.name}
                  </Typography>
                </>
              ) : (
                <>
                  <Folder size={34} strokeWidth={1.7} />
                  <Typography variant="caption" fontWeight={700} textAlign="center">
                    {layout.folders[activeId]?.name}
                  </Typography>
                </>
              )}
            </Box>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Menu
        anchorEl={itemMenu?.anchor ?? null}
        open={Boolean(itemMenu)}
        onClose={() => {
          setItemMenu(null);
          setFolderPartnerAppId(null);
        }}
      >
        <MenuItem
          disabled={menuItemIndex <= 0}
          onClick={() => {
            if (itemMenu) {
              setLayout((current) =>
                moveLaunchpadItemByOffset(current, itemMenu.groupId, itemMenu.itemId, -1)
              );
            }
            setItemMenu(null);
          }}
        >
          <ListItemIcon>
            <ArrowLeft size={17} />
          </ListItemIcon>
          {t('launchpad.menu.moveEarlier')}
        </MenuItem>
        <MenuItem
          disabled={menuItemIndex < 0 || menuItemIndex >= menuItems.length - 1}
          onClick={() => {
            if (itemMenu) {
              setLayout((current) =>
                moveLaunchpadItemByOffset(current, itemMenu.groupId, itemMenu.itemId, 1)
              );
            }
            setItemMenu(null);
          }}
        >
          <ListItemIcon>
            <ArrowRight size={17} />
          </ListItemIcon>
          {t('launchpad.menu.moveLater')}
        </MenuItem>
        {menuApp && siblingApps.length > 0 && (
          <MenuItem
            onClick={() => setFolderPartnerAppId(siblingApps[0]?.id ?? null)}
            selected={Boolean(folderPartnerAppId)}
          >
            <ListItemIcon>
              <FolderPlus size={17} />
            </ListItemIcon>
            {t('launchpad.menu.createFolder')}
          </MenuItem>
        )}
        {folderPartnerAppId &&
          siblingApps.map((app) => (
            <MenuItem
              key={app.id}
              selected={folderPartnerAppId === app.id}
              onClick={() => setFolderPartnerAppId(app.id)}
              sx={{ pl: 4.5 }}
            >
              {t('launchpad.menu.withApp', { app: app.name })}
            </MenuItem>
          ))}
        {folderPartnerAppId && (
          <MenuItem onClick={handleCreateFolder} sx={{ fontWeight: 700 }}>
            <ListItemIcon>
              <Check size={17} />
            </ListItemIcon>
            {t('launchpad.menu.createSelectedFolder')}
          </MenuItem>
        )}
        {menuApp &&
          siblingFolders.map((folder) => (
            <MenuItem
              key={folder.id}
              onClick={() => {
                setLayout((current) => addAppToLaunchpadFolder(current, menuApp.id, folder.id));
                setItemMenu(null);
              }}
            >
              <ListItemIcon>
                <Folder size={17} />
              </ListItemIcon>
              {t('launchpad.menu.addToFolder', { folder: folder.name })}
            </MenuItem>
          ))}
        {menuFolder && (
          <MenuItem onClick={() => openRenameDialog(menuFolder)}>
            <ListItemIcon>
              <Pencil size={17} />
            </ListItemIcon>
            {t('launchpad.menu.renameFolder')}
          </MenuItem>
        )}
        {menuFolder && (
          <MenuItem
            onClick={() => {
              setLayout((current) => ungroupLaunchpadFolder(current, menuFolder.id));
              setItemMenu(null);
            }}
          >
            <ListItemIcon>
              <Folder size={17} />
            </ListItemIcon>
            {t('launchpad.menu.ungroup')}
          </MenuItem>
        )}
      </Menu>

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
              {customizing && (
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
                        onClick={() => onLaunch(app)}
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
                      {customizing && (
                        <Tooltip title={t('launchpad.folder.moveOut')}>
                          <IconButton
                            aria-label={t('launchpad.folder.moveOutLabel', {
                              app: app.name,
                              folder: openFolder.name,
                            })}
                            onClick={() => {
                              setLayout((current) =>
                                removeAppFromLaunchpadFolder(current, openFolder.id, app.id)
                              );
                              if (openFolder.appIds.length <= 2) setOpenFolderId(null);
                            }}
                          >
                            <ArrowRight size={17} />
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
