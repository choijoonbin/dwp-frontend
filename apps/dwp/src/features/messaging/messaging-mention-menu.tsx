import { AtSign, Megaphone } from 'lucide-react';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Typography from '@mui/material/Typography';

import { messagingInitials, PresenceDot } from './messaging-components';

import type { MessagingMentionOption } from './messaging-composer-model';

export function MessagingMentionMenu({
  anchorEl,
  open,
  options,
  listboxId,
  activeIndex,
  suggestionsLabel,
  emptyLabel,
  participantCountLabel,
  onActiveIndexChange,
  onSelect,
  onClose,
}: {
  anchorEl: HTMLElement | null;
  open: boolean;
  options: MessagingMentionOption[];
  listboxId: string;
  activeIndex: number;
  suggestionsLabel: string;
  emptyLabel: string;
  participantCountLabel: (count: number) => string;
  onActiveIndexChange: (index: number) => void;
  onSelect: (option: MessagingMentionOption) => void;
  onClose: () => void;
}) {
  if (!open || !anchorEl) return null;
  return (
    <Popper
      open
      anchorEl={anchorEl}
      placement="top-start"
      modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
    >
      <ClickAwayListener onClickAway={onClose}>
        <Paper
          elevation={0}
          sx={{
            width: Math.min(Math.max(anchorEl.clientWidth, 360), 520),
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 320,
            overflowY: 'auto',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: '0 18px 52px rgba(15, 23, 42, 0.18)',
          }}
        >
          {options.length ? (
            <List id={listboxId} role="listbox" dense disablePadding aria-label={suggestionsLabel}>
              {options.map((option, index) => (
                <ListItemButton
                  key={option.key}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  tabIndex={-1}
                  selected={index === activeIndex}
                  onMouseEnter={() => onActiveIndexChange(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(option)}
                  sx={{ minHeight: 58, px: 1.25 }}
                >
                  <ListItemIcon sx={{ minWidth: 44 }}>
                    {option.all ? (
                      <Avatar
                        sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: '#fff' }}
                      >
                        <Megaphone size={17} />
                      </Avatar>
                    ) : (
                      <Box sx={{ position: 'relative' }}>
                        <Avatar sx={{ width: 34, height: 34, fontSize: 11, fontWeight: 800 }}>
                          {messagingInitials(option.label)}
                        </Avatar>
                        <Box sx={{ position: 'absolute', right: -1, bottom: -1 }}>
                          <PresenceDot state={option.presenceState ?? 'UNKNOWN'} />
                        </Box>
                      </Box>
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={780} noWrap>
                        {option.label}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {option.all ? participantCountLabel(option.userIds.length) : option.detail}
                      </Typography>
                    }
                  />
                  <AtSign size={15} color="var(--dwp-product-accent)" />
                </ListItemButton>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {emptyLabel}
            </Typography>
          )}
        </Paper>
      </ClickAwayListener>
    </Popper>
  );
}
