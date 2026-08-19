import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, CheckCheck, Clock3, Inbox, MailOpen, MailPlus, Search, Star } from 'lucide-react';
import { CommandPaletteDialog } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

import type { LucideIcon } from 'lucide-react';

export type MailCommand =
  | 'compose'
  | 'focus-search'
  | 'show-priority'
  | 'show-needs-reply'
  | 'mark-read'
  | 'star'
  | 'snooze'
  | 'archive';

type CommandItem = {
  id: MailCommand;
  icon: LucideIcon;
  shortcut?: string;
  requiresThread?: boolean;
};

const COMMANDS: readonly CommandItem[] = [
  { id: 'compose', icon: MailPlus, shortcut: 'C' },
  { id: 'focus-search', icon: Search, shortcut: '/' },
  { id: 'show-priority', icon: Inbox },
  { id: 'show-needs-reply', icon: CheckCheck },
  { id: 'mark-read', icon: MailOpen, requiresThread: true },
  { id: 'star', icon: Star, requiresThread: true },
  { id: 'snooze', icon: Clock3, requiresThread: true },
  { id: 'archive', icon: Archive, shortcut: 'E', requiresThread: true },
];

export function MailCommandPalette({
  open,
  hasSelectedThread,
  onClose,
  onCommand,
}: {
  open: boolean;
  hasSelectedThread: boolean;
  onClose: () => void;
  onCommand: (command: MailCommand) => void;
}) {
  const { t } = useTranslation('mail');
  const [query, setQuery] = useState('');
  const commands = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return COMMANDS.filter((command) => {
      if (command.requiresThread && !hasSelectedThread) return false;
      const label = t(`command.items.${command.id}`);
      return !normalized || label.toLocaleLowerCase().includes(normalized);
    });
  }, [hasSelectedThread, query, t]);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  return (
    <CommandPaletteDialog
      open={open}
      label={t('command.open')}
      placeholder={t('command.placeholder')}
      query={query}
      onQueryChange={setQuery}
      onClose={onClose}
    >
      <List disablePadding sx={{ py: 0.75, maxHeight: 420, overflowY: 'auto' }}>
        {commands.map((command) => {
          const Icon = command.icon;
          return (
            <ListItemButton
              key={command.id}
              onClick={() => {
                onCommand(command.id);
                onClose();
              }}
              sx={{ minHeight: 46, mx: 0.75, borderRadius: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Icon size={18} />
              </ListItemIcon>
              <ListItemText
                primary={t(`command.items.${command.id}`)}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 650 }}
              />
              {command.shortcut && (
                <Box
                  component="kbd"
                  sx={{
                    minWidth: 25,
                    height: 23,
                    px: 0.75,
                    display: 'grid',
                    placeItems: 'center',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 0.75,
                    bgcolor: 'action.hover',
                    fontFamily: 'inherit',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {command.shortcut}
                  </Typography>
                </Box>
              )}
            </ListItemButton>
          );
        })}
        {commands.length === 0 && (
          <Typography color="text.secondary" variant="body2" sx={{ px: 2, py: 3 }}>
            {t('command.noResults')}
          </Typography>
        )}
      </List>
    </CommandPaletteDialog>
  );
}
