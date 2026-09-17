import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  CheckCircle2,
  CopyPlus,
  FileDown,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import {
  ActionButton,
  ConfirmDialog,
  ErrorState,
  FormDialog,
  FormField,
  foundationTokens,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  activateDwaionAdminAgentRevision,
  createDwaionAdminAgent,
  createDwaionAdminAgentRevision,
  listDwaionAdminAgents,
  retireDwaionAdminAgentRevision,
  updateDwaionAdminAgentRevision,
  type RegistryEntry,
  type RiskTier,
  usePermissions,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';

import { DwaionAdminPageHeader } from './dwaion-admin-ui';

import {
  DwaionAdminChangeReview,
  DwaionAdminRegistry,
  useAdminRegistryCopy,
} from './dwaion-admin-registry';
import { DwaionAdminAgentHistory } from './dwaion-admin-agent-history';
import { DwaionAgentGovernancePanel } from './admin-advancement/dwaion-agent-governance-panel';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';

type EditorMode = 'create' | 'edit' | 'revision';
type EditorState = {
  mode: EditorMode;
  source?: RegistryEntry;
  entryKey: string;
  name: string;
  description: string;
  ownerRef: string;
  riskTier: RiskTier;
  artifactVersion: string;
};

const EMPTY_EDITOR: EditorState = {
  mode: 'create',
  entryKey: '',
  name: '',
  description: '',
  ownerRef: '',
  riskTier: 'MEDIUM',
  artifactVersion: '1.0.0',
};

const RISK_OPTIONS = (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((value) => ({
  value,
  label: value,
}));

const EMPTY_AGENTS: RegistryEntry[] = [];

export function DwaionAdminAgents() {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = useAdminRegistryCopy();
  const [transition, setTransition] = useState<{
    entry: RegistryEntry;
    transition: 'activate' | 'retire';
  } | null>(null);
  const queryClient = useQueryClient();
  const governCreate = useDwaionGovernedMutation('route.dwaion.management.agent-create.action');
  const governRevisionCreate = useDwaionGovernedMutation(
    'route.dwaion.management.agent-revision-create.action'
  );
  const governRevisionUpdate = useDwaionGovernedMutation(
    'route.dwaion.management.agent-revision-update.action'
  );
  const governActivate = useDwaionGovernedMutation(
    'route.dwaion.management.agent-revision-activate.action'
  );
  const governRetire = useDwaionGovernedMutation(
    'route.dwaion.management.agent-revision-retire.action'
  );
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('ADMIN.DWAION_AGENTS', 'CREATE');
  const canUpdate = hasPermission('ADMIN.DWAION_AGENTS', 'UPDATE');
  const canApprove = hasPermission('ADMIN.DWAION_AGENTS', 'APPROVE');
  const canManage = hasPermission('ADMIN.DWAION_AGENTS', 'MANAGE');
  const [params, setParams] = useSearchParams();
  const desktopInspector = useMediaQuery(useTheme().breakpoints.up('md'));
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const editorSession = useRef(0);
  useEffect(
    () => () => {
      editorSession.current += 1;
    },
    []
  );
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'agents'],
    queryFn: () => listDwaionAdminAgents(),
    staleTime: 20_000,
  });
  const agents = query.data?.content ?? EMPTY_AGENTS;
  const firstEntryId = agents[0] ? `${agents[0].entryKey}:${agents[0].revision}` : undefined;
  const summary = useMemo(
    () => ({
      active: agents.filter((entry) => entry.lifecycleState === 'ACTIVE').length,
      draft: agents.filter((entry) => entry.lifecycleState === 'DRAFT').length,
      retired: agents.filter((entry) => entry.lifecycleState === 'RETIRED').length,
      elevated: agents.filter((entry) => ['HIGH', 'CRITICAL'].includes(entry.riskTier)).length,
    }),
    [agents]
  );

  useEffect(() => {
    if (!desktopInspector || !firstEntryId || params.has('entry')) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('entry', firstEntryId);
        return next;
      },
      { replace: true, preventScrollReset: true }
    );
  }, [desktopInspector, firstEntryId, params, setParams]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'agents'] });
    await queryClient.invalidateQueries({ queryKey: ['dwaion', 'runtime-agents'] });
    await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'agent-detail'] });
  };
  const editorMutation = useMutation({
    mutationFn: async (state: EditorState) => {
      const definition = {
        name: state.name.trim(),
        description: state.description.trim() || null,
        ownerRef: state.ownerRef.trim(),
        riskTier: state.riskTier,
        artifactVersion: state.artifactVersion.trim(),
      };
      if (state.mode === 'create') {
        return governCreate((authority) =>
          createDwaionAdminAgent(
            { entryKey: state.entryKey.trim().toUpperCase(), ...definition },
            authority
          )
        );
      }
      if (!state.source) throw new Error('Agent source is missing.');
      if (state.mode === 'revision') {
        return governRevisionCreate((authority) =>
          createDwaionAdminAgentRevision(state.source!, definition, authority)
        );
      }
      return governRevisionUpdate((authority) =>
        updateDwaionAdminAgentRevision(
          state.source!,
          { ...definition, version: state.source!.version },
          authority
        )
      );
    },
    onSuccess: async () => {
      editorSession.current += 1;
      setEditor(null);
      setNotice(t('dwaionAdmin.agents.saved'));
      await refresh();
    },
  });
  const lifecycleMutation = useMutation({
    mutationFn: async ({
      entry,
      transition,
    }: {
      entry: RegistryEntry;
      transition: 'activate' | 'retire';
    }) =>
      transition === 'activate'
        ? governActivate((authority) => activateDwaionAdminAgentRevision(entry, authority))
        : governRetire((authority) => retireDwaionAdminAgentRevision(entry, authority)),
    onSuccess: async (_, variables) => {
      setNotice(t(`dwaionAdmin.agents.${variables.transition}d`));
      setTransition(null);
      await refresh();
    },
  });

  const openEditor = (mode: EditorMode, source?: RegistryEntry) => {
    editorSession.current += 1;
    editorMutation.reset();
    setEditor(
      source
        ? {
            mode,
            source,
            entryKey: source.entryKey,
            name: source.name,
            description: source.description ?? '',
            ownerRef: source.ownerRef,
            riskTier: source.riskTier,
            artifactVersion: source.artifactVersion,
          }
        : { ...EMPTY_EDITOR }
    );
  };
  const valid = Boolean(
    editor?.entryKey.trim() &&
    editor.name.trim() &&
    editor.ownerRef.trim() &&
    editor.artifactVersion.trim() &&
    (editor.mode !== 'edit' || editor.source?.lifecycleState === 'DRAFT')
  );

  return (
    <PageCanvas topInset="compact">
      <DwaionAdminPageHeader
        eyebrow={t('dwaionAdmin.agents.eyebrow')}
        title={t('dwaionAdmin.agents.title')}
        description={t('dwaionAdmin.agents.description')}
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="stretch">
            <ActionButton
              intent="secondary"
              startIcon={<Archive size={16} />}
              disabled={!firstEntryId}
              onClick={() =>
                firstEntryId &&
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set('entry', firstEntryId);
                  return next;
                })
              }
            >
              {t('dwaionAdmin.agents.deploymentHistoryUnavailable')}
            </ActionButton>
            <ActionButton
              intent="secondary"
              startIcon={<FileDown size={16} />}
              disabled={!agents.length}
              onClick={() => downloadAgentRegistry(agents)}
            >
              {t('dwaionAdmin.agents.schemaExportUnavailable')}
            </ActionButton>
            {canCreate && (
              <ActionButton
                intent="primary"
                startIcon={<Plus size={16} />}
                onClick={() => openEditor('create')}
              >
                {t('dwaionAdmin.agents.create')}
              </ActionButton>
            )}
          </Stack>
        }
      />
      {notice && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      {(editorMutation.isError || lifecycleMutation.isError) && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionAdmin.agents.error')}
        </Alert>
      )}
      {query.isError && (
        <ErrorState
          size="page"
          title={t('dwaionAdmin.agents.error')}
          retryLabel={t('dwaionAdmin.shared.retry')}
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      )}
      <Alert severity="info" icon={<ShieldCheck size={19} />} sx={{ mt: 2 }}>
        {t('dwaionAdmin.agents.lifecycleNotice')}
      </Alert>

      {!query.isError && (
        <Box
          component="section"
          aria-label={t('dwaionAdmin.agents.summaryLabel')}
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          <AgentSummaryCard
            icon={CheckCircle2}
            label={t('dwaionAdmin.agents.summary.active')}
            value={summary.active}
            tone="success"
          />
          <AgentSummaryCard
            icon={Pencil}
            label={t('dwaionAdmin.agents.summary.draft')}
            value={summary.draft}
          />
          <AgentSummaryCard
            icon={RotateCcw}
            label={t('dwaionAdmin.agents.summary.retired')}
            value={summary.retired}
            tone="neutral"
          />
          <AgentSummaryCard
            icon={ShieldAlert}
            label={t('dwaionAdmin.agents.summary.elevatedRisk')}
            value={summary.elevated}
            tone="warning"
          />
        </Box>
      )}

      {!query.isError && (
        <InlineFeedback severity="info" sx={{ mt: 2 }}>
          {t('dwaionAdmin.agents.unsupportedNotice')}
        </InlineFeedback>
      )}

      {!query.isLoading && !query.isError && agents.length > 0 && (
        <DwaionAgentGovernancePanel agents={agents} onRefresh={refresh} />
      )}

      {!query.isError && (
        <Box
          sx={{
            mt: 2,
            p: { xs: 1.5, md: 2 },
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: foundationTokens.radius.surface + 'px',
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            gap={1}
          >
            <Box>
              <Typography component="h2" variant="h6">
                {t('dwaionAdmin.agents.registryTitle')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('dwaionAdmin.agents.registryScope', {
                  loaded: agents.length,
                  total: query.data?.totalElements ?? agents.length,
                })}
              </Typography>
            </Box>
            <Chip
              size="small"
              variant="outlined"
              label={t('dwaionAdmin.agents.lifecycleContract')}
            />
          </Stack>
          {query.isLoading && <LoadingState size="page" variant="skeleton" label={copy.loading} />}
          {!query.isLoading && !query.isError && (
            <DwaionAdminRegistry
              label={t('dwaionAdmin.agents.tableLabel')}
              notice={copy.limit}
              items={agents.map((row) => ({
                id: `${row.entryKey}:${row.revision}`,
                title: row.name,
                description: row.description,
                state: row.lifecycleState,
                stateTone:
                  row.lifecycleState === 'ACTIVE'
                    ? 'success'
                    : row.lifecycleState === 'DRAFT'
                      ? 'info'
                      : 'default',
                fields: [
                  [t('dwaionAdmin.agents.fields.owner'), row.ownerRef],
                  [t('dwaionAdmin.agents.fields.risk'), row.riskTier],
                  [t('dwaionAdmin.agents.columns.key'), row.entryKey],
                  [t('dwaionAdmin.agents.columns.revision'), row.revision],
                  [t('dwaionAdmin.agents.columns.version'), row.artifactVersion],
                  [
                    copy.updated,
                    row.updatedAt
                      ? formatDate(
                          row.updatedAt,
                          { dateStyle: 'medium', timeStyle: 'short' },
                          locale
                        )
                      : '—',
                  ],
                ],
                detail: (
                  <>
                    <AgentContractBoundary lifecycleState={row.lifecycleState} />
                    <DwaionAdminAgentHistory entryKey={row.entryKey} />
                  </>
                ),
                actions: (
                  <>
                    {row.lifecycleState === 'DRAFT' && canUpdate && (
                      <ActionButton
                        intent="secondary"
                        startIcon={<Pencil size={17} />}
                        onClick={() => openEditor('edit', row)}
                      >
                        {t('dwaionAdmin.agents.edit')}
                      </ActionButton>
                    )}
                    {row.lifecycleState !== 'DRAFT' && canCreate && (
                      <ActionButton
                        intent="secondary"
                        startIcon={<CopyPlus size={17} />}
                        onClick={() => openEditor('revision', row)}
                      >
                        {t('dwaionAdmin.agents.newRevision')}
                      </ActionButton>
                    )}
                    {row.lifecycleState === 'DRAFT' && canApprove && (
                      <ActionButton
                        intent="primary"
                        startIcon={<CheckCircle2 size={17} />}
                        onClick={() => setTransition({ entry: row, transition: 'activate' })}
                      >
                        {t('dwaionAdmin.agents.activate')}
                      </ActionButton>
                    )}
                    {row.lifecycleState !== 'RETIRED' && canManage && (
                      <ActionButton
                        intent="quiet"
                        startIcon={<RotateCcw size={17} />}
                        onClick={() => setTransition({ entry: row, transition: 'retire' })}
                      >
                        {t('dwaionAdmin.agents.retire')}
                      </ActionButton>
                    )}
                  </>
                ),
              }))}
            />
          )}
        </Box>
      )}

      <ConfirmDialog
        open={Boolean(transition)}
        title={t(`dwaionAdmin.agents.${transition?.transition ?? 'activate'}`)}
        description={transition?.transition === 'retire' ? copy.retire : copy.activate}
        details={
          <Stack spacing={1}>
            {transition?.entry.name}
            <br />
            {transition?.entry.entryKey} · {transition?.entry.artifactVersion} ·{' '}
            {transition?.entry.revision}
            {lifecycleMutation.isError && (
              <LocalErrorState title={t('dwaionAdmin.agents.error')} size="compact" />
            )}
          </Stack>
        }
        cancelLabel={t('dwaionAdmin.shared.cancel')}
        confirmLabel={t(`dwaionAdmin.agents.${transition?.transition ?? 'activate'}`)}
        intent={transition?.transition === 'retire' ? 'danger' : 'primary'}
        busy={lifecycleMutation.isPending}
        onClose={() => setTransition(null)}
        onConfirm={() => {
          if (transition) lifecycleMutation.mutate(transition);
        }}
      />

      <FormDialog
        open={Boolean(editor)}
        title={t(`dwaionAdmin.agents.dialog.${editor?.mode ?? 'create'}.title`)}
        description={t(`dwaionAdmin.agents.dialog.${editor?.mode ?? 'create'}.description`)}
        cancelLabel={t('dwaionAdmin.shared.cancel')}
        submitLabel={t('dwaionAdmin.shared.save')}
        submittingLabel={t('dwaionAdmin.shared.saving')}
        busy={editorMutation.isPending}
        submitDisabled={!valid}
        onClose={() => {
          editorSession.current += 1;
          setEditor(null);
        }}
        onSubmit={() => {
          if (editor) {
            editorSession.current += 1;
            editorMutation.mutate(editor);
          }
        }}
      >
        {editor && (
          <Stack spacing={2}>
            {editorMutation.isError && (
              <LocalErrorState
                title={t('dwaionAdmin.agents.error')}
                size="compact"
                retryLabel={copy.refreshVersion}
                retrying={query.isFetching}
                onRetry={
                  editor.mode === 'edit'
                    ? () => {
                        const session = editorSession.current;
                        const source = editor.source;
                        void query.refetch().then((result) => {
                          const latest = result.isSuccess
                            ? result.data?.content.find(
                                (row) =>
                                  row.entryKey === source?.entryKey &&
                                  row.revision === source?.revision
                              )
                            : undefined;
                          if (latest && editorSession.current === session) {
                            setEditor((current) =>
                              current &&
                              source &&
                              current.source?.entryKey === source.entryKey &&
                              current.source?.revision === source.revision
                                ? { ...current, source: latest }
                                : current
                            );
                            editorMutation.reset();
                          }
                        });
                      }
                    : undefined
                }
              />
            )}
            {editor.mode === 'edit' && editor.source && (
              <>
                {editor.source.lifecycleState !== 'DRAFT' && (
                  <InlineFeedback severity="warning">{copy.noLongerDraft}</InlineFeedback>
                )}
                <DwaionAdminChangeReview
                  fields={[
                    [t('dwaionAdmin.agents.fields.name'), editor.source.name, editor.name],
                    [
                      t('dwaionAdmin.agents.fields.description'),
                      editor.source.description,
                      editor.description,
                    ],
                    [t('dwaionAdmin.agents.fields.owner'), editor.source.ownerRef, editor.ownerRef],
                    [t('dwaionAdmin.agents.fields.risk'), editor.source.riskTier, editor.riskTier],
                    [
                      t('dwaionAdmin.agents.fields.version'),
                      editor.source.artifactVersion,
                      editor.artifactVersion,
                    ],
                    [copy.version, editor.source.version, editor.source.version],
                  ]}
                />
              </>
            )}
            <FormField
              label={t('dwaionAdmin.agents.fields.key')}
              value={editor.entryKey}
              disabled={editor.mode !== 'create'}
              onChange={(event) => setEditor({ ...editor, entryKey: event.target.value })}
            />
            <FormField
              label={t('dwaionAdmin.agents.fields.name')}
              value={editor.name}
              onChange={(event) => setEditor({ ...editor, name: event.target.value })}
            />
            <FormField
              label={t('dwaionAdmin.agents.fields.description')}
              value={editor.description}
              multiline
              minRows={3}
              onChange={(event) => setEditor({ ...editor, description: event.target.value })}
            />
            <FormField
              label={t('dwaionAdmin.agents.fields.owner')}
              value={editor.ownerRef}
              onChange={(event) => setEditor({ ...editor, ownerRef: event.target.value })}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <SelectField
                label={t('dwaionAdmin.agents.fields.risk')}
                value={editor.riskTier}
                options={RISK_OPTIONS}
                onValueChange={(value) => value && setEditor({ ...editor, riskTier: value })}
              />
              <FormField
                label={t('dwaionAdmin.agents.fields.version')}
                value={editor.artifactVersion}
                onChange={(event) => setEditor({ ...editor, artifactVersion: event.target.value })}
              />
            </Stack>
          </Stack>
        )}
      </FormDialog>
    </PageCanvas>
  );
}

