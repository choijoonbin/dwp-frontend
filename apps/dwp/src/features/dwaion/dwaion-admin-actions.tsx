import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle2,
  FileClock,
  FileDown,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Workflow,
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
  bootstrapDwaionActionPolicies,
  getDwaionActionPolicies,
  updateDwaionActionPolicy,
  type BootstrapDwaionGovernancePoliciesRequest,
  type DwaionActionExecutionPolicy,
  type DwaionActionPolicy,
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

type ActionEditor = DwaionActionPolicy & { changeReason: string };
type BootstrapEditor = BootstrapDwaionGovernancePoliciesRequest;

const EXECUTION_OPTIONS = (['USER_HANDOFF', 'APPROVAL_HANDOFF', 'BLOCKED'] as const).map(
  (value) => ({ value, label: value })
);
const EMPTY_ACTIONS: DwaionActionPolicy[] = [];

export function DwaionAdminActions() {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = useAdminRegistryCopy();
  const queryClient = useQueryClient();
  const governUpdate = useDwaionGovernedMutation(
    'route.dwaion.management.action-policy-update.action'
  );
  const governBootstrap = useDwaionGovernedMutation(
    'route.dwaion.management.actions-bootstrap.action'
  );
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission('ADMIN.DWAION_ACTIONS', 'UPDATE');
  const canManage = hasPermission('ADMIN.DWAION_ACTIONS', 'MANAGE');
  const [params, setParams] = useSearchParams();
  const desktopInspector = useMediaQuery(useTheme().breakpoints.up('md'));
  const [editor, setEditor] = useState<ActionEditor | null>(null);
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
    queryKey: ['dwaion', 'admin', 'actions'],
    queryFn: getDwaionActionPolicies,
    staleTime: 20_000,
  });
  const actions = query.data ?? EMPTY_ACTIONS;
  const firstEntryId = actions[0]?.actionKey;
  const summary = useMemo(
    () => ({
      lowRisk: actions.filter((action) => ['L0', 'L1'].includes(action.riskTier)).length,
      elevatedRisk: actions.filter((action) => ['L2', 'L3'].includes(action.riskTier)).length,
      blocked: actions.filter((action) => !action.enabled || action.executionPolicy === 'BLOCKED')
        .length,
    }),
    [actions]
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
    mutationFn: (value: ActionEditor) =>
      governUpdate((authority) =>
        updateDwaionActionPolicy(
          value.actionKey,
          {
            enabled: value.enabled,
            confirmationRequired: value.confirmationRequired,
            executionPolicy: value.executionPolicy,
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
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'actions'] });
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'actions'] });
    },
  });
  const bootstrapMutation = useMutation({
    mutationFn: (request: BootstrapDwaionGovernancePoliciesRequest) =>
      governBootstrap((authority) => bootstrapDwaionActionPolicies(request, authority)),
    onSuccess: async (data) => {
      setBootstrap(null);
      setNotice('initialized');
      queryClient.setQueryData(['dwaion', 'admin', 'actions'], data);
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'actions'] });
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'actions'] });
    },
  });

  const invalid = Boolean(
    !editor ||
    editor.changeReason.trim().length < 10 ||
    !editor.confirmationRequired ||
    (editor.enabled && editor.executionPolicy === 'BLOCKED')
  );
  const executionLabel = (value: DwaionActionExecutionPolicy) =>
    t(`dwaionAdmin.actions.executionPolicies.${value}`, { defaultValue: value });

  return (
    <PageCanvas topInset="compact">
      <DwaionAdminPageHeader
        eyebrow={t('dwaionAdmin.actions.eyebrow')}
        title={t('dwaionAdmin.actions.title')}
        description={t('dwaionAdmin.actions.description')}
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="stretch">
            <ActionButton intent="secondary" startIcon={<FileDown size={16} />} disabled>
              {t('dwaionAdmin.actions.exportUnavailable')}
            </ActionButton>
            <ActionButton intent="secondary" startIcon={<FileClock size={16} />} disabled>
              {t('dwaionAdmin.actions.historyUnavailable')}
            </ActionButton>
            {!query.isLoading && !query.isError && actions.length === 0 && canManage ? (
              <ActionButton
                intent="primary"
                startIcon={<Workflow size={16} />}
                onClick={() =>
                  setBootstrap({
                    idempotencyKey: crypto.randomUUID(),
                    expectedExistingCount: 0,
                    changeReason: '',
                  })
                }
              >
                {t('dwaionAdmin.actions.initialize')}
              </ActionButton>
            ) : (
              <ActionButton intent="primary" startIcon={<Plus size={16} />} disabled>
                {t('dwaionAdmin.actions.newActionUnavailable')}
              </ActionButton>
            )}
          </Stack>
        }
      />

      {notice && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setNotice(null)}>
          {t(`dwaionAdmin.actions.${notice}`)}
        </Alert>
      )}
      {(mutation.isError || bootstrapMutation.isError) && !editor && !bootstrap && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionAdmin.actions.error')}
        </Alert>
      )}
      <Alert severity="info" icon={<ShieldCheck size={19} />} sx={{ mt: 2 }}>
        {t('dwaionAdmin.actions.executionBoundary')}
      </Alert>

      {query.isError ? (
        <Box sx={{ mt: 3 }}>
          <ErrorState
            size="page"
            title={t('dwaionAdmin.actions.error')}
            description={t('dwaionAdmin.actions.unavailableDescription')}
            retryLabel={t('dwaionAdmin.shared.retry')}
            retrying={query.isFetching}
            onRetry={() => void query.refetch()}
          />
        </Box>
      ) : (
        <>
          <Box
            component="section"
            aria-label={t('dwaionAdmin.actions.summaryLabel')}
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            <SignalMetric
              label={t('dwaionAdmin.actions.summary.registered')}
              value={String(actions.length)}
              detail={t('dwaionAdmin.actions.summary.registeredDetail')}
              icon={<Workflow size={18} aria-hidden="true" />}
            />
            <SignalMetric
              label={t('dwaionAdmin.actions.summary.lowRisk')}
              value={String(summary.lowRisk)}
              detail={t('dwaionAdmin.actions.summary.lowRiskDetail')}
              icon={<CheckCircle2 size={18} aria-hidden="true" />}
              tone="success"
            />
            <SignalMetric
              label={t('dwaionAdmin.actions.summary.elevatedRisk')}
              value={String(summary.elevatedRisk)}
              detail={t('dwaionAdmin.actions.summary.elevatedRiskDetail')}
              icon={<ShieldAlert size={18} aria-hidden="true" />}
              tone="warning"
            />
            <SignalMetric
              label={t('dwaionAdmin.actions.summary.blocked')}
              value={String(summary.blocked)}
              detail={t('dwaionAdmin.actions.summary.blockedDetail')}
              icon={<Ban size={18} aria-hidden="true" />}
              tone="error"
            />
          </Box>

          <InlineFeedback severity="info" sx={{ mt: 2 }}>
            {t('dwaionAdmin.actions.unsupportedNotice')}
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
                  {t('dwaionAdmin.actions.registryTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('dwaionAdmin.actions.registryScope', { count: actions.length })}
                </Typography>
              </Box>
              <Chip size="small" variant="outlined" label={t('dwaionAdmin.actions.contract')} />
            </Stack>
            {query.isLoading ? (
              <LoadingState size="page" variant="skeleton" label={copy.loading} />
            ) : (
              <DwaionAdminRegistry
                label={t('dwaionAdmin.actions.tableLabel')}
                notice={copy.actionBoundary}
                items={actions.map((row) => ({
                  id: row.actionKey,
                  title: row.title,
                  description: row.description,
                  state: executionLabel(row.executionPolicy),
                  stateTone:
                    !row.enabled || row.executionPolicy === 'BLOCKED'
                      ? 'error'
                      : row.executionPolicy === 'APPROVAL_HANDOFF'
                        ? 'warning'
                        : 'info',
                  fields: [
                    [copy.owningApp, copy.actionOwners.get(row.actionKey) ?? copy.unknownApp],
                    [t('dwaionAdmin.actions.columns.key'), row.actionKey],
                    [t('dwaionAdmin.actions.columns.risk'), row.riskTier],
                    [t('dwaionAdmin.actions.columns.permission'), row.requiredPermission],
                    [
                      t('dwaionAdmin.actions.columns.enabled'),
                      row.enabled
                        ? t('dwaionAdmin.shared.enabled')
                        : t('dwaionAdmin.shared.disabled'),
                    ],
                    [
                      t('dwaionAdmin.actions.fields.confirmation'),
                      row.confirmationRequired
                        ? t('dwaionAdmin.actions.required')
                        : t('dwaionAdmin.actions.notRequired'),
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
                    <ActionContractBoundary
                      riskTier={row.riskTier}
                      requiredPermission={row.requiredPermission}
                      executionPolicy={executionLabel(row.executionPolicy)}
                      confirmationRequired={row.confirmationRequired}
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
                      {t('dwaionAdmin.actions.edit')}
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
        title={t('dwaionAdmin.actions.dialogTitle')}
        description={editor?.title}
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
                title={t('dwaionAdmin.actions.error')}
                size="compact"
                retryLabel={copy.refreshVersion}
                retrying={query.isFetching}
                onRetry={() => {
                  const session = editorSession.current;
                  const key = editor.actionKey;
                  void query.refetch().then((result) => {
                    const latest = result.isSuccess
                      ? result.data?.find((row) => row.actionKey === key)
                      : undefined;
                    if (latest && editorSession.current === session) {
                      setEditor((current) =>
                        current?.actionKey === key
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
                  t('dwaionAdmin.actions.fields.enabled'),
                  query.data?.find((row) => row.actionKey === editor.actionKey)?.enabled,
                  editor.enabled,
                ],
                [
                  t('dwaionAdmin.actions.fields.policy'),
                  query.data?.find((row) => row.actionKey === editor.actionKey)?.executionPolicy,
                  editor.executionPolicy,
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
                      executionPolicy:
                        event.target.checked && editor.executionPolicy === 'BLOCKED'
                          ? 'USER_HANDOFF'
                          : editor.executionPolicy,
                    })
                  }
                />
              }
              label={t('dwaionAdmin.actions.fields.enabled')}
            />
            <SelectField<DwaionActionExecutionPolicy>
              label={t('dwaionAdmin.actions.fields.policy')}
              value={editor.executionPolicy}
              options={EXECUTION_OPTIONS}
              onValueChange={(value) =>
                value &&
                setEditor({
                  ...editor,
                  executionPolicy: value,
                  enabled: value === 'BLOCKED' ? false : editor.enabled,
                })
              }
            />
            <FormControlLabel
              control={
                <Switch checked={editor.confirmationRequired} disabled onChange={() => undefined} />
              }
              label={t('dwaionAdmin.actions.fields.confirmation')}
            />
            <InlineFeedback severity="warning">
              {t('dwaionAdmin.actions.confirmationLocked')}
            </InlineFeedback>
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
        title={t('dwaionAdmin.actions.initializeTitle')}
        description={t('dwaionAdmin.actions.initializeDescription')}
        cancelLabel={t('dwaionAdmin.shared.cancel')}
        submitLabel={t('dwaionAdmin.actions.initialize')}
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
            <LocalErrorState title={t('dwaionAdmin.actions.error')} size="compact" />
          )}
          <InlineFeedback severity="warning">
            {t('dwaionAdmin.actions.initializeBoundary')}
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

function ActionContractBoundary({
  riskTier,
  requiredPermission,
  executionPolicy,
  confirmationRequired,
}: {
  riskTier: string;
  requiredPermission: string;
  executionPolicy: string;
  confirmationRequired: boolean;
}) {
  const { t } = useTranslation('work');
  return (
    <Box component="section" aria-labelledby="dwaion-action-contract-boundary">
      <Typography id="dwaion-action-contract-boundary" component="h3" variant="subtitle2">
        {t('dwaionAdmin.actions.evidence.title')}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
        {t('dwaionAdmin.actions.evidence.description')}
      </Typography>
      <EvidenceValue label={t('dwaionAdmin.actions.evidence.risk')} value={riskTier} />
      <EvidenceValue
        label={t('dwaionAdmin.actions.evidence.permission')}
        value={requiredPermission}
      />
      <EvidenceValue label={t('dwaionAdmin.actions.evidence.handoff')} value={executionPolicy} />
      <EvidenceValue
        label={t('dwaionAdmin.actions.evidence.confirmation')}
        value={t(
          confirmationRequired ? 'dwaionAdmin.actions.required' : 'dwaionAdmin.actions.notRequired'
        )}
      />
      {(['preflight', 'approvalChain', 'runtimeAvailability'] as const).map((key) => (
        <EvidenceValue
          key={key}
          label={t(`dwaionAdmin.actions.evidence.${key}`)}
          value={t('dwaionAdmin.actions.evidence.unavailable')}
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
