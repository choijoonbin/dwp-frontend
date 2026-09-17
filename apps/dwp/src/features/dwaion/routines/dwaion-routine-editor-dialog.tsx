import { useMemo } from 'react';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  DateRangePickerField,
  ActionButton,
  FormDialog,
  FormField,
  SelectField,
  TimePickerField,
} from '@dwp-frontend/design-system';

import { DWAION_ROUTINE_COPY_KO } from './dwaion-routine-copy';
import { routineDraftChangeKeys, routineDraftErrors } from './dwaion-routine-model';
import { DwaionCapabilityActions } from '../dwaion-capability-actions';

import type { DwaionRoutineCopy } from './dwaion-routine-copy';
import type {
  DwaionRoutineProviderCapability,
  DwaionRoutineRuntimeCapabilities,
} from '@dwp-frontend/shared-utils';
import type { DwaionRoutineConsent, DwaionRoutineDraft } from './dwaion-routine-model';

export type DwaionRoutineSourceOption = {
  key: string;
  label: string;
  description?: string;
  available?: boolean;
};

export function DwaionRoutineEditorDialog({
  open,
  draft,
  savedDraft = null,
  sourceOptions,
  timeZoneOptions,
  capabilities,
  busy = false,
  dryRunBusy = false,
  advancedBusy = false,
  onDraftChange,
  onClose,
  onSubmit,
  onDryRun,
  onRequestChangeApproval,
  onRequestEngineSwitch,
  copy = DWAION_ROUTINE_COPY_KO,
}: {
  open: boolean;
  draft: DwaionRoutineDraft;
  savedDraft?: DwaionRoutineDraft | null;
  sourceOptions: readonly DwaionRoutineSourceOption[];
  timeZoneOptions: readonly string[];
  capabilities?: DwaionRoutineRuntimeCapabilities;
  busy?: boolean;
  dryRunBusy?: boolean;
  advancedBusy?: boolean;
  onDraftChange: (draft: DwaionRoutineDraft) => void;
  onClose: () => void;
  onSubmit: (draft: DwaionRoutineDraft) => void | Promise<void>;
  onDryRun?: () => void;
  onRequestChangeApproval?: (draft: DwaionRoutineDraft) => void;
  onRequestEngineSwitch?: () => void;
  copy?: DwaionRoutineCopy;
}) {
  const errors = useMemo(() => routineDraftErrors(draft), [draft]);
  const changeKeys = useMemo(() => routineDraftChangeKeys(savedDraft, draft), [draft, savedDraft]);
  const dirty = savedDraft === null || changeKeys.length > 0;
  const update = (patch: Partial<DwaionRoutineDraft>) => onDraftChange({ ...draft, ...patch });
  const updateSchedule = (patch: Partial<DwaionRoutineDraft['schedule']>) =>
    update({ schedule: { ...draft.schedule, ...patch } });
  const updateBudget = (patch: Partial<DwaionRoutineDraft['budget']>) =>
    update({ budget: { ...draft.budget, ...patch } });
  const updateRetryPolicy = (patch: Partial<DwaionRoutineDraft['retryPolicy']>) =>
    update({ retryPolicy: { ...draft.retryPolicy, ...patch } });

  return (
    <FormDialog
      open={open}
      title={copy.editorTitle}
      description={copy.editorDescription}
      cancelLabel={copy.cancel}
      submitLabel={copy.save}
      submittingLabel={copy.saving}
      busy={busy}
      submitDisabled={errors.length > 0}
      mobileFullScreen
      maxWidth="md"
      onClose={onClose}
      onSubmit={() => onSubmit(draft)}
    >
      <Stack gap={2.5}>
        <Typography component="h3" variant="subtitle1">
          {copy.triggerSection}
        </Typography>
        <FormField
          label={copy.name}
          value={draft.title}
          required
          supportingText={copy.nameHelp}
          errorMessage={errors.includes('TITLE_REQUIRED') ? copy.nameHelp : undefined}
          onChange={(event) => update({ title: event.target.value })}
        />
        <FormField
          label={copy.details}
          value={draft.description}
          required
          multiline
          minRows={3}
          supportingText={copy.detailsHelp}
          errorMessage={errors.includes('DESCRIPTION_REQUIRED') ? copy.detailsHelp : undefined}
          onChange={(event) => update({ description: event.target.value })}
        />
        <SelectField
          label={copy.triggerType}
          value={draft.triggerType}
          options={[
            { value: 'SCHEDULED', label: copy.scheduledTrigger },
            {
              value: 'WEBHOOK',
              label: copy.webhookTrigger,
              disabled: !capabilities?.webhookTriggerAvailable,
            },
          ]}
          supportingText={
            capabilities?.webhookTriggerAvailable ? undefined : copy.webhookUnavailable
          }
          onValueChange={(value) => {
            if (value === 'SCHEDULED' || value === 'WEBHOOK') update({ triggerType: value });
          }}
        />

        {draft.triggerType === 'SCHEDULED' ? (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' },
                gap: 2,
              }}
            >
              <SelectField
                label={copy.cadenceLabel}
                value={draft.schedule.cadence}
                options={(['DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY'] as const).map((value) => ({
                  value,
                  label: copy.cadence[value],
                }))}
                onValueChange={(value) => {
                  if (value) {
                    updateSchedule({
                      cadence: value,
                      weekDays: value === 'WEEKLY' ? draft.schedule.weekDays : [],
                      monthDay: value === 'MONTHLY' ? (draft.schedule.monthDay ?? 1) : null,
                    });
                  }
                }}
              />
              <TimePickerField
                label={copy.localTime}
                value={draft.schedule.localTime || null}
                required
                onValueChange={(value) => updateSchedule({ localTime: value ?? '' })}
              />
              <SelectField
                label={copy.timeZone}
                value={draft.schedule.timeZone}
                options={timeZoneOptions.map((value) => ({ value, label: value }))}
                errorMessage={errors.includes('TIME_ZONE_REQUIRED') ? copy.timeZone : undefined}
                onValueChange={(value) => updateSchedule({ timeZone: value || '' })}
              />
            </Box>
            <DateRangePickerField
              value={{ start: draft.schedule.activeFrom, end: draft.schedule.activeUntil }}
              startLabel={copy.activeFrom}
              endLabel={copy.activeUntil}
              orderErrorMessage={copy.dateOrderError}
              onValueChange={(value) =>
                updateSchedule({ activeFrom: value.start, activeUntil: value.end })
              }
            />
          </>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' },
              gap: 2,
            }}
          >
            <FormField
              label={copy.webhookEventType}
              value={draft.webhookEventType}
              required
              supportingText={copy.webhookEventTypeHelp}
              errorMessage={
                errors.includes('WEBHOOK_EVENT_TYPE_INVALID')
                  ? copy.webhookDefinitionInvalid
                  : undefined
              }
              onChange={(event) => update({ webhookEventType: event.target.value.toUpperCase() })}
            />
            <FormField
              label={copy.webhookEndpointReference}
              value={draft.webhookEndpointReference}
              supportingText={copy.webhookEndpointReferenceHelp}
              errorMessage={
                errors.includes('WEBHOOK_ENDPOINT_REFERENCE_INVALID')
                  ? copy.webhookDefinitionInvalid
                  : undefined
              }
              onChange={(event) => update({ webhookEndpointReference: event.target.value })}
            />
          </Box>
        )}

        {draft.triggerType === 'SCHEDULED' && draft.schedule.cadence === 'WEEKLY' ? (
          <Box component="fieldset" sx={{ m: 0, p: 0, border: 0 }}>
            <Typography component="legend" variant="subtitle2">
              {copy.weekDays}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
              {copy.weekdayLabels.map((label, index) => {
                const day = index + 1;
                return (
                  <FormControlLabel
                    key={label}
                    sx={{ m: 0, minHeight: 44 }}
                    control={
                      <Checkbox
                        checked={draft.schedule.weekDays.includes(day)}
                        onChange={(_, checked) =>
                          updateSchedule({
                            weekDays: checked
                              ? [...draft.schedule.weekDays, day].sort()
                              : draft.schedule.weekDays.filter((value) => value !== day),
                          })
                        }
                      />
                    }
                    label={label}
                  />
                );
              })}
            </Stack>
            {errors.includes('WEEK_DAY_REQUIRED') ? (
              <Typography role="alert" variant="caption" color="error.main">
                {copy.weekDayRequired}
              </Typography>
            ) : null}
          </Box>
        ) : null}

        {draft.triggerType === 'SCHEDULED' && draft.schedule.cadence === 'MONTHLY' ? (
          <SelectField
            label={copy.monthDay}
            value={String(draft.schedule.monthDay ?? 1)}
            options={Array.from({ length: 28 }, (_, index) => ({
              value: String(index + 1),
              label: String(index + 1),
            }))}
            errorMessage={errors.includes('MONTH_DAY_REQUIRED') ? copy.monthDayRequired : undefined}
            onValueChange={(value) =>
              updateSchedule({ monthDay: value ? Number.parseInt(value, 10) : null })
            }
          />
        ) : null}

        {draft.triggerType === 'SCHEDULED' ? (
          <Box>
            <Typography variant="subtitle2">{copy.quietHours}</Typography>
            <Typography variant="caption" color="text.secondary">
              {copy.quietHoursHelp}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' },
                gap: 2,
                mt: 1,
              }}
            >
              <TimePickerField
                label={copy.quietStart}
                value={draft.schedule.quietHoursStart}
                errorMessage={
                  errors.includes('QUIET_HOURS_INCOMPLETE') ? copy.quietHoursHelp : undefined
                }
                onValueChange={(value) => updateSchedule({ quietHoursStart: value })}
              />
              <TimePickerField
                label={copy.quietEnd}
                value={draft.schedule.quietHoursEnd}
                errorMessage={
                  errors.includes('QUIET_HOURS_INCOMPLETE') ? copy.quietHoursHelp : undefined
                }
                onValueChange={(value) => updateSchedule({ quietHoursEnd: value })}
              />
            </Box>
          </Box>
        ) : null}

        <Typography component="h3" variant="subtitle1">
          {copy.bindingSection}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          <CapabilityEvidence
            label={copy.agentKernel}
            value={copy.agentKernelValue}
            capability={capabilities?.agentKernelBinding}
            readyText={copy.capabilityReady}
            availableLabel={copy.capabilityAvailable}
            unavailableLabel={copy.capabilityUnavailable}
            fallback={copy.runtimeActionUnavailable}
          />
          <CapabilityEvidence
            label={copy.allowedSources}
            value={draft.sourceKeys.length ? draft.sourceKeys.join(' · ') : copy.sourceSelection}
            capability={capabilities?.whitelistedSourceBinding}
            readyText={copy.capabilityReady}
            availableLabel={copy.capabilityAvailable}
            unavailableLabel={copy.capabilityUnavailable}
            fallback={copy.runtimeActionUnavailable}
          />
          <CapabilityEvidence
            label={copy.blockedBoundaries}
            value={copy.blockedBoundaryValue}
            capability={capabilities?.blockedSourcePolicy}
            readyText={copy.capabilityReady}
            availableLabel={copy.capabilityAvailable}
            unavailableLabel={copy.capabilityUnavailable}
            fallback={copy.runtimeActionUnavailable}
          />
        </Box>

        <Typography component="h3" variant="subtitle1">
          {copy.deliverySection}
        </Typography>
        <Typography variant="subtitle2">{copy.deliveryPipeline}</Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          <BooleanCapabilityEvidence
            label={copy.proposalDelivery}
            available={Boolean(capabilities?.proposalDeliveryAvailable)}
            readyText={copy.capabilityReady}
            availableLabel={copy.capabilityAvailable}
            unavailableLabel={copy.capabilityUnavailable}
            fallback={capabilities?.recoveryHint ?? copy.runtimeActionUnavailable}
          />
          <BooleanCapabilityEvidence
            label={copy.notificationDelivery}
            available={Boolean(capabilities?.notificationDeliveryAvailable)}
            readyText={copy.capabilityReady}
            availableLabel={copy.capabilityAvailable}
            unavailableLabel={copy.capabilityUnavailable}
            fallback={capabilities?.recoveryHint ?? copy.runtimeActionUnavailable}
          />
          <CapabilityEvidence
            label={copy.wormDelivery}
            capability={capabilities?.wormDelivery}
            readyText={copy.capabilityReady}
            availableLabel={copy.capabilityAvailable}
            unavailableLabel={copy.capabilityUnavailable}
            fallback={copy.runtimeActionUnavailable}
          />
          <CapabilityEvidence
            label={copy.zeroWriteGuard}
            value={copy.zeroWriteGuardHelp}
            capability={capabilities?.zeroWritePolicy}
            readyText={copy.capabilityReady}
            availableLabel={copy.capabilityAvailable}
            unavailableLabel={copy.capabilityUnavailable}
            fallback={copy.runtimeActionUnavailable}
          />
        </Box>

        <Typography component="h3" variant="subtitle1">
          {copy.budgetSection}
        </Typography>

        <Box component="fieldset" sx={{ m: 0, p: 0, border: 0 }}>
          <Typography component="legend" variant="subtitle2">
            {copy.executionBudget}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {copy.executionBudgetHelp}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
              mt: 1,
            }}
          >
            <FormField
              type="number"
              label={copy.maximumRuns}
              value={draft.budget.maximumRunsPerMonth}
              errorMessage={
                errors.includes('RUN_BUDGET_INVALID') ? copy.executionBudgetInvalid : undefined
              }
              slotProps={{ htmlInput: { min: 1, max: 744 } }}
              onChange={(event) =>
                updateBudget({ maximumRunsPerMonth: Number(event.target.value) })
              }
            />
            <FormField
              type="number"
              label={copy.maximumTokens}
              value={draft.budget.maximumTokensPerRun}
              errorMessage={
                errors.includes('TOKEN_BUDGET_INVALID') ? copy.executionBudgetInvalid : undefined
              }
              slotProps={{ htmlInput: { min: 128, max: 2_000_000 } }}
              onChange={(event) =>
                updateBudget({ maximumTokensPerRun: Number(event.target.value) })
              }
            />
            <FormField
              type="number"
              label={copy.maximumMinutes}
              value={draft.budget.maximumMinutesPerRun}
              errorMessage={
                errors.includes('TIME_BUDGET_INVALID') ? copy.executionBudgetInvalid : undefined
              }
              slotProps={{ htmlInput: { min: 1, max: 240 } }}
              onChange={(event) =>
                updateBudget({ maximumMinutesPerRun: Number(event.target.value) })
              }
            />
          </Box>
        </Box>

        <Box component="fieldset" sx={{ m: 0, p: 0, border: 0 }}>
          <Typography component="legend" variant="subtitle2">
            {copy.recoveryPolicy}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
              mt: 1,
            }}
          >
            <FormField
              type="number"
              label={copy.maximumAttempts}
              value={draft.retryPolicy.maximumAttempts}
              errorMessage={
                errors.includes('RETRY_ATTEMPTS_INVALID') ? copy.recoveryPolicyInvalid : undefined
              }
              slotProps={{ htmlInput: { min: 1, max: 10 } }}
              onChange={(event) =>
                updateRetryPolicy({ maximumAttempts: Number(event.target.value) })
              }
            />
            <FormField
              type="number"
              label={copy.initialBackoff}
              value={draft.retryPolicy.initialBackoffSeconds}
              errorMessage={
                errors.includes('RETRY_BACKOFF_INVALID') ? copy.recoveryPolicyInvalid : undefined
              }
              slotProps={{ htmlInput: { min: 5, max: 3_600 } }}
              onChange={(event) =>
                updateRetryPolicy({ initialBackoffSeconds: Number(event.target.value) })
              }
            />
            <FormField
              type="number"
              label={copy.backoffMultiplier}
              value={draft.retryPolicy.backoffMultiplier}
              errorMessage={
                errors.includes('RETRY_MULTIPLIER_INVALID') ? copy.recoveryPolicyInvalid : undefined
              }
              slotProps={{ htmlInput: { min: 1, max: 10, step: 0.5 } }}
              onChange={(event) =>
                updateRetryPolicy({ backoffMultiplier: Number(event.target.value) })
              }
            />
          </Box>
          <Stack sx={{ mt: 1 }}>
            {(
              [
                ['notifyOnPartial', copy.notifyOnPartial],
                ['notifyOnFailure', copy.notifyOnFailure],
                ['notifyOnRecovery', copy.notifyOnRecovery],
              ] as const
            ).map(([key, label]) => (
              <FormControlLabel
                key={key}
                sx={{ minHeight: 44, m: 0 }}
                control={
                  <Checkbox
                    checked={draft.notificationPolicy[key]}
                    onChange={(_, checked) =>
                      update({
                        notificationPolicy: { ...draft.notificationPolicy, [key]: checked },
                      })
                    }
                  />
                }
                label={label}
              />
            ))}
            <FormControlLabel
              sx={{ minHeight: 44, m: 0 }}
              control={
                <Checkbox
                  checked={draft.compensationPolicy.enabled}
                  onChange={(_, checked) =>
                    update({
                      compensationPolicy: { ...draft.compensationPolicy, enabled: checked },
                    })
                  }
                />
              }
              label={copy.compensationEnabled}
            />
            <SelectField
              label={copy.compensationStrategy}
              value={draft.compensationPolicy.strategy}
              disabled={!draft.compensationPolicy.enabled}
              options={[
                {
                  value: 'REVOKE_PENDING_HANDOFFS',
                  label: copy.compensationStrategies.REVOKE_PENDING_HANDOFFS,
                },
                {
                  value: 'PROVIDER_MANAGED',
                  label: copy.compensationStrategies.PROVIDER_MANAGED,
                },
              ]}
              onValueChange={(value) => {
                if (value === 'REVOKE_PENDING_HANDOFFS' || value === 'PROVIDER_MANAGED') {
                  update({
                    compensationPolicy: { ...draft.compensationPolicy, strategy: value },
                  });
                }
              }}
            />
          </Stack>
        </Box>

        <Box component="fieldset" sx={{ m: 0, p: 0, border: 0 }}>
          <Typography component="legend" variant="subtitle2">
            {copy.sourceSelection}
          </Typography>
          <Stack sx={{ mt: 0.75 }}>
            {sourceOptions.map((source) => (
              <FormControlLabel
                key={source.key}
                sx={{ minHeight: 44, alignItems: 'flex-start', m: 0 }}
                control={
                  <Checkbox
                    checked={draft.sourceKeys.includes(source.key)}
                    disabled={source.available === false}
                    onChange={(_, checked) =>
                      update({
                        sourceKeys: checked
                          ? [...draft.sourceKeys, source.key]
                          : draft.sourceKeys.filter((key) => key !== source.key),
                      })
                    }
                  />
                }
                label={
                  <Box sx={{ py: 0.75 }}>
                    <Typography variant="body2">{source.label}</Typography>
                    {source.description ? (
                      <Typography variant="caption" color="text.secondary">
                        {source.description}
                      </Typography>
                    ) : null}
                    {source.available === false ? (
                      <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                        {copy.unavailableSource}
                      </Typography>
                    ) : null}
                  </Box>
                }
              />
            ))}
          </Stack>
        </Box>

        <Box component="fieldset" sx={{ m: 0, p: 0, border: 0 }}>
          <Typography component="legend" variant="subtitle2">
            {copy.consent}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {copy.consentHelp}
          </Typography>
          <Stack sx={{ mt: 0.75 }}>
            {(
              [
                'SOURCE_ACCESS',
                'ANALYSIS',
                'PROPOSAL_DELIVERY',
              ] as const satisfies readonly DwaionRoutineConsent['key'][]
            ).map((key) => (
              <FormControlLabel
                key={key}
                sx={{ minHeight: 44, m: 0 }}
                control={
                  <Checkbox
                    checked={draft.consentKeys.includes(key)}
                    onChange={(_, checked) =>
                      update({
                        consentKeys: checked
                          ? [...draft.consentKeys, key]
                          : draft.consentKeys.filter((value) => value !== key),
                      })
                    }
                  />
                }
                label={copy.consentLabels[key]}
              />
            ))}
          </Stack>
        </Box>

        <Typography component="h3" variant="subtitle1">
          {copy.changeSection}
        </Typography>
        <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Typography variant="subtitle2">{copy.semanticDiff}</Typography>
            <Chip
              size="small"
              color={changeKeys.length ? 'info' : 'default'}
              label={copy.semanticDiffCount.replace('{{count}}', String(changeKeys.length))}
            />
          </Stack>
          {changeKeys.length ? (
            <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
              {changeKeys.map((key) => (
                <Chip key={key} size="small" variant="outlined" label={copy.changeLabels[key]} />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {copy.semanticDiffUnchanged}
            </Typography>
          )}
          <CapabilityEvidence
            label={copy.semanticDiff}
            capability={capabilities?.semanticVersionDiff}
            readyText={copy.capabilityReady}
            availableLabel={copy.capabilityAvailable}
            unavailableLabel={copy.capabilityUnavailable}
            fallback={copy.runtimeActionUnavailable}
            compact
          />
          <ActionButton
            intent="secondary"
            fullWidth
            disabled={!onDryRun || dirty || !capabilities?.dryRunAvailable || busy || dryRunBusy}
            loading={dryRunBusy}
            loadingLabel={copy.dryRunning}
            onClick={onDryRun}
            title={dirty ? copy.dryRunDirtyHelp : undefined}
            sx={{ mt: 1, minHeight: 44 }}
          >
            {copy.dryRunEditor}
          </ActionButton>
          {dirty ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {copy.dryRunDirtyHelp}
            </Typography>
          ) : null}
        </Box>
        <DwaionCapabilityActions
          title={copy.approvalActions}
          description={copy.runtimeActionUnavailable}
          actions={[
            {
              key: 'maker-checker',
              label: copy.makerChecker,
              capability: 'routine.change-approval',
              reason:
                capabilities?.changeApproval.recoveryHint ??
                capabilities?.changeApproval.reasonCode ??
                copy.capabilityReady,
              available: Boolean(
                onRequestChangeApproval &&
                capabilities?.changeApproval.available &&
                capabilities.changeApproval.configured &&
                dirty &&
                errors.length === 0 &&
                !busy &&
                !advancedBusy
              ),
              onClick: onRequestChangeApproval ? () => onRequestChangeApproval(draft) : undefined,
            },
            {
              key: 'engine-switch',
              label: copy.engineSwitch,
              capability: 'routine.agent-switching',
              reason:
                capabilities?.agentSwitching.recoveryHint ??
                capabilities?.agentSwitching.reasonCode ??
                copy.capabilityReady,
              available: Boolean(
                onRequestEngineSwitch &&
                capabilities?.agentSwitching.available &&
                capabilities.agentSwitching.configured &&
                !busy &&
                !advancedBusy
              ),
              onClick: onRequestEngineSwitch,
            },
          ]}
        />
      </Stack>
    </FormDialog>
  );
}

