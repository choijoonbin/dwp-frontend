import { useTranslation } from 'react-i18next';
import { PencilLine, Plus, RefreshCcw, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import {
  APPROVAL_POLICY_CREATE_ENFORCEMENT_MODES,
  APPROVAL_POLICY_CREATE_LIFECYCLE_STATES,
  APPROVAL_POLICY_CREATE_RULE_KINDS,
  APPROVAL_POLICY_CREATE_SEVERITIES,
  APPROVAL_POLICY_CREATE_TYPES,
  approvalPolicyCreateIssue,
  newApprovalPolicyCreateRule,
} from './approval-policy-create-model';

import type { ApprovalPolicyCreateProblem } from './use-approval-policy-create';
import type {
  ApprovalPolicyCreateDraft,
  ApprovalPolicyCreateRuleDraft,
  ApprovalPolicyCreateValidation,
} from './approval-policy-create-model';

function option(value: string, label: React.ReactNode = value) {
  return { value, label };
}

export function ApprovalPolicyCreateDialog({
  open,
  draft,
  validation,
  problem,
  busy,
  locked,
  canSubmit,
  canRetry,
  canEditPreserved,
  onChange,
  onClose,
  onSubmit,
  onRetryOriginal,
  onEditPreserved,
  onRefreshSource,
}: {
  open: boolean;
  draft: ApprovalPolicyCreateDraft;
  validation: ApprovalPolicyCreateValidation;
  problem: ApprovalPolicyCreateProblem | null;
  busy: boolean;
  locked: boolean;
  canSubmit: boolean;
  canRetry: boolean;
  canEditPreserved: boolean;
  onChange: (draft: ApprovalPolicyCreateDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
  onRetryOriginal: () => void;
  onEditPreserved: () => void;
  onRefreshSource: () => void | Promise<void>;
}) {
  const { t } = useTranslation('approvals');
  const error = (path: string) => {
    const code = approvalPolicyCreateIssue(validation, path);
    return code ? t(`admin.policyCreate.validation.${code}`) : undefined;
  };
  const updateRule = (id: string, next: ApprovalPolicyCreateRuleDraft) => {
    onChange({
      ...draft,
      rules: draft.rules.map((entry) => (entry.id === id ? next : entry)),
    });
  };

  return (
    <FormDialog
      open={open}
      title={t('admin.policyCreate.title')}
      description={t('admin.policyCreate.description')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.saveDraft')}
      submittingLabel={t('admin.policyCreate.saving')}
      busy={busy}
      submitDisabled={!canSubmit}
      onClose={onClose}
      onSubmit={onSubmit}
      secondaryActions={
        <Stack direction="row" gap={0.5} flexWrap="wrap">
          <ActionIconButton
            label={t('actions.refresh')}
            disabled={busy}
            onClick={() => void onRefreshSource()}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <RefreshCcw size={17} />
          </ActionIconButton>
          {problem ? (
            <ActionButton
              intent="secondary"
              startIcon={<RotateCcw size={17} />}
              disabled={!canRetry}
              onClick={onRetryOriginal}
            >
              {t('admin.policyCreate.retryOriginal')}
            </ActionButton>
          ) : null}
          {canEditPreserved ? (
            <ActionButton
              intent="quiet"
              startIcon={<PencilLine size={17} />}
              disabled={busy}
              onClick={onEditPreserved}
            >
              {t('admin.policyCreate.editPreserved')}
            </ActionButton>
          ) : null}
        </Stack>
      }
      maxWidth="md"
      mobileFullScreen
    >
      <Stack gap={2} minWidth={0}>
        <InlineFeedback severity="info" icon={<ShieldCheck size={18} />}>
          {t('admin.policyCreate.makerChecker')}
        </InlineFeedback>
        {locked ? (
          <InlineFeedback severity="warning">
            {t('admin.policyCreate.originalLocked')}
          </InlineFeedback>
        ) : null}
        {problem ? (
          <InlineFeedback severity={problem === 'UNKNOWN' ? 'warning' : 'error'}>
            {t(`admin.policyCreate.feedback.${problem}`)}
          </InlineFeedback>
        ) : null}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
            gap: 1.5,
          }}
        >
          <FormField
            label={t('admin.policyCreate.policyKey')}
            value={draft.policyKey}
            disabled={locked}
            required
            inputProps={{ maxLength: 100 }}
            errorMessage={draft.policyKey ? error('policyKey') : undefined}
            supportingText={t('admin.policyCreate.policyKeyHelp')}
            onChange={(event) =>
              onChange({ ...draft, policyKey: event.target.value.toUpperCase() })
            }
          />
          <SelectField
            label={t('admin.policyCreate.policyType')}
            value={draft.policyType}
            disabled={locked}
            options={APPROVAL_POLICY_CREATE_TYPES.map((value) =>
              option(value, t(`admin.studio.policyTypes.${value}`))
            )}
            onValueChange={(value) =>
              value &&
              onChange({
                ...draft,
                policyType: value as ApprovalPolicyCreateDraft['policyType'],
              })
            }
          />
          <FormField
            label={t('admin.studio.nameKo')}
            value={draft.nameKo}
            disabled={locked}
            required
            inputProps={{ maxLength: 200 }}
            errorMessage={draft.nameKo ? error('nameKo') : undefined}
            onChange={(event) => onChange({ ...draft, nameKo: event.target.value })}
          />
          <FormField
            label={t('admin.studio.nameEn')}
            value={draft.nameEn}
            disabled={locked}
            required
            inputProps={{ maxLength: 200 }}
            errorMessage={draft.nameEn ? error('nameEn') : undefined}
            onChange={(event) => onChange({ ...draft, nameEn: event.target.value })}
          />
          <SelectField
            label={t('admin.studio.enforcement')}
            value={draft.enforcementMode}
            disabled={locked}
            options={APPROVAL_POLICY_CREATE_ENFORCEMENT_MODES.map((value) =>
              option(value, t(`admin.studio.enforcementModes.${value}`))
            )}
            onValueChange={(value) =>
              value &&
              onChange({
                ...draft,
                enforcementMode: value as ApprovalPolicyCreateDraft['enforcementMode'],
              })
            }
          />
          <SelectField
            label={t('admin.studio.severity')}
            value={draft.severity}
            disabled={locked}
            options={APPROVAL_POLICY_CREATE_SEVERITIES.map((value) =>
              option(value, t(`admin.studio.severities.${value}`))
            )}
            onValueChange={(value) =>
              value &&
              onChange({
                ...draft,
                severity: value as ApprovalPolicyCreateDraft['severity'],
              })
            }
          />
          <SelectField
            label={t('admin.studio.lifecycle')}
            value={draft.lifecycleState}
            disabled={locked}
            options={APPROVAL_POLICY_CREATE_LIFECYCLE_STATES.map((value) =>
              option(value, t(`status.${value}`))
            )}
            onValueChange={(value) =>
              value &&
              onChange({
                ...draft,
                lifecycleState: value as ApprovalPolicyCreateDraft['lifecycleState'],
              })
            }
          />
        </Box>

        <Box component="section" aria-labelledby="approval-policy-create-rules">
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Box
              component="h3"
              id="approval-policy-create-rules"
              sx={{ m: 0, typography: 'subtitle2' }}
            >
              {t('admin.studio.ruleTitle')}
            </Box>
            <ActionIconButton
              label={t('admin.policyCreate.addRule')}
              disabled={locked || draft.rules.length >= 64}
              onClick={() =>
                onChange({ ...draft, rules: [...draft.rules, newApprovalPolicyCreateRule()] })
              }
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <Plus size={17} />
            </ActionIconButton>
          </Stack>
          {error('rules') ? (
            <Box role="alert" sx={{ mt: 0.5, typography: 'caption', color: 'error.main' }}>
              {error('rules')}
            </Box>
          ) : null}
          <Stack component="ol" gap={1.25} sx={{ m: 0, mt: 1, p: 0, listStyle: 'none' }}>
            {draft.rules.map((entry, index) => (
              <ApprovalPolicyCreateRuleRow
                key={entry.id}
                entry={entry}
                ordinal={index + 1}
                locked={locked}
                keyError={error(`rules.${entry.id}.key`)}
                valueError={error(`rules.${entry.id}.value`)}
                onChange={(next) => updateRule(entry.id, next)}
                onRemove={() =>
                  onChange({
                    ...draft,
                    rules: draft.rules.filter((candidate) => candidate.id !== entry.id),
                  })
                }
              />
            ))}
          </Stack>
        </Box>

        <FormField
          label={t('admin.studio.changeReason')}
          value={draft.changeReason}
          disabled={locked}
          required
          multiline
          minRows={3}
          inputProps={{ maxLength: 1000 }}
          errorMessage={draft.changeReason ? error('changeReason') : undefined}
          supportingText={t('admin.studio.changeReasonHelp')}
          onChange={(event) => onChange({ ...draft, changeReason: event.target.value })}
        />
      </Stack>
    </FormDialog>
  );
}

function ApprovalPolicyCreateRuleRow({
  entry,
  ordinal,
  locked,
  keyError,
  valueError,
  onChange,
  onRemove,
}: {
  entry: ApprovalPolicyCreateRuleDraft;
  ordinal: number;
  locked: boolean;
  keyError?: React.ReactNode;
  valueError?: React.ReactNode;
  onChange: (entry: ApprovalPolicyCreateRuleDraft) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Box
      component="li"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0,1fr) 44px',
          sm: 'minmax(150px,.7fr) minmax(120px,.45fr) minmax(0,1fr) 44px',
        },
        gap: 1,
        alignItems: 'start',
        p: 1.25,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <FormField
        label={t('admin.policyCreate.ruleKey', { count: ordinal })}
        value={entry.key}
        disabled={locked}
        required
        inputProps={{ maxLength: 80 }}
        errorMessage={entry.key ? keyError : undefined}
        onChange={(event) => onChange({ ...entry, key: event.target.value })}
      />
      <SelectField
        label={t('admin.policyCreate.ruleKind')}
        value={entry.kind}
        disabled={locked}
        options={APPROVAL_POLICY_CREATE_RULE_KINDS.map((value) =>
          option(value, t(`admin.policyCreate.ruleKinds.${value}`))
        )}
        onValueChange={(value) => {
          if (!value) return;
          const kind = value as ApprovalPolicyCreateRuleDraft['kind'];
          onChange({
            ...entry,
            kind,
            value: kind === 'BOOLEAN' ? 'true' : kind === 'JSON' ? '{}' : '',
          });
        }}
        sx={{ gridColumn: { xs: 1, sm: 'auto' } }}
      />
      {entry.kind === 'BOOLEAN' ? (
        <SelectField
          label={t('admin.studio.ruleValue')}
          value={entry.value}
          disabled={locked}
          options={[option('true'), option('false')]}
          errorMessage={valueError}
          onValueChange={(value) => value && onChange({ ...entry, value: String(value) })}
          sx={{ gridColumn: { xs: 1, sm: 'auto' } }}
        />
      ) : (
        <FormField
          label={t('admin.studio.ruleValue')}
          value={entry.value}
          disabled={locked}
          required={entry.kind !== 'STRING'}
          type={entry.kind === 'INTEGER' ? 'text' : undefined}
          inputMode={entry.kind === 'INTEGER' ? 'numeric' : undefined}
          multiline={entry.kind === 'JSON'}
          minRows={entry.kind === 'JSON' ? 2 : undefined}
          errorMessage={entry.value ? valueError : undefined}
          onChange={(event) => onChange({ ...entry, value: event.target.value })}
          sx={{ gridColumn: { xs: 1, sm: 'auto' } }}
        />
      )}
      <ActionIconButton
        label={t('admin.policyCreate.removeRule', { count: ordinal })}
        intent="danger"
        disabled={locked}
        onClick={onRemove}
        sx={{ minWidth: 44, minHeight: 44, gridColumn: 2, gridRow: { xs: 1, sm: 'auto' } }}
      >
        <Trash2 size={17} />
      </ActionIconButton>
    </Box>
  );
}
