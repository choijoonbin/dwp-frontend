import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormDialog, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import type { SaveSpaceTemplateInput, SpaceTemplate } from '@dwp-frontend/shared-utils';

export type TemplateForm = SaveSpaceTemplateInput & { templateId?: string };

const EMPTY_TEMPLATE: TemplateForm = {
  templateKey: '',
  nameKo: '',
  nameEn: '',
  descriptionKo: '',
  descriptionEn: '',
  purposeType: 'PROJECT',
  creationMode: 'POLICY',
  defaultVisibility: 'REQUEST',
  defaultDataClassification: 'INTERNAL',
  allowedContentTypes: ['POST', 'PAGE', 'LINK', 'DECISION'],
  defaultApps: [],
  iconKey: 'layers-3',
  accentToken: 'indigo',
  lifecycleState: 'DRAFT',
  expectedVersion: null,
};

export function TemplateDialog({
  open,
  template,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  template: SpaceTemplate | null;
  busy: boolean;
  onClose: () => void;
  onSave: (form: TemplateForm) => void;
}) {
  const { t } = useTranslation(['admin', 'spaces']);
  const [form, setForm] = useState<TemplateForm>(EMPTY_TEMPLATE);
  useEffect(() => {
    if (!open) return;
    setForm(
      template
        ? {
            ...EMPTY_TEMPLATE,
            ...template,
            templateId: template.templateId,
            expectedVersion: template.version,
          }
        : EMPTY_TEMPLATE
    );
  }, [open, template]);
  const valid =
    /^[a-z][a-z0-9-]{2,99}$/.test(form.templateKey) &&
    Boolean(
      form.nameKo.trim() &&
      form.nameEn.trim() &&
      form.descriptionKo.trim() &&
      form.descriptionEn.trim()
    );
  const patch = (next: Partial<TemplateForm>) => setForm((current) => ({ ...current, ...next }));
  return (
    <FormDialog
      open={open}
      title={t(
        template ? 'admin:spaces.templates.editTitle' : 'admin:spaces.templates.createTitle'
      )}
      cancelLabel={t('admin:common.actions.cancel')}
      submitLabel={t('admin:common.actions.save')}
      submittingLabel={t('admin:common.actions.save')}
      busy={busy}
      submitDisabled={!valid}
      maxWidth="md"
      onClose={onClose}
      onSubmit={() => onSave(form)}
    >
      <Stack gap={2}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 2,
          }}
        >
          <FormField
            required
            disabled={Boolean(template)}
            label={t('admin:spaces.templates.key')}
            value={form.templateKey}
            onChange={(event) => patch({ templateKey: event.target.value.toLowerCase() })}
          />
          <FormField
            select
            SelectProps={{ native: true }}
            label={t('admin:spaces.templates.purpose')}
            value={form.purposeType}
            onChange={(event) =>
              patch({ purposeType: event.target.value as TemplateForm['purposeType'] })
            }
          >
            {['PROJECT', 'COMMUNITY', 'OPERATIONS', 'KNOWLEDGE', 'LEADERSHIP'].map((value) => (
              <option key={value} value={value}>
                {t(`admin:spaces.purpose.${value}`)}
              </option>
            ))}
          </FormField>
          <FormField
            required
            label={t('admin:spaces.templates.nameKo')}
            value={form.nameKo}
            onChange={(event) => patch({ nameKo: event.target.value })}
          />
          <FormField
            required
            label={t('admin:spaces.templates.nameEn')}
            value={form.nameEn}
            onChange={(event) => patch({ nameEn: event.target.value })}
          />
          <FormField
            required
            multiline
            minRows={2}
            label={t('admin:spaces.templates.descriptionKo')}
            value={form.descriptionKo}
            onChange={(event) => patch({ descriptionKo: event.target.value })}
          />
          <FormField
            required
            multiline
            minRows={2}
            label={t('admin:spaces.templates.descriptionEn')}
            value={form.descriptionEn}
            onChange={(event) => patch({ descriptionEn: event.target.value })}
          />
          <FormField
            select
            SelectProps={{ native: true }}
            label={t('admin:spaces.templates.creationMode')}
            value={form.creationMode}
            onChange={(event) =>
              patch({ creationMode: event.target.value as TemplateForm['creationMode'] })
            }
          >
            {['AUTO', 'POLICY', 'APPROVAL'].map((value) => (
              <option key={value} value={value}>
                {t(`spaces:creationMode.${value}`)}
              </option>
            ))}
          </FormField>
          <FormField
            select
            SelectProps={{ native: true }}
            label={t('admin:spaces.columns.visibility')}
            value={form.defaultVisibility}
            onChange={(event) =>
              patch({
                defaultVisibility: event.target.value as TemplateForm['defaultVisibility'],
              })
            }
          >
            {['OPEN', 'REQUEST', 'PRIVATE', 'HIDDEN'].map((value) => (
              <option key={value} value={value}>
                {t(`spaces:visibility.${value}`)}
              </option>
            ))}
          </FormField>
          <FormField
            select
            SelectProps={{ native: true }}
            label={t('admin:spaces.columns.classification')}
            value={form.defaultDataClassification}
            onChange={(event) =>
              patch({
                defaultDataClassification: event.target
                  .value as TemplateForm['defaultDataClassification'],
              })
            }
          >
            {['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].map((value) => (
              <option key={value} value={value}>
                {t(`spaces:classification.${value}`)}
              </option>
            ))}
          </FormField>
          <FormField
            select
            SelectProps={{ native: true }}
            label={t('admin:spaces.columns.status')}
            value={form.lifecycleState}
            onChange={(event) => patch({ lifecycleState: event.target.value })}
          >
            {['DRAFT', 'PUBLISHED', 'RETIRED'].map((value) => (
              <option key={value} value={value}>
                {t(`spaces:status.${value}`, { defaultValue: value })}
              </option>
            ))}
          </FormField>
          <FormField
            label={t('admin:spaces.templates.icon')}
            value={form.iconKey}
            onChange={(event) => patch({ iconKey: event.target.value })}
          />
          <FormField
            select
            SelectProps={{ native: true }}
            label={t('admin:spaces.templates.accent')}
            value={form.accentToken}
            onChange={(event) => patch({ accentToken: event.target.value })}
          >
            {['indigo', 'cobalt', 'teal', 'amber', 'crimson', 'violet'].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </FormField>
          <FormField
            sx={{ gridColumn: { md: '1 / -1' } }}
            label={t('admin:spaces.templates.defaultApps')}
            value={form.defaultApps.join(', ')}
            onChange={(event) =>
              patch({
                defaultApps: event.target.value
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              })
            }
            supportingText={t('admin:spaces.templates.defaultAppsHelp')}
          />
        </Box>
      </Stack>
    </FormDialog>
  );
}
