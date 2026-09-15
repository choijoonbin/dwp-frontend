import { useTranslation } from 'react-i18next';
import { ClipboardCheck, RefreshCcw, Send, ShieldCheck, UserRoundCheck } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  AutocompleteField,
  EmptyState,
  FormDialog,
  FormField,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';

import type {
  useApprovalFormPublishReviewAssignment,
  useApprovalFormPublishReviewQueue,
} from './use-approval-form-publish-review';

type Assignment = ReturnType<typeof useApprovalFormPublishReviewAssignment>;
type Queue = ReturnType<typeof useApprovalFormPublishReviewQueue>;

function ReviewRequestSummary({ controller }: { controller: Assignment }) {
  const { t, i18n } = useTranslation('approvals');
  const request = controller.currentRequest.data;
  if (!request) return null;
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  return (
    <Box
      component="section"
      aria-label={t('admin.formPublishReview.status.title')}
      sx={{ borderBlock: 1, borderColor: 'divider', py: 1.5 }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
        <Stack direction="row" gap={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
          <UserRoundCheck size={18} aria-hidden="true" />
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ typography: 'subtitle2' }}>{t('admin.formPublishReview.status.title')}</Box>
            <Box sx={{ typography: 'body2', color: 'text.secondary', overflowWrap: 'anywhere' }}>
              {t('admin.formPublishReview.status.reviewer', { id: request.reviewerUserId })}
            </Box>
            <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
              {formatDate(request.requestedAt, { dateStyle: 'medium', timeStyle: 'short' }, locale)}
            </Box>
          </Box>
        </Stack>
        <Chip
          size="small"
          color={request.status === 'PENDING' ? 'primary' : 'default'}
          variant={request.status === 'PENDING' ? 'filled' : 'outlined'}
          label={t(`admin.formPublishReview.status.values.${request.status}`)}
        />
      </Stack>
      <Box sx={{ mt: 1, typography: 'body2', overflowWrap: 'anywhere' }}>
        {request.requestReason}
      </Box>
      {request.decisionReason ? (
        <InlineFeedback severity={request.status === 'PUBLISHED' ? 'success' : 'warning'}>
          {request.decisionReason}
        </InlineFeedback>
      ) : null}
    </Box>
  );
}

export function ApprovalFormPublishReviewAssignment({ controller }: { controller: Assignment }) {
  const { t } = useTranslation('approvals');
  const problem = controller.problem;
  return (
    <>
      {controller.currentState === 'LOADING' ? (
        <LoadingState label={t('admin.formPublishReview.status.loading')} size="compact" />
      ) : null}
      {controller.currentState === 'DENIED' || controller.currentState === 'UNAVAILABLE' ? (
        <InlineFeedback
          severity="warning"
          action={
            <ActionIconButton
              label={t('actions.retry')}
              disabled={controller.currentRequest.isFetching}
              onClick={() => void controller.currentRequest.refetch()}
            >
              <RefreshCcw size={16} />
            </ActionIconButton>
          }
        >
          {t('admin.formPublishReview.status.unavailable')}
        </InlineFeedback>
      ) : null}
      {controller.currentState === 'READY' ? (
        <ReviewRequestSummary controller={controller} />
      ) : null}
      {controller.canOpen ? (
        <ActionButton
          intent="secondary"
          startIcon={<Send size={16} />}
          disabled={controller.busy}
          onClick={controller.openRequest}
        >
          {t(
            controller.currentRequest.data?.status === 'PENDING'
              ? 'admin.formPublishReview.reassign'
              : 'admin.formPublishReview.request'
          )}
        </ActionButton>
      ) : null}
      <FormDialog
        open={controller.open}
        title={t('admin.formPublishReview.dialog.title')}
        description={t('admin.formPublishReview.dialog.description')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('admin.formPublishReview.dialog.submit')}
        submittingLabel={t('admin.formPublishReview.dialog.submitting')}
        busy={controller.busy}
        submitDisabled={!controller.canSubmit}
        onClose={controller.close}
        onSubmit={controller.submit}
        mobileFullScreen
        maxWidth="sm"
        secondaryActions={
          problem ? (
            <Stack direction="row" gap={1} flexWrap="wrap">
              <ActionButton
                type="button"
                intent="secondary"
                size="small"
                disabled={controller.busy}
                onClick={controller.retryOriginal}
              >
                {t('admin.formPublishReview.dialog.retryOriginal')}
              </ActionButton>
              {problem !== 'UNKNOWN' ? (
                <ActionButton
                  type="button"
                  intent="quiet"
                  size="small"
                  disabled={controller.busy}
                  onClick={controller.editPreserved}
                >
                  {t('admin.formPublishReview.dialog.editPreserved')}
                </ActionButton>
              ) : null}
            </Stack>
          ) : undefined
        }
      >
        <Stack gap={2}>
          <InlineFeedback severity="info">
            {t('admin.formPublishReview.dialog.makerChecker')}
          </InlineFeedback>
          {controller.currentRequest.data?.status === 'PENDING' ? (
            <InlineFeedback severity="warning">
              {t('admin.formPublishReview.dialog.reassignWarning')}
            </InlineFeedback>
          ) : null}
          {problem ? (
            <InlineFeedback severity={problem === 'DENIED' ? 'error' : 'warning'}>
              {t(`admin.formPublishReview.problem.${problem}`)}
            </InlineFeedback>
          ) : null}
          {controller.candidates.isError && controller.deferredCandidateQuery.length >= 2 ? (
            <InlineFeedback
              severity="error"
              action={
                <ActionButton
                  type="button"
                  intent="quiet"
                  size="small"
                  disabled={controller.candidates.isFetching}
                  onClick={() => void controller.candidates.refetch()}
                >
                  {t('actions.retry')}
                </ActionButton>
              }
            >
              {t('admin.formPublishReview.dialog.candidateError')}
            </InlineFeedback>
          ) : null}
          <AutocompleteField
            required
            label={t('admin.formPublishReview.dialog.reviewer')}
            supportingText={t('admin.formPublishReview.dialog.reviewerHelp')}
            value={controller.candidate}
            inputValue={controller.candidateQuery}
            options={
              controller.candidates.isError ? [] : (controller.candidates.data?.candidates ?? [])
            }
            loading={controller.candidates.isFetching}
            disabled={controller.locked || controller.busy}
            filterOptions={(options) => options}
            isOptionEqualToValue={(option, value) => option.userId === value.userId}
            getOptionLabel={(option) =>
              `${option.displayName}${option.jobTitle ? ` (${option.jobTitle})` : ''}${option.email ? ` · ${option.email}` : ''}`
            }
            noOptionsText={
              controller.deferredCandidateQuery.length < 2
                ? t('admin.formPublishReview.dialog.searchHint')
                : t('admin.formPublishReview.dialog.noCandidates')
            }
            onInputChange={(_event, value) => {
              if (!controller.locked) controller.setCandidateQuery(value);
            }}
            onChange={(_event, value) => {
              if (!controller.locked) controller.setCandidate(value);
            }}
          />
          <FormField
            required
            multiline
            minRows={4}
            label={t('admin.formPublishReview.dialog.reason')}
            supportingText={t('admin.formPublishReview.dialog.reasonHelp')}
            value={controller.reason}
            disabled={controller.locked || controller.busy}
            inputProps={{ maxLength: 1000 }}
            onChange={(event) => controller.setReason(event.target.value)}
          />
        </Stack>
      </FormDialog>
    </>
  );
}

