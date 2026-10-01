import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CircleAlert, LockKeyhole, RefreshCw, RotateCcw, ShieldOff, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateTenantCapabilityOverride,
  createTenantCapabilityOverride,
  decideTenantCapabilityOverride,
  getTenantCapabilityOverrideProjection,
  getTenantProviderPlanEligibility,
  revokeTenantCapabilityOverride,
  submitTenantCapabilityOverride,
  usePermissions,
  useToast,
  type TenantCapabilityOverrideChange,
  type TenantCapabilityOverridePolicy,
  type TenantEffectiveCapability,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  DateTimePickerField,
  FormDialog,
  FormField,
  GuidedEmptyState,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  capabilityActionPresentationKey,
  capabilityDesiredStatePresentationKey,
  capabilityEffectiveStatePresentationKey,
  capabilityOverrideModePresentationKey,
  capabilityPlanStatePresentationKey,
  capabilitySourcePresentationKey,
  capabilitySurfacePresentationKey,
  capabilityWorkflowStatePresentationKey,
  isTenantCapabilityCatalogEmpty,
  productPresentationKey,
  tenantAppCoveragePresentationKey,
  tenantPlanCoveragePresentationKey,
} from './tenant-app-presentation';

type WorkflowAction = 'APPROVE' | 'REJECT' | 'ACTIVATE' | 'REVOKE';
type Command = {
  change: TenantCapabilityOverrideChange;
  action: WorkflowAction;
  policy?: TenantCapabilityOverridePolicy;
};
type Draft = {
  policy: TenantCapabilityOverridePolicy;
  desiredState: 'DISABLED' | 'INHERIT';
};

const queryKey = ['admin', 'tenant-app-adoption', 'capability-overrides'] as const;
const planQueryKey = ['admin', 'tenant-owner', 'plan-eligibility'] as const;

function stateColor(state: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (state === 'ENABLED' || state === 'ACTIVE') return 'success';
  if (state === 'DISABLED' || state === 'REJECTED' || state === 'REVOKED') return 'error';
  if (state === 'IN_REVIEW' || state === 'APPROVED') return 'warning';
  return state === 'DRAFT' ? 'info' : 'default';
}