function CapabilityEvidence({
  label,
  value,
  capability,
  readyText,
  availableLabel,
  unavailableLabel,
  fallback,
  compact = false,
}: {
  label: string;
  value?: string;
  capability?: DwaionRoutineProviderCapability;
  readyText: string;
  availableLabel: string;
  unavailableLabel: string;
  fallback: string;
  compact?: boolean;
}) {
  const ready = Boolean(capability?.available && capability.configured);
  return (
    <Box
      sx={{
        mt: compact ? 1 : 0,
        p: 1.25,
        border: 1,
        borderColor: ready ? 'success.main' : 'divider',
        borderRadius: 1.5,
        minWidth: 0,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="subtitle2">{label}</Typography>
        <Chip
          size="small"
          variant="outlined"
          color={ready ? 'success' : 'default'}
          label={ready ? availableLabel : unavailableLabel}
        />
      </Stack>
      {value ? (
        <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
      ) : null}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 0.35, overflowWrap: 'anywhere' }}
      >
        {ready ? readyText : (capability?.recoveryHint ?? capability?.reasonCode ?? fallback)}
      </Typography>
    </Box>
  );
}

function BooleanCapabilityEvidence({
  label,
  available,
  readyText,
  availableLabel,
  unavailableLabel,
  fallback,
}: {
  label: string;
  available: boolean;
  readyText: string;
  availableLabel: string;
  unavailableLabel: string;
  fallback: string;
}) {
  return (
    <CapabilityEvidence
      label={label}
      capability={{
        available,
        configured: available,
        reasonCode: available ? null : 'NOT_CONFIGURED',
        recoveryHint: available ? null : fallback,
      }}
      readyText={readyText}
      availableLabel={availableLabel}
      unavailableLabel={unavailableLabel}
      fallback={fallback}
    />
  );
}
