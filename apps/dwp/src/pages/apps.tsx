import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  LifeBuoy,
  Mail,
  MessagesSquare,
  MonitorCog,
  Search,
  UsersRound,
} from 'lucide-react';
import { useToast } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import ButtonBase from '@mui/material/ButtonBase';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { referenceApps } from '../features/work-hub/reference-data';

import type { ReferenceApp } from '../features/work-hub/reference-data';

type AppFilter = 'all' | 'pinned' | 'native' | 'connected';

const iconByType = {
  productivity: Mail,
  service: LifeBuoy,
  people: UsersRound,
  knowledge: BookOpen,
  business: Building2,
  legacy: MonitorCog,
} as const;

const colorByType = {
  productivity: { bgcolor: 'primary.main', color: 'primary.contrastText' },
  service: { bgcolor: 'success.main', color: 'success.contrastText' },
  people: { bgcolor: 'secondary.main', color: 'secondary.contrastText' },
  knowledge: { bgcolor: 'info.main', color: 'info.contrastText' },
  business: { bgcolor: 'warning.main', color: 'warning.contrastText' },
  legacy: { bgcolor: 'text.secondary', color: 'background.paper' },
} as const;

function AppIcon({ app }: { app: ReferenceApp }) {
  const Icon = app.id === 'ref-app-collaboration' ? MessagesSquare : iconByType[app.type];
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 44,
        height: 44,
        flex: '0 0 44px',
        display: 'grid',
        placeItems: 'center',
        borderRadius: 1,
        ...colorByType[app.type],
      }}
    >
      <Icon size={21} strokeWidth={1.8} />
    </Box>
  );
}

export default function AppsPage() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<AppFilter>('all');
  const [query, setQuery] = useState('');
  const selectedType = searchParams.get('app');

  const visibleApps = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return referenceApps.filter((app) => {
      const filterMatch =
        filter === 'all' ||
        (filter === 'pinned' && app.pinned) ||
        (filter === 'native' && app.launchMode === 'Native') ||
        (filter === 'connected' && app.launchMode !== 'Native');
      const queryMatch =
        !normalized ||
        [app.name, app.description, app.owner].some((value) =>
          value.toLowerCase().includes(normalized)
        );
      return filterMatch && queryMatch;
    });
  }, [filter, query]);

  const changeFilter = (_event: React.MouseEvent<HTMLElement>, value: AppFilter | null) => {
    if (value) setFilter(value);
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Box>
          <Typography component="h1" variant="h4">
            Apps
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Your approved workplace applications
          </Typography>
        </Box>
        <Chip label="Reference data" variant="outlined" size="small" />
      </Box>

      <Box
        sx={{
          mt: 4,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(280px, 1fr) auto' },
          gap: 2,
          alignItems: 'center',
        }}
      >
        <TextField
          label="Search apps"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, purpose, or owner"
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
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={changeFilter}
          aria-label="App filter"
          sx={{ overflowX: 'auto', maxWidth: 1 }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="pinned">Pinned</ToggleButton>
          <ToggleButton value="native">DWP native</ToggleButton>
          <ToggleButton value="connected">Connected</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mt: 4 }}>
        <Typography component="h2" variant="h6">
          Available apps
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {visibleApps.length} apps
        </Typography>
      </Box>

      {visibleApps.length > 0 ? (
        <Box
          component="ul"
          sx={{
            p: 0,
            mt: 1,
            mb: 0,
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(3, minmax(0, 1fr))',
            },
            borderTop: 1,
            borderLeft: 1,
            borderColor: 'divider',
          }}
        >
          {visibleApps.map((app) => {
            const selected = selectedType && app.type === selectedType;
            return (
              <Box
                component="li"
                key={app.id}
                sx={{ minWidth: 0, borderRight: 1, borderBottom: 1, borderColor: 'divider' }}
              >
                <ButtonBase
                  onClick={() => toast.success(`${app.name} launch preview opened.`)}
                  sx={{
                    width: 1,
                    minHeight: 132,
                    p: 2.5,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                    textAlign: 'left',
                    bgcolor: selected ? 'action.selected' : 'background.paper',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <AppIcon app={app} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography component="p" variant="subtitle2" noWrap>
                        {app.name}
                      </Typography>
                      <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.25, minHeight: 42 }}
                    >
                      {app.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                      <Chip label={app.launchMode} size="small" variant="outlined" />
                      {app.pinned && <Chip label="Pinned" size="small" color="info" />}
                    </Box>
                  </Box>
                </ButtonBase>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box
          sx={{ py: 8, borderTop: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'center' }}
        >
          <Typography component="p" variant="subtitle1">
            No matching apps
          </Typography>
          <Button
            sx={{ mt: 1.5 }}
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            Reset filters
          </Button>
        </Box>
      )}
    </Container>
  );
}
