import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlignLeft,
  CalendarDays,
  Eye,
  Hash,
  ListFilter,
  ListTree,
  Plus,
  RefreshCcw,
  SlidersHorizontal,
  Type,
  UserRound,
} from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';

import {
  approvalFormFieldIssues,
  createApprovalFormField,
  moveApprovalFormField,
} from './approval-form-builder-model';
import { ApprovalFormFieldEditor } from './approval-form-field-editor';
import { ApprovalFormDefinitionFields } from './approval-form-builder-definition-fields';
import { ApprovalLegacyFormCanvas } from './approval-form-builder-preview';
import { ApprovalTypedFormBuilderDialog } from './approval-form-builder-typed-dialog';
import { focusApprovalLabeledControl, focusApprovalSelector } from './approval-focus-navigation';
import { StatusChip, approvalTone } from './approval-ui';

import type { ApprovalFormField } from '@dwp-frontend/shared-utils';
import type { LegacyFormDraft } from './approval-form-catalog-drafts';
import type { ApprovalFormBuilderProps } from './approval-form-builder-props';
import type { LucideIcon } from 'lucide-react';

type BuilderPanel = 'structure' | 'properties' | 'canvas';
type BuilderFocusRequest = Readonly<{
  panel: 'structure' | 'properties';
  property?: string;
}>;

const FIELD_ICONS: Record<ApprovalFormField['type'], LucideIcon> = {
  TEXT: Type,
  TEXTAREA: AlignLeft,
  NUMBER: Hash,
  DATE: CalendarDays,
  SELECT: ListFilter,
  USER: UserRound,
};

export function ApprovalFormBuilderDialog(props: ApprovalFormBuilderProps) {
  return props.draft.typedSchema ? (
    <ApprovalTypedFormBuilderDialog {...props} draft={props.draft} />
  ) : (
    <ApprovalLegacyFormBuilderDialog {...props} draft={props.draft} />
  );
}

