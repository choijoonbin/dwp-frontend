import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ConfirmDialog,
  DateTimePickerField,
  FormDialog,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';

import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  PersonalWorkPriority,
  PersonalWorkTaskInput,
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
};

type Validation = { title?: 'required' | 'tooLong'; description?: 'tooLong' };

const TITLE_LIMIT = 500;
const DESCRIPTION_LIMIT = 10_000;

function initialDraft(value?: WorkTaskDialogInitialValue): Draft {
  return {
    title: value?.title ?? '',
    description: value?.description ?? '',
    priority: value?.priority ?? 'NORMAL',
    dueAt: value?.dueAt ?? null,
  };
}

export function validateWorkTaskDraft(draft: Draft): Validation {
  const validation: Validation = {};
  if (!draft.title.trim()) validation.title = 'required';
  else if (draft.title.length > TITLE_LIMIT) validation.title = 'tooLong';
  if (draft.description.length > DESCRIPTION_LIMIT) validation.description = 'tooLong';
  return validation;
}

export function workTaskSubmission(
  draft: Draft,
  initial?: WorkTaskDialogInitialValue,
  clearSourceReference = false
): WorkTaskDialogSubmission {
  const description = draft.description.trim();
  const clearLinkedSource = clearSourceReference && Boolean(initial?.sourceReference);
  return {
    title: draft.title.trim(),
    description: description || null,
    priority: draft.priority,
    dueAt: draft.dueAt,
    ...(clearLinkedSource
      ? { clearSourceReference: true }
      : initial?.sourceReference
        ? { sourceReference: initial.sourceReference }
        : {}),
    ...(initial?.version === undefined ? {} : { version: initial.version }),
  };
}

function requestKey() {
  return crypto.randomUUID();
}

export function WorkTaskDialog({
  open,
  mode,
  initialValue,
  sourceLabel,
  disabled = false,
  onClose,
  onSubmit,
  onSubmitted,
}: WorkTaskDialogProps) {
  const { t } = useTranslation('work');
  const titleCountId = useId();
  const descriptionCountId = useId();
  const sourceUnlinkDescriptionId = useId();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(initialValue));
  const [validationVisible, setValidationVisible] = useState(false);
  const [addToTodayPlan, setAddToTodayPlan] = useState(false);
  const [clearSourceReference, setClearSourceReference] = useState(false);
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
    setValidationVisible(false);
    setAddToTodayPlan(false);
    setClearSourceReference(false);
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
  const sourceLinked = Boolean(initialValue?.sourceReference);
  const clearLinkedSource = mode === 'edit' && sourceLinked && clearSourceReference;
  const validation = validateWorkTaskDraft(draft);
  const valid = Object.keys(validation).length === 0;
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initial) ||
    (mode === 'create' && addToTodayPlan) ||
    clearLinkedSource;
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
    if (!valid || submitting || disabled) return;
    const value = workTaskSubmission(draft, initialValue, clearLinkedSource);
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
        submitDisabled={disabled}
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
              (composing.current || (event.nativeEvent as KeyboardEvent).isComposing)
            ) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          {submitFailed && (
            <InlineFeedback severity="error">
              {t('workHub.taskForm.errors.submitFailed')}
            </InlineFeedback>
          )}
          {sourceLinked && (
            <>
              <InlineFeedback severity={clearLinkedSource ? 'warning' : 'info'}>
                {clearLinkedSource
                  ? t('workHub.taskForm.sourceUnlinkPending')
                  : sourceLabel
                    ? t('workHub.taskForm.sourceLinked', { source: sourceLabel })
                    : t('workHub.taskForm.sourceLinkedReferenceOnly')}
              </InlineFeedback>
              {mode === 'edit' && (
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
              )}
            </>
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
          <FormField
            multiline
            minRows={4}
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
          <SelectField
            label={t('workHub.taskForm.fields.priority')}
            value={draft.priority}
            options={priorityOptions}
            disabled={submitting || disabled}
            onValueChange={(value) => {
              if (value) change({ ...draft, priority: value });
            }}
          />
          <DateTimePickerField
            label={t('workHub.taskForm.fields.dueAt')}
            value={draft.dueAt}
            disabled={submitting || disabled}
            supportingText={t('workHub.taskForm.dueOptional')}
            onValueChange={(dueAt) => change({ ...draft, dueAt })}
          />
          {mode === 'create' && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={addToTodayPlan}
                  disabled={submitting || disabled}
                  onChange={(event) => setAddToTodayPlan(event.target.checked)}
                  sx={{ minWidth: 44, minHeight: 44 }}
                />
              }
              label={t('workHub.taskForm.addToTodayPlan')}
              sx={{ alignItems: 'flex-start', m: 0 }}
            />
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
