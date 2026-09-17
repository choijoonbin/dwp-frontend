import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createNotificationAttentionRule,
  createNotificationTestDelivery,
  deleteNotificationAttentionRule,
  getNotificationTestDelivery,
  listNotificationAttentionContexts,
  listNotificationAttentionRules,
  previewNotificationAttentionRule,
  updateNotificationAttentionRule,
  type NotificationAttentionRule as ApiAttentionRule,
  type NotificationAttentionRuleInput,
  type NotificationAttentionRulePreview,
  type NotificationTestDelivery,
} from '@dwp-frontend/shared-utils/api/notification-attention-api';
import { searchMessagingPeople } from '@dwp-frontend/shared-utils/api/messaging-api';
import {
  createNotificationIdempotencyKey,
  getNotificationCapabilities,
  getNotificationDeliveryEndpoints,
  getNotificationEffectiveSettings,
  getNotificationInbox,
  type NotificationChannel,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { HttpError, useToast } from '@dwp-frontend/shared-utils';
import { ConfirmDialog } from '@dwp-frontend/design-system/components/dialogs/confirm-dialog';

import Box from '@mui/material/Box';

import {
  attentionRuleLimit,
  attentionRuleSummary,
  ruleInput,
  toAttentionRule,
  toTestDiagnostics,
} from './notification-attention-adapters';
import { NotificationAttentionDashboard } from './notification-attention-dashboard';
import {
  resolveNotificationDiagnosticChannels,
  selectableDiagnosticChannels,
  type NotificationDiagnosticSourceState,
} from './notification-attention-diagnostic-channels';
import { NotificationAttentionRuleDialog } from './notification-attention-rule-dialog';
import {
  actorScopeChoices,
  appTypeScopeChoices,
  recentContextScopeChoices,
  recentThreadScopeChoices,
} from './notification-attention-scope-discovery';
import { NotificationTestDiagnosticsPanel } from './notification-attention-test-diagnostics';
import type { NotificationTestRequestFailure } from './notification-attention-test-diagnostics';
import { notificationQueryKeys } from './integration-contract';
import { useOnlineStatus } from './use-notification-runtime';

import type {
  NotificationAttentionRule,
  NotificationAttentionRuleKind,
} from './notification-attention-model';
import type {
  NotificationAttentionDiscoveryState,
  NotificationAttentionScopeCatalog,
} from './notification-attention-scope-discovery';

function staleConflict(error: unknown): boolean {
  return error instanceof HttpError && error.status === 409;
}

function diagnosticSourceState(query: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}): NotificationDiagnosticSourceState {
  if (query.isLoading) return 'LOADING';
  if (!query.isError) return 'READY';
  return query.error instanceof HttpError && [401, 403].includes(query.error.status)
    ? 'FORBIDDEN'
    : 'ERROR';
}

function testRequestFailure(error: unknown, online: boolean): NotificationTestRequestFailure {
  if (!online) return 'OFFLINE';
  if (error instanceof HttpError && error.status === 429) return 'RATE_LIMITED';
  if (error instanceof HttpError && [401, 403].includes(error.status)) return 'FORBIDDEN';
  return 'FAILED';
}

