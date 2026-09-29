import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BriefcaseBusiness, RefreshCw } from 'lucide-react';
import {
  ActionButton,
  GlyphSurface,
  InlineFeedback,
  LiveStatus,
  OperationalContextBar,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HcmQueryState } from '../../../../components/hcm-query-state';
import { HrisQueryBoundary } from '../../shared';
import {
  PerformanceCycleDraftDialog,
  PerformancePreviewDialog,
  PerformancePublishDialog,
} from '../components/performance-cycle-dialogs';
import {
  PerformanceCommandNotice,
  PerformanceCycleDetailPanel,
  PerformanceCycleList,
  PerformancePopulationPreviewPanel,
} from '../components/performance-cycle-studio-sections';
import {
  useHrisPerformanceCycleRequestScope,
  useHrisPerformanceCycleRuntime,
} from '../hooks/use-performance-cycle-studio';
import { PERFORMANCE_CYCLE_OPERATIONS_ROUTE } from '../model/performance-cycle-contract';
import { getPerformanceCycleCopy } from '../model/performance-cycle-copy';

import type { PerformanceCycleDataSource } from '../api/performance-cycle-api';
import type {
  HrisPerformanceCycleRuntimeOptions,
  PerformanceCommandExecutor,
} from '../hooks/use-performance-cycle-studio';
import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';

export type HrisPerformanceCycleStudioProps = Readonly<{
  dataSource?: PerformanceCycleDataSource;
  authorExecutor?: PerformanceCommandExecutor;
  publisherExecutor?: PerformanceCommandExecutor;
}>;

export type HrisPerformanceCycleStudioRuntimeProps = HrisPerformanceCycleStudioProps &
  Readonly<{ requestScope: ProductSurfaceRequestScope }>;

function CycleStudioHeader({
  title,
  eyebrow,
  description,
}: {
  title: string;
  eyebrow: string;
  description: string;
}) {
  return (
    <Paper component="header" variant="outlined" sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }}>
        <GlyphSurface size={42} variant="soft">
          <BriefcaseBusiness size={21} aria-hidden="true" />
        </GlyphSurface>
        <Box minWidth={0}>
          <Typography variant="overline" color="text.secondary">
            {eyebrow}
          </Typography>
          <Typography component="h2" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

