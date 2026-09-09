import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LockKeyhole, MessageSquarePlus, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  ErrorState,
  FormField,
  GuidedEmptyState,
  foundationTokens,
  InlineFeedback,
  LoadingState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  deleteDwaionConversation,
  getDwaionConversation,
  getDwaionConversations,
  type DwaionConversationSummary,
} from '@dwp-frontend/shared-utils';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import { DwaionArchiveDetail, DwaionArchivePrivacyNotice } from './dwaion-archive-detail';
import { DwaionArchiveList } from './dwaion-archive-list';
import { archiveConversations, type ArchivePeriod } from './dwaion-archive-model';
import { DwaionArchiveRename } from './dwaion-archive-rename';
import { useDwaionArchiveView } from './dwaion-archive-view';
import { conversationCopy } from './dwaion-conversation-copy';
import { DWAION_CONVERSATION_SEARCH_FOCUS_EVENT } from './dwaion-mobile-shell-profile';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';

export function DwaionConversations() {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const runDeleteMutation = useDwaionGovernedMutation(
    'route.dwaion.work.conversation-delete.action'
  );
  const copy = conversationCopy(locale);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [renameTarget, setRenameTarget] = useState<DwaionConversationSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DwaionConversationSummary | null>(null);
  const actionTrigger = useRef<HTMLElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const restoreActionFocus = () =>
    requestAnimationFrame(() => {
      const target = actionTrigger.current?.isConnected
        ? actionTrigger.current
        : searchInput.current;
      target?.focus({ preventScroll: true });
    });

  const conversations = useQuery({
    queryKey: ['dwaion', 'conversations'],
    queryFn: getDwaionConversations,
    staleTime: 20_000,
  });
  const {
    view: { search, period, sort },
    updateView,
    rememberScroll,
  } = useDwaionArchiveView(conversations.isSuccess);
  const setSearch = (value: string) => updateView({ search: value, scrollY: 0 });
  const setPeriod = (value: ArchivePeriod) => updateView({ period: value, scrollY: 0 });
  const now = Math.max(Date.now(), conversations.dataUpdatedAt);
  const items = conversations.isError ? [] : (conversations.data ?? []);
  const filtered = archiveConversations(items, search, period, sort, now);
  const selected = filtered.find((item) => item.conversationId === selectedId) ?? filtered[0];
  const desktopInspector = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));
  const periodCounts = {
    all: items.length,
    day: archiveConversations(items, '', 'day', 'recent', now).length,
    week: archiveConversations(items, '', 'week', 'recent', now).length,
    month: archiveConversations(items, '', 'month', 'recent', now).length,
    hold: archiveConversations(items, '', 'hold', 'recent', now).length,
  } satisfies Record<ArchivePeriod, number>;

  useEffect(() => {
    if (selected?.conversationId !== selectedId) setSelectedId(selected?.conversationId);
  }, [selected?.conversationId, selectedId]);

  useEffect(() => {
    const focusSearch = () => searchInput.current?.focus({ preventScroll: false });
    const focusSearchFromKeyboard = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLocaleLowerCase() !== 'f') return;
      event.preventDefault();
      focusSearch();
    };
    globalThis.addEventListener(DWAION_CONVERSATION_SEARCH_FOCUS_EVENT, focusSearch);
    globalThis.addEventListener('keydown', focusSearchFromKeyboard);
    return () => {
      globalThis.removeEventListener(DWAION_CONVERSATION_SEARCH_FOCUS_EVENT, focusSearch);
      globalThis.removeEventListener('keydown', focusSearchFromKeyboard);
    };
  }, []);

  const selectedDetail = useQuery({
    queryKey: ['dwaion', 'conversation-preview', selected?.conversationId],
    queryFn: () => getDwaionConversation(selected!.conversationId),
    enabled: Boolean(selected && desktopInspector),
    staleTime: 20_000,
    retry: false,
  });

  const deleteConversation = useMutation({
    mutationFn: (id: string) =>
      runDeleteMutation((authority) => deleteDwaionConversation(id, authority)),
    onSuccess: async (_, id) => {
      setDeleteTarget(null);
      if (selectedId === id) setSelectedId(undefined);
      restoreActionFocus();
      queryClient.removeQueries({ queryKey: ['dwaion', 'conversation', id] });
      queryClient.removeQueries({ queryKey: ['dwaion', 'conversation-preview', id] });
      queryClient.removeQueries({ queryKey: ['dwaion', 'conversation-resolution', id] });
      queryClient.setQueryData<DwaionConversationSummary[]>(['dwaion', 'conversations'], (value) =>
        value?.filter((item) => item.conversationId !== id)
      );
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'conversations'] });
    },
  });
  const hasFilter = Boolean(search.trim()) || period !== 'all';
  const resetFilters = () => {
    setSearch('');
    setPeriod('all');
  };
  const deleteStatus =
    deleteConversation.error instanceof HttpError ? deleteConversation.error.status : undefined;

  return (
    <PageCanvas topInset="compact">
      <Box
        data-testid="dwaion-archive"
        sx={{
          minWidth: 0,
          pt: 0,
        }}
      >
        <Stack
          component="header"
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          gap={2}
          alignItems={{ md: 'center' }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
              <Stack direction="row" gap={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                <Typography
                  component="h1"
                  sx={{
                    fontSize: (theme) => ({
                      xs: theme.typography.h5.fontSize,
                      md: theme.typography.h4.fontSize,
                    }),
                    lineHeight: 'typography.h4.lineHeight',
                    fontWeight: 'fontWeightBold',
                    letterSpacing: 'typography.h4.letterSpacing',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('dwaionConversations.title')}
                </Typography>
                <Chip
                  size="small"
                  label={
                    <>
                      <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>
                        {copy.mobileCount.replace('{{count}}', String(items.length))}
                      </Box>
                      <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                        {copy.archiveCount.replace('{{count}}', String(items.length))}
                      </Box>
                    </>
                  }
                  sx={{
                    height: { xs: 22, md: 24 },
                    bgcolor: 'var(--dwp-product-soft)',
                    color: 'primary.main',
                    fontWeight: 'fontWeightBold',
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              </Stack>
              <Chip
                size="small"
                icon={
                  <Box
                    component="span"
                    sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'success.main' }}
                  />
                }
                label={copy.encryption}
                sx={{
                  display: { xs: 'flex', md: 'none' },
                  height: 24,
                  bgcolor: 'var(--dwp-product-soft)',
                  '& .MuiChip-icon': { ml: 1 },
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            </Stack>
            <Stack direction="row" gap={0.75} alignItems="center" sx={{ mt: 0.25 }}>
              <ShieldCheck size={16} color="var(--dwp-product-accent)" aria-hidden="true" />
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
                <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>
                  {copy.mobileScope.replace('{{count}}', String(items.length))}
                </Box>
                <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                  {t('dwaionConversations.description')}
                </Box>
              </Typography>
            </Stack>
          </Box>
          <Stack
            direction="row"
            useFlexGap
            flexWrap="wrap"
            gap={1}
            alignItems="center"
            sx={{ display: { xs: 'none', md: 'flex' } }}
          >
            <Chip
              icon={<ShieldCheck size={15} />}
              label={copy.compliance}
              sx={{ display: { xs: 'none', lg: 'flex' }, maxWidth: 420 }}
            />
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
          aria-label={copy.compliance}
          sx={{
            mt: 2.25,
            px: 2,
            py: 1.25,
            borderRadius: foundationTokens.radius.surface + foundationTokens.radius.compact + 'px',
            bgcolor: 'var(--dwp-product-soft)',
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            gap: 1,
          }}
        >
          <ShieldCheck size={18} aria-hidden="true" />
          <Typography variant="body2" color="text.secondary">
            {copy.securityStrip.replace('{{count}}', String(items.length))}
          </Typography>
        </Box>

        <Box
          component="section"
          aria-label={t('dwaionConversations.searchLabel')}
          sx={{
            mt: { xs: 1.5, md: 2 },
            p: { xs: 0, md: 2 },
            border: { xs: 0, md: '1px solid var(--mui-palette-divider)' },
            borderRadius: {
              md: foundationTokens.radius.surface + foundationTokens.radius.compact + 'px',
            },
            bgcolor: { md: 'background.paper' },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: 'minmax(220px, 1fr) minmax(288px, auto) minmax(145px, 170px) auto',
              },
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <FormField
              fullWidth
              size="small"
              inputRef={searchInput}
              label={t('dwaionConversations.searchLabel')}
              placeholder={t('dwaionConversations.searchPlaceholder')}
              value={search}
              sx={{
                gridColumn: { xs: '1 / -1', md: 'auto' },
                '& .MuiInputLabel-root': {
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  p: 0,
                  m: -1,
                  overflow: 'hidden',
                  clip: 'rect(0 0 0 0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                },
                '& .MuiOutlinedInput-root': {
                  minHeight: 44,
                  borderRadius: {
                    xs: foundationTokens.radius.surface * 125 + 'px',
                    md: foundationTokens.radius.surface + 'px',
                  },
                  bgcolor: 'background.paper',
                  boxShadow: (theme) => ({ xs: theme.shadows[1], md: 'none' }),
                },
                '& .MuiOutlinedInput-notchedOutline legend': { width: 0 },
              }}
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
                  endAdornment: (
                    <InputAdornment position="end">
                      {search ? (
                        <ActionIconButton
                          size="small"
                          label={t('dwaionArchive.clearSearch')}
                          onClick={() => setSearch('')}
                        >
                          <X size={14} />
                        </ActionIconButton>
                      ) : (
                        <Box
                          component="kbd"
                          aria-hidden="true"
                          sx={{
                            display: { xs: 'none', md: 'inline-flex' },
                            px: 0.7,
                            py: 0.25,
                            borderRadius: foundationTokens.radius.control + 'px',
                            bgcolor: 'action.hover',
                            color: 'text.secondary',
                            fontSize: (theme) => theme.typography.pxToRem(11),
                            fontFamily: foundationTokens.font.ui,
                          }}
                        >
                          {copy.findShortcut}
                        </Box>
                      )}
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Tabs
              value={period}
              onChange={(_, value: ArchivePeriod) => setPeriod(value)}
              aria-label={t('dwaionArchive.periodLabel')}
              sx={{
                display: { xs: 'none', md: 'flex' },
                minHeight: 42,
                maxWidth: '100%',
                '& .MuiTabs-flexContainer': { gap: 0 },
                '& .MuiTab-root': {
                  minHeight: 42,
                  minWidth: 72,
                  px: 1.25,
                  color: 'text.secondary',
                },
                '& .MuiTab-root.Mui-selected': {
                  color: 'primary.main',
                },
              }}
            >
              {(['all', 'day', 'week', 'month'] as const).map((value) => (
                <Tab
                  key={value}
                  value={value}
                  aria-label={t(`dwaionArchive.period.${value}`)}
                  label={`${t(`dwaionArchive.period.${value}`)} (${periodCounts[value]})`}
                />
              ))}
              <Tab value="hold" label="" sx={{ display: 'none' }} />
            </Tabs>
            <SelectField
              fullWidth
              size="small"
              label={t('dwaionArchive.sortLabel')}
              value={sort}
              onValueChange={(value) => {
                if (value) updateView({ sort: value, scrollY: 0 });
              }}
              options={(['recent', 'oldest', 'messages', 'evidence'] as const).map((value) => ({
                value,
                label: t(`dwaionArchive.sort.${value}`),
              }))}
              sx={{
                display: { xs: 'none', md: 'block' },
                minWidth: 0,
              }}
            />
            <Typography
              role="status"
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'right' }}
            >
              {copy.filteredCount
                .replace('{{count}}', String(filtered.length))
                .replace('{{total}}', String(items.length))}
            </Typography>
            <Box
              sx={{
                display: { xs: 'block', md: 'none' },
                gridColumn: '1 / -1',
                maxWidth: '100%',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              <Stack direction="row" gap={0.75} alignItems="center" sx={{ width: 'max-content' }}>
                <Tabs
                  value={period}
                  onChange={(_, value: ArchivePeriod) => setPeriod(value)}
                  aria-label={t('dwaionArchive.periodLabel')}
                  sx={{
                    minHeight: 40,
                    '& .MuiTabs-indicator': { display: 'none' },
                    '& .MuiTabs-flexContainer': { gap: 0.75 },
                    '& .MuiTab-root': {
                      minHeight: 40,
                      minWidth: 0,
                      px: 1.35,
                      borderRadius: foundationTokens.radius.surface * 125 + 'px',
                      bgcolor: 'action.hover',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    },
                    '& .MuiTab-root.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                    },
                  }}
                >
                  {(['all', 'day', 'week', 'hold'] as const).map((value) => (
                    <Tab
                      key={value}
                      value={value}
                      aria-label={t(`dwaionArchive.period.${value}`)}
                      icon={value === 'hold' ? <LockKeyhole size={15} /> : undefined}
                      iconPosition="start"
                      label={`${t(`dwaionArchive.period.${value}`)} ${periodCounts[value]}`}
                    />
                  ))}
                  <Tab value="month" label="" sx={{ display: 'none' }} />
                </Tabs>
                <SelectField
                  size="small"
                  label={t('dwaionArchive.sortLabel')}
                  value={sort}
                  onValueChange={(value) => {
                    if (value) updateView({ sort: value, scrollY: 0 });
                  }}
                  options={(['recent', 'oldest', 'messages', 'evidence'] as const).map((value) => ({
                    value,
                    label: t(`dwaionArchive.sort.${value}`),
                  }))}
                  sx={{
                    width: 116,
                    flexShrink: 0,
                    ml: 6,
                    '& .MuiInputLabel-root': {
                      position: 'absolute',
                      width: 1,
                      height: 1,
                      p: 0,
                      m: -1,
                      overflow: 'hidden',
                      clip: 'rect(0 0 0 0)',
                      whiteSpace: 'nowrap',
                    },
                    '& .MuiOutlinedInput-root': {
                      minHeight: 40,
                      borderRadius: foundationTokens.radius.surface * 125 + 'px',
                    },
                    '& .MuiOutlinedInput-notchedOutline legend': { width: 0 },
                  }}
                />
              </Stack>
            </Box>
          </Box>
        </Box>

        {conversations.isError ? (
          <InlineFeedback
            severity="error"
            sx={{ mt: 2 }}
            action={
              <ActionButton intent="quiet" onClick={() => void conversations.refetch()}>
                {t('dwaionStudio.retry')}
              </ActionButton>
            }
          >
            {t('dwaionConversations.loadError')}
          </InlineFeedback>
        ) : conversations.isLoading ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(320px, .95fr)' },
              gap: 2,
              mt: { xs: 1.25, md: 2 },
            }}
            aria-label={t('askPage.history.loading')}
          >
            <LoadingState
              label={t('askPage.history.loading')}
              variant="skeleton"
              embedded
              skeletonHeights={[136, 136, 136, 136]}
            />
            <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
              <LoadingState
                label={t('askPage.history.loading')}
                variant="skeleton"
                embedded
                skeletonHeights={[520]}
              />
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                lg: 'minmax(0, 2fr) minmax(320px, .95fr)',
              },
              gap: 2,
              mt: { xs: 1.5, md: 2 },
              alignItems: 'start',
            }}
          >
            <Box
              component="section"
              aria-label={t('dwaionConversations.title')}
              sx={{ minWidth: 0 }}
            >
              {filtered.length ? (
                <DwaionArchiveList
                  items={filtered}
                  selectedId={selected?.conversationId}
                  onSelect={(item) => {
                    setSelectedId(item.conversationId);
                  }}
                  onOpen={rememberScroll}
                  onRename={(item, trigger) => {
                    actionTrigger.current = trigger;
                    setRenameTarget(item);
                  }}
                  onDelete={(item, trigger) => {
                    actionTrigger.current = trigger;
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
              <Box sx={{ display: { xs: 'block', lg: 'none' }, mt: 2 }}>
                <DwaionArchivePrivacyNotice />
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: { xs: 'none', md: 'block' }, mt: 2 }}
              >
                {t('dwaionArchive.window')}
              </Typography>
            </Box>
            <Box sx={{ display: { xs: 'none', lg: 'block' }, position: 'sticky', top: 80 }}>
              <DwaionArchiveDetail
                item={selected}
                detail={selectedDetail.data}
                loading={selectedDetail.isLoading}
                error={selectedDetail.isError}
                onOpen={rememberScroll}
              />
            </Box>
          </Box>
        )}

        {renameTarget && (
          <DwaionArchiveRename
            key={renameTarget.conversationId}
            target={renameTarget}
            onClose={() => {
              setRenameTarget(null);
              restoreActionFocus();
            }}
          />
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
          onClose={() => {
            setDeleteTarget(null);
            restoreActionFocus();
          }}
          onConfirm={() => {
            if (deleteTarget) deleteConversation.mutate(deleteTarget.conversationId);
          }}
        />
      </Box>
    </PageCanvas>
  );
}
