import { Calculator, CheckCircle2, FlaskConical, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  FormDialog,
  FormField,
  GlyphSurface,
  GuidedEmptyState,
  InlineFeedback,
  LocalErrorState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { usePayrollConfigurationWorkbench } from '../hooks/use-payroll-configuration-workbench';

import type {
  PayrollConfigurationCommandFeedback,
  PayrollConfigurationOwnerBinding,
  PayrollConfigurationScope,
  PayrollConfigurationWorkbenchController,
} from '../hooks/use-payroll-configuration-workbench';
import type { PayrollElementFormulaDataSource } from '../api/payroll-element-formula-api';
import type {
  PayrollFieldDecision,
  PayrollWorkbenchItem,
} from '../model/payroll-configuration-workbench-model';

export type PayrollConfigurationWorkbenchCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  asOf: string;
  refresh: string;
  loading: string;
  deniedTitle: string;
  deniedScopeDescription: string;
  deniedOwnerDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  partialTitle: string;
  partialDescription: string;
  staleTitle: string;
  staleDescription: string;
  items: string;
  itemCount: string;
  formula: string;
  element: string;
  status: string;
  policyVersion: string;
  payrollPolicy: string;
  effectiveStatus: string;
  masked: string;
  omitted: string;
  effectiveFrom: string;
  effectiveTo: string;
  openEnded: string;
  revision: string;
  simulationTitle: string;
  simulationDescription: string;
  inputKey: string;
  inputValue: string;
  currency: string;
  validate: string;
  simulate: string;
  publish: string;
  commandUnavailable: string;
  versionUnavailable: string;
  successTitle: string;
  successDescription: string;
  stepUpTitle: string;
  stepUpDescription: string;
  unknownTitle: string;
  unknownDescription: string;
  retryExact: string;
  permissionTitle: string;
  permissionDescription: string;
  conflictTitle: string;
  conflictDescription: string;
  rejectedTitle: string;
  rejectedDescription: string;
  invalidTitle: string;
  invalidDescription: string;
  publishReviewTitle: string;
  publishReviewDescription: string;
  publishConfirm: string;
  cancel: string;
}>;

export const payrollConfigurationWorkbenchCopy: PayrollConfigurationWorkbenchCopy = Object.freeze({
  eyebrow: 'HRIS / Payroll settings',
  title: 'Payroll elements and formulas',
  description:
    'Review effective policy versions, validate typed formulas, run a controlled simulation, and publish with step-up verification.',
  asOf: 'As of',
  refresh: 'Refresh',
  loading: 'Loading payroll configuration…',
  deniedTitle: 'Payroll configuration is not authorized',
  deniedScopeDescription:
    'A settings administration scope is required before payroll configuration can be requested.',
  deniedOwnerDescription:
    'The exact IAQ-055 owner binding is unavailable. No adjacent payroll permission is reused.',
  unavailableTitle: 'Payroll configuration is unavailable',
  unavailableDescription:
    'The PAY owner could not provide a safe configuration projection. Refresh to try again.',
  emptyTitle: 'No payroll elements or formulas',
  emptyDescription: 'No effective payroll configuration is available in this administration scope.',
  partialTitle: 'Some payroll configuration is unavailable',
  partialDescription:
    'Available items remain read-only until the missing owner evidence is restored.',
  staleTitle: 'Payroll configuration may be stale',
  staleDescription: 'Refresh before validating, simulating, or publishing a policy version.',
  items: 'Payroll items and formulas',
  itemCount: '{{count}} configuration items',
  formula: 'Formula',
  element: 'Element',
  status: 'Status',
  policyVersion: 'Policy version',
  payrollPolicy: 'Payroll policy',
  effectiveStatus: 'Effective status',
  masked: 'Masked by field policy',
  omitted: 'Not disclosed',
  effectiveFrom: 'Effective from',
  effectiveTo: 'Effective to',
  openEnded: 'Open ended',
  revision: 'Revision',
  simulationTitle: 'Controlled simulation input',
  simulationDescription:
    'The simulation does not calculate production payroll or activate a configuration.',
  inputKey: 'Formula input key',
  inputValue: 'Test amount',
  currency: 'Currency',
  validate: 'Validate formula',
  simulate: 'Simulate formula',
  publish: 'Publish formula',
  commandUnavailable: 'Exact owner command authority is unavailable for this item.',
  versionUnavailable: 'The policy version is masked or omitted, so commands remain disabled.',
  successTitle: 'Payroll command completed',
  successDescription: 'The PAY owner returned a bound command receipt.',
  stepUpTitle: 'Step-up verification is in progress',
  stepUpDescription:
    'Publishing is paused until the high-risk verification returns exact command authority.',
  unknownTitle: 'Payroll command outcome is unknown',
  unknownDescription:
    'Do not create a new command. Retry the preserved body with the same idempotency key.',
  retryExact: 'Retry exact command',
  permissionTitle: 'Command permission denied',
  permissionDescription: 'The exact PAY owner action is not authorized in the current scope.',
  conflictTitle: 'Payroll version changed',
  conflictDescription:
    'Refresh the workbench and review the latest policy version before retrying.',
  rejectedTitle: 'Payroll command was rejected',
  rejectedDescription: 'No success was assumed and no configuration was activated.',
  invalidTitle: 'Simulation input is invalid',
  invalidDescription: 'Correct the named input, amount, or currency before simulating.',
  publishReviewTitle: 'Publish this payroll formula?',
  publishReviewDescription:
    'Publishing is a high-risk action. The exact version and idempotency key will be bound to a step-up decision.',
  publishConfirm: 'Continue to step-up',
  cancel: 'Cancel',
});