export function TenantAppCapabilityMatrix() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const { hasPermission, isLoaded: permissionsLoaded } = usePermissions();
  const canReadPlan = permissionsLoaded && hasPermission('ADMIN.APP_GOVERNANCE', 'VIEW');
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [command, setCommand] = useState<Command | null>(null);
  const [busy, setBusy] = useState(false);
  const projection = useQuery({
    queryKey,
    queryFn: getTenantCapabilityOverrideProjection,
    retry: false,
  });
  const planEligibility = useQuery({
    queryKey: planQueryKey,
    queryFn: ({ signal }) => getTenantProviderPlanEligibility(signal),
    enabled: canReadPlan,
    retry: false,
  });
  const groups = useMemo(() => {
    const grouped = new Map<string, TenantEffectiveCapability[]>();
    for (const capability of projection.data?.capabilities ?? []) {
      const current = grouped.get(capability.policy.productKey) ?? [];
      current.push(capability);
      grouped.set(capability.policy.productKey, current);
    }
    return [...grouped.entries()];
  }, [projection.data]);
  const policiesByContract = useMemo(
    () =>
      new Map(
        (projection.data?.capabilities ?? []).map((capability) => [
          capability.policy.contractKey,
          capability.policy,
        ])
      ),
    [projection.data]
  );
  const eligibilityByProduct = useMemo(
    () =>
      new Map(
        (planEligibility.data?.products ?? []).map((product) => [product.productKey, product])
      ),
    [planEligibility.data]
  );
  const productLabel = (productKey: string) => t(productPresentationKey(productKey));
  const capabilityLabel = (policy: TenantCapabilityOverridePolicy | undefined) =>
    policy
      ? t('appGovernance.adoption.capabilities.capabilityLabel', {
          surface: t(capabilitySurfacePresentationKey(policy.surfaceKey)),
          action: t(capabilityActionPresentationKey(policy.action)),
        })
      : t('appGovernance.adoption.capabilities.surfaces.unknown');
  const desiredStateLabel = (state: TenantCapabilityOverrideChange['desiredState']) =>
    t(capabilityDesiredStatePresentationKey(state));
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: planQueryKey }),
    ]);
  };
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await operation();
      await refresh();
      setDraft(null);
      setCommand(null);
      toast.success(t('appGovernance.adoption.capabilities.toasts.completed'));
    } catch {
      toast.error(t('appGovernance.adoption.capabilities.toasts.failed'));
    } finally {
      setBusy(false);
    }
  };
  const executeCommand = async (reason: string) => {
    if (!command) return;
    if (command.action === 'ACTIVATE') {
      await run(() => activateTenantCapabilityOverride(command.change, reason));
    } else if (command.action === 'REVOKE') {
      await run(() => revokeTenantCapabilityOverride(command.change, reason));
    } else if (command.action === 'APPROVE' || command.action === 'REJECT') {
      const decision = command.action;
      await run(() => decideTenantCapabilityOverride(command.change, decision, reason));
    }
  };

  if (projection.isLoading) {
    return (
      <Typography color="text.secondary">
        {t('appGovernance.adoption.capabilities.loading')}
      </Typography>
    );
  }
  if (projection.isError || !projection.data) {
    return (
      <Alert
        severity="error"
        action={
          <ActionButton intent="quiet" size="small" onClick={() => void refresh()}>
            {t('common.actions.retry')}
          </ActionButton>
        }
      >
        {t('appGovernance.adoption.capabilities.loadError')}
      </Alert>
    );
  }

  return (
    <Box component="section" aria-labelledby="tenant-app-capability-matrix-title">
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
        <Box>
          <Typography id="tenant-app-capability-matrix-title" component="h2" variant="h6">
            {t('appGovernance.adoption.capabilities.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('appGovernance.adoption.capabilities.description')}
          </Typography>
        </Box>
        <ActionIconButton label={t('common.actions.refresh')} onClick={() => void refresh()}>
          <RefreshCw size={17} />
        </ActionIconButton>
      </Stack>
      <Alert severity="info" icon={<LockKeyhole size={19} />} sx={{ mt: 1.25 }}>
        {t('appGovernance.adoption.capabilities.boundary')}
      </Alert>
      {projection.data.exclusions.length > 0 && (
        <Alert severity="warning" icon={<CircleAlert size={19} />} sx={{ mt: 1 }}>
          {t('appGovernance.adoption.capabilities.externalBoundary')}
        </Alert>
      )}
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
        {t('appGovernance.adoption.capabilities.observation', {
          observedAt: formatDate(projection.data.observedAt, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
          coverage: t(tenantAppCoveragePresentationKey(projection.data.coverageState)),
        })}
      </Typography>
      {canReadPlan && planEligibility.data && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          {t('appGovernance.adoption.capabilities.plan.observation', {
            observedAt: formatDate(planEligibility.data.observedAt, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
            sourceChangedAt: planEligibility.data.sourceLastChangedAt
              ? formatDate(planEligibility.data.sourceLastChangedAt, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : t('appGovernance.adoption.capabilities.plan.sourceUnavailable'),
            coverage: t(tenantPlanCoveragePresentationKey(planEligibility.data.coverageState)),
          })}
        </Typography>
      )}
      {isTenantCapabilityCatalogEmpty(projection.data.capabilities.length) && (
        <Box sx={{ mt: 1.25 }}>
          <GuidedEmptyState
            kind="empty"
            title={t('appGovernance.adoption.capabilities.emptyTitle')}
            description={t('appGovernance.adoption.capabilities.emptyDescription')}
          />
        </Box>
      )}
      {!isTenantCapabilityCatalogEmpty(projection.data.capabilities.length) && (
        <Stack gap={1.25} sx={{ mt: 1.25 }}>
          {groups.map(([productKey, capabilities]) => {
            const planProduct = eligibilityByProduct.get(productKey);
            const planLabel = !permissionsLoaded
              ? t('appGovernance.adoption.capabilities.plan.loading')
              : !canReadPlan
                ? t('appGovernance.adoption.capabilities.plan.permissionRequired')
                : planEligibility.isLoading
                  ? t('appGovernance.adoption.capabilities.plan.loading')
                  : planEligibility.isError
                    ? t('appGovernance.adoption.capabilities.plan.unavailable')
                    : !planProduct
                      ? t('appGovernance.adoption.capabilities.plan.notRegistered')
                      : t('appGovernance.adoption.capabilities.plan.summary', {
                          plan:
                            planEligibility.data?.plan?.displayName ??
                            t('appGovernance.adoption.capabilities.plan.noActivePlan'),
                          version: planEligibility.data?.plan?.planVersion ?? '—',
                          state: t(
                            capabilityPlanStatePresentationKey(planProduct.eligibilityState)
                          ),
                        });
            return (
              <Box
                component="article"
                key={productKey}
                data-testid={`tenant-app-capability-${productKey}`}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
              >
                <Stack direction="row" justifyContent="space-between" gap={1} sx={{ p: 1.5 }}>
                  <Box>
                    <Typography component="h3" variant="subtitle1" fontWeight={750}>
                      {productLabel(productKey)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('appGovernance.adoption.capabilities.count', {
                        count: capabilities.length,
                      })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {planLabel}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t('appGovernance.adoption.capabilities.bundleRevision', {
                      revision: capabilities[0]?.policy.activeRevision,
                    })}
                  />
                </Stack>
                <Divider />
                <Stack divider={<Divider flexItem />}>
                  {capabilities.map((capability) => {
                    const { policy } = capability;
                    return (
                      <Stack
                        key={policy.contractKey}
                        direction={{ xs: 'column', md: 'row' }}
                        justifyContent="space-between"
                        gap={1.25}
                        sx={{ p: 1.5 }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                            <Typography variant="subtitle2">{capabilityLabel(policy)}</Typography>
                            <Chip
                              size="small"
                              color={stateColor(capability.effectiveState)}
                              label={t(
                                capabilityEffectiveStatePresentationKey(capability.effectiveState)
                              )}
                            />
                            <Chip
                              size="small"
                              variant="outlined"
                              icon={
                                policy.overrideMode === 'OWNER_LOCKED' ? (
                                  <LockKeyhole size={13} />
                                ) : undefined
                              }
                              label={t(capabilityOverrideModePresentationKey(policy.overrideMode))}
                            />
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {t('appGovernance.adoption.capabilities.provenance', {
                              source: t(
                                capabilitySourcePresentationKey(capability.effectiveSource)
                              ),
                              risk: t(
                                `appGovernance.adoption.capabilities.riskTiers.${policy.riskTier}`,
                                {
                                  defaultValue: t(
                                    'appGovernance.adoption.capabilities.riskTiers.UNKNOWN'
                                  ),
                                }
                              ),
                            })}
                          </Typography>
                          {capability.activeOverride?.validTo && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {t('appGovernance.adoption.capabilities.expires', {
                                date: formatDate(capability.activeOverride.validTo, {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                }),
                              })}
                            </Typography>
                          )}
                        </Box>
                        <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
                          {policy.allowedActions.includes('REQUEST_DISABLE') && (
                            <ActionButton
                              size="small"
                              intent="danger"
                              startIcon={<ShieldOff size={15} />}
                              onClick={() => setDraft({ policy, desiredState: 'DISABLED' })}
                            >
                              {t('appGovernance.adoption.capabilities.actions.REQUEST_DISABLE')}
                            </ActionButton>
                          )}
                          {policy.allowedActions.includes('REQUEST_INHERIT') && (
                            <ActionButton
                              size="small"
                              startIcon={<RotateCcw size={15} />}
                              onClick={() => setDraft({ policy, desiredState: 'INHERIT' })}
                            >
                              {t('appGovernance.adoption.capabilities.actions.REQUEST_INHERIT')}
                            </ActionButton>
                          )}
                        </Stack>
                      </Stack>
                    );
                  })}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      {projection.data.changes.length > 0 && (
        <Stack gap={1} sx={{ mt: 2 }}>
          <Typography component="h3" variant="subtitle1" fontWeight={750}>
            {t('appGovernance.adoption.capabilities.workflowTitle')}
          </Typography>
          {projection.data.changes.slice(0, 8).map((change) => {
            const policy = policiesByContract.get(change.contractKey);
            return (
              <Stack
                key={change.overrideChangeId}
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                gap={1}
                sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}
              >
                <Box>
                  <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle2">
                      {t('appGovernance.adoption.capabilities.workflowChange', {
                        product: productLabel(change.productKey),
                        capability: capabilityLabel(policy),
                        desired: desiredStateLabel(change.desiredState),
                      })}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={stateColor(change.lifecycleState)}
                      label={t(capabilityWorkflowStatePresentationKey(change.lifecycleState))}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {change.justification}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {t('appGovernance.adoption.capabilities.changeMeta', {
                      revision: change.baseActiveRevision,
                      expiry: change.validTo
                        ? formatDate(change.validTo, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : t('appGovernance.adoption.capabilities.noExpiry'),
                    })}
                  </Typography>
                  {change.activationReceiptId && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('appGovernance.adoption.capabilities.receipt', {
                        id: change.activationReceiptId,
                      })}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
                  {change.allowedActions.map((action) =>
                    action === 'SUBMIT' ? (
                      <ActionButton
                        key={action}
                        size="small"
                        loading={busy}
                        onClick={() => void run(() => submitTenantCapabilityOverride(change))}
                      >
                        {t('appGovernance.adoption.capabilities.actions.SUBMIT')}
                      </ActionButton>
                    ) : (
                      <ActionButton
                        key={action}
                        size="small"
                        intent={action === 'REJECT' || action === 'REVOKE' ? 'danger' : 'secondary'}
                        startIcon={action === 'REJECT' ? <X size={15} /> : <Check size={15} />}
                        onClick={() => setCommand({ change, action, policy })}
                      >
                        {t(`appGovernance.adoption.capabilities.actions.${action}`)}
                      </ActionButton>
                    )
                  )}
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      )}

      <OverrideDraftDialog
        draft={draft}
        busy={busy}
        onClose={() => setDraft(null)}
        onSubmit={(payload) => run(() => createTenantCapabilityOverride(payload))}
      />
      <OverrideCommandDialog
        command={command}
        busy={busy}
        onClose={() => setCommand(null)}
        onSubmit={executeCommand}
      />
    </Box>
  );
}

function OverrideDraftDialog({
  draft,
  busy,
  onClose,
  onSubmit,
}: {
  draft: Draft | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    contractKey: string;
    desiredState: 'DISABLED' | 'INHERIT';
    validTo?: string | null;
    justification: string;
  }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [validTo, setValidTo] = useState('');
  const [justification, setJustification] = useState('');
  const disabled = draft?.desiredState === 'DISABLED';
  return (
    <FormDialog
      key={draft ? `${draft.policy.contractKey}:${draft.desiredState}` : 'closed'}
      open={Boolean(draft)}
      title={t(
        `appGovernance.adoption.capabilities.dialogs.${draft?.desiredState ?? 'DISABLED'}.title`
      )}
      description={t(
        `appGovernance.adoption.capabilities.dialogs.${draft?.desiredState ?? 'DISABLED'}.description`,
        { days: draft?.policy.maxDurationDays ?? 0 }
      )}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('appGovernance.adoption.capabilities.actions.CREATE_DRAFT')}
      submitIntent={disabled ? 'danger' : 'primary'}
      busy={busy}
      submitDisabled={!draft || justification.trim().length < 10 || (disabled && !validTo)}
      onClose={onClose}
      onSubmit={() =>
        draft
          ? onSubmit({
              contractKey: draft.policy.contractKey,
              desiredState: draft.desiredState,
              validTo: disabled ? validTo : null,
              justification: justification.trim(),
            })
          : Promise.resolve()
      }
    >
      <Stack gap={2}>
        {disabled && (
          <DateTimePickerField
            required
            label={t('appGovernance.adoption.capabilities.fields.validTo')}
            value={validTo}
            onValueChange={(value) => setValidTo(value ?? '')}
            minutesStep={15}
          />
        )}
        <FormField
          required
          multiline
          minRows={3}
          label={t('appGovernance.adoption.capabilities.fields.justification')}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

function OverrideCommandDialog({
  command,
  busy,
  onClose,
  onSubmit,
}: {
  command: Command | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [reason, setReason] = useState('');
  const action = command?.action ?? 'APPROVE';
  return (
    <FormDialog
      key={command ? `${command.change.overrideChangeId}:${action}` : 'closed'}
      open={Boolean(command)}
      title={t(`appGovernance.adoption.capabilities.dialogs.commands.${action}.title`)}
      description={t(`appGovernance.adoption.capabilities.dialogs.commands.${action}.description`)}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t(`appGovernance.adoption.capabilities.actions.${action}`)}
      submitIntent={action === 'REJECT' || action === 'REVOKE' ? 'danger' : 'primary'}
      busy={busy}
      submitDisabled={reason.trim().length < 10}
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim())}
    >
      <Stack gap={1.5}>
        {command && (
          <Alert severity="info">
            {t('appGovernance.adoption.capabilities.commandContext', {
              product: t(productPresentationKey(command.change.productKey)),
              capability: command.policy
                ? t('appGovernance.adoption.capabilities.capabilityLabel', {
                    surface: t(capabilitySurfacePresentationKey(command.policy.surfaceKey)),
                    action: t(capabilityActionPresentationKey(command.policy.action)),
                  })
                : t('appGovernance.adoption.capabilities.surfaces.unknown'),
              desired: t(capabilityDesiredStatePresentationKey(command.change.desiredState)),
              revision: command.change.baseActiveRevision,
              expiry: command.change.validTo
                ? formatDate(command.change.validTo, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : t('appGovernance.adoption.capabilities.noExpiry'),
            })}
          </Alert>
        )}
        <FormField
          required
          multiline
          minRows={3}
          label={t('appGovernance.adoption.capabilities.fields.reason')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}
