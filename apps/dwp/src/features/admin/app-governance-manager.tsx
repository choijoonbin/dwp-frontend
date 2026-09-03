import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  Check,
  Clock3,
  Layers3,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  UserRoundCog,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAppAdminAssignment,
  createAppResourceSet,
  decideAppAdminAssignment,
  getAppGovernanceDashboard,
  revokeAppAdminAssignment,
  useAuth,
  useToast,
  type AppAdminAssignment,
  type AppGovernanceDashboard,
  type AppResourceMember,
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
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { GOVERNED_PRODUCT_ENTRY_CATALOG } from '../../components/product-entry-point-catalog';
import { useShellAuxiliaryAvoidance } from '../../components/shell-auxiliary-avoidance/use-shell-auxiliary-avoidance';
import { AppAdminPresetManager } from './app-admin-preset-manager';
import {
  canRequestGovernedAssignment,
  governedRequestScopes,
  resolveAssignmentActions,
  type AppGovernanceApprovalMode,
  type AppGovernanceActor,
} from './app-governance-authority';

export { resolveAssignmentActions } from './app-governance-authority';

type View = 'assignments' | 'presets' | 'boundaries';
type Decision = 'APPROVED' | 'DENIED' | 'REVOKED';

const queryKey = ['admin', 'app-governance'] as const;
const managementWorkbenchReturnFocusKey = 'dwp.app-governance.management-workbench-return-focus';
type FocusMarkerStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function browserSessionStorage(
  browser: Pick<Window, 'sessionStorage'> = window
): FocusMarkerStorage | undefined {
  try {
    return browser.sessionStorage;
  } catch {
    return undefined;
  }
}

export function hasManagementWorkbenchReturnFocus(
  storage: FocusMarkerStorage | undefined
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(managementWorkbenchReturnFocusKey) === 'heading';
  } catch {
    return false;
  }
}

export function rememberManagementWorkbenchReturnFocus(
  storage: FocusMarkerStorage | undefined
): void {
  if (!storage) return;
  try {
    storage.setItem(managementWorkbenchReturnFocusKey, 'heading');
  } catch {
    // Focus restoration is progressive enhancement and must never block navigation.
  }
}

export function clearManagementWorkbenchReturnFocus(storage: FocusMarkerStorage | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(managementWorkbenchReturnFocusKey);
  } catch {
    // A restricted storage policy may retain the marker; navigation remains authoritative.
  }
}
const CONTROL_PLANE_RESPONSIBILITIES = new Set([
  'APP_OWNER',
  'APP_ACCESS_APPROVER',
  'APP_ACCESS_MANAGER',
  'APP_ACCESS_REVIEWER',
]);

function statusColor(state: AppAdminAssignment['lifecycleState']) {
  if (state === 'ACTIVE') return 'success' as const;
  if (state === 'PENDING_APPROVAL') return 'warning' as const;
  if (state === 'DENIED' || state === 'REVOKED') return 'default' as const;
  return 'info' as const;
}

export function resolveManagementWorkbenchEntries(resources: readonly AppResourceMember[]) {
  return resources.flatMap((resource) => {
    const manifest = GOVERNED_PRODUCT_ENTRY_CATALOG.find(
      (candidate) => candidate.appKey === resource.resourceKey
    );
    const managementSurface =
      manifest?.surfaces.find(
        (surface) => surface.plane === 'management' && surface.taskKinds.includes('administration')
      ) ?? manifest?.surfaces.find((surface) => surface.plane === 'management');
    return manifest && managementSurface
      ? [{ productId: manifest.id, path: managementSurface.indexPath, resource }]
      : [];
  });
}

