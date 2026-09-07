import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CalendarPlus,
  Focus,
  Inbox,
  ListTodo,
  UsersRound,
} from 'lucide-react';
import { CommandPaletteDialog, foundationTokens } from '@dwp-frontend/design-system';

import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

import type { CalendarEventType } from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

type CalendarCommandId =
  | 'create-event'
  | 'create-focus'
  | 'create-task'
  | 'create-out-of-office'
  | 'open-schedule'
  | 'open-focus'
  | 'find-time'
  | 'open-invitations'
  | 'open-insights';

type CalendarCommand = Readonly<{
  id: CalendarCommandId;
  icon: LucideIcon;
  requiresCreate?: boolean;
}>;

const CALENDAR_COMMANDS: readonly CalendarCommand[] = [
  { id: 'create-event', icon: CalendarPlus, requiresCreate: true },
  { id: 'create-focus', icon: Focus, requiresCreate: true },
  { id: 'create-task', icon: ListTodo, requiresCreate: true },
  { id: 'create-out-of-office', icon: BriefcaseBusiness, requiresCreate: true },
  { id: 'open-schedule', icon: CalendarDays },
  { id: 'open-focus', icon: Focus },
  { id: 'find-time', icon: UsersRound },
  { id: 'open-invitations', icon: Inbox },
  { id: 'open-insights', icon: BarChart3 },
];

const COMMAND_PATHS: Partial<Record<CalendarCommandId, string>> = {
  'open-schedule': '/calendar/schedule',
  'open-focus': '/calendar/focus',
  'find-time': '/calendar/availability',
  'open-invitations': '/calendar/invitations',
  'open-insights': '/calendar/insights',
};
const COMPACT_RADIUS = `${foundationTokens.radius.compact}px`;

export function CalendarCommandPalette({
  open,
  canCreate,
  onClose,
  onCreate,
  onNavigate,
}: {
  open: boolean;
  canCreate: boolean;
  onClose: () => void;
  onCreate: (type: CalendarEventType) => void;
  onNavigate: (path: string) => void;
}) {
  const { t } = useTranslation('calendar');
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const activeOptionRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const commands = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return CALENDAR_COMMANDS.filter((command) => {
      if (command.requiresCreate && !canCreate) return false;
      return (
        !normalized || t(`command.items.${command.id}`).toLocaleLowerCase().includes(normalized)
      );
    });
  }, [canCreate, query, t]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, commands.length - 1)));
  }, [commands.length]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    activeOptionRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const execute = useCallback(
    (command: CalendarCommand) => {
      if (command.id === 'create-event') onCreate('MEETING');
      else if (command.id === 'create-focus') onCreate('FOCUS');
      else if (command.id === 'create-task') onCreate('TASK');
      else if (command.id === 'create-out-of-office') onCreate('OUT_OF_OFFICE');
      else {
        const path = COMMAND_PATHS[command.id];
        if (path) onNavigate(path);
      }
      onClose();
    },
    [onClose, onCreate, onNavigate]
  );

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => (commands.length ? (current + 1) % commands.length : 0));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) =>
          commands.length ? (current - 1 + commands.length) % commands.length : 0
        );
      } else if (event.key === 'Enter' && commands[activeIndex]) {
        event.preventDefault();
        execute(commands[activeIndex]!);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [activeIndex, commands, execute, open]);

  useEffect(() => {
    if (!open) return undefined;
    let input: HTMLInputElement | null = null;
    const syncInputContract = () => {
      input =
        Array.from(document.querySelectorAll('input')).find(
          (item) => item.getAttribute('aria-label') === t('command.placeholder')
        ) ?? null;
      if (!input) return;
      input.setAttribute('role', 'combobox');
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-expanded', 'true');
      input.setAttribute('aria-controls', listboxId);
      input.setAttribute(
        'aria-activedescendant',
        commands[activeIndex] ? `${listboxId}-${commands[activeIndex]!.id}` : ''
      );
    };
    const observer = new MutationObserver(syncInputContract);
    observer.observe(document.body, { childList: true, subtree: true });
    syncInputContract();
    return () => observer.disconnect();
  }, [activeIndex, commands, listboxId, open, t]);

  return (
    <CommandPaletteDialog
      open={open}
      label={t('command.open')}
      placeholder={t('command.placeholder')}
      query={query}
      onQueryChange={setQuery}
      onClose={onClose}
    >
      <List
        id={listboxId}
        role="listbox"
        aria-label={t('command.results')}
        disablePadding
        sx={{ maxHeight: 420, overflowY: 'auto', py: 0.75 }}
      >
        {commands.map((command, index) => {
          const Icon = command.icon;
          return (
            <ListItemButton
              ref={index === activeIndex ? activeOptionRef : undefined}
              key={command.id}
              id={`${listboxId}-${command.id}`}
              role="option"
              aria-selected={index === activeIndex}
              selected={index === activeIndex}
              onMouseMove={() => setActiveIndex(index)}
              onClick={() => execute(command)}
              sx={{ minHeight: 48, mx: 0.75, borderRadius: COMPACT_RADIUS }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>
                <Icon size={18} aria-hidden="true" />
              </ListItemIcon>
              <ListItemText
                primary={t(`command.items.${command.id}`)}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 'fontWeightBold' }}
              />
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
