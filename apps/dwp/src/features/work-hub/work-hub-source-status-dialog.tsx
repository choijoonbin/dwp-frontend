import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  CircleAlert,
  DatabaseZap,
  LockKeyhole,
  MinusCircle,
  RefreshCw,
} from 'lucide-react';
import { ActionButton, FormDialog, foundationTokens } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { Link } from 'react-router-dom';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import {
  WorkHubBatchReportPanel,
  summarizeWorkHubBatchReceipts,
  type WorkHubBatchOutcome,
} from './work-hub-batch-dialog';
import type { WorkHubBatchReceipt } from './work-hub-batch-execution';
import type {
  WorkHubItem,
  WorkHubSnapshot,
  WorkHubSourceId,
  WorkHubSourceSnapshot,
} from './work-hub-contracts';

const sourceListRoutes: Partial<Record<WorkHubSourceId, string>> = {
  'approval-inbox': '/approvals/inbox',
  'approval-completed': '/approvals/completed',
  'approval-needs-info': '/approvals/requests/needs-info',
  services: '/services/my',
};

type SourceReviewTab = 'sources' | 'results';

export function WorkHubSourceStatusDialog({
  open,
  sources,
  onClose,
  onRetry,
  onRetrySource,
  retrying,
  snapshotReceivedAt,
  completeness,
  batchItems = [],
  batchOutcome = null,
  batchReceipts = [],
  onOpenBatchResults,
  batchExpanded = false,
  reportFocused = false,
  onRetryUnconfirmed,
  onReviewItem,
  reviewUnavailable = false,
}: {
  open: boolean;
  sources: readonly WorkHubSourceSnapshot[];
  onClose: () => void;
  onRetry: () => void;
  onRetrySource?: (sourceId: WorkHubSourceId) => void;
  retrying: boolean;
  snapshotReceivedAt?: string;
  completeness?: WorkHubSnapshot['completeness'];
  batchItems?: readonly WorkHubItem[];
  batchOutcome?: WorkHubBatchOutcome | null;
  batchReceipts?: readonly WorkHubBatchReceipt[];
  onOpenBatchResults?: () => void;
  batchExpanded?: boolean;
  reportFocused?: boolean;
  onRetryUnconfirmed?: () => void;
  onReviewItem?: (item: WorkHubItem) => void;
  reviewUnavailable?: boolean;
}) {
  const { t } = useTranslation(['work', 'common']);
  const tabsId = useId();
  const [activeTab, setActiveTab] = useState<SourceReviewTab>(
    reportFocused ? 'results' : 'sources'
  );
  const previousOpen = useRef(false);
  const previousReportFocused = useRef(false);
  const ready = sources.filter((source) => source.state === 'READY').length;
  const attention = sources.filter((source) =>
    ['UNAVAILABLE', 'FORBIDDEN'].includes(source.state)
  ).length;
  const batchSummary = summarizeWorkHubBatchReceipts(batchItems, batchReceipts);
  const hasBatchReport = Boolean(batchOutcome && batchReceipts.length);
  useEffect(() => {
    if (open && (!previousOpen.current || (reportFocused && !previousReportFocused.current))) {
      setActiveTab(reportFocused ? 'results' : 'sources');
    }
    previousOpen.current = open;
    previousReportFocused.current = reportFocused;
  }, [open, reportFocused]);

  const selectTab = (next: SourceReviewTab) => {
    setActiveTab(next);
    if (next === 'results' && hasBatchReport && !batchExpanded) onOpenBatchResults?.();
  };
  return (
    <FormDialog
      open={open}
      title={t(
        reportFocused ? 'work:workHub.batch.reportTitle' : 'work:workHub.sourcesDialog.title'
      )}
      description={t(
        reportFocused
          ? 'work:workHub.sourcesDialog.integratedDescription'
          : 'work:workHub.sourcesDialog.description'
      )}
      cancelLabel={t('common:actions.close')}
      submitLabel={t('work:workHub.sourcesDialog.retry')}
      submittingLabel={t('work:workHub.sourcesDialog.retrying')}
      busy={retrying}
      onClose={onClose}
      onSubmit={onRetry}
      mobileFullScreen
      maxWidth="lg"
    >
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.radius.surface + foundationTokens.radius.control + 'px',
          overflow: 'hidden',
          bgcolor: 'background.paper',
          '@media (forced-colors: active)': { borderColor: 'CanvasText' },
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={{ xs: 1.5, sm: 2 }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          sx={{ px: { xs: 1.5, sm: 2 }, py: 1.5, bgcolor: 'action.hover' }}
        >
          <Box
            aria-hidden="true"
            sx={{
              width: 42,
              height: 42,
              display: 'grid',
              placeItems: 'center',
              borderRadius:
                foundationTokens.radius.surface + foundationTokens.radius.control + 'px',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '@media (forced-colors: active)': { border: '1px solid ButtonText' },
            }}
          >
            <DatabaseZap size={21} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <Chip
                size="small"
                color="primary"
                label={t('work:workHub.sourcesDialog.serviceCode')}
              />
              <Typography variant="subtitle1" fontWeight="fontWeightBold">
                {t('work:workHub.sourcesDialog.integratedTitle')}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {t('work:workHub.sourcesDialog.integratedDescription')}
            </Typography>
          </Box>
          <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
            <Typography variant="caption" color="text.secondary">
              {snapshotReceivedAt
                ? t('work:workHub.sourcesDialog.snapshotAt', {
                    date: formatDate(snapshotReceivedAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                  })
                : t('work:workHub.sourcesDialog.snapshotUnavailable')}
            </Typography>
            {completeness && (
              <Typography variant="caption" color="text.secondary">
                {t(`work:workHub.sourcesDialog.completeness.${completeness}`)}
              </Typography>
            )}
          </Stack>
        </Stack>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_event, value: SourceReviewTab) => selectTab(value)}
        aria-label={t('work:workHub.sourcesDialog.tabs.label')}
        variant="fullWidth"
        selectionFollowsFocus
        sx={{
          mt: 2,
          minHeight: 52,
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.radius.surface + foundationTokens.radius.control + 'px',
          bgcolor: 'action.hover',
          '& .MuiTabs-indicator': { height: 3 },
          '& .MuiTab-root': {
            minWidth: 0,
            minHeight: 52,
            px: { xs: 0.75, sm: 2 },
            py: 1,
            whiteSpace: 'normal',
            lineHeight: 'body2.lineHeight',
            textTransform: 'none',
          },
          '@media (forced-colors: active)': { borderColor: 'CanvasText' },
        }}
      >
        <Tab
          id={`${tabsId}-sources-tab`}
          value="sources"
          label={t('work:workHub.sourcesDialog.tabs.sources', { count: sources.length })}
          aria-controls={`${tabsId}-sources-panel`}
        />
        <Tab
          id={`${tabsId}-results-tab`}
          value="results"
          label={t('work:workHub.sourcesDialog.tabs.results', { count: batchReceipts.length })}
          aria-controls={`${tabsId}-results-panel`}
        />
      </Tabs>

      <Box
        id={`${tabsId}-sources-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-sources-tab`}
        hidden={activeTab !== 'sources'}
        sx={{ mt: 2, minWidth: 0 }}
      >
        <Box component="section" aria-labelledby="work-source-status-heading">
          <Stack direction="row" justifyContent="space-between" gap={1.5} alignItems="flex-start">
            <Box>
              <Typography
                id="work-source-status-heading"
                variant="subtitle1"
                fontWeight="fontWeightBold"
              >
                {t('work:workHub.sourcesDialog.sourcePanelTitle')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('work:workHub.sourcesDialog.sourcePanelDescription', {
                  count: sources.length,
                })}
              </Typography>
            </Box>
            <Stack direction="row" gap={0.75} flexWrap="wrap" justifyContent="flex-end">
              <Chip
                size="small"
                color="success"
                variant="outlined"
                label={t('work:workHub.sourcesDialog.readyCount', { count: ready })}
              />
              <Chip
                size="small"
                color={attention > 0 ? 'warning' : 'default'}
                variant="outlined"
                label={t('work:workHub.sourcesDialog.attentionCount', { count: attention })}
              />
            </Stack>
          </Stack>
          <Stack
            component="ul"
            aria-label={t('work:workHub.sourcesDialog.sourceList')}
            gap={1}
            sx={{ listStyle: 'none', p: 0, mt: 1.5, mb: 0 }}
          >
            {sources.map((source) => {
              const Icon =
                source.state === 'READY'
                  ? CheckCircle2
                  : source.state === 'FORBIDDEN'
                    ? LockKeyhole
                    : source.state === 'NOT_REQUESTED'
                      ? MinusCircle
                      : CircleAlert;
              return (
                <Box
                  component="li"
                  key={source.sourceId}
                  sx={{
                    p: 1.5,
                    border: 1,
                    borderColor: source.state === 'UNAVAILABLE' ? 'error.main' : 'divider',
                    bgcolor: source.state === 'UNAVAILABLE' ? 'action.hover' : 'background.paper',
                    borderRadius:
                      foundationTokens.radius.surface + foundationTokens.radius.control + 'px',
                    '@media (forced-colors: active)': { borderColor: 'CanvasText' },
                  }}
                >
                  <Stack direction="row" gap={1.25} alignItems="flex-start">
                    <Box sx={{ color: source.state === 'READY' ? 'success.main' : 'warning.main' }}>
                      <Icon size={19} aria-hidden="true" />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack
                        direction="row"
                        gap={1}
                        justifyContent="space-between"
                        alignItems="flex-start"
                      >
                        <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                          {t(`work:workHub.sourceIds.${source.sourceId}`)}
                        </Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t(`work:workHub.sourcesDialog.states.${source.state}`)}
                          color={
                            source.state === 'READY'
                              ? 'success'
                              : source.state === 'UNAVAILABLE'
                                ? 'error'
                                : 'default'
                          }
                        />
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {source.state === 'READY'
                          ? t('work:workHub.sourcesDialog.itemCount', {
                              count: source.items.length,
                            })
                          : t(`work:workHub.sourcesDialog.stateHelp.${source.state}`)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {source.receivedAt
                          ? t('work:workHub.sourcesDialog.receivedAt', {
                              date: formatDate(source.receivedAt, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }),
                            })
                          : t(`work:workHub.sourcesDialog.stateHelp.${source.state}`)}
                      </Typography>
                      {source.hasMore && (
                        <Typography
                          variant="caption"
                          color="warning.main"
                          sx={{ display: 'block', mt: 0.5 }}
                        >
                          {t('work:workHub.sourcesDialog.moreResults')}
                        </Typography>
                      )}
                      {source.state !== 'NOT_REQUESTED' && (
                        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
                          {onRetrySource && (
                            <ActionButton
                              intent="quiet"
                              disabled={retrying}
                              onClick={() => onRetrySource(source.sourceId)}
                              aria-label={t('work:workHub.sourcesDialog.retrySourceLabel', {
                                source: t(`work:workHub.sourceIds.${source.sourceId}`),
                              })}
                              sx={{ minHeight: 44, gap: 0.75 }}
                            >
                              <RefreshCw size={16} aria-hidden="true" />
                              {t('work:workHub.sourcesDialog.retrySource')}
                            </ActionButton>
                          )}
                          {sourceListRoutes[source.sourceId] && source.state !== 'FORBIDDEN' && (
                            <ActionButton
                              intent="quiet"
                              component={Link}
                              to={sourceListRoutes[source.sourceId]}
                              sx={{ minHeight: 44 }}
                            >
                              {t('work:workHub.sourcesDialog.openSource')}
                            </ActionButton>
                          )}
                        </Stack>
                      )}
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Box>

      <Box
        id={`${tabsId}-results-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-results-tab`}
        hidden={activeTab !== 'results'}
        sx={{ mt: 2, minWidth: 0 }}
      >
        <Box
          component="section"
          aria-labelledby="work-batch-report-heading"
          sx={{
            minWidth: 0,
            p: { xs: 1.5, sm: 2 },
            border: 1,
            borderColor: 'divider',
            borderRadius: foundationTokens.radius.surface + foundationTokens.radius.control + 'px',
            bgcolor: 'action.hover',
            '@media (forced-colors: active)': { borderColor: 'CanvasText' },
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            gap={1}
            alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          >
            <Box>
              <Typography
                id="work-batch-report-heading"
                variant="subtitle1"
                fontWeight="fontWeightBold"
              >
                {t('work:workHub.batch.reportTitle')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {hasBatchReport
                  ? t('work:workHub.batch.reportSummary', {
                      total: batchSummary.selected,
                      confirmed: batchSummary.confirmed,
                    })
                  : t('work:workHub.batch.noReceiptResults')}
              </Typography>
            </Box>
            {hasBatchReport && onOpenBatchResults && !batchExpanded && (
              <ActionButton
                intent="secondary"
                sx={{ minHeight: 44 }}
                onClick={onOpenBatchResults}
                aria-expanded={false}
                aria-controls="work-batch-report-detail"
              >
                {t('work:workHub.batch.reopenReport')} ({batchReceipts.length})
              </ActionButton>
            )}
          </Stack>
          {hasBatchReport && batchExpanded && batchOutcome && (
            <Box id="work-batch-report-detail" sx={{ mt: 1.5 }}>
              <WorkHubBatchReportPanel
                items={batchItems}
                outcome={batchOutcome}
                busy={retrying}
                receipts={batchReceipts}
                onRetryUnconfirmed={onRetryUnconfirmed}
                onReviewItem={onReviewItem}
                reviewUnavailable={reviewUnavailable}
                compact
              />
            </Box>
          )}
        </Box>
      </Box>
    </FormDialog>
  );
}
