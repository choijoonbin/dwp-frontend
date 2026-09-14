import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCheck, Monitor, Plus, SlidersHorizontal, Smartphone, Trash2 } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  DatePickerField,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';

import { evaluateApprovalTypedForm } from './approval-form-typed-evaluator';
import { ApprovalTypedFieldActions } from './approval-form-builder-typed-actions';
import type {
  ApprovalTypedFormSchema,
  ApprovalTypedScalarField,
} from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';
import type { ApprovalTypedFieldActionHandlers } from './approval-form-builder-typed-actions';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';
import type { ApprovalTypedFieldPath } from './approval-form-builder-typed-model';
import type { ReactNode } from 'react';

export type ApprovalTypedUserPreviewRenderer = (input: {
  field: ApprovalTypedScalarField;
  groupKey?: string;
  path: string;
  label: string;
  supportingText: string;
  mandatory: boolean;
  value: string;
  onChange: (value: string) => void;
}) => ReactNode;

export function ApprovalTypedFormPreview({
  compiled,
  korean: preferredKorean,
  title,
  titleKo,
  titleEn,
  selected,
  actions,
  onSelect,
  onInspect,
  renderUserField,
  canValidateUser,
}: {
  compiled: CompiledApprovalTypedForm;
  korean: boolean;
  title: string;
  titleKo?: string;
  titleEn?: string;
  selected?: ApprovalTypedFieldPath;
  actions?: ApprovalTypedFieldActionHandlers;
  onSelect?: (path: ApprovalTypedFieldPath) => void;
  onInspect?: (path: ApprovalTypedFieldPath) => void;
  renderUserField?: ApprovalTypedUserPreviewRenderer;
  canValidateUser?: (path: string, value: string) => boolean;
}) {
  const { t } = useTranslation('approvals');
  const [raw, setRaw] = useState<Record<string, unknown>>({});
  const [mobile, setMobile] = useState(false);
  const [korean, setKorean] = useState(preferredKorean);
  const [submission, setSubmission] = useState<boolean | null>(null);
  const evaluation = useMemo(() => {
    try {
      return evaluateApprovalTypedForm(compiled, raw, 'DRAFT');
    } catch {
      return null;
    }
  }, [compiled, raw]);
  const change = (key: string, value: unknown) => {
    setRaw((current) => ({ ...current, [key]: value }));
    setSubmission(null);
  };
  return (
    <Box
      component="section"
      aria-label={t('admin.studio.preview')}
      sx={{ minWidth: 0, border: 1, borderColor: 'divider', bgcolor: 'background.default' }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        flexWrap="wrap"
        sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box sx={{ typography: 'subtitle2' }}>{t('admin.studio.preview')}</Box>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mobile ? 'mobile' : 'desktop'}
          onChange={(_, next: string | null) => {
            if (next) setMobile(next === 'mobile');
          }}
          aria-label={t('admin.studio.preview')}
        >
          <Tooltip title={t('admin.studio.previewDesktop')}>
            <ToggleButton value="desktop" aria-label={t('admin.studio.previewDesktop')}>
              <Monitor size={16} />
            </ToggleButton>
          </Tooltip>
          <Tooltip title={t('admin.studio.previewMobile')}>
            <ToggleButton value="mobile" aria-label={t('admin.studio.previewMobile')}>
              <Smartphone size={16} />
            </ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={korean ? 'ko' : 'en'}
          aria-label={t('admin.studio.preview')}
          onChange={(_, next: string | null) => {
            if (next) setKorean(next === 'ko');
          }}
        >
          <ToggleButton value="ko" aria-label={t('admin.studio.previewKorean')}>
            {t('admin.studio.previewKorean')}
          </ToggleButton>
          <ToggleButton value="en" aria-label={t('admin.studio.previewEnglish')}>
            {t('admin.studio.previewEnglish')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Stack
        gap={2}
        sx={{ p: { xs: 1.5, md: 2.5 }, mx: 'auto', maxWidth: mobile ? 390 : 'none', minWidth: 0 }}
      >
        <Box component="h3" sx={{ m: 0, typography: 'subtitle1', overflowWrap: 'anywhere' }}>
          {(korean ? titleKo : titleEn) || title}
        </Box>
        {compiled.definition.fields.map((field) => {
          const visible = evaluation
            ? evaluation.visibleFields.includes(field.key)
            : !field.visibleWhen;
          if (!visible)
            return (
              <Box key={field.key} sx={{ typography: 'caption', color: 'text.secondary' }}>
                {(korean ? field.labelKo : field.labelEn) || field.key} ·{' '}
                {t(evaluation ? 'admin.typedForm.hidden' : 'admin.typedForm.previewInvalid')}
              </Box>
            );
          if (field.type === 'REPEATING_GROUP') {
            const label = (korean ? field.labelKo : field.labelEn) || field.key;
            const duplicateLabel = compiled.definition.fields.some(
              (other) =>
                other.key !== field.key &&
                other.type === 'REPEATING_GROUP' &&
                ((korean ? other.labelKo : other.labelEn) || other.key) === label
            );
            const rows = Array.isArray(raw[field.key])
              ? (raw[field.key] as Record<string, unknown>[])
              : [];
            const normalized = evaluation?.payload[field.key];
            return (
              <Stack
                key={field.key}
                component="section"
                aria-label={duplicateLabel ? `${label} (${field.key})` : label}
                data-approval-typed-canvas-group={field.key}
                gap={1.5}
                sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5 }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  flexWrap="wrap"
                  gap={1}
                >
                  <Box sx={{ typography: 'subtitle2', minWidth: 0, overflowWrap: 'anywhere' }}>
                    {(korean ? field.labelKo : field.labelEn) || field.key}
                  </Box>
                  <Stack direction="row" sx={{ flexWrap: 'wrap', maxWidth: '100%' }}>
                    {actions && selected?.join('.') === field.key ? (
                      <ApprovalTypedFieldActions
                        schema={compiled.definition}
                        path={[field.key]}
                        {...actions}
                      />
                    ) : null}
                    {onInspect ? (
                      <ActionIconButton
                        label={t('admin.typedForm.inspectField')}
                        tooltipDisablePortal
                        onFocus={() => onSelect?.([field.key])}
                        onClick={() => onInspect([field.key])}
                      >
                        <SlidersHorizontal size={16} />
                      </ActionIconButton>
                    ) : null}
                    <ActionIconButton
                      label={t('admin.typedForm.addRow')}
                      tooltipDisablePortal
                      disabled={rows.length >= (field.maxRows ?? 20)}
                      onClick={() => change(field.key, [...rows, {}])}
                    >
                      <Plus size={16} />
                    </ActionIconButton>
                  </Stack>
                </Stack>
                {rows.map((row, index) => (
                  <Stack
                    key={index}
                    gap={1}
                    sx={{ borderLeft: 2, borderColor: 'divider', pl: 1.5 }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box sx={{ typography: 'caption' }}>
                        {t('admin.typedForm.row', { count: index + 1 })}
                      </Box>
                      <ActionIconButton
                        label={t('admin.typedForm.removeRow')}
                        tooltipDisablePortal
                        onClick={() =>
                          change(
                            field.key,
                            rows.filter((_, i) => i !== index)
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </ActionIconButton>
                    </Stack>
                    {field.fields.map((child) => {
                      const path = `${field.key}[${index}].${child.key}`;
                      if (
                        (evaluation && !evaluation.visibleFields.includes(path)) ||
                        (!evaluation && child.visibleWhen)
                      )
                        return null;
                      const output = Array.isArray(normalized)
                        ? (normalized[index] as Record<string, unknown> | undefined)
                        : undefined;
                      return (
                        <TypedPreviewSelection
                          key={child.key}
                          path={[field.key, child.key]}
                          schema={compiled.definition}
                          selected={selected}
                          actions={actions}
                          onSelect={onSelect}
                          onInspect={onInspect}
                        >
                          <TypedPreviewInput
                            key={child.key}
                            field={child}
                            korean={korean}
                            groupKey={field.key}
                            path={path}
                            renderUserField={renderUserField}
                            mandatory={
                              evaluation?.requiredFields.includes(path) ?? Boolean(child.required)
                            }
                            value={
                              child.type === 'CALCULATED_NUMBER'
                                ? output?.[child.key]
                                : row[child.key]
                            }
                            onChange={(value) =>
                              change(
                                field.key,
                                rows.map((item, i) =>
                                  i === index ? { ...item, [child.key]: value } : item
                                )
                              )
                            }
                          />
                        </TypedPreviewSelection>
                      );
                    })}
                  </Stack>
                ))}
              </Stack>
            );
          }
          return (
            <TypedPreviewSelection
              key={field.key}
              path={[field.key]}
              schema={compiled.definition}
              selected={selected}
              actions={actions}
              onSelect={onSelect}
              onInspect={onInspect}
            >
              <TypedPreviewInput
                key={field.key}
                field={field}
                korean={korean}
                renderUserField={renderUserField}
                path={field.key}
                mandatory={
                  evaluation?.requiredFields.includes(field.key) ?? Boolean(field.required)
                }
                value={
                  field.type === 'CALCULATED_NUMBER'
                    ? evaluation?.payload[field.key]
                    : raw[field.key]
                }
                onChange={(value) => change(field.key, value)}
              />
            </TypedPreviewSelection>
          );
        })}
        {!evaluation ? (
          <InlineFeedback severity="warning">{t('admin.typedForm.previewInvalid')}</InlineFeedback>
        ) : null}
        <ActionButton
          intent="secondary"
          startIcon={<CheckCheck size={16} />}
          onClick={() => {
            try {
              const result = evaluateApprovalTypedForm(compiled, raw, 'SUBMIT');
              const fresh = (field: ApprovalTypedScalarField, path: string, value: unknown) =>
                field.type !== 'USER' ||
                !result.visibleFields.includes(path) ||
                !value ||
                !canValidateUser ||
                canValidateUser(path, String(value));
              const usersReady = compiled.definition.fields.every((field) =>
                field.type === 'REPEATING_GROUP'
                  ? ((result.payload[field.key] ?? []) as Record<string, unknown>[]).every(
                      (row, index) =>
                        field.fields.every((child) =>
                          fresh(child, `${field.key}[${index}].${child.key}`, row[child.key])
                        )
                    )
                  : fresh(field, field.key, result.payload[field.key])
              );
              if (!usersReady) {
                setSubmission(false);
                return;
              }
              setSubmission(true);
            } catch {
              setSubmission(false);
            }
          }}
        >
          {t('admin.typedForm.previewValidate')}
        </ActionButton>
        {submission !== null ? (
          <InlineFeedback severity={submission ? 'success' : 'warning'}>
            {t(submission ? 'admin.typedForm.previewValid' : 'admin.typedForm.previewInvalid')}
          </InlineFeedback>
        ) : null}
      </Stack>
    </Box>
  );
}

function TypedPreviewSelection({
  path,
  schema,
  selected,
  actions,
  onSelect,
  onInspect,
  children,
}: {
  path: ApprovalTypedFieldPath;
  schema: ApprovalTypedFormSchema;
  selected?: ApprovalTypedFieldPath;
  actions?: ApprovalTypedFieldActionHandlers;
  onSelect?: (path: ApprovalTypedFieldPath) => void;
  onInspect?: (path: ApprovalTypedFieldPath) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Box
      data-approval-typed-canvas-field={path.join('.')}
      onFocusCapture={() => onSelect?.(path)}
      sx={{
        minWidth: 0,
        p: 1,
        border: 1,
        borderColor: selected?.join('.') === path.join('.') ? 'primary.main' : 'transparent',
      }}
    >
      {onInspect ? (
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ minHeight: 40, mb: 0.5, minWidth: 0 }}
        >
          <Box
            sx={{
              typography: 'caption',
              color: 'text.secondary',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {path.join('.')}
          </Box>
          {actions && selected?.join('.') === path.join('.') ? (
            <ApprovalTypedFieldActions schema={schema} path={path} {...actions} />
          ) : null}
          <ActionIconButton
            label={t('admin.typedForm.inspectField')}
            tooltipDisablePortal
            size="small"
            onClick={() => onInspect(path)}
          >
            <SlidersHorizontal size={14} />
          </ActionIconButton>
        </Stack>
      ) : null}
      {children}
    </Box>
  );
}

function TypedPreviewInput({
  field,
  korean,
  mandatory,
  value,
  onChange,
  groupKey,
  renderUserField,
  path,
}: {
  field: ApprovalTypedScalarField;
  korean: boolean;
  mandatory: boolean;
  value: unknown;
  onChange: (value: string) => void;
  groupKey?: string;
  renderUserField?: ApprovalTypedUserPreviewRenderer;
  path: string;
}) {
  const { t } = useTranslation('approvals');
  const label = (korean ? field.labelKo : field.labelEn) || field.key;
  const string = value == null ? '' : String(value);
  const help = (korean ? field.helpKo : field.helpEn) ?? '';
  if (field.type === 'USER') {
    if (renderUserField)
      return renderUserField({
        field,
        groupKey,
        path,
        label,
        supportingText: help,
        mandatory,
        value: string,
        onChange,
      });
    return (
      <FormField
        size="small"
        label={label}
        value=""
        placeholder={t('admin.typedForm.userDraftPlaceholder')}
        supportingText={[help, t('admin.typedForm.userDraftDescription')].filter(Boolean).join(' ')}
        disabled
        slotProps={{ input: { readOnly: true } }}
      />
    );
  }
  if (field.type === 'DATE')
    return (
      <DatePickerField
        size="small"
        label={mandatory ? `${label} *` : label}
        value={string || null}
        onValueChange={(next) => onChange(next ?? '')}
        supportingText={help}
      />
    );
  if (field.type === 'SELECT')
    return (
      <SelectField
        size="small"
        label={label}
        supportingText={help}
        value={string}
        options={field.options.map((option) => ({ value: option, label: option }))}
        onValueChange={onChange}
        InputLabelProps={{ required: mandatory }}
        inputProps={{ required: false, 'aria-required': mandatory }}
      />
    );
  return (
    <FormField
      size="small"
      label={label}
      supportingText={help}
      value={string}
      type="text"
      multiline={field.type === 'TEXTAREA'}
      minRows={field.type === 'TEXTAREA' ? 3 : undefined}
      slotProps={{
        inputLabel: { required: mandatory },
        input: { readOnly: field.type === 'CALCULATED_NUMBER' },
        htmlInput: {
          'aria-required': mandatory,
          required: false,
          inputMode:
            field.type === 'NUMBER' || field.type === 'CALCULATED_NUMBER' ? 'decimal' : undefined,
        },
      }}
      onChange={(event) => {
        if (field.type !== 'CALCULATED_NUMBER') onChange(event.target.value);
      }}
    />
  );
}
