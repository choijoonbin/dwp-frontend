import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileClock, ShieldCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createServiceRequest, updateServiceDraft, useToast } from '@dwp-frontend/shared-utils';
import { ActionButton, FormDialog, FormField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';

import type {
  ServiceCatalogItem,
  ServiceRequestDetail,
  ServiceRequestField,
} from '@dwp-frontend/shared-utils';

import { useProductActionMutation } from '../../components/use-product-action-mutation';
import {
  serviceRequestErrorText,
  serviceRequestFieldLabel,
  serviceRequestName,
  serviceRequestOptionLabel,
} from './service-request-model';

export function ServiceRequestDialog({
  service,
  draft,
  initialSummary = '',
  fromDwaion = false,
  onClose,
}: {
  service: ServiceCatalogItem | null;
  draft?: ServiceRequestDetail | null;
  initialSummary?: string;
  fromDwaion?: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('services');
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const createRequest = useProductActionMutation('route.services.work.request-create.action');
  const updateDraft = useProductActionMutation('route.services.work.draft-update.action');
  const [summary, setSummary] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [validationVisible, setValidationVisible] = useState(false);
  const fields = service?.requestSchema.fields ?? draft?.requestSchema.fields ?? [];
  const open = Boolean(service || draft);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const targetName = service?.name ?? (draft ? serviceRequestName(draft.request, language) : '');
  const classification = service?.dataClassification ?? draft?.dataClassification;

  useEffect(() => {
    if (draft) {
      setSummary(draft.request.summary);
      setValues(draft.values);
      setValidationVisible(false);
    } else if (service) {
      setSummary(initialSummary);
      setValues({});
      setValidationVisible(false);
    }
  }, [draft, initialSummary, service]);
  const valid = Boolean(
    summary.trim() &&
    fields.every((field) => {
      if (!field.required) return true;
      const value = values[field.key];
      return value !== undefined && value !== null && value !== '' && value !== false;
    })
  );
  const mutation = useMutation({
    mutationFn: async ({ submit }: { submit: boolean }) => {
      if (draft) {
        const updated = await updateDraft((authority) =>
          updateServiceDraft(
            draft.request.requestId,
            {
              summary: summary.trim(),
              values,
              version: draft.request.version,
              submit,
            },
            authority
          )
        );
        return updated;
      }
      if (!service) throw new Error('Service unavailable');
      return createRequest((authority) =>
        createServiceRequest(
          {
            serviceKey: service.serviceKey,
            summary: summary.trim(),
            values,
            idempotencyKey: crypto.randomUUID(),
            submit,
          },
          authority
        )
      );
    },
    onSuccess: async (detail, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services', 'requests'] }),
        queryClient.invalidateQueries({
          queryKey: ['services', 'request', detail.request.requestId],
        }),
      ]);
      toast.success(
        t(
          input.submit
            ? draft
              ? 'requestDialog.updatedAndSubmitted'
              : 'requestDialog.created'
            : draft
              ? 'requestDialog.updated'
              : 'requestDialog.drafted',
          { number: detail.request.requestNumber }
        )
      );
      onClose();
      navigate(`/services/${input.submit ? 'my' : 'drafts'}/${detail.request.requestId}`);
    },
    onError: (error) => toast.error(serviceRequestErrorText(error, t('requestDialog.error'))),
  });

  const submit = (shouldSubmit: boolean) => {
    if (!summary.trim() || (shouldSubmit && !valid)) {
      setValidationVisible(true);
      return;
    }
    mutation.mutate({ submit: shouldSubmit });
  };

  const close = () => {
    setSummary('');
    setValues({});
    setValidationVisible(false);
    onClose();
  };

  const renderField = (field: ServiceRequestField) => {
    const label = serviceRequestFieldLabel(field, i18n.resolvedLanguage ?? i18n.language);
    const value = values[field.key];
    const update = (next: unknown) => setValues((current) => ({ ...current, [field.key]: next }));
    if (field.type === 'CHECKBOX') {
      return (
        <FormControlLabel
          key={field.key}
          control={
            <Checkbox checked={Boolean(value)} onChange={(event) => update(event.target.checked)} />
          }
          label={label}
          sx={{ minHeight: 48, alignItems: 'center' }}
        />
      );
    }
    if (field.type === 'SELECT') {
      return (
        <FormField
          key={field.key}
          select
          required={field.required}
          label={label}
          value={String(value ?? '')}
          errorMessage={
            validationVisible && field.required && !value ? t('requestDialog.required') : undefined
          }
          onChange={(event) => update(event.target.value)}
        >
          <MenuItem value="" disabled>
            {t('requestDialog.selectPlaceholder')}
          </MenuItem>
          {(field.options ?? []).map((option) => (
            <MenuItem key={option} value={option}>
              {serviceRequestOptionLabel(option)}
            </MenuItem>
          ))}
        </FormField>
      );
    }
    return (
      <FormField
        key={field.key}
        required={field.required}
        label={label}
        type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
        multiline={field.type === 'TEXTAREA'}
        minRows={field.type === 'TEXTAREA' ? 3 : undefined}
        value={String(value ?? '')}
        slotProps={field.type === 'DATE' ? { inputLabel: { shrink: true } } : undefined}
        errorMessage={
          validationVisible && field.required && !value ? t('requestDialog.required') : undefined
        }
        onChange={(event) => {
          const next = event.target.value;
          update(field.type === 'NUMBER' && next !== '' ? Number(next) : next);
        }}
      />
    );
  };

  return (
    <FormDialog
      open={open}
      title={t(draft ? 'requestDialog.editTitle' : 'requestDialog.title', {
        service: targetName,
      })}
      description={t(draft ? 'requestDialog.editDescription' : 'requestDialog.description')}
      cancelLabel={t('requestDialog.cancel')}
      submitLabel={t('requestDialog.submit')}
      onClose={close}
      onSubmit={() => submit(true)}
      busy={mutation.isPending}
      maxWidth="sm"
      secondaryActions={
        <ActionButton
          intent="secondary"
          startIcon={<FileClock size={17} />}
          onClick={() => submit(false)}
          disabled={mutation.isPending}
        >
          {t('requestDialog.saveDraft')}
        </ActionButton>
      }
    >
      {open && classification && (
        <Stack gap={2.25}>
          {fromDwaion && <Alert severity="info">{t('requestDialog.dwaionDraftNotice')}</Alert>}
          <Alert severity="info" icon={<ShieldCheck size={18} />}>
            {t('requestDialog.privacy', {
              classification: t(`classification.${classification}`),
            })}
          </Alert>
          <FormField
            autoFocus
            required
            label={t('requestDialog.summary')}
            placeholder={t('requestDialog.summaryPlaceholder')}
            value={summary}
            errorMessage={
              validationVisible && !summary.trim() ? t('requestDialog.required') : undefined
            }
            supportingText={`${summary.length}/240`}
            onChange={(event) => setSummary(event.target.value.slice(0, 240))}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
              '& > .MuiFormControl-root:has(textarea)': { gridColumn: { sm: '1 / -1' } },
            }}
          >
            {fields.map(renderField)}
          </Box>
          {validationVisible && !valid && (
            <Alert severity="warning">{t('requestDialog.invalid')}</Alert>
          )}
        </Stack>
      )}
    </FormDialog>
  );
}
