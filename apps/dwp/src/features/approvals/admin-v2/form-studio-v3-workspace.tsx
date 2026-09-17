import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Braces,
  CheckCircle2,
  Copy,
  FormInput,
  Pencil,
  Play,
  Plus,
  Save,
  Send,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  InlineFeedback,
  ProgressMeter,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import {
  AdminV2FactGrid,
  AdminV2GovernedAction,
  AdminV2InspectorPaper,
  AdminV2MetricStrip,
  AdminV2RecordButton,
  AdminV2Section,
  AdminV2StateBoundary,
  AdminV2StatusPill,
  AdminV2ViewTabs,
  AdminV2WorkspaceFrame,
} from './admin-v2-foundation';

import type {
  AdminV2Fact,
  AdminV2Metric,
  AdminV2SourceState,
  AdminV2StateCopy,
  AdminV2Status,
  AdminV2WorkspaceHeader,
} from './admin-v2-types';

export type FormStudioV3View = 'builder' | 'preview' | 'rules' | 'validation' | 'review';

export type ApprovalFormFieldV3 = {
  id: string;
  key: string;
  label: string;
  typeLabel: string;
  helpText?: string;
  required: boolean;
  spanLabel: string;
  classificationLabel: string;
  editorType?: string;
  status: AdminV2Status;
  facts: readonly AdminV2Fact[];
};

export type ApprovalFormRuleV3 = {
  id: string;
  name: string;
  expression: string;
  explanation: string;
  scopeLabel: string;
  status: AdminV2Status;
};

export type ApprovalFormValidationV3 = {
  id: string;
  title: string;
  detail: string;
  location: string;
  status: AdminV2Status;
};

export type ApprovalFormReviewChangeV3 = {
  id: string;
  label: string;
  beforeValue: string;
  afterValue: string;
  status: AdminV2Status;
};

export type FormStudioV3Copy = {
  header: AdminV2WorkspaceHeader;
  state: AdminV2StateCopy;
  navigationLabel: string;
  builderTab: string;
  previewTab?: string;
  rulesTab: string;
  validationTab: string;
  reviewTab: string;
  structureTitle: string;
  structureDescription: string;
  canvasTitle: string;
  canvasDescription: string;
  inspectorTitle: string;
  inspectorDescription: string;
  rulesTitle: string;
  rulesDescription: string;
  validationTitle: string;
  validationDescription: string;
  reviewTitle: string;
  reviewDescription: string;
  fieldRequiredLabel: string;
  fieldOptionalLabel: string;
  addFieldLabel: string;
  editFieldLabel?: string;
  duplicateFieldLabel?: string;
  moveFieldUpLabel?: string;
  moveFieldDownLabel?: string;
  removeFieldLabel?: string;
  saveDraftLabel: string;
  validateLabel: string;
  submitReviewLabel: string;
  mobileReviewLabel: string;
  mobileReviewReason: string;
  schemaTitle: string;
  schemaDescription: string;
  deterministicLabel: string;
  changeBeforeLabel: string;
  changeAfterLabel: string;
  noSelectionLabel: string;
};

export type FormStudioV3WorkspaceProps = {
  state: AdminV2SourceState;
  copy: FormStudioV3Copy;
  metrics: readonly AdminV2Metric[];
  view: FormStudioV3View;
  formName: string;
  versionLabel: string;
  formStatus: AdminV2Status;
  dirtyLabel?: string;
  schemaFacts: readonly AdminV2Fact[];
  fields: readonly ApprovalFormFieldV3[];
  selectedFieldId: string | null;
  rules: readonly ApprovalFormRuleV3[];
  validation: readonly ApprovalFormValidationV3[];
  reviewChanges: readonly ApprovalFormReviewChangeV3[];
  validationScore: number;
  validationScoreLabel: string;
  addFieldReady: boolean;
  addFieldDisabledReason?: string;
  editFieldReady: boolean;
  editFieldDisabledReason?: string;
  saveDraftReady: boolean;
  saveDraftDisabledReason?: string;
  submitReviewReady: boolean;
  submitReviewDisabledReason?: string;
  onViewChange: (view: FormStudioV3View) => void;
  onSelectField: (fieldId: string) => void;
  onAddField: () => void;
  onEditField: (fieldId: string) => void;
  onCloneField: (fieldId: string) => void;
  onMoveField: (fieldId: string, direction: -1 | 1) => void;
  onDeleteField: (fieldId: string) => void;
  onSaveDraft: () => void;
  onRunValidation: () => void;
  onSubmitReview: () => void;
  onRetry?: () => void;
  onResolveConflict?: () => void;
};

