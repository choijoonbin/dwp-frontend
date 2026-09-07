import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquarePlus, RefreshCw, Search, X } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  ErrorState,
  FormField,
  GuidedEmptyState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  deleteDwaionConversation,
  getDwaionConversations,
  type DwaionConversationSummary,
} from '@dwp-frontend/shared-utils';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { archiveConversations, type ArchivePeriod, type ArchiveSort } from './dwaion-archive-model';
import { DwaionArchiveList } from './dwaion-archive-list';
import { DwaionArchiveInsights } from './dwaion-archive-insights';

export function DwaionConversations() {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<ArchivePeriod>('all');
  const [sort, setSort] = useState<ArchiveSort>('recent');
  const [deleteTarget, setDeleteTarget] = useState<DwaionConversationSummary | null>(null);
  const conversations = useQuery({
    queryKey: ['dwaion', 'conversations'],
    queryFn: getDwaionConversations,
    staleTime: 20_000,
  });
  const deleteConversation = useMutation({
    mutationFn: (id: string) => deleteDwaionConversation(id),
    onSuccess: async (_, id) => {
      setDeleteTarget(null);
      queryClient.removeQueries({ queryKey: ['dwaion', 'conversation', id], exact: true });
      queryClient.setQueryData<DwaionConversationSummary[]>(['dwaion', 'conversations'], (items) =>
        items?.filter((item) => item.conversationId !== id)
      );
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'conversations'] });
    },
  });
  const now = Math.max(Date.now(), conversations.dataUpdatedAt);
  const items = conversations.isError ? [] : (conversations.data ?? []);
  const filtered = archiveConversations(items, search, period, sort, now);
  const hasFilter = Boolean(search.trim()) || period !== 'all';
  const resetFilters = () => {
    setSearch('');
    setPeriod('all');
  };
  const deleteStatus =
    deleteConversation.error instanceof HttpError ? deleteConversation.error.status : undefined;

  return (
    <PageCanvas topInset="compact">
      <Box data-testid="dwaion-archive" sx={{ maxWidth: 1480, mx: 'auto' }}>
        <Stack
          component="header"
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          gap={2}
          alignItems={{ sm: 'center' }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h1" variant="h5">
              {t('dwaionConversations.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {t('dwaionConversations.description')}
            </Typography>
          </Box>
          <Stack direction="row" gap={1} alignItems="center">
            <ActionIconButton
              label={t('dwaionArchive.refresh')}
              disabled={conversations.isFetching}
              onClick={() => void conversations.refetch()}
            >
              <RefreshCw size={17} />
            </ActionIconButton>
            <ActionButton
              intent="primary"
              startIcon={<MessageSquarePlus size={16} />}
              onClick={() => navigate('/dwaion/new')}
            >
              {t('dwaionConversations.new')}
            </ActionButton>
          </Stack>
        </Stack>
        <Box
          component="section"
          aria-label={t('dwaionConversations.searchLabel')}
          sx={{ mt: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) 180px' },
              gap: 1.5,
            }}
          >
            <FormField
              fullWidth
              size="small"
              label={t('dwaionConversations.searchLabel')}
              placeholder={t('dwaionConversations.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setSearch('');
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} />
                    </InputAdornment>
                  ),
                  endAdornment: search ? (
                    <InputAdornment position="end">
                      <ActionIconButton
                        size="small"
                        label={t('dwaionArchive.clearSearch')}
                        onClick={() => setSearch('')}
                      >
                        <X size={14} />
                      </ActionIconButton>
                    </InputAdornment>
                  ) : undefined,
                },
              }}
            />
            <SelectField
              fullWidth
              size="small"
              label={t('dwaionArchive.sortLabel')}
              value={sort}
              onValueChange={(value) => {
                if (value) setSort(value);
              }}
              options={(['recent', 'oldest', 'messages'] as const).map((value) => ({
                value,
                label: t(`dwaionArchive.sort.${value}`),
              }))}
            />
          </Box>
          <Tabs
            value={period}
            onChange={(_, value: ArchivePeriod) => setPeriod(value)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label={t('dwaionArchive.periodLabel')}
            sx={{ mt: 1.5, minHeight: 42, '& .MuiTab-root': { minHeight: 42, minWidth: 70 } }}
          >
            {(['all', 'day', 'week', 'month'] as const).map((value) => (
              <Tab key={value} value={value} label={t(`dwaionArchive.period.${value}`)} />
            ))}
          </Tabs>
        </Box>
        {conversations.isError ? (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            action={
              <ActionButton intent="quiet" onClick={() => void conversations.refetch()}>
                {t('dwaionStudio.retry')}
              </ActionButton>
            }
          >
            {t('dwaionConversations.loadError')}
          </Alert>
        ) : conversations.isLoading ? (
          <Stack spacing={1} sx={{ mt: 2 }} aria-label={t('askPage.history.loading')}>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} variant="rounded" height={120} />
            ))}
          </Stack>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 280px' },
              gap: 3,
              mt: 2.5,
            }}
          >
            <Box
              component="section"
              aria-label={t('dwaionConversations.title')}
              sx={{ minWidth: 0 }}
            >
              <Typography
                role="status"
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1.5 }}
              >
                {t('dwaionArchive.results', { count: filtered.length, total: items.length })}
              </Typography>
              {filtered.length ? (
                <DwaionArchiveList
                  items={filtered}
                  onDelete={(item) => {
                    deleteConversation.reset();
                    setDeleteTarget(item);
                  }}
                />
              ) : (
                <GuidedEmptyState
                  kind={hasFilter ? 'no-results' : 'empty'}
                  title={t(
                    hasFilter
                      ? 'dwaionConversations.noResultsTitle'
                      : 'dwaionConversations.emptyTitle'
                  )}
                  description={t(
                    hasFilter ? 'dwaionArchive.noResults' : 'dwaionConversations.emptyDescription'
                  )}
                  actionLabel={t(
                    hasFilter ? 'dwaionArchive.resetFilters' : 'dwaionConversations.new'
                  )}
                  onAction={hasFilter ? resetFilters : () => navigate('/dwaion/new')}
                />
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                {t('dwaionArchive.window')}
              </Typography>
            </Box>
            <DwaionArchiveInsights items={items} now={now} />
          </Box>
        )}
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title={t('dwaionConversations.deleteTitle')}
          description={t('dwaionConversations.deleteDescription')}
          details={
            <>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {deleteTarget?.title}
              </Typography>
              {deleteConversation.isError && (
                <ErrorState
                  size="compact"
                  title={t(
                    deleteStatus === 409
                      ? 'dwaionArchive.deleteHeld'
                      : deleteStatus === 404
                        ? 'dwaionArchive.deleteMissing'
                        : 'dwaionArchive.deleteError'
                  )}
                />
              )}
            </>
          }
          cancelLabel={t('dwaionConversations.cancel')}
          confirmLabel={t('dwaionConversations.confirmDelete')}
          confirmingLabel={t('dwaionConversations.deleting')}
          busy={deleteConversation.isPending}
          intent="danger"
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (deleteTarget) deleteConversation.mutate(deleteTarget.conversationId);
          }}
        />
      </Box>
    </PageCanvas>
  );
}
