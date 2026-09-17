import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  FileDown,
  Link2,
  Pencil,
  PlugZap,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  FormDialog,
  FormField,
  foundationTokens,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
  PageCanvas,
  SelectField,
  SignalMetric,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  bootstrapDwaionDataSourcePolicies,
  getDwaionDataSourcePolicies,
  updateDwaionDataSourcePolicy,
  type BootstrapDwaionGovernancePoliciesRequest,
  type DwaionDataClassification,
  type DwaionDataSourcePolicy,
  type DwaionSourceAccessMode,
  usePermissions,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { DwaionAdminPageHeader } from './dwaion-admin-ui';
import {
  DwaionAdminChangeReview,
  DwaionAdminRegistry,
  useAdminRegistryCopy,
} from './dwaion-admin-registry';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';
import { DwaionConnectorOperationsPanel } from './admin-advancement/dwaion-connector-operations-panel';

type SourceEditor = DwaionDataSourcePolicy & { changeReason: string };
type BootstrapEditor = BootstrapDwaionGovernancePoliciesRequest;

const CLASSIFICATION_OPTIONS = (['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const).map(
  (value) => ({ value, label: value })
);
const ACCESS_OPTIONS = (['SOURCE_PERMISSIONS', 'TENANT_ALLOWLIST', 'BLOCKED'] as const).map(
  (value) => ({ value, label: value })
);
const EMPTY_SOURCES: DwaionDataSourcePolicy[] = [];

export function DwaionAdminSources() {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = useAdminRegistryCopy();
  const queryClient = useQueryClient();
  const governUpdate = useDwaionGovernedMutation('route.dwaion.management.source-update.action');
  const governBootstrap = useDwaionGovernedMutation(
    'route.dwaion.management.sources-bootstrap.action'
  );
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission('ADMIN.DWAION_SOURCES', 'UPDATE');
  const canManage = hasPermission('ADMIN.DWAION_SOURCES', 'MANAGE');
  const [params, setParams] = useSearchParams();
  const desktopInspector = useMediaQuery(useTheme().breakpoints.up('md'));
  const [editor, setEditor] = useState<SourceEditor | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapEditor | null>(null);
  const [notice, setNotice] = useState<'saved' | 'initialized' | null>(null);
  const editorSession = useRef(0);

  useEffect(
    () => () => {
      editorSession.current += 1;
    },
    []
  );

  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'sources'],
    queryFn: getDwaionDataSourcePolicies,
    staleTime: 20_000,
  });
  const sources = query.data ?? EMPTY_SOURCES;
  const firstEntryId = sources[0]?.sourceKey;
  const summary = useMemo(
    () => ({
      enabled: sources.filter((source) => source.enabled).length,
      configured: sources.filter((source) => source.connectionState === 'CONNECTED').length,
      sourcePermission: sources.filter((source) => source.accessMode === 'SOURCE_PERMISSIONS')
        .length,
    }),
    [sources]
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

  const mutation = useMutation({
    mutationFn: (value: SourceEditor) =>
      governUpdate((authority) =>
        updateDwaionDataSourcePolicy(
          value.sourceKey,
          {
            enabled: value.enabled,
            accessMode: value.accessMode,
            classification: value.classification,
            connectorRef: value.connectorRef,
            expectedVersion: value.policyVersion,
            changeReason: value.changeReason.trim(),
          },
          authority
        )
      ),
    onSuccess: async () => {
      editorSession.current += 1;
      setEditor(null);
      setNotice('saved');
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'sources'] });
    },
  });
  const bootstrapMutation = useMutation({
    mutationFn: (request: BootstrapDwaionGovernancePoliciesRequest) =>
      governBootstrap((authority) => bootstrapDwaionDataSourcePolicies(request, authority)),
    onSuccess: async (data) => {
      setBootstrap(null);
      setNotice('initialized');
      queryClient.setQueryData(['dwaion', 'admin', 'sources'], data);
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'sources'] });
    },
  });

  const invalid = Boolean(
    !editor ||
    editor.changeReason.trim().length < 10 ||
    (editor.enabled && editor.accessMode === 'BLOCKED')
  );

  const connectionLabel = (row: DwaionDataSourcePolicy) =>
    t(`dwaionAdmin.sources.connectionStates.${row.connectionState}`, {
      defaultValue: row.connectionState,
    });
  const accessLabel = (value: DwaionSourceAccessMode) =>
    t(`dwaionAdmin.sources.accessModes.${value}`, { defaultValue: value });
  const classificationLabel = (value: DwaionDataClassification) =>
    t(`dwaionAdmin.sources.classifications.${value}`, { defaultValue: value });

  return (
    <PageCanvas topInset="compact">
      <DwaionAdminPageHeader
        eyebrow={t('dwaionAdmin.sources.eyebrow')}
        title={t('dwaionAdmin.sources.title')}
        description={t('dwaionAdmin.sources.description')}
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="stretch">
            <ActionButton
              intent="secondary"
              startIcon={<RefreshCw size={16} />}
              loading={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {t('dwaionAdmin.sources.healthCheckUnavailable')}
            </ActionButton>
            <ActionButton
              intent="secondary"
              startIcon={<FileDown size={16} />}
              disabled={!sources.length}
              onClick={() => downloadSourcePolicies(sources)}
            >
              {t('dwaionAdmin.sources.exportUnavailable')}
            </ActionButton>
            {!query.isLoading && !query.isError && sources.length === 0 && canManage ? (
              <ActionButton
                intent="primary"
                startIcon={<Database size={16} />}
                onClick={() =>
                  setBootstrap({
                    idempotencyKey: crypto.randomUUID(),
                    expectedExistingCount: 0,
                    changeReason: '',
                  })
                }
              >
                {t('dwaionAdmin.sources.initialize')}
              </ActionButton>
            ) : (
              <ActionButton
                intent="primary"
                startIcon={<PlugZap size={16} />}
                onClick={() => window.dispatchEvent(new Event('dwaion:open-connector-wizard'))}
              >
                {t('dwaionAdmin.sources.newConnectorUnavailable')}
              </ActionButton>
            )}
          </Stack>
        }
      />

      {notice && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setNotice(null)}>
          {t(`dwaionAdmin.sources.${notice}`)}
        </Alert>
      )}
      <DwaionConnectorOperationsPanel />
      {(mutation.isError || bootstrapMutation.isError) && !editor && !bootstrap && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionAdmin.sources.error')}
        </Alert>
      )}
      <Alert severity="info" icon={<ShieldCheck size={19} />} sx={{ mt: 2 }}>
        {t('dwaionAdmin.sources.secretBoundary')}
      </Alert>

      {query.isError ? (
        <Box sx={{ mt: 3 }}>
          <ErrorState
            size="page"
            title={t('dwaionAdmin.sources.error')}
            description={t('dwaionAdmin.sources.unavailableDescription')}
            retryLabel={t('dwaionAdmin.shared.retry')}
            retrying={query.isFetching}
            onRetry={() => void query.refetch()}
          />
        </Box>
      ) : (
        <>
          <Box
            component="section"
            aria-label={t('dwaionAdmin.sources.summaryLabel')}
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            <SignalMetric
              label={t('dwaionAdmin.sources.summary.registered')}
              value={String(sources.length)}
              detail={t('dwaionAdmin.sources.summary.registeredDetail')}
              icon={<Database size={18} aria-hidden="true" />}
            />
            <SignalMetric
              label={t('dwaionAdmin.sources.summary.enabled')}
              value={String(summary.enabled)}
              detail={t('dwaionAdmin.sources.summary.enabledDetail')}
              icon={<ShieldCheck size={18} aria-hidden="true" />}
              tone="success"
            />
            <SignalMetric
              label={t('dwaionAdmin.sources.summary.configured')}
              value={String(summary.configured)}
              detail={t('dwaionAdmin.sources.summary.configuredDetail')}
              icon={<Link2 size={18} aria-hidden="true" />}
              tone="info"
            />
            <SignalMetric
              label={t('dwaionAdmin.sources.summary.sourcePermission')}
              value={String(summary.sourcePermission)}
              detail={t('dwaionAdmin.sources.summary.sourcePermissionDetail')}
              icon={<ShieldAlert size={18} aria-hidden="true" />}
              tone="warning"
            />
          </Box>

          <InlineFeedback severity="info" sx={{ mt: 2 }}>
            {t('dwaionAdmin.sources.unsupportedNotice')}
          </InlineFeedback>

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
                  {t('dwaionAdmin.sources.registryTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('dwaionAdmin.sources.registryScope', { count: sources.length })}
                </Typography>
              </Box>
              <Chip size="small" variant="outlined" label={t('dwaionAdmin.sources.contract')} />
            </Stack>
            {query.isLoading ? (
              <LoadingState size="page" variant="skeleton" label={copy.loading} />
            ) : (
              <DwaionAdminRegistry
                label={t('dwaionAdmin.sources.tableLabel')}
                notice={copy.sourceBoundary}
                items={sources.map((row) => ({
                  id: row.sourceKey,
                  title: t(`dwaionAdmin.sources.sourceNames.${row.sourceKey}`, {
                    defaultValue: row.displayName,
                  }),
                  description: row.description,
                  state: connectionLabel(row),
                  stateTone:
                    row.connectionState === 'BLOCKED'
                      ? 'error'
                      : row.connectionState === 'CONNECTED'
                        ? 'info'
                        : 'warning',
                  fields: [
                    [t('dwaionAdmin.sources.columns.provider'), row.providerType],
                    [t('dwaionAdmin.sources.columns.access'), accessLabel(row.accessMode)],
                    [
                      t('dwaionAdmin.sources.columns.classification'),
                      classificationLabel(row.classification),
                    ],
                    [
                      t('dwaionAdmin.sources.columns.enabled'),
                      row.enabled
                        ? t('dwaionAdmin.shared.enabled')
                        : t('dwaionAdmin.shared.disabled'),
                    ],
                    [
                      t('dwaionAdmin.sources.fields.connector'),
                      row.connectorRef || t('dwaionAdmin.sources.notLinked'),
                    ],
                    [copy.version, row.policyVersion],
                    [
                      copy.updated,
                      formatDate(
                        row.updatedAt,
                        { dateStyle: 'medium', timeStyle: 'short' },
                        locale
                      ),
                    ],
                  ],
                  detail: (
                    <SourceContractBoundary
                      connectionState={connectionLabel(row)}
                      accessMode={accessLabel(row.accessMode)}
                      updatedAt={formatDate(
                        row.updatedAt,
                        { dateStyle: 'medium', timeStyle: 'short' },
                        locale
                      )}
                    />
                  ),
                  actions: canUpdate ? (
                    <ActionButton
                      startIcon={<Pencil size={17} />}
                      intent="secondary"
                      onClick={() => {
                        editorSession.current += 1;
                        mutation.reset();
                        setEditor({ ...row, changeReason: '' });
                      }}
                    >
                      {t('dwaionAdmin.sources.edit')}
                    </ActionButton>
                  ) : undefined,
                }))}
              />
            )}
          </Box>
        </>
      )}

      <FormDialog
        open={Boolean(editor)}
        title={t('dwaionAdmin.sources.dialogTitle')}
        description={
          editor
            ? t(`dwaionAdmin.sources.sourceNames.${editor.sourceKey}`, {
                defaultValue: editor.displayName,
              })
            : undefined
        }
        cancelLabel={t('dwaionAdmin.shared.cancel')}
        submitLabel={t('dwaionAdmin.shared.save')}
        submittingLabel={t('dwaionAdmin.shared.saving')}
        busy={mutation.isPending}
        submitDisabled={invalid}
        onClose={() => {
          editorSession.current += 1;
          setEditor(null);
        }}
        onSubmit={() => {
          if (editor) {
            editorSession.current += 1;
            mutation.mutate(editor);
          }
        }}
      >
        {editor && (
          <Stack spacing={2}>
            {mutation.isError && (
              <LocalErrorState
                title={t('dwaionAdmin.sources.error')}
                size="compact"
                retryLabel={copy.refreshVersion}
                retrying={query.isFetching}
                onRetry={() => {
                  const session = editorSession.current;
                  const key = editor.sourceKey;
                  void query.refetch().then((result) => {
                    const latest = result.isSuccess
                      ? result.data?.find((row) => row.sourceKey === key)
                      : undefined;
                    if (latest && editorSession.current === session) {
                      setEditor((current) =>
                        current?.sourceKey === key
                          ? { ...current, policyVersion: latest.policyVersion }
                          : current
                      );
                      mutation.reset();
                    }
                  });
                }}
              />
            )}
            <DwaionAdminChangeReview
              fields={[
                [
                  t('dwaionAdmin.sources.fields.enabled'),
                  query.data?.find((row) => row.sourceKey === editor.sourceKey)?.enabled,
                  editor.enabled,
                ],
                [
                  t('dwaionAdmin.sources.fields.access'),
                  query.data?.find((row) => row.sourceKey === editor.sourceKey)?.accessMode,
                  editor.accessMode,
                ],
                [
                  t('dwaionAdmin.sources.fields.connector'),
                  query.data?.find((row) => row.sourceKey === editor.sourceKey)?.connectorRef,
                  editor.connectorRef,
                ],
                [
                  t('dwaionAdmin.sources.fields.classification'),
                  query.data?.find((row) => row.sourceKey === editor.sourceKey)?.classification,
                  editor.classification,
                ],
                [copy.version, editor.policyVersion, editor.policyVersion],
              ]}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={editor.enabled}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      enabled: event.target.checked,
                      accessMode:
                        event.target.checked && editor.accessMode === 'BLOCKED'
                          ? 'SOURCE_PERMISSIONS'
                          : editor.accessMode,
                    })
                  }
                />
              }
              label={t('dwaionAdmin.sources.fields.enabled')}
            />
            <SelectField<DwaionSourceAccessMode>
              label={t('dwaionAdmin.sources.fields.access')}
              value={editor.accessMode}
              options={ACCESS_OPTIONS}
              onValueChange={(value) =>
                value &&
                setEditor({
                  ...editor,
                  accessMode: value,
                  enabled: value === 'BLOCKED' ? false : editor.enabled,
                })
              }
            />
            <SelectField<DwaionDataClassification>
              label={t('dwaionAdmin.sources.fields.classification')}
              value={editor.classification}
              options={CLASSIFICATION_OPTIONS}
              onValueChange={(value) => value && setEditor({ ...editor, classification: value })}
            />
            <FormField
              label={t('dwaionAdmin.sources.fields.connector')}
              value={editor.connectorRef ?? ''}
              onChange={(event) => setEditor({ ...editor, connectorRef: event.target.value })}
              supportingText={t('dwaionAdmin.sources.fields.connectorHelp')}
            />
            <FormField
              label={t('dwaionAdmin.shared.reason')}
              value={editor.changeReason}
              multiline
              minRows={3}
              onChange={(event) => setEditor({ ...editor, changeReason: event.target.value })}
              errorMessage={
                editor.changeReason && editor.changeReason.trim().length < 10
                  ? t('dwaionAdmin.shared.reasonError')
                  : undefined
              }
            />
          </Stack>
        )}
      </FormDialog>

      <FormDialog
        open={Boolean(bootstrap)}
        title={t('dwaionAdmin.sources.initializeTitle')}
        description={t('dwaionAdmin.sources.initializeDescription')}
        cancelLabel={t('dwaionAdmin.shared.cancel')}
        submitLabel={t('dwaionAdmin.sources.initialize')}
        submittingLabel={t('dwaionAdmin.shared.saving')}
        busy={bootstrapMutation.isPending}
        submitDisabled={!bootstrap || bootstrap.changeReason.trim().length < 10}
        onClose={() => setBootstrap(null)}
        onSubmit={() => {
          if (bootstrap) bootstrapMutation.mutate(bootstrap);
        }}
      >
        <Stack spacing={2}>
          {bootstrapMutation.isError && (
            <LocalErrorState title={t('dwaionAdmin.sources.error')} size="compact" />
          )}
          <InlineFeedback severity="warning">
            {t('dwaionAdmin.sources.initializeBoundary')}
          </InlineFeedback>
          <FormField
            label={t('dwaionAdmin.shared.reason')}
            value={bootstrap?.changeReason ?? ''}
            multiline
            minRows={3}
            onChange={(event) =>
              setBootstrap((current) =>
                current ? { ...current, changeReason: event.target.value } : current
              )
            }
            errorMessage={
              bootstrap?.changeReason && bootstrap.changeReason.trim().length < 10
                ? t('dwaionAdmin.shared.reasonError')
                : undefined
            }
          />
        </Stack>
      </FormDialog>
    </PageCanvas>
  );
}

