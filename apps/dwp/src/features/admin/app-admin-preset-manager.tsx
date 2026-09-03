import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ClipboardCheck, Plus, ShieldCheck, ShieldX, X } from 'lucide-react';
import {
  activateAppAdminPresetAssignment,
  createAppAdminPresetAssignment,
  decideAppAdminPresetAssignment,
  decideAppAdminPresetReview,
  revokeAppAdminPresetAssignment,
  type AppAdminPresetAssignment,
  type AppAdminPresetCatalogItem,
  type AppAdminPresetReview,
  type AppGovernanceDashboard,
} from '@dwp-frontend/shared-utils/api/app-governance-api';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { useToast } from '@dwp-frontend/shared-utils/toast/toast-store';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';
import { FormDialog } from '@dwp-frontend/design-system/components/dialogs/form-dialog';
import { FormField } from '@dwp-frontend/design-system/components/forms/form-field';
import { SelectField } from '@dwp-frontend/design-system/components/forms/select-field';
import { GuidedEmptyState } from '@dwp-frontend/design-system/components/states/state-panels';
import { DateTimePickerField } from '@dwp-frontend/design-system/enterprise/date-time/date-picker-field';
import { useQueryClient } from '@tanstack/react-query';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import {
  canRequestGovernedAssignment,
  governedRequestScopes,
  mayDecidePresetReview,
  resolvePresetAssignmentActions,
  type AppGovernanceActor,
} from './app-governance-authority';

export { resolvePresetAssignmentActions } from './app-governance-authority';

type PresetAction = {
  assignment: AppAdminPresetAssignment;
  decision: 'APPROVED' | 'DENIED' | 'ACTIVATED' | 'REVOKED';
};

type ReviewAction = {
  review: AppAdminPresetReview;
  decision: 'RESOLVED' | 'DISMISSED';
};

const governanceQueryKey = ['admin', 'app-governance'] as const;

function stateColor(state: AppAdminPresetAssignment['lifecycleState']) {
  if (state === 'ACTIVE') return 'success' as const;
  if (state === 'APPROVED') return 'info' as const;
  if (state === 'PENDING_APPROVAL') return 'warning' as const;
  return 'default' as const;
}

function displayReviewEvidence(evidence: unknown): string {
  if (typeof evidence === 'string') return evidence;
  try {
    return JSON.stringify(evidence);
  } catch {
    return '';
  }
}

