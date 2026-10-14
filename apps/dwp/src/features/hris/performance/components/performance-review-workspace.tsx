import { useEffect, useRef, useState } from 'react';
import { ClipboardCheck, RefreshCw, Save, Send } from 'lucide-react';
import {
  ActionButton,
  GlyphSurface,
  InlineFeedback,
  LiveStatus,
  OperationalContextBar,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PerformanceReviewAnswerField } from './performance-review-answer-fields';

import type { PerformanceReviewFailure } from '../hooks/use-performance-review';
import type {
  AssignedPerformanceReview,
  PerformanceReviewAnswer,
  PerformanceReviewSubmission,
  PerformanceReviewValidation,
} from '../model/performance-review-types';

export type PerformanceReviewWorkspaceViewProps = Readonly<{
  review?: AssignedPerformanceReview;
  answers: readonly PerformanceReviewAnswer[];
  validation: PerformanceReviewValidation;
  validationVisible: boolean;
  submission: PerformanceReviewSubmission | null;
  dirty: boolean;
  pendingKind: 'SAVE_DRAFT' | 'SUBMIT' | null;
  commandBusy: boolean;
  commandConnected: boolean;
  feedback: 'SAVED' | 'SUBMITTED' | null;
  loadFailure: PerformanceReviewFailure | null;
  commandFailure: PerformanceReviewFailure | null;
  denied: boolean;
  loading: boolean;
  fetching: boolean;
  empty: boolean;
  partial: boolean;
  onAnswerChange: (itemKey: string, answer: PerformanceReviewAnswer | null) => void;
  onSaveDraft: () => Promise<boolean>;
  onSubmit: () => Promise<boolean>;
  onRetryPending: () => Promise<boolean>;
  onReload: () => Promise<boolean>;
  onDiscardAndReload: () => Promise<boolean>;
}>;

function formatDue(value: string | null | undefined): string {
  if (!value) return 'No due date';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function StatePanel({
  title,
  description,
  busy = false,
  onRetry,
}: Readonly<{
  title: string;
  description: string;
  busy?: boolean;
  onRetry?: () => void;
}>) {
  return (
    <Paper
      component="section"
      role={busy ? 'status' : 'alert'}
      aria-live={busy ? 'polite' : 'assertive'}
      aria-busy={busy || undefined}
      variant="outlined"
      sx={{ p: { xs: 2, sm: 3 }, minHeight: 160, display: 'grid', alignContent: 'center' }}
    >
      <Typography component="h2" variant="h5">
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        {description}
      </Typography>
      {onRetry && (
        <Box sx={{ mt: 2 }}>
          <ActionButton intent="secondary" startIcon={<RefreshCw size={16} />} onClick={onRetry}>
            Try again
          </ActionButton>
        </Box>
      )}
    </Paper>
  );
}

function ReviewForm({
  review,
  answers,
  validation,
  validationVisible,
  disabled,
  onAnswerChange,
}: Pick<
  PerformanceReviewWorkspaceViewProps,
  'review' | 'answers' | 'validation' | 'validationVisible' | 'onAnswerChange'
> & { review: AssignedPerformanceReview; disabled: boolean }) {
  const issueByItem = new Map(validation.issues.map((issue) => [issue.itemKey, issue]));
  const sections = review.form.items.filter((item) => item.kind === 'SECTION');
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(12rem, 0.28fr) minmax(0, 1fr)' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Paper
        component="nav"
        aria-label="Review form sections"
        variant="outlined"
        sx={{ p: 1.5, position: { md: 'sticky' }, top: { md: 16 } }}
      >
        <Typography component="h2" variant="subtitle2" sx={{ px: 1, pb: 1 }}>
          Form navigation
        </Typography>
        <Stack gap={0.5}>
          {(sections.length > 0 ? sections : review.form.items.slice(0, 1)).map((item) => (
            <Button
              key={item.itemKey}
              component="a"
              href={'#performance-review-sequence-' + String(item.sequence)}
              color="inherit"
              sx={{ justifyContent: 'flex-start', textAlign: 'left', overflowWrap: 'anywhere' }}
            >
              {item.label}
            </Button>
          ))}
        </Stack>
      </Paper>

      <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
        <Stack gap={3}>
          {review.form.items.map((item) => {
            if (item.kind === 'SECTION') {
              return (
                <Box
                  key={item.itemKey}
                  id={'performance-review-sequence-' + String(item.sequence)}
                  sx={{ scrollMarginTop: 16 }}
                >
                  <Typography component="h2" variant="h6">
                    {item.label}
                  </Typography>
                  {item.helpText && (
                    <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                      {item.helpText}
                    </Typography>
                  )}
                </Box>
              );
            }
            return (
              <Box
                key={item.itemKey}
                id={'performance-review-sequence-' + String(item.sequence)}
                sx={{ minWidth: 0, scrollMarginTop: 16 }}
              >
                <PerformanceReviewAnswerField
                  item={item}
                  form={review.form}
                  answer={answers.find((answer) => answer.itemKey === item.itemKey)}
                  issue={validationVisible ? issueByItem.get(item.itemKey) : undefined}
                  disabled={disabled}
                  onChange={(answer) => onAnswerChange(item.itemKey, answer)}
                />
              </Box>
            );
          })}
        </Stack>
      </Paper>
    </Box>
  );
}

