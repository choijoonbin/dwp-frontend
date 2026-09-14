import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Eye, ListTree, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { ApprovalFormDefinitionFields } from './approval-form-builder-definition-fields';
import { ApprovalTypedFieldActions } from './approval-form-builder-typed-actions';
import { ApprovalTypedFormFieldEditor } from './approval-form-builder-typed-field-editor';
import { ApprovalTypedFormPreview } from './approval-form-builder-typed-preview';
import { ApprovalTypedFormStructure } from './approval-form-builder-typed-structure';
import {
  APPROVAL_TYPED_FIELD_TYPES,
  addTypedEditorField,
  changeTypedEditorFieldType,
  duplicateTypedEditorField,
  moveTypedEditorField,
  patchTypedEditorField,
  removeTypedEditorField,
  typedEditorField,
  typedEditorFields,
} from './approval-form-builder-typed-model';
import type { ApprovalFormBuilderProps } from './approval-form-builder-props';
import type { TypedFormDraft } from './approval-form-catalog-drafts';
import type { ApprovalTypedFieldPath } from './approval-form-builder-typed-model';
import type { ApprovalTypedFieldActionHandlers } from './approval-form-builder-typed-actions';

type Panel = 'structure' | 'properties' | 'canvas';

export function ApprovalTypedFormBuilderDialog({
  draft,
  open,
  creating,
  categories,
  workflows,
  valid,
  busy,
  sourceConflict,
  schemaMismatch,
  readRetrying,
  compiled,
  validating,
  invalid,
  errorPath,
  onRefresh,
  onChange,
  onClose,
  onSave,
}: Omit<ApprovalFormBuilderProps, 'draft'> & { draft: TypedFormDraft }) {
  const { t, i18n } = useTranslation('approvals');
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  const [panel, setPanel] = useState<Panel>('structure');
  const [selected, setSelected] = useState<ApprovalTypedFieldPath>(['summary']);
  const [lockedKeys, setLockedKeys] = useState<ReadonlySet<string>>(new Set());
  const [menu, setMenu] = useState<{ anchor: HTMLElement; parent?: string } | null>(null);
  const [focus, setFocus] = useState<'structure' | 'properties' | null>(null);
  const propertyRef = useRef<HTMLDivElement>(null);
  const structureRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const schema = draft.typedSchema;
  const parent = selected.length === 2 ? selected[0] : undefined;
  const fields = typedEditorFields(schema, parent);
  const field = typedEditorField(schema, selected);
  const index = fields.findIndex((item) => item.key === selected[selected.length - 1]);
  const summary = selected.length === 1 && field?.key === 'summary';
  useEffect(() => {
    if (open && !wasOpen.current) {
      setSelected([schema.fields[0]?.key ?? 'summary']);
      setPanel('structure');
      setMenu(null);
      setLockedKeys(
        new Set(
          creating
            ? []
            : schema.fields.flatMap((item) =>
                item.type === 'REPEATING_GROUP'
                  ? [item.key, ...item.fields.map((child) => `${item.key}.${child.key}`)]
                  : [item.key]
              )
        )
      );
    }
    wasOpen.current = open;
  }, [creating, open, schema]);
  useEffect(() => {
    if (field) return;
    setSelected([schema.fields[0]?.key ?? 'summary']);
  }, [field, schema]);
  useEffect(() => {
    if (!focus) return;
    const frame = requestAnimationFrame(() => {
      if (focus === 'properties')
        propertyRef.current?.querySelector<HTMLElement>('input:not(:disabled)')?.focus();
      else {
        const target = [
          ...(structureRef.current?.querySelectorAll<HTMLElement>('[data-approval-typed-field]') ??
            []),
        ].find((item) => item.dataset.approvalTypedField === selected.join('.'));
        target?.focus();
      }
      setFocus(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focus, panel, selected]);
  const patch = (values: Readonly<Record<string, unknown>>) => {
    if (!field || busy) return;
    const protectedValues = { ...values };
    if (summary || lockedKeys.has(selected.join('.'))) delete protectedValues.key;
    delete protectedValues.type;
    if (summary) delete protectedValues.visibleWhen;
    onChange({ ...draft, typedSchema: patchTypedEditorField(schema, selected, protectedValues) });
    if (typeof protectedValues.key === 'string')
      setSelected(parent ? [parent, protectedValues.key] : [protectedValues.key]);
  };
  const select = (path: ApprovalTypedFieldPath) => {
    setSelected(path);
    if (compact) {
      setPanel('properties');
      setFocus('properties');
    }
  };
  const actions: ApprovalTypedFieldActionHandlers = {
    busy,
    onMove: (path, direction) => {
      if (!busy) onChange({ ...draft, typedSchema: moveTypedEditorField(schema, path, direction) });
    },
    onDuplicate: (path) => {
      if (busy) return;
      const next = duplicateTypedEditorField(schema, path);
      if (next.schema === schema) return;
      onChange({ ...draft, typedSchema: next.schema });
      select(next.path);
    },
    onRemove: (path) => {
      if (busy) return;
      const next = removeTypedEditorField(schema, path);
      if (next === schema) return;
      onChange({ ...draft, typedSchema: next });
      select(path.length === 2 ? [path[0]] : [next.fields[0]?.key ?? 'summary']);
    },
  };
  return (
    <FormDialog
      open={open}
      title={t(
        creating ? 'admin.formCatalog.editor.createTitle' : 'admin.formCatalog.editor.editTitle'
      )}
      description={t('admin.typedForm.title')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.save')}
      busy={busy}
      submitDisabled={!valid || validating || !compiled}
      onClose={onClose}
      onSubmit={onSave}
      maxWidth="xl"
      mobileFullScreen
      secondaryActions={
        <ActionIconButton
          label={t('actions.retry')}
          tooltipDisablePortal
          disabled={busy || readRetrying}
          onClick={onRefresh}
        >
          <RefreshCcw size={16} />
        </ActionIconButton>
      }
    >
      <Stack gap={2}>
        {sourceConflict ? (
          <InlineFeedback severity="warning">{t('admin.studio.saveConflict')}</InlineFeedback>
        ) : null}
        {schemaMismatch ? (
          <InlineFeedback severity="warning">{t('admin.typedForm.schemaMismatch')}</InlineFeedback>
        ) : null}
        <Box component="fieldset" disabled={busy} sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}>
          <ApprovalFormDefinitionFields
            creating={creating}
            draft={draft}
            categories={categories}
            workflows={workflows}
            korean={korean}
            onChange={onChange}
          />
        </Box>
        {compact ? (
          <Stack direction="row" gap={1}>
            {panel !== 'structure' ? (
              <ActionIconButton
                label={t('admin.typedForm.back')}
                tooltipDisablePortal
                onClick={() => {
                  setPanel('structure');
                  setFocus('structure');
                }}
              >
                <ArrowLeft size={18} />
              </ActionIconButton>
            ) : null}
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={panel}
              aria-label={t('admin.typedForm.title')}
              onChange={(_, next: Panel | null) => {
                if (next) setPanel(next);
              }}
            >
              <ToggleButton value="structure" aria-label={t('admin.studio.formFields')}>
                <ListTree size={18} />
              </ToggleButton>
              <ToggleButton
                value="properties"
                aria-label={t('admin.studio.fieldOrdinal', { count: index + 1 })}
              >
                <SlidersHorizontal size={18} />
              </ToggleButton>
              <ToggleButton value="canvas" aria-label={t('admin.studio.preview')}>
                <Eye size={18} />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        ) : null}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: compact ? 'minmax(0,1fr)' : '230px minmax(280px,1fr) 340px',
            gap: 1.5,
            alignItems: 'start',
          }}
        >
          {!compact || panel === 'structure' ? (
            <Box
              ref={structureRef}
              component="fieldset"
              disabled={busy}
              sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}
            >
              <ApprovalTypedFormStructure
                schema={schema}
                selected={selected}
                korean={korean}
                onSelect={select}
                onAdd={(anchor, scope) => setMenu({ anchor, parent: scope })}
              />
            </Box>
          ) : null}
          {!compact || panel === 'canvas' ? (
            compiled ? (
              <ApprovalTypedFormPreview
                key={compiled.schemaSha256}
                compiled={compiled}
                korean={korean}
                title={(korean ? draft.nameKo : draft.nameEn) || t('admin.typedForm.title')}
                titleKo={draft.nameKo}
                titleEn={draft.nameEn}
                selected={selected}
                actions={actions}
                onSelect={setSelected}
                onInspect={(path) => {
                  setSelected(path);
                  setPanel('properties');
                  setFocus('properties');
                }}
              />
            ) : (
              <LoadingState
                label={t(validating ? 'admin.typedForm.validating' : 'admin.typedForm.invalid')}
                variant="skeleton"
                skeletonRows={3}
              />
            )
          ) : null}
          {(!compact || panel === 'properties') && field ? (
            <Box
              component="fieldset"
              disabled={busy}
              ref={propertyRef}
              aria-label={t('admin.typedForm.inspectField')}
              sx={{
                m: 0,
                p: 1.5,
                minWidth: 0,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                gap={1}
                sx={{ mb: 1.5 }}
              >
                <Box sx={{ typography: 'subtitle2' }}>
                  {t('admin.studio.fieldOrdinal', { count: index + 1 })}
                </Box>
                <ApprovalTypedFieldActions schema={schema} path={selected} {...actions} />
              </Stack>
              <ApprovalTypedFormFieldEditor
                field={field}
                fields={fields}
                summary={summary}
                lockKey={lockedKeys.has(selected.join('.'))}
                rowScope={Boolean(parent)}
                onPatch={patch}
                busy={busy}
                onTypeChange={(type) => {
                  if (!busy && !summary && !lockedKeys.has(selected.join('.')))
                    onChange({
                      ...draft,
                      typedSchema: changeTypedEditorFieldType(schema, selected, type),
                    });
                }}
              />
            </Box>
          ) : null}
        </Box>
        <InlineFeedback severity={invalid ? 'warning' : validating ? 'info' : 'success'}>
          <Stack gap={1} aria-live="polite">
            <Box>
              {t(
                invalid
                  ? 'admin.typedForm.invalid'
                  : validating
                    ? 'admin.typedForm.validating'
                    : 'admin.typedForm.valid'
              )}
            </Box>
            {errorPath ? (
              <ActionButton
                intent="quiet"
                onClick={() => {
                  const parts = errorPath
                    .replace(/\[\d+\]/g, '')
                    .split('.')
                    .filter(Boolean);
                  const target: ApprovalTypedFieldPath =
                    parts.length > 1 ? [parts[0], parts[1]] : [parts[0]];
                  if (typedEditorField(schema, target)) {
                    setSelected(target);
                    setPanel('properties');
                    setFocus('properties');
                  }
                }}
              >
                {errorPath}
              </ActionButton>
            ) : null}
          </Stack>
        </InlineFeedback>
      </Stack>
      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {APPROVAL_TYPED_FIELD_TYPES.filter(
          (type) => !menu?.parent || type !== 'REPEATING_GROUP'
        ).map((type) => (
          <MenuItem
            key={type}
            disabled={busy}
            onClick={() => {
              if (!menu || busy) return;
              const next = addTypedEditorField(schema, type, menu.parent);
              onChange({ ...draft, typedSchema: next.schema });
              setSelected(next.path);
              setMenu(null);
              setPanel('properties');
              setFocus('properties');
            }}
          >
            {t(`admin.typedForm.fieldTypes.${type}`)}
          </MenuItem>
        ))}
      </Menu>
    </FormDialog>
  );
}
