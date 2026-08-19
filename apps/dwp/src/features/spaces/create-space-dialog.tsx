import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Sparkles } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormDialog, FormField } from '@dwp-frontend/design-system';
import { createSpaceRequest, getSpaceTemplates, useToast } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { SpaceGlyph, localizedSpace } from './space-ui';

import type { SpaceSummary } from '@dwp-frontend/shared-utils';

type CreateSpaceDialogProps = {
  open: boolean;
  onClose: () => void;
};

const SLUG_PATTERN = /^[a-z][a-z0-9-]{2,47}$/;

export function CreateSpaceDialog({ open, onClose }: CreateSpaceDialogProps) {
  const { t, i18n } = useTranslation('spaces');
  const toast = useToast();
  const queryClient = useQueryClient();
  const templates = useQuery({
    queryKey: ['spaces', 'templates'],
    queryFn: getSpaceTemplates,
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [summary, setSummary] = useState('');
  const [justification, setJustification] = useState('');
  const [visibility, setVisibility] = useState<SpaceSummary['visibility']>('REQUEST');

  const selected = useMemo(
    () => templates.data?.find((template) => template.templateId === templateId),
    [templateId, templates.data]
  );

  useEffect(() => {
    if (!open || templateId || !templates.data?.length) return;
    const initial = templates.data[0];
    setTemplateId(initial.templateId);
    setVisibility(initial.defaultVisibility);
  }, [open, templateId, templates.data]);

  const mutation = useMutation({
    mutationFn: () =>
      createSpaceRequest({
        templateId,
        requestedKey: key,
        requestedName: name,
        requestedSummary: summary,
        requestedVisibility: visibility,
        justification,
      }),
    onSuccess: async (request) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['spaces', 'home'] }),
        queryClient.invalidateQueries({ queryKey: ['spaces', 'requests'] }),
        queryClient.invalidateQueries({ queryKey: ['spaces', 'directory'] }),
      ]);
      toast.success(t(request.status === 'APPROVED' ? 'create.created' : 'create.submitted'));
      onClose();
    },
    onError: () => toast.error(t('create.error')),
  });

  const chooseTemplate = (nextId: string) => {
    setTemplateId(nextId);
    const next = templates.data?.find((template) => template.templateId === nextId);
    if (next) setVisibility(next.defaultVisibility);
  };
  const valid = Boolean(
    templateId &&
    name.trim().length >= 2 &&
    SLUG_PATTERN.test(key) &&
    summary.trim().length >= 10 &&
    justification.trim().length >= 10
  );

  return (
    <FormDialog
      open={open}
      title={t('create.title')}
      description={t('create.description')}
      cancelLabel={t('actions.cancel')}
      submitLabel={selected?.creationMode === 'AUTO' ? t('actions.create') : t('actions.request')}
      submittingLabel={
        selected?.creationMode === 'AUTO' ? t('actions.create') : t('actions.request')
      }
      busy={mutation.isPending}
      submitDisabled={!valid}
      maxWidth="md"
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
    >
      <Stack gap={3}>
        {templates.isError && <Alert severity="error">{t('create.templatesError')}</Alert>}
        <FormControl>
          <FormLabel>{t('create.template')}</FormLabel>
          <RadioGroup
            value={templateId}
            onChange={(event) => chooseTemplate(event.target.value)}
            sx={{
              mt: 1,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            {templates.data?.map((template) => {
              const label = localizedSpace(
                {
                  nameKo: template.nameKo,
                  nameEn: template.nameEn,
                  summaryKo: template.descriptionKo,
                  summaryEn: template.descriptionEn,
                },
                i18n.resolvedLanguage ?? i18n.language
              );
              const checked = template.templateId === templateId;
              return (
                <FormControlLabel
                  key={template.templateId}
                  value={template.templateId}
                  control={<Radio sx={{ position: 'absolute', opacity: 0 }} />}
                  label={
                    <Stack direction="row" gap={1.5} alignItems="flex-start">
                      <SpaceGlyph
                        iconKey={template.iconKey}
                        accentToken={template.accentToken}
                        size={42}
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" alignItems="center" gap={0.75}>
                          <Typography fontWeight={750}>{label.name}</Typography>
                          {checked && <Check size={16} color="currentColor" />}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                          {label.summary}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t(`creationMode.${template.creationMode}`)}
                        </Typography>
                      </Box>
                    </Stack>
                  }
                  sx={{
                    m: 0,
                    p: 1.5,
                    minHeight: 104,
                    alignItems: 'flex-start',
                    border: 1,
                    borderColor: checked ? 'primary.main' : 'divider',
                    bgcolor: checked ? 'primary.50' : 'background.paper',
                    borderRadius: 1,
                    '& .MuiFormControlLabel-label': { width: 1 },
                  }}
                />
              );
            })}
          </RadioGroup>
        </FormControl>

        {selected && (
          <Alert icon={<Sparkles size={18} />} severity="info">
            {t(`create.policy.${selected.creationMode}`)}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
          }}
        >
          <FormField
            label={t('create.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            inputProps={{ maxLength: 120 }}
          />
          <FormField
            label={t('create.key')}
            value={key}
            onChange={(event) => setKey(event.target.value.toLowerCase())}
            required
            errorMessage={key && !SLUG_PATTERN.test(key) ? t('create.keyHelp') : undefined}
            supportingText={t('create.keyHelp')}
            inputProps={{ maxLength: 48 }}
          />
        </Box>
        <FormField
          label={t('create.summary')}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          required
          multiline
          minRows={2}
          inputProps={{ maxLength: 360 }}
        />
        <FormField
          select
          SelectProps={{ native: true }}
          label={t('create.visibility')}
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as SpaceSummary['visibility'])}
        >
          {(['OPEN', 'REQUEST', 'PRIVATE', 'HIDDEN'] as const).map((value) => (
            <option key={value} value={value}>
              {t(`visibility.${value}`)}
            </option>
          ))}
        </FormField>
        <FormField
          label={t('create.justification')}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          multiline
          minRows={2}
          inputProps={{ maxLength: 600 }}
          supportingText={t('create.justificationHelp')}
        />
      </Stack>
    </FormDialog>
  );
}