export function PerformanceReviewWorkspaceView(props: PerformanceReviewWorkspaceViewProps) {
  const {
    review,
    answers,
    validation,
    validationVisible,
    submission,
    dirty,
    pendingKind,
    commandBusy,
    commandConnected,
    feedback,
    loadFailure,
    commandFailure,
    denied,
    loading,
    fetching,
    empty,
    partial,
    onAnswerChange,
    onSaveDraft,
    onSubmit,
    onRetryPending,
    onReload,
    onDiscardAndReload,
  } = props;
  const [acknowledged, setAcknowledged] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const validationSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAcknowledged(false);
    setDiscardDialogOpen(false);
    setDiscarding(false);
  }, [review?.reviewId, review?.aggregateVersion]);
  useEffect(() => {
    if (!dirty) setDiscardDialogOpen(false);
  }, [dirty]);

  if (loading) {
    return (
      <StatePanel
        title="Loading assigned review"
        description="Checking the current assignment and protected review fields."
        busy
      />
    );
  }
  if (empty) {
    return (
      <StatePanel
        title="Select an assigned review"
        description="Open a review assignment to load its governed form."
      />
    );
  }
  if (denied && !review) {
    return (
      <StatePanel
        title="Review unavailable"
        description="This review is absent or outside your current assignment."
      />
    );
  }
  if (!review) {
    return (
      <StatePanel
        title="Review could not be loaded"
        description={loadFailure?.message ?? 'The assigned review is temporarily unavailable.'}
        onRetry={() => void onReload()}
      />
    );
  }

  const readOnly = !review.writable || submission !== null || review.state === 'SUBMITTED';
  const actionDisabled =
    readOnly || fetching || commandBusy || pendingKind !== null || !commandConnected;
  const liveMessage =
    feedback === 'SAVED'
      ? 'Draft saved.'
      : feedback === 'SUBMITTED'
        ? 'Review submitted.'
        : dirty
          ? 'Unsaved changes.'
          : 'Draft is current.';
  const submitReview = async () => {
    const completed = await onSubmit();
    if (!completed) {
      globalThis.setTimeout(() => validationSummaryRef.current?.focus(), 0);
    }
  };
  const requestReload = () => {
    if (dirty) {
      setDiscardDialogOpen(true);
      return;
    }
    void onReload();
  };
  const discardAndReload = async () => {
    setDiscarding(true);
    try {
      if (await onDiscardAndReload()) setDiscardDialogOpen(false);
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <Stack
      gap={2}
      data-testid="performance-review-workspace"
      sx={{
        minWidth: 0,
        overflowWrap: 'anywhere',
        '@media (prefers-reduced-motion: reduce)': {
          '& *, & *::before, & *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            scrollBehavior: 'auto !important',
            transitionDuration: '0.01ms !important',
          },
        },
        '@media (forced-colors: active)': {
          '& :focus-visible': { outline: '2px solid CanvasText' },
        },
      }}
    >
      <Paper component="header" variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }}>
          <GlyphSurface size={44} variant="soft">
            <ClipboardCheck size={22} aria-hidden="true" />
          </GlyphSurface>
          <Box minWidth={0} flex={1}>
            <Typography variant="overline" color="text.secondary">
              Assigned performance review
            </Typography>
            <Typography component="h1" variant="h4" sx={{ overflowWrap: 'anywhere' }}>
              {review.stageKey.replaceAll('_', ' ')}
            </Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
              {review.reviewerType.replaceAll('_', ' ')} · {formatDue(review.dueAt)}
            </Typography>
          </Box>
          <Typography
            component="span"
            variant="caption"
            sx={{ px: 1.25, py: 0.75, borderRadius: 1, bgcolor: 'action.hover' }}
          >
            {review.state.replaceAll('_', ' ')}
          </Typography>
        </Stack>
      </Paper>

      <OperationalContextBar
        label="Assigned review context"
        items={[
          { label: 'Template', value: review.form.schemaVersion },
          { label: 'Version', value: String(review.aggregateVersion) },
          {
            label: 'Questions',
            value: String(review.form.items.filter((item) => item.kind !== 'SECTION').length),
          },
        ]}
        status={
          <LiveStatus
            state={partial ? 'degraded' : 'live'}
            label={partial ? 'Partially available' : 'Assignment verified'}
            refreshLabel="Reload latest review"
            refreshing={fetching}
            onRefresh={commandBusy || pendingKind !== null ? undefined : requestReload}
          />
        }
      />

      {!commandConnected && (
        <InlineFeedback severity="info" title="Draft actions are not connected">
          The review stays read-only until the governed command executor is available.
        </InlineFeedback>
      )}
      {partial && (
        <InlineFeedback severity="warning" title="Some review data may be stale">
          Your loaded draft remains visible. Reload before making a final submission.
        </InlineFeedback>
      )}
      {commandFailure && (
        <InlineFeedback
          severity={commandFailure.kind === 'INVALID' ? 'warning' : 'error'}
          title={commandFailure.kind === 'CONFLICT' ? 'Review changed' : 'Review action incomplete'}
        >
          <Stack gap={1} alignItems="flex-start">
            <span>{commandFailure.message}</span>
            {commandFailure.kind === 'RETRYABLE' && pendingKind && (
              <ActionButton
                intent="secondary"
                loading={commandBusy}
                disabled={commandBusy}
                onClick={() => void onRetryPending()}
              >
                Retry same request
              </ActionButton>
            )}
            {commandFailure.kind === 'CONFLICT' && (
              <ActionButton intent="secondary" onClick={requestReload}>
                Reload latest draft
              </ActionButton>
            )}
          </Stack>
        </InlineFeedback>
      )}
      {validationVisible && !validation.valid && (
        <Box
          ref={validationSummaryRef}
          role="alert"
          tabIndex={-1}
          sx={{
            p: 2,
            border: 1,
            borderColor: 'error.main',
            borderRadius: 1.5,
            '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main' },
          }}
        >
          <Typography component="h2" variant="subtitle1">
            Complete {validation.issues.length} review item
            {validation.issues.length === 1 ? '' : 's'}
          </Typography>
          <Box component="ul" sx={{ mb: 0, pl: 3 }}>
            {validation.issues.map((issue) => {
              const item = review.form.items.find(
                (candidate) => candidate.itemKey === issue.itemKey
              );
              const targetId =
                'performance-review-item-' +
                String(item?.sequence ?? 0) +
                (item?.kind === 'RATING' || item?.kind === 'CHOICE' ? '-option-0' : '');
              return (
                <li key={issue.itemKey + ':' + issue.code}>
                  <a
                    href={'#' + targetId}
                    onClick={(event) => {
                      event.preventDefault();
                      document.getElementById(targetId)?.focus();
                    }}
                  >
                    {item?.label ?? issue.itemKey}: {issue.message}
                  </a>
                </li>
              );
            })}
          </Box>
        </Box>
      )}

      <ReviewForm
        review={review}
        answers={answers}
        validation={validation}
        validationVisible={validationVisible}
        disabled={readOnly || commandBusy || pendingKind !== null || !commandConnected}
        onAnswerChange={onAnswerChange}
      />

      <Paper component="section" aria-label="Review submission" variant="outlined" sx={{ p: 2 }}>
        <Stack gap={1.5}>
          <Box role="status" aria-live="polite" aria-atomic="true">
            <Typography variant="body2" color="text.secondary">
              {liveMessage}
            </Typography>
          </Box>
          {submission && (
            <InlineFeedback severity="success" title="Review submitted">
              Submission {submission.submissionNo} was recorded at{' '}
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(submission.submittedAt))}
              .
            </InlineFeedback>
          )}
          {!readOnly && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={acknowledged}
                  disabled={commandBusy || pendingKind !== null || !commandConnected}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
              }
              label="I understand that submission is final and uses the saved draft."
            />
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <ActionButton
              intent="secondary"
              loading={commandBusy && pendingKind === 'SAVE_DRAFT'}
              disabled={actionDisabled || !dirty}
              startIcon={<Save size={16} aria-hidden="true" />}
              onClick={() => void onSaveDraft()}
            >
              Save draft
            </ActionButton>
            <ActionButton
              intent="primary"
              loading={commandBusy && pendingKind === 'SUBMIT'}
              disabled={actionDisabled || partial || dirty || !acknowledged}
              startIcon={<Send size={16} aria-hidden="true" />}
              onClick={() => void submitReview()}
            >
              Submit review
            </ActionButton>
          </Stack>
        </Stack>
      </Paper>
      <Dialog
        open={discardDialogOpen}
        onClose={discarding ? undefined : () => setDiscardDialogOpen(false)}
        aria-labelledby="performance-review-discard-title"
        aria-describedby="performance-review-discard-description"
      >
        <DialogTitle id="performance-review-discard-title">Discard unsaved changes?</DialogTitle>
        <DialogContent>
          <DialogContentText id="performance-review-discard-description">
            Reloading replaces your unsaved answers with the latest authoritative draft.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={discarding} onClick={() => setDiscardDialogOpen(false)}>
            Keep editing
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={discarding}
            onClick={() => void discardAndReload()}
          >
            Discard changes and reload
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
