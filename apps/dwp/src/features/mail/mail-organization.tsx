import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  FolderPlus,
  ListFilter,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  archiveMailFolder,
  archiveMailRule,
  createMailFolder,
  createMailRule,
  getMailOrganization,
  reorderMailRules,
  updateMailFolder,
  updateMailRule,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  GuidedEmptyState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { MailPageHeading } from './mail-components';
import { colorValue, MailFolderDialog, MailRuleDialog } from './mail-organization-dialogs';
import { MailRuleBackfillPanel } from './mail-rule-backfill-panel';
import {
  mailRuleMoveAvailability,
  mailRuleOrderAfterMove,
  type MailRuleMoveDirection,
} from './mail-rule-order';

import type {
  MailFolder,
  MailFolderInput,
  MailRule,
  MailRuleInput,
  MailRuleRun,
} from '@dwp-frontend/shared-utils';

type OrganizationTab = 'folders' | 'rules';
type PendingArchive = { kind: 'folder'; item: MailFolder } | { kind: 'rule'; item: MailRule };

export function MailOrganization() {
  const { t } = useTranslation('mail');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const tab: OrganizationTab = params.get('section') === 'rules' ? 'rules' : 'folders';
  const selectTab = (nextTab: OrganizationTab) => {
    const next = new URLSearchParams(params);
    if (nextTab === 'rules') next.set('section', 'rules');
    else next.delete('section');
    setParams(next, { replace: true });
  };
  const [folderEditor, setFolderEditor] = useState<MailFolder | 'new' | null>(null);
  const [ruleEditor, setRuleEditor] = useState<MailRule | 'new' | null>(null);
  const [pendingArchive, setPendingArchive] = useState<PendingArchive | null>(null);
  const query = useQuery({
    queryKey: ['mail', 'organization'],
    queryFn: getMailOrganization,
    staleTime: 30_000,
    retry: 1,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['mail'] });
  const folderMutation = useMutation({
    mutationFn: async (form: MailFolderInput) => {
      if (folderEditor && folderEditor !== 'new') {
        return updateMailFolder(folderEditor.folderId, {
          parentFolderId: form.parentFolderId,
          displayName: form.displayName,
          color: form.color,
          version: folderEditor.version,
        });
      }
      return createMailFolder(form);
    },
    onSuccess: async () => {
      setFolderEditor(null);
      selectTab('folders');
      await refresh();
      toast.success(t('organization.folder.saved'));
    },
    onError: () => toast.error(t('organization.folder.saveError')),
  });
  const ruleMutation = useMutation({
    mutationFn: async ({ form, rule }: { form: MailRuleInput; rule: MailRule | null }) => {
      if (rule) {
        return updateMailRule(rule.ruleId, {
          displayName: form.displayName,
          priority: form.priority,
          matchMode: form.matchMode,
          conditions: form.conditions,
          actions: form.actions,
          stopProcessing: form.stopProcessing,
          enabled: form.enabled,
          version: rule.version,
        });
      }
      return createMailRule(form);
    },
    onSuccess: async () => {
      setRuleEditor(null);
      selectTab('rules');
      await refresh();
      toast.success(t('organization.rule.saved'));
    },
    onError: () => toast.error(t('organization.rule.saveError')),
  });
  const archiveMutation = useMutation({
    mutationFn: async (target: PendingArchive) => {
      if (target.kind === 'folder') {
        await archiveMailFolder(target.item.folderId, target.item.version);
      } else {
        await archiveMailRule(target.item.ruleId, target.item.version);
      }
    },
    onSuccess: async () => {
      setPendingArchive(null);
      await refresh();
      toast.success(t('organization.archived'));
    },
    onError: () => toast.error(t('organization.archiveError')),
  });
  const reorderMutation = useMutation({
    mutationFn: ({ ruleId, direction }: { ruleId: string; direction: MailRuleMoveDirection }) => {
      const rules = query.data?.rules ?? [];
      const order = mailRuleOrderAfterMove(rules, ruleId, direction);
      if (!order) throw new Error('The rule cannot move in that direction.');
      return reorderMailRules({ rules: order });
    },
    onSuccess: async () => {
      await refresh();
      toast.success(t('organization.rule.reordered'));
    },
    onError: () => toast.error(t('organization.rule.reorderError')),
  });
  const data = query.data;
  const customFolders = useMemo(
    () => data?.folders.filter((item) => item.folderType === 'CUSTOM') ?? [],
    [data?.folders]
  );
  const enabledRules = data?.rules.filter((item) => item.enabled).length ?? 0;
  const organizedMessages = customFolders.reduce((sum, item) => sum + item.totalCount, 0);
  const ruleReadiness = {
    local:
      data?.rules.filter((item) => item.enabled && item.synchronizationState === 'LOCAL_ONLY')
        .length ?? 0,
    pending:
      data?.rules.filter((item) => item.enabled && item.synchronizationState === 'PENDING')
        .length ?? 0,
    synced:
      data?.rules.filter((item) => item.enabled && item.synchronizationState === 'SYNCED').length ??
      0,
    error:
      data?.rules.filter((item) => item.enabled && item.synchronizationState === 'ERROR').length ??
      0,
  };
  const folderRows = useMemo(() => folderHierarchy(customFolders), [customFolders]);

  return (
    <PageCanvas>
      <MailPageHeading
        eyebrow={t('organization.eyebrow')}
        title={t('organization.title')}
        description={t('organization.description')}
        actions={
          <Stack direction="row" spacing={1}>
            <ActionIconButton label={t('actions.refresh')} onClick={() => query.refetch()}>
              <RefreshCw size={17} />
            </ActionIconButton>
            <ActionButton
              intent="secondary"
              startIcon={<FolderPlus size={16} />}
              onClick={() => setFolderEditor('new')}
            >
              {t('organization.folder.new')}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<Plus size={16} />}
              onClick={() => setRuleEditor('new')}
            >
              {t('organization.rule.new')}
            </ActionButton>
          </Stack>
        }
      />

      {query.isError && (
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => query.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('organization.loadError')}
        </Alert>
      )}

      {query.isLoading ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={132} />
          <Skeleton variant="rounded" height={420} />
        </Stack>
      ) : data ? (
        <Stack spacing={2.5}>
          <Box
            component="section"
            aria-labelledby="mail-organization-pulse"
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'minmax(0, 1.35fr) repeat(2, minmax(150px, .65fr))',
              },
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Sparkles size={18} color="var(--dwp-product-accent)" />
                <Typography
                  id="mail-organization-pulse"
                  component="h2"
                  variant="subtitle1"
                  fontWeight={850}
                >
                  {t('organization.pulse.title')}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {t('organization.pulse.description')}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('organization.pulse.localRules', { count: ruleReadiness.local })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('organization.pulse.pendingRules', { count: ruleReadiness.pending })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color="success"
                  label={t('organization.pulse.syncedRules', { count: ruleReadiness.synced })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={ruleReadiness.error ? 'warning' : 'default'}
                  label={t('organization.pulse.errorRules', { count: ruleReadiness.error })}
                />
              </Stack>
            </Box>
            <PulseValue
              label={t('organization.pulse.organized')}
              value={organizedMessages}
              detail={t('organization.pulse.organizedDetail')}
            />
            <PulseValue
              label={t('organization.pulse.activeRules')}
              value={enabledRules}
              detail={t('organization.pulse.activeRulesDetail')}
            />
          </Box>

          <Box component="section" sx={{ minWidth: 0 }}>
            <Tabs
              value={tab}
              onChange={(_event, value: OrganizationTab) => selectTab(value)}
              aria-label={t('organization.tabsLabel')}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab value="folders" label={t('organization.tabs.folders')} />
              <Tab value="rules" label={t('organization.tabs.rules')} />
            </Tabs>
            {tab === 'folders' ? (
              <FolderList
                folders={folderRows}
                onOpen={(folder) =>
                  navigate(`/mail/folders?folderId=${encodeURIComponent(folder.folderId)}`)
                }
                onEdit={setFolderEditor}
                onArchive={(item) => setPendingArchive({ kind: 'folder', item })}
              />
            ) : (
              <Box sx={{ pt: 2 }}>
                <MailRuleBackfillPanel accounts={data.accounts} onCompleted={refresh} />
                <RuleList
                  rules={data.rules}
                  folders={data.folders}
                  busy={ruleMutation.isPending}
                  reorderBusy={reorderMutation.isPending}
                  onEdit={setRuleEditor}
                  onToggle={(rule, enabled) =>
                    ruleMutation.mutate({
                      rule,
                      form: {
                        accountId: rule.accountId,
                        displayName: rule.displayName,
                        priority: rule.priority,
                        matchMode: rule.matchMode,
                        conditions: rule.conditions,
                        actions: rule.actions,
                        stopProcessing: rule.stopProcessing,
                        enabled,
                      },
                    })
                  }
                  onArchive={(item) => setPendingArchive({ kind: 'rule', item })}
                  onMove={(rule, direction) =>
                    reorderMutation.mutate({ ruleId: rule.ruleId, direction })
                  }
                />
                <MailRuleRunLedger runs={data.recentRuns} />
              </Box>
            )}
          </Box>
        </Stack>
      ) : null}

      <MailFolderDialog
        open={Boolean(folderEditor)}
        folder={folderEditor && folderEditor !== 'new' ? folderEditor : null}
        accounts={data?.accounts ?? []}
        folders={data?.folders ?? []}
        busy={folderMutation.isPending}
        onClose={() => setFolderEditor(null)}
        onSave={(form) => folderMutation.mutate(form)}
      />
      <MailRuleDialog
        open={Boolean(ruleEditor)}
        rule={ruleEditor && ruleEditor !== 'new' ? ruleEditor : null}
        accounts={data?.accounts ?? []}
        folders={data?.folders ?? []}
        busy={ruleMutation.isPending}
        onClose={() => setRuleEditor(null)}
        onSave={(form) =>
          ruleMutation.mutate({
            form,
            rule: ruleEditor && ruleEditor !== 'new' ? ruleEditor : null,
          })
        }
      />
      <ConfirmDialog
        open={Boolean(pendingArchive)}
        title={t('organization.archiveTitle')}
        description={t('organization.archiveDescription', {
          name: pendingArchive?.item.displayName ?? '',
        })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('organization.archiveConfirm')}
        confirmingLabel={t('organization.archiving')}
        busy={archiveMutation.isPending}
        onClose={() => setPendingArchive(null)}
        onConfirm={() => {
          if (pendingArchive) {
            archiveMutation.mutate(pendingArchive);
          }
        }}
      />
    </PageCanvas>
  );
}

