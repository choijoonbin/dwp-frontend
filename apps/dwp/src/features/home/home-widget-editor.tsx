import { useEffect, useMemo, useState } from 'react';
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
              Edit home
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Personal view
            </Typography>
          </Box>
          <Tooltip title="Close">
            <span>
              <IconButton aria-label="Close home editor" onClick={onClose} disabled={busy}>
                <X size={19} strokeWidth={1.8} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <List disablePadding sx={{ flex: 1 }} aria-label="Home widgets">
          {widgets.map((widget, index) => {
            const definition = definitionByKey.get(widget.widgetKey);
            if (!definition) return null;
            const Icon = definition.icon;
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
                  <Typography variant="subtitle2">{definition.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {definition.description}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" gap={0.25}>
                  <Tooltip title="Move up">
                    <span>
                      <IconButton
                        size="small"
                        aria-label={`Move ${definition.label} up`}
                        disabled={busy || index === 0}
                        onClick={() => setWidgets((current) => moveHomeWidget(current, index, -1))}
                      >
                        <ArrowUp size={17} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move down">
                    <span>
                      <IconButton
                        size="small"
                        aria-label={`Move ${definition.label} down`}
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
                      slotProps={{ input: { 'aria-label': `Show ${definition.label}` } }}
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
                    <Tooltip title="Governed content">
                      <LockKeyhole size={17} strokeWidth={1.8} aria-label="Governed content" />
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
            Reset
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<Save size={17} />}
            onClick={() => onSave(widgets)}
            disabled={busy}
          >
            Save
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
