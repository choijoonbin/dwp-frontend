import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  FileLock2,
  Minus,
  PencilLine,
  Plus,
  RefreshCcw,
  Rocket,
  Trash2,
} from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  FormDialog,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';

import { ApprovalSurface } from './approval-ui';
import {
  approvalDocumentBounds,
  approvalDocumentFlags,
  approvalDocumentFieldCount,
  approvalDocumentFieldTypes,
  approvalDocumentFieldType,
  approvalDocumentNewField,
  approvalDocumentRuleDifferences,
  approvalDocumentRulesValid,
} from './approval-admin-document-model';
import type {
  ApprovalDocumentFieldRule,
  ApprovalDocumentPolicy,
  ApprovalDocumentRules,
} from '@dwp-frontend/shared-utils/api/approval-document-contract';

export type ApprovalDocumentPolicyDraft = Readonly<{
  policyId: string;
  expectedVersion: number;
  idempotencyKey: string;
  rules: ApprovalDocumentRules;
}>;

export function ApprovalAdminDocumentPolicy({
  policy,
  canEdit,
  canPublish,
  makerBlocked,
  busy,
  refreshing,
  draft,
  draftReady,
  onEdit,
  onChange,
  onClose,
  onSave,
  onPublish,
  onRefresh,
}: {
  policy: ApprovalDocumentPolicy;
  canEdit: boolean;
  canPublish: boolean;
  makerBlocked: boolean;
  busy: boolean;
  refreshing: boolean;
  draft: ApprovalDocumentPolicyDraft | null;
  draftReady: boolean;
  onEdit: () => void;
  onChange: (rules: ApprovalDocumentRules) => void;
  onClose: () => void;
  onSave: () => void;
  onPublish: (comment: string, version: number, sha256: string) => boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('approvals');
  const [review, setReview] = useState<{ version: number; sha256: string; text: string } | null>(
    null
  );
  const differences = policy.pending
    ? approvalDocumentRuleDifferences(policy.published.rules, policy.pending.rules)
    : [];
  const reviewReady = Boolean(
    canPublish &&
    !makerBlocked &&
    review &&
    review.version === policy.version &&
    review.sha256 === policy.pending?.sha256
  );
  return (
    <Stack gap={2} minWidth={0}>
      <ApprovalSurface
        title={t('admin.document.title')}
        meta={t('admin.document.description')}
        action={
          <Stack direction="row" gap={0.5}>
            <ActionIconButton
              label={t('admin.document.reloadPolicy')}
              loading={refreshing}
              onClick={onRefresh}
            >
              <RefreshCcw size={16} />
            </ActionIconButton>
            {canEdit ? (
              <ActionIconButton label={t('admin.document.edit')} disabled={busy} onClick={onEdit}>
                <PencilLine size={16} />
              </ActionIconButton>
            ) : null}
          </Stack>
        }
      >
        <Stack gap={2} sx={{ p: 2 }}>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <FileLock2 size={18} />
            <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
              {t('admin.document.scope')}
            </Box>
            <Chip size="small" variant="outlined" label={policy.resourceSetKey} />
            <Chip size="small" label={`v${policy.version}`} />
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) minmax(60px,0.45fr) minmax(60px,0.45fr)',
              gap: 1,
              alignItems: 'center',
            }}
          >
            <Box />
            <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
              {t('admin.document.published')} {policy.published.revision}
            </Box>
            <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
              {t('admin.document.pending')}{' '}
              {policy.pending?.revision ?? t('admin.document.noPending')}
            </Box>
            {[...approvalDocumentFlags, ...approvalDocumentBounds.map(([key]) => key)].map(
              (key) => (
                <Box key={key} sx={{ display: 'contents' }}>
                  <Box
                    sx={{
                      typography: 'body2',
                      overflowWrap: 'anywhere',
                      color: differences.includes(key) ? 'primary.main' : 'text.primary',
                    }}
                  >
                    {t(`admin.document.${key}`)}
                  </Box>
                  {[policy.published.rules[key], policy.pending?.rules[key]].map((value, index) => (
                    <Box key={index} sx={{ textAlign: 'right', typography: 'body2' }}>
                      {typeof value === 'boolean' ? (
                        <Box
                          component="span"
                          role="img"
                          aria-label={t(`admin.document.${value ? 'enabled' : 'disabled'}`)}
                        >
                          {value ? <Check size={16} /> : <Minus size={16} />}
                        </Box>
                      ) : (
                        (value ?? '-')
                      )}
                    </Box>
                  ))}
                </Box>
              )
            )}
          </Box>
          <Box sx={{ typography: 'subtitle2' }}>{t('admin.document.classifications')}</Box>
          {[policy.published, policy.pending].map((revision, index) =>
            revision ? (
              <Stack key={index} gap={0.75}>
                <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                  {t(index ? 'admin.document.pending' : 'admin.document.published')}
                </Box>
                <Stack direction="row" gap={0.75} flexWrap="wrap">
                  {revision.rules.allowedClassifications.length ? (
                    revision.rules.allowedClassifications.map((value) => (
                      <Chip
                        key={value}
                        size="small"
                        variant="outlined"
                        label={t(`classification.${value}`)}
                      />
                    ))
                  ) : (
                    <Box sx={{ typography: 'caption' }}>-</Box>
                  )}
                </Stack>
              </Stack>
            ) : null
          )}
          <Box sx={{ typography: 'subtitle2' }}>{t('admin.document.fields')}</Box>
          {[policy.published, policy.pending].map((revision, index) =>
            revision ? (
              <Stack key={index} gap={0.75}>
                <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                  {t(index ? 'admin.document.pending' : 'admin.document.published')}
                </Box>
                <DocumentFieldReadOnly fields={revision.rules.fields} />
              </Stack>
            ) : null
          )}
          {makerBlocked && policy.pending ? (
            <InlineFeedback severity="warning">{t('admin.document.makerBlocked')}</InlineFeedback>
          ) : null}
          {canPublish && policy.pending ? (
            <ActionButton
              intent="primary"
              disabled={busy || makerBlocked}
              startIcon={<Rocket size={16} />}
              onClick={() =>
                setReview({ version: policy.version, sha256: policy.pending!.sha256, text: '' })
              }
            >
              {t('actions.publish')}
            </ActionButton>
          ) : null}
        </Stack>
      </ApprovalSurface>
      <FormDialog
        open={Boolean(draft)}
        title={t('admin.document.edit')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.save')}
        busy={busy}
        submitDisabled={!draftReady || !draft || !approvalDocumentRulesValid(draft.rules)}
        onClose={onClose}
        onSubmit={onSave}
        maxWidth="md"
        mobileFullScreen
      >
        {draft ? (
          <Stack gap={2}>
            <Chip
              size="small"
              label={`v${draft.expectedVersion}`}
              sx={{ alignSelf: 'flex-start' }}
            />
            {!draftReady ? (
              <InlineFeedback severity="warning">
                {t(
                  draft.expectedVersion !== policy.version
                    ? 'admin.document.versionChanged'
                    : 'admin.document.formDisabled'
                )}
              </InlineFeedback>
            ) : null}
            <Box
              component="fieldset"
              disabled={busy || !draftReady}
              sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}
            >
              <Stack gap={2}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
                    gap: 0.5,
                  }}
                >
                  {approvalDocumentFlags.map((key) => (
                    <FormControlLabel
                      key={key}
                      label={t(`admin.document.${key}`)}
                      control={
                        <Switch
                          checked={draft.rules[key]}
                          onChange={(_, checked) => onChange({ ...draft.rules, [key]: checked })}
                        />
                      }
                    />
                  ))}
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
                    gap: 1.5,
                  }}
                >
                  {approvalDocumentBounds.map(([key, min, max]) => (
                    <FormField
                      key={key}
                      type="number"
                      label={t(`admin.document.${key}`)}
                      value={draft.rules[key]}
                      slotProps={{ htmlInput: { min, max, step: 1 } }}
                      onChange={(event) =>
                        onChange({
                          ...draft.rules,
                          [key]: (event.target as HTMLInputElement).valueAsNumber,
                        })
                      }
                    />
                  ))}
                </Box>
                <Box
                  component="fieldset"
                  sx={{ m: 0, px: 1.5, pb: 1, border: 1, borderColor: 'divider', minWidth: 0 }}
                >
                  <Box component="legend" sx={{ typography: 'caption' }}>
                    {t('admin.document.classifications')}
                  </Box>
                  {['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].map((value) => (
                    <FormControlLabel
                      key={value}
                      label={t(`classification.${value}`)}
                      control={
                        <Checkbox
                          checked={draft.rules.allowedClassifications.includes(value)}
                          onChange={(_, checked) =>
                            onChange({
                              ...draft.rules,
                              allowedClassifications: checked
                                ? [...draft.rules.allowedClassifications, value]
                                : draft.rules.allowedClassifications.filter(
                                    (item) => item !== value
                                  ),
                            })
                          }
                        />
                      }
                    />
                  ))}
                </Box>
                <DocumentFieldEditor
                  fields={draft.rules.fields}
                  depth={0}
                  total={approvalDocumentFieldCount(draft.rules.fields)}
                  disabled={busy || !draftReady}
                  onChange={(fields) => onChange({ ...draft.rules, fields })}
                />
                {!approvalDocumentRulesValid(draft.rules) ? (
                  <InlineFeedback severity="warning">{t('admin.document.invalid')}</InlineFeedback>
                ) : null}
              </Stack>
            </Box>
          </Stack>
        ) : null}
      </FormDialog>
      <FormDialog
        open={Boolean(review)}
        title={t('actions.publish')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.publish')}
        busy={busy}
        submitDisabled={!reviewReady || (review?.text.trim().length ?? 0) < 10}
        onClose={() => setReview(null)}
        onSubmit={() => {
          if (review && onPublish(review.text, review.version, review.sha256)) setReview(null);
        }}
        maxWidth="sm"
        mobileFullScreen
      >
        {!reviewReady ? (
          <InlineFeedback severity="warning">{t('admin.document.formDisabled')}</InlineFeedback>
        ) : null}
        <FormField
          label={t('admin.document.reviewComment')}
          value={review?.text ?? ''}
          multiline
          minRows={3}
          disabled={busy || !reviewReady}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
          onChange={(event) =>
            setReview((value) => value && { ...value, text: event.target.value })
          }
        />
      </FormDialog>
    </Stack>
  );
}

