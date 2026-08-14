import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Braces, Check, FileStack, Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, EmptyState, FormDialog, FormField } from '@dwp-frontend/design-system';
import {
  getApprovalForm,
  getApprovalForms,
  updateApprovalFormDraft,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { ApprovalSurface, StatusChip, approvalTone } from './approval-ui';
import { ApprovalFormFieldEditor } from './approval-form-field-editor';
import { useApprovalExperience } from './use-approval-experience';

import type { ApprovalForm, ApprovalFormField } from '@dwp-frontend/shared-utils';

export function ApprovalFormStudio() {
  const { t, i18n } = useTranslation('approvals');
  const toast = useToast();
  const experience = useApprovalExperience();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [nameKo, setNameKo] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [fields, setFields] = useState<ApprovalFormField[]>([]);
  const forms = useQuery({
    queryKey: ['approvals', 'admin', 'forms'],
    queryFn: getApprovalForms,
    staleTime: 30_000,
  });
  const selected = useMemo(
    () => forms.data?.find((form) => form.formId === selectedId) ?? null,
    [forms.data, selectedId]
  );
  const detail = useQuery({
    queryKey: ['approvals', 'admin', 'forms', selectedId],
    queryFn: () => getApprovalForm(selectedId!),
    enabled: Boolean(selectedId),
    staleTime: 30_000,
  });
  useEffect(() => {
    if (!selectedId && forms.data?.length) setSelectedId(forms.data[0].formId);
  }, [forms.data, selectedId]);

  const save = useMutation({
    mutationFn: () =>
      updateApprovalFormDraft(selectedId!, {
        nameKo,
        nameEn,
        fields,
        expectedVersion: detail.data!.form.version,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['approvals', 'admin', 'forms'] });
      queryClient.setQueryData(['approvals', 'admin', 'forms', result.form.formId], result);
      setEditorOpen(false);
      toast.success(t('admin.studio.formSaved'));
    },
    onError: () => toast.error(t('admin.studio.saveConflict')),
  });
  const openEditor = () => {
    if (!detail.data) return;
    setNameKo(detail.data.form.nameKo);
    setNameEn(detail.data.form.nameEn);
    setFields(
      detail.data.schema.fields.map((field) => ({
        ...field,
        labelKo: field.labelKo ?? field.key,
        labelEn: field.labelEn ?? field.key,
        helpKo: field.helpKo ?? '',
        helpEn: field.helpEn ?? '',
        options: field.options ?? [],
      }))
    );
    setEditorOpen(true);
  };
  const valid =
    nameKo.trim() &&
    nameEn.trim() &&
    fields.length > 0 &&
    fields.every(
      (field) =>
        field.key.trim() &&
        field.labelKo?.trim() &&
        field.labelEn?.trim() &&
        (field.type !== 'SELECT' || new Set(field.options).size >= 2)
    ) &&
    new Set(fields.map((field) => field.key)).size === fields.length;

  if (forms.isError) return <Alert severity="error">{t('admin.loadError')}</Alert>;

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(250px, 0.72fr) minmax(0, 2.28fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <ApprovalSurface
          title={t('admin.forms.title')}
          meta={t('admin.forms.meta')}
          action={<Chip size="small" label={forms.data?.length ?? 0} />}
        >
          <Stack component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {(forms.data ?? []).map((form) => (
              <FormListItem
                key={form.formId}
                form={form}
                selected={form.formId === selectedId}
                locale={i18n.resolvedLanguage}
                onSelect={() => setSelectedId(form.formId)}
              />
            ))}
          </Stack>
        </ApprovalSurface>

        {!selected ? (
          <EmptyState
            title={t('admin.studio.noForm')}
            description={t('admin.studio.noFormDescription')}
            icon={<FileStack size={24} />}
          />
        ) : detail.isError ? (
          <Alert severity="error">{t('admin.loadError')}</Alert>
        ) : detail.data ? (
          <Stack gap={2} minWidth={0}>
            <Box
              component="section"
              sx={{
                p: { xs: 2, md: 2.5 },
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
                <Box minWidth={0}>
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    <Typography component="h2" variant="h5">
                      {i18n.resolvedLanguage?.startsWith('ko')
                        ? detail.data.form.nameKo
                        : detail.data.form.nameEn}
                    </Typography>
                    <StatusChip status={detail.data.form.lifecycleState} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {t('admin.formRevision', {
                      key: detail.data.form.formKey,
                      version: detail.data.form.currentVersion,
                      hash: detail.data.schemaHash.slice(0, 12),
                    })}
                  </Typography>
                </Box>
                {experience.canEditDesign && detail.data.form.lifecycleState === 'DRAFT' && (
                  <ActionButton intent="secondary" onClick={openEditor}>
                    {t('admin.studio.editForm')}
                  </ActionButton>
                )}
              </Stack>
            </Box>
            <ApprovalSurface
              title={t('admin.studio.formFields')}
              meta={t('admin.studio.formFieldsMeta', { count: detail.data.schema.fields.length })}
            >
              <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid' }}>
                {detail.data.schema.fields.map((field, index) => (
                  <Box
                    component="li"
                    key={field.key}
                    sx={{
                      minHeight: 70,
                      px: 2,
                      display: 'grid',
                      gridTemplateColumns: '44px minmax(0,1.4fr) minmax(100px,0.7fr) 90px',
                      gap: 1.5,
                      alignItems: 'center',
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {String(index + 1).padStart(2, '0')}
                    </Typography>
                    <Box minWidth={0}>
                      <Typography variant="body2" fontWeight={740} noWrap>
                        {i18n.resolvedLanguage?.startsWith('ko')
                          ? (field.labelKo ?? field.key)
                          : (field.labelEn ?? field.key)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {field.key}
                      </Typography>
                    </Box>
                    <Chip size="small" variant="outlined" label={field.type} />
                    <Stack direction="row" gap={0.75} alignItems="center">
                      {field.required && <Check size={15} color={approvalTone.teal} />}
                      <Typography variant="caption" color="text.secondary">
                        {t(field.required ? 'admin.studio.required' : 'admin.studio.optional')}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Box>
            </ApprovalSurface>
            <Alert severity="info" icon={<Braces size={18} />}>
              {t('admin.studio.schemaNotice')}
            </Alert>
          </Stack>
        ) : null}
      </Box>

      <FormDialog
        open={editorOpen}
        title={t('admin.studio.editForm')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.save')}
        submittingLabel={t('actions.save')}
        busy={save.isPending}
        submitDisabled={!valid}
        onClose={() => setEditorOpen(false)}
        onSubmit={() => save.mutate()}
        maxWidth="md"
      >
        <Stack gap={2}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)' },
              gap: 1.5,
            }}
          >
            <FormField
              label={t('admin.studio.nameKo')}
              value={nameKo}
              onChange={(event) => setNameKo(event.target.value)}
            />
            <FormField
              label={t('admin.studio.nameEn')}
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
            />
          </Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="subtitle2">{t('admin.studio.formFields')}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('admin.studio.fieldKeyNotice')}
              </Typography>
            </Box>
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<Plus size={16} />}
              onClick={() =>
                setFields((current) => [
                  ...current,
                  {
                    key: `field${current.length + 1}`,
                    labelKo: `필드 ${current.length + 1}`,
                    labelEn: `Field ${current.length + 1}`,
                    helpKo: '',
                    helpEn: '',
                    type: 'TEXT',
                    required: false,
                    options: [],
                  },
                ])
              }
            >
              {t('admin.studio.addField')}
            </ActionButton>
          </Stack>
          <Stack gap={1.25}>
            {fields.map((field, index) => (
              <ApprovalFormFieldEditor
                key={`${field.key}-${index}`}
                field={field}
                index={index}
                fieldCount={fields.length}
                onChange={(value) =>
                  setFields((current) =>
                    current.map((item, itemIndex) => (itemIndex === index ? value : item))
                  )
                }
                onRemove={() =>
                  setFields((current) => current.filter((_, itemIndex) => itemIndex !== index))
                }
              />
            ))}
          </Stack>
        </Stack>
      </FormDialog>
    </>
  );
}

function FormListItem({
  form,
  selected,
  locale,
  onSelect,
}: {
  form: ApprovalForm;
  selected: boolean;
  locale?: string;
  onSelect: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Box component="li">
      <ButtonBase
        onClick={onSelect}
        sx={{
          width: 1,
          minHeight: 72,
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          textAlign: 'left',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: selected ? alpha(approvalTone.primary, 0.08) : 'transparent',
          boxShadow: selected ? `inset 3px 0 0 ${approvalTone.primary}` : 'none',
          '&:hover': { bgcolor: alpha(approvalTone.primary, 0.055) },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={750} noWrap>
            {locale?.startsWith('ko') ? form.nameKo : form.nameEn}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('admin.formListMeta', {
              count: form.fieldCount,
              version: form.currentVersion,
            })}
          </Typography>
        </Box>
        <StatusChip status={form.lifecycleState} />
      </ButtonBase>
    </Box>
  );
}
