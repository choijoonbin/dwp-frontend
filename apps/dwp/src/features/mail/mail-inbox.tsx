import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Command, MailCheck, MailPlus, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  applyMailThreadAction,
  getMailThreads,
  snoozeMailThread,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  GuidedEmptyState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { Theme } from '@mui/material/styles';

import { MailCommandPalette, type MailCommand } from './mail-command-palette';
import { MailComposeDialog } from './mail-compose-dialog';
import { MailPageHeading, MailThreadListItem } from './mail-components';
import { MailThreadDetailPane } from './mail-thread-detail';

import type { MailThread, MailTriageLane } from '@dwp-frontend/shared-utils';

type MailboxMode = 'inbox' | 'sent' | 'drafts' | 'shared';

const LANES: readonly MailTriageLane[] = ['PRIORITY', 'NEEDS_REPLY', 'ASSIGNED', 'UPDATES'];
const PAGE_SIZE = 30;

export function MailInbox({ mode }: { mode: MailboxMode }) {
  const { t } = useTranslation('mail');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [lane, setLane] = useState<MailTriageLane>(mode === 'shared' ? 'ASSIGNED' : 'PRIORITY');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [commandOpen, setCommandOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const desktopSplitView = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));
  const selectedId = params.get('thread');
  const composeOpen = params.get('compose') === 'open';
  const folder = mode === 'sent' ? 'SENT' : mode === 'drafts' ? 'DRAFTS' : 'INBOX';
  const activeLane = mode === 'inbox' || mode === 'shared' ? lane : undefined;
  const query = useQuery({
    queryKey: ['mail', 'threads', mode, activeLane, debouncedSearch, page],
    queryFn: () =>
      getMailThreads({
        lane: activeLane,
        folder,
        sharedOnly: mode === 'shared',
        query: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (previous) => previous,
    staleTime: 20_000,
    retry: 1,
  });
  const selectedThread = query.data?.items.find((item) => item.threadId === selectedId);
  const quickMutation = useMutation({
    mutationFn: async ({ command, thread }: { command: MailCommand; thread: MailThread }) => {
      if (command === 'snooze') {
        return snoozeMailThread(
          thread.threadId,
          new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          thread.version
        );
      }
      const action = command === 'archive' ? 'ARCHIVE' : command === 'star' ? 'STAR' : 'MARK_READ';
      return applyMailThreadAction(thread.threadId, action, thread.version);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
    },
    onError: () => toast.error(t('thread.actionError')),
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(0);
    setLane(mode === 'shared' ? 'ASSIGNED' : 'PRIORITY');
  }, [mode]);

  useEffect(() => {
    if (!desktopSplitView || !query.data?.items.length) return;
    if (selectedId && query.data.items.some((item) => item.threadId === selectedId)) return;
    const next = new URLSearchParams(params);
    next.set('thread', query.data.items[0]!.threadId);
    setParams(next, { replace: true });
  }, [desktopSplitView, params, query.data?.items, selectedId, setParams]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('input, textarea, [contenteditable="true"]');
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setCommandOpen(true);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        openCompose();
      } else if (event.key.toLowerCase() === 'e' && selectedThread) {
        event.preventDefault();
        quickMutation.mutate({ command: 'archive', thread: selectedThread });
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  });

  const openCompose = () => {
    const next = new URLSearchParams(params);
    next.set('compose', 'open');
    setParams(next, { replace: true });
  };
  const closeCompose = () => {
    const next = new URLSearchParams(params);
    next.delete('compose');
    setParams(next, { replace: true });
  };
  const selectThread = (threadId: string) => {
    const next = new URLSearchParams(params);
    next.set('thread', threadId);
    setParams(next, { replace: true });
  };
  const clearSelection = () => {
    const next = new URLSearchParams(params);
    next.delete('thread');
    setParams(next, { replace: true });
  };
  const runCommand = (command: MailCommand) => {
    if (command === 'compose') return openCompose();
    if (command === 'focus-search') return searchRef.current?.focus();
    if (command === 'show-priority') return setLane('PRIORITY');
    if (command === 'show-needs-reply') return setLane('NEEDS_REPLY');
    if (selectedThread) quickMutation.mutate({ command, thread: selectedThread });
  };
  const empty = useMemo(
    () => ({
      title: t(`mailbox.${mode}.emptyTitle`),
      description: t(`mailbox.${mode}.emptyDescription`),
    }),
    [mode, t]
  );
  const pageCount = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));

  return (
    <PageCanvas topInset="compact">
      <MailPageHeading
        eyebrow={t(`mailbox.${mode}.eyebrow`)}
        title={t(`mailbox.${mode}.title`)}
        description={t(`mailbox.${mode}.description`)}
        actions={
          <Stack direction="row" spacing={1}>
            <ActionIconButton label={t('command.open')} onClick={() => setCommandOpen(true)}>
              <Command size={18} />
            </ActionIconButton>
            <ActionButton intent="primary" startIcon={<MailPlus size={17} />} onClick={openCompose}>
              {t('actions.compose')}
            </ActionButton>
          </Stack>
        }
      />

      <Box
        sx={{
          mt: 2.5,
          height: { xs: 'auto', lg: 'calc(100dvh - 190px)' },
          minHeight: { lg: 620 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 380px) minmax(0, 1fr)' },
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            minWidth: 0,
            minHeight: 0,
            display: { xs: selectedId ? 'none' : 'flex', lg: 'flex' },
            flexDirection: 'column',
            borderRight: { lg: 1 },
            borderColor: 'divider',
          }}
        >
          <Box sx={{ px: 1.5, pt: 1.5, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
            <FormField
              fullWidth
              size="small"
              value={search}
              placeholder={t('mailbox.search')}
              inputRef={searchRef}
              onChange={(event) => setSearch(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={17} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            {(mode === 'inbox' || mode === 'shared') && (
              <Tabs
                value={lane}
                onChange={(_event, value: MailTriageLane) => {
                  setLane(value);
                  setPage(0);
                }}
                variant="scrollable"
                scrollButtons={false}
                sx={{ mt: 1, minHeight: 34, '& .MuiTab-root': { minHeight: 34, px: 1.25 } }}
              >
                {LANES.map((item) => (
                  <Tab key={item} value={item} label={t(`lane.${item}`)} />
                ))}
              </Tabs>
            )}
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {query.isLoading ? (
              <Box sx={{ minHeight: 280, display: 'grid', placeItems: 'center' }}>
                <CircularProgress size={25} />
              </Box>
            ) : query.isError ? (
              <Alert
                severity="error"
                action={
                  <ActionButton intent="quiet" onClick={() => query.refetch()}>
                    {t('actions.retry')}
                  </ActionButton>
                }
                sx={{ m: 1.5 }}
              >
                {t('mailbox.loadError')}
              </Alert>
            ) : query.data?.items.length ? (
              query.data.items.map((thread) => (
                <MailThreadListItem
                  key={thread.threadId}
                  thread={thread}
                  selected={selectedId === thread.threadId}
                  onSelect={() => selectThread(thread.threadId)}
                />
              ))
            ) : (
              <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center', p: 2 }}>
                <GuidedEmptyState kind={search ? 'no-results' : 'empty'} {...empty} />
              </Box>
            )}
          </Box>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ px: 1.75, py: 1, borderTop: 1, borderColor: 'divider' }}
          >
            <Typography variant="caption" color="text.secondary">
              {t('mailbox.total', { count: query.data?.total ?? 0 })}
            </Typography>
            <Stack direction="row" spacing={0.25} alignItems="center">
              {pageCount > 1 ? (
                <>
                  <ActionIconButton
                    size="small"
                    label={t('mailbox.previousPage')}
                    disabled={page === 0}
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                  >
                    <ChevronLeft size={16} />
                  </ActionIconButton>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 48 }}>
                    {t('mailbox.page', { current: page + 1, total: pageCount })}
                  </Typography>
                  <ActionIconButton
                    size="small"
                    label={t('mailbox.nextPage')}
                    disabled={page + 1 >= pageCount}
                    onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                  >
                    <ChevronRight size={16} />
                  </ActionIconButton>
                </>
              ) : (
                <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary">
                  <MailCheck size={14} />
                  <Typography variant="caption">{t('mailbox.syncReady')}</Typography>
                </Stack>
              )}
            </Stack>
          </Stack>
        </Box>

        <Box
          sx={{
            minWidth: 0,
            minHeight: { xs: selectedId ? 'calc(100dvh - 150px)' : 0, lg: 0 },
            display: { xs: selectedId ? 'block' : 'none', lg: 'block' },
          }}
        >
          <MailThreadDetailPane
            threadId={selectedId}
            onBack={clearSelection}
            onUpdated={() => query.refetch()}
          />
        </Box>
      </Box>

      <MailComposeDialog
        open={composeOpen}
        onClose={closeCompose}
        onCompleted={(threadId, deliveryMode) => {
          if (
            (mode === 'sent' && deliveryMode === 'SEND') ||
            (mode === 'drafts' && deliveryMode === 'DRAFT')
          ) {
            selectThread(threadId);
          }
        }}
      />
      <MailCommandPalette
        open={commandOpen}
        hasSelectedThread={Boolean(selectedThread)}
        onClose={() => setCommandOpen(false)}
        onCommand={runCommand}
      />
    </PageCanvas>
  );
}
