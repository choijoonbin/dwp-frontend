import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ListPlus } from 'lucide-react';
import {
  ActionButton,
  FormField,
  foundationTokens,
  InlineFeedback,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { WorkTaskDialogProps } from './work-task-dialog';
import { WorkTaskQuickFlow } from './work-task-quick-flow';
import { WorkTaskScheduleFollowUp } from './work-task-schedule-follow-up';

const titleLimit = 500;

function requestKey() {
  return crypto.randomUUID();
}

export function WorkHubMobileQuickCapture({
  canScheduleAfterCreate,
  disabled = false,
  onCancel,
  onSubmit,
}: {
  canScheduleAfterCreate: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: WorkTaskDialogProps['onSubmit'];
}) {
  const { t } = useTranslation('work');
  const [title, setTitle] = useState('');
  const [titleFocused, setTitleFocused] = useState(false);
  const [addToTodayPlan, setAddToTodayPlan] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const composing = useRef(false);
  const intent = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);

  const trimmedTitle = title.trim();
  const valid = trimmedTitle.length > 0 && title.length <= titleLimit;
  const submit = async () => {
    if (!valid || submitting || disabled) return;
    const value = {
      title: trimmedTitle,
      description: null,
      priority: 'NORMAL' as const,
      dueAt: null,
    };
    const fingerprint = JSON.stringify(value);
    if (intent.current?.fingerprint !== fingerprint) {
      intent.current = { fingerprint, idempotencyKey: requestKey() };
    }
    setSubmitting(true);
    setFailed(false);
    try {
      await onSubmit(value, {
        idempotencyKey: intent.current.idempotencyKey,
        addToTodayPlan,
        scheduleAfterCreate: canScheduleAfterCreate,
      });
      intent.current = null;
      setTitle('');
      setTitleFocused(false);
      setAddToTodayPlan(true);
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="work-mobile-quick-capture-title"
      sx={{ p: 1.5, borderRadius: foundationTokens.radius.surface * 2 + 'px' }}
    >
      <Stack gap={1.5}>
        <WorkTaskQuickFlow
          taskEntryActive={titleFocused || trimmedTitle.length > 0}
          planReady={addToTodayPlan && trimmedTitle.length > 0 && !titleFocused}
          scheduling={submitting && canScheduleAfterCreate}
        />
        <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" gap={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            <ListPlus size={18} aria-hidden="true" />
            <Typography
              id="work-mobile-quick-capture-title"
              component="h2"
              variant="subtitle2"
              sx={{ fontWeight: 'fontWeightBold' }}
            >
              {t('workHub.taskForm.quickCapture.title')}
            </Typography>
          </Stack>
          <Chip size="small" label={t('workHub.taskForm.quickCapture.inputMode')} />
        </Stack>
        {failed && (
          <InlineFeedback severity="error">
            {t('workHub.taskForm.errors.submitFailed')}
          </InlineFeedback>
        )}
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
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
          <Stack gap={1}>
            <FormField
              required
              label={t('workHub.taskForm.fields.title')}
              placeholder={t('workHub.taskForm.quickCapture.placeholder')}
              value={title}
              disabled={submitting || disabled}
              inputProps={{ maxLength: titleLimit }}
              supportingText={t('workHub.taskForm.characterCount', {
                count: title.length,
                max: titleLimit,
              })}
              onChange={(event) => {
                setTitle(event.target.value);
                setFailed(false);
              }}
              onFocus={() => setTitleFocused(true)}
              onBlur={() => setTitleFocused(false)}
            />
            <Box
              sx={{
                bgcolor: 'action.selected',
                borderRadius: foundationTokens.radius.surface + 'px',
                px: 1,
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
                label={t('workHub.taskForm.addToTodayPlan')}
                sx={{ width: 1, m: 0 }}
              />
            </Box>
            <WorkTaskScheduleFollowUp available={canScheduleAfterCreate} />
            <Stack direction="row" gap={1}>
              <ActionButton
                type="submit"
                intent="primary"
                startIcon={<Check size={17} aria-hidden="true" />}
                loading={submitting}
                loadingLabel={t('workHub.taskForm.submitting')}
                disabled={!valid || disabled}
                sx={{ flex: 1, minHeight: 44 }}
              >
                {t('workHub.taskForm.quickCapture.save')}
              </ActionButton>
              <ActionButton
                intent="quiet"
                disabled={submitting}
                onClick={onCancel}
                sx={{ minWidth: 72, minHeight: 44 }}
              >
                {t('workHub.taskForm.cancel')}
              </ActionButton>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