export function AppAdminPresetManager({ data }: { data: AppGovernanceDashboard }) {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [requestOpen, setRequestOpen] = useState(false);
  const [presetAction, setPresetAction] = useState<PresetAction | null>(null);
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [busy, setBusy] = useState(false);
  const actor: AppGovernanceActor = {
    userId: auth.user?.userId,
    roles: auth.user?.roles ?? [],
    resourceRoles: auth.user?.resourceRoles ?? [],
    groupRefs: auth.user?.groups?.map((group) => group.groupRef) ?? [],
  };
  const requestScopes = governedRequestScopes(actor);
  const canRequest = canRequestGovernedAssignment(actor);
  const presets = data.presetCatalog ?? [];
  const assignments = data.presetAssignments ?? [];
  const reviews = data.presetReviews ?? [];
  const requestablePresets = presets.filter(
    (preset) =>
      preset.requestable !== false &&
      data.resourceSets.some(
        (resourceSet) =>
          (!requestScopes || requestScopes.has(resourceSet.resourceSetId)) &&
          resourceSet.resources.some((resource) => resource.resourceKey === preset.appResourceKey)
      )
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: governanceQueryKey });
  };

  const run = async (operation: () => Promise<unknown>, successKey: string) => {
    setBusy(true);
    try {
      await operation();
      await refresh();
      setRequestOpen(false);
      setPresetAction(null);
      setReviewAction(null);
      toast.success(t(successKey));
    } catch {
      toast.error(t('common.operationError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap={2.5}>
      <Alert severity="info" icon={<ShieldCheck size={20} aria-hidden="true" />}>
        {t('appGovernance.presets.atomicNotice')}
      </Alert>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between">
        <Box>
          <Typography variant="h6">{t('appGovernance.presets.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('appGovernance.presets.description')}
          </Typography>
        </Box>
        {canRequest && requestablePresets.length > 0 && (
          <ActionButton startIcon={<Plus size={17} />} onClick={() => setRequestOpen(true)}>
            {t('appGovernance.actions.requestPreset')}
          </ActionButton>
        )}
      </Stack>

      {assignments.length > 0 ? (
        <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small" aria-label={t('appGovernance.presets.assignmentTable')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('appGovernance.columns.principal')}</TableCell>
                <TableCell>{t('appGovernance.presets.columns.preset')}</TableCell>
                <TableCell>{t('appGovernance.columns.scope')}</TableCell>
                <TableCell>{t('appGovernance.presets.columns.duties')}</TableCell>
                <TableCell>{t('appGovernance.columns.validity')}</TableCell>
                <TableCell>{t('appGovernance.columns.state')}</TableCell>
                <TableCell align="right">{t('appGovernance.columns.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assignments.map((assignment) => {
                const { mayApprove, mayActivate, mayRevoke } = resolvePresetAssignmentActions(
                  assignment,
                  actor
                );
                return (
                  <TableRow key={assignment.presetAssignmentId} hover>
                    <TableCell>
                      <Typography variant="subtitle2">{assignment.principalName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('appGovernance.presets.principalMetadata', {
                          type: assignment.principalType,
                          ref: assignment.principalRef,
                        })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>
                        {assignment.presetName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('appGovernance.presets.presetMetadata', {
                          code: assignment.presetCode,
                          version: assignment.catalogVersion,
                        })}
                      </Typography>
                    </TableCell>
                    <TableCell>{assignment.resourceSetName}</TableCell>
                    <TableCell>
                      <Stack direction="row" gap={0.5} flexWrap="wrap">
                        {assignment.duties.map((duty) => (
                          <Chip
                            key={duty.assignmentId}
                            size="small"
                            variant="outlined"
                            label={duty.dutyCode}
                          />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(assignment.validTo, { dateStyle: 'medium' })}
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
                        color={stateColor(assignment.lifecycleState)}
                        label={t(`appGovernance.states.${assignment.lifecycleState}`)}
                      />
                    </TableCell>
                    <TableCell align="right" data-shell-auxiliary-avoidance="inline-end">
                      <Stack direction="row" justifyContent="flex-end" gap={0.5}>
                        {mayApprove && (
                          <>
                            <ActionIconButton
                              label={t('appGovernance.actions.approve')}
                              onClick={() => setPresetAction({ assignment, decision: 'APPROVED' })}
                            >
                              <Check size={17} />
                            </ActionIconButton>
                            <ActionIconButton
                              label={t('appGovernance.actions.deny')}
                              onClick={() => setPresetAction({ assignment, decision: 'DENIED' })}
                            >
                              <X size={17} />
                            </ActionIconButton>
                          </>
                        )}
                        {mayActivate && (
                          <ActionIconButton
                            label={t('appGovernance.actions.activate')}
                            onClick={() => setPresetAction({ assignment, decision: 'ACTIVATED' })}
                          >
                            <ShieldCheck size={17} />
                          </ActionIconButton>
                        )}
                        {mayRevoke && (
                          <ActionIconButton
                            label={t('appGovernance.actions.revoke')}
                            onClick={() => setPresetAction({ assignment, decision: 'REVOKED' })}
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
          title={t('appGovernance.presets.emptyTitle')}
          description={t('appGovernance.presets.emptyDescription')}
        />
      )}

      {reviews.length > 0 && (
        <Stack gap={1.25}>
          <Typography variant="h6">{t('appGovernance.presets.reviewTitle')}</Typography>
          <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small" aria-label={t('appGovernance.presets.reviewTable')}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('appGovernance.columns.principal')}</TableCell>
                  <TableCell>{t('appGovernance.presets.columns.sourceRole')}</TableCell>
                  <TableCell>{t('appGovernance.presets.columns.duties')}</TableCell>
                  <TableCell>{t('appGovernance.presets.columns.reason')}</TableCell>
                  <TableCell>{t('appGovernance.presets.columns.evidence')}</TableCell>
                  <TableCell>{t('appGovernance.columns.state')}</TableCell>
                  <TableCell align="right">{t('appGovernance.columns.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.reviewId} hover>
                    <TableCell>{review.userName}</TableCell>
                    <TableCell>{review.sourceRoleCode}</TableCell>
                    <TableCell>{review.dutyCode}</TableCell>
                    <TableCell>{review.reasonCode}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        noWrap
                        title={displayReviewEvidence(review.evidence)}
                        sx={{ maxWidth: 280 }}
                      >
                        {displayReviewEvidence(review.evidence)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`appGovernance.presets.reviewStates.${review.lifecycleState}`)}
                      />
                    </TableCell>
                    <TableCell align="right" data-shell-auxiliary-avoidance="inline-end">
                      {mayDecidePresetReview(review, actor) && (
                        <Stack direction="row" justifyContent="flex-end" gap={0.5}>
                          <ActionIconButton
                            label={t('appGovernance.actions.resolveReview')}
                            onClick={() => setReviewAction({ review, decision: 'RESOLVED' })}
                          >
                            <ClipboardCheck size={17} />
                          </ActionIconButton>
                          <ActionIconButton
                            label={t('appGovernance.actions.dismissReview')}
                            onClick={() => setReviewAction({ review, decision: 'DISMISSED' })}
                          >
                            <X size={17} />
                          </ActionIconButton>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      <PresetRequestDialog
        open={requestOpen}
        busy={busy}
        data={data}
        presets={requestablePresets}
        allowedResourceSetIds={requestScopes}
        onClose={() => setRequestOpen(false)}
        onSubmit={(payload) =>
          run(() => createAppAdminPresetAssignment(payload), 'appGovernance.toasts.presetRequested')
        }
      />
      <ReasonDialog
        key={
          presetAction
            ? `preset:${presetAction.assignment.presetAssignmentId}:${presetAction.decision}`
            : reviewAction
              ? `review:${reviewAction.review.reviewId}:${reviewAction.decision}`
              : 'closed'
        }
        open={Boolean(presetAction || reviewAction)}
        busy={busy}
        title={t(
          presetAction
            ? `appGovernance.dialog.preset${presetAction.decision}Title`
            : reviewAction
              ? `appGovernance.dialog.review${reviewAction.decision}Title`
              : 'appGovernance.dialog.decisionTitle'
        )}
        onClose={() => {
          setPresetAction(null);
          setReviewAction(null);
        }}
        onSubmit={(reason) => {
          if (presetAction) {
            const action = presetAction;
            const decision = action.decision;
            const operation =
              decision === 'REVOKED'
                ? () => revokeAppAdminPresetAssignment(action.assignment, reason)
                : decision === 'ACTIVATED'
                  ? () => activateAppAdminPresetAssignment(action.assignment, reason)
                  : () => decideAppAdminPresetAssignment(action.assignment, decision, reason);
            return run(operation, `appGovernance.toasts.preset${action.decision}`);
          }
          if (reviewAction) {
            return run(
              () => decideAppAdminPresetReview(reviewAction.review, reviewAction.decision, reason),
              `appGovernance.toasts.review${reviewAction.decision}`
            );
          }
          return Promise.resolve();
        }}
      />
    </Stack>
  );
}

function PresetRequestDialog({
  open,
  busy,
  data,
  presets,
  allowedResourceSetIds,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  data: AppGovernanceDashboard;
  presets: AppAdminPresetCatalogItem[];
  allowedResourceSetIds: ReadonlySet<string> | null;
  onClose: () => void;
  onSubmit: (payload: {
    principalType: 'USER' | 'GROUP';
    principalRef: string;
    presetCode: string;
    resourceSetId: string;
    validTo: string;
    reviewDueAt: string;
    justification: string;
  }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const { t: tDisplay } = useTranslation('display');
  const [principal, setPrincipal] = useState('');
  const [presetCode, setPresetCode] = useState('');
  const [resourceSetId, setResourceSetId] = useState('');
  const [validTo, setValidTo] = useState('');
  const [reviewDueAt, setReviewDueAt] = useState('');
  const [justification, setJustification] = useState('');
  const selectedPrincipal = data.principals.find(
    (item) => `${item.type}:${item.ref}` === principal
  );
  const selectedPreset = presets.find((preset) => preset.presetCode === presetCode);
  const compatibleSets = useMemo(
    () =>
      selectedPreset
        ? data.resourceSets.filter(
            (set) =>
              set.resources.some(
                (resource) => resource.resourceKey === selectedPreset.appResourceKey
              ) &&
              (allowedResourceSetIds === null || allowedResourceSetIds.has(set.resourceSetId))
          )
        : [],
    [allowedResourceSetIds, data.resourceSets, selectedPreset]
  );
  const validToMs = Date.parse(validTo);
  const reviewDueMs = Date.parse(reviewDueAt);
  const invalidValidity =
    Boolean(validTo) && (!Number.isFinite(validToMs) || validToMs <= Date.now());
  const invalidReview =
    Boolean(reviewDueAt) &&
    (!Number.isFinite(reviewDueMs) ||
      reviewDueMs <= Date.now() ||
      (Number.isFinite(validToMs) && reviewDueMs > validToMs));
  const valid =
    Boolean(
      selectedPrincipal &&
      selectedPreset?.requestable !== false &&
      resourceSetId &&
      validTo &&
      reviewDueAt
    ) &&
    !invalidValidity &&
    !invalidReview &&
    justification.trim().length >= 10;
  return (
    <FormDialog
      open={open}
      title={t('appGovernance.dialog.presetRequestTitle')}
      description={t('appGovernance.presets.requestDescription')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('appGovernance.actions.submitForApproval')}
      busy={busy}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={() => {
        if (!selectedPrincipal || !selectedPreset) return Promise.resolve();
        return onSubmit({
          principalType: selectedPrincipal.type,
          principalRef: selectedPrincipal.ref,
          presetCode: selectedPreset.presetCode,
          resourceSetId,
          validTo,
          reviewDueAt,
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
          label={t('appGovernance.fields.preset')}
          value={presetCode}
          onValueChange={(value) => {
            setPresetCode(value);
            setResourceSetId('');
          }}
          options={presets.map((preset) => ({
            value: preset.presetCode,
            label: `${preset.displayName} · ${tDisplay(`riskTiers.${preset.riskTier}`)}`,
            disabled: preset.requestable === false,
          }))}
        />
        {selectedPreset && (
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
            <Typography variant="subtitle2">{selectedPreset.description}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {t('appGovernance.presets.responsibilityPreview', {
                responsibility: t(
                  `appGovernance.responsibilities.${selectedPreset.responsibilityCode}`
                ),
              })}
            </Typography>
            <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
              {selectedPreset.duties.map((duty) => (
                <Chip
                  key={duty.dutyCode}
                  size="small"
                  variant="outlined"
                  label={`${duty.dutyCode} · ${tDisplay(`riskTiers.${duty.riskTier}`)}`}
                />
              ))}
            </Stack>
            {selectedPreset.requestable === false && (
              <Alert severity="warning" sx={{ mt: 1.5 }}>
                {t('appGovernance.presets.unavailable', {
                  reason: selectedPreset.unavailableReason,
                })}
              </Alert>
            )}
          </Box>
        )}
        <SelectField
          required
          label={t('appGovernance.fields.scope')}
          value={resourceSetId}
          onValueChange={setResourceSetId}
          options={compatibleSets.map((set) => ({ value: set.resourceSetId, label: set.name }))}
        />
        <DateTimePickerField
          required
          label={t('appGovernance.fields.validToRequired')}
          value={validTo || null}
          onValueChange={(value) => setValidTo(value ?? '')}
          errorMessage={
            invalidValidity ? t('appGovernance.presets.validityFutureError') : undefined
          }
        />
        <DateTimePickerField
          required
          label={t('appGovernance.fields.reviewDueAt')}
          value={reviewDueAt || null}
          onValueChange={(value) => setReviewDueAt(value ?? '')}
          errorMessage={invalidReview ? t('appGovernance.presets.reviewWindowError') : undefined}
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

function ReasonDialog({
  open,
  busy,
  title,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [reason, setReason] = useState('');
  return (
    <FormDialog
      open={open}
      title={title}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.confirm')}
      busy={busy}
      submitDisabled={reason.trim().length < 10}
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim())}
    >
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
