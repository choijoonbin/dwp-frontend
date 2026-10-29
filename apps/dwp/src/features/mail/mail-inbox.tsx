import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, FolderTree, MailCheck, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  dwaionHandoffStrings,
  dwaionHandoffText,
  getMailHome,
  getMailThreads,
  getMailOrganization,
  parseDwaionHandoff,
  parseDwaionProposalHandoffBinding,
  snoozeMailThread,
  useAuth,
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

import {
  MailProposalOwnerHandoffNotice,
  useMailProposalOwnerHandoff,
} from '../../components/mail-proposal-owner-handoff';
import { MailCommandPalette, type MailCommand } from './mail-command-palette';
import { validMailAccountScope } from './mail-account-scope';
import { parseMailComposeNavigationState } from './mail-compose-navigation';
import { MailComposeDialog } from './mail-compose-dialog';
import { MailThreadListItem } from './mail-components';
import { isMailShortcutTargetInteractive } from './mail-keyboard';
import { MailLifecycleUndo, type MailLifecycleUndoState } from './mail-lifecycle-undo';
import {
  applyMailQuickCommand,
  MailInboxBulkToolbar,
  resolveMailBulkCommandPlan,
  summarizeMailBulkResults,
  updateMailThreadPageAfterBulk,
  type MailBulkCommandExecutionItem,
  type MailBulkCommandPlan,
  type MailQuickCommand,
} from './mail-inbox-bulk';
import {
  MAIL_INBOX_LANES as LANES,
  MAIL_INBOX_PAGE_SIZE as PAGE_SIZE,
  requestedMailInboxPage as requestedPage,
  resolveMailInboxImportance as resolveImportance,
  resolveMailInboxLane as resolveLane,
  type MailboxMode,
} from './mail-inbox-query-state';
import {
  MailInboxAccountGate,
  MailInboxHeading,
  type MailInboxAccountGateState,
} from './mail-inbox-page-state';
import { mailInboxFirstAutoSelection } from './mail-inbox-selection';
import { mailSendCustodyOwner } from './mail-send-attempt';
import { mailSharedAssignmentFilter, updateMailSharedFilters } from './mail-shared-filter';
import { MailSnoozeDialog } from './mail-snooze-dialog';
import { MailThreadDetailPane } from './mail-thread-detail';
import { useMailUserPermissions } from './use-mail-user-permissions';
import {
  mailKeyboardShortcutsEnabled,
  mailUsesCompactDensity,
  useMailRuntimePreferences,
} from './mail-runtime-preferences';

import type { MailThread, MailThreadPage, MailTriageLane } from '@dwp-frontend/shared-utils';

