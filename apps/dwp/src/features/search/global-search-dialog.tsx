import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppWindow, BookOpenText, BriefcaseBusiness, Search, Sparkles, X } from 'lucide-react';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';

import { workItems } from '../work-hub/reference-data';
import {
  createAskSearchItem,
  createGlobalSearchItems,
  filterGlobalSearchItems,
} from './global-search-model';

import type { HomeAppDefinition } from '../home/app-launchpad-model';
import type { GlobalSearchItem, GlobalSearchKind } from './global-search-model';

const resultIcon: Record<GlobalSearchKind, typeof Search> = {
  app: AppWindow,
  work: BriefcaseBusiness,
  knowledge: BookOpenText,
  ask: Sparkles,
};

const resultLabel: Record<GlobalSearchKind, string> = {
  app: 'App',
  work: 'Work',
  knowledge: 'Knowledge',
  ask: 'Ask',
};

type GlobalSearchDialogProps = {
  open: boolean;
  apps: readonly HomeAppDefinition[];
  includeWork: boolean;
  includeAsk: boolean;
  onClose: () => void;
};

export function GlobalSearchDialog({
  open,
  apps,
  includeWork,
  includeAsk,
  onClose,
}: GlobalSearchDialogProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const compactSearchLabel = useMediaQuery(theme.breakpoints.down('sm'));
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const catalog = useMemo(
    () => createGlobalSearchItems(apps, includeWork ? workItems : [], includeAsk),
    [apps, includeAsk, includeWork]
  );
  const results = useMemo(() => {
    const matches = filterGlobalSearchItems(catalog, query);
    if (!query.trim() || !includeAsk) return matches;
    return [...matches, createAskSearchItem(query)].slice(0, 8);
  }, [catalog, includeAsk, query]);

  useEffect(() => setActiveIndex(0), [query]);
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const close = () => {
    setQuery('');
    setActiveIndex(0);
    onClose();
  };
  const select = (item: GlobalSearchItem) => {
    close();
    navigate(item.route);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      select(results[activeIndex]);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      aria-labelledby="global-search-title"
      slotProps={{
        transition: {
          onEntered: () => searchInputRef.current?.focus(),
        },
        backdrop: {
          sx: {
            bgcolor: 'rgba(7, 14, 24, 0.46)',
            backdropFilter: 'blur(7px)',
            WebkitBackdropFilter: 'blur(7px)',
            '@media (prefers-reduced-transparency: reduce), (forced-colors: active)': {
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            },
          },
        },
        paper: {
          sx: {
            alignSelf: 'flex-start',
            mt: { xs: 1.5, sm: 8 },
            mx: { xs: 1.5, sm: 3 },
            width: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' },
            maxHeight: { xs: 'calc(100dvh - 24px)', sm: 'min(680px, calc(100dvh - 96px))' },
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.96),
            boxShadow: (theme) =>
              theme.palette.mode === 'dark'
                ? '0 32px 88px rgba(0, 0, 0, 0.56)'
                : '0 32px 88px rgba(18, 29, 45, 0.24)',
            backdropFilter: 'blur(30px) saturate(145%)',
            WebkitBackdropFilter: 'blur(30px) saturate(145%)',
            '@media (prefers-reduced-transparency: reduce), (forced-colors: active)': {
              bgcolor: 'background.paper',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            },
          },
        },
      }}
    >
      <Typography
        id="global-search-title"
        component="h2"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          p: 0,
          m: -1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        Search DWP
      </Typography>
      <Box sx={{ minHeight: 70, px: { xs: 1, sm: 1.5 }, display: 'flex', alignItems: 'center' }}>
        <Search size={22} strokeWidth={1.8} aria-hidden="true" />
        <InputBase
          autoFocus
          inputRef={searchInputRef}
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            compactSearchLabel ? 'Search DWP' : 'Search work, apps, services, and knowledge'
          }
          inputProps={{
            'aria-label': 'Search DWP',
            'aria-autocomplete': 'list',
            'aria-controls': 'global-search-results',
            'aria-expanded': true,
            'aria-activedescendant': results[activeIndex]
              ? `global-search-option-${activeIndex}`
              : undefined,
            role: 'combobox',
          }}
          sx={{ mx: 1.25, '& input': { py: 1.5, fontSize: { xs: 16, sm: 18 } } }}
        />
        <Tooltip title="Close search">
          <IconButton aria-label="Close search" onClick={close} size="small">
            <X size={19} strokeWidth={1.8} />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />

      <Box sx={{ overflowY: 'auto', p: { xs: 1, sm: 1.5 }, minHeight: 120 }}>
        <Typography
          component="p"
          variant="overline"
          color="text.secondary"
          sx={{ px: 1.25, py: 0.5 }}
        >
          {query.trim() ? 'Best matches' : 'Suggested'}
        </Typography>
        {results.length > 0 ? (
          <Box
            component="ul"
            id="global-search-results"
            role="listbox"
            aria-label="Search results"
            sx={{ p: 0, m: 0, listStyle: 'none' }}
          >
            {results.map((item, index) => {
              const Icon = resultIcon[item.kind];
              const selected = index === activeIndex;
              return (
                <Box component="li" key={item.id} role="presentation">
                  <ButtonBase
                    id={`global-search-option-${index}`}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onClick={() => select(item)}
                    sx={{
                      width: 1,
                      minHeight: 62,
                      px: 1.25,
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '38px minmax(0, 1fr)',
                        sm: '38px minmax(0, 1fr) auto',
                      },
                      gap: 1.25,
                      alignItems: 'center',
                      borderRadius: 1,
                      textAlign: 'left',
                      bgcolor: selected ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 36,
                        height: 36,
                        display: 'grid',
                        placeItems: 'center',
                        border: 1,
                        borderColor: selected ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        color: selected ? 'primary.main' : 'text.secondary',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        component="p"
                        variant="subtitle2"
                        noWrap
                        color={selected ? 'text.primary' : undefined}
                      >
                        {item.title}
                      </Typography>
                      <Typography component="p" variant="caption" color="text.secondary" noWrap>
                        {item.description}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ px: 0.5, display: { xs: 'none', sm: 'block' } }}
                    >
                      {resultLabel[item.kind]}
                    </Typography>
                  </ButtonBase>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box sx={{ minHeight: 96, display: 'grid', placeItems: 'center' }}>
            <Typography color="text.secondary">No results</Typography>
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