export function HrisPerformanceCycleStudioRuntime({
  requestScope,
  dataSource,
  authorExecutor,
  publisherExecutor,
}: HrisPerformanceCycleStudioRuntimeProps) {
  const { i18n } = useTranslation('hcm');
  const copy = getPerformanceCycleCopy(i18n.resolvedLanguage, i18n.language);
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const runtime = useHrisPerformanceCycleRuntime({
    requestScope,
    dataSource,
    authorExecutor,
    publisherExecutor,
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  return (
    <Stack
      gap={2}
      data-route={PERFORMANCE_CYCLE_OPERATIONS_ROUTE}
      data-scope="performance-cycle-authoring"
    >
      <CycleStudioHeader title={copy.title} eyebrow={copy.eyebrow} description={copy.description} />

      <OperationalContextBar
        label={copy.title}
        items={[
          {
            label: copy.author,
            value: runtime.authorConnected ? copy.connected : copy.unavailable,
          },
          {
            label: copy.publisher,
            value: runtime.publisherConnected ? copy.connected : copy.unavailable,
          },
        ]}
        status={
          <LiveStatus
            state={runtime.collectionStaleError ? 'stale' : 'live'}
            label={runtime.collectionStaleError ? copy.staleTitle : copy.connected}
            refreshLabel={copy.refresh}
            refreshing={runtime.collectionFetching}
            onRefresh={runtime.ready ? () => void runtime.refetchCollection() : undefined}
          />
        }
      />

      {(!runtime.authorConnected || !runtime.publisherConnected) && (
        <InlineFeedback severity="info" title={copy.integrationTitle}>
          {copy.integrationDescription}
        </InlineFeedback>
      )}
      {runtime.collectionStaleError && (
        <InlineFeedback
          severity="warning"
          title={copy.staleTitle}
          action={
            <ActionButton
              size="small"
              intent="quiet"
              loading={runtime.collectionFetching}
              startIcon={<RefreshCw size={14} aria-hidden="true" />}
              onClick={() => void runtime.refetchCollection()}
            >
              {copy.refresh}
            </ActionButton>
          }
        >
          {copy.staleDescription}
        </InlineFeedback>
      )}
      {runtime.feedback && (
        <InlineFeedback severity="success" title={copy.saved}>
          {runtime.feedback}
        </InlineFeedback>
      )}
      <PerformanceCommandNotice
        copy={copy}
        failure={runtime.failure}
        receipt={runtime.receipt}
        receiptError={runtime.receiptError}
        busy={runtime.busy}
        onCheckReceipt={() => void runtime.checkReceipt()}
        onRetryExact={runtime.retryUnknownCommand}
        onLoadLatest={() => void runtime.loadLatest()}
      />

      <HrisQueryBoundary
        loading={runtime.loading}
        error={runtime.collectionError}
        retrying={runtime.collectionFetching}
        onRetry={runtime.ready ? () => void runtime.refetchCollection() : undefined}
      >
        {runtime.collection && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                lg: 'minmax(280px, 360px) minmax(0, 1fr)',
              },
              alignItems: 'start',
              gap: 2,
              minWidth: 0,
            }}
          >
            <PerformanceCycleList
              copy={copy}
              collection={runtime.collection}
              selectedCycleId={runtime.selectedCycleId}
              canCreate={runtime.canCreate}
              onSelect={runtime.selectCycle}
              onCreate={runtime.openCreate}
            />
            <Stack gap={2} minWidth={0}>
              {runtime.detailLoading && <HcmQueryState loading size="compact" />}
              {runtime.detailError && !runtime.detail && (
                <Box>
                  <InlineFeedback severity="warning" title={copy.partialTitle}>
                    {copy.partialDescription}
                  </InlineFeedback>
                  <HcmQueryState
                    error={runtime.detailError}
                    retrying={runtime.detailFetching}
                    onRetry={() => void runtime.refetchDetail()}
                    size="compact"
                  />
                </Box>
              )}
              {runtime.detailError && runtime.detail && (
                <InlineFeedback
                  severity="warning"
                  title={copy.staleTitle}
                  action={
                    <ActionButton
                      size="small"
                      intent="quiet"
                      onClick={() => void runtime.refetchDetail()}
                    >
                      {copy.refresh}
                    </ActionButton>
                  }
                >
                  {copy.staleDescription}
                </InlineFeedback>
              )}
              {runtime.detail && (
                <>
                  <PerformanceCycleDetailPanel
                    copy={copy}
                    locale={locale}
                    detail={runtime.detail}
                    busy={runtime.busy}
                    canEdit={runtime.canEdit}
                    canValidate={runtime.canValidate}
                    canPreview={runtime.canPreview}
                    canPublish={runtime.canPublish}
                    onEdit={runtime.openEdit}
                    onValidate={runtime.validateSelected}
                    onPreview={() => setPreviewOpen(true)}
                    onPublish={() => setPublishOpen(true)}
                  />
                  <PerformancePopulationPreviewPanel
                    copy={copy}
                    locale={locale}
                    preview={runtime.preview}
                    state={runtime.previewState}
                  />
                </>
              )}
            </Stack>
          </Box>
        )}
      </HrisQueryBoundary>

      <PerformanceCycleDraftDialog
        copy={copy}
        draft={runtime.draft}
        validation={runtime.validation}
        busy={runtime.busy}
        conflict={runtime.failure?.kind === 'CONFLICT'}
        setDraft={runtime.setDraft}
        onClose={runtime.closeDraft}
        onSubmit={runtime.saveDraft}
        onLoadLatest={() => void runtime.loadLatest()}
      />
      <PerformancePreviewDialog
        copy={copy}
        open={previewOpen}
        busy={runtime.busy}
        onClose={() => setPreviewOpen(false)}
        onSubmit={(asOf) => {
          runtime.previewSelected(asOf);
          setPreviewOpen(false);
        }}
      />
      <PerformancePublishDialog
        copy={copy}
        open={publishOpen}
        busy={runtime.busy}
        detail={runtime.detail}
        preview={runtime.preview}
        onClose={() => setPublishOpen(false)}
        onSubmit={(approvalRef, reason) => {
          runtime.publishSelected(approvalRef, reason);
          setPublishOpen(false);
        }}
      />
    </Stack>
  );
}

export function HrisPerformanceCycleStudio(props: HrisPerformanceCycleStudioProps) {
  const requestScope = useHrisPerformanceCycleRequestScope();
  return <HrisPerformanceCycleStudioRuntime requestScope={requestScope} {...props} />;
}

export type { HrisPerformanceCycleRuntimeOptions };
