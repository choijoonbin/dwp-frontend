import { useTranslation } from 'react-i18next';
import { ActionButton, FormDialog, InlineFeedback } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';

import type { ApprovalResubmitDraftController } from './use-approval-resubmit-draft';

export function ApprovalResubmitDraftDialog({
  controller,
  onRefresh,
}: {
  controller: ApprovalResubmitDraftController;
  onRefresh: () => Promise<unknown>;
}) {
  const { t } = useTranslation('approvals');
  const problem = controller.problem;
  return (
    <FormDialog
      open={Boolean(controller.candidate)}
      mobileFullScreen
      title={t('requests.resubmit.title')}
      description={t('requests.resubmit.description', { title: controller.candidate?.title })}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('requests.resubmit.confirm')}
      submitIntent="primary"
      busy={controller.pending}
      submitDisabled={
        !controller.sourceCurrent || controller.pending || Boolean(controller.problem)
      }
      onClose={controller.close}
      onSubmit={controller.submit}
    >
      <Stack gap={1.5}>
        <InlineFeedback severity="info">{t('requests.resubmit.immutableSource')}</InlineFeedback>
        {problem && (
          <InlineFeedback
            severity={problem === 'CONFLICT' ? 'warning' : 'error'}
            action={
              ['UNAVAILABLE', 'UNKNOWN'].includes(problem) ? (
                <ActionButton
                  type="button"
                  intent="quiet"
                  size="small"
                  disabled={controller.pending}
                  onClick={controller.retryOriginal}
                >
                  {t('requests.resubmit.retryOriginal')}
                </ActionButton>
              ) : (
                <ActionButton
                  type="button"
                  intent="quiet"
                  size="small"
                  disabled={controller.pending}
                  onClick={() => void onRefresh().finally(controller.close)}
                >
                  {t('actions.refresh')}
                </ActionButton>
              )
            }
          >
            {t(`requests.resubmit.errors.${problem}`)}
          </InlineFeedback>
        )}
      </Stack>
    </FormDialog>
  );
}
