import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormDialog, FormField, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { WorkHubItem } from './work-hub-contracts';

export function WorkHubAssistDialog({
  open,
  item,
  verifiedAt,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  item: WorkHubItem | null;
  verifiedAt: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (question: string) => void | Promise<void>;
}) {
  const { t } = useTranslation(['work', 'common']);
  const [question, setQuestion] = useState('');
  const composing = useRef(false);
  useEffect(() => {
    if (!open) setQuestion('');
  }, [open]);
  const lengthError = question.length > 2_000;
  const invalid = question.trim().length < 2 || lengthError;
  if (!item) return null;
  return (
    <FormDialog
      open={open}
      title={t('work:workHub.assist.title')}
      description={t('work:workHub.assist.description')}
      cancelLabel={t('common:actions.cancel')}
      submitLabel={t('work:workHub.assist.submit')}
      submittingLabel={t('work:workHub.assist.submitting')}
      busy={busy}
      submitDisabled={invalid}
      onClose={onClose}
      onSubmit={() => onSubmit(question.trim())}
      mobileFullScreen
    >
      <Box sx={{ p: 2, mb: 2, bgcolor: 'action.hover', borderRadius: 'shape.borderRadius' }}>
        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mb: 1 }}>
          <Chip
            size="small"
            variant="outlined"
            label={t(`work:workHub.sources.${item.reference.sourceSystem}`, {
              defaultValue: t('work:workHub.sources.OTHER'),
            })}
          />
          <Chip
            size="small"
            variant="outlined"
            label={t(`work:workHub.lifecycle.${item.lifecycle}`)}
          />
        </Stack>
        <Typography variant="subtitle2">{item.title}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {verifiedAt
            ? t('work:workHub.assist.verifiedAt', {
                date: formatDate(verifiedAt, { dateStyle: 'medium', timeStyle: 'short' }),
              })
            : t('work:workHub.assist.verificationRequired')}
        </Typography>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mb: 1.5 }}>
        {[
          t('work:workHub.assist.prompts.risk'),
          t('work:workHub.assist.prompts.draft'),
          t('work:workHub.assist.prompts.evidence'),
        ].map((prompt) => (
          <Chip
            key={prompt}
            label={prompt}
            disabled={busy}
            onClick={() => setQuestion(prompt)}
            sx={{ minHeight: 44 }}
          />
        ))}
      </Stack>
      {error && (
        <InlineFeedback severity="error" sx={{ mb: 2 }}>
          {error}
        </InlineFeedback>
      )}
      <FormField
        autoFocus
        multiline
        minRows={5}
        label={t('work:workHub.assist.question')}
        supportingText={t('work:workHub.assist.help', { count: question.length })}
        errorMessage={lengthError ? t('work:workHub.assist.tooLong') : undefined}
        value={question}
        disabled={busy}
        onChange={(event) => setQuestion(event.target.value)}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing)) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (event.key === 'Enter' && !event.shiftKey && !invalid && !busy) {
            event.preventDefault();
            void onSubmit(question.trim());
          }
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        {t('work:workHub.assist.safety')}
      </Typography>
    </FormDialog>
  );
}