export function ApprovalFormPublishReviewQueue({
  controller,
  onOpenForm,
}: {
  controller: Queue;
  onOpenForm: (formId: string) => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  if (!controller.enabled) return null;
  const count = controller.state === 'READY' ? (controller.query.data?.items.length ?? 0) : null;
  return (
    <Box
      component="section"
      aria-label={t('admin.formPublishReview.queue.title')}
      sx={{ borderBlock: 1, borderColor: 'divider', py: 1.25, mb: 2 }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
          <ShieldCheck size={19} aria-hidden="true" />
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ typography: 'subtitle2' }}>{t('admin.formPublishReview.queue.title')}</Box>
            <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
              {count === null
                ? t('admin.formPublishReview.queue.checking')
                : t('admin.formPublishReview.queue.count', { count })}
            </Box>
          </Box>
        </Stack>
        <ActionButton
          intent={count ? 'primary' : 'secondary'}
          startIcon={<ClipboardCheck size={16} />}
          disabled={controller.state === 'LOADING'}
          onClick={controller.openQueue}
        >
          {t('admin.formPublishReview.queue.open')}
        </ActionButton>
      </Stack>
      <FormDialog
        open={controller.open}
        title={t('admin.formPublishReview.queue.title')}
        description={t('admin.formPublishReview.queue.description')}
        cancelLabel={t('actions.close')}
        submitLabel={t('actions.close')}
        showSubmit={false}
        onClose={controller.closeQueue}
        onSubmit={controller.closeQueue}
        mobileFullScreen
        maxWidth="md"
      >
        {controller.state === 'LOADING' ? (
          <LoadingState label={t('admin.formPublishReview.queue.title')} size="compact" />
        ) : controller.state === 'DENIED' || controller.state === 'UNAVAILABLE' ? (
          <InlineFeedback
            severity="error"
            action={
              <ActionButton
                type="button"
                intent="quiet"
                size="small"
                disabled={controller.query.isFetching}
                onClick={() => void controller.query.refetch()}
              >
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('admin.formPublishReview.queue.unavailable')}
          </InlineFeedback>
        ) : controller.query.data?.items.length ? (
          <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {controller.query.data.items.map((item) => (
              <Box component="li" key={item.request.reviewRequestId}>
                <ListItemButton
                  sx={{
                    alignItems: 'flex-start',
                    borderBottom: 1,
                    borderColor: 'divider',
                    py: 1.5,
                  }}
                  onClick={() => {
                    onOpenForm(item.request.formId);
                    controller.closeQueue();
                  }}
                >
                  <Stack gap={0.5} sx={{ width: 1, minWidth: 0 }}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Box sx={{ typography: 'subtitle2', overflowWrap: 'anywhere' }}>
                        {(locale === 'ko' ? item.formNameKo : item.formNameEn) || item.formKey}
                      </Box>
                      <Chip size="small" color="primary" label={t('status.PENDING')} />
                    </Stack>
                    <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                      {item.formKey} ·{' '}
                      {formatDate(
                        item.request.requestedAt,
                        { dateStyle: 'medium', timeStyle: 'short' },
                        locale
                      )}
                    </Box>
                    <Box sx={{ typography: 'body2', overflowWrap: 'anywhere' }}>
                      {item.request.requestReason}
                    </Box>
                  </Stack>
                </ListItemButton>
              </Box>
            ))}
          </Stack>
        ) : (
          <EmptyState
            title={t('admin.formPublishReview.queue.empty')}
            description={t('admin.formPublishReview.queue.emptyDescription')}
            icon={<ClipboardCheck size={24} />}
            size="compact"
          />
        )}
        {controller.query.data?.mayBeTruncated ? (
          <InlineFeedback severity="warning">
            {t('admin.formPublishReview.queue.truncated')}
          </InlineFeedback>
        ) : null}
      </FormDialog>
    </Box>
  );
}
