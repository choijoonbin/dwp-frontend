import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

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

export function WorkspaceMenu() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <Button
        color="inherit"
        aria-label="Select workspace"
        aria-controls={anchorEl ? 'workspace-menu' : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          px: 1,
          py: 0.5,
          gap: 1,
          minWidth: 0,
          maxWidth: { xs: 180, sm: 260 },
          justifyContent: 'flex-start',
          bgcolor: 'background.neutral',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Box
          component="img"
          src="/assets/icons/workspaces/sk-logo.svg"
          alt=""
          sx={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
        />
        <Typography
          variant="subtitle2"
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          AX Solution서비스
        </Typography>
        <Box
          component="span"
          sx={{
            px: 0.75,
            py: 0.25,
            ml: 'auto',
            borderRadius: 0.75,
            color: 'info.dark',
            bgcolor: 'info.lighter',
            typography: 'caption',
            fontWeight: 'fontWeightSemiBold',
          }}
        >
          Pro
        </Box>
        <Iconify icon="solar:alt-arrow-down-linear" width={16} sx={{ flexShrink: 0 }} />
      </Button>

      <Menu
        id="workspace-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuItem selected onClick={() => setAnchorEl(null)} sx={{ minWidth: 240, gap: 1.25 }}>
          <Box
            component="img"
            src="/assets/icons/workspaces/sk-logo.svg"
            alt=""
            sx={{ width: 24, height: 24, objectFit: 'contain' }}
          />
          <Box>
            <Typography variant="subtitle2">AX Solution서비스</Typography>
            <Typography variant="caption" color="text.secondary">
              Pro
            </Typography>
          </Box>
        </MenuItem>
      </Menu>
    </>
  );
}

export function SearchControl() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <Tooltip title="Search">
        <IconButton aria-label="Search" onClick={(event) => setAnchorEl(event.currentTarget)}>
          <Iconify icon="eva:search-fill" width={22} />
        </IconButton>
      </Tooltip>
      <Popover
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: { xs: 300, sm: 420 }, p: 1.5 } } }}
      >
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Search"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" width={20} />
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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          aria-label="Notifications"
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          <Badge color="error" badgeContent={0}>
            <Iconify icon="solar:bell-bing-bold" width={22} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 320 } } }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2">Notifications</Typography>
        </Box>
        <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No notifications
          </Typography>
        </Box>
      </Popover>
    </>
  );
}
