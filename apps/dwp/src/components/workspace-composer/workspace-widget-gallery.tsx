import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { ActionButton, ContentDialog, EmptyState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { WorkspaceWidgetDefinition } from './workspace-composer-model';

type WorkspaceWidgetGalleryProps<WidgetKey extends string> = {
  open: boolean;
  registry: readonly WorkspaceWidgetDefinition<WidgetKey>[];
  hiddenWidgetKeys: readonly WidgetKey[];
  busy?: boolean;
  getLabel: (widgetKey: WidgetKey) => string;
  getDescription: (widgetKey: WidgetKey) => string;
  onClose: () => void;
  onAdd: (widgetKey: WidgetKey) => void;
};

export function WorkspaceWidgetGallery<WidgetKey extends string>({
  open,
  registry,
  hiddenWidgetKeys,
  busy = false,
  getLabel,
  getDescription,
  onClose,
  onAdd,
}: WorkspaceWidgetGalleryProps<WidgetKey>) {
  const { t } = useTranslation('composer');
  const hidden = registry.filter((widget) => hiddenWidgetKeys.includes(widget.key));

  return (
    <ContentDialog
      open={open}
      onClose={onClose}
      title={t('galleryTitle')}
      description={t('galleryDescription')}
      closeLabel={t('close')}
      busy={busy}
      maxWidth="md"
      contentSx={{ p: 0 }}
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
      {hidden.length === 0 ? (
        <EmptyState
          size="compact"
          title={t('galleryEmptyTitle')}
          description={t('galleryEmptyDescription')}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {hidden.map((definition, index) => {
            const Icon = definition.icon;
            return (
              <Box
                key={definition.key}
                sx={{
                  minWidth: 0,
                  p: 2.25,
                  display: 'grid',
                  gridTemplateColumns: '40px minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: 1.25,
                  borderTop: index > 1 ? 1 : { xs: index > 0 ? 1 : 0, sm: 0 },
                  borderLeft: { xs: 0, sm: index % 2 ? 1 : 0 },
                  borderColor: 'divider',
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    color: 'primary.main',
                  }}
                >
                  <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                </Box>
                <Box minWidth={0}>
                  <Typography variant="subtitle2" noWrap>
                    {getLabel(definition.key)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {getDescription(definition.key)}
                  </Typography>
                </Box>
                <ActionButton
                  intent="secondary"
                  size="small"
                  startIcon={<Plus size={15} />}
                  disabled={busy}
                  onClick={() => onAdd(definition.key)}
                >
                  {t('add')}
                </ActionButton>
              </Box>
            );
          })}
        </Box>
      )}
    </ContentDialog>
  );
}