function downloadSourcePolicies(sources: DwaionDataSourcePolicy[]) {
  const blob = new Blob(
    [JSON.stringify({ exportedAt: new Date().toISOString(), sources }, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dwaion-source-policies-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SourceContractBoundary({
  connectionState,
  accessMode,
  updatedAt,
}: {
  connectionState: string;
  accessMode: string;
  updatedAt: string;
}) {
  const { t } = useTranslation('work');
  return (
    <Box component="section" aria-labelledby="dwaion-source-contract-boundary">
      <Typography id="dwaion-source-contract-boundary" component="h3" variant="subtitle2">
        {t('dwaionAdmin.sources.evidence.title')}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
        {t('dwaionAdmin.sources.evidence.description')}
      </Typography>
      <EvidenceValue
        label={t('dwaionAdmin.sources.evidence.configurationState')}
        value={connectionState}
      />
      <EvidenceValue
        label={t('dwaionAdmin.sources.evidence.permissionEnforcement')}
        value={accessMode}
      />
      <EvidenceValue label={t('dwaionAdmin.sources.evidence.policyFreshness')} value={updatedAt} />
      {(['lastSync', 'latency', 'credentialHealth'] as const).map((key) => (
        <EvidenceValue
          key={key}
          label={t(`dwaionAdmin.sources.evidence.${key}`)}
          value={t('dwaionAdmin.sources.evidence.unavailable')}
          muted
        />
      ))}
    </Box>
  );
}

function EvidenceValue({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      gap={0.5}
      sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
    >
      <Typography variant="body2">{label}</Typography>
      <Typography variant="caption" color={muted ? 'text.secondary' : 'text.primary'}>
        {value}
      </Typography>
    </Stack>
  );
}