function MailRuleRunLedger({ runs }: { runs: MailRuleRun[] }) {
  const { t, i18n } = useTranslation('mail');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage ?? i18n.language);
  const recentRuns = [...runs]
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
    .slice(0, 10);
  return (
    <Box component="section" aria-labelledby="mail-rule-run-ledger-title" sx={{ mt: 3 }}>
      <Typography
        id="mail-rule-run-ledger-title"
        component="h3"
        variant="subtitle1"
        fontWeight={850}
      >
        {t('organization.ledger.title', { defaultValue: 'Recent rule activity' })}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
        {t('organization.ledger.description', {
          defaultValue: 'Review what each manual, incoming, or backfill run scanned and changed.',
        })}
      </Typography>
      {recentRuns.length ? (
        <Stack spacing={0} sx={{ mt: 1.25, borderBlock: 1, borderColor: 'divider' }}>
          {recentRuns.map((run) => (
            <Box
              key={run.runId}
              sx={{
                py: 1.25,
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  sm: 'minmax(180px, 1.2fr) repeat(3, minmax(72px, .45fr))',
                },
                gap: 1,
                alignItems: 'center',
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Chip
                    size="small"
                    color={
                      run.status === 'FAILED'
                        ? 'error'
                        : run.status === 'SUCCEEDED'
                          ? 'success'
                          : 'default'
                    }
                    variant="outlined"
                    label={t(`organization.ledger.status.${run.status}`, {
                      defaultValue: run.status,
                    })}
                  />
                  <Typography variant="body2" fontWeight={750}>
                    {t(`organization.ledger.trigger.${run.triggerKind}`, {
                      defaultValue: run.triggerKind,
                    })}
                  </Typography>
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.4 }}
                >
                  {formatDate(run.startedAt, { dateStyle: 'medium', timeStyle: 'short' }, locale)}
                  {run.completedAt
                    ? ` – ${formatDate(run.completedAt, { timeStyle: 'short' }, locale)}`
                    : ''}
                </Typography>
              </Box>
              <RunMetric label={t('organization.backfill.scanned')} value={run.scannedCount} />
              <RunMetric label={t('organization.backfill.matched')} value={run.matchedCount} />
              <RunMetric
                label={t('organization.ledger.changed', { defaultValue: 'Changed' })}
                value={run.changedCount}
              />
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          {t('organization.ledger.empty', { defaultValue: 'No rule runs have been recorded yet.' })}
        </Typography>
      )}
    </Box>
  );
}

function RunMetric({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={800}>
        {value}
      </Typography>
    </Box>
  );
}

function PulseValue({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <Box
      sx={{ p: 2.5, borderLeft: { md: 1 }, borderTop: { xs: 1, md: 0 }, borderColor: 'divider' }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={700}>
        {label}
      </Typography>
      <Typography variant="h4" fontWeight={850} sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    </Box>
  );
}

function FolderList({
  folders,
  onOpen,
  onEdit,
  onArchive,
}: {
  folders: Array<{ folder: MailFolder; depth: number }>;
  onOpen: (folder: MailFolder) => void;
  onEdit: (folder: MailFolder) => void;
  onArchive: (folder: MailFolder) => void;
}) {
  const { t } = useTranslation('mail');
  if (!folders.length) {
    return (
      <GuidedEmptyState
        kind="empty"
        title={t('organization.folder.emptyTitle')}
        description={t('organization.folder.emptyDescription')}
      />
    );
  }
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      {folders.map(({ folder, depth }) => (
        <Box
          key={folder.folderId}
          sx={{
            minHeight: 68,
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(0, 1fr) 120px 160px' },
            gap: 1,
            alignItems: 'center',
            px: 1,
            py: 1,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{ minWidth: 0, pl: depth * 2 }}
          >
            <Box
              sx={{
                width: 10,
                height: 32,
                borderRadius: 0.75,
                bgcolor: colorValue(folder.color),
                flexShrink: 0,
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={800} noWrap>
                {folder.displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('organization.folder.counts', {
                  total: folder.totalCount,
                  unread: folder.unreadCount,
                })}
              </Typography>
            </Box>
          </Stack>
          <Chip
            size="small"
            variant="outlined"
            label={t(`organization.sync.${folder.synchronizationState}`)}
            sx={{ display: { xs: 'none', md: 'inline-flex' }, justifySelf: 'start' }}
          />
          <Stack direction="row" spacing={0.25} justifyContent="flex-end">
            <ActionIconButton label={t('organization.folder.open')} onClick={() => onOpen(folder)}>
              <ArrowRight size={17} />
            </ActionIconButton>
            <ActionIconButton label={t('organization.edit')} onClick={() => onEdit(folder)}>
              <Pencil size={16} />
            </ActionIconButton>
            <ActionIconButton label={t('organization.archive')} onClick={() => onArchive(folder)}>
              <Archive size={16} />
            </ActionIconButton>
          </Stack>
        </Box>
      ))}
    </Box>
  );
}

function RuleList({
  rules,
  folders,
  busy,
  reorderBusy,
  onEdit,
  onToggle,
  onArchive,
  onMove,
}: {
  rules: MailRule[];
  folders: MailFolder[];
  busy: boolean;
  reorderBusy: boolean;
  onEdit: (rule: MailRule) => void;
  onToggle: (rule: MailRule, enabled: boolean) => void;
  onArchive: (rule: MailRule) => void;
  onMove: (rule: MailRule, direction: MailRuleMoveDirection) => void;
}) {
  const { t } = useTranslation('mail');
  if (!rules.length) {
    return (
      <GuidedEmptyState
        kind="empty"
        title={t('organization.rule.emptyTitle')}
        description={t('organization.rule.emptyDescription')}
      />
    );
  }
  const folderNames = new Map(folders.map((item) => [item.folderId, item.displayName]));
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      {rules.map((rule) => {
        const move = mailRuleMoveAvailability(rules, rule.ruleId);
        return (
          <Box
            key={rule.ruleId}
            sx={{
              minHeight: 84,
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', lg: 'minmax(0, 1fr) 180px 180px' },
              gap: 1.5,
              alignItems: 'center',
              px: 1.5,
              py: 1.25,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ListFilter size={17} color="var(--dwp-product-accent)" />
                <Typography fontWeight={800} noWrap>
                  {rule.displayName}
                </Typography>
                <Chip size="small" label={rule.priority} variant="outlined" />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} noWrap>
                {ruleSummary(rule, folderNames, t)}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                flexWrap="wrap"
                sx={{ display: { xs: 'flex', lg: 'none' }, mt: 0.5 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {rule.lastRunAt
                    ? t('organization.rule.lastRun', { count: rule.lastMatchCount })
                    : t('organization.rule.neverRun')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(`organization.sync.${rule.synchronizationState}`)}
                </Typography>
              </Stack>
            </Box>
            <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
              <Typography variant="caption" color="text.secondary">
                {rule.lastRunAt
                  ? t('organization.rule.lastRun', { count: rule.lastMatchCount })
                  : t('organization.rule.neverRun')}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                {t(`organization.sync.${rule.synchronizationState}`)}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.25} justifyContent="flex-end" alignItems="center">
              <ActionIconButton
                label={t('organization.rule.moveUp', { name: rule.displayName })}
                disabled={!move.up || reorderBusy}
                onClick={() => onMove(rule, 'UP')}
              >
                <ArrowUp size={15} />
              </ActionIconButton>
              <ActionIconButton
                label={t('organization.rule.moveDown', { name: rule.displayName })}
                disabled={!move.down || reorderBusy}
                onClick={() => onMove(rule, 'DOWN')}
              >
                <ArrowDown size={15} />
              </ActionIconButton>
              <Switch
                size="small"
                checked={rule.enabled}
                disabled={busy}
                slotProps={{
                  input: {
                    'aria-label': `${rule.displayName}: ${t('organization.rule.enabled')}`,
                  },
                }}
                onChange={(_event, enabled) => onToggle(rule, enabled)}
              />
              <ActionIconButton label={t('organization.edit')} onClick={() => onEdit(rule)}>
                <Pencil size={16} />
              </ActionIconButton>
              <ActionIconButton label={t('organization.archive')} onClick={() => onArchive(rule)}>
                <Trash2 size={16} />
              </ActionIconButton>
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

function folderHierarchy(folders: MailFolder[]) {
  const result: Array<{ folder: MailFolder; depth: number }> = [];
  const visit = (parentId: string | null, depth: number) => {
    folders
      .filter((item) => (item.parentFolderId ?? null) === parentId)
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .forEach((folder) => {
        result.push({ folder, depth });
        visit(folder.folderId, Math.min(3, depth + 1));
      });
  };
  visit(null, 0);
  return result;
}

function ruleSummary(
  rule: MailRule,
  folderNames: Map<string, string>,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  const condition = rule.conditions[0];
  const action = rule.actions[0];
  const conditionText = condition
    ? `${t(`organization.fields.${condition.field}`)} ${t(`organization.operators.${condition.operator}`)} “${condition.value}”`
    : '';
  const actionText =
    action?.type === 'MOVE_TO_FOLDER'
      ? t('organization.rule.moveSummary', {
          folder: folderNames.get(action.folderId ?? '') ?? '-',
        })
      : action
        ? t(`organization.actions.${action.type}`)
        : '';
  return `${conditionText} · ${actionText}`;
}
