import { useState } from 'react';
import { Bookmark, Check, ChevronDown, Save, Settings2, Star } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListSubheader from '@mui/material/ListSubheader';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

import { ActionButton } from '../../components/actions';

export type SavedViewScope = 'personal' | 'shared';

export type SavedView = {
  id: string;
  name: string;
  scope: SavedViewScope;
  owner?: string;
  favorite?: boolean;
  isDefault?: boolean;
  builtIn?: boolean;
};

export type SavedViewMenuProps = {
  label: string;
  views: SavedView[];
  selectedViewId?: string | null;
  personalLabel: string;
  sharedLabel: string;
  defaultLabel: string;
  saveCurrentLabel?: string;
  manageLabel?: string;
  builtInLabel?: string;
  emptyLabel?: string;
  onSelect: (view: SavedView) => void;
  onSaveCurrent?: () => void;
  onManage?: () => void;
  canSave?: boolean;
  loading?: boolean;
};

export function SavedViewMenu({
  label,
  views,
  selectedViewId,
  personalLabel,
  sharedLabel,
  defaultLabel,
  saveCurrentLabel,
  manageLabel,
  builtInLabel,
  emptyLabel,
  onSelect,
  onSaveCurrent,
  onManage,
  canSave = false,
  loading = false,
}: SavedViewMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const selected = views.find((view) => view.id === selectedViewId);

  return (
    <>
      <ActionButton
        intent="quiet"
        size="small"
        startIcon={<Bookmark size={16} aria-hidden="true" />}
        endIcon={<ChevronDown size={14} aria-hidden="true" />}
        aria-label={`${label}: ${selected?.name ?? label}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        {selected?.name ?? label}
      </ActionButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 320, maxWidth: 'min(420px, calc(100vw - 24px))' } } }}
      >
        {builtInLabel && views.some((view) => view.builtIn) && (
          <ListSubheader>{builtInLabel}</ListSubheader>
        )}
        {views.map((view, index) => (
          <MenuItem
            key={view.id}
            divider={Boolean(
              builtInLabel && index > 0 && views[index - 1]?.builtIn && !view.builtIn
            )}
            selected={view.id === selectedViewId}
            onClick={() => {
              onSelect(view);
              setAnchor(null);
            }}
          >
            <ListItemIcon>
              {view.id === selectedViewId ? (
                <Check size={16} aria-hidden="true" />
              ) : view.favorite ? (
                <Star size={16} aria-hidden="true" />
              ) : (
                <Bookmark size={16} aria-hidden="true" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={view.name}
              secondary={view.owner}
              slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
              sx={{ minWidth: 0 }}
            />
            <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <Chip
                size="small"
                variant="outlined"
                label={
                  view.builtIn
                    ? builtInLabel
                    : view.scope === 'shared'
                      ? sharedLabel
                      : personalLabel
                }
              />
              {view.isDefault && <Chip size="small" label={defaultLabel} sx={{ ml: 0.5 }} />}
            </Box>
          </MenuItem>
        ))}
        {!loading && views.length === 0 && emptyLabel && (
          <MenuItem disabled>
            <ListItemText primary={emptyLabel} />
          </MenuItem>
        )}
        {loading && (
          <MenuItem disabled>
            <ListItemIcon>
              <CircularProgress size={16} aria-hidden="true" />
            </ListItemIcon>
            <ListItemText primary={emptyLabel ?? label} />
          </MenuItem>
        )}
        {canSave && saveCurrentLabel && onSaveCurrent && (
          <MenuItem
            divider={views.length > 0}
            onClick={() => {
              onSaveCurrent();
              setAnchor(null);
            }}
          >
            <ListItemIcon>
              <Save size={16} aria-hidden="true" />
            </ListItemIcon>
            <ListItemText primary={saveCurrentLabel} />
          </MenuItem>
        )}
        {manageLabel && onManage && (
          <MenuItem
            divider={!canSave && views.length > 0}
            onClick={() => {
              onManage();
              setAnchor(null);
            }}
          >
            <ListItemIcon>
              <Settings2 size={16} aria-hidden="true" />
            </ListItemIcon>
            <ListItemText primary={manageLabel} />
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
