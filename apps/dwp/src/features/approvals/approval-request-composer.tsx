import { useMemo, useState } from 'react';
import { Braces, FileCheck2, Save, X } from 'lucide-react';
import {
  ActionButton,
  FormDialog,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  ApprovalQueryErrorAlert,
  PublishedApprovalFormSelector,
  PublishedApprovalTemplateSummary,
} from './approval-request-form-context';
import { ApprovalRequestDynamicFields } from './approval-request-dynamic-fields';
import { ApprovalRequestTypedFields } from './approval-request-typed-fields';
import { ApprovalRequestPreflight } from './approval-request-preflight';
import { ApprovalRequestPreflightSummary } from './approval-request-preflight-summary';
import { ApprovalRequestSaveStatus } from './approval-request-save-status';
import { ApprovalSurface } from './approval-ui';
import { useApprovalRequestComposer } from './use-approval-request-composer';
import { ApprovalAttachmentPanel } from './approval-attachment-panel';
import { useApprovalAttachmentClient } from './use-approval-attachment-client';
import { ApprovalAttachmentNavigationGuard } from './approval-attachment-navigation-guard';
import { focusApprovalRequestIssue } from './approval-request-preflight-focus';

import type { ApprovalPriority } from '@dwp-frontend/shared-utils';

export function ApprovalRequestComposer() {
  const {
    t,
    korean,
    draftId,
    requestScope,
    forms,
    draft,
    template,
    formId,
    title,
    summary,
    priority,
    payloadValues,
    fields,
    formEvaluation,
    userSource,
    schemaBindingReady,
    missingFields,
    dwaionDraft,
    pendingFormId,
    pendingFormChange,
    preflightOpen,
    serverPreflight,
    preflight,
    recovery,
    submissionUnknown,
    contextReady,
    reviewReady,
    validationIssues,
    contentMasked,
    fieldsDisabled,
    submissionReady,
    autosave,
    save,
    refreshContext,
    reapply,
    reconcile,
    setTitle,
    setSummary,
    setPriority,
    setPayloadValues,
    setPendingFormId,
    setPreflightOpen,
    prepareReview,
    requestFormChange,
    applyFormChange,
    saveDraft,
    saveAndClose,
    submit,
  } = useApprovalRequestComposer();
  const [validationRevealed, setValidationRevealed] = useState(false);
  const attachments = useApprovalAttachmentClient({
    owner: { type: 'REQUEST', id: draftId ?? '' },
    version: draft.data?.request.version,
    ready: contextReady && !autosave.dirty && autosave.status !== 'SAVING' && !contentMasked,
  });
  const attachmentPending = attachments.state.busy || attachments.controller.unresolved;
  const fieldCount =
    formEvaluation.compiled?.definition.fields.filter((field) => field.key !== 'summary').length ??
    fields.length;
  const typedValidation =
    formEvaluation.kind === 'TYPED'
      ? {
          ready: formEvaluation.schemaReady && schemaBindingReady,
          valid: formEvaluation.submitValid,
          missing: formEvaluation.missing.length,
          required: formEvaluation.required.length,
        }
      : undefined;
  const invalidPaths = useMemo(
    () => new Set(validationRevealed ? validationIssues.map((issue) => issue.path) : []),
    [validationRevealed, validationIssues]
  );
  const openPreflight = () => {
    if (!reviewReady || save.isPending || preflight.isPending || attachmentPending) return;
    setValidationRevealed(true);
    prepareReview();
  };
  const focusIssue = (path: string) => {
    setPreflightOpen(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => focusApprovalRequestIssue(path));
    });
  };

  return (
    <Box
      component="form"
      onSubmit={(event) => {
        event.preventDefault();
        openPreflight();
      }}
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          lg: 'minmax(220px, .55fr) minmax(0, 1.45fr)',
        },
        '@media (min-width:1360px)': {
          gridTemplateColumns: 'minmax(190px, .52fr) minmax(400px, 1.2fr) minmax(270px, .68fr)',
        },
        alignItems: 'start',
        gap: 2,
      }}
    >
      <ApprovalSurface
        title={t(draftId ? 'requests.compose.editTitle' : 'requests.compose.title')}
        meta={t(draftId ? 'requests.compose.editMeta' : 'requests.compose.meta')}
      >
        <Stack gap={2} sx={{ p: 2 }}>
          {forms.isError && (
            <ApprovalQueryErrorAlert
              message={t('requests.formsLoadError')}
              retryLabel={t('actions.retry')}
              retrying={forms.isFetching}
              onRetry={() => void forms.refetch()}
            />
          )}
          <PublishedApprovalFormSelector
            forms={forms.data ?? []}
            value={formId}
            label={t('requests.fields.form')}
            korean={korean}
            disabled={
              !requestScope.ready ||
              forms.isFetching ||
              forms.isError ||
              contentMasked ||
              autosave.unresolved ||
              attachmentPending ||
              save.isPending ||
              autosave.status === 'SAVING'
            }
            onChange={requestFormChange}
          />
          {template.data && (
            <PublishedApprovalTemplateSummary
              processLabel={t('requests.template.process')}
              processValue={korean ? template.data.workflow.nameKo : template.data.workflow.nameEn}
              slaLabel={t('requests.template.sla')}
              slaValue={t('admin.minutes', { count: template.data.workflow.slaMinutes })}
              formLabel={t('requests.template.form')}
              formValue={t('requests.template.formVersion', {
                version: template.data.form.form.currentVersion,
                count: template.data.form.form.fieldCount,
              })}
            />
          )}
        </Stack>
      </ApprovalSurface>

      <ApprovalSurface
        title={t('requests.template.businessFields')}
        meta={t('requests.template.fieldCount', { count: fieldCount })}
      >
        <Stack gap={2} sx={{ p: { xs: 2, md: 3 } }}>
          {dwaionDraft && (
            <InlineFeedback severity="info">
              {t('requests.compose.dwaionDraftNotice')}
            </InlineFeedback>
          )}
          {draft.isError && (
            <ApprovalQueryErrorAlert
              message={t('requests.draftLoadError')}
              retryLabel={t('actions.retry')}
              retrying={draft.isFetching}
              onRetry={() => void draft.refetch()}
            />
          )}
          {template.isError && (
            <ApprovalQueryErrorAlert
              message={t('requests.templateError')}
              retryLabel={t('actions.retry')}
              retrying={template.isFetching}
              onRetry={() => void template.refetch()}
            />
          )}
          {recovery && (
            <InlineFeedback
              severity={['CONFLICT', 'UNKNOWN'].includes(recovery.kind) ? 'warning' : 'error'}
              action={
                <Stack direction="row" gap={0.5}>
                  <ActionButton
                    type="button"
                    intent="quiet"
                    size="small"
                    onClick={() => void refreshContext()}
                  >
                    {t('actions.refresh')}
                  </ActionButton>
                  {recovery.kind === 'UNKNOWN' && !submissionUnknown && (
                    <ActionButton
                      type="button"
                      intent="secondary"
                      size="small"
                      disabled={autosave.status === 'SAVING'}
                      onClick={() => void reconcile()}
                    >
                      {t('requests.autosave.reconcile')}
                    </ActionButton>
                  )}
                  {recovery.kind === 'CONFLICT' &&
                    recovery.latestLoaded &&
                    autosave.conflicts.length === 0 && (
                      <ActionButton
                        type="button"
                        intent="secondary"
                        size="small"
                        disabled={save.isPending}
                        onClick={() => void reapply()}
                      >
                        {t('requests.autosave.reapply')}
                      </ActionButton>
                    )}
                </Stack>
              }
            >
              {t(
                submissionUnknown
                  ? 'requests.commands.unknown'
                  : recovery.kind === 'UNKNOWN'
                    ? 'requests.autosave.unknown'
                    : recovery.kind === 'CONFLICT'
                      ? 'requests.autosave.conflict'
                      : 'requests.actionError'
              )}
            </InlineFeedback>
          )}
          <ApprovalRequestSaveStatus state={autosave} />
          {!contentMasked && (formEvaluation.problemKey || !schemaBindingReady) && (
            <InlineFeedback severity="warning">
              {t(formEvaluation.problemKey ?? 'requests.typed.schemaInvalid')}
            </InlineFeedback>
          )}
          <FormField
            id="approval-request-title"
            required
            label={t('requests.fields.title')}
            value={title}
            disabled={fieldsDisabled || attachmentPending}
            onChange={(event) => setTitle(event.target.value)}
            inputProps={{ maxLength: 300 }}
            errorMessage={
              invalidPaths.has('$title')
                ? t('requests.typed.fieldInvalid', { field: t('requests.fields.title') })
                : undefined
            }
          />
          <FormField
            id="approval-request-summary"
            required
            multiline
            minRows={5}
            label={t('requests.fields.summary')}
            value={summary}
            disabled={fieldsDisabled || attachmentPending}
            onChange={(event) => setSummary(event.target.value)}
            inputProps={{ maxLength: 2000 }}
            supportingText={t('requests.fields.summaryHelp')}
            errorMessage={
              invalidPaths.has('$summary')
                ? t('requests.typed.fieldInvalid', { field: t('requests.fields.summary') })
                : undefined
            }
          />
          <SelectField
            label={t('requests.fields.priority')}
            value={priority}
            disabled={fieldsDisabled || attachmentPending}
            options={(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((value) => ({
              value,
              label: t(`priority.${value}`),
            }))}
            onValueChange={(value) => value && setPriority(value as ApprovalPriority)}
          />
          {fieldCount > 0 && !contentMasked && (
            <Box
              id="approval-request-business-fields"
              component="fieldset"
              tabIndex={-1}
              sx={{ m: 0, p: 0, border: 0 }}
            >
              <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ color: 'primary.main', display: 'flex' }}>
                  <Braces size={17} aria-hidden="true" />
                </Box>
                <Typography component="legend" variant="subtitle2">
                  {t('requests.template.businessFields')}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('requests.template.fieldCount', { count: fieldCount })}
                />
              </Stack>
              {invalidPaths.has('$business-fields') && (
                <InlineFeedback severity="error">{t('requests.typed.inputInvalid')}</InlineFeedback>
              )}
              {formEvaluation.compiled ? (
                <ApprovalRequestTypedFields
                  compiled={formEvaluation.compiled}
                  evaluation={formEvaluation.draftEvaluation}
                  values={payloadValues}
                  korean={korean}
                  disabled={fieldsDisabled || attachmentPending}
                  invalidPaths={invalidPaths}
                  userBinding={userSource.binding}
                  onUserSourceReadyChange={userSource.report}
                  onChange={(key, value) =>
                    setPayloadValues((current) => ({ ...current, [key]: value }))
                  }
                />
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  <ApprovalRequestDynamicFields
                    fields={fields}
                    values={formEvaluation.legacyValues}
                    korean={korean}
                    idPrefix="approval-request"
                    disabled={fieldsDisabled || attachmentPending}
                    invalidPaths={invalidPaths}
                    onChange={(key, value) =>
                      setPayloadValues((current) => ({ ...current, [key]: value }))
                    }
                  />
                </Box>
              )}
            </Box>
          )}
          <ApprovalAttachmentPanel client={attachments} saveFirst={!draftId} />
          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            justifyContent="flex-end"
            gap={1}
            sx={{
              position: { xs: 'sticky', md: 'static' },
              bottom: 0,
              zIndex: 1,
              py: 1,
              bgcolor: 'background.paper',
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <ActionButton
              type="button"
              intent="quiet"
              startIcon={<X size={17} />}
              loading={save.isPending && save.variables?.input.intent === 'CLOSE'}
              disabled={!contextReady || save.isPending || attachmentPending}
              onClick={saveAndClose}
              sx={{ mr: { sm: 'auto' } }}
            >
              {t('requests.autosave.close')}
            </ActionButton>
            <ActionButton
              type="button"
              intent="secondary"
              startIcon={<Save size={17} />}
              loading={save.isPending && save.variables?.input.intent === 'DRAFT'}
              disabled={!contextReady || save.isPending || attachmentPending}
              onClick={saveDraft}
            >
              {t('actions.saveDraft')}
            </ActionButton>
            <ActionButton
              type="submit"
              intent="primary"
              startIcon={<FileCheck2 size={17} />}
              loading={preflight.isPending}
              disabled={!reviewReady || save.isPending || preflight.isPending || attachmentPending}
            >
              {t('common:actions.review')}
            </ActionButton>
          </Stack>
        </Stack>
      </ApprovalSurface>

      <Box
        component="aside"
        aria-label={t('requests.assurance.title')}
        data-testid="approval-request-preflight-pane"
        sx={{
          gridColumn: { lg: '1 / -1' },
          '@media (min-width:1360px)': { gridColumn: 'auto' },
        }}
      >
        {template.data ? (
          <Box
            sx={{
              '@media (min-width:1360px)': { position: 'sticky', top: 88 },
            }}
          >
            <ApprovalRequestPreflight
              template={template.data}
              missingFields={missingFields}
              validation={typedValidation}
              compact
            />
          </Box>
        ) : (
          <ApprovalSurface title={t('requests.assurance.title')}>
            <Stack alignItems="center" gap={1} sx={{ p: 3, color: 'text.secondary' }}>
              <FileCheck2 size={28} aria-hidden="true" />
              <Typography variant="body2" textAlign="center">
                {t('requests.assurance.description')}
              </Typography>
            </Stack>
          </ApprovalSurface>
        )}
      </Box>

      <ApprovalAttachmentNavigationGuard
        locked={attachmentPending || Boolean(attachments.state.file)}
        ownerId={draftId ?? undefined}
      />
      <FormDialog
        open={Boolean(pendingFormId)}
        title={t('requests.fields.form')}
        description={t('requests.compose.editMeta')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.edit')}
        onClose={() => setPendingFormId('')}
        onSubmit={applyFormChange}
        submitDisabled={!pendingFormChange || save.isPending || autosave.status === 'SAVING'}
      >
        {pendingFormChange ? (
          <Stack gap={2}>
            <Box
              component="dl"
              sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 1 }}
            >
              <Typography component="dt" variant="caption" color="text.secondary">
                {t('requests.drafts.migrationSource')}
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                {t('requests.compose.formVersionLabel', {
                  name: pendingFormChange.source.label,
                  version: pendingFormChange.source.version,
                })}
              </Typography>
              <Typography component="dt" variant="caption" color="text.secondary">
                {t('requests.drafts.migrationTarget')}
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                {t('requests.compose.formVersionLabel', {
                  name: pendingFormChange.target.label,
                  version: pendingFormChange.target.version,
                })}
              </Typography>
            </Box>
            <InlineFeedback severity="info">
              <Typography component="p" variant="caption" fontWeight="fontWeightBold">
                {t('requests.drafts.migrationMapped')}
              </Typography>
              <Typography variant="caption">
                {[
                  t('requests.fields.title'),
                  t('requests.fields.summary'),
                  t('requests.fields.priority'),
                ].join(' · ')}
              </Typography>
            </InlineFeedback>
            <InlineFeedback severity={pendingFormChange.excluded.length ? 'warning' : 'success'}>
              <Typography component="p" variant="caption" fontWeight="fontWeightBold">
                {t('requests.drafts.migrationDropped')} · {pendingFormChange.excluded.length}
              </Typography>
              {pendingFormChange.excluded.length > 0 && (
                <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
                  {pendingFormChange.excluded.map((field) => (
                    <Typography component="li" variant="caption" key={field.path}>
                      {field.label}
                    </Typography>
                  ))}
                </Box>
              )}
            </InlineFeedback>
          </Stack>
        ) : (
          <InlineFeedback severity="error">{t('requests.templateError')}</InlineFeedback>
        )}
      </FormDialog>
      <FormDialog
        open={preflightOpen}
        title={t('requests.assurance.title')}
        description={t('requests.assurance.description')}
        cancelLabel={t('actions.cancel')}
        submitLabel={submissionReady ? t('actions.submitRequest') : t('common:actions.review')}
        busy={save.isPending}
        submitDisabled={
          !reviewReady ||
          preflight.isPending ||
          save.isPending ||
          attachmentPending ||
          (submissionReady && (!serverPreflight?.ready || preflight.isError)) ||
          (!submissionReady && validationIssues.length === 0)
        }
        onClose={() => {
          if (!save.isPending) setPreflightOpen(false);
        }}
        onSubmit={() => {
          if (submissionReady && !save.isPending && !attachmentPending) {
            submit();
          } else if (validationIssues[0]) {
            focusIssue(validationIssues[0].path);
          }
        }}
      >
        {template.data && (
          <Stack gap={2}>
            <ApprovalRequestPreflightSummary
              title={title}
              summary={summary}
              priority={priority}
              fields={fields}
              values={formEvaluation.legacyValues}
              typedPayload={formEvaluation.submitEvaluation?.payload}
              formSchema={template.data.form.schema}
            />
            <ApprovalRequestPreflight
              template={template.data}
              missingFields={missingFields}
              validation={typedValidation}
              issues={validationIssues}
              onIssueFocus={focusIssue}
              serverPreflight={serverPreflight}
              serverError={preflight.isError}
              compact
            />
          </Stack>
        )}
      </FormDialog>
    </Box>
  );
}