export function MailInbox({ mode }: { mode: MailboxMode }) {
  const { t } = useTranslation('mail');
  const auth = useAuth();
  const custodyOwner = mailSendCustodyOwner(auth.user);
  const custodyOwnerRef = useRef(custodyOwner);
  custodyOwnerRef.current = custodyOwner;
  const toast = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const unreadOnly = params.get('unread') === 'true';
  const importance = resolveImportance(params.get('importance'));
  const hasSignalFilter = unreadOnly || Boolean(importance);
  const lane = hasSignalFilter ? null : resolveLane(params.get('lane'), mode);
  const requestedAccountId = params.get('accountId');
  const requestedSharedInboxId = params.get('sharedInboxId');
  const sharedAssignment = mailSharedAssignmentFilter(params.get('assignment'));
  const requestedQuery = params.get('query') ?? '';
  const [search, setSearch] = useState(requestedQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(requestedQuery.trim());
  const page = requestedPage(params.get('page'));
  const [commandOpen, setCommandOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set());
  const bulkPlanRef = useRef<MailBulkCommandPlan | null>(null);
  const [snoozeTarget, setSnoozeTarget] = useState<MailThread | null>(null);
  const [undoState, setUndoState] = useState<MailLifecycleUndoState | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const restoreListContextRef = useRef(false);
  const desktopSplitView = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));
  const runtimePreferences = useMailRuntimePreferences();
  const proposalOwnerHandoff = useMailProposalOwnerHandoff('MAIL');
  const { canCreate, canUpdate, canSend } = useMailUserPermissions();
  const proposalDomainCompletedRef = useRef(false);
  const proposalReturnStartedRef = useRef(false);
  const selectedId = params.get('thread');
  const composeOpen = params.get('compose') === 'open';
  const requestedFolderId = params.get('folderId');

  const [dwaionHandoffState, setDwaionHandoffState] = useState(() => ({
    owner: custodyOwner,
    handoff: parseDwaionHandoff(location.state, 'MAIL.DRAFT.CREATE'),
    binding: parseDwaionProposalHandoffBinding(location.state),
  }));
  const dwaionHandoff =
    dwaionHandoffState.owner === custodyOwner ? dwaionHandoffState.handoff : null;
  const dwaionProposalBinding =
    dwaionHandoffState.owner === custodyOwner &&
    dwaionHandoffState.binding?.actionKey === 'MAIL.DRAFT.CREATE'
      ? dwaionHandoffState.binding
      : null;
  const [composeNavigationState, setComposeNavigationState] = useState(() => ({
    owner: custodyOwner,
    ...parseMailComposeNavigationState(location.state),
  }));
  const composeNavigation =
    composeNavigationState.owner === custodyOwner
      ? composeNavigationState
      : { seed: null, returnTo: null };
  const scopeOptionsQuery = useQuery({
    queryKey: ['mail', 'home', 'scope-options'],
    queryFn: () => getMailHome(),
    staleTime: 60_000,
    retry: 1,
  });
  const organizationQuery = useQuery({
    queryKey: ['mail', 'organization'],
    queryFn: getMailOrganization,
    enabled: mode === 'custom' && Boolean(scopeOptionsQuery.data?.accounts.length),
    staleTime: 30_000,
    retry: 1,
  });
  const accountScope = scopeOptionsQuery.data
    ? validMailAccountScope(requestedAccountId, scopeOptionsQuery.data.accounts)
    : requestedAccountId;
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
  const threadQueryKey = [
    'mail',
    'threads',
    mode,
    activeLane,
    importance,
    unreadOnly,
    state,
    requestedFolderId,
    accountScope,
    requestedSharedInboxId,
    sharedAssignment,
    debouncedSearch,
    page,
  ] as const;
  const query = useQuery({
    queryKey: threadQueryKey,
    queryFn: () =>
      getMailThreads({
        lane: activeLane ?? undefined,
        importance,
        unread: unreadOnly || undefined,
        state,
        folder,
        folderId: mode === 'custom' ? (requestedFolderId ?? undefined) : undefined,
        sharedOnly: mode === 'shared',
        accountId: accountScope ?? undefined,
        sharedInboxId: mode === 'shared' ? (requestedSharedInboxId ?? undefined) : undefined,
        assignment: mode === 'shared' && sharedAssignment !== 'ALL' ? sharedAssignment : undefined,
        query: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (previous) => previous,
    enabled:
      Boolean(scopeOptionsQuery.data?.accounts.length) &&
      (mode !== 'custom' || Boolean(requestedFolderId)),
    staleTime: 20_000,
    retry: 1,
  });
  const selectedThread = query.data?.items.find((item) => item.threadId === selectedId);
  const contextKey = [
    mode,
    activeLane,
    importance,
    unreadOnly,
    state,
    requestedFolderId,
    accountScope,
    requestedSharedInboxId,
    sharedAssignment,
    debouncedSearch,
    page,
  ].join('|');
  const listContextStorageKey = `dwp:mail:list-context:${custodyOwner}:${contextKey}`;
  const previousContextRef = useRef(contextKey);
  const quickMutation = useMutation({
    mutationFn: async ({ command, thread }: { command: MailQuickCommand; thread: MailThread }) => {
      if (!canUpdate) throw new Error('Mail update permission is required.');
      return applyMailQuickCommand(command, thread);
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
  const bulkMutation = useMutation({
    mutationFn: async ({
      command,
      items,
    }: {
      command: MailQuickCommand;
      items: MailBulkCommandExecutionItem[];
    }) => {
      if (!canUpdate) throw new Error('Mail update permission is required.');
      const results = await Promise.allSettled(
        items.map(({ thread, identity, expectedVersion }) =>
          applyMailQuickCommand(command, thread, identity, expectedVersion)
        )
      );
      const summary = summarizeMailBulkResults(
        items.map(({ thread }) => thread.threadId),
        results
      );
      const updatedThreads = results.flatMap((result) =>
        result.status === 'fulfilled' && 'messages' in result.value.result
          ? [result.value.result.thread]
          : []
      );
      return { command, updatedThreads, ...summary };
    },
    onSuccess: async ({ command, succeededIds, failedIds, updatedThreads }) => {
      queryClient.setQueryData<MailThreadPage>(threadQueryKey, (current) =>
        updateMailThreadPageAfterBulk(current, command, succeededIds, updatedThreads)
      );
      setBulkSelectedIds(new Set(failedIds));
      setBulkMode(failedIds.length > 0);
      if (!failedIds.length) bulkPlanRef.current = null;
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      if (!failedIds.length) {
        toast.success(t('mailbox.bulk.success', { count: succeededIds.length }));
      } else if (succeededIds.length) {
        toast.warning(
          t('mailbox.bulk.partial', {
            succeeded: succeededIds.length,
            failed: failedIds.length,
          })
        );
      } else {
        toast.error(t('mailbox.bulk.failed', { count: failedIds.length }));
      }
    },
    onError: () => toast.error(t('mailbox.bulk.failed', { count: bulkSelectedIds.size })),
  });
  const snoozeMutation = useMutation({
    mutationFn: (until: string) => {
      if (!canUpdate) throw new Error('Mail update permission is required.');
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
    if (nextHandoff) {
      setDwaionHandoffState({
        owner: custodyOwnerRef.current,
        handoff: nextHandoff,
        binding: parseDwaionProposalHandoffBinding(location.state),
      });
    }
    const composeState = parseMailComposeNavigationState(location.state);
    if (composeState.seed || composeState.returnTo) {
      setComposeNavigationState({ owner: custodyOwnerRef.current, ...composeState });
    }
  }, [custodyOwner, location.state]);

  useEffect(() => {
    const options = scopeOptionsQuery.data;
    if (!options) return;
    const invalidAccount = Boolean(requestedAccountId) && !accountScope;
    const invalidSharedInbox =
      mode === 'shared' &&
      Boolean(requestedSharedInboxId) &&
      !options.sharedInboxes.some((inbox) => inbox.sharedInboxId === requestedSharedInboxId);
    if (!invalidAccount && !invalidSharedInbox) return;
    const next = new URLSearchParams(params);
    if (invalidAccount) next.delete('accountId');
    if (invalidSharedInbox) next.delete('sharedInboxId');
    next.delete('thread');
    next.delete('page');
    setParams(next, { replace: true });
  }, [
    accountScope,
    mode,
    params,
    requestedAccountId,
    requestedSharedInboxId,
    scopeOptionsQuery.data,
    setParams,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextQuery = search.trim();
      setDebouncedSearch(nextQuery);
      if (nextQuery === requestedQuery) return;
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (nextQuery) next.set('query', nextQuery);
          else next.delete('query');
          next.delete('page');
          return next;
        },
        { replace: true }
      );
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [requestedQuery, search, setParams]);

  useEffect(() => {
    if (requestedQuery === search) return;
    setSearch(requestedQuery);
    setDebouncedSearch(requestedQuery.trim());
  }, [requestedQuery, search]);

  useEffect(() => {
    if (previousContextRef.current === contextKey) return;
    previousContextRef.current = contextKey;
    bulkPlanRef.current = null;
    setBulkMode(false);
    setBulkSelectedIds(new Set());
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
    if (bulkMode) return;
    const firstThreadId = mailInboxFirstAutoSelection({
      desktopSplitView,
      fetching: query.isFetching,
      selectedId,
      threadIds: query.data?.items.map((item) => item.threadId) ?? [],
    });
    if (!firstThreadId) return;
    const next = new URLSearchParams(params);
    next.set('thread', firstThreadId);
    setParams(next, { replace: true });
  }, [
    bulkMode,
    desktopSplitView,
    params,
    query.data?.items,
    query.isFetching,
    selectedId,
    setParams,
  ]);

  useEffect(() => {
    if (
      selectedId ||
      query.isFetching ||
      !query.data?.items.length ||
      !restoreListContextRef.current
    )
      return;
    restoreListContextRef.current = false;
    try {
      const stored = window.sessionStorage.getItem(listContextStorageKey);
      if (!stored) return;
      const context = JSON.parse(stored) as { scrollTop?: unknown; threadId?: unknown };
      if (typeof context.scrollTop === 'number')
        listRef.current?.scrollTo({ top: context.scrollTop });
      if (typeof context.threadId === 'string') {
        window.requestAnimationFrame(() => {
          document.getElementById(`mail-thread-${context.threadId}`)?.focus();
        });
      }
    } catch {
      window.sessionStorage.removeItem(listContextStorageKey);
    }
  }, [listContextStorageKey, query.data?.items, query.isFetching, selectedId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!mailKeyboardShortcutsEnabled(runtimePreferences.data)) return;
      if (isMailShortcutTargetInteractive(event.target)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setCommandOpen(true);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key.toLowerCase() === 'c') {
        if (!canCreate) return;
        event.preventDefault();
        openCompose();
      } else if (event.key.toLowerCase() === 'e' && selectedThread) {
        if (!canUpdate) return;
        event.preventDefault();
        quickMutation.mutate({ command: 'archive', thread: selectedThread });
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  });

  const openCompose = () => {
    if (!canCreate || !scopeOptionsQuery.data?.accounts.length) return;
    const next = new URLSearchParams(params);
    next.set('compose', 'open');
    setParams(next, { replace: true });
  };
  const closeCompose = () => {
    const proposalDomainCompleted = proposalDomainCompletedRef.current;
    if (proposalDomainCompleted) {
      proposalDomainCompletedRef.current = false;
      const returnStarted = proposalReturnStartedRef.current;
      proposalReturnStartedRef.current = false;
      if (returnStarted) return;
    }
    if (!proposalDomainCompleted && proposalOwnerHandoff.active) {
      void proposalOwnerHandoff.cancelAndReturn();
      return;
    }
    setDwaionHandoffState({ owner: custodyOwnerRef.current, handoff: null, binding: null });
    const returnTo = composeNavigation.returnTo;
    setComposeNavigationState({ owner: custodyOwnerRef.current, seed: null, returnTo: null });
    if (returnTo) {
      navigate(returnTo, { replace: true, state: null });
      return;
    }
    const next = new URLSearchParams(params);
    next.delete('compose');
    setParams(next, { replace: true, state: null });
  };
  const selectThread = (threadId: string) => {
    try {
      window.sessionStorage.setItem(
        listContextStorageKey,
        JSON.stringify({ scrollTop: listRef.current?.scrollTop ?? 0, threadId })
      );
    } catch {
      // Browsing still works when storage is unavailable.
    }
    const next = new URLSearchParams(params);
    next.set('thread', threadId);
    setParams(next);
  };
  const enterBulkMode = () => {
    bulkPlanRef.current = null;
    setBulkMode(true);
    setBulkSelectedIds(new Set());
    if (selectedId) clearSelection();
  };
  const toggleBulkThread = (threadId: string) => {
    bulkPlanRef.current = null;
    setBulkSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };
  const runBulkCommand = (command: MailQuickCommand) => {
    const threads = (query.data?.items ?? []).filter((thread) =>
      bulkSelectedIds.has(thread.threadId)
    );
    if (!threads.length) return;
    const resolved = resolveMailBulkCommandPlan(bulkPlanRef.current, command, contextKey, threads);
    bulkPlanRef.current = resolved.plan;
    bulkMutation.mutate({ command, items: [...resolved.items] });
  };
  const clearSelection = () => {
    restoreListContextRef.current = true;
    const next = new URLSearchParams(params);
    next.delete('thread');
    setParams(next, { replace: true });
  };
  const selectLane = (nextLane: MailTriageLane | null) => {
    const next = new URLSearchParams(params);
    if (nextLane) next.set('lane', nextLane);
    else next.delete('lane');
    next.delete('state');
    next.delete('thread');
    next.delete('page');
    setParams(next, { replace: true });
  };
  const selectPage = (nextPage: number) => {
    const next = new URLSearchParams(params);
    if (nextPage > 0) next.set('page', String(nextPage));
    else next.delete('page');
    next.delete('thread');
    setParams(next);
  };
  const runCommand = (command: MailCommand) => {
    if (command === 'compose') return openCompose();
    if (command === 'focus-search') return searchRef.current?.focus();
    if (command === 'show-priority') return selectLane('PRIORITY');
    if (command === 'show-needs-reply') return selectLane('NEEDS_REPLY');
    if (command === 'snooze') {
      if (!canUpdate) return;
      if (selectedThread) setSnoozeTarget(selectedThread);
      return;
    }
    if (selectedThread && canUpdate) quickMutation.mutate({ command, thread: selectedThread });
  };
  const empty = useMemo(
    () => ({
      title: t(`mailbox.${mailboxCopyKey}.emptyTitle`),
      description: t(`mailbox.${mailboxCopyKey}.emptyDescription`),
    }),
    [mailboxCopyKey, t]
  );
  const pageCount = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));
  const accountGateState: MailInboxAccountGateState | null = scopeOptionsQuery.isPending
    ? 'loading'
    : scopeOptionsQuery.isError
      ? 'error'
      : scopeOptionsQuery.data.accounts.length === 0
        ? 'empty'
        : null;
  if (accountGateState) {
    return (
      <MailInboxAccountGate
        state={accountGateState}
        retrying={scopeOptionsQuery.isFetching}
        onRetry={() => void scopeOptionsQuery.refetch()}
        onConnect={() => navigate('/mail/accounts')}
      />
    );
  }

  return (
    <PageCanvas topInset="compact">
      <MailInboxHeading
        mailboxCopyKey={mailboxCopyKey}
        title={selectedCustomFolder?.displayName}
        canCreate={canCreate}
        canUpdate={canUpdate}
        hasItems={Boolean(query.data?.items.length)}
        bulkMode={bulkMode}
        onOpenCommand={() => setCommandOpen(true)}
        onEnterBulkMode={enterBulkMode}
        onExitBulkMode={() => {
          setBulkMode(false);
          setBulkSelectedIds(new Set());
        }}
        onCompose={openCompose}
      />

      {!composeOpen && <MailProposalOwnerHandoffNotice handoff={proposalOwnerHandoff} />}

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
            {scopeOptionsQuery.data?.accounts.length ? (
              <SelectField<string>
                size="small"
                label={t('home.accountScope')}
                value={accountScope ?? ''}
                options={[
                  { value: '', label: t('home.allAccounts') },
                  ...scopeOptionsQuery.data.accounts.map((account) => ({
                    value: account.accountId,
                    label: `${account.displayName} · ${account.emailAddress}`,
                  })),
                ]}
                sx={{ mb: 1 }}
                onValueChange={(accountId) => {
                  const next = new URLSearchParams(params);
                  if (accountId) next.set('accountId', accountId);
                  else next.delete('accountId');
                  next.delete('thread');
                  next.delete('page');
                  setParams(next, { replace: true });
                }}
              />
            ) : null}
            {mode === 'shared' && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' },
                  gap: 1,
                  mb: 1,
                }}
              >
                <SelectField<string>
                  size="small"
                  label={t('mailbox.shared.inboxFilter')}
                  value={requestedSharedInboxId ?? ''}
                  options={[
                    { value: '', label: t('mailbox.shared.allInboxes') },
                    ...(scopeOptionsQuery.data?.sharedInboxes ?? []).map((inbox) => ({
                      value: inbox.sharedInboxId,
                      label: inbox.name,
                    })),
                  ]}
                  onValueChange={(sharedInboxId) =>
                    setParams(
                      updateMailSharedFilters(params, {
                        sharedInboxId: sharedInboxId || null,
                      }),
                      { replace: true }
                    )
                  }
                />
                <SelectField<string>
                  size="small"
                  label={t('mailbox.shared.assignmentFilter')}
                  value={sharedAssignment}
                  options={(['ALL', 'MINE', 'UNASSIGNED', 'OVERDUE'] as const).map(
                    (assignment) => ({
                      value: assignment,
                      label: t(`mailbox.shared.assignment.${assignment}`),
                    })
                  )}
                  onValueChange={(assignment) =>
                    setParams(
                      updateMailSharedFilters(params, {
                        assignment: mailSharedAssignmentFilter(assignment),
                      }),
                      { replace: true }
                    )
                  }
                />
              </Box>
            )}
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
                value={lane ?? 'ALL'}
                onChange={(_event, value: MailTriageLane | 'ALL') =>
                  selectLane(value === 'ALL' ? null : value)
                }
                variant="scrollable"
                scrollButtons={false}
                sx={{ mt: 1, minHeight: 34, '& .MuiTab-root': { minHeight: 34, px: 1.25 } }}
              >
                {mode === 'shared' && <Tab value="ALL" label={t('mailbox.shared.allLanes')} />}
                {LANES.map((item) => (
                  <Tab key={item} value={item} label={t(`lane.${item}`)} />
                ))}
              </Tabs>
            )}
            {bulkMode && (
              <MailInboxBulkToolbar
                selectedCount={bulkSelectedIds.size}
                totalCount={query.data?.items.length ?? 0}
                busy={bulkMutation.isPending}
                onTogglePage={() => {
                  bulkPlanRef.current = null;
                  setBulkSelectedIds(
                    bulkSelectedIds.size === (query.data?.items.length ?? 0)
                      ? new Set()
                      : new Set(query.data?.items.map((thread) => thread.threadId) ?? [])
                  );
                }}
                onCommand={runBulkCommand}
                onDone={() => {
                  bulkPlanRef.current = null;
                  setBulkMode(false);
                  setBulkSelectedIds(new Set());
                }}
              />
            )}
          </Box>
          {query.isFetching && !query.isLoading && (
            <LinearProgress aria-label={t('mailbox.updating')} sx={{ height: 2 }} />
          )}
          <Box ref={listRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
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
                  buttonId={`mail-thread-${thread.threadId}`}
                  thread={thread}
                  selected={
                    bulkMode ? bulkSelectedIds.has(thread.threadId) : selectedId === thread.threadId
                  }
                  compact={mailUsesCompactDensity(runtimePreferences.data)}
                  selectionMode={bulkMode}
                  disabled={query.isFetching || bulkMutation.isPending}
                  onSelect={() =>
                    bulkMode ? toggleBulkThread(thread.threadId) : selectThread(thread.threadId)
                  }
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
                    onClick={() => selectPage(Math.max(0, page - 1))}
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
                    onClick={() => selectPage(Math.min(pageCount - 1, page + 1))}
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
        open={composeOpen && canCreate}
        canSave={canCreate}
        canSend={canSend}
        initialAccountId={accountScope ?? undefined}
        initialToEmail={
          composeNavigation.seed?.toEmail ?? dwaionHandoffStrings(dwaionHandoff, 'to')[0]
        }
        initialSubject={
          composeNavigation.seed?.subject ??
          dwaionHandoffText(dwaionHandoff, 'subject') ??
          undefined
        }
        initialBody={
          composeNavigation.seed?.body ?? dwaionHandoffText(dwaionHandoff, 'body') ?? undefined
        }
        fromDwaion={Boolean(dwaionHandoff)}
        dwaionProposalBinding={dwaionProposalBinding}
        proposalBinding={proposalOwnerHandoff.binding}
        submissionBlocked={proposalOwnerHandoff.blocksSubmission}
        handoffNotice={<MailProposalOwnerHandoffNotice handoff={proposalOwnerHandoff} />}
        onClose={closeCompose}
        onCompleted={async (threadId, deliveryMode) => {
          if (proposalOwnerHandoff.active) {
            proposalDomainCompletedRef.current = true;
            proposalReturnStartedRef.current =
              await proposalOwnerHandoff.waitForTerminalAndReturn();
          }
          if (
            (mode === 'sent' && deliveryMode === 'SEND') ||
            (mode === 'drafts' && deliveryMode === 'DRAFT')
          ) {
            selectThread(threadId);
          }
          return true;
        }}
      />
      <MailCommandPalette
        open={commandOpen}
        hasSelectedThread={Boolean(selectedThread)}
        canCompose={canCreate}
        canUpdate={canUpdate}
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