function value(copy: string, replacements: Record<string, string | number>) {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replace(`{{${key}}}`, String(replacement)),
    copy
  );
}

function itemKind(item: PayrollWorkbenchItem) {
  return item.itemPublicId.startsWith('formula:') ? 'formula' : 'element';
}

function FieldProjection({
  label,
  decision,
  copy,
}: Readonly<{
  label: string;
  decision: PayrollFieldDecision | undefined;
  copy: PayrollConfigurationWorkbenchCopy;
}>) {
  let content: React.ReactNode = copy.omitted;
  let tone = 'text.secondary';
  if (decision?.decision === 'MASK') {
    content = `${copy.masked} · ${decision.maskReason}`;
    tone = 'warning.main';
  } else if (decision?.decision === 'VIEW') {
    const visible = decision.value;
    content =
      'policyKey' in visible ? (
        <Stack gap={0.25}>
          <span>{visible.policyKey}</span>
          <Typography component="span" variant="caption" color="text.secondary">
            {copy.revision} {visible.revision} · {visible.status}
          </Typography>
          <Typography component="span" variant="caption" color="text.secondary">
            {copy.effectiveFrom} {visible.effectiveFrom} · {copy.effectiveTo}{' '}
            {visible.effectiveTo ?? copy.openEnded}
          </Typography>
        </Stack>
      ) : (
        `${visible.code} · ${copy.revision} ${visible.revision}`
      );
    tone = 'text.primary';
  }
  return (
    <Box component="div" sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        color={tone}
        sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}
      >
        {content}
      </Typography>
    </Box>
  );
}