function downloadAgentRegistry(agents: RegistryEntry[]) {
  const blob = new Blob(
    [JSON.stringify({ exportedAt: new Date().toISOString(), agents }, null, 2)],
    {
      type: 'application/json',
    }
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dwaion-agent-registry-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function AgentSummaryCard({
  icon: Icon,
  label,
  value,
  tone = 'primary',
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: 'primary' | 'success' | 'warning' | 'neutral';
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      justifyContent="space-between"
      gap={1}
      sx={(theme) => {
        const color = tone === 'neutral' ? theme.palette.text.secondary : theme.palette[tone].main;
        return {
          minHeight: 96,
          p: 1.75,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.radius.surface + 'px',
          boxShadow: theme.shadows[1],
          '& .agent-summary-icon': { color, bgcolor: alpha(color, 0.1) },
        };
      }}
    >
      <Box>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.35, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </Typography>
      </Box>
      <Box
        className="agent-summary-icon"
        sx={{
          display: 'grid',
          placeItems: 'center',
          width: 36,
          height: 36,
          borderRadius: foundationTokens.radius.compact + 'px',
        }}
      >
        <Icon size={19} aria-hidden="true" />
      </Box>
    </Stack>
  );
}

function AgentContractBoundary({
  lifecycleState,
}: {
  lifecycleState: RegistryEntry['lifecycleState'];
}) {
  const { t } = useTranslation('work');
  return (
    <Box component="section" aria-labelledby="dwaion-agent-contract-boundary">
      <Typography id="dwaion-agent-contract-boundary" component="h3" variant="subtitle2">
        {t('dwaionAdmin.agents.contract.title')}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.35 }}>
        {t('dwaionAdmin.agents.contract.description', { state: lifecycleState })}
      </Typography>
      <Box sx={{ mt: 1 }}>
        {(['runtime', 'bindings', 'review', 'deployment'] as const).map((key, index) => (
          <Box key={key}>
            {index > 0 && <Divider />}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
              gap={0.5}
              sx={{ py: 1 }}
            >
              <Typography variant="body2">{t(`dwaionAdmin.agents.contract.${key}`)}</Typography>
              <Chip
                size="small"
                variant="outlined"
                label={t('dwaionAdmin.agents.contract.notProvided')}
                sx={{ color: 'text.secondary' }}
              />
            </Stack>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
