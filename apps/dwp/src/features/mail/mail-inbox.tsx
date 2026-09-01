import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  Command,
  FolderTree,
  MailCheck,
  MailPlus,
  Search,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  applyMailThreadAction,
  applyMailLifecycle,
  dwaionHandoffStrings,
  dwaionHandoffText,
  getMailThreads,
  getMailOrganization,
  parseDwaionHandoff,
  snoozeMailThread,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  GuidedEmptyState,
  LoadingState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { Theme } from '@mui/material/styles';

import { MailCommandPalette, type MailCommand } from './mail-command-palette';
import { MailComposeDialog } from './mail-compose-dialog';
import { MailPageHeading, MailThreadListItem } from './mail-components';
import { isMailShortcutTargetInteractive } from './mail-keyboard';
import { MailLifecycleUndo, type MailLifecycleUndoState } from './mail-lifecycle-undo';
import { MailSnoozeDialog } from './mail-snooze-dialog';
import { MailThreadDetailPane } from './mail-thread-detail';

import type { MailThread, MailTriageLane } from '@dwp-frontend/shared-utils';

type MailboxMode = 'inbox' | 'sent' | 'drafts' | 'archive' | 'spam' | 'trash' | 'custom' | 'shared';
type MailQuickCommand = Extract<MailCommand, 'mark-read' | 'star' | 'archive'>;

const LANES: readonly MailTriageLane[] = ['PRIORITY', 'NEEDS_REPLY', 'ASSIGNED', 'UPDATES'];
const PAGE_SIZE = 30;

function resolveLane(value: string | null, mode: MailboxMode): MailTriageLane {
  if (value && LANES.includes(value as MailTriageLane)) return value as MailTriageLane;
  return mode === 'shared' ? 'ASSIGNED' : 'PRIORITY';
}

