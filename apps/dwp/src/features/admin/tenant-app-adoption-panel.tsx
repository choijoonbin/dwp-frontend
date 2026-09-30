import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CircleAlert, PackagePlus, RefreshCw, ShieldCheck, UserPlus, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateTenantAppAssignment,
  activateTenantAppInstallation,
  createTenantAppAssignment,
  createTenantAppInstallation,
  decideTenantAppAssignment,
  decideTenantAppInstallation,
  getTenantAppAdoptionProjection,
  listTenantAppAssignments,
  revokeTenantAppAssignment,
  submitTenantAppInstallation,
  useToast,
  type AppGovernanceDashboard,
  type TenantAppAssignment,
  type TenantAppInstallation,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  DateTimePickerField,
  FormDialog,
  FormField,
  GuidedEmptyState,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { GOVERNED_PRODUCT_ENTRY_CATALOG } from '../../components/product-entry-point-catalog';
import {
  tenantAppAssignmentActions,
  tenantAppInstallationActions,
  tenantAppSeatState,
  type TenantAppAssignmentAction,
  type TenantAppInstallationAction,
} from './tenant-app-adoption-model';
import { TenantAppCapabilityMatrix } from './tenant-app-capability-matrix';
import {
  productPresentationKey,
  tenantAppCoveragePresentationKey,
  tenantAppExecutorStatePresentationKey,
  tenantAppKindPresentationKey,
  tenantAppStatePresentationKey,
} from './tenant-app-presentation';

type Command =
  | {
      kind: 'INSTALLATION';
      action: Exclude<TenantAppInstallationAction, 'SUBMIT'>;
      item: TenantAppInstallation;
    }
  | { kind: 'ASSIGNMENT'; action: TenantAppAssignmentAction; item: TenantAppAssignment };

const adoptionQueryKey = ['admin', 'tenant-app-adoption'] as const;

function stateColor(state: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (state === 'ENABLED' || state === 'ACTIVE') return 'success';
  if (state === 'IN_REVIEW' || state === 'PENDING_APPROVAL' || state === 'APPROVED') {
    return 'warning';
  }
  if (state === 'REJECTED' || state === 'DENIED' || state === 'REVOKED') return 'error';
  return state === 'DRAFT' ? 'info' : 'default';
}

