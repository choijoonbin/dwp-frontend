import { useTranslation } from 'react-i18next';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';

import type { WorkHubSnapshot } from './work-hub-contracts';
import type { WorkHubOperationFeedback } from './work-hub-page-helpers';

export function workHubPartialCopy(snapshot: WorkHubSnapshot) {
  const failed = snapshot.sources.some(
    (source) => source.state === 'FORBIDDEN' || source.state === 'UNAVAILABLE'
  );
  const truncated = snapshot.sources.some((source) => source.state === 'READY' && source.hasMore);
  const prefix = truncated && !failed ? 'bounded' : failed && truncated ? 'mixed' : 'failure';
  return {
    title: `workHub.partial.${prefix}Title`,
    description: `workHub.partial.${prefix}Description`,
  };
}

export function WorkHubPartialNotice({
  snapshot,
  onInspect,
}: {
  snapshot: WorkHubSnapshot;
  onInspect: () => void;
}) {
  const { t } = useTranslation('work');
  const copy = workHubPartialCopy(snapshot);
  return (
    <InlineFeedback severity="warning" title={t(copy.title)} sx={{ mt: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        gap={1}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
      >
        <span>{t(copy.description)}</span>
        <ActionButton
          intent="quiet"
          size="small"
          onClick={onInspect}
          sx={{ '@media (max-width:899.95px)': { minHeight: 44 } }}
        >
          {t('workHub.partial.inspect')}
        </ActionButton>
      </Stack>
    </InlineFeedback>
  );
}

export function WorkHubPageNotices({
  queryError,
  snapshot,
  showBatchReportAction,
  onInspectSources,
  onReopenBatchReport,
  feedback,
  onDismissFeedback,
}: {
  queryError: boolean;
  snapshot: WorkHubSnapshot;
  showBatchReportAction: boolean;
  onInspectSources: () => void;
  onReopenBatchReport: () => void;
  feedback: WorkHubOperationFeedback | null;
  onDismissFeedback: () => void;
}) {
  const { t } = useTranslation(['work', 'common']);

  return (
    <>
      {queryError && (
        <InlineFeedback severity="warning" title={t('work:workPage.loadErrorTitle')} sx={{ mt: 2 }}>
          {t('work:workPage.loadErrorDescription')}
        </InlineFeedback>
      )}
      {snapshot.completeness === 'UNAVAILABLE' && snapshot.items.length > 0 && (
        <InlineFeedback
          severity="warning"
          title={t('work:workPage.freshness.degraded')}
          sx={{ mt: 2 }}
        >
          {t('work:workPage.loadErrorDescription')}
        </InlineFeedback>
      )}
      {snapshot.completeness === 'PARTIAL' && snapshot.items.length > 0 && (
        <WorkHubPartialNotice snapshot={snapshot} onInspect={onInspectSources} />
      )}
      {showBatchReportAction && (
        <ActionButton
          intent="quiet"
          size="small"
          onClick={onReopenBatchReport}
          sx={{ minHeight: { xs: 44, md: 32 } }}
        >
          {t('work:workHub.batch.reopenReport')}
        </ActionButton>
      )}
      {feedback && (
        <InlineFeedback
          severity={feedback.severity}
          title={feedback.title}
          onClose={onDismissFeedback}
          closeLabel={t('common:actions.close')}
          sx={{ mt: 2 }}
        >
          {feedback.detail}
        </InlineFeedback>
      )}
    </>
  );
}
