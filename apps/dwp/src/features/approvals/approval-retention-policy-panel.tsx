import { useTranslation } from 'react-i18next';
import { PencilLine, RefreshCcw, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import type {
  ApprovalRetentionPolicy,
  ApprovalRetentionRules,
} from '@dwp-frontend/shared-utils/api/approval-retention-contract';
import { readApprovalRetentionRules } from '@dwp-frontend/shared-utils/api/approval-retention-contract';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { ApprovalSurface } from './approval-ui';

const numericFields = [
  ['recordRetentionDays', 3650],
  ['deletedDraftRecoveryDays', 3650],
  ['receiptRetentionDays', 3650],
  ['holdEvidenceRetentionDays', 3650],
  ['auditEvidenceRetentionDays', 3650],
  ['maxInventoryRows', 50000],
  ['maxObjectsPerRecord', 1000],
] as const;
export type ApprovalRetentionPolicyEditor = {
  original: Readonly<ApprovalRetentionPolicy>;
  rules: Readonly<ApprovalRetentionRules>;
  attempt?: Readonly<{ idempotencyKey: string; rules: Readonly<ApprovalRetentionRules> }>;
};
export type ApprovalRetentionPolicyReview = {
  original: Readonly<ApprovalRetentionPolicy>;
  comment: string;
};

export function ApprovalRetentionPolicyPanel({
  policy,
  ready,
  canEdit,
  canPublish,
  busy,
  blocked = false,
  onRefresh,
  onSave,
  onPublish,
  editor,
  onEditorChange,
  review,
  onReviewChange,
}: {
  policy: Readonly<ApprovalRetentionPolicy>;
  ready: boolean;
  canEdit: boolean;
  canPublish: boolean;
  busy: boolean;
  blocked?: boolean;
  onRefresh: () => void;
  onSave: (
    rules: Readonly<ApprovalRetentionRules>,
    original: Readonly<ApprovalRetentionPolicy>
  ) => Promise<void>;
  onPublish: (comment: string, original: Readonly<ApprovalRetentionPolicy>) => Promise<boolean>;
  editor: ApprovalRetentionPolicyEditor | null;
  onEditorChange: (editor: ApprovalRetentionPolicyEditor | null) => void;
  review: ApprovalRetentionPolicyReview | null;
  onReviewChange: (review: ApprovalRetentionPolicyReview | null) => void;
}) {
  const { t } = useTranslation('approvals');
  const setEditor = onEditorChange;
  const setReview = onReviewChange;
  const sourceCurrent = (original: Readonly<ApprovalRetentionPolicy>) =>
    ready &&
    original.policyId === policy.policyId &&
    original.version === policy.version &&
    original.resourceSetKey === policy.resourceSetKey &&
    original.pendingRulesSha256 === policy.pendingRulesSha256;
  let valid = false;
  try {
    if (editor) {
      readApprovalRetentionRules(editor.rules);
      valid = true;
    }
  } catch {
    /* Invalid numeric input remains editable. */
  }
  return (
    <ApprovalSurface
      title={t('admin.retention.policyTitle')}
      meta={policy.resourceSetKey}
      action={
        <Stack direction="row" gap={0.5}>
          <ActionIconButton
            label={t('actions.refresh')}
            onClick={onRefresh}
            disabled={busy || blocked}
          >
            <RefreshCcw size={16} />
          </ActionIconButton>
          {canEdit ? (
            <ActionIconButton
              label={t('admin.retention.edit')}
              disabled={!ready || busy || blocked}
              onClick={() =>
                setEditor({ original: policy, rules: policy.pending ?? policy.published })
              }
            >
              <PencilLine size={16} />
            </ActionIconButton>
          ) : null}
        </Stack>
      }
    >
      <Stack gap={1.5} sx={{ p: 2 }}>
        <InlineFeedback severity="warning">{t('admin.retention.runtimeBlocked')}</InlineFeedback>
        <Box
          component="dl"
          sx={{ m: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 1 }}
        >
          <Box component="dt" sx={{ typography: 'caption' }}>
            {t('admin.retention.publishedRevision')}
          </Box>
          <Box component="dd" sx={{ m: 0, typography: 'body2' }}>
            {policy.publishedRevision}
          </Box>
          <Box component="dt" sx={{ typography: 'caption' }}>
            {t('admin.retention.proposedRevision')}
          </Box>
          <Box component="dd" sx={{ m: 0, typography: 'body2' }}>
            {policy.pendingRevision ?? t('admin.retention.none')}
          </Box>
          {numericFields.map(([key]) => (
            <Box key={key} sx={{ display: 'contents' }}>
              <Box component="dt" sx={{ typography: 'caption', overflowWrap: 'anywhere' }}>
                {t(`admin.retention.fields.${key}`)}
              </Box>
              <Box component="dd" sx={{ m: 0, typography: 'body2', textAlign: 'right' }}>
                {policy.published[key]}
                {policy.pending && policy.pending[key] !== policy.published[key]
                  ? ` → ${policy.pending[key]}`
                  : ''}
              </Box>
            </Box>
          ))}
        </Box>
        <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
          {t('admin.retention.policyDigest')} · {policy.publishedRulesSha256}
        </Box>
        {policy.pending ? (
          <>
            <InlineFeedback severity={canPublish ? 'info' : 'warning'}>
              {t(canPublish ? 'admin.retention.independentReview' : 'admin.retention.makerBlocked')}
            </InlineFeedback>
            <ActionButton
              startIcon={<ShieldCheck size={16} />}
              disabled={!ready || !canPublish || busy || blocked}
              onClick={() => setReview({ original: policy, comment: '' })}
            >
              {t('admin.retention.reviewPublish')}
            </ActionButton>
          </>
        ) : null}
      </Stack>
      <FormDialog
        open={editor != null}
        cancelLabel={t('actions.cancel')}
        title={t('admin.retention.edit')}
        submitLabel={t('admin.retention.saveDraft')}
        busy={busy}
        submitDisabled={
          !editor || !sourceCurrent(editor.original) || !canEdit || !valid || busy || blocked
        }
        onClose={() => {
          if (!busy) setEditor(null);
        }}
        onSubmit={() => {
          if (editor && sourceCurrent(editor.original) && valid && canEdit && !busy && !blocked)
            void onSave(editor.rules, editor.original)
              .then(() => setEditor(null))
              .catch(() => undefined);
        }}
        mobileFullScreen
      >
        {editor ? (
          <Stack gap={2}>
            {editor.attempt && !busy ? (
              <InlineFeedback severity="warning">
                {t('admin.retention.originalAttempt')}
              </InlineFeedback>
            ) : null}
            {!sourceCurrent(editor.original) ? (
              <InlineFeedback severity="warning">
                {t('admin.retention.sourceChanged')}
              </InlineFeedback>
            ) : null}
            <FormControlLabel
              label={t('admin.retention.allowPurge')}
              control={
                <Switch
                  checked={editor.rules.allowPurge}
                  disabled={
                    busy || blocked || !sourceCurrent(editor.original) || editor.attempt != null
                  }
                  onChange={(_, allowPurge) =>
                    setEditor({ ...editor, rules: { ...editor.rules, allowPurge } })
                  }
                />
              }
            />
            <InlineFeedback severity="warning">
              {t('admin.retention.intentNotDeletion')}
            </InlineFeedback>
            <Box
              component="fieldset"
              disabled={
                busy || blocked || !sourceCurrent(editor.original) || editor.attempt != null
              }
              sx={{ p: 0, m: 0, border: 0, minWidth: 0 }}
            >
              <Stack gap={2}>
                {numericFields.map(([key, max]) => (
                  <FormField
                    key={key}
                    label={t(`admin.retention.fields.${key}`)}
                    type="number"
                    value={editor.rules[key]}
                    slotProps={{ htmlInput: { min: 1, max, step: 1 } }}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        rules: {
                          ...editor.rules,
                          [key]: (event.target as HTMLInputElement).valueAsNumber,
                        },
                      })
                    }
                  />
                ))}
                {(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const).map((classification) => (
                  <FormControlLabel
                    key={classification}
                    label={t(`admin.retention.classifications.${classification}`)}
                    control={
                      <Checkbox
                        checked={editor.rules.allowedClassifications.includes(classification)}
                        onChange={(_, checked) =>
                          setEditor({
                            ...editor,
                            rules: {
                              ...editor.rules,
                              allowedClassifications: checked
                                ? [...editor.rules.allowedClassifications, classification]
                                : editor.rules.allowedClassifications.filter(
                                    (value) => value !== classification
                                  ),
                            },
                          })
                        }
                      />
                    }
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
        ) : null}
      </FormDialog>
      <FormDialog
        open={review != null}
        cancelLabel={t('actions.cancel')}
        title={t('admin.retention.reviewPublish')}
        submitLabel={t('admin.retention.reviewPublish')}
        busy={busy}
        submitDisabled={
          !review ||
          !sourceCurrent(review.original) ||
          !canPublish ||
          review.comment.trim().length < 10 ||
          busy ||
          blocked
        }
        onClose={() => {
          if (!busy) setReview(null);
        }}
        onSubmit={() => {
          if (review && sourceCurrent(review.original) && canPublish && !busy && !blocked) {
            const original = review.original;
            const comment = review.comment;
            void onPublish(comment, original).then((accepted) => {
              if (accepted) setReview(null);
            });
          }
        }}
        mobileFullScreen
      >
        <InlineFeedback severity="warning">{t('admin.retention.independentReview')}</InlineFeedback>
        <FormField
          label={t('admin.retention.reviewComment')}
          multiline
          minRows={3}
          value={review?.comment ?? ''}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
          disabled={busy || blocked || !review || !sourceCurrent(review.original)}
          onChange={(event) => {
            if (review) setReview({ ...review, comment: event.target.value });
          }}
        />
      </FormDialog>
    </ApprovalSurface>
  );
}
