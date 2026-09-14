import { useTranslation } from 'react-i18next';
import { RefreshCcw, ShieldCheck } from 'lucide-react';
import {
  ActionIconButton,
  FormDialog,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';

import { ApprovalPolicyComparison } from './approval-policy-comparison';
import { isApprovalPolicyDraftValid } from './approval-policy-model';

import type { ApprovalPolicyDraft, ApprovalPolicyRuleEditorEntry } from './approval-policy-model';
import type { ApprovalPolicy } from '@dwp-frontend/shared-utils';

const ENFORCEMENT_OPTIONS = ['BLOCK', 'WARN', 'MONITOR'].map((value) => ({
  value,
  label: value,
}));
const SEVERITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => ({
  value,
  label: value,
}));
const LIFECYCLE_OPTIONS = ['ACTIVE', 'DISABLED', 'RETIRED'].map((value) => ({
  value,
  label: value,
}));

export function ApprovalPolicyEditorDialog({
  open,
  draft,
  busy,
  sourceReady = true,
  onRefreshSource,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  draft: ApprovalPolicyDraft | null;
  busy: boolean;
  sourceReady?: boolean;
  onRefreshSource?: () => void;
  onChange: (draft: ApprovalPolicyDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation('approvals');
  if (!draft) return null;

  const updateRule = (index: number, value: unknown) => {
    onChange({
      ...draft,
      rules: draft.rules.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, value } : entry
      ),
    });
  };

  return (
    <FormDialog
      open={open}
      title={t('admin.studio.configurePolicy')}
      description={t('admin.studio.policyChangeNotice')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.save')}
      busy={busy}
      submitDisabled={!sourceReady || !isApprovalPolicyDraftValid(draft)}
      onClose={onClose}
      onSubmit={onSave}
      secondaryActions={
        onRefreshSource && (
          <ActionIconButton label={t('actions.refresh')} disabled={busy} onClick={onRefreshSource}>
            <RefreshCcw size={16} />
          </ActionIconButton>
        )
      }
      maxWidth="md"
      mobileFullScreen
    >
      <Stack gap={2}>
        {!sourceReady && (
          <InlineFeedback severity="warning">
            {t('admin.studio.policySourceChanged')}
          </InlineFeedback>
        )}
        <InlineFeedback severity="warning" icon={<ShieldCheck size={18} />}>
          {t('admin.studio.policyReviewNotice')}
        </InlineFeedback>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(3,minmax(0,1fr))' },
            gap: 1.25,
          }}
        >
          <SelectField
            label={t('admin.studio.enforcement')}
            value={draft.enforcementMode}
            options={ENFORCEMENT_OPTIONS}
            onValueChange={(value) => value && onChange({ ...draft, enforcementMode: value })}
          />
          <SelectField
            label={t('admin.studio.severity')}
            value={draft.severity}
            options={SEVERITY_OPTIONS}
            onValueChange={(value) => value && onChange({ ...draft, severity: value })}
          />
          <SelectField
            label={t('admin.studio.lifecycle')}
            value={draft.lifecycleState}
            options={LIFECYCLE_OPTIONS}
            onValueChange={(value) => value && onChange({ ...draft, lifecycleState: value })}
          />
        </Box>

        <Box component="h3" sx={{ m: 0, typography: 'subtitle2' }}>
          {t('admin.studio.ruleTitle')}
        </Box>
        <Stack gap={1.25}>
          {draft.rules.map((entry, index) => (
            <ApprovalPolicyRuleEditor
              key={entry.key}
              entry={entry}
              onChange={(value) => updateRule(index, value)}
            />
          ))}
        </Stack>
        <FormField
          label={t('admin.studio.changeReason')}
          value={draft.changeReason}
          onChange={(event) => onChange({ ...draft, changeReason: event.target.value })}
          multiline
          minRows={3}
          required
          supportingText={t('admin.studio.changeReasonHelp')}
        />
      </Stack>
    </FormDialog>
  );
}

function ApprovalPolicyRuleEditor({
  entry,
  onChange,
}: {
  entry: ApprovalPolicyRuleEditorEntry;
  onChange: (value: unknown) => void;
}) {
  const { t } = useTranslation('approvals');
  if (entry.kind === 'boolean') {
    return (
      <Box sx={{ p: 1.25, border: 1, borderColor: 'divider' }}>
        <FormControlLabel
          control={
            <Switch
              checked={entry.value === true}
              onChange={(_, checked) => onChange(checked)}
              inputProps={{ 'aria-label': entry.key }}
            />
          }
          label={entry.key}
        />
      </Box>
    );
  }

  const structured = entry.kind === 'structured';
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'minmax(180px,.7fr) minmax(0,1.3fr)' },
        gap: 1.25,
      }}
    >
      <FormField label={t('admin.studio.ruleKey')} value={entry.key} disabled />
      <FormField
        label={t('admin.studio.ruleValue')}
        value={
          structured
            ? JSON.stringify(entry.value)
            : entry.kind === 'number' && !Number.isFinite(entry.value)
              ? ''
              : String(entry.value ?? '')
        }
        type={entry.kind === 'number' ? 'number' : 'text'}
        disabled={structured}
        multiline={structured}
        minRows={structured ? 2 : undefined}
        onChange={(event) =>
          onChange(entry.kind === 'number' ? Number(event.target.value) : event.target.value)
        }
      />
    </Box>
  );
}

export function ApprovalPolicyReviewDialog({
  open,
  policy,
  reviewComment,
  busy,
  sourceReady = true,
  onRefreshSource,
  onReviewCommentChange,
  onClose,
  onPublish,
}: {
  open: boolean;
  policy: ApprovalPolicy | null;
  reviewComment: string;
  busy: boolean;
  sourceReady?: boolean;
  onRefreshSource?: () => void;
  onReviewCommentChange: (value: string) => void;
  onClose: () => void;
  onPublish: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <FormDialog
      open={open}
      title={t('admin.studio.reviewAndPublish')}
      description={t('admin.studio.pendingMeta')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('admin.studio.publishPolicy')}
      submittingLabel={t('admin.studio.publishPolicy')}
      busy={busy}
      submitDisabled={!sourceReady || !policy || reviewComment.trim().length < 10}
      onClose={onClose}
      onSubmit={onPublish}
      secondaryActions={
        onRefreshSource && (
          <ActionIconButton label={t('actions.refresh')} disabled={busy} onClick={onRefreshSource}>
            <RefreshCcw size={16} />
          </ActionIconButton>
        )
      }
      maxWidth="md"
      mobileFullScreen
    >
      <Stack gap={2}>
        {!sourceReady && (
          <InlineFeedback severity="warning">
            {t('admin.studio.policySourceChanged')}
          </InlineFeedback>
        )}
        <InlineFeedback severity="warning" icon={<ShieldCheck size={18} />}>
          {t('admin.studio.makerCheckerNotice')}
        </InlineFeedback>
        <Box sx={{ typography: 'body2' }}>{policy?.pendingChangeReason}</Box>
        {policy ? <ApprovalPolicyComparison policy={policy} /> : null}
        <FormField
          label={t('admin.studio.reviewComment')}
          value={reviewComment}
          onChange={(event) => onReviewCommentChange(event.target.value)}
          multiline
          minRows={3}
          required
          supportingText={t('admin.studio.reviewCommentHelp')}
        />
      </Stack>
    </FormDialog>
  );
}
