import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberSoftSurface } from './workplace-member-surfaces';

export type WorkplaceServiceOptionRow = Readonly<{
  rowId: string;
  key: string;
  labelKo: string;
  labelEn: string;
  type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SINGLE_SELECT' | 'MULTI_SELECT';
  required: boolean;
  valuesText: string;
  minimumText: string;
  maximumText: string;
  defaultValueText: string;
}>;

const optionTypes: readonly WorkplaceServiceOptionRow['type'][] = [
  'TEXT',
  'NUMBER',
  'BOOLEAN',
  'SINGLE_SELECT',
  'MULTI_SELECT',
];

function record(value: Readonly<Record<string, unknown>>, key: string) {
  return value[key];
}

function optionRow(
  value: Readonly<Record<string, unknown>> = {},
  rowId = crypto.randomUUID()
): WorkplaceServiceOptionRow {
  const type = record(value, 'type');
  const values = record(value, 'values');
  const defaultValue = record(value, 'defaultValue');
  return {
    rowId,
    key: typeof record(value, 'key') === 'string' ? String(record(value, 'key')) : '',
    labelKo: typeof record(value, 'labelKo') === 'string' ? String(record(value, 'labelKo')) : '',
    labelEn: typeof record(value, 'labelEn') === 'string' ? String(record(value, 'labelEn')) : '',
    type: optionTypes.includes(type as WorkplaceServiceOptionRow['type'])
      ? (type as WorkplaceServiceOptionRow['type'])
      : 'TEXT',
    required: record(value, 'required') === true,
    valuesText: Array.isArray(values)
      ? values.filter((item): item is string => typeof item === 'string').join(', ')
      : '',
    minimumText:
      typeof record(value, 'minimum') === 'number' ? String(record(value, 'minimum')) : '',
    maximumText:
      typeof record(value, 'maximum') === 'number' ? String(record(value, 'maximum')) : '',
    defaultValueText:
      defaultValue === undefined || defaultValue === null
        ? ''
        : Array.isArray(defaultValue)
          ? defaultValue.join(', ')
          : String(defaultValue),
  };
}

export function workplaceServiceOptionRows(
  schema: readonly Readonly<Record<string, unknown>>[]
): readonly WorkplaceServiceOptionRow[] {
  return schema.map((value, index) => optionRow(value, `option-${index}-${crypto.randomUUID()}`));
}

function finite(value: string): number | null | undefined {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function defaultValue(row: WorkplaceServiceOptionRow, values: readonly string[]) {
  const value = row.defaultValueText.trim();
  if (!value) return undefined;
  if (row.type === 'NUMBER') return finite(value);
  if (row.type === 'BOOLEAN') {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
  }
  if (row.type === 'MULTI_SELECT') {
    const selected = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return selected.every((item) => values.includes(item)) ? selected : null;
  }
  if (row.type === 'SINGLE_SELECT') return values.includes(value) ? value : null;
  return value;
}

export function workplaceServiceOptionSchema(
  rows: readonly WorkplaceServiceOptionRow[]
): readonly Readonly<Record<string, unknown>>[] | null {
  if (rows.length > 30) return null;
  const keys = new Set<string>();
  const result: Readonly<Record<string, unknown>>[] = [];
  for (const row of rows) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/u.test(row.key) || keys.has(row.key)) return null;
    if (!row.labelKo.trim() || !row.labelEn.trim()) return null;
    keys.add(row.key);
    const values = row.valuesText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (new Set(values).size !== values.length) return null;
    if (row.type.endsWith('SELECT') && (!values.length || values.length > 100)) return null;
    const minimum = finite(row.minimumText);
    const maximum = finite(row.maximumText);
    if (minimum === undefined || maximum === undefined) return null;
    if (row.type === 'NUMBER' && minimum !== null && maximum !== null && minimum > maximum) {
      return null;
    }
    const initial = defaultValue(row, values);
    if (initial === null || (initial === undefined && row.defaultValueText.trim())) return null;
    result.push({
      key: row.key,
      labelKo: row.labelKo.trim(),
      labelEn: row.labelEn.trim(),
      type: row.type,
      required: row.required,
      ...(row.type.endsWith('SELECT') ? { values } : {}),
      ...(row.type === 'NUMBER' && minimum !== null ? { minimum } : {}),
      ...(row.type === 'NUMBER' && maximum !== null ? { maximum } : {}),
      ...(initial === undefined ? {} : { defaultValue: initial }),
    });
  }
  return result;
}