function ApprovalLegacyFormBuilderDialog({
  open,
  creating,
  draft,
  categories,
  workflows,
  valid,
  busy,
  sourceConflict,
  readRetrying,
  onRefresh,
  onChange,
  onClose,
  onSave,
}: Omit<ApprovalFormBuilderProps, 'draft'> & { draft: LegacyFormDraft }) {
  const { t, i18n } = useTranslation('approvals');
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  const [activePanel, setActivePanel] = useState<BuilderPanel>('structure');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lockedFieldKeys, setLockedFieldKeys] = useState<ReadonlySet<string>>(new Set());
  const [focusRequest, setFocusRequest] = useState<BuilderFocusRequest | null>(null);
  const structureRef = useRef<HTMLDivElement>(null);
  const propertyRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const issues = useMemo(() => approvalFormFieldIssues(draft.fields), [draft.fields]);
  const issueIndexes = useMemo(() => new Set(issues.map((issue) => issue.index)), [issues]);
  const selectedField = draft.fields[selectedIndex] ?? null;

  useEffect(() => {
    if (open && !wasOpen.current) {
      setSelectedIndex(0);
      setActivePanel('structure');
      setFocusRequest(null);
      setLockedFieldKeys(new Set(creating ? [] : draft.fields.map((field) => field.key)));
    }
    wasOpen.current = open;
  }, [creating, draft.fields, open]);

  useEffect(() => {
    if (selectedIndex < draft.fields.length) return;
    setSelectedIndex(Math.max(0, draft.fields.length - 1));
  }, [draft.fields.length, selectedIndex]);
  useEffect(() => {
    if (!focusRequest || focusRequest.panel !== activePanel) return;
    const frame = window.requestAnimationFrame(() => {
      if (focusRequest.panel === 'structure') {
        focusApprovalSelector(
          structureRef.current,
          `[data-approval-legacy-field="${selectedIndex}"]`
        );
      } else if (
        !focusRequest.property ||
        !focusApprovalSelector(
          propertyRef.current,
          `[data-approval-field-property="${focusRequest.property}"]`
        )
      ) {
        focusApprovalLabeledControl(propertyRef.current, null);
      }
      setFocusRequest(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePanel, focusRequest, selectedIndex]);

  const updateSelected = (field: ApprovalFormField) => {
    onChange({
      ...draft,
      fields: draft.fields.map((item, index) => (index === selectedIndex ? field : item)),
    });
  };
  const moveSelected = (direction: -1 | 1) => {
    const target = selectedIndex + direction;
    const next = moveApprovalFormField(draft.fields, selectedIndex, direction);
    if (target < 0 || target >= next.length) return;
    onChange({ ...draft, fields: next });
    setSelectedIndex(target);
  };
  const removeSelected = () => {
    if (draft.fields.length === 1) return;
    onChange({
      ...draft,
      fields: draft.fields.filter((_, index) => index !== selectedIndex),
    });
    setSelectedIndex((current) => Math.min(current, draft.fields.length - 2));
  };
  const addField = () => {
    if (draft.fields.length >= 50) return;
    const nextIndex = draft.fields.length;
    onChange({
      ...draft,
      fields: [...draft.fields, createApprovalFormField(nextIndex, draft.fields)],
    });
    setSelectedIndex(nextIndex);
    setActivePanel('properties');
    setFocusRequest({ panel: 'properties', property: 'key' });
  };

  return (
    <FormDialog
      open={open}
      title={t(
        creating ? 'admin.formCatalog.editor.createTitle' : 'admin.formCatalog.editor.editTitle'
      )}
      description={t('admin.studio.schemaNotice')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.save')}
      busy={busy}
      submitDisabled={!valid || issues.length > 0}
      onClose={onClose}
      onSubmit={onSave}
      maxWidth="xl"
      mobileFullScreen
      secondaryActions={
        <Stack direction="row" gap={1}>
          <ActionIconButton
            label={t('actions.retry')}
            tooltipDisablePortal
            disabled={busy || readRetrying}
            onClick={onRefresh}
          >
            <RefreshCcw size={16} />
          </ActionIconButton>
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={addField}
          >
            {t('admin.studio.addField')}
          </ActionButton>
        </Stack>
      }
    >
      <Stack gap={2}>
        {sourceConflict ? (
          <InlineFeedback severity="warning">{t('admin.studio.saveConflict')}</InlineFeedback>
        ) : null}
        <ApprovalFormDefinitionFields
          creating={creating}
          draft={draft}
          categories={categories}
          workflows={workflows}
          korean={korean}
          onChange={onChange}
        />

        {compact ? (
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={activePanel}
            onChange={(_, value: BuilderPanel | null) => {
              if (!value) return;
              setActivePanel(value);
              if (value === 'structure') setFocusRequest({ panel: 'structure' });
              if (value === 'properties') {
                setFocusRequest({ panel: 'properties', property: 'key' });
              }
            }}
            aria-label={t('admin.studio.definitionSection')}
          >
            <Tooltip title={t('admin.studio.formFields')}>
              <ToggleButton value="structure" aria-label={t('admin.studio.formFields')}>
                <ListTree size={18} />
              </ToggleButton>
            </Tooltip>
            <Tooltip title={t('admin.studio.fieldOrdinal', { count: selectedIndex + 1 })}>
              <ToggleButton
                value="properties"
                aria-label={t('admin.studio.fieldOrdinal', { count: selectedIndex + 1 })}
              >
                <SlidersHorizontal size={18} />
              </ToggleButton>
            </Tooltip>
            <Tooltip title={t('admin.studio.preview')}>
              <ToggleButton value="canvas" aria-label={t('admin.studio.preview')}>
                <Eye size={18} />
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        ) : null}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: compact ? 'minmax(0,1fr)' : '250px minmax(320px,1fr) 340px',
            gap: 1.5,
            alignItems: 'start',
          }}
        >
          {(!compact || activePanel === 'structure') && (
            <Box ref={structureRef}>
              <FieldStructurePanel
                fields={draft.fields}
                selectedIndex={selectedIndex}
                issueIndexes={issueIndexes}
                onSelect={(index) => {
                  setSelectedIndex(index);
                  if (compact) {
                    setActivePanel('properties');
                    setFocusRequest({ panel: 'properties', property: 'key' });
                  }
                }}
                onAdd={addField}
              />
            </Box>
          )}

          {(!compact || activePanel === 'canvas') && (
            <ApprovalLegacyFormCanvas
              draft={draft}
              korean={korean}
              selectedIndex={selectedIndex}
              issueIndexes={issueIndexes}
              onSelect={setSelectedIndex}
            />
          )}

          {(!compact || activePanel === 'properties') && selectedField && (
            <Box
              component="section"
              ref={propertyRef}
              aria-label={t('admin.studio.fieldOrdinal', { count: selectedIndex + 1 })}
              sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper', p: 1.5 }}
            >
              <Box sx={{ typography: 'subtitle2', mb: 1.25 }}>
                {t('admin.studio.fieldOrdinal', { count: selectedIndex + 1 })}
              </Box>
              <ApprovalFormFieldEditor
                field={selectedField}
                index={selectedIndex}
                fieldCount={draft.fields.length}
                lockKey={lockedFieldKeys.has(selectedField.key)}
                lockType={lockedFieldKeys.has(selectedField.key)}
                onChange={updateSelected}
                onMoveUp={() => moveSelected(-1)}
                onMoveDown={() => moveSelected(1)}
                onRemove={removeSelected}
              />
            </Box>
          )}
        </Box>

        <InlineFeedback severity={issues.length === 0 ? 'success' : 'warning'}>
          <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
            <Box sx={{ typography: 'body2' }}>
              {t(
                issues.length === 0
                  ? 'admin.formCatalog.assurance.ready'
                  : 'admin.formCatalog.assurance.blocked'
              )}
            </Box>
            <Chip
              size="small"
              color={issues.length === 0 ? 'success' : 'warning'}
              variant="outlined"
              label={issues.length}
            />
          </Stack>
        </InlineFeedback>
        {issues.length ? (
          <Stack component="ul" gap={0.5} sx={{ m: 0, p: 0, listStyle: 'none' }} aria-live="polite">
            {issues.map((issue, index) => {
              const field = draft.fields[issue.index];
              const property =
                issue.issue === 'LABEL'
                  ? !(field.labelKo ?? '').trim()
                    ? 'labelKo'
                    : 'labelEn'
                  : issue.issue === 'HELP'
                    ? (field.helpKo?.length ?? 0) > 500
                      ? 'helpKo'
                      : 'helpEn'
                    : issue.issue === 'OPTIONS'
                      ? 'options'
                      : 'key';
              return (
                <Box component="li" key={`${issue.index}-${issue.issue}-${index}`}>
                  <ActionButton
                    intent="quiet"
                    size="small"
                    onClick={() => {
                      setSelectedIndex(issue.index);
                      setActivePanel('properties');
                      setFocusRequest({ panel: 'properties', property });
                    }}
                  >
                    {t('admin.studio.fieldOrdinal', { count: issue.index + 1 })} ·{' '}
                    {t('admin.studio.validationIssue', {
                      field: t(
                        issue.issue === 'LABEL'
                          ? 'admin.studio.labelKo'
                          : issue.issue === 'HELP'
                            ? 'admin.studio.helpKo'
                            : issue.issue === 'OPTIONS'
                              ? 'admin.studio.options'
                              : issue.issue === 'TYPE'
                                ? 'admin.studio.fieldType'
                                : 'admin.studio.fieldKey'
                      ),
                    })}
                  </ActionButton>
                </Box>
              );
            })}
          </Stack>
        ) : null}
      </Stack>
    </FormDialog>
  );
}

function FieldStructurePanel({
  fields,
  selectedIndex,
  issueIndexes,
  onSelect,
  onAdd,
}: {
  fields: ApprovalFormField[];
  selectedIndex: number;
  issueIndexes: ReadonlySet<number>;
  onSelect: (index: number) => void;
  onAdd: () => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  return (
    <Box
      component="section"
      sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1.25 }}>
        <Box sx={{ typography: 'subtitle2' }}>{t('admin.studio.formFields')}</Box>
        <ActionButton intent="quiet" size="small" startIcon={<Plus size={16} />} onClick={onAdd}>
          {t('admin.studio.addField')}
        </ActionButton>
      </Stack>
      <Stack
        component="ol"
        sx={{ m: 0, p: 0, listStyle: 'none', maxHeight: 520, overflowY: 'auto' }}
      >
        {fields.map((field, index) => {
          const Icon = FIELD_ICONS[field.type];
          const selected = index === selectedIndex;
          return (
            <Box component="li" key={`${field.key}-${index}`}>
              <ButtonBase
                data-approval-legacy-field={index}
                onClick={() => onSelect(index)}
                aria-pressed={selected}
                sx={{
                  width: 1,
                  minHeight: 58,
                  px: 1.25,
                  py: 1,
                  display: 'flex',
                  gap: 1,
                  textAlign: 'left',
                  borderTop: 1,
                  borderColor: 'divider',
                  borderInlineStart: 3,
                  borderInlineStartColor: selected ? approvalTone.primary : 'transparent',
                  bgcolor: selected ? alpha(approvalTone.primary, 0.07) : 'transparent',
                }}
              >
                <Icon size={16} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ typography: 'body2', fontWeight: 'fontWeightBold' }}>
                    {(korean ? field.labelKo : field.labelEn) || field.key}
                  </Box>
                  <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                    {field.key} · {field.type}
                  </Box>
                </Box>
                {issueIndexes.has(index) ? (
                  <StatusChip status="ATTENTION" />
                ) : field.required ? (
                  <Chip size="small" variant="outlined" label={t('admin.studio.required')} />
                ) : null}
              </ButtonBase>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
