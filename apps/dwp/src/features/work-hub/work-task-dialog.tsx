import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckSquare2, Link2 } from 'lucide-react';
import {
  ConfirmDialog,
  DateTimePickerField,
  FormDialog,
  FormField,
  InlineFeedback,
  useDateTimePolicy,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { WorkTaskChecklistEditor } from './work-task-checklist-editor';
import { WorkTaskConflictReview } from './work-task-conflict-review';
import { WorkTaskSourceEditor, type WorkTaskSourceOption } from './work-task-source-editor';
import { WorkSourceDetailSection } from './work-hub-source-detail-section';

import type {
  PersonalWorkPriority,
  PersonalWorkTaskInput,
  PersonalWorkChecklistItem,
  PersonalWorkSource,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

export type WorkTaskDialogMode = 'create' | 'edit';

export type WorkTaskDialogInitialValue = {
  title?: string;
  description?: string | null;
  priority?: PersonalWorkPriority;
  dueAt?: string | null;
  sourceReference?: WorkSourceReference | null;
  version?: number;
  checklist?: PersonalWorkChecklistItem[];
  sources?: PersonalWorkSource[];
  sourceReferences?: WorkSourceReference[];
};

export type WorkTaskDialogSubmission = PersonalWorkTaskInput & {
  /** Present for edits so callers can preserve optimistic concurrency. */
  version?: number;
};

export type WorkTaskDialogSubmitContext = {
  /** Reused while an identical request has an uncertain or failed result. */
  idempotencyKey: string;
  /** Create-only UI intent. The task and today's plan remain separate writes. */
  addToTodayPlan: boolean;
};

export type WorkTaskDialogProps = {
  open: boolean;
  mode: WorkTaskDialogMode;
  initialValue?: WorkTaskDialogInitialValue;
  /** A user-safe label only. The opaque source reference is never rendered. */
  sourceLabel?: string | null;
  sourceOptions?: readonly WorkTaskSourceOption[];
  disabled?: boolean;
  onClose: () => void;
  onSubmit: (
    value: WorkTaskDialogSubmission,
    context: WorkTaskDialogSubmitContext
  ) => void | Promise<void>;
  onSubmitted?: (value: WorkTaskDialogSubmission) => void;
};

type Draft = {
  title: string;
  description: string;
  priority: PersonalWorkPriority;
  dueAt: string | null;
  checklist?: PersonalWorkChecklistItem[];
};

type Validation = {
  title?: 'required' | 'tooLong';
  description?: 'tooLong';
  checklist?: 'invalid';
};

const TITLE_LIMIT = 500;
const DESCRIPTION_LIMIT = 10_000;

function initialDraft(value?: WorkTaskDialogInitialValue): Draft {
  return {
    title: value?.title ?? '',
    description: value?.description ?? '',
    priority: value?.priority ?? 'NORMAL',
    dueAt: value?.dueAt ?? null,
    ...(value?.checklist ? { checklist: value.checklist.map((entry) => ({ ...entry })) } : {}),
  };
}

export function validateWorkTaskDraft(draft: Draft): Validation {
  const validation: Validation = {};
  if (!draft.title.trim()) validation.title = 'required';
  else if (draft.title.length > TITLE_LIMIT) validation.title = 'tooLong';
  if (draft.description.length > DESCRIPTION_LIMIT) validation.description = 'tooLong';
  if (
    draft.checklist &&
    (draft.checklist.length > 100 ||
      draft.checklist.some((entry) => !entry.title.trim() || entry.title.length > 500))
  )
    validation.checklist = 'invalid';
  return validation;
}

export function workTaskSubmission(
  draft: Draft,
  initial?: WorkTaskDialogInitialValue,
  clearSourceReference = false
): WorkTaskDialogSubmission {
  const description = draft.description.trim();
  const clearLinkedSource = clearSourceReference && Boolean(initial?.sourceReference);
  const multipleSources = initial?.sources !== undefined || initial?.sourceReferences !== undefined;
  return {
    title: draft.title.trim(),
    description: description || null,
    priority: draft.priority,
    dueAt: draft.dueAt,
    ...(multipleSources
      ? {}
      : clearLinkedSource
        ? { clearSourceReference: true }
        : initial?.sourceReference
          ? { sourceReference: initial.sourceReference }
          : {}),
    ...(draft.checklist === undefined
      ? {}
      : { checklist: draft.checklist.map((entry) => ({ ...entry, title: entry.title.trim() })) }),
    ...(initial?.version === undefined ? {} : { version: initial.version }),
  };
}

function requestKey() {
  return crypto.randomUUID();
}

function initialSourceReferences(value?: WorkTaskDialogInitialValue): WorkSourceReference[] {
  if (value?.sourceReferences) return [...value.sourceReferences];
  if (value?.sources)
    return value.sources.flatMap((source) =>
      source.availability === 'UNAVAILABLE' ? [] : [source.reference]
    );
  return value?.sourceReference ? [value.sourceReference] : [];
}

export function WorkTaskDialog({
  open,
  mode,
  initialValue,
  sourceLabel,
  sourceOptions = [],
  disabled = false,
  onClose,
  onSubmit,
  onSubmitted,
}: WorkTaskDialogProps) {
  const { t } = useTranslation('work');
  const dateTimePolicy = useDateTimePolicy();
  const titleCountId = useId();
  const descriptionCountId = useId();
  const sourceUnlinkDescriptionId = useId();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(initialValue));
  const [draftVersion, setDraftVersion] = useState(initialValue?.version);
  const [validationVisible, setValidationVisible] = useState(false);
  const [addToTodayPlan, setAddToTodayPlan] = useState(false);
  const [clearSourceReference, setClearSourceReference] = useState(false);
  const [sources, setSources] = useState<WorkSourceReference[]>(() =>
    initialSourceReferences(initialValue)
  );
  const [sourcesEdited, setSourcesEdited] = useState(false);
  const [clearUnavailable, setClearUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const previousOpen = useRef(false);
  const composing = useRef(false);
  const titleInput = useRef<HTMLInputElement | null>(null);
  const intent = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);

  useEffect(() => {
    const opening = open && !previousOpen.current;
    previousOpen.current = open;
    if (!opening) return;
    setDraft(initialDraft(initialValue));
    setDraftVersion(initialValue?.version);
    setValidationVisible(false);
    setAddToTodayPlan(false);
    setClearSourceReference(false);
    setSources(initialSourceReferences(initialValue));
    setSourcesEdited(false);
    setClearUnavailable(false);
    setSubmitting(false);
    setSubmitFailed(false);
    setDiscardOpen(false);
    intent.current = null;
  }, [initialValue, open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => titleInput.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const initial = useMemo(() => initialDraft(initialValue), [initialValue]);
  const sourceLinked =
    Boolean(initialValue?.sourceReference) &&
    initialValue?.sources === undefined &&
    initialValue?.sourceReferences === undefined;
  const clearLinkedSource = sourceLinked && clearSourceReference;
  const validation = validateWorkTaskDraft(draft);
  const valid = Object.keys(validation).length === 0;
  const conflict = mode === 'edit' && initialValue?.version !== draftVersion;
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initial) ||
    (mode === 'create' && addToTodayPlan) ||
    clearLinkedSource ||
    sourcesEdited;
  const priorityOptions = useMemo(
    () =>
      (['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((value) => ({
        value,
        label: t(`workHub.taskForm.priorities.${value}`),
      })),
    [t]
  );

  const change = (next: Draft) => {
    setDraft(next);
    setSubmitFailed(false);
  };
  const requestClose = () => {
    if (submitting) return;
    if (dirty) setDiscardOpen(true);
    else onClose();
  };
  const submit = async () => {
    setValidationVisible(true);
    if (!valid || submitting || disabled || conflict) return;
    const base = workTaskSubmission(
      draft,
      mode === 'create' && clearLinkedSource
        ? { ...initialValue, sourceReference: null }
        : mode === 'edit'
          ? { ...initialValue, version: draftVersion }
          : initialValue,
      mode === 'edit' && clearLinkedSource
    );
    const value: WorkTaskDialogSubmission =
      sourcesEdited || (mode === 'create' && sources.length > 0 && !sourceLinked)
        ? {
            ...base,
            sourceReference: undefined,
            clearSourceReference: undefined,
            sourceReferences: sources,
          }
        : base;
    const fingerprint = JSON.stringify(value);
    if (intent.current?.fingerprint !== fingerprint) {
      intent.current = { fingerprint, idempotencyKey: requestKey() };
    }
    setSubmitting(true);
    setSubmitFailed(false);
    try {
      await onSubmit(value, {
        idempotencyKey: intent.current.idempotencyKey,
        addToTodayPlan: mode === 'create' && addToTodayPlan,
      });
      onSubmitted?.(value);
    } catch {
      setSubmitFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  const titleError = validationVisible
    ? validation.title === 'required'
      ? t('workHub.taskForm.errors.titleRequired')
      : validation.title === 'tooLong'
        ? t('workHub.taskForm.errors.titleTooLong')
        : undefined
    : undefined;
  const descriptionError =
    validationVisible && validation.description
      ? t('workHub.taskForm.errors.descriptionTooLong')
      : undefined;

  return (
    <>
      <FormDialog
        open={open}
        title={t(`workHub.taskForm.${mode}.title`)}
        description={t(`workHub.taskForm.${mode}.description`)}
        cancelLabel={t('workHub.taskForm.cancel')}
        submitLabel={t(`workHub.taskForm.${mode}.submit`)}
        submittingLabel={t('workHub.taskForm.submitting')}
        busy={submitting}
        submitDisabled={disabled || conflict}
        mobileFullScreen
        onClose={requestClose}
        onSubmit={submit}
      >
        <Stack
          spacing={2}
          onCompositionStartCapture={() => {
            composing.current = true;
          }}
          onCompositionEndCapture={() => {
            composing.current = false;
          }}
          onKeyDownCapture={(event) => {
            if (
              event.key === 'Enter' &&
              (composing.current ||
                (event.nativeEvent as KeyboardEvent).isComposing ||
                (event.nativeEvent as KeyboardEvent).keyCode === 229)
            ) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          {conflict && initialValue && (
            <WorkTaskConflictReview
              latest={initialValue}
              sourceLabel={sourceLabel}
              disabled={submitting || disabled}
              onUseLatest={() => {
                setDraft(initialDraft(initialValue));
                setDraftVersion(initialValue.version);
                setSources(initialSourceReferences(initialValue));
                setSourcesEdited(false);
                setClearSourceReference(false);
                setClearUnavailable(false);
                setSubmitFailed(false);
                intent.current = null;
                requestAnimationFrame(() => titleInput.current?.focus());
              }}
              onKeepDraft={() => {
                setDraftVersion(initialValue.version);
                setSubmitFailed(false);
                intent.current = null;
                requestAnimationFrame(() => titleInput.current?.focus());
              }}
            />
          )}
          {submitFailed && !conflict && (
            <InlineFeedback severity="error">
              {t('workHub.taskForm.errors.submitFailed')}
            </InlineFeedback>
          )}
          <FormField
            autoFocus
            inputRef={titleInput}
            required
            label={t('workHub.taskForm.fields.title')}
            value={draft.title}
            disabled={submitting || disabled}
            inputProps={{ maxLength: TITLE_LIMIT, 'aria-describedby': titleCountId }}
            errorMessage={titleError}
            supportingText={
              <span id={titleCountId}>
                {t('workHub.taskForm.characterCount', {
                  count: draft.title.length,
                  max: TITLE_LIMIT,
                })}
              </span>
            }
            onChange={(event) => change({ ...draft, title: event.target.value })}
          />
          {sourceLinked && (
            <WorkSourceDetailSection
              title={t('workHub.taskSources.title')}
              icon={Link2}
              tone="primary"
            >
              <InlineFeedback severity={clearLinkedSource ? 'warning' : 'info'}>
                {clearLinkedSource
                  ? t('workHub.taskForm.sourceUnlinkPending')
                  : sourceLabel
                    ? t('workHub.taskForm.sourceLinked', { source: sourceLabel })
                    : t('workHub.taskForm.sourceLinkedReferenceOnly')}
              </InlineFeedback>
              <Stack spacing={0.25}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={clearSourceReference}
                      disabled={submitting || disabled}
                      inputProps={{ 'aria-describedby': sourceUnlinkDescriptionId }}
                      onChange={(event) => {
                        setClearSourceReference(event.target.checked);
                        setSubmitFailed(false);
                      }}
                      sx={{ minWidth: 44, minHeight: 44 }}
                    />
                  }
                  label={
                    <Typography component="span" variant="subtitle2">
                      {t('workHub.taskForm.unlinkSource')}
                    </Typography>
                  }
                  sx={{ alignItems: 'center', m: 0 }}
                />
                <Typography
                  id={sourceUnlinkDescriptionId}
                  variant="caption"
                  color="text.secondary"
                  sx={{ pl: 5.5 }}
                >
                  {t('workHub.taskForm.unlinkSourceDescription')}
                </Typography>
              </Stack>
            </WorkSourceDetailSection>
          )}
          <FormField
            multiline
            minRows={3}
            maxRows={10}
            label={t('workHub.taskForm.fields.description')}
            value={draft.description}
            disabled={submitting || disabled}
            inputProps={{
              maxLength: DESCRIPTION_LIMIT,
              'aria-describedby': descriptionCountId,
            }}
            errorMessage={descriptionError}
            supportingText={
              <span id={descriptionCountId}>
                {t('workHub.taskForm.characterCount', {
                  count: draft.description.length,
                  max: DESCRIPTION_LIMIT,
                })}
              </span>
            }
            onChange={(event) => change({ ...draft, description: event.target.value })}
          />
          <DateTimePickerField
            label={t('workHub.taskForm.fields.dueAt')}
            value={draft.dueAt}
            disabled={submitting || disabled}
            supportingText={
              <Stack component="span">
                <span>{t('workHub.taskForm.dueOptional')}</span>
                <span>{t('workHub.schedule.timeZone', { zone: dateTimePolicy.timeZone })}</span>
              </Stack>
            }
            onValueChange={(dueAt) => change({ ...draft, dueAt })}
          />
          <Stack gap={0.5}>
            <Typography variant="caption" color="text.secondary">
              {t('workHub.taskForm.fields.priority')}
            </Typography>
            <ToggleButtonGroup
              value={draft.priority}
              exclusive
              aria-label={t('workHub.taskForm.fields.priority')}
              disabled={submitting || disabled}
              onChange={(_event, priority: PersonalWorkPriority | null) => {
                if (priority) change({ ...draft, priority });
              }}
              sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
            >
              {priorityOptions.map((option) => (
                <ToggleButton
                  key={option.value}
                  value={option.value}
                  sx={{ minHeight: 44, minWidth: 0, px: 0.5 }}
                >
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
          {mode === 'create' && (
            <Box
              sx={{
                p: 1.5,
                bgcolor: 'action.selected',
                borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={addToTodayPlan}
                    disabled={submitting || disabled}
                    onChange={(event) => setAddToTodayPlan(event.target.checked)}
                    sx={{ minWidth: 44, minHeight: 44 }}
                  />
                }
                label={
                  <Stack gap={0.5}>
                    <Typography variant="subtitle2">
                      {t('workHub.taskForm.addToTodayPlan')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('workHub.todayPlan.independenceNotice')}
                    </Typography>
                  </Stack>
                }
                sx={{ alignItems: 'flex-start', m: 0 }}
              />
            </Box>
          )}
          <WorkSourceDetailSection title={t('workHub.checklist.title')} icon={CheckSquare2}>
            <WorkTaskChecklistEditor
              value={draft.checklist ?? []}
              disabled={submitting || disabled}
              onChange={(checklist) => change({ ...draft, checklist })}
            />
            {validationVisible && validation.checklist && (
              <InlineFeedback severity="error" sx={{ mt: 1 }}>
                {t('workHub.checklist.invalid')}
              </InlineFeedback>
            )}
          </WorkSourceDetailSection>
          {!sourceLinked && (
            <WorkSourceDetailSection title={t('workHub.taskSources.title')} icon={Link2}>
              <WorkTaskSourceEditor
                sources={initialValue?.sources ?? []}
                selected={sources}
                options={sourceOptions}
                disabled={submitting || disabled}
                clearUnavailable={clearUnavailable}
                onClearUnavailable={(clear) => {
                  setClearUnavailable(clear);
                  setSourcesEdited(clear);
                  if (!clear) setSources(initialSourceReferences(initialValue));
                }}
                onChange={(next) => {
                  setSources(next);
                  setSourcesEdited(true);
                  setSubmitFailed(false);
                }}
              />
            </WorkSourceDetailSection>
          )}
        </Stack>
      </FormDialog>
      <ConfirmDialog
        open={discardOpen}
        title={t('workHub.taskForm.discard.title')}
        description={t('workHub.taskForm.discard.description')}
        cancelLabel={t('workHub.taskForm.discard.keepEditing')}
        confirmLabel={t('workHub.taskForm.discard.confirm')}
        intent="danger"
        onClose={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          onClose();
        }}
      />
    </>
  );
}
