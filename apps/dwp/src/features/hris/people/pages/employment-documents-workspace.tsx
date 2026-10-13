import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, GuidedEmptyState, InlineFeedback } from '@dwp-frontend/design-system';
import { formatCivilDate, formatDate } from '@dwp-frontend/shared-i18n';
import { FileText, RefreshCw, ShieldCheck } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HcmQueryState } from '../../../../components/hcm-query-state';
import {
  useProductSurfaceRequestScope,
  type ProductSurfaceRequestScope,
} from '../../../../components/use-product-surface-request-scope';
import {
  getEmploymentDocumentsWorkbench,
  type EmploymentDocument,
  type EmploymentDocumentsWorkbench,
} from '../api/employment-workbench-api';
import {
  getEmploymentDocumentsCopy,
  type EmploymentDocumentsCopy,
} from '../model/employment-documents-copy';

export type EmploymentDocumentsReader = (
  contextScopeKey?: string,
  asOf?: string,
  signal?: AbortSignal
) => Promise<EmploymentDocumentsWorkbench>;

function statusColor(status: string): 'default' | 'success' | 'warning' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'SUSPENDED' || status === 'PENDING') return 'warning';
  return 'default';
}

function DocumentField({
  label,
  value,
  mono = false,
}: Readonly<{ label: string; value: React.ReactNode; mono?: boolean }>) {
  return (
    <Box minWidth={0}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        sx={{
          m: 0,
          mt: 0.25,
          overflowWrap: 'anywhere',
          ...(mono ? { fontFamily: 'monospace' } : {}),
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function EmploymentDocumentCard({
  document,
  index,
  copy,
}: Readonly<{
  document: EmploymentDocument;
  index: number;
  copy: EmploymentDocumentsCopy;
}>) {
  const titleId = `employment-document-${document.assignmentPublicId}`;
  const period = `${formatCivilDate(document.validFrom)} — ${
    document.validToExclusive ? formatCivilDate(document.validToExclusive) : copy.current
  }`;
  return (
    <Paper
      component="li"
      variant="outlined"
      aria-labelledby={titleId}
      sx={{ listStyle: 'none', p: { xs: 1.5, sm: 2 }, minWidth: 0 }}
    >
      <Stack gap={1.5} minWidth={0}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          gap={1}
          minWidth={0}
        >
          <Box minWidth={0} flex={1}>
            <Typography id={titleId} component="h3" variant="subtitle1" fontWeight={700}>
              {copy.documentLabel(index + 1, document.relationshipType)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {period}
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            color={statusColor(document.status)}
            label={`${copy.status}: ${document.status}`}
            sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
          />
        </Stack>

        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.5,
            minWidth: 0,
          }}
        >
          <DocumentField label={copy.relationshipType} value={document.relationshipType} />
          <DocumentField label={copy.effectivePeriod} value={period} />
          <DocumentField
            label={copy.relationshipReference}
            value={document.relationshipPublicId}
            mono
          />
          <DocumentField
            label={copy.assignmentReference}
            value={document.assignmentPublicId}
            mono
          />
          <DocumentField label={copy.workerReference} value={document.workerPublicId} mono />
          <DocumentField label={copy.revision} value={document.revision} />
        </Box>
      </Stack>
    </Paper>
  );
}

export function EmploymentDocumentsRuntime({
  requestScope,
  reader = getEmploymentDocumentsWorkbench,
}: Readonly<{
  requestScope: ProductSurfaceRequestScope;
  reader?: EmploymentDocumentsReader;
}>) {
  const { i18n } = useTranslation();
  const copy = getEmploymentDocumentsCopy(i18n.resolvedLanguage, i18n.language);
  const query = useQuery({
    queryKey: ['hris', 'employment', 'self-service-documents', ...requestScope.cacheKey],
    queryFn: ({ signal }) => reader(requestScope.contextScopeKey, undefined, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    retry: false,
  });
  const workbench = query.data;
  const documents = workbench?.documents ?? [];
  const partial = Boolean(workbench && query.isRefetchError);
  const loading = !requestScope.ready || (!workbench && query.isLoading);
  const failed = !workbench && query.error;

  return (
    <Stack
      gap={1.5}
      data-slice="BASE-TFR-HRM-008"
      data-workspace="employment-documents"
      data-state={partial ? 'partial' : loading ? 'loading' : failed ? 'error' : 'ready'}
      minWidth={0}
      width="100%"
      maxWidth={1120}
      mx="auto"
    >
      <Paper component="header" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          gap={1.5}
          minWidth={0}
        >
          <FileText size={24} aria-hidden="true" />
          <Box minWidth={0} flex={1}>
            <Typography variant="overline" color="text.secondary">
              {copy.persona}
            </Typography>
            <Typography component="h1" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
              {copy.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {copy.description}
            </Typography>
          </Box>
          <ActionButton
            intent="primary"
            loading={query.isFetching}
            loadingLabel={copy.refreshing}
            disabled={!requestScope.ready}
            startIcon={<RefreshCw size={16} aria-hidden="true" />}
            onClick={() => void query.refetch()}
            sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, whiteSpace: 'normal' }}
          >
            {copy.refresh}
          </ActionButton>
        </Stack>
      </Paper>

      <Paper
        component="section"
        variant="outlined"
        aria-labelledby="employment-documents-question"
        sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}
      >
        <Stack gap={1.25} minWidth={0}>
          <Stack direction="row" gap={1} alignItems="flex-start" minWidth={0}>
            <ShieldCheck size={20} aria-hidden="true" />
            <Box minWidth={0}>
              <Typography
                id="employment-documents-question"
                component="h2"
                variant="subtitle1"
                fontWeight={700}
                sx={{ overflowWrap: 'anywhere' }}
              >
                {copy.question}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {copy.guidance}
              </Typography>
            </Box>
          </Stack>
          {workbench && (
            <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                variant="outlined"
                label={`${copy.asOf}: ${formatDate(workbench.asOf, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}`}
              />
              <Chip size="small" variant="outlined" label={copy.documentCount(documents.length)} />
            </Stack>
          )}
        </Stack>
      </Paper>

      {partial && (
        <InlineFeedback severity="warning" title={copy.partialTitle}>
          {copy.partialDescription}
        </InlineFeedback>
      )}

      <Paper
        component="section"
        variant="outlined"
        aria-labelledby="employment-records-title"
        sx={{ minWidth: 0 }}
      >
        <Box sx={{ p: { xs: 1.5, sm: 2 }, borderBottom: 1, borderColor: 'divider' }}>
          <Typography
            id="employment-records-title"
            component="h2"
            variant="subtitle1"
            fontWeight={700}
          >
            {copy.recordsTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {copy.recordsDescription}
          </Typography>
        </Box>
        <Box sx={{ p: { xs: 1, sm: 1.5 }, minWidth: 0 }}>
          {loading && <HcmQueryState loading size="page" />}
          {failed && (
            <HcmQueryState
              error={query.error}
              retrying={query.isFetching}
              onRetry={() => void query.refetch()}
              size="page"
            />
          )}
          {workbench && documents.length === 0 && (
            <GuidedEmptyState
              kind="empty"
              size="page"
              title={copy.emptyTitle}
              description={copy.emptyDescription}
              actionLabel={copy.refresh}
              onAction={() => void query.refetch()}
            />
          )}
          {documents.length > 0 && (
            <Stack component="ul" gap={1} sx={{ p: 0, m: 0, minWidth: 0 }}>
              {documents.map((document, index) => (
                <EmploymentDocumentCard
                  key={`${document.assignmentPublicId}:${document.revision}`}
                  document={document}
                  index={index}
                  copy={copy}
                />
              ))}
            </Stack>
          )}
        </Box>
      </Paper>
    </Stack>
  );
}

export function HrisEmploymentDocumentsWorkspace() {
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.personal',
  });
  return <EmploymentDocumentsRuntime requestScope={requestScope} />;
}
