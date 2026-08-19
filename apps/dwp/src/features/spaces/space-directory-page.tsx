import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, Grid2X2, Layers3, Plus, Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, ActionIconButton, FormField, PageCanvas } from '@dwp-frontend/design-system';
import { getSpaces, useAuth, usePermissions } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { CreateSpaceDialog } from './create-space-dialog';
import { SpaceCard } from './space-ui';

export function SpaceDirectoryPage({ scope }: { scope: 'MY' | 'DISCOVER' }) {
  const { t } = useTranslation('spaces');
  const auth = useAuth();
  const permissions = usePermissions();
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());
  const spaces = useQuery({
    queryKey: ['spaces', 'directory', scope, deferredQuery, auth.user?.tenantId],
    queryFn: () => getSpaces(scope, deferredQuery),
    staleTime: 30_000,
  });
  const Icon = scope === 'MY' ? Layers3 : Compass;
  const canCreate =
    permissions.hasPermission('ACTION.SPACE_REQUEST', 'CREATE') ||
    permissions.hasPermission('ACTION.SPACE_REQUEST', 'MANAGE');

  return (
    <PageCanvas>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        gap={2}
      >
        <Stack direction="row" gap={1.5} alignItems="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--dwp-product-accent)',
              bgcolor: 'var(--dwp-product-selection)',
              borderRadius: 1,
            }}
          >
            <Icon size={21} />
          </Box>
          <Box>
            <Typography component="h1" variant="h5">
              {t(`directory.${scope}.title`)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(`directory.${scope}.description`)}
            </Typography>
          </Box>
        </Stack>
        {canCreate && (
          <ActionButton
            intent="primary"
            startIcon={<Plus size={17} />}
            onClick={() => setCreateOpen(true)}
          >
            {t('actions.createSpace')}
          </ActionButton>
        )}
      </Stack>

      <Paper
        component="section"
        variant="outlined"
        sx={{ mt: 3, p: 2, borderRadius: 1, bgcolor: 'background.paper' }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          gap={1.5}
        >
          <Stack direction="row" gap={1} alignItems="center">
            <Grid2X2 size={18} />
            <Typography component="h2" variant="subtitle1" fontWeight={750}>
              {t('directory.results')}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={spaces.data?.length ?? 0}
              aria-label={t('directory.resultCount')}
            />
          </Stack>
          <FormField
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            label={t('directory.search')}
            sx={{ width: { xs: 1, md: 340 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <ActionIconButton
                    size="small"
                    label={t('actions.clear')}
                    onClick={() => setQuery('')}
                  >
                    <X size={16} />
                  </ActionIconButton>
                </InputAdornment>
              ) : undefined,
            }}
          />
        </Stack>
      </Paper>

      {spaces.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('directory.loadError')}
        </Alert>
      )}
      {spaces.isLoading ? (
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 1.5,
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} variant="rounded" height={220} />
          ))}
        </Box>
      ) : spaces.data?.length ? (
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 1.5,
          }}
        >
          {spaces.data.map((space) => (
            <SpaceCard key={space.spaceId} space={space} />
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            minHeight: 300,
            mt: 2,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            borderBlock: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ maxWidth: 420, px: 2 }}>
            <Icon size={32} color="currentColor" />
            <Typography component="h2" variant="h6" sx={{ mt: 1.5 }}>
              {query ? t('directory.emptySearchTitle') : t(`directory.${scope}.emptyTitle`)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {query
                ? t('directory.emptySearchDescription')
                : t(`directory.${scope}.emptyDescription`)}
            </Typography>
          </Box>
        </Box>
      )}
      <CreateSpaceDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageCanvas>
  );
}
