import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Clock3, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { WORKSPACE_NAME } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import ButtonBase from '@mui/material/ButtonBase';
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
            <Typography component="p" variant="subtitle2">
              {WORKSPACE_NAME}
            </Typography>
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
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const openCommand = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (triggerRef.current) setAnchor(triggerRef.current);
      }
    };
    window.addEventListener('keydown', openCommand);
    return () => window.removeEventListener('keydown', openCommand);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setAnchor(null);
    navigate('/ask?q=' + encodeURIComponent(value));
    setQuery('');
  };

  return (
    <>
      <ButtonBase
        ref={triggerRef}
        aria-label="Search"
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          width: { md: 300, xl: 380 },
          height: 38,
          px: 1.25,
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          gap: 1,
          color: 'text.secondary',
          bgcolor: 'background.default',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          textAlign: 'left',
          transition: (theme) => theme.transitions.create(['border-color', 'background-color']),
          '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
        }}
      >
        <Search size={18} strokeWidth={1.8} aria-hidden="true" />
        <Typography variant="body2" sx={{ flex: 1 }}>
          Search or ask DWP
        </Typography>
        <Sparkles size={15} strokeWidth={1.8} aria-hidden="true" />
      </ButtonBase>
      <Tooltip title="Search">
        <IconButton
          aria-label="Search"
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{ display: { xs: 'inline-flex', md: 'none' } }}
        >
          <Search size={20} strokeWidth={1.8} />
        </IconButton>
      </Tooltip>
      <Popover
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { width: { xs: 'calc(100vw - 24px)', sm: 540 }, p: 2, mt: 1 },
          },
        }}
      >
        <Box component="form" onSubmit={submit}>
          <TextField
            fullWidth
            autoFocus
            label="Ask or search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search work, apps, services, and knowledge"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} strokeWidth={1.8} aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
          {['What needs my attention?', 'Find the remote work policy'].map((prompt) => (
            <Button
              key={prompt}
              size="small"
              variant="text"
              startIcon={<Sparkles size={15} aria-hidden="true" />}
              onClick={() => {
                setAnchor(null);
                navigate('/ask?q=' + encodeURIComponent(prompt));
              }}
            >
              {prompt}
            </Button>
          ))}
        </Box>
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
          <Badge color="error" badgeContent={2} max={9}>
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
        slotProps={{ paper: { sx: { width: { xs: 320, sm: 380 }, mt: 1 } } }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography component="h2" variant="subtitle1">
            Notifications
          </Typography>
          <Typography variant="caption" color="text.secondary">
            2 new
          </Typography>
        </Box>
        <Divider />
        <ButtonBase
          onClick={() => setAnchor(null)}
          sx={{ width: 1, p: 2, alignItems: 'flex-start', gap: 1.5, textAlign: 'left' }}
        >
          <Box sx={{ color: 'warning.main', mt: 0.25 }}>
            <Clock3 size={18} aria-hidden="true" />
          </Box>
          <Box>
            <Typography component="p" variant="subtitle2">
              Approval due in 45 minutes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Software access request / IT Service
            </Typography>
          </Box>
        </ButtonBase>
        <Divider />
        <ButtonBase
          onClick={() => setAnchor(null)}
          sx={{ width: 1, p: 2, alignItems: 'flex-start', gap: 1.5, textAlign: 'left' }}
        >
          <Box sx={{ color: 'success.main', mt: 0.25 }}>
            <ShieldCheck size={18} aria-hidden="true" />
          </Box>
          <Box>
            <Typography component="p" variant="subtitle2">
              Connector policy check completed
            </Typography>
            <Typography variant="body2" color="text.secondary">
              4 sources are healthy
            </Typography>
          </Box>
        </ButtonBase>
      </Popover>
    </>
  );
}
