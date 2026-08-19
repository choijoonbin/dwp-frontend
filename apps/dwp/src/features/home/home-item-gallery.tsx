import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { ActionButton, ContentDialog } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { AppGlyph } from './app-glyph';
import { HOME_WIDGET_REGISTRY } from './home-widget-registry';

import type { HomeWidgetKey } from '@dwp-frontend/shared-utils';
import type { HomeAppDefinition } from '../../components/workspace-composer/app-launchpad-model';

type HomeItemGalleryProps = {
  open: boolean;
  hiddenApps: readonly HomeAppDefinition[];
  hiddenWidgetKeys: readonly HomeWidgetKey[];
  busy?: boolean;
  onClose: () => void;
  onAddApp: (app: HomeAppDefinition) => void;
  onAddWidget: (widgetKey: HomeWidgetKey) => void;
};

export function HomeItemGallery({
  open,
  hiddenApps,
  hiddenWidgetKeys,
  busy = false,
  onClose,
  onAddApp,
  onAddWidget,
}: HomeItemGalleryProps) {
  const { t } = useTranslation('home');
  const [tab, setTab] = useState<'apps' | 'widgets'>('apps');
  const hiddenWidgets = HOME_WIDGET_REGISTRY.filter((widget) =>
    hiddenWidgetKeys.includes(widget.key)
  );
  const empty = tab === 'apps' ? hiddenApps.length === 0 : hiddenWidgets.length === 0;

  return (
    <ContentDialog
      open={open}
      onClose={onClose}
      title={t('editor.galleryTitle')}
      description={t('editor.gallerySubtitle')}
      closeLabel={t('editor.closeLabel')}
      busy={busy}
      maxWidth="md"
      contentSx={{ p: 0 }}
      headerContent={
        <>
          <Tabs
            value={tab}
            onChange={(_, value: 'apps' | 'widgets') => setTab(value)}
            aria-label={t('editor.galleryTabs')}
            sx={{ px: 3 }}
          >
            <Tab value="apps" label={t('editor.appsTab', { count: hiddenApps.length })} />
            <Tab value="widgets" label={t('editor.widgetsTab', { count: hiddenWidgets.length })} />
          </Tabs>
          <Divider />
        </>
      }
      slotProps={{
        backdrop: { sx: { backdropFilter: 'blur(10px)', bgcolor: 'rgba(15,23,42,0.42)' } },
        paper: {
          sx: {
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
            boxShadow: '0 28px 80px rgba(15,23,42,0.28)',
          },
        },
      }}
    >
      {empty ? (
        <Box
          sx={{
            minHeight: 260,
            px: 3,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('editor.nothingHidden')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('editor.nothingHiddenDescription')}
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {tab === 'apps'
            ? hiddenApps.map((app) => (
                <Box
                  component="li"
                  key={app.id}
                  sx={{
                    minHeight: 76,
                    px: { xs: 2, sm: 3 },
                    display: 'grid',
                    gridTemplateColumns: '52px minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: 1.5,
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <AppGlyph app={app} size={44} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2">{app.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {app.description}
                    </Typography>
                  </Box>
                  <ActionButton
                    intent="quiet"
                    size="small"
                    startIcon={<Plus size={16} />}
                    onClick={() => onAddApp(app)}
                    disabled={busy}
                  >
                    {t('editor.add')}
                  </ActionButton>
                </Box>
              ))
            : hiddenWidgets.map((widget) => {
                const Icon = widget.icon;
                return (
                  <Box
                    component="li"
                    key={widget.key}
                    sx={{
                      minHeight: 76,
                      px: { xs: 2, sm: 3 },
                      display: 'grid',
                      gridTemplateColumns: '40px minmax(0, 1fr) auto',
                      alignItems: 'center',
                      gap: 1.5,
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ color: 'text.secondary', display: 'grid', placeItems: 'center' }}>
                      <Icon size={21} aria-hidden="true" />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2">
                        {t(`widgets.registry.${widget.key}.label`)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(`widgets.registry.${widget.key}.description`)}
                      </Typography>
                      {widget.manifest && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('editor.widgetMetadata', {
                            source: widget.manifest.dataSource,
                            minutes: Math.max(1, Math.ceil(widget.manifest.freshnessSeconds / 60)),
                          })}
                        </Typography>
                      )}
                    </Box>
                    <ActionButton
                      intent="quiet"
                      size="small"
                      startIcon={<Plus size={16} />}
                      onClick={() => onAddWidget(widget.key)}
                      disabled={busy}
                    >
                      {t('editor.add')}
                    </ActionButton>
                  </Box>
                );
              })}
        </Box>
      )}
    </ContentDialog>
  );
}
