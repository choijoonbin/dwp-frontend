import { useState } from 'react';
import { ArrowRight, Folder, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, ContentDialog } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppGlyph } from './app-glyph';

import type { WorkspaceApp } from '@dwp-frontend/shared-utils';
import type { HomeAppDefinition, LaunchpadLayout } from './app-launchpad-model';

type HomeQuickAppsProps = {
  apps: readonly HomeAppDefinition[];
  runtimeApps: readonly WorkspaceApp[];
  layout: LaunchpadLayout;
  busy: boolean;
  limit?: number;
  onLaunch: (app: HomeAppDefinition) => void;
  onBrowseAll: () => void;
  onEdit: () => void;
};

function visibleItemOrder(layout: LaunchpadLayout): string[] {
  return [...new Set(Object.values(layout.groups).flat())];
}

export function HomeQuickApps({
  apps,
  runtimeApps,
  layout,
  busy,
  limit = 6,
  onLaunch,
  onBrowseAll,
  onEdit,
}: HomeQuickAppsProps) {
  const { t } = useTranslation('home');
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const appById = new Map(apps.map((app) => [app.id, app]));
  const runtimeById = new Map(runtimeApps.map((app) => [app.id, app]));
  const quickItems = visibleItemOrder(layout)
    .map((itemId) => {
      const folder = layout.folders[itemId];
      if (folder) {
        return {
          kind: 'folder' as const,
          id: folder.id,
          folder,
          apps: folder.appIds
            .map((appId) => appById.get(appId))
            .filter((app): app is HomeAppDefinition => Boolean(app)),
        };
      }
      const app = appById.get(itemId);
      return app ? { kind: 'app' as const, id: app.id, app } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => {
      const isPinned = (item: typeof left | typeof right) =>
        item.kind === 'app'
          ? Boolean(runtimeById.get(item.app.id)?.pinned)
          : item.apps.some((app) => runtimeById.get(app.id)?.pinned);
      return Number(isPinned(right)) - Number(isPinned(left));
    })
    .slice(0, limit);
  const openFolder = openFolderId ? layout.folders[openFolderId] : undefined;
  const openFolderApps = openFolder
    ? openFolder.appIds
        .map((appId) => appById.get(appId))
        .filter((app): app is HomeAppDefinition => Boolean(app))
    : [];

  return (
    <Box component="section" aria-labelledby="quick-apps-heading" sx={{ mt: 4 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
        <Box>
          <Typography id="quick-apps-heading" component="h2" variant="h6">
            {t('quickApps.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {t('quickApps.description')}
          </Typography>
        </Box>
        <Stack direction="row" gap={0.75}>
          <ActionButton
            intent="quiet"
            startIcon={<Settings2 size={16} aria-hidden="true" />}
            disabled={busy}
            onClick={onEdit}
          >
            {t('launchpad.editHome')}
          </ActionButton>
          <ActionButton
            intent="quiet"
            endIcon={<ArrowRight size={16} aria-hidden="true" />}
            onClick={onBrowseAll}
          >
            {t('launchpad.allApps')}
          </ActionButton>
        </Stack>
      </Stack>

      <Box
        sx={{
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(3, minmax(0, 1fr))',
            lg: `repeat(${Math.min(limit, 6)}, minmax(0, 1fr))`,
          },
          borderTop: 1,
          borderLeft: 1,
          borderColor: 'divider',
        }}
      >
        {quickItems.map((item) => (
          <ButtonBase
            key={item.id}
            aria-label={
              item.kind === 'app'
                ? t('launchpad.openApp', { app: item.app.name })
                : t('launchpad.openFolder', { folder: item.folder.name })
            }
            onClick={() => {
              if (item.kind === 'app') onLaunch(item.app);
              else setOpenFolderId(item.folder.id);
            }}
            sx={{
              minWidth: 0,
              minHeight: 112,
              p: 2,
              display: 'grid',
              gridTemplateColumns: '42px minmax(0, 1fr)',
              alignItems: 'center',
              gap: 1.25,
              textAlign: 'left',
              bgcolor: 'background.paper',
              borderRight: 1,
              borderBottom: 1,
              borderColor: 'divider',
              transition: 'background-color 160ms ease, box-shadow 160ms ease',
              '&:hover': { bgcolor: 'action.hover', boxShadow: 'inset 0 2px 0 #356AE6' },
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: -2,
              },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            {item.kind === 'app' ? (
              <AppGlyph app={item.app} size={42} />
            ) : (
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 1,
                  bgcolor: 'action.selected',
                  color: 'primary.main',
                }}
              >
                <Folder size={25} strokeWidth={1.7} aria-hidden="true" />
              </Box>
            )}
            <Box minWidth={0}>
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Typography component="span" variant="subtitle2" noWrap>
                  {item.kind === 'app' ? item.app.shortName : item.folder.name}
                </Typography>
                {item.kind === 'app' && item.app.badge && (
                  <Chip label={item.app.badge} size="small" color="primary" />
                )}
              </Stack>
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  overflow: 'hidden',
                }}
              >
                {item.kind === 'app'
                  ? item.app.description
                  : t('quickApps.folderSummary', { count: item.apps.length })}
              </Typography>
            </Box>
          </ButtonBase>
        ))}
      </Box>

      <ContentDialog
        open={Boolean(openFolder)}
        onClose={() => setOpenFolderId(null)}
        title={openFolder?.name ?? ''}
        closeLabel={t('actions.close', { ns: 'common' })}
        maxWidth="xs"
        contentSx={{ p: 2, borderTop: 1, borderColor: 'divider' }}
      >
        {openFolder && (
          <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {openFolderApps.map((app) => (
              <Box
                component="li"
                key={app.id}
                sx={{
                  borderTop: 1,
                  borderColor: 'divider',
                  '&:first-of-type': { borderTop: 0 },
                }}
              >
                <ButtonBase
                  aria-label={t('launchpad.openApp', { app: app.name })}
                  onClick={() => {
                    setOpenFolderId(null);
                    onLaunch(app);
                  }}
                  sx={{
                    width: 1,
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
              </Box>
            ))}
          </Box>
        )}
      </ContentDialog>
    </Box>
  );
}
