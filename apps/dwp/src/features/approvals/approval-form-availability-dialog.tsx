import { useTranslation } from 'react-i18next';
import { ActionButton, FormDialog, FormField, InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { FormDraft } from './approval-form-catalog-drafts';

export function ApprovalFormAvailabilityDialog({
  open,
  retiring,
  ready,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  retiring: boolean;
  ready: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <FormDialog
      open={open}
      title={t(retiring ? 'admin.formWorkspace.retire' : 'admin.formWorkspace.reinstate')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(retiring ? 'admin.formWorkspace.retire' : 'admin.formWorkspace.reinstate')}
      submittingLabel={t('actions.save')}
      busy={busy}
      submitDisabled={!ready}
      onClose={onClose}
      onSubmit={onConfirm}
      maxWidth="sm"
      mobileFullScreen
    >
      <Stack gap={2}>
        <InlineFeedback severity="info">
          {t('admin.formWorkspace.availabilityNotice')}
        </InlineFeedback>
        {!ready ? (
          <InlineFeedback severity="warning">
            {t('admin.formWorkspace.sourceChanged')}
          </InlineFeedback>
        ) : null}
      </Stack>
    </FormDialog>
  );
}

export function ApprovalFormWorkspaceReadOnlyDraftDialog({
  open,
  draft,
  unknown,
  onClose,
  onReload,
}: {
  open: boolean;
  draft: FormDraft;
  unknown: boolean;
  onClose: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <FormDialog
      open={open}
      title={t('admin.formWorkspace.editWorkingDraft')}
      cancelLabel={t('actions.close')}
      submitLabel={t('actions.save')}
      submitDisabled
      onClose={onClose}
      onSubmit={() => undefined}
      mobileFullScreen
      maxWidth="md"
      secondaryActions={
        <ActionButton intent="secondary" onClick={onReload}>
          {t('admin.formWorkspace.reload')}
        </ActionButton>
      }
    >
      <Stack gap={2}>
        <InlineFeedback severity="warning">
          {t(unknown ? 'admin.formWorkspace.commandUnknown' : 'admin.formWorkspace.sourceChanged')}
        </InlineFeedback>
        <FormField disabled label={t('admin.studio.nameKo')} value={draft.nameKo} />
        <FormField disabled label={t('admin.studio.nameEn')} value={draft.nameEn} />
        <FormField
          disabled
          multiline
          label={t('admin.studio.descriptionKo')}
          value={draft.descriptionKo}
        />
        <FormField
          disabled
          multiline
          label={t('admin.studio.descriptionEn')}
          value={draft.descriptionEn}
        />
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {(draft.typedSchema?.fields ?? draft.fields ?? []).map((field) => (
            <Box
              component="li"
              key={field.key}
              sx={{
                typography: 'body2',
                py: 1,
                borderBottom: 1,
                borderColor: 'divider',
                overflowWrap: 'anywhere',
              }}
            >
              {field.labelKo} · {field.labelEn} · {field.key}
            </Box>
          ))}
        </Box>
      </Stack>
    </FormDialog>
  );
}
