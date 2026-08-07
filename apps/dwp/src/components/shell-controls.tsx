import { useState } from 'react';
import { Bell, ChevronDown, Search } from 'lucide-react';
import { WORKSPACE_NAME } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

function WorkspaceBadge() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 26,
        height: 26,
        display: 'grid',
        flex: '0 0 26px',
        placeItems: 'center',
        borderRadius: 1,
        color: 'primary.contrastText',
        bgcolor: 'primary.main',
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      D
    </Box>
  );
}

export function WorkspaceMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Button
        color="inherit"
        aria-label="Select workspace"
        aria-controls={anchor ? 'workspace-menu' : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ minWidth: 0, maxWidth: { xs: 148, md: 280 }, gap: 1, px: 1 }}
      >
        <WorkspaceBadge />
        <Typography
          component="span"
          variant="subtitle2"
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {WORKSPACE_NAME}
        </Typography>
        <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
      </Button>

      <Menu
        id="workspace-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuItem selected onClick={() => setAnchor(null)} sx={{ minWidth: 260, gap: 1.25 }}>
          <WorkspaceBadge />
          <Box>
            <Typography variant="subtitle2">{WORKSPACE_NAME}</Typography>
            <Typography variant="caption" color="text.secondary">
              Current workspace
            </Typography>
          </Box>
        </MenuItem>
      </Menu>
    </>
  );
}

export function SearchControl() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Tooltip title="Search">
        <IconButton aria-label="Search" onClick={(event) => setAnchor(event.currentTarget)}>
          <Search size={20} strokeWidth={1.8} />
        </IconButton>
      </Tooltip>
      <Popover
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: { xs: 'calc(100vw - 24px)', sm: 420 }, p: 2 } } }}
      >
        <TextField
          fullWidth
          autoFocus
          label="Search"
          placeholder="Search people, work, services, and knowledge"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} strokeWidth={1.8} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Popover>
    </>
  );
}

export function NotificationMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton aria-label="Notifications" onClick={(event) => setAnchor(event.currentTarget)}>
          <Badge color="error" variant="dot" invisible>
            <Bell size={20} strokeWidth={1.8} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: { xs: 300, sm: 360 }, p: 2 } } }}
      >
        <Typography variant="subtitle1">Notifications</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          No notifications
        </Typography>
      </Popover>
    </>
  );
}
