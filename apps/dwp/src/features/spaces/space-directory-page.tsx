import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Compass, Grid2X2, Layers3, Plus, Search, X } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  FormField,
  PageCanvas,
} from '@dwp-frontend/design-system';
import { getSpaces, useAuth, usePermissions } from '@dwp-frontend/shared-utils';
import { hasFullTenantAdminRole } from '@dwp-frontend/shared-utils/auth/control-plane-access';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { CreateSpaceDialog } from './create-space-dialog';
import { SpaceCard } from './space-ui';

export function SpaceDirectoryPage({ scope }: { scope: 'MY' | 'DISCOVER' }) {
  const { t } = useTranslation('spaces');
  const auth = useAuth();
  const permissions = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const setQuery = (value: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set('q', value);
        else next.delete('q');
        return next;
      },
      { replace: true }
    );
  };
  const [createOpen, setCreateOpen] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());
  const spaces = useQuery({
    queryKey: ['spaces', 'directory', scope, deferredQuery, auth.user?.tenantId, auth.user?.userId],
    queryFn: () => getSpaces(scope, deferredQuery),
    staleTime: 30_000,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[2] === scope &&
      previousQuery.queryKey[4] === auth.user?.tenantId &&
      previousQuery.queryKey[5] === auth.user?.userId
        ? keepPreviousData(previousData)
        : undefined,
    retry: 1,
  });
  const updating = spaces.isFetching || query.trim() !== deferredQuery;
  const Icon = scope === 'MY' ? Layers3 : Compass;
  const isTenantAdministrator = hasFullTenantAdminRole(auth.user?.roles ?? []);
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
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--dwp-product-accent)',
              bgcolor: 'var(--dwp-product-selection)',
              borderRadius: 1,
            }}
          >
            <Icon size={21} />
          </Box>
          <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            <Typography component="h1" variant="h5">
              {t(`directory.${scope}.title`)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                scope === 'DISCOVER' && isTenantAdministrator
                  ? 'directory.DISCOVER.adminDescription'
                  : `directory.${scope}.description`
              )}
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

      <Box
        component="section"
        aria-labelledby="space-directory-results"
        sx={{ mt: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          gap={1.5}
        >
          <Stack direction="row" gap={1} alignItems="center">
            <Grid2X2 size={18} />
            <Typography
              id="space-directory-results"
              component="h2"
              variant="subtitle1"
              fontWeight={750}
            >
              {t('directory.results')}
            </Typography>
            <Box role="status" aria-live="polite" aria-atomic="true">
              {updating ? (
                <Typography variant="caption" color="text.secondary">
                  {t('directory.searching')}
                </Typography>
              ) : spaces.isSuccess ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={spaces.data.length}
                  aria-label={t('directory.resultCount', { count: spaces.data.length })}
                />
              ) : null}
            </Box>
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
      </Box>

      {spaces.isError && spaces.data && (
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          action={
            <ActionButton
              intent="secondary"
              onClick={() => void spaces.refetch()}
              loading={spaces.isFetching}
            >
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('directory.refreshError')}
        </Alert>
      )}
      {spaces.isError && !spaces.data ? (
        <ErrorState
          title={t('directory.loadError')}
          retryLabel={t('actions.retry')}
          onRetry={() => void spaces.refetch()}
          retrying={spaces.isFetching}
          size="page"
        />
      ) : spaces.isLoading ? (
        <Box
          aria-label={t('directory.searching')}
          aria-busy="true"
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
          aria-busy={updating}
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
      ) : updating ? null : (
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
