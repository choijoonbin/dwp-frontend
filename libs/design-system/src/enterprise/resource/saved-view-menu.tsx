import { useState } from 'react';
import { Bookmark, Check, ChevronDown, Save, Star } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
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
};

export type SavedViewMenuProps = {
  label: string;
  views: SavedView[];
  selectedViewId?: string | null;
  personalLabel: string;
  sharedLabel: string;
  defaultLabel: string;
  saveCurrentLabel?: string;
  onSelect: (view: SavedView) => void;
  onSaveCurrent?: () => void;
  canSave?: boolean;
};

export function SavedViewMenu({
  label,
  views,
  selectedViewId,
  personalLabel,
  sharedLabel,
  defaultLabel,
  saveCurrentLabel,
  onSelect,
  onSaveCurrent,
  canSave = false,
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
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        {selected?.name ?? label}
      </ActionButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {views.map((view) => (
          <MenuItem
            key={view.id}
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
            <ListItemText primary={view.name} secondary={view.owner} />
            <Box sx={{ ml: 2 }}>
              <Chip
                size="small"
                variant="outlined"
                label={view.scope === 'shared' ? sharedLabel : personalLabel}
              />
              {view.isDefault && <Chip size="small" label={defaultLabel} sx={{ ml: 0.5 }} />}
            </Box>
          </MenuItem>
        ))}
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
      </Menu>
    </>
  );
}
