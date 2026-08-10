import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, LockKeyhole, RotateCcw, Save, X } from 'lucide-react';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';

import { HOME_WIDGET_REGISTRY, moveHomeWidget, reconcileHomeWidgets } from './home-widget-registry';

import type { HomeWidgetPreference } from '@dwp-frontend/shared-utils';

type HomeWidgetEditorProps = {
  open: boolean;
  value: readonly HomeWidgetPreference[];
  busy?: boolean;
  onClose: () => void;
  onSave: (widgets: HomeWidgetPreference[]) => void;
  onReset: () => void;
};

export function HomeWidgetEditor({
  open,
  value,
  busy = false,
  onClose,
  onSave,
  onReset,
}: HomeWidgetEditorProps) {
  const { t } = useTranslation(['home', 'common']);
  const [widgets, setWidgets] = useState(() => reconcileHomeWidgets(value));
  const definitionByKey = useMemo(
    () => new Map(HOME_WIDGET_REGISTRY.map((definition) => [definition.key, definition])),
    []
  );

  useEffect(() => {
    if (open) setWidgets(reconcileHomeWidgets(value));
  }, [open, value]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={busy ? undefined : onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: 1, sm: 430 },
            maxWidth: '100%',
            bgcolor: 'background.paper',
          },
        },
      }}
    >
      <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            minHeight: 68,
            px: 2.5,
            display: 'flex',
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography component="h2" variant="h6">
              {t('editor.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('editor.subtitle')}
            </Typography>
          </Box>
          <Tooltip title={t('actions.close', { ns: 'common' })}>
            <span>
              <IconButton aria-label={t('editor.closeLabel')} onClick={onClose} disabled={busy}>
                <X size={19} strokeWidth={1.8} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <List disablePadding sx={{ flex: 1 }} aria-label={t('editor.widgetsLabel')}>
          {widgets.map((widget, index) => {
            const definition = definitionByKey.get(widget.widgetKey);
            if (!definition) return null;
            const Icon = definition.icon;
            const widgetLabel = t(`widgets.registry.${definition.key}.label`, {
              defaultValue: definition.label,
            });
            return (
              <ListItem
                key={widget.widgetKey}
                divider
                sx={{ minHeight: 78, px: 2.5, gap: 1, alignItems: 'center' }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                </ListItemIcon>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2">{widgetLabel}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`widgets.registry.${definition.key}.description`, {
                      defaultValue: definition.description,
                    })}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" gap={0.25}>
                  <Tooltip title={t('editor.moveUp')}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={t('editor.moveUpLabel', { widget: widgetLabel })}
                        disabled={busy || index === 0}
                        onClick={() => setWidgets((current) => moveHomeWidget(current, index, -1))}
                      >
                        <ArrowUp size={17} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t('editor.moveDown')}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={t('editor.moveDownLabel', { widget: widgetLabel })}
                        disabled={busy || index === widgets.length - 1}
                        onClick={() => setWidgets((current) => moveHomeWidget(current, index, 1))}
                      >
                        <ArrowDown size={17} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {definition.canHide ? (
                    <Switch
                      size="small"
                      checked={widget.visible}
                      disabled={busy}
                      slotProps={{
                        input: { 'aria-label': t('editor.showLabel', { widget: widgetLabel }) },
                      }}
                      onChange={(event) =>
                        setWidgets((current) =>
                          current.map((item) =>
                            item.widgetKey === widget.widgetKey
                              ? { ...item, visible: event.target.checked }
                              : item
                          )
                        )
                      }
                    />
                  ) : (
                    <Tooltip title={t('editor.governed')}>
                      <LockKeyhole size={17} strokeWidth={1.8} aria-label={t('editor.governed')} />
                    </Tooltip>
                  )}
                </Stack>
              </ListItem>
            );
          })}
        </List>

        <Divider />
        <Stack direction="row" gap={1} sx={{ p: 2.5 }}>
          <Button
            color="inherit"
            startIcon={<RotateCcw size={17} />}
            onClick={onReset}
            disabled={busy}
          >
            {t('actions.reset', { ns: 'common' })}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            {t('actions.cancel', { ns: 'common' })}
          </Button>
          <Button
            variant="contained"
            startIcon={<Save size={17} />}
            onClick={() => onSave(widgets)}
            disabled={busy}
          >
            {t('actions.save', { ns: 'common' })}
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