export function WorkplaceServiceOptionSchemaEditor({
  rows,
  onChange,
  disabled,
  kind = 'option',
}: {
  rows: readonly WorkplaceServiceOptionRow[];
  onChange: (rows: readonly WorkplaceServiceOptionRow[]) => void;
  disabled: boolean;
  kind?: 'option' | 'inspection';
}) {
  const { t } = useTranslation('rooms');
  const valid = workplaceServiceOptionSchema(rows) !== null;
  const patch = (rowId: string, values: Partial<WorkplaceServiceOptionRow>) =>
    onChange(rows.map((row) => (row.rowId === rowId ? { ...row, ...values } : row)));
  const move = (index: number, offset: number) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= rows.length) return;
    const next = [...rows];
    const [row] = next.splice(index, 1);
    next.splice(nextIndex, 0, row!);
    onChange(next);
  };

  return (
    <Stack spacing={1.25} aria-labelledby="workplace-service-option-editor-heading">
      <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
        <Box>
          <Typography
            id="workplace-service-option-editor-heading"
            component="h3"
            variant="subtitle2"
            fontWeight="fontWeightBold"
          >
            {t(
              kind === 'inspection'
                ? 'workplace.services.extensions.inspectionChecklist'
                : 'workplace.services.catalog.optionSchema'
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t(
              kind === 'inspection'
                ? 'workplace.services.extensions.inspectionChecklistDescription'
                : 'workplace.services.extensions.optionEditorDescription'
            )}
          </Typography>
        </Box>
        <ActionButton
          intent="secondary"
          size="small"
          startIcon={<Plus size={16} />}
          disabled={disabled || rows.length >= 30}
          onClick={() => onChange([...rows, optionRow()])}
        >
          {t(
            kind === 'inspection'
              ? 'workplace.services.extensions.addInspectionItem'
              : 'workplace.services.extensions.addOption'
          )}
        </ActionButton>
      </Stack>
      {!valid ? (
        <InlineFeedback severity="error">
          {t('workplace.services.catalog.optionSchemaError')}
        </InlineFeedback>
      ) : null}
      {rows.map((row, index) => (
        <Box key={row.rowId} sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}>
          <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center" mb={1}>
            <Typography component="h4" variant="subtitle2">
              {row.key || t('workplace.services.extensions.newOption')}
            </Typography>
            <Stack direction="row" gap={0.25}>
              <ActionButton
                intent="quiet"
                size="small"
                aria-label={t('workplace.services.extensions.moveOptionUp')}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={15} />
              </ActionButton>
              <ActionButton
                intent="quiet"
                size="small"
                aria-label={t('workplace.services.extensions.moveOptionDown')}
                disabled={disabled || index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={15} />
              </ActionButton>
              <ActionButton
                intent="danger"
                size="small"
                aria-label={t('workplace.services.extensions.deleteOption')}
                disabled={disabled}
                onClick={() => onChange(rows.filter((item) => item.rowId !== row.rowId))}
              >
                <Trash2 size={15} />
              </ActionButton>
            </Stack>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1,
            }}
          >
            <FormField
              label={t('workplace.services.extensions.optionKey')}
              value={row.key}
              disabled={disabled}
              inputProps={{ maxLength: 80 }}
              onChange={(event) => patch(row.rowId, { key: event.target.value })}
            />
            <SelectField
              label={t('workplace.services.extensions.optionType')}
              value={row.type}
              disabled={disabled}
              options={optionTypes.map((type) => ({
                value: type,
                label: t(`workplace.services.extensions.optionTypes.${type}`),
              }))}
              onValueChange={(value) =>
                value && patch(row.rowId, { type: value as WorkplaceServiceOptionRow['type'] })
              }
            />
            <FormField
              label={t('workplace.services.extensions.optionLabelKo')}
              value={row.labelKo}
              disabled={disabled}
              inputProps={{ maxLength: 200 }}
              onChange={(event) => patch(row.rowId, { labelKo: event.target.value })}
            />
            <FormField
              label={t('workplace.services.extensions.optionLabelEn')}
              value={row.labelEn}
              disabled={disabled}
              inputProps={{ maxLength: 200 }}
              onChange={(event) => patch(row.rowId, { labelEn: event.target.value })}
            />
            {row.type.endsWith('SELECT') ? (
              <FormField
                label={t('workplace.services.extensions.optionValues')}
                value={row.valuesText}
                disabled={disabled}
                supportingText={t('workplace.services.extensions.commaSeparated')}
                onChange={(event) => patch(row.rowId, { valuesText: event.target.value })}
              />
            ) : null}
            {row.type === 'NUMBER' ? (
              <>
                <FormField
                  type="number"
                  label={t('workplace.services.extensions.optionMinimum')}
                  value={row.minimumText}
                  disabled={disabled}
                  onChange={(event) => patch(row.rowId, { minimumText: event.target.value })}
                />
                <FormField
                  type="number"
                  label={t('workplace.services.extensions.optionMaximum')}
                  value={row.maximumText}
                  disabled={disabled}
                  onChange={(event) => patch(row.rowId, { maximumText: event.target.value })}
                />
              </>
            ) : null}
            <FormField
              label={t('workplace.services.extensions.optionDefault')}
              value={row.defaultValueText}
              disabled={disabled}
              onChange={(event) => patch(row.rowId, { defaultValueText: event.target.value })}
            />
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={row.required}
                disabled={disabled}
                onChange={(event) => patch(row.rowId, { required: event.target.checked })}
              />
            }
            label={t('workplace.services.extensions.optionRequired')}
          />
        </Box>
      ))}
    </Stack>
  );
}