function CommandFeedback({
  feedback,
  busy,
  copy,
  onRetryExact,
  onRefresh,
}: Readonly<{
  feedback: PayrollConfigurationCommandFeedback | null;
  busy: boolean;
  copy: PayrollConfigurationWorkbenchCopy;
  onRetryExact: () => void;
  onRefresh: () => void;
}>) {
  if (!feedback) return null;
  if (feedback.kind === 'SUCCEEDED') {
    return (
      <InlineFeedback severity="success" title={copy.successTitle}>
        {copy.successDescription} {feedback.receipt.commandType} · {feedback.receipt.receiptId}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'STEP_UP') {
    return (
      <InlineFeedback severity="info" title={copy.stepUpTitle}>
        {copy.stepUpDescription}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'RESULT_UNKNOWN') {
    return (
      <InlineFeedback
        severity="warning"
        title={copy.unknownTitle}
        action={
          <ActionButton intent="secondary" size="small" disabled={busy} onClick={onRetryExact}>
            {copy.retryExact}
          </ActionButton>
        }
      >
        {copy.unknownDescription}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'PERMISSION') {
    return (
      <InlineFeedback severity="error" title={copy.permissionTitle}>
        {copy.permissionDescription}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'CONFLICT') {
    return (
      <InlineFeedback
        severity="warning"
        title={copy.conflictTitle}
        action={
          <ActionButton intent="secondary" size="small" onClick={onRefresh}>
            {copy.refresh}
          </ActionButton>
        }
      >
        {copy.conflictDescription}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'INPUT_INVALID') {
    return (
      <InlineFeedback severity="error" title={copy.invalidTitle}>
        {copy.invalidDescription} {feedback.errors.join(', ')}
      </InlineFeedback>
    );
  }
  return (
    <InlineFeedback severity="error" title={copy.rejectedTitle}>
      {copy.rejectedDescription}
    </InlineFeedback>
  );
}

function ItemNavigation({
  controller,
  copy,
}: Readonly<{
  controller: PayrollConfigurationWorkbenchController;
  copy: PayrollConfigurationWorkbenchCopy;
}>) {
  const items = controller.workbench?.items ?? [];
  return (
    <Paper component="nav" aria-label={copy.items} variant="outlined" sx={{ minWidth: 0 }}>
      <Box sx={{ p: { xs: 1.25, sm: 1.5 }, pb: 0.5 }}>
        <Typography component="h2" variant="subtitle1">
          {copy.items}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {value(copy.itemCount, { count: items.length })}
        </Typography>
      </Box>
      <List disablePadding>
        {items.map((item) => (
          <ListItem key={item.itemPublicId} disablePadding>
            <ListItemButton
              selected={controller.selectedId === item.itemPublicId}
              disabled={controller.commandBlocked}
              aria-label={`Review ${item.title}`}
              onClick={() => controller.select(item.itemPublicId)}
              sx={{ alignItems: 'flex-start', minWidth: 0 }}
            >
              <ListItemText
                primary={item.title}
                secondary={`${itemKind(item) === 'formula' ? copy.formula : copy.element} · ${item.statusCode}`}
                primaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
                secondaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
              />
              <Chip size="small" variant="outlined" label={item.statusCode} sx={{ ml: 1 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}

function ItemDetail({
  controller,
  copy,
}: Readonly<{
  controller: PayrollConfigurationWorkbenchController;
  copy: PayrollConfigurationWorkbenchCopy;
}>) {
  const item = controller.selected;
  if (!item) return null;
  const formula = itemKind(item) === 'formula';
  const version =
    item.fieldGroups.POLICY_VERSION?.decision === 'VIEW'
      ? item.fieldGroups.POLICY_VERSION.value.revision
      : null;
  const anyCommand = controller.canValidate || controller.canSimulate || controller.canPublish;
  return (
    <Stack
      component="section"
      aria-labelledby="payroll-configuration-detail-title"
      gap={1.5}
      minWidth={0}
    >
      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'flex-start' }} gap={1.5}>
          <Box minWidth={0} flex={1}>
            <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap alignItems="center">
              <Typography
                id="payroll-configuration-detail-title"
                component="h2"
                variant="h6"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {item.title}
              </Typography>
              <Chip size="small" label={formula ? copy.formula : copy.element} />
              <Chip size="small" variant="outlined" label={item.statusCode} />
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: 'block', overflowWrap: 'anywhere' }}
            >
              {item.itemPublicId}
            </Typography>
          </Box>
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
            <ActionButton
              intent="secondary"
              size="small"
              startIcon={<CheckCircle2 size={15} aria-hidden="true" />}
              disabled={!controller.canValidate}
              loading={controller.busy && controller.feedback?.kind !== 'STEP_UP'}
              onClick={controller.validate}
            >
              {copy.validate}
            </ActionButton>
            <ActionButton
              intent="secondary"
              size="small"
              startIcon={<FlaskConical size={15} aria-hidden="true" />}
              disabled={!controller.canSimulate}
              loading={controller.busy && controller.feedback?.kind !== 'STEP_UP'}
              onClick={controller.simulate}
            >
              {copy.simulate}
            </ActionButton>
            <ActionButton
              intent="primary"
              size="small"
              startIcon={<ShieldCheck size={15} aria-hidden="true" />}
              disabled={!controller.canPublish}
              aria-describedby="payroll-formula-publish-requirement"
              onClick={controller.openPublishReview}
            >
              {copy.publish}
            </ActionButton>
          </Stack>
        </Stack>
      </Paper>

      {!formula ? (
        <InlineFeedback severity="info" title={copy.element}>
          {copy.commandUnavailable}
        </InlineFeedback>
      ) : version === null ? (
        <InlineFeedback severity="warning" title={copy.versionUnavailable}>
          {copy.commandUnavailable}
        </InlineFeedback>
      ) : !anyCommand ? (
        <InlineFeedback severity="info" title={copy.commandUnavailable}>
          {copy.permissionDescription}
        </InlineFeedback>
      ) : null}

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <FieldProjection
            label={copy.policyVersion}
            decision={item.fieldGroups.POLICY_VERSION}
            copy={copy}
          />
          <FieldProjection
            label={copy.payrollPolicy}
            decision={item.fieldGroups.PAYROLL_POLICY}
            copy={copy}
          />
          <FieldProjection
            label={copy.effectiveStatus}
            decision={item.fieldGroups.EFFECTIVE_STATUS}
            copy={copy}
          />
        </Box>
      </Paper>

      {formula && (
        <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography component="h3" variant="subtitle1">
            {copy.simulationTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {copy.simulationDescription}
          </Typography>
          <Box
            sx={{
              mt: 1.5,
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '2fr 1.5fr 1fr' },
              gap: 1.25,
            }}
          >
            <FormField
              size="small"
              fullWidth
              label={copy.inputKey}
              value={controller.simulationDraft.inputKey}
              disabled={controller.commandBlocked}
              onChange={(event) =>
                controller.setSimulationDraft((current) => ({
                  ...current,
                  inputKey: event.target.value,
                }))
              }
            />
            <FormField
              size="small"
              fullWidth
              label={copy.inputValue}
              inputProps={{ inputMode: 'decimal' }}
              value={controller.simulationDraft.value}
              disabled={controller.commandBlocked}
              onChange={(event) =>
                controller.setSimulationDraft((current) => ({
                  ...current,
                  value: event.target.value,
                }))
              }
            />
            <FormField
              size="small"
              fullWidth
              label={copy.currency}
              inputProps={{ maxLength: 3 }}
              value={controller.simulationDraft.currency}
              disabled={controller.commandBlocked}
              onChange={(event) =>
                controller.setSimulationDraft((current) => ({
                  ...current,
                  currency: event.target.value.toUpperCase(),
                }))
              }
            />
          </Box>
        </Paper>
      )}

      <Typography id="payroll-formula-publish-requirement" variant="caption" color="text.secondary">
        {copy.publishReviewDescription}
      </Typography>
    </Stack>
  );
}

export type PayrollConfigurationWorkbenchViewProps = Readonly<{
  controller: PayrollConfigurationWorkbenchController;
  copy?: PayrollConfigurationWorkbenchCopy;
}>;

export function PayrollConfigurationWorkbenchView({
  controller,
  copy = payrollConfigurationWorkbenchCopy,
}: PayrollConfigurationWorkbenchViewProps) {
  const workbench = controller.workbench;
  if (!workbench) return null;
  if (workbench.queryState.state === 'UNAVAILABLE') {
    return (
      <LocalErrorState
        title={copy.unavailableTitle}
        description={copy.unavailableDescription}
        retryLabel={copy.refresh}
        onRetry={controller.refresh}
        retrying={controller.busy}
        requestIdLabel={workbench.queryState.correlationId}
        size="page"
      />
    );
  }
  return (
    <Stack gap={2} data-testid="payroll-configuration-workbench" data-slice="BASE-TFR-PAY-006">
      <Paper component="header" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} gap={1.5}>
          <GlyphSurface size={44} variant="soft">
            <Calculator size={22} aria-hidden="true" />
          </GlyphSurface>
          <Box minWidth={0} flex={1}>
            <Typography variant="overline" color="text.secondary">
              {copy.eyebrow}
            </Typography>
            <Typography component="h1" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
              {copy.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {copy.description}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {copy.asOf} {workbench.asOf}
            </Typography>
          </Box>
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip
              size="small"
              color={workbench.queryState.freshness === 'CURRENT' ? 'success' : 'warning'}
              label={workbench.queryState.freshness}
            />
            {workbench.queryState.fieldDecisionSummary.maskedCount > 0 && (
              <Chip
                size="small"
                variant="outlined"
                color="warning"
                label={`${workbench.queryState.fieldDecisionSummary.maskedCount} masked`}
              />
            )}
            {workbench.queryState.fieldDecisionSummary.omittedCount > 0 && (
              <Chip
                size="small"
                variant="outlined"
                label={`${workbench.queryState.fieldDecisionSummary.omittedCount} omitted`}
              />
            )}
            <ActionButton
              intent="quiet"
              size="small"
              loading={controller.state.kind === 'LOADING'}
              disabled={controller.commandBlocked}
              startIcon={<RefreshCw size={15} aria-hidden="true" />}
              onClick={controller.refresh}
            >
              {copy.refresh}
            </ActionButton>
          </Stack>
        </Stack>
      </Paper>

      {workbench.queryState.freshness === 'STALE' && (
        <InlineFeedback severity="warning" title={copy.staleTitle}>
          {copy.staleDescription}
        </InlineFeedback>
      )}
      {workbench.queryState.state === 'PARTIAL' && (
        <InlineFeedback severity="warning" title={copy.partialTitle}>
          <Stack gap={0.5}>
            <span>{copy.partialDescription}</span>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {workbench.queryState.partialFailures.map((failure) => (
                <li key={`${failure.componentKey}:${failure.correlationId}`}>
                  {failure.componentKey} · {failure.errorCode}
                  {failure.retryable ? ` · ${copy.retryExact}` : ''}
                </li>
              ))}
            </Box>
          </Stack>
        </InlineFeedback>
      )}

      <CommandFeedback
        feedback={controller.feedback}
        busy={controller.busy}
        copy={copy}
        onRetryExact={controller.retryExact}
        onRefresh={controller.refresh}
      />

      {workbench.items.length === 0 ? (
        <GuidedEmptyState
          kind="no-results"
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          size="page"
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(240px, 320px) minmax(0, 1fr)',
            },
            gap: 2,
            alignItems: 'start',
            minWidth: 0,
          }}
        >
          <ItemNavigation controller={controller} copy={copy} />
          <ItemDetail controller={controller} copy={copy} />
        </Box>
      )}

      <FormDialog
        open={controller.publishReviewOpen}
        title={copy.publishReviewTitle}
        description={copy.publishReviewDescription}
        cancelLabel={copy.cancel}
        submitLabel={copy.publishConfirm}
        submitIntent="primary"
        busy={controller.busy}
        submitDisabled={!controller.canPublish}
        mobileFullScreen
        onClose={controller.closePublishReview}
        onSubmit={controller.publish}
      >
        {controller.selected && (
          <Stack gap={1}>
            <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
              {controller.selected.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {controller.selected.statusCode} · {controller.selected.itemPublicId}
            </Typography>
            <InlineFeedback severity="warning" title={copy.stepUpTitle}>
              {copy.publishReviewDescription}
            </InlineFeedback>
          </Stack>
        )}
      </FormDialog>
    </Stack>
  );
}

export type PayrollConfigurationWorkbenchRuntimeProps = Readonly<{
  scope: PayrollConfigurationScope;
  ownerBinding?: PayrollConfigurationOwnerBinding;
  dataSource?: PayrollElementFormulaDataSource;
  copy?: PayrollConfigurationWorkbenchCopy;
  idFactory?: () => string;
}>;

export function PayrollConfigurationWorkbenchRuntime({
  scope,
  ownerBinding,
  dataSource,
  copy = payrollConfigurationWorkbenchCopy,
  idFactory,
}: PayrollConfigurationWorkbenchRuntimeProps) {
  const controller = usePayrollConfigurationWorkbench({
    scope,
    ownerBinding,
    dataSource,
    idFactory,
  });

  if (!scope.ready) {
    return (
      <div data-testid="payroll-configuration-closed">
        <LocalErrorState
          title={copy.deniedTitle}
          description={copy.deniedScopeDescription}
          size="page"
        />
      </div>
    );
  }
  if (controller.state.kind === 'CLOSED') {
    return (
      <div data-testid="payroll-configuration-closed">
        <LocalErrorState
          title={copy.deniedTitle}
          description={copy.deniedOwnerDescription}
          size="page"
        />
      </div>
    );
  }
  if (
    controller.state.scopeIdentity !== controller.scopeIdentity ||
    controller.state.kind === 'LOADING'
  ) {
    return <Typography role="status">{copy.loading}</Typography>;
  }
  if (controller.state.kind === 'DENIED') {
    return (
      <LocalErrorState
        title={copy.deniedTitle}
        description={copy.deniedScopeDescription}
        size="page"
      />
    );
  }
  if (controller.state.kind === 'ERROR') {
    return (
      <LocalErrorState
        title={copy.unavailableTitle}
        description={copy.unavailableDescription}
        retryLabel={copy.refresh}
        onRetry={controller.refresh}
        size="page"
      />
    );
  }
  return <PayrollConfigurationWorkbenchView controller={controller} copy={copy} />;
}

export default PayrollConfigurationWorkbenchRuntime;