export function TenantAppAdoptionPanel({
  governance,
  actorId,
}: {
  governance: AppGovernanceDashboard;
  actorId?: number;
}) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [installOpen, setInstallOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [command, setCommand] = useState<Command | null>(null);
  const [busy, setBusy] = useState(false);
  const productLabel = (productKey: string) => t(productPresentationKey(productKey));
  const projection = useQuery({
    queryKey: [...adoptionQueryKey, 'projection'],
    queryFn: getTenantAppAdoptionProjection,
    retry: false,
  });
  const assignments = useQuery({
    queryKey: [...adoptionQueryKey, 'assignments'],
    queryFn: () => listTenantAppAssignments(),
    retry: false,
  });
  const installations = useMemo(
    () => projection.data?.installations ?? [],
    [projection.data?.installations]
  );
  const workforceAssignments = useMemo(() => assignments.data ?? [], [assignments.data]);
  const productOptions = useMemo(() => {
    const resources = new Map(
      governance.resourceSets.flatMap((set) =>
        set.resources.map((resource) => [resource.resourceKey, resource.resourceName] as const)
      )
    );
    const installed = new Set(installations.map((item) => item.productKey));
    const requestable = new Set(projection.data?.requestableAppResourceKeys ?? []);
    return GOVERNED_PRODUCT_ENTRY_CATALOG.filter(
      (product) =>
        resources.has(product.appKey) &&
        requestable.has(product.appKey) &&
        !installed.has(product.id)
    ).map((product) => ({
      productKey: product.id,
      appResourceKey: product.appKey,
      label: resources.get(product.appKey) ?? t(productPresentationKey(product.id)),
    }));
  }, [governance.resourceSets, installations, projection.data?.requestableAppResourceKeys, t]);
  const userOptions = useMemo(
    () =>
      governance.principals
        .filter((principal) => principal.type === 'USER' && /^\d+$/.test(principal.ref))
        .map((principal) => ({
          value: principal.ref,
          label: `${principal.displayName} · ${principal.detail || principal.ref}`,
        })),
    [governance.principals]
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: adoptionQueryKey });
  };

  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await operation();
      await refresh();
      setCommand(null);
      toast.success(t('appGovernance.adoption.toasts.completed'));
    } catch {
      toast.error(t('appGovernance.adoption.toasts.failed'));
    } finally {
      setBusy(false);
    }
  };

  const executeCommand = async (reason: string) => {
    if (!command) return;
    if (command.kind === 'INSTALLATION') {
      if (command.action === 'ACTIVATE') {
        await run(() => activateTenantAppInstallation(command.item, reason));
      } else {
        await run(() =>
          decideTenantAppInstallation(
            command.item,
            command.action === 'APPROVE' ? 'APPROVE' : 'REJECT',
            reason
          )
        );
      }
      return;
    }
    if (command.action === 'ACTIVATE') {
      await run(() => activateTenantAppAssignment(command.item, reason));
    } else if (command.action === 'REVOKE') {
      await run(() => revokeTenantAppAssignment(command.item, reason));
    } else {
      await run(() =>
        decideTenantAppAssignment(
          command.item,
          command.action === 'APPROVE' ? 'APPROVE' : 'REJECT',
          reason
        )
      );
    }
  };

  if (projection.isLoading || assignments.isLoading) {
    return <Typography color="text.secondary">{t('appGovernance.adoption.loading')}</Typography>;
  }
  if (projection.isError || assignments.isError || !projection.data) {
    return (
      <Alert
        severity="error"
        action={
          <ActionButton intent="quiet" size="small" onClick={() => void refresh()}>
            {t('common.actions.retry')}
          </ActionButton>
        }
      >
        {t('appGovernance.adoption.loadError')}
      </Alert>
    );
  }

  const enabledInstallations = installations.filter(
    (installation) =>
      installation.lifecycleState === 'ENABLED' &&
      installation.allowedActions.includes('REQUEST_ASSIGNMENT')
  );

  return (
    <Stack gap={2} data-testid="tenant-app-adoption-panel">
      <Alert severity="info" icon={<ShieldCheck size={19} />}>
        <Typography variant="subtitle2">{t('appGovernance.adoption.coverage.title')}</Typography>
        <Typography variant="body2">
          {t('appGovernance.adoption.coverage.description', {
            owners: projection.data.includedOwners
              .map((owner) =>
                t(`appGovernance.adoption.coverage.owners.${owner}`, {
                  defaultValue: t('appGovernance.adoption.coverage.owners.unknown'),
                })
              )
              .join(', '),
          })}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {t('appGovernance.adoption.coverage.observation', {
            observedAt: formatDate(projection.data.observedAt, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
            coverage: t(tenantAppCoveragePresentationKey(projection.data.coverageState)),
          })}
        </Typography>
      </Alert>
      {projection.data.exclusions.length > 0 && (
        <Alert severity="warning" icon={<CircleAlert size={19} />}>
          {t('appGovernance.adoption.coverage.exclusions', {
            exclusions: projection.data.exclusions
              .map((exclusion) =>
                t(`appGovernance.adoption.coverage.exclusionReasons.${exclusion}`, {
                  defaultValue: t('appGovernance.adoption.coverage.exclusionReasons.unknown'),
                })
              )
              .join(', '),
          })}
        </Alert>
      )}

      <TenantAppCapabilityMatrix />

      <Divider />

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
        <Box>
          <Typography component="h2" variant="h6">
            {t('appGovernance.adoption.installations.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('appGovernance.adoption.installations.description')}
          </Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <ActionIconButton label={t('common.actions.refresh')} onClick={() => void refresh()}>
            <RefreshCw size={17} />
          </ActionIconButton>
          <ActionButton
            startIcon={<PackagePlus size={17} />}
            disabled={productOptions.length === 0}
            onClick={() => setInstallOpen(true)}
          >
            {t('appGovernance.adoption.actions.requestInstallation')}
          </ActionButton>
        </Stack>
      </Stack>

      {installations.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.25,
          }}
        >
          {installations.map((installation) => {
            const actions = tenantAppInstallationActions(installation, actorId);
            const seatState = tenantAppSeatState(installation);
            return (
              <Box
                component="article"
                key={installation.installationId}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                }}
              >
                <Stack direction="row" justifyContent="space-between" gap={1} sx={{ p: 2 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="h3" variant="subtitle1" fontWeight={750}>
                      {productLabel(installation.productKey)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('appGovernance.adoption.installations.governedIdentity')}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={stateColor(installation.lifecycleState)}
                    label={t(tenantAppStatePresentationKey(installation.lifecycleState))}
                  />
                </Stack>
                <Divider />
                <Box
                  component="dl"
                  sx={{
                    m: 0,
                    p: 2,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 1.25,
                  }}
                >
                  <Fact
                    label={t('appGovernance.adoption.installations.kind')}
                    value={t(tenantAppKindPresentationKey(installation.installationKind))}
                  />
                  <Fact
                    label={t('appGovernance.adoption.installations.seats')}
                    value={t('appGovernance.adoption.installations.seatValue', {
                      active: installation.activeSeats,
                      reserved: installation.reservedSeats,
                      capacity: installation.seatCapacity ?? t('appGovernance.adoption.unbounded'),
                    })}
                  />
                  <Fact
                    label={t('appGovernance.adoption.installations.seatState')}
                    value={t(`appGovernance.adoption.seatStates.${seatState}`)}
                  />
                  <Fact
                    label={t('appGovernance.adoption.installations.executor')}
                    value={t(
                      tenantAppExecutorStatePresentationKey(installation.externalExecutorState)
                    )}
                  />
                </Box>
                {installation.activationReceiptId && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ px: 2, display: 'block' }}
                  >
                    {t('appGovernance.adoption.receipt', {
                      id: installation.activationReceiptId,
                    })}
                  </Typography>
                )}
                {actions.length > 0 && (
                  <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ p: 2, pt: 1.25 }}>
                    {actions.map((action) => (
                      <ActionButton
                        key={action}
                        size="small"
                        intent={action === 'REJECT' ? 'danger' : 'secondary'}
                        startIcon={action === 'REJECT' ? <X size={15} /> : <Check size={15} />}
                        onClick={() => {
                          if (action === 'SUBMIT') {
                            void run(() => submitTenantAppInstallation(installation));
                          } else {
                            setCommand({ kind: 'INSTALLATION', action, item: installation });
                          }
                        }}
                      >
                        {t(`appGovernance.adoption.actions.${action}`)}
                      </ActionButton>
                    ))}
                  </Stack>
                )}
              </Box>
            );
          })}
        </Box>
      ) : (
        <GuidedEmptyState
          kind="first-use"
          title={t('appGovernance.adoption.installations.emptyTitle')}
          description={t('appGovernance.adoption.installations.emptyDescription')}
        />
      )}

      <Divider />
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
        <Box>
          <Typography component="h2" variant="h6">
            {t('appGovernance.adoption.assignments.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('appGovernance.adoption.assignments.description')}
          </Typography>
        </Box>
        <ActionButton
          startIcon={<UserPlus size={17} />}
          disabled={enabledInstallations.length === 0 || userOptions.length === 0}
          onClick={() => setAssignmentOpen(true)}
        >
          {t('appGovernance.adoption.actions.requestAssignment')}
        </ActionButton>
      </Stack>

      {workforceAssignments.length > 0 ? (
        <Stack gap={1}>
          {workforceAssignments.map((assignment) => {
            const actions = tenantAppAssignmentActions(assignment, actorId);
            return (
              <Box
                component="article"
                key={assignment.assignmentId}
                sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  gap={1}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                      <Typography component="h3" variant="subtitle2">
                        {assignment.userDisplayName}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={stateColor(assignment.lifecycleState)}
                        label={t(tenantAppStatePresentationKey(assignment.lifecycleState))}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {productLabel(assignment.productKey)} ·{' '}
                      {t('appGovernance.adoption.assignments.userId', {
                        id: assignment.userId,
                      })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {assignment.validTo
                        ? t('appGovernance.adoption.assignments.validTo', {
                            date: formatDate(assignment.validTo, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }),
                          })
                        : t('appGovernance.adoption.assignments.noExpiry')}
                    </Typography>
                  </Box>
                  <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
                    {assignment.activationReceiptId && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t('appGovernance.adoption.receipt', {
                          id: assignment.activationReceiptId,
                        })}
                      />
                    )}
                    {actions.map((action) => (
                      <ActionButton
                        key={action}
                        size="small"
                        intent={action === 'REJECT' || action === 'REVOKE' ? 'danger' : 'secondary'}
                        onClick={() => setCommand({ kind: 'ASSIGNMENT', action, item: assignment })}
                      >
                        {t(`appGovernance.adoption.actions.${action}`)}
                      </ActionButton>
                    ))}
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      ) : (
        <GuidedEmptyState
          kind="empty"
          title={t('appGovernance.adoption.assignments.emptyTitle')}
          description={t('appGovernance.adoption.assignments.emptyDescription')}
        />
      )}

      <InstallationDialog
        open={installOpen}
        products={productOptions}
        busy={busy}
        onClose={() => setInstallOpen(false)}
        onSubmit={(payload) =>
          run(async () => {
            await createTenantAppInstallation(payload);
            setInstallOpen(false);
          })
        }
      />
      <AssignmentDialog
        open={assignmentOpen}
        installations={enabledInstallations}
        users={userOptions}
        busy={busy}
        onClose={() => setAssignmentOpen(false)}
        onSubmit={(payload) =>
          run(async () => {
            await createTenantAppAssignment(payload);
            setAssignmentOpen(false);
          })
        }
      />
      <CommandDialog
        command={command}
        busy={busy}
        onClose={() => setCommand(null)}
        onSubmit={executeCommand}
      />
    </Stack>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" fontWeight={700} sx={{ m: 0, mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  );
}

function InstallationDialog({
  open,
  products,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  products: Array<{ productKey: string; appResourceKey: string; label: string }>;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    productKey: string;
    appResourceKey: string;
    installationKind: TenantAppInstallation['installationKind'];
    seatCapacity?: number | null;
    justification: string;
  }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [productKey, setProductKey] = useState('');
  const [kind, setKind] = useState<TenantAppInstallation['installationKind']>(
    'INTERNAL_AUTH_CONTROLLED'
  );
  const [capacity, setCapacity] = useState('');
  const [justification, setJustification] = useState('');
  const product = products.find((candidate) => candidate.productKey === productKey);
  const parsedCapacity = Number(capacity);
  const validCapacity = !capacity || (Number.isInteger(parsedCapacity) && parsedCapacity > 0);
  return (
    <FormDialog
      open={open}
      title={t('appGovernance.adoption.dialogs.installationTitle')}
      description={t('appGovernance.adoption.dialogs.installationDescription')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('appGovernance.adoption.actions.createDraft')}
      busy={busy}
      submitDisabled={!product || !validCapacity || justification.trim().length < 10}
      onClose={onClose}
      onSubmit={() =>
        product
          ? onSubmit({
              productKey: product.productKey,
              appResourceKey: product.appResourceKey,
              installationKind: kind,
              seatCapacity: capacity ? parsedCapacity : null,
              justification: justification.trim(),
            })
          : Promise.resolve()
      }
    >
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <SelectField
          required
          label={t('appGovernance.adoption.fields.product')}
          value={productKey}
          onValueChange={setProductKey}
          options={products.map((item) => ({ value: item.productKey, label: item.label }))}
        />
        <SelectField
          required
          label={t('appGovernance.adoption.fields.kind')}
          value={kind}
          onValueChange={(value) => setKind(value as TenantAppInstallation['installationKind'])}
          options={(['INTERNAL_AUTH_CONTROLLED', 'EXTERNAL_SERVICE'] as const).map((value) => ({
            value,
            label: t(`appGovernance.adoption.kinds.${value}`),
          }))}
        />
        {kind === 'EXTERNAL_SERVICE' && (
          <Alert severity="warning">{t('appGovernance.adoption.dialogs.externalBoundary')}</Alert>
        )}
        <FormField
          type="number"
          label={t('appGovernance.adoption.fields.seatCapacity')}
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          errorMessage={
            capacity && !validCapacity
              ? t('appGovernance.adoption.fields.seatCapacityError')
              : undefined
          }
        />
        <FormField
          required
          multiline
          minRows={3}
          label={t('appGovernance.adoption.fields.justification')}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

function AssignmentDialog({
  open,
  installations,
  users,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  installations: TenantAppInstallation[];
  users: Array<{ value: string; label: string }>;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    installationId: string;
    userId: number;
    validTo?: string | null;
    justification: string;
  }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [installationId, setInstallationId] = useState('');
  const [userId, setUserId] = useState('');
  const [validTo, setValidTo] = useState('');
  const [justification, setJustification] = useState('');
  return (
    <FormDialog
      open={open}
      title={t('appGovernance.adoption.dialogs.assignmentTitle')}
      description={t('appGovernance.adoption.dialogs.assignmentDescription')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('appGovernance.adoption.actions.submitForApproval')}
      busy={busy}
      submitDisabled={!installationId || !userId || justification.trim().length < 10}
      onClose={onClose}
      onSubmit={() =>
        onSubmit({
          installationId,
          userId: Number(userId),
          validTo: validTo || null,
          justification: justification.trim(),
        })
      }
    >
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <SelectField
          required
          label={t('appGovernance.adoption.fields.installation')}
          value={installationId}
          onValueChange={setInstallationId}
          options={installations.map((item) => ({
            value: item.installationId,
            label: t(productPresentationKey(item.productKey)),
          }))}
        />
        <SelectField
          required
          label={t('appGovernance.adoption.fields.user')}
          value={userId}
          onValueChange={setUserId}
          options={users}
        />
        <DateTimePickerField
          label={t('appGovernance.adoption.fields.validTo')}
          value={validTo || null}
          onValueChange={(value) => setValidTo(value ?? '')}
        />
        <FormField
          required
          multiline
          minRows={3}
          label={t('appGovernance.adoption.fields.justification')}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

function CommandDialog({
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
      key={command ? `${command.kind}:${command.item.version}:${command.action}` : 'closed'}
      open={Boolean(command)}
      title={t(`appGovernance.adoption.dialogs.commands.${action}.title`)}
      description={t(`appGovernance.adoption.dialogs.commands.${action}.description`)}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t(`appGovernance.adoption.actions.${action}`)}
      submitIntent={action === 'REJECT' || action === 'REVOKE' ? 'danger' : 'primary'}
      busy={busy}
      submitDisabled={reason.trim().length < 10}
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim())}
    >
      <FormField
        required
        multiline
        minRows={3}
        label={t('appGovernance.adoption.fields.reason')}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </FormDialog>
  );
}