export function NotificationAttentionSettings({ sectionId }: { sectionId?: string }) {
  const { t } = useTranslation('notifications');
  const online = useOnlineStatus();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedKind, setSelectedKind] = useState<NotificationAttentionRuleKind | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRule, setEditingRule] = useState<ApiAttentionRule | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<NotificationAttentionRulePreview | null>(null);
  const [deleteRule, setDeleteRule] = useState<ApiAttentionRule | null>(null);
  const [lastTest, setLastTest] = useState<NotificationTestDelivery | null>(null);
  const [selectedTestChannels, setSelectedTestChannels] = useState<NotificationChannel[]>([
    'IN_APP',
  ]);
  const testChannelsInitialized = useRef(false);
  const [testRunFailure, setTestRunFailure] = useState<NotificationTestRequestFailure | null>(null);
  const [discoveryKind, setDiscoveryKind] =
    useState<NotificationAttentionRuleInput['scopeKind']>('APP_TYPE');
  const [discoverySearch, setDiscoverySearch] = useState('');
  const [debouncedDiscoverySearch, setDebouncedDiscoverySearch] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedDiscoverySearch(discoverySearch.trim()),
      220
    );
    return () => window.clearTimeout(timeout);
  }, [discoverySearch]);

  const rulesQuery = useQuery({
    queryKey: notificationQueryKeys.attentionRules(),
    queryFn: ({ signal }) => listNotificationAttentionRules(signal),
    staleTime: 30_000,
    retry: 1,
  });

  const rawRules = useMemo(() => rulesQuery.data?.items ?? [], [rulesQuery.data?.items]);
  const rawById = useMemo(() => new Map(rawRules.map((rule) => [rule.ruleId, rule])), [rawRules]);
  const rules = useMemo(() => rawRules.map((rule) => toAttentionRule(rule, t)), [rawRules, t]);
  const visibleRules = useMemo(() => {
    const normalized = searchQuery.trim().toLocaleLowerCase();
    return rules.filter(
      (rule) =>
        (selectedKind === 'ALL' || rule.kind === selectedKind) &&
        (!normalized ||
          rule.label.toLocaleLowerCase().includes(normalized) ||
          rule.scopeLabel.toLocaleLowerCase().includes(normalized))
    );
  }, [rules, searchQuery, selectedKind]);

  const effectiveSettingsQuery = useQuery({
    queryKey: notificationQueryKeys.effectiveSettings(),
    queryFn: ({ signal }) => getNotificationEffectiveSettings(signal),
    staleTime: 60_000,
    retry: 1,
  });
  const capabilitiesQuery = useQuery({
    queryKey: notificationQueryKeys.capabilities(),
    queryFn: ({ signal }) => getNotificationCapabilities(signal),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const endpointsQuery = useQuery({
    queryKey: notificationQueryKeys.deliveryEndpoints(),
    queryFn: ({ signal }) => getNotificationDeliveryEndpoints(signal),
    staleTime: 30_000,
    retry: 1,
  });
  const recentThreadsQuery = useQuery({
    queryKey: notificationQueryKeys.inbox({ source: 'attention-scope-picker', view: 'ALL' }),
    queryFn: ({ signal }) => getNotificationInbox({ view: 'ALL', limit: 100 }, signal),
    staleTime: 30_000,
    retry: 1,
    enabled: dialogOpen,
  });
  const actorQuery = useQuery({
    queryKey: ['notifications', 'attention-scope-picker', 'actors', debouncedDiscoverySearch],
    queryFn: () => searchMessagingPeople(debouncedDiscoverySearch),
    enabled: dialogOpen && discoveryKind === 'ACTOR' && debouncedDiscoverySearch.length >= 2,
    staleTime: 30_000,
    retry: 1,
  });
  const contextKind =
    discoveryKind === 'RESOURCE' || discoveryKind === 'TOPIC_TOKEN' ? discoveryKind : null;
  const contextQuery = useQuery({
    queryKey: [
      'notifications',
      'attention-scope-picker',
      'contexts',
      contextKind,
      debouncedDiscoverySearch,
    ],
    queryFn: ({ signal }) => {
      if (!contextKind) throw new Error('A discoverable notification context kind is required.');
      return listNotificationAttentionContexts(
        { kind: contextKind, query: debouncedDiscoverySearch, limit: 50 },
        signal
      );
    },
    enabled: dialogOpen && Boolean(contextKind),
    staleTime: 30_000,
    retry: 1,
  });
  const recentContextChoices = useMemo(
    () => recentContextScopeChoices(contextQuery.data?.items),
    [contextQuery.data?.items]
  );
  const scopeCatalog = useMemo<NotificationAttentionScopeCatalog>(
    () => ({
      APP_TYPE: appTypeScopeChoices(effectiveSettingsQuery.data),
      ACTOR: actorScopeChoices(actorQuery.data),
      THREAD: recentThreadScopeChoices(recentThreadsQuery.data),
      RESOURCE: contextKind === 'RESOURCE' ? recentContextChoices : [],
      TOPIC_TOKEN: contextKind === 'TOPIC_TOKEN' ? recentContextChoices : [],
    }),
    [
      actorQuery.data,
      contextKind,
      effectiveSettingsQuery.data,
      recentContextChoices,
      recentThreadsQuery.data,
    ]
  );
  const discoveryStates = useMemo<
    Partial<
      Record<NotificationAttentionRuleInput['scopeKind'], NotificationAttentionDiscoveryState>
    >
  >(
    () => ({
      APP_TYPE: effectiveSettingsQuery.isError
        ? 'ERROR'
        : effectiveSettingsQuery.isLoading
          ? 'LOADING'
          : 'READY',
      ACTOR:
        discoveryKind !== 'ACTOR' || debouncedDiscoverySearch.length < 2
          ? 'IDLE'
          : actorQuery.isError
            ? 'ERROR'
            : actorQuery.isFetching
              ? 'LOADING'
              : 'READY',
      THREAD: recentThreadsQuery.isError
        ? 'ERROR'
        : recentThreadsQuery.isLoading
          ? 'LOADING'
          : 'READY',
      RESOURCE:
        discoveryKind !== 'RESOURCE'
          ? 'IDLE'
          : contextQuery.isError
            ? 'ERROR'
            : contextQuery.isFetching
              ? 'LOADING'
              : 'READY',
      TOPIC_TOKEN:
        discoveryKind !== 'TOPIC_TOKEN'
          ? 'IDLE'
          : contextQuery.isError
            ? 'ERROR'
            : contextQuery.isFetching
              ? 'LOADING'
              : 'READY',
    }),
    [
      actorQuery.isError,
      actorQuery.isFetching,
      contextQuery.isError,
      contextQuery.isFetching,
      debouncedDiscoverySearch.length,
      discoveryKind,
      effectiveSettingsQuery.isError,
      effectiveSettingsQuery.isLoading,
      recentThreadsQuery.isError,
      recentThreadsQuery.isLoading,
    ]
  );

  const previewMutation = useMutation({
    mutationFn: (input: NotificationAttentionRuleInput) => previewNotificationAttentionRule(input),
    onSuccess: setPreview,
    onError: () => {
      setPreview(null);
      toast.error(t('attention.feedback.previewFailed'));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (input: NotificationAttentionRuleInput) => {
      if (!editingRule) {
        return createNotificationAttentionRule({
          ...input,
          idempotencyKey: createNotificationIdempotencyKey('attention-rule-create'),
        });
      }
      return updateNotificationAttentionRule(editingRule.ruleId, {
        ...input,
        expectedVersion: editingRule.version,
        idempotencyKey: createNotificationIdempotencyKey('attention-rule-update'),
      });
    },
    onSuccess: async () => {
      setDialogOpen(false);
      setEditingRule(null);
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.attentionRules() });
      toast.success(t('attention.feedback.saved'));
    },
    onError: async (error) => {
      if (staleConflict(error)) {
        await rulesQuery.refetch();
        setDialogOpen(false);
        setEditingRule(null);
        setPreview(null);
        toast.error(t('attention.feedback.conflict'));
        return;
      }
      toast.error(t('attention.feedback.saveFailed'));
    },
  });

  const updateStateMutation = useMutation({
    mutationFn: ({ raw, enabled }: { raw: ApiAttentionRule; enabled: boolean }) =>
      updateNotificationAttentionRule(raw.ruleId, {
        ...ruleInput(raw),
        enabled,
        expectedVersion: raw.version,
        idempotencyKey: createNotificationIdempotencyKey('attention-rule-state'),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.attentionRules() });
      toast.success(t('attention.feedback.saved'));
    },
    onError: async (error) => {
      if (staleConflict(error)) await rulesQuery.refetch();
      toast.error(
        t(staleConflict(error) ? 'attention.feedback.conflict' : 'attention.feedback.saveFailed')
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (raw: ApiAttentionRule) =>
      deleteNotificationAttentionRule(raw.ruleId, {
        expectedVersion: raw.version,
        idempotencyKey: createNotificationIdempotencyKey('attention-rule-delete'),
      }),
    onSuccess: async () => {
      setDeleteRule(null);
      await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.attentionRules() });
      toast.success(t('attention.feedback.deleted'));
    },
    onError: async (error) => {
      if (staleConflict(error)) await rulesQuery.refetch();
      setDeleteRule(null);
      toast.error(
        t(staleConflict(error) ? 'attention.feedback.conflict' : 'attention.feedback.deleteFailed')
      );
    },
  });

  const testQuery = useQuery({
    queryKey: notificationQueryKeys.testDelivery(lastTest?.testId ?? null),
    queryFn: ({ signal }) => getNotificationTestDelivery(lastTest!.testId, signal),
    enabled: Boolean(lastTest?.testId && lastTest.state === 'PENDING'),
    refetchInterval: (current) =>
      current.state.data?.state === 'PENDING' ||
      (!current.state.data && lastTest?.state === 'PENDING')
        ? 1_500
        : false,
    retry: 1,
  });
  const currentTest = testQuery.data ?? lastTest;
  const capabilitiesSourceState = diagnosticSourceState(capabilitiesQuery);
  const settingsSourceState = diagnosticSourceState(effectiveSettingsQuery);
  const endpointsSourceState = diagnosticSourceState(endpointsQuery);
  const diagnosticChannels = useMemo(
    () =>
      resolveNotificationDiagnosticChannels({
        online,
        capabilities: capabilitiesQuery.data,
        effectiveSettings: effectiveSettingsQuery.data,
        endpoints: endpointsQuery.data,
        capabilitiesState: capabilitiesSourceState,
        settingsState: settingsSourceState,
        endpointsState: endpointsSourceState,
      }),
    [
      capabilitiesQuery.data,
      capabilitiesSourceState,
      effectiveSettingsQuery.data,
      endpointsSourceState,
      endpointsQuery.data,
      online,
      settingsSourceState,
    ]
  );
  useEffect(() => {
    if (
      !online ||
      capabilitiesSourceState !== 'READY' ||
      settingsSourceState !== 'READY' ||
      endpointsSourceState !== 'READY'
    ) {
      return;
    }
    const available = selectableDiagnosticChannels(diagnosticChannels);
    setSelectedTestChannels((current) => {
      const retained = current.filter((channel) => available.includes(channel));
      if (testChannelsInitialized.current) return retained;
      testChannelsInitialized.current = true;
      if (retained.length > 0) return retained;
      return available.includes('IN_APP') ? ['IN_APP'] : available.slice(0, 1);
    });
  }, [
    capabilitiesSourceState,
    diagnosticChannels,
    endpointsSourceState,
    online,
    settingsSourceState,
  ]);
  const testMutation = useMutation({
    mutationFn: () =>
      createNotificationTestDelivery({
        channels: selectedTestChannels,
        idempotencyKey: createNotificationIdempotencyKey('notification-test-delivery'),
      }),
    onMutate: () => setTestRunFailure(null),
    onSuccess: (delivery) => {
      setLastTest(delivery);
      setTestRunFailure(null);
    },
    onError: (error) => {
      const failure = testRequestFailure(error, online);
      setTestRunFailure(failure);
      toast.error(
        t(
          failure === 'RATE_LIMITED'
            ? 'attention.diagnostics.rateLimited'
            : `attention.diagnostics.requestFailures.${failure}.title`
        )
      );
    },
  });

  const openEditor = (rule?: NotificationAttentionRule) => {
    const raw = rule ? (rawById.get(rule.ruleId) ?? null) : null;
    const kind = raw?.scopeKind ?? 'APP_TYPE';
    const initialSearch =
      raw && (kind === 'RESOURCE' || kind === 'TOPIC_TOKEN')
        ? raw.scopeKey
        : (raw?.displayLabel ?? '');
    setDiscoveryKind(kind);
    setDiscoverySearch(initialSearch);
    setDebouncedDiscoverySearch(initialSearch.trim());
    setEditingRule(raw);
    setPreview(null);
    setDialogOpen(true);
  };
  const mutateState = (rule: NotificationAttentionRule, enabled: boolean) => {
    const raw = rawById.get(rule.ruleId);
    if (raw) updateStateMutation.mutate({ raw, enabled });
  };

  const state = rulesQuery.isLoading
    ? ({ kind: 'LOADING' } as const)
    : rulesQuery.isError
      ? ({ kind: online ? 'ERROR' : 'OFFLINE', message: t('attention.loadFailed') } as const)
      : rules.length === 0
        ? ({ kind: 'EMPTY', message: t('attention.emptyDescription') } as const)
        : ({ kind: 'READY' } as const);

  return (
    <Box
      id={sectionId}
      tabIndex={sectionId ? -1 : undefined}
      sx={{
        mt: sectionId ? 2 : 0,
        p: { xs: 1.5, md: 2 },
        scrollMarginTop: {
          xs: 'calc(var(--dwp-shell-mobile-sticky-offset, 64px) + 56px)',
          lg: 112,
        },
        minWidth: 0,
        bgcolor: 'transparent',
      }}
    >
      <NotificationAttentionDashboard
        summary={attentionRuleSummary(rules)}
        rules={visibleRules}
        state={state}
        ruleLimit={rulesQuery.data ? attentionRuleLimit(rulesQuery.data) : null}
        selectedKind={selectedKind}
        searchQuery={searchQuery}
        diagnostics={
          <NotificationTestDiagnosticsPanel
            diagnostics={toTestDiagnostics(currentTest, t)}
            channelOptions={diagnosticChannels}
            selectedChannels={selectedTestChannels}
            requestFailure={testRunFailure}
            busy={testMutation.isPending || testQuery.isFetching}
            onRun={() => testMutation.mutate()}
            onSelectedChannelsChange={(channels) => {
              setSelectedTestChannels(channels);
              setTestRunFailure(null);
            }}
            onRefresh={currentTest?.testId ? () => void testQuery.refetch() : undefined}
          />
        }
        onSelectedKindChange={setSelectedKind}
        onSearchQueryChange={setSearchQuery}
        onAddRule={() => openEditor()}
        onRetry={() => void rulesQuery.refetch()}
        onEditRule={openEditor}
        onDeleteRule={(rule) => setDeleteRule(rawById.get(rule.ruleId) ?? null)}
        onPauseRule={(rule) => mutateState(rule, false)}
        onResumeRule={(rule) => mutateState(rule, true)}
        onExtendRule={openEditor}
      />

      <NotificationAttentionRuleDialog
        open={dialogOpen}
        initialRule={editingRule}
        preview={preview}
        busy={saveMutation.isPending}
        previewing={previewMutation.isPending}
        onClose={() => {
          setDiscoveryKind('APP_TYPE');
          setDiscoverySearch('');
          setDebouncedDiscoverySearch('');
          setDialogOpen(false);
          setEditingRule(null);
          setPreview(null);
        }}
        onDraftChange={() => setPreview(null)}
        scopeCatalog={scopeCatalog}
        discoveryStates={discoveryStates}
        onDiscoveryQueryChange={(kind, query) => {
          setDiscoveryKind(kind);
          setDiscoverySearch(query);
        }}
        onPreview={(input) => previewMutation.mutate(input)}
        onSave={(input) => saveMutation.mutate(input)}
      />

      <ConfirmDialog
        open={Boolean(deleteRule)}
        title={t('attention.delete.title')}
        description={t('attention.delete.description', {
          label: deleteRule?.displayLabel ?? t('attention.delete.unnamed'),
        })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('actions.delete')}
        onClose={() => setDeleteRule(null)}
        onConfirm={() => {
          if (deleteRule) deleteMutation.mutate(deleteRule);
        }}
        busy={deleteMutation.isPending}
        intent="danger"
        mobilePresentation="sheet"
      />
    </Box>
  );
}
