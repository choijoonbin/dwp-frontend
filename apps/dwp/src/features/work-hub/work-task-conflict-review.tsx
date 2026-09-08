import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type {
  PersonalWorkChecklistItem,
  PersonalWorkPriority,
  PersonalWorkSource,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

export function WorkTaskConflictReview({
  latest,
  sourceLabel,
  disabled,
  onUseLatest,
  onKeepDraft,
}: {
  latest: {
    title?: string;
    description?: string | null;
    priority?: PersonalWorkPriority;
    dueAt?: string | null;
    checklist?: PersonalWorkChecklistItem[];
    sources?: PersonalWorkSource[];
    sourceReference?: WorkSourceReference | null;
  };
  sourceLabel?: string | null;
  disabled: boolean;
  onUseLatest: () => void;
  onKeepDraft: () => void;
}) {
  const { t } = useTranslation('work');
  const headingId = useId();
  const reviewRegion = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    reviewRegion.current?.focus();
  }, []);
  const sources =
    latest.sources?.map((source) =>
      source.availability === 'AVAILABLE' ? source.title : t('workHub.personal.sourceUnavailable')
    ) ?? (latest.sourceReference ? [sourceLabel || t('workHub.personal.referenceOnly')] : []);
  const fields = [
    [t('workHub.taskForm.fields.title'), latest.title ?? ''],
    [
      t('workHub.taskForm.fields.description'),
      latest.description || t('workHub.personal.noDescription'),
    ],
    [
      t('workHub.taskForm.fields.priority'),
      t(`workHub.taskForm.priorities.${latest.priority ?? 'NORMAL'}`),
    ],
    [
      t('workHub.taskForm.fields.dueAt'),
      latest.dueAt
        ? formatDate(latest.dueAt, { dateStyle: 'medium', timeStyle: 'short' })
        : t('workHub.todayPlan.noDueDate'),
    ],
    [t('workHub.taskSources.title'), sources.join('\n') || t('workHub.taskSources.empty')],
  ];
  return (
    <Stack gap={1.5}>
      <InlineFeedback severity="warning">{t('workHub.taskForm.conflict.notice')}</InlineFeedback>
      <Typography id={headingId} component="h3" variant="subtitle2">
        {t('workHub.taskForm.conflict.latest')}
      </Typography>
      <Box
        ref={reviewRegion}
        role="region"
        aria-labelledby={headingId}
        tabIndex={0}
        sx={{
          maxHeight: 280,
          overflowY: 'auto',
          p: 1.5,
          bgcolor: 'action.hover',
          borderRadius: 'var(--dwp-shape-borderRadius)',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        }}
      >
        <Box component="dl" sx={{ m: 0 }}>
          {fields.map(([label, value]) => (
            <Box key={label} sx={{ mb: 1.5 }}>
              <Typography component="dt" variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography
                component="dd"
                variant="body2"
                sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
              >
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t('workHub.checklist.title')}
        </Typography>
        {latest.checklist?.length ? (
          <Stack component="ul" gap={0.75} sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {latest.checklist.map((entry) => (
              <Stack
                key={entry.itemId}
                component="li"
                direction="row"
                gap={0.75}
                alignItems="flex-start"
                aria-label={`${entry.title}: ${t(`workHub.lifecycle.${entry.completed ? 'COMPLETED' : 'OPEN'}`)}`}
              >
                {entry.completed ? (
                  <CheckCircle2 size={16} aria-hidden="true" />
                ) : (
                  <Circle size={16} aria-hidden="true" />
                )}
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere', minWidth: 0 }}>
                  {entry.title}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2">{t('workHub.checklist.empty')}</Typography>
        )}
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        <ActionButton
          intent="secondary"
          disabled={disabled}
          onClick={onUseLatest}
          sx={{ minHeight: 44 }}
        >
          {t('workHub.taskForm.conflict.useLatest')}
        </ActionButton>
        <ActionButton
          intent="quiet"
          disabled={disabled}
          onClick={onKeepDraft}
          sx={{ minHeight: 44 }}
        >
          {t('workHub.taskForm.conflict.keepDraft')}
        </ActionButton>
      </Stack>
    </Stack>
  );
}
