import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormDialog, FormField } from '@dwp-frontend/design-system';
import { createSpaceContent, useToast } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import type { SpaceContent } from '@dwp-frontend/shared-utils';

export function CreateSpaceContentDialog({
  open,
  spaceKey,
  onClose,
}: {
  open: boolean;
  spaceKey: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('spaces');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState<SpaceContent['contentType']>('POST');
  const [classification, setClassification] = useState('INTERNAL');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      createSpaceContent(spaceKey, {
        contentType: type,
        title,
        summary,
        dataClassification: classification,
        content: { body: summary },
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['spaces', 'detail', spaceKey] }),
        queryClient.invalidateQueries({ queryKey: ['spaces', 'content', spaceKey] }),
      ]);
      toast.success(t('content.created'));
      onClose();
    },
    onError: () => toast.error(t('content.error')),
  });

  return (
    <FormDialog
      open={open}
      title={t('content.createTitle')}
      description={t('content.createDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.publish')}
      submittingLabel={t('actions.publish')}
      busy={mutation.isPending}
      submitDisabled={title.trim().length < 2 || summary.trim().length < 10}
      maxWidth="sm"
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
    >
      <Stack gap={2}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
          }}
        >
          <FormField
            select
            SelectProps={{ native: true }}
            label={t('content.type')}
            value={type}
            onChange={(event) => setType(event.target.value as SpaceContent['contentType'])}
          >
            {(['POST', 'PAGE', 'DECISION', 'LINK', 'CANVAS'] as const).map((value) => (
              <option key={value} value={value}>
                {t(`content.types.${value}`)}
              </option>
            ))}
          </FormField>
          <FormField
            select
            SelectProps={{ native: true }}
            label={t('content.classification')}
            value={classification}
            onChange={(event) => setClassification(event.target.value)}
          >
            {['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].map((value) => (
              <option key={value} value={value}>
                {t(`classification.${value}`)}
              </option>
            ))}
          </FormField>
        </Box>
        <FormField
          autoFocus
          label={t('content.title')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          inputProps={{ maxLength: 180 }}
        />
        <FormField
          label={t('content.summary')}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          multiline
          minRows={5}
          required
          inputProps={{ maxLength: 2000 }}
          supportingText={t('content.reviewHelp')}
        />
      </Stack>
    </FormDialog>
  );
}