export function MailInbox({ mode }: { mode: MailboxMode }) {
  const { t } = useTranslation('mail');
  const toast = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const lane = resolveLane(params.get('lane'), mode);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [commandOpen, setCommandOpen] = useState(false);
  const [snoozeTarget, setSnoozeTarget] = useState<MailThread | null>(null);
  const [undoState, setUndoState] = useState<MailLifecycleUndoState | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const desktopSplitView = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));
  const selectedId = params.get('thread');
  const composeOpen = params.get('compose') === 'open';
  const requestedFolderId = params.get('folderId');
  const [dwaionHandoff, setDwaionHandoff] = useState(() =>
    parseDwaionHandoff(location.state, 'MAIL.DRAFT.CREATE')
  );
  const organizationQuery = useQuery({
    queryKey: ['mail', 'organization'],
    queryFn: getMailOrganization,
    enabled: mode === 'custom',
    staleTime: 30_000,
    retry: 1,
  });
  const customFolders = useMemo(
    () => organizationQuery.data?.folders.filter((item) => item.folderType === 'CUSTOM') ?? [],
    [organizationQuery.data?.folders]
  );
  const selectedCustomFolder = customFolders.find((item) => item.folderId === requestedFolderId);
  const folder =
    mode === 'sent'
      ? 'SENT'
      : mode === 'drafts'
        ? 'DRAFTS'
        : mode === 'archive'
          ? 'ARCHIVE'
          : mode === 'spam'
            ? 'SPAM'
            : mode === 'trash'
              ? 'TRASH'
              : mode === 'custom'
                ? undefined
                : 'INBOX';
  const snoozedView = mode === 'inbox' && params.get('state') === 'SNOOZED';
  const state = snoozedView
    ? 'SNOOZED'
    : mode === 'archive'
      ? 'ARCHIVED'
      : mode === 'spam'
        ? 'SPAM'
        : mode === 'trash'
          ? 'TRASHED'
          : undefined;
  const activeLane = (mode === 'inbox' || mode === 'shared') && !snoozedView ? lane : undefined;
  const mailboxCopyKey = snoozedView ? 'later' : mode;
  const query = useQuery({
    queryKey: [
      'mail',
      'threads',
      mode,
      activeLane,
      state,
      requestedFolderId,
      debouncedSearch,
      page,
    ],
    queryFn: () =>
      getMailThreads({
        lane: activeLane,
        state,
        folder,
        folderId: mode === 'custom' ? (requestedFolderId ?? undefined) : undefined,
        sharedOnly: mode === 'shared',
        query: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (previous) => previous,
    enabled: mode !== 'custom' || Boolean(requestedFolderId),
    staleTime: 20_000,
    retry: 1,
  });
  const selectedThread = query.data?.items.find((item) => item.threadId === selectedId);
  const contextKey = [mode, activeLane, state, requestedFolderId, debouncedSearch, page].join('|');
  const previousContextRef = useRef(contextKey);
  const quickMutation = useMutation({
    mutationFn: async ({ command, thread }: { command: MailQuickCommand; thread: MailThread }) => {
      if (command === 'archive') {
        return {
          command,
          result: await applyMailLifecycle(thread.threadId, 'ARCHIVE', thread.version),
        } as const;
      }
      const action = command === 'star' ? 'STAR' : 'MARK_READ';
      return {
        command,
        result: await applyMailThreadAction(thread.threadId, action, thread.version),
      } as const;
    },
    onSuccess: async ({ command, result }) => {
      if (command === 'archive' && 'deleted' in result && result.thread) {
        setUndoState({ action: 'ARCHIVE', thread: result.thread });
        clearSelection();
      }
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
    },
    onError: () => toast.error(t('thread.actionError')),
  });
  const snoozeMutation = useMutation({
    mutationFn: (until: string) => {
      if (!snoozeTarget) throw new Error('Mail snooze target is required.');
      return snoozeMailThread(snoozeTarget.threadId, until, snoozeTarget.version);
    },
    onSuccess: async () => {
      setSnoozeTarget(null);
      clearSelection();
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      toast.success(t('thread.snoozed'));
    },
    onError: () => toast.error(t('thread.actionError')),
  });

  useEffect(() => {
    const nextHandoff = parseDwaionHandoff(location.state, 'MAIL.DRAFT.CREATE');
    if (nextHandoff) setDwaionHandoff(nextHandoff);
  }, [location.state]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [mode]);

  useEffect(() => {
    if (previousContextRef.current === contextKey) return;
    previousContextRef.current = contextKey;
    if (!selectedId) return;
    const next = new URLSearchParams(params);
    next.delete('thread');
    setParams(next, { replace: true });
  }, [contextKey, params, selectedId, setParams]);

  useEffect(() => {
    if (mode !== 'custom' || requestedFolderId || !customFolders[0]) return;
    const next = new URLSearchParams(params);
    next.set('folderId', customFolders[0].folderId);
    setParams(next, { replace: true });
  }, [customFolders, mode, params, requestedFolderId, setParams]);

  useEffect(() => {
    if (!desktopSplitView || query.isFetching || !query.data?.items.length) return;
    if (selectedId && query.data.items.some((item) => item.threadId === selectedId)) return;
    const next = new URLSearchParams(params);
    next.set('thread', query.data.items[0]!.threadId);
    setParams(next, { replace: true });
  }, [desktopSplitView, params, query.data?.items, query.isFetching, selectedId, setParams]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setCommandOpen(true);
        return;
      }
      if (
        isMailShortcutTargetInteractive(event.target) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
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
    setDwaionHandoff(null);
    const next = new URLSearchParams(params);
    next.delete('compose');
    setParams(next, { replace: true, state: null });
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
  const selectLane = (nextLane: MailTriageLane) => {
    const next = new URLSearchParams(params);
    next.set('lane', nextLane);
    next.delete('state');
    next.delete('thread');
    setPage(0);
    setParams(next, { replace: true });
  };
  const runCommand = (command: MailCommand) => {
    if (command === 'compose') return openCompose();
    if (command === 'focus-search') return searchRef.current?.focus();
    if (command === 'show-priority') return selectLane('PRIORITY');
    if (command === 'show-needs-reply') return selectLane('NEEDS_REPLY');
    if (command === 'snooze') {
      if (selectedThread) setSnoozeTarget(selectedThread);
      return;
    }
    if (selectedThread) quickMutation.mutate({ command, thread: selectedThread });
  };
  const empty = useMemo(
    () => ({
      title: t(`mailbox.${mailboxCopyKey}.emptyTitle`),
      description: t(`mailbox.${mailboxCopyKey}.emptyDescription`),
    }),
    [mailboxCopyKey, t]
  );
  const pageCount = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));

  return (
    <PageCanvas topInset="compact">
      <MailPageHeading
        eyebrow={t(`mailbox.${mailboxCopyKey}.eyebrow`)}
        title={selectedCustomFolder?.displayName ?? t(`mailbox.${mailboxCopyKey}.title`)}
        description={t(`mailbox.${mailboxCopyKey}.description`)}
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
            {mode === 'custom' && (
              <SelectField<string>
                size="small"
                label={t('mailbox.custom.folderLabel')}
                value={requestedFolderId ?? ''}
                placeholder={t('mailbox.custom.folderPlaceholder')}
                options={customFolders.map((item) => ({
                  value: item.folderId,
                  label: `${item.displayName} · ${item.totalCount}`,
                }))}
                slotProps={{ input: { startAdornment: <FolderTree size={16} /> } }}
                sx={{ mb: 1 }}
                onValueChange={(folderId) => {
                  const next = new URLSearchParams(params);
                  next.set('folderId', folderId);
                  next.delete('thread');
                  setParams(next, { replace: true });
                }}
              />
            )}
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
            {(mode === 'inbox' || mode === 'shared') && !snoozedView && (
              <Tabs
                value={lane}
                onChange={(_event, value: MailTriageLane) => selectLane(value)}
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
          {query.isFetching && !query.isLoading && (
            <LinearProgress aria-label={t('mailbox.updating')} sx={{ height: 2 }} />
          )}
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {mode === 'custom' && organizationQuery.isError ? (
              <Alert
                severity="error"
                action={
                  <ActionButton intent="quiet" onClick={() => organizationQuery.refetch()}>
                    {t('actions.retry')}
                  </ActionButton>
                }
                sx={{ m: 1.5 }}
              >
                {t('organization.loadError')}
              </Alert>
            ) : query.isLoading ? (
              <LoadingState label={t('common:labels.loading')} size="page" embedded />
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
                  disabled={query.isFetching}
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
                    disabled={page === 0 || query.isFetching}
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
                    disabled={page + 1 >= pageCount || query.isFetching}
                    onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                  >
                    <ChevronRight size={16} />
                  </ActionIconButton>
                </>
              ) : (
                <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary">
                  <MailCheck size={14} />
                  <Typography variant="caption">
                    {t(query.isFetching ? 'mailbox.updating' : 'mailbox.syncReady')}
                  </Typography>
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
            onDeleted={clearSelection}
          />
        </Box>
      </Box>

      <MailComposeDialog
        open={composeOpen}
        initialToEmail={dwaionHandoffStrings(dwaionHandoff, 'to')[0]}
        initialSubject={dwaionHandoffText(dwaionHandoff, 'subject') ?? undefined}
        initialBody={dwaionHandoffText(dwaionHandoff, 'body') ?? undefined}
        fromDwaion={Boolean(dwaionHandoff)}
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
      <MailSnoozeDialog
        open={Boolean(snoozeTarget)}
        busy={snoozeMutation.isPending}
        onClose={() => setSnoozeTarget(null)}
        onSubmit={(until) => snoozeMutation.mutate(until)}
      />
      <MailLifecycleUndo
        state={undoState}
        onClose={() => setUndoState(null)}
        onRestored={async (thread) => {
          await query.refetch();
          selectThread(thread.threadId);
        }}
      />
    </PageCanvas>
  );
}
