import { useTranslation } from 'react-i18next';
import { Folder, Pencil, X } from 'lucide-react';
import { ActionIconButton, ContentDialog } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { AppGlyph } from './app-glyph';
import { AppManagementAction } from './app-management-action';

import type {
  HomeAppDefinition,
  LaunchpadFolder,
} from '../../components/workspace-composer/app-launchpad-model';

type AppLaunchpadFolderDialogProps = {
  folder?: LaunchpadFolder;
  apps: readonly HomeAppDefinition[];
  editing: boolean;
  onClose: () => void;
  onRename: (folder: LaunchpadFolder) => void;
  onLaunch: (app: HomeAppDefinition) => void;
  onManage?: (app: HomeAppDefinition) => void;
  onRemoveApp: (app: HomeAppDefinition) => void;
};

function openAppLabel(app: HomeAppDefinition, t: ReturnType<typeof useTranslation>['t']) {
  const metadata = app.badgeMetadata;
  if (!metadata) return t('launchpad.openApp', { app: app.name });
  if (metadata.urgentUnread > 0) {
    return t('flow.dock.openAppUrgent', {
      app: app.name,
      count: metadata.totalUnread,
      urgent: metadata.urgentUnread,
    });
  }
  if (metadata.actionableUnread > 0) {
    return t('flow.dock.openAppActionable', {
      app: app.name,
      count: metadata.totalUnread,
      actionable: metadata.actionableUnread,
    });
  }
  return t('flow.dock.openApp', { app: app.name, count: metadata.totalUnread });
}

export function AppLaunchpadFolderDialog({
  folder,
  apps,
  editing,
  onClose,
  onRename,
  onLaunch,
  onManage,
  onRemoveApp,
}: AppLaunchpadFolderDialogProps) {
  const { t } = useTranslation('home');
  const appById = new Map(apps.map((app) => [app.id, app]));

  return (
    <ContentDialog
      open={Boolean(folder)}
      title={folder?.name ?? ''}
      closeLabel={t('actions.close', { ns: 'common' })}
      onClose={onClose}
      maxWidth="xs"
      contentDividers
      titleStart={<Folder size={20} strokeWidth={1.8} aria-hidden="true" />}
      titleEnd={
        editing && folder ? (
          <ActionIconButton
            label={t('launchpad.folder.renameLabel', { folder: folder.name })}
            onClick={() => onRename(folder)}
            sx={{ width: 44, height: 44 }}
          >
            <Pencil size={17} />
          </ActionIconButton>
        ) : undefined
      }
      contentSx={{ py: 0 }}
    >
      {folder && (
        <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {folder.appIds.map((appId) => {
            const app = appById.get(appId);
            if (!app) return null;
            const badgeIntent = app.badgeMetadata?.intent ?? 'unread';
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
                  aria-label={
                    app.managementOnly
                      ? t('launchpad.manageApp', { app: app.name })
                      : openAppLabel(app, t)
                  }
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
                  <Box sx={{ position: 'relative', width: 40, height: 40 }}>
                    <AppGlyph app={app} size={40} />
                    {app.badge && !editing && (
                      <Box
                        component="span"
                        aria-hidden="true"
                        data-launchpad-badge
                        data-badge-intent={badgeIntent}
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
                          borderColor: 'background.paper',
                          fontSize: 10,
                          fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {app.badge}
                      </Box>
                    )}
                  </Box>
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
                {!editing && app.managementRoute && onManage && (
                  <AppManagementAction app={app} variant="inline" onManage={onManage} />
                )}
                {editing && (
                  <ActionIconButton
                    label={t('launchpad.removeAppLabel', { app: app.name })}
                    intent="danger"
                    sx={{ width: 44, height: 44 }}
                    onClick={() => onRemoveApp(app)}
                  >
                    <X size={17} />
                  </ActionIconButton>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </ContentDialog>
  );
}
