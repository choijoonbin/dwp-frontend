import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  EyeOff,
  FolderInput,
  FolderPlus,
  Minus,
  Pencil,
} from 'lucide-react';
import { ActionButton, ContentDialog } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';

import {
  addAppToLaunchpadFolder,
  hideLaunchpadApp,
  moveLaunchpadItem,
  moveLaunchpadItemToGroup,
  ungroupLaunchpadFolder,
} from '../../components/workspace-composer/app-launchpad-model';
import { AppGlyph } from './app-glyph';

import type {
  HomeAppDefinition,
  HomeAppGroup,
  HomeAppGroupId,
  LaunchpadFolder,
  LaunchpadLayout,
} from '../../components/workspace-composer/app-launchpad-model';

export type LaunchpadContextMenuAnchor = Readonly<{ top: number; left: number }>;

export type LaunchpadContextMenuRequest = {
  itemId: string;
  groupId: HomeAppGroupId;
  anchor: LaunchpadContextMenuAnchor;
} | null;

export function isLaunchpadContextMenuKeyboardEvent(event: React.KeyboardEvent): boolean {
  return event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey);
}

export type LaunchpadFolderCreationRequest = {
  groupId: HomeAppGroupId;
  firstAppId: string;
  secondAppId: string;
  folderId: string;
};

type AppLaunchpadContextMenuProps = {
  request: LaunchpadContextMenuRequest;
  apps: readonly HomeAppDefinition[];
  groups: readonly HomeAppGroup[];
  layout: LaunchpadLayout;
  busy: boolean;
  onClose: (restoreFocus?: boolean) => void;
  onApply: (layout: LaunchpadLayout, restoreFocus?: boolean) => void;
  onRenameFolder: (folder: LaunchpadFolder) => void;
  onPrepareFolderCreation: (request: LaunchpadFolderCreationRequest, name: string) => void;
};