function DocumentFieldReadOnly({ fields }: { fields: readonly ApprovalDocumentFieldRule[] }) {
  const { t } = useTranslation('approvals');
  return fields.length ? (
    <Box component="ul" sx={{ m: 0, pl: 2.5, typography: 'caption' }}>
      {fields.map((field) => (
        <Box component="li" key={field.key} sx={{ py: 0.4, overflowWrap: 'anywhere' }}>
          {field.key} / {t(`admin.document.fieldTypes.${field.type}`)} / {field.maxLength}
          {field.maxRows === null ? '' : ` / ${field.maxRows}`}
          {field.children.length ? <DocumentFieldReadOnly fields={field.children} /> : null}
        </Box>
      ))}
    </Box>
  ) : (
    <InlineFeedback severity="info">{t('admin.document.noFields')}</InlineFeedback>
  );
}

function DocumentFieldEditor({
  fields,
  depth,
  total,
  disabled,
  onChange,
}: {
  fields: readonly ApprovalDocumentFieldRule[];
  depth: number;
  total: number;
  disabled: boolean;
  onChange: (fields: readonly ApprovalDocumentFieldRule[]) => void;
}) {
  const { t } = useTranslation('approvals');
  const [changeType, setChangeType] = useState<{
    index: number;
    type: ApprovalDocumentFieldRule['type'];
  } | null>(null);
  const update = (index: number, field: ApprovalDocumentFieldRule) => {
    if (!disabled) onChange(fields.map((item, i) => (i === index ? field : item)));
  };
  return (
    <Stack gap={1.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Box sx={{ typography: 'subtitle2' }}>{t('admin.document.fields')}</Box>
        <ActionIconButton
          label={t(depth ? 'admin.document.addChild' : 'admin.document.addField')}
          disabled={disabled || total >= 100 || depth > 4}
          onClick={() => {
            if (!disabled) onChange([...fields, approvalDocumentNewField(fields)]);
          }}
        >
          <Plus size={16} />
        </ActionIconButton>
      </Stack>
      {fields.map((field, index) => (
        <Stack
          key={index}
          gap={1}
          sx={{ borderLeft: 2, borderColor: 'divider', pl: 1.5, minWidth: 0 }}
        >
          <Stack direction="row" gap={1} alignItems="flex-start">
            <FormField
              fullWidth
              label={t('admin.document.fieldKey')}
              value={field.key}
              slotProps={{ htmlInput: { maxLength: 80 } }}
              onChange={(event) => update(index, { ...field, key: event.target.value })}
            />
            <ActionIconButton
              label={t('admin.document.removeField')}
              disabled={disabled}
              onClick={() => {
                if (!disabled) onChange(fields.filter((_, i) => i !== index));
              }}
            >
              <Trash2 size={16} />
            </ActionIconButton>
          </Stack>
          <SelectField
            label={t('admin.document.fieldType')}
            value={field.type}
            options={approvalDocumentFieldTypes.map((value) => ({
              value,
              label: t(`admin.document.fieldTypes.${value}`),
            }))}
            onValueChange={(value) => {
              if (disabled) return;
              const type = value as ApprovalDocumentFieldRule['type'];
              if (!approvalDocumentFieldTypes.includes(type)) return;
              if (field.children.length && !['OBJECT', 'OBJECT_LIST'].includes(type))
                setChangeType({ index, type });
              else update(index, approvalDocumentFieldType(field, type));
            }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <FormField
              fullWidth
              type="number"
              label={t('admin.document.maxLength')}
              value={field.maxLength}
              slotProps={{ htmlInput: { min: 1, max: 10000, step: 1 } }}
              onChange={(event) =>
                update(index, {
                  ...field,
                  maxLength: (event.target as HTMLInputElement).valueAsNumber,
                })
              }
            />
            {field.type === 'OBJECT_LIST' ? (
              <FormField
                fullWidth
                type="number"
                label={t('admin.document.maxRows')}
                value={field.maxRows ?? ''}
                slotProps={{ htmlInput: { min: 1, max: 50, step: 1 } }}
                onChange={(event) =>
                  update(index, {
                    ...field,
                    maxRows: (event.target as HTMLInputElement).valueAsNumber,
                  })
                }
              />
            ) : null}
          </Stack>
          {['OBJECT', 'OBJECT_LIST'].includes(field.type) && depth < 4 ? (
            <DocumentFieldEditor
              fields={field.children}
              depth={depth + 1}
              total={total}
              disabled={disabled}
              onChange={(children) => update(index, { ...field, children })}
            />
          ) : null}
        </Stack>
      ))}
      <ConfirmDialog
        open={Boolean(changeType)}
        intent="danger"
        busy={disabled}
        title={t('admin.document.typeChangeTitle')}
        description={t('admin.document.typeChangeDescription')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('admin.document.typeChangeConfirm')}
        onClose={() => setChangeType(null)}
        onConfirm={() => {
          if (changeType && fields[changeType.index])
            update(
              changeType.index,
              approvalDocumentFieldType(fields[changeType.index], changeType.type)
            );
          setChangeType(null);
        }}
      />
    </Stack>
  );
}