function BuilderView({
  copy,
  fields,
  selectedFieldId,
  selectedField,
  commandReady,
  addFieldReady,
  addFieldDisabledReason,
  editFieldReady,
  editFieldDisabledReason,
  onSelectField,
  onAddField,
  onEditField,
  onCloneField,
  onMoveField,
  onDeleteField,
}: Pick<
  FormStudioV3WorkspaceProps,
  | 'copy'
  | 'fields'
  | 'selectedFieldId'
  | 'onSelectField'
  | 'onAddField'
  | 'addFieldReady'
  | 'addFieldDisabledReason'
  | 'editFieldReady'
  | 'editFieldDisabledReason'
  | 'onEditField'
  | 'onCloneField'
  | 'onMoveField'
  | 'onDeleteField'
> & {
  selectedField: ApprovalFormFieldV3 | null;
  commandReady: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0,1fr)',
          lg: 'minmax(190px,.65fr) minmax(360px,1.45fr) minmax(260px,.9fr)',
        },
        gap: { xs: 1.5, lg: 2 },
        alignItems: 'start',
      }}
    >
      <AdminV2InspectorPaper>
        <AdminV2Section
          title={copy.structureTitle}
          description={copy.structureDescription}
          labelledBy="admin-v2-form-structure"
          action={
            <Stack alignItems="flex-end" gap={0.4}>
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<Plus size={15} />}
                disabled={!commandReady || !addFieldReady}
                onClick={onAddField}
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
              >
                {copy.addFieldLabel}
              </ActionButton>
              {(!commandReady || !addFieldReady) && addFieldDisabledReason ? (
                <Typography variant="caption" color="text.secondary" textAlign="right">
                  {addFieldDisabledReason}
                </Typography>
              ) : null}
            </Stack>
          }
        >
          <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {fields.map((field, index) => (
              <Box component="li" key={field.id}>
                <AdminV2RecordButton
                  selected={field.id === selectedFieldId}
                  title={`${index + 1}. ${field.label}`}
                  description={`${field.typeLabel} · ${field.spanLabel}`}
                  meta={field.key}
                  status={field.status}
                  onClick={() => onSelectField(field.id)}
                />
              </Box>
            ))}
          </Box>
        </AdminV2Section>
      </AdminV2InspectorPaper>

      <AdminV2InspectorPaper>
        <AdminV2Section
          title={copy.canvasTitle}
          description={copy.canvasDescription}
          labelledBy="admin-v2-form-canvas"
        >
          <Stack gap={1.25} sx={{ p: { xs: 1.25, sm: 2 }, bgcolor: 'action.hover' }}>
            {fields.map((field) => (
              <ButtonBase
                key={field.id}
                onClick={() => onSelectField(field.id)}
                aria-current={field.id === selectedFieldId ? 'true' : undefined}
                sx={{
                  width: 1,
                  minHeight: field.typeLabel.toLowerCase().includes('text') ? 92 : 64,
                  px: 1.5,
                  py: 1.25,
                  display: 'block',
                  textAlign: 'start',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: field.id === selectedFieldId ? 'primary.main' : 'divider',
                  borderInlineStartWidth: field.id === selectedFieldId ? 4 : 1,
                  borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 1.5}px`,
                }}
              >
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Box minWidth={0}>
                    <Typography
                      variant="body2"
                      fontWeight="fontWeightBold"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {field.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {field.required ? copy.fieldRequiredLabel : copy.fieldOptionalLabel}
                    </Typography>
                  </Box>
                  <AdminV2StatusPill status={field.status} />
                </Stack>
                {field.helpText ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.75, overflowWrap: 'anywhere' }}
                  >
                    {field.helpText}
                  </Typography>
                ) : null}
              </ButtonBase>
            ))}
          </Stack>
        </AdminV2Section>
      </AdminV2InspectorPaper>

      <AdminV2InspectorPaper>
        <AdminV2Section
          title={copy.inspectorTitle}
          description={copy.inspectorDescription}
          labelledBy="admin-v2-form-inspector"
          action={selectedField ? <AdminV2StatusPill status={selectedField.status} /> : undefined}
        >
          {selectedField ? (
            <>
              <Box sx={{ px: 1.5, py: 1.25, borderBlockEnd: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight="fontWeightBold">
                  {selectedField.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedField.key} · {selectedField.classificationLabel}
                </Typography>
              </Box>
              <AdminV2FactGrid facts={selectedField.facts} />
              <Stack
                direction="row"
                gap={0.5}
                flexWrap="wrap"
                sx={{ px: 1.5, py: 1.25, borderBlockStart: 1, borderColor: 'divider' }}
              >
                <ActionIconButton
                  label={copy.editFieldLabel ?? copy.inspectorTitle}
                  disabled={!commandReady || !editFieldReady}
                  onClick={() => onEditField(selectedField.id)}
                >
                  <Pencil size={16} />
                </ActionIconButton>
                <ActionIconButton
                  label={copy.duplicateFieldLabel ?? copy.addFieldLabel}
                  disabled={!commandReady || !editFieldReady}
                  onClick={() => onCloneField(selectedField.id)}
                >
                  <Copy size={16} />
                </ActionIconButton>
                <ActionIconButton
                  label={copy.moveFieldUpLabel ?? copy.structureTitle}
                  disabled={!commandReady || !editFieldReady}
                  onClick={() => onMoveField(selectedField.id, -1)}
                >
                  <ArrowUp size={16} />
                </ActionIconButton>
                <ActionIconButton
                  label={copy.moveFieldDownLabel ?? copy.structureTitle}
                  disabled={!commandReady || !editFieldReady}
                  onClick={() => onMoveField(selectedField.id, 1)}
                >
                  <ArrowDown size={16} />
                </ActionIconButton>
                <ActionIconButton
                  label={copy.removeFieldLabel ?? copy.fieldOptionalLabel}
                  intent="danger"
                  disabled={!commandReady || !editFieldReady}
                  onClick={() => onDeleteField(selectedField.id)}
                >
                  <Trash2 size={16} />
                </ActionIconButton>
              </Stack>
              {!editFieldReady && editFieldDisabledReason ? (
                <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, pb: 1.25 }}>
                  {editFieldDisabledReason}
                </Typography>
              ) : null}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {copy.noSelectionLabel}
            </Typography>
          )}
        </AdminV2Section>
      </AdminV2InspectorPaper>
    </Box>
  );
}

function PreviewView({ copy, fields }: Pick<FormStudioV3WorkspaceProps, 'copy' | 'fields'>) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  return (
    <AdminV2InspectorPaper>
      <AdminV2Section
        title={copy.previewTab ?? copy.canvasTitle}
        description={copy.canvasDescription}
        labelledBy="admin-v2-form-preview"
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(12,minmax(0,1fr))' },
            gap: 1.5,
            p: { xs: 1.5, sm: 2 },
          }}
        >
          {fields.map((field) => {
            const type = field.editorType ?? field.typeLabel.split(' · ')[0] ?? 'TEXT';
            const columns = Math.max(1, Math.min(12, Number(field.spanLabel.split('/')[0]) || 12));
            return (
              <Box key={field.id} sx={{ gridColumn: { xs: '1 / -1', md: `span ${columns}` } }}>
                {type === 'BOOLEAN' ? (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={values[field.id] === true}
                        onChange={(_event, checked) =>
                          setValues((current) => ({ ...current, [field.id]: checked }))
                        }
                      />
                    }
                    label={field.label}
                  />
                ) : (
                  <FormField
                    fullWidth
                    required={field.required}
                    label={field.label}
                    supportingText={field.helpText}
                    type={
                      type === 'NUMBER'
                        ? 'number'
                        : type === 'DATE'
                          ? 'date'
                          : type === 'DATETIME'
                            ? 'datetime-local'
                            : 'text'
                    }
                    multiline={type === 'TEXTAREA'}
                    minRows={type === 'TEXTAREA' ? 3 : undefined}
                    value={String(values[field.id] ?? '')}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [field.id]: event.target.value }))
                    }
                  />
                )}
              </Box>
            );
          })}
        </Box>
      </AdminV2Section>
    </AdminV2InspectorPaper>
  );
}

function RulesView({ copy, rules }: Pick<FormStudioV3WorkspaceProps, 'copy' | 'rules'>) {
  return (
    <AdminV2InspectorPaper>
      <AdminV2Section
        title={copy.rulesTitle}
        description={copy.rulesDescription}
        labelledBy="admin-v2-form-rules"
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2,minmax(0,1fr))' },
          }}
        >
          {rules.map((rule) => (
            <Box
              key={rule.id}
              sx={{ minWidth: 0, p: 1.5, borderBlockEnd: 1, borderColor: 'divider' }}
            >
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Typography variant="body2" fontWeight="fontWeightBold">
                  {rule.name}
                </Typography>
                <AdminV2StatusPill status={rule.status} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {rule.scopeLabel}
              </Typography>
              <Box
                component="code"
                sx={{
                  display: 'block',
                  my: 1,
                  p: 1,
                  bgcolor: 'action.hover',
                  borderRadius: (theme) => `${Number(theme.shape.borderRadius)}px`,
                  fontSize: (theme) => theme.typography.caption.fontSize,
                  overflowWrap: 'anywhere',
                }}
              >
                {rule.expression}
              </Box>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {rule.explanation}
              </Typography>
            </Box>
          ))}
        </Box>
      </AdminV2Section>
    </AdminV2InspectorPaper>
  );
}

function ValidationView({
  copy,
  validation,
  validationScore,
  validationScoreLabel,
  onRunValidation,
}: Pick<
  FormStudioV3WorkspaceProps,
  'copy' | 'validation' | 'validationScore' | 'validationScoreLabel' | 'onRunValidation'
>) {
  return (
    <AdminV2InspectorPaper>
      <AdminV2Section
        title={copy.validationTitle}
        description={copy.validationDescription}
        labelledBy="admin-v2-form-validation"
        action={
          <ActionButton
            intent="secondary"
            size="small"
            startIcon={<Play size={15} />}
            onClick={onRunValidation}
          >
            {copy.validateLabel}
          </ActionButton>
        }
      >
        <Box sx={{ p: 1.5, borderBlockEnd: 1, borderColor: 'divider' }}>
          <ProgressMeter
            label={copy.deterministicLabel}
            value={validationScore}
            valueLabel={validationScoreLabel}
            tone={validationScore === 100 ? 'success' : 'warning'}
          />
        </Box>
        <Stack divider={<Divider flexItem />}>
          {validation.map((item) => (
            <Stack key={item.id} direction="row" gap={1.25} sx={{ p: 1.5 }}>
              {item.status.tone === 'success' ? (
                <CheckCircle2 size={19} color="currentColor" />
              ) : (
                <ShieldAlert size={19} color="currentColor" />
              )}
              <Box minWidth={0} flex={1}>
                <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    {item.title}
                  </Typography>
                  <AdminV2StatusPill status={item.status} />
                </Stack>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {item.detail}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.location}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </AdminV2Section>
    </AdminV2InspectorPaper>
  );
}

function ReviewView({
  copy,
  reviewChanges,
}: Pick<FormStudioV3WorkspaceProps, 'copy' | 'reviewChanges'>) {
  return (
    <AdminV2InspectorPaper>
      <AdminV2Section
        title={copy.reviewTitle}
        description={copy.reviewDescription}
        labelledBy="admin-v2-form-review"
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Box
            role="table"
            aria-label={copy.reviewTitle}
            sx={{ minWidth: 620, display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr auto' }}
          >
            {[copy.reviewTitle, copy.changeBeforeLabel, copy.changeAfterLabel, ''].map(
              (label, index) => (
                <Typography
                  role="columnheader"
                  key={`${label}-${index}`}
                  variant="caption"
                  fontWeight="fontWeightBold"
                  sx={{ px: 1.5, py: 1, bgcolor: 'action.hover' }}
                >
                  {label}
                </Typography>
              )
            )}
            {reviewChanges.map((change) => (
              <Box key={change.id} role="row" sx={{ display: 'contents' }}>
                <Typography role="cell" variant="body2" fontWeight="fontWeightBold" sx={{ p: 1.5 }}>
                  {change.label}
                </Typography>
                <Typography role="cell" variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
                  {change.beforeValue}
                </Typography>
                <Typography role="cell" variant="body2" sx={{ p: 1.5 }}>
                  {change.afterValue}
                </Typography>
                <Box role="cell" sx={{ p: 1.25 }}>
                  <AdminV2StatusPill status={change.status} />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </AdminV2Section>
    </AdminV2InspectorPaper>
  );
}

export function FormStudioV3Workspace(props: FormStudioV3WorkspaceProps) {
  const {
    state,
    copy,
    metrics,
    view,
    formName,
    versionLabel,
    formStatus,
    dirtyLabel,
    schemaFacts,
    fields,
    selectedFieldId,
    rules,
    validation,
    reviewChanges,
    validationScore,
    validationScoreLabel,
    addFieldReady,
    addFieldDisabledReason,
    editFieldReady,
    editFieldDisabledReason,
    saveDraftReady,
    saveDraftDisabledReason,
    submitReviewReady,
    submitReviewDisabledReason,
    onViewChange,
    onSelectField,
    onAddField,
    onEditField,
    onCloneField,
    onMoveField,
    onDeleteField,
    onSaveDraft,
    onRunValidation,
    onSubmitReview,
    onRetry,
    onResolveConflict,
  } = props;
  const selectedField = fields.find((field) => field.id === selectedFieldId) ?? null;
  const commandReady = state === 'ready';

  return (
    <AdminV2WorkspaceFrame
      header={copy.header}
      icon={FormInput}
      primaryAction={
        <AdminV2GovernedAction
          desktopLabel={copy.submitReviewLabel}
          mobileLabel={copy.mobileReviewLabel}
          mobileReason={copy.mobileReviewReason}
          disabled={!commandReady || !submitReviewReady}
          disabledReason={submitReviewDisabledReason}
          onAction={onSubmitReview}
          icon={<Send size={16} />}
        />
      }
    >
      <AdminV2StateBoundary
        state={state}
        copy={copy.state}
        actions={{ onRetry, onResolveConflict }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.25}>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
              {formName}
            </Typography>
            <AdminV2StatusPill status={formStatus} />
            <Typography variant="caption" color="text.secondary">
              {versionLabel}
            </Typography>
            {dirtyLabel ? (
              <AdminV2StatusPill status={{ label: dirtyLabel, tone: 'warning' }} />
            ) : null}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <ActionButton
              intent="secondary"
              startIcon={<Play size={16} />}
              onClick={onRunValidation}
            >
              {copy.validateLabel}
            </ActionButton>
            <Stack alignItems="flex-end" gap={0.4}>
              <ActionButton
                intent="primary"
                startIcon={<Save size={16} />}
                disabled={!commandReady || !saveDraftReady}
                onClick={onSaveDraft}
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
              >
                {copy.saveDraftLabel}
              </ActionButton>
              {(!commandReady || !saveDraftReady) && saveDraftDisabledReason ? (
                <Typography variant="caption" color="text.secondary" textAlign="right">
                  {saveDraftDisabledReason}
                </Typography>
              ) : null}
            </Stack>
          </Stack>
        </Stack>
        <AdminV2MetricStrip metrics={metrics} />
        <AdminV2InspectorPaper>
          <AdminV2ViewTabs
            label={copy.navigationLabel}
            value={view}
            options={[
              { value: 'builder', label: copy.builderTab, count: fields.length },
              { value: 'preview', label: copy.previewTab ?? copy.canvasTitle },
              { value: 'rules', label: copy.rulesTab, count: rules.length },
              { value: 'validation', label: copy.validationTab, count: validation.length },
              { value: 'review', label: copy.reviewTab, count: reviewChanges.length },
            ]}
            onChange={onViewChange}
          />
          <Box sx={{ p: { xs: 1.25, sm: 1.75 } }}>
            {view === 'builder' ? (
              <BuilderView
                copy={copy}
                fields={fields}
                selectedFieldId={selectedFieldId}
                selectedField={selectedField}
                commandReady={commandReady}
                addFieldReady={addFieldReady}
                addFieldDisabledReason={addFieldDisabledReason}
                editFieldReady={editFieldReady}
                editFieldDisabledReason={editFieldDisabledReason}
                onSelectField={onSelectField}
                onAddField={onAddField}
                onEditField={onEditField}
                onCloneField={onCloneField}
                onMoveField={onMoveField}
                onDeleteField={onDeleteField}
              />
            ) : null}
            {view === 'preview' ? <PreviewView copy={copy} fields={fields} /> : null}
            {view === 'rules' ? <RulesView copy={copy} rules={rules} /> : null}
            {view === 'validation' ? (
              <ValidationView
                copy={copy}
                validation={validation}
                validationScore={validationScore}
                validationScoreLabel={validationScoreLabel}
                onRunValidation={onRunValidation}
              />
            ) : null}
            {view === 'review' ? <ReviewView copy={copy} reviewChanges={reviewChanges} /> : null}
          </Box>
        </AdminV2InspectorPaper>
        <AdminV2InspectorPaper>
          <AdminV2Section
            title={copy.schemaTitle}
            description={copy.schemaDescription}
            labelledBy="admin-v2-form-schema"
            action={<Braces size={18} aria-hidden="true" />}
          >
            <AdminV2FactGrid facts={schemaFacts} />
          </AdminV2Section>
        </AdminV2InspectorPaper>
        {state === 'ready' && validation.some((item) => item.status.tone === 'danger') ? (
          <InlineFeedback severity="error" title={copy.validationTitle}>
            {copy.validationDescription}
          </InlineFeedback>
        ) : null}
      </AdminV2StateBoundary>
    </AdminV2WorkspaceFrame>
  );
}