export function AppLaunchpadContextMenu({
  request,
  apps,
  groups,
  layout,
  busy,
  onClose,
  onApply,
  onRenameFolder,
  onPrepareFolderCreation,
}: AppLaunchpadContextMenuProps) {
  const { t } = useTranslation('home');
  const [folderPartnerAppId, setFolderPartnerAppId] = useState<string | null>(null);
  const appById = new Map(apps.map((app) => [app.id, app]));
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const findGroupId = (itemId: string): HomeAppGroupId | null =>
    groups.find((group) => layout.groups[group.id]?.includes(itemId))?.id ?? null;
  const itemName = (itemId: string): string =>
    appById.get(itemId)?.name ?? layout.folders[itemId]?.name ?? t('launchpad.fallbackApp');

  const itemId = request?.itemId ?? '';
  const folder = itemId ? layout.folders[itemId] : undefined;
  const app = itemId ? appById.get(itemId) : undefined;
  const groupItems = request ? (layout.groups[request.groupId] ?? []) : [];
  const itemIndex = groupItems.indexOf(itemId);
  const availableFolders = app
    ? Object.values(layout.folders).filter((candidate) => !candidate.appIds.includes(app.id))
    : [];
  const topLevelApps = apps.filter((candidate) =>
    Object.values(layout.groups).some((itemIds) => itemIds.includes(candidate.id))
  );
  const folderPartnerApp = folderPartnerAppId ? appById.get(folderPartnerAppId) : undefined;
  const folderPartnerCandidates = folderPartnerApp
    ? topLevelApps.filter((candidate) => candidate.id !== folderPartnerApp.id)
    : [];

  return (
    <>
      <Menu
        open={Boolean(request)}
        onClose={() => onClose()}
        anchorReference="anchorPosition"
        anchorPosition={request?.anchor}
        slotProps={{
          list: {
            'aria-label': t('launchpad.contextMenu.label', {
              item: itemId ? itemName(itemId) : '',
            }),
          },
          paper: { sx: { minWidth: 236, maxWidth: 336 } },
        }}
      >
        <MenuItem
          disabled={busy || itemIndex <= 0}
          onClick={() => {
            const previousId = groupItems[itemIndex - 1];
            if (!request || !previousId) return;
            onApply(moveLaunchpadItem(layout, request.groupId, request.itemId, previousId));
          }}
          sx={menuItemSx}
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {t('launchpad.contextMenu.moveEarlier')}
        </MenuItem>
        <MenuItem
          disabled={busy || itemIndex < 0 || itemIndex >= groupItems.length - 1}
          onClick={() => {
            const nextId = groupItems[itemIndex + 1];
            if (!request || !nextId) return;
            onApply(moveLaunchpadItem(layout, request.groupId, request.itemId, nextId));
          }}
          sx={menuItemSx}
        >
          <ArrowRight size={18} aria-hidden="true" />
          {t('launchpad.contextMenu.moveLater')}
        </MenuItem>

        {request && groups.length > 1 && <Divider />}
        {request &&
          groups
            .filter((group) => group.id !== request.groupId)
            .map((group) => (
              <MenuItem
                key={group.id}
                disabled={busy}
                onClick={() =>
                  onApply(
                    moveLaunchpadItemToGroup(layout, request.groupId, group.id, request.itemId)
                  )
                }
                sx={menuItemSx}
              >
                <FolderInput size={18} aria-hidden="true" />
                <EllipsizedLabel>
                  {t('launchpad.contextMenu.moveToGroup', { group: group.name })}
                </EllipsizedLabel>
              </MenuItem>
            ))}

        {app && <Divider />}
        {app && (
          <MenuItem
            disabled={busy || topLevelApps.length < 2}
            onClick={() => {
              setFolderPartnerAppId(app.id);
              onClose(false);
            }}
            sx={menuItemSx}
          >
            <FolderPlus size={18} aria-hidden="true" />
            {t('launchpad.contextMenu.createFolder')}
          </MenuItem>
        )}
        {app &&
          availableFolders.map((candidate) => (
            <MenuItem
              key={candidate.id}
              disabled={busy}
              onClick={() => onApply(addAppToLaunchpadFolder(layout, app.id, candidate.id), false)}
              sx={menuItemSx}
            >
              <FolderInput size={18} aria-hidden="true" />
              <EllipsizedLabel>
                {t('launchpad.contextMenu.moveToFolder', { folder: candidate.name })}
              </EllipsizedLabel>
            </MenuItem>
          ))}
        {app && <Divider />}
        {app && (
          <MenuItem
            disabled={busy}
            onClick={() => onApply(hideLaunchpadApp(layout, app.id), false)}
            sx={{ ...menuItemSx, color: 'error.main' }}
          >
            <EyeOff size={18} aria-hidden="true" />
            {t('launchpad.removeAppLabel', { app: app.name })}
          </MenuItem>
        )}

        {folder && <Divider />}
        {folder && (
          <MenuItem
            disabled={busy}
            onClick={() => {
              onClose(false);
              onRenameFolder(folder);
            }}
            sx={menuItemSx}
          >
            <Pencil size={18} aria-hidden="true" />
            {t('launchpad.folder.rename')}
          </MenuItem>
        )}
        {folder && (
          <MenuItem
            disabled={busy}
            onClick={() => onApply(ungroupLaunchpadFolder(layout, folder.id), false)}
            sx={{ ...menuItemSx, color: 'error.main' }}
          >
            <Minus size={18} aria-hidden="true" />
            {t('launchpad.folder.ungroup')}
          </MenuItem>
        )}
      </Menu>

      <ContentDialog
        open={Boolean(folderPartnerApp)}
        onClose={() => setFolderPartnerAppId(null)}
        title={t('launchpad.contextMenu.chooseFolderPartner', {
          app: folderPartnerApp?.name ?? '',
        })}
        closeLabel={t('actions.close', { ns: 'common' })}
        maxWidth="xs"
        contentDividers
        contentSx={{ p: 0 }}
      >
        <Box component="ul" sx={{ p: 2, m: 0, listStyle: 'none' }}>
          {folderPartnerCandidates.map((candidate) => (
            <Box component="li" key={candidate.id}>
              <ButtonBase
                aria-label={t('launchpad.contextMenu.groupWith', { app: candidate.name })}
                onClick={() => {
                  if (!folderPartnerApp) return;
                  const targetGroupId = findGroupId(candidate.id);
                  if (!targetGroupId) return;
                  const groupName =
                    groupById.get(targetGroupId)?.name ?? t('launchpad.fallbackApp');
                  setFolderPartnerAppId(null);
                  onPrepareFolderCreation(
                    {
                      groupId: targetGroupId,
                      firstAppId: folderPartnerApp.id,
                      secondAppId: candidate.id,
                      folderId: `folder-${crypto.randomUUID()}`,
                    },
                    t('launchpad.groupFolder', { group: groupName })
                  );
                }}
                sx={{
                  width: 1,
                  minHeight: 56,
                  px: 1,
                  display: 'grid',
                  gridTemplateColumns: '40px minmax(0, 1fr)',
                  gap: 1.5,
                  textAlign: 'left',
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <AppGlyph app={candidate} size={40} />
                <Box component="span" sx={{ minWidth: 0 }}>
                  <Typography component="span" variant="subtitle2">
                    {candidate.name}
                  </Typography>
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block' }}
                  >
                    {groupById.get(findGroupId(candidate.id) ?? '')?.name}
                  </Typography>
                </Box>
              </ButtonBase>
            </Box>
          ))}
        </Box>
        <Box
          sx={{
            p: 1.5,
            display: 'flex',
            justifyContent: 'flex-end',
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <ActionButton intent="quiet" onClick={() => setFolderPartnerAppId(null)}>
            {t('actions.cancel', { ns: 'common' })}
          </ActionButton>
        </Box>
      </ContentDialog>
    </>
  );
}

function EllipsizedLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {children}
    </Box>
  );
}

const menuItemSx = { minHeight: 44, gap: 1.25 } as const;
