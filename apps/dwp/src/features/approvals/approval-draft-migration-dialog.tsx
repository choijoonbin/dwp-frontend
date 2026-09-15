import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, FileWarning, WandSparkles } from 'lucide-react';
import {
  ActionButton,
  FormDialog,
  FormField,
  InlineFeedback,
  LoadingState,
  SelectField,
} from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ApprovalDraftMigrationController } from './use-approval-draft-migration';

function FieldList({
  label,
  values,
  tone = 'neutral',
}: {
  label: string;
  values: readonly string[];
  tone?: 'positive' | 'warning' | 'neutral';
}) {
  const color =
    tone === 'positive' ? 'success.main' : tone === 'warning' ? 'warning.main' : 'text.secondary';
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle2" color={color} sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>
        {values.length ? values.join(', ') : '0'}
      </Typography>
    </Box>
  );
}

export function ApprovalDraftMigrationDialog({
  controller,
}: {
  controller: ApprovalDraftMigrationController;
}) {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  const preview = controller.visiblePreview;
  const readProblem =
    controller.forms.isError || controller.template.isError || controller.preview.isError;
  const busy =
    controller.forms.isFetching || controller.template.isFetching || controller.preview.isFetching;
  const problem = controller.problem;
  const submitDisabled =
    controller.pending ||
    controller.locked ||
    !controller.sourceCurrent ||
    !preview ||
    !preview.migrationRequired ||
    !preview.routeCompatible ||
    !controller.reason.trim() ||
    readProblem;

  return (
    <FormDialog
      open={Boolean(controller.candidate)}
      mobileFullScreen
      maxWidth="md"
      title={t('requests.drafts.migrationTitle')}
      description={t('requests.drafts.migrationDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('requests.drafts.migrationConfirm')}
      submitIntent="primary"
      busy={controller.pending}
      submitDisabled={submitDisabled}
      onClose={controller.close}
      onSubmit={controller.submit}
    >
      <Stack gap={2.25}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(0,1fr) auto minmax(0,1fr)' },
            alignItems: 'center',
            gap: 1.5,
            px: 1.75,
            py: 1.5,
            borderLeft: 3,
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          }}
        >
          <Box minWidth={0}>
            <Typography variant="overline" color="text.secondary">
              {t('requests.drafts.migrationSource')}
            </Typography>
            <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
              {controller.candidate?.sourceTitle || t('requests.autosave.untitled')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('requests.drafts.migrationSourceVersion', {
                version: controller.candidate?.sourceVersion,
              })}
            </Typography>
          </Box>
          <ArrowRight size={18} aria-hidden color="currentColor" />
          <Box minWidth={0}>
            <Typography variant="overline" color="text.secondary">
              {t('requests.drafts.migrationTarget')}
            </Typography>
            <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
              {preview
                ? korean
                  ? preview.target.formNameKo
                  : preview.target.formNameEn
                : t('requests.drafts.migrationTargetPending')}
            </Typography>
            {preview && (
              <Typography variant="caption" color="text.secondary">
                {t('requests.drafts.migrationTargetVersion', {
                  formVersion: preview.target.formVersion,
                  workflowVersion: preview.target.workflowVersion,
                })}
              </Typography>
            )}
          </Box>
        </Box>

        <InlineFeedback severity="info" icon={<WandSparkles size={18} />}>
          {t('requests.drafts.migrationImmutableSource')}
        </InlineFeedback>

        <SelectField
          label={t('requests.drafts.migrationForm')}
          value={controller.targetFormId}
          disabled={controller.locked || controller.forms.isFetching}
          options={(controller.forms.data ?? []).map((form) => ({
            value: form.formId,
            label: korean ? form.nameKo : form.nameEn,
          }))}
          onValueChange={controller.setTargetFormId}
        />

        {busy && <LoadingState embedded label={t('requests.drafts.migrationEvaluating')} />}
        {readProblem && !busy && (
          <InlineFeedback
            severity="error"
            action={
              <ActionButton intent="quiet" size="small" onClick={() => void controller.refresh()}>
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('requests.drafts.migrationPreviewError')}
          </InlineFeedback>
        )}

        {preview && !busy && (
          <Stack gap={1.75}>
            {!preview.migrationRequired && (
              <InlineFeedback severity="warning" icon={<FileWarning size={18} />}>
                {t('requests.drafts.migrationNotRequired')}
              </InlineFeedback>
            )}
            {!preview.routeCompatible && (
              <InlineFeedback severity="error" icon={<FileWarning size={18} />}>
                {t('requests.drafts.migrationRouteIncompatible')}
              </InlineFeedback>
            )}
            {preview.migrationRequired && preview.routeCompatible && (
              <InlineFeedback severity="success" icon={<CheckCircle2 size={18} />}>
                {t('requests.drafts.migrationReady')}
              </InlineFeedback>
            )}
            <Box
              component="section"
              aria-label={t('requests.drafts.migrationFieldReport')}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2,minmax(0,1fr))',
                  md: 'repeat(4,minmax(0,1fr))',
                },
                gap: 1.5,
                py: 1.5,
                borderBlock: 1,
                borderColor: 'divider',
              }}
            >
              <FieldList
                label={t('requests.drafts.migrationMapped')}
                values={preview.mappedFields}
                tone="positive"
              />
              <FieldList
                label={t('requests.drafts.migrationRequiredFields')}
                values={preview.requiredFieldsToComplete}
                tone={preview.requiredFieldsToComplete.length ? 'warning' : 'positive'}
              />
              <FieldList
                label={t('requests.drafts.migrationDropped')}
                values={preview.droppedFields}
                tone={preview.droppedFields.length ? 'warning' : 'neutral'}
              />
              <FieldList
                label={t('requests.drafts.migrationIncompatible')}
                values={preview.incompatibleFields}
                tone={preview.incompatibleFields.length ? 'warning' : 'neutral'}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {preview.requiredFieldsToComplete.length
                ? t('requests.drafts.migrationCompleteAfter', {
                    count: preview.requiredFieldsToComplete.length,
                  })
                : t('requests.drafts.migrationAllMapped')}
            </Typography>
          </Stack>
        )}

        <Divider />
        <FormField
          label={t('requests.drafts.migrationReason')}
          required
          multiline
          minRows={3}
          value={controller.reason}
          disabled={controller.locked}
          onChange={(event) => controller.setReason(event.target.value)}
          inputProps={{ maxLength: 2000 }}
        />

        {problem && (
          <InlineFeedback
            severity={problem === 'CONFLICT' || problem === 'INCOMPATIBLE' ? 'warning' : 'error'}
            action={
              <ActionButton
                intent="quiet"
                size="small"
                disabled={controller.pending}
                onClick={() =>
                  ['UNAVAILABLE', 'UNKNOWN'].includes(problem)
                    ? controller.retryOriginal()
                    : void controller.refresh()
                }
              >
                {t(
                  ['UNAVAILABLE', 'UNKNOWN'].includes(problem)
                    ? 'requests.drafts.migrationRetryOriginal'
                    : 'actions.refresh'
                )}
              </ActionButton>
            }
          >
            {t(`requests.drafts.migrationErrors.${problem}`)}
          </InlineFeedback>
        )}
      </Stack>
    </FormDialog>
  );
}