export function AppGovernanceManager() {
  const { t } = useTranslation('admin');
  const theme = useTheme();
  const compactViewControls = useMediaQuery(theme.breakpoints.down('sm'));
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('presets');
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [boundaryOpen, setBoundaryOpen] = useState(false);
  const [action, setAction] = useState<{
    assignment: AppAdminAssignment;
    decision: Decision;
    approvalMode: AppGovernanceApprovalMode | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  useShellAuxiliaryAvoidance({ boundaryRef: contentRef });
  const dashboard = useQuery({ queryKey, queryFn: getAppGovernanceDashboard });
  const data = dashboard.data;
  const actor: AppGovernanceActor = {
    userId: auth.user?.userId,
    roles: auth.user?.roles ?? [],
    resourceRoles: auth.user?.resourceRoles ?? [],
    groupRefs: auth.user?.groups?.map((group) => group.groupRef) ?? [],
  };
  const requestScopes = governedRequestScopes(actor);
  const canRequest = canRequestGovernedAssignment(actor);
  const canAdministerBoundaries = actor.roles.includes('APP_CATALOG_ADMIN');

  useEffect(() => {
    if (!hasManagementWorkbenchReturnFocus(browserSessionStorage())) return;
    const frame = window.requestAnimationFrame(() => {
      clearManagementWorkbenchReturnFocus(browserSessionStorage());
      const heading = document.querySelector<HTMLHeadingElement>('#dwp-main-content h1');
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey });
  };

  if (dashboard.isLoading && !data)
    return <ManagementPanelLoading label={t('appGovernance.loading')} />;
  if (dashboard.isError || !data) {
    return (
      <ManagementPanelError
        message={t('appGovernance.loadErrorDescription')}
        retryLabel={t('common.actions.retry')}
        onRetry={() => void dashboard.refetch()}
        retrying={dashboard.isFetching}
      />
    );
  }
  const canCreateBoundary =
    canAdministerBoundaries &&
    data.resourceSets.some((resourceSet) => resourceSet.resources.length > 0);
  const canRequestAssignment =
    canRequest &&
    data.resourceSets.some(
      (resourceSet) => !requestScopes || requestScopes.has(resourceSet.resourceSetId)
    );

  return (
    <Stack ref={contentRef} gap={2.5}>
      {(data.metrics.pendingApprovals > 0 || data.metrics.resourcesWithoutOwner > 0) && (
        <Alert severity={data.metrics.resourcesWithoutOwner > 0 ? 'warning' : 'info'}>
          {t('appGovernance.attention', {
            pending: data.metrics.pendingApprovals,
            ownerless: data.metrics.resourcesWithoutOwner,
          })}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, 1fr)' },
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {(
          [
            ['activeAssignments', data.metrics.activeAssignments, ShieldCheck],
            ['pendingApprovals', data.metrics.pendingApprovals, Clock3],
            ['reviewsDueSoon', data.metrics.reviewsDueSoon, UserRoundCog],
            ['resourcesWithoutOwner', data.metrics.resourcesWithoutOwner, ShieldX],
          ] as const
        ).map(([key, value, Icon], index) => (
          <Box
            key={key}
            sx={{
              minHeight: 96,
              p: 2,
              borderRight: { lg: index < 3 ? 1 : 0 },
              borderBottom: { xs: index < 2 ? 1 : 0, lg: 0 },
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Typography variant="body2" color="text.secondary">
                {t(`appGovernance.metrics.${key}`)}
              </Typography>
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            </Stack>
            <Typography variant="h4" sx={{ mt: 1 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between">
        <ToggleButtonGroup
          exclusive
          orientation={compactViewControls ? 'vertical' : 'horizontal'}
          size="small"
          value={view}
          onChange={(_, next: View | null) => next && setView(next)}
          aria-label={t('appGovernance.viewLabel')}
          sx={{
            width: { xs: 1, sm: 'auto' },
            '& .MuiToggleButton-root': {
              justifyContent: { xs: 'flex-start', sm: 'center' },
              whiteSpace: 'normal',
            },
          }}
        >
          <ToggleButton value="assignments">
            {t('appGovernance.views.assignments')} ({data.assignments.length})
          </ToggleButton>
          <ToggleButton value="presets">
            {t('appGovernance.views.presets')} ({data.presetAssignments?.length ?? 0})
          </ToggleButton>
          <ToggleButton value="boundaries">
            {t('appGovernance.views.boundaries')} ({data.resourceSets.length})
          </ToggleButton>
        </ToggleButtonGroup>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <ActionIconButton label={t('common.actions.refresh')} onClick={() => void refresh()}>
            <RefreshCw size={17} />
          </ActionIconButton>
          {canCreateBoundary && (
            <ActionButton
              intent="secondary"
              startIcon={<Layers3 size={17} />}
              onClick={() => setBoundaryOpen(true)}
            >
              {t('appGovernance.actions.newBoundary')}
            </ActionButton>
          )}
          {canRequestAssignment && (
            <ActionButton startIcon={<Plus size={17} />} onClick={() => setAssignmentOpen(true)}>
              {t('appGovernance.actions.requestAssignment')}
            </ActionButton>
          )}
        </Stack>
      </Stack>

      {view === 'presets' ? (
        <AppAdminPresetManager data={data} />
      ) : view === 'assignments' ? (
        <Stack gap={1.5}>
          <Alert severity="info">{t('appGovernance.controlResponsibilitiesNotice')}</Alert>
          {data.assignments.length ? (
            <TableContainer
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <Table size="small" aria-label={t('appGovernance.assignmentTable')}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('appGovernance.columns.principal')}</TableCell>
                    <TableCell>{t('appGovernance.columns.responsibility')}</TableCell>
                    <TableCell>{t('appGovernance.columns.scope')}</TableCell>
                    <TableCell>{t('appGovernance.columns.validity')}</TableCell>
                    <TableCell>{t('appGovernance.columns.state')}</TableCell>
                    <TableCell align="right">{t('appGovernance.columns.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.assignments.map((assignment) => {
                    const { mayApprove, mayRevoke, approvalMode } = resolveAssignmentActions(
                      assignment,
                      actor
                    );
                    return (
                      <TableRow
                        key={assignment.assignmentId}
                        hover
                        sx={{ height: 58 }}
                        data-testid={`app-governance-assignment-${assignment.assignmentId}`}
                      >
                        <TableCell>
                          <Typography variant="subtitle2">{assignment.principalName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {assignment.principalType} · {assignment.principalRef}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack gap={0.5} alignItems="flex-start">
                            <Typography variant="body2">
                              {t(`appGovernance.responsibilities.${assignment.responsibilityCode}`)}
                            </Typography>
                            {approvalMode === 'FIRST_APPROVER_BOOTSTRAP' && (
                              <Chip
                                size="small"
                                variant="outlined"
                                color="warning"
                                label={t('appGovernance.bootstrap.badge')}
                              />
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{assignment.resourceSetName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {assignment.resourceSetKey}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {assignment.validTo
                              ? formatDate(assignment.validTo, { dateStyle: 'medium' })
                              : t('appGovernance.noExpiry')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('appGovernance.reviewDue', {
                              value: formatDate(assignment.reviewDueAt, { dateStyle: 'medium' }),
                            })}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="outlined"
                            color={statusColor(assignment.lifecycleState)}
                            label={t(`appGovernance.states.${assignment.lifecycleState}`)}
                          />
                        </TableCell>
                        <TableCell align="right" data-shell-auxiliary-avoidance="inline-end">
                          <Stack
                            direction="row"
                            justifyContent="flex-end"
                            flexWrap="wrap"
                            gap={0.5}
                          >
                            {mayApprove && (
                              <>
                                {approvalMode === 'FIRST_APPROVER_BOOTSTRAP' ? (
                                  <ActionButton
                                    intent="secondary"
                                    size="small"
                                    aria-label={t('appGovernance.bootstrap.approveAction')}
                                    startIcon={<Check size={16} aria-hidden="true" />}
                                    onClick={() =>
                                      setAction({ assignment, decision: 'APPROVED', approvalMode })
                                    }
                                  >
                                    {t('appGovernance.bootstrap.approveButton')}
                                  </ActionButton>
                                ) : (
                                  <ActionIconButton
                                    label={t('appGovernance.actions.approve')}
                                    onClick={() =>
                                      setAction({ assignment, decision: 'APPROVED', approvalMode })
                                    }
                                  >
                                    <Check size={17} />
                                  </ActionIconButton>
                                )}
                                <ActionIconButton
                                  label={t('appGovernance.actions.deny')}
                                  onClick={() =>
                                    setAction({ assignment, decision: 'DENIED', approvalMode })
                                  }
                                >
                                  <X size={17} />
                                </ActionIconButton>
                              </>
                            )}
                            {mayRevoke && (
                              <ActionIconButton
                                label={t('appGovernance.actions.revoke')}
                                onClick={() =>
                                  setAction({ assignment, decision: 'REVOKED', approvalMode: null })
                                }
                              >
                                <ShieldX size={17} />
                              </ActionIconButton>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <GuidedEmptyState
              kind="first-use"
              title={t('appGovernance.empty.assignmentsTitle')}
              description={t('appGovernance.empty.assignmentsDescription')}
            />
          )}
        </Stack>
      ) : data.resourceSets.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            overflow: 'hidden',
          }}
        >
          {data.resourceSets.map((resourceSet, index) => {
            const setAssignments = data.assignments.filter(
              (assignment) =>
                assignment.resourceSetId === resourceSet.resourceSetId &&
                assignment.lifecycleState === 'ACTIVE'
            );
            const managementEntries = resolveManagementWorkbenchEntries(resourceSet.resources);
            const headingId = `app-governance-resource-set-${index}-heading`;
            return (
              <Box
                component="section"
                key={resourceSet.resourceSetId}
                aria-labelledby={headingId}
                sx={{
                  minHeight: 180,
                  p: 2.25,
                  borderRight: { lg: index % 3 !== 2 ? 1 : 0 },
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography id={headingId} component="h3" variant="subtitle1">
                      {resourceSet.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {resourceSet.key}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={t('appGovernance.assignmentCount', { count: setAssignments.length })}
                  />
                </Stack>
                <Divider sx={{ my: 1.5 }} />
                <Stack direction="row" gap={0.75} flexWrap="wrap">
                  {resourceSet.resources.map((resource) => (
                    <Chip
                      key={resource.resourceKey}
                      size="small"
                      variant="outlined"
                      label={resource.resourceName}
                    />
                  ))}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  {resourceSet.description}
                </Typography>
                {managementEntries.length > 0 && (
                  <Stack gap={0.75} sx={{ mt: 2 }} alignItems="flex-start">
                    {managementEntries.map(({ productId, path, resource }) => (
                      <ActionButton
                        key={`${productId}:${resource.resourceKey}`}
                        component={NavLink}
                        to={path}
                        intent="quiet"
                        size="small"
                        endIcon={<ArrowUpRight size={15} aria-hidden="true" />}
                        aria-label={t('appGovernance.actions.openWorkbenchForScope', {
                          app: resource.resourceName,
                          scope: resourceSet.name,
                        })}
                        onClick={(event) => {
                          if (
                            event.button === 0 &&
                            !event.metaKey &&
                            !event.ctrlKey &&
                            !event.shiftKey &&
                            !event.altKey
                          ) {
                            rememberManagementWorkbenchReturnFocus(browserSessionStorage());
                          }
                        }}
                        sx={{ maxWidth: '100%', whiteSpace: 'normal', textAlign: 'start' }}
                      >
                        {t('appGovernance.actions.openWorkbench', { app: resource.resourceName })}
                      </ActionButton>
                    ))}
                  </Stack>
                )}
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box data-testid="app-governance-resource-set-empty">
          <GuidedEmptyState
            kind="first-use"
            title={t('appGovernance.empty.boundariesTitle')}
            description={t('appGovernance.empty.boundariesDescription')}
            actionLabel={t('common.actions.refresh')}
            onAction={() => void refresh()}
          />
        </Box>
      )}

      <AssignmentDialog
        open={assignmentOpen}
        data={data}
        allowedResourceSetIds={requestScopes}
        busy={busy}
        onClose={() => setAssignmentOpen(false)}
        onSubmit={async (payload) => {
          setBusy(true);
          try {
            await createAppAdminAssignment(payload);
            await refresh();
            setAssignmentOpen(false);
            toast.success(t('appGovernance.toasts.requested'));
          } catch {
            toast.error(t('common.operationError'));
          } finally {
            setBusy(false);
          }
        }}
      />
      <BoundaryDialog
        open={boundaryOpen}
        data={data}
        busy={busy}
        onClose={() => setBoundaryOpen(false)}
        onSubmit={async (payload) => {
          setBusy(true);
          try {
            await createAppResourceSet(payload);
            await refresh();
            setBoundaryOpen(false);
            toast.success(t('appGovernance.toasts.boundaryCreated'));
          } catch {
            toast.error(t('common.operationError'));
          } finally {
            setBusy(false);
          }
        }}
      />
      <DecisionDialog
        key={action ? `${action.assignment.assignmentId}:${action.decision}` : 'closed'}
        action={action}
        busy={busy}
        onClose={() => setAction(null)}
        onSubmit={async (reason) => {
          if (!action) return;
          setBusy(true);
          try {
            if (action.decision === 'REVOKED') {
              await revokeAppAdminAssignment(action.assignment, reason);
            } else {
              await decideAppAdminAssignment(action.assignment, action.decision, reason);
            }
            await refresh();
            setAction(null);
            toast.success(t(`appGovernance.toasts.${action.decision.toLowerCase()}`));
          } catch {
            toast.error(t('common.operationError'));
          } finally {
            setBusy(false);
          }
        }}
      />
    </Stack>
  );
}

function AssignmentDialog({
  open,
  data,
  allowedResourceSetIds,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  data: AppGovernanceDashboard;
  allowedResourceSetIds: Set<string> | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    principalType: 'USER' | 'GROUP';
    principalRef: string;
    responsibilityCode: string;
    resourceSetId: string;
    validTo?: string | null;
    justification: string;
  }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [principal, setPrincipal] = useState('');
  const [responsibility, setResponsibility] = useState('');
  const [resourceSetId, setResourceSetId] = useState('');
  const [validTo, setValidTo] = useState('');
  const [justification, setJustification] = useState('');
  const resourceSets = data.resourceSets.filter(
    (item) => !allowedResourceSetIds || allowedResourceSetIds.has(item.resourceSetId)
  );
  const responsibilities = data.responsibilities.filter(
    (item) =>
      CONTROL_PLANE_RESPONSIBILITIES.has(item.code) &&
      (allowedResourceSetIds === null || item.code !== 'APP_OWNER')
  );
  const selectedPrincipal = data.principals.find(
    (item) => `${item.type}:${item.ref}` === principal
  );
  const valid =
    Boolean(selectedPrincipal && responsibility && resourceSetId) &&
    justification.trim().length >= 10;
  return (
    <FormDialog
      open={open}
      title={t('appGovernance.dialog.assignmentTitle')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('appGovernance.actions.submitForApproval')}
      onClose={onClose}
      busy={busy}
      submitDisabled={!valid}
      onSubmit={async () => {
        if (!selectedPrincipal) return;
        await onSubmit({
          principalType: selectedPrincipal.type,
          principalRef: selectedPrincipal.ref,
          responsibilityCode: responsibility,
          resourceSetId,
          validTo: validTo || null,
          justification: justification.trim(),
        });
      }}
    >
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <SelectField
          required
          label={t('appGovernance.fields.principal')}
          value={principal}
          onValueChange={setPrincipal}
          options={data.principals.map((item) => ({
            value: `${item.type}:${item.ref}`,
            label: `${item.displayName} · ${item.detail || item.type}`,
          }))}
        />
        <SelectField
          required
          label={t('appGovernance.fields.responsibility')}
          value={responsibility}
          onValueChange={setResponsibility}
          options={responsibilities.map((item) => ({
            value: item.code,
            label: `${t(`appGovernance.responsibilities.${item.code}`)} · ${item.riskTier}`,
          }))}
        />
        <SelectField
          required
          label={t('appGovernance.fields.scope')}
          value={resourceSetId}
          onValueChange={setResourceSetId}
          options={resourceSets.map((item) => ({
            value: item.resourceSetId,
            label: `${item.name} · ${item.resources
              .map((resource) => resource.resourceName)
              .join(', ')}`,
          }))}
        />
        <DateTimePickerField
          label={t('appGovernance.fields.validTo')}
          value={validTo || null}
          onValueChange={(value) => setValidTo(value ?? '')}
        />
        <FormField
          required
          multiline
          minRows={3}
          label={t('appGovernance.fields.justification')}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          supportingText={t('appGovernance.fields.justificationHelp')}
        />
      </Stack>
    </FormDialog>
  );
}

function BoundaryDialog({
  open,
  data,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  data: AppGovernanceDashboard;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    key: string;
    name: string;
    description?: string;
    resourceKeys: string[];
  }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const resources = useMemo(() => {
    const values = new Map<string, string>();
    data.resourceSets.forEach((set) =>
      set.resources.forEach((resource) => values.set(resource.resourceKey, resource.resourceName))
    );
    return [...values.entries()];
  }, [data.resourceSets]);
  return (
    <FormDialog
      open={open}
      title={t('appGovernance.dialog.boundaryTitle')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.create')}
      onClose={onClose}
      busy={busy}
      submitDisabled={key.length < 3 || !name.trim() || selected.length === 0}
      onSubmit={() =>
        onSubmit({
          key,
          name: name.trim(),
          description: description.trim(),
          resourceKeys: selected,
        })
      }
    >
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <FormField
          required
          label={t('appGovernance.fields.boundaryKey')}
          value={key}
          onChange={(event) => setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
        />
        <FormField
          required
          label={t('appGovernance.fields.boundaryName')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <FormField
          multiline
          minRows={2}
          label={t('appGovernance.fields.description')}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            {t('appGovernance.fields.applications')}
          </Typography>
          <Stack>
            {resources.map(([resourceKey, resourceName]) => (
              <FormControlLabel
                key={resourceKey}
                control={
                  <Checkbox
                    checked={selected.includes(resourceKey)}
                    onChange={(_, checked) =>
                      setSelected((current) =>
                        checked
                          ? [...current, resourceKey]
                          : current.filter((value) => value !== resourceKey)
                      )
                    }
                  />
                }
                label={`${resourceName} · ${resourceKey}`}
              />
            ))}
          </Stack>
        </Box>
      </Stack>
    </FormDialog>
  );
}

function DecisionDialog({
  action,
  busy,
  onClose,
  onSubmit,
}: {
  action: {
    assignment: AppAdminAssignment;
    decision: Decision;
    approvalMode: AppGovernanceApprovalMode | null;
  } | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [reason, setReason] = useState('');
  const destructive = action?.decision === 'DENIED' || action?.decision === 'REVOKED';
  const firstApproverBootstrap =
    action?.decision === 'APPROVED' && action.approvalMode === 'FIRST_APPROVER_BOOTSTRAP';
  return (
    <FormDialog
      open={Boolean(action)}
      title={
        firstApproverBootstrap
          ? t('appGovernance.bootstrap.dialogTitle')
          : t(`appGovernance.dialog.${action?.decision.toLowerCase() ?? 'approved'}Title`)
      }
      description={`${action?.assignment.principalName ?? ''} · ${
        action?.assignment.resourceSetName ?? ''
      }`}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t(`appGovernance.actions.${action?.decision.toLowerCase() ?? 'approve'}`)}
      submitIntent={destructive ? 'danger' : 'primary'}
      onClose={onClose}
      busy={busy}
      submitDisabled={reason.trim().length < 10}
      onSubmit={() => onSubmit(reason.trim())}
    >
      {firstApproverBootstrap && (
        <Alert severity="warning" data-testid="first-approver-bootstrap-evidence">
          <Typography variant="subtitle2">{t('appGovernance.bootstrap.dialogHeading')}</Typography>
          <Typography variant="body2">{t('appGovernance.bootstrap.dialogDescription')}</Typography>
        </Alert>
      )}
      <FormField
        required
        multiline
        minRows={3}
        label={t('appGovernance.fields.decisionReason')}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        supportingText={t('appGovernance.fields.justificationHelp')}
      />
    </FormDialog>
  );
}
