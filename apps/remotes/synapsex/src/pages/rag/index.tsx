/**
 * RAG Library — Documents list + register modal + search
 */

import type { SelectChangeEvent } from '@mui/material/Select';

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';
import {
  useRagSearchQuery,
  useRagDocumentsQuery,
  useLatestRagEvalRunQuery,
  useAuraQualityMetricsQuery,
  useRegisterRagDocumentMutation,
  type RegisterRagDocumentPayload,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../../routes';
import { useAgentCatalog } from '../../hooks/use-agent-catalog';
import { RegisterRagDocumentModal } from './components/register-rag-document-modal';
import { formatQualityPercent, normalizeQualityReport } from './components/rag-quality-report-card';

// ----------------------------------------------------------------------

const formatDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const toStartOfDayIso = (dateText: string): string => `${dateText}T00:00:00.000Z`;
const toEndOfDayIso = (dateText: string): string => `${dateText}T23:59:59.999Z`;

const statusMeta: Record<string, { icon: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  completed: { icon: 'solar:check-circle-bold', color: 'success' },
  processing: { icon: 'solar:clock-circle-bold', color: 'warning' },
  vectorizing: { icon: 'solar:clock-circle-bold', color: 'warning' },
  failed: { icon: 'solar:danger-triangle-bold', color: 'error' },
  indexed: { icon: 'solar:check-circle-bold', color: 'success' },
  indexing: { icon: 'solar:clock-circle-bold', color: 'warning' },
  error: { icon: 'solar:danger-triangle-bold', color: 'error' },
  default: { icon: 'solar:info-circle-bold', color: 'default' },
};

/** Mock: how often this doc was referenced in recent AI inference. Replace with API when available. */
const getMockReferenceCount = (docId: string, index: number): number =>
  (docId.length * 5 + index) % 21;

const toPercentText = (value: number | null): string => {
  if (value == null || !Number.isFinite(value)) return '-';
  const normalized = value <= 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
};

// ----------------------------------------------------------------------

export const RagPage = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState('');
  const [qualityFromDate, setQualityFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDateInput(d);
  });
  const [qualityToDate, setQualityToDate] = useState<string>(() => formatDateInput(new Date()));

  const { data: docsData, isLoading: docsLoading, error: docsError, refetch: refetchDocs } = useRagDocumentsQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const { data: searchData, isLoading: searchLoading, refetch: refetchSearch } = useRagSearchQuery(
    { q: searchSubmitted, page: 0, size: 20 },
    Boolean(searchSubmitted.trim())
  );
  const {
    data: latestEval,
    isError: latestEvalIsError,
    error: latestEvalError,
    refetch: refetchLatestEval,
  } = useLatestRagEvalRunQuery();
  const qualityParams = useMemo(
    () => ({
      from: toStartOfDayIso(qualityFromDate),
      to: toEndOfDayIso(qualityToDate),
    }),
    [qualityFromDate, qualityToDate]
  );
  const { data: auraQualityMetrics, refetch: refetchAuraQuality } = useAuraQualityMetricsQuery(qualityParams);

  const registerMutation = useRegisterRagDocumentMutation();
  const { docTypes } = useAgentCatalog();

  const items = useMemo(() => docsData?.items ?? [], [docsData?.items]);
  const totalDocs = docsData?.total ?? 0;
  const indexedCount = items.filter((d) => String(d.status).toUpperCase() === 'COMPLETED').length;
  const attentionCount = items.filter((d) => String(d.status).toUpperCase() !== 'COMPLETED').length;
  const qualityPassRate = useMemo(() => {
    const reports = items
      .map((item) => normalizeQualityReport(item.quality_report ?? item.qualityReport))
      .filter((report): report is NonNullable<typeof report> => report !== null);
    if (reports.length === 0) return null;
    const passCount = reports.filter((report) => report.pass === true).length;
    return passCount / reports.length;
  }, [items]);
  const evalHitAtK = latestEval?.hitAtK ?? null;
  const evalStrictHitTop1 = latestEval?.strictHitTop1 ?? null;
  const evalNoData = latestEval === null;
  const evalPassed = latestEval?.gatePassed === true;
  const evalGateText = latestEvalIsError
    ? '평가 결과 조회 실패'
    : evalNoData
      ? t('rag.metrics.noEvalData')
      : evalPassed
        ? t('rag.metrics.evalPass')
        : t('rag.metrics.evalFail');
  const evalGateLabelColor: 'success' | 'error' | 'default' = latestEvalIsError
    ? 'error'
    : evalNoData
      ? 'default'
      : evalPassed
        ? 'success'
        : 'error';
  const auraRagZeroRatio =
    auraQualityMetrics?.ragZeroRatio ?? auraQualityMetrics?.ragZeroRate ?? auraQualityMetrics?.rag_0_rate ?? null;
  const auraEvidenceCoverageLowRatio = auraQualityMetrics?.evidenceCoverageLowRatio ?? null;
  const auraSentenceCitationMissingRatio = auraQualityMetrics?.sentenceCitationMissingRatio ?? null;
  const auraPolicyReevalAppliedRatio = auraQualityMetrics?.policyReevalAppliedRatio ?? null;

  const searchGroupedByDoc = useMemo(() => {
    const searchResults = searchData?.items ?? [];
    const map = new Map<string, typeof searchResults>();
    for (const r of searchResults) {
      const list = map.get(r.docId) ?? [];
      list.push(r);
      map.set(r.docId, list);
    }
    return Array.from(map.entries()).map(([docId, chunks]) => {
      const first = chunks[0];
      return { docId, docTitle: first?.docTitle ?? docId, chunks };
    });
  }, [searchData?.items]);

  const handleRegisterSubmit = (payload: RegisterRagDocumentPayload) => {
    registerMutation.mutate(payload, {
      onSuccess: () => {
        setRegisterOpen(false);
      },
    });
  };

  const handleSearch = () => {
    setSearchSubmitted(searchQ.trim());
  };
  const handleRefreshAll = () => {
    void refetchDocs();
    void refetchLatestEval();
    void refetchAuraQuality();
    if (searchSubmitted.trim()) {
      void refetchSearch();
    }
  };

  if (docsError) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <Iconify icon="solar:danger-triangle-bold-duotone" width={48} sx={{ color: 'error.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {t('rag.error.failedToLoad')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {docsError instanceof Error ? docsError.message : t('error.errorState.unknownError')}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:book-2-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('rag.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {t('rag.subtitle')}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:refresh-bold" width={18} />}
              onClick={handleRefreshAll}
            >
              새로고침
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<Iconify icon="solar:upload-bold" width={18} />}
              onClick={() => setRegisterOpen(true)}
            >
              {t('rag.registerDocument')}
            </Button>
          </Stack>
        </Stack>

        {/* 문서 운영 KPI */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  {t('rag.documents')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {totalDocs}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('rag.totalRegistered')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  {t('rag.indexed')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {indexedCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('rag.readyForCitations')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  {t('rag.attentionNeeded')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {attentionCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('rag.indexingErrors')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  {t('rag.metrics.chunkPassRate')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {toPercentText(qualityPassRate)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('rag.metrics.fromQualityReport')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  {t('rag.metrics.evalGate')}
                </Typography>
                <Label color={evalGateLabelColor} variant="soft" sx={{ fontSize: '0.85rem', fontWeight: 700 }}>
                  {evalGateText}
                </Label>
                <Typography variant="caption" color="text.secondary">
                  {latestEvalIsError
                    ? latestEvalError instanceof Error
                      ? latestEvalError.message
                      : '평가 결과 조회 중 오류가 발생했습니다.'
                    : latestEval?.runKey ?? t('rag.metrics.noEvalRunKey')}
                </Typography>
                {evalNoData && !latestEvalIsError && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    아직 평가 결과가 없습니다.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  평가 품질 (latest eval-run)
                </Typography>
                <Stack spacing={0.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      {t('rag.metrics.hitAtK')}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {toPercentText(evalHitAtK)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      {t('rag.metrics.strictHitTop1')}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {toPercentText(evalStrictHitTop1)}
                    </Typography>
                  </Stack>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {t('rag.metrics.fromLatestEvalRun')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ sm: 'center' }}
              justifyContent="space-between"
              spacing={1.5}
              sx={{ mb: 2 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Iconify icon="solar:chart-square-bold-duotone" width={20} sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Aura 품질 게이트 KPI
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  type="date"
                  label="from"
                  value={qualityFromDate}
                  onChange={(e) => setQualityFromDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ max: qualityToDate }}
                />
                <TextField
                  size="small"
                  type="date"
                  label="to"
                  value={qualityToDate}
                  onChange={(e) => setQualityToDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: qualityFromDate }}
                />
              </Stack>
            </Stack>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                      RAG_ZERO 비율
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {toPercentText(auraRagZeroRatio)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                      EVIDENCE_COVERAGE_LOW 비율
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {toPercentText(auraEvidenceCoverageLowRatio)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                      SENTENCE_CITATION_MISSING 비율
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {toPercentText(auraSentenceCitationMissingRatio)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                      POLICY_REEVAL_APPLIED 비율
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {toPercentText(auraPolicyReevalAppliedRatio)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Search Section */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Iconify icon="solar:magnifer-linear" width={20} sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('rag.searchRag')}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              {t('rag.searchHint')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <TextField
                size="small"
                placeholder={t('rag.searchDocuments')}
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                }}
              />
              <Button variant="contained" onClick={handleSearch} disabled={!searchQ.trim()}>
                {t('rag.search')}
              </Button>
            </Stack>
            {searchSubmitted && (
              <Box sx={{ mt: 2 }}>
                {searchLoading ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('rag.searching')}
                  </Typography>
                ) : searchGroupedByDoc.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('rag.noResults', { query: searchSubmitted })}
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {searchGroupedByDoc.map(({ docId, docTitle, chunks }) => (
                      <Box
                        key={docId}
                        sx={{
                          p: 2,
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1.5,
                          bgcolor: 'action.hover',
                        }}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          sx={{ mb: 1.5 }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {docTitle}
                          </Typography>
                          <Button
                            size="small"
                            endIcon={<Iconify icon="solar:arrow-right-up-linear" width={14} />}
                            onClick={() => navigate(`${SYNAPSE_ROUTES.RAG}/${docId}`)}
                          >
                            {t('rag.open')}
                          </Button>
                        </Stack>
                        <Stack spacing={1}>
                          {chunks.slice(0, 3).map((c) => (
                            <Box
                              key={c.chunkId}
                              sx={{
                                p: 1.5,
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                                bgcolor: 'background.paper',
                              }}
                            >
                              <Typography variant="caption" color="text.secondary">
                                {t('rag.chunk')} {c.pageNo != null ? `· ${t('rag.page')} ${c.pageNo}` : ''} · {t('rag.score')}: {c.score?.toFixed(2) ?? '-'}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {c.chunkText.length > 200 ? `${c.chunkText.slice(0, 200)}…` : c.chunkText}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Iconify icon="solar:document-text-bold" width={18} sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('rag.documentLibrary')}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              {t('rag.libraryHint')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <Select
                size="small"
                value={statusFilter}
                onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="all">{t('rag.allStatus')}</MenuItem>
                <MenuItem value="indexed">{t('rag.status.indexed')}</MenuItem>
                <MenuItem value="indexing">{t('rag.status.indexing')}</MenuItem>
                <MenuItem value="error">{t('rag.status.error')}</MenuItem>
              </Select>
            </Stack>
            <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                    <TableRow>
                      <TableCell>{t('rag.table.document')}</TableCell>
                      <TableCell>{t('rag.table.source')}</TableCell>
                      <TableCell>{t('rag.table.status')}</TableCell>
                      <TableCell>{t('rag.table.quality')}</TableCell>
                      <TableCell sx={{ width: 100 }} align="center">
                        {t('rag.table.referenceCount')}
                      </TableCell>
                    <TableCell align="right">{t('rag.table.created')}</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {docsLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('rag.loading')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                        <Stack alignItems="center" spacing={1}>
                          <Iconify icon="solar:document-text-bold" width={48} sx={{ color: 'text.disabled' }} />
                          <Typography variant="body2" color="text.secondary">
                            {t('rag.empty')}
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Iconify icon="solar:upload-bold" width={18} />}
                            onClick={() => setRegisterOpen(true)}
                          >
                            {t('rag.registerFirst')}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((d, idx) => {
                      const meta = statusMeta[d.status] ?? statusMeta.default;
                      const referenceCount = getMockReferenceCount(d.docId, idx);
                      const report = normalizeQualityReport(d.quality_report ?? d.qualityReport);
                      const qualityLabel = report ? (report.pass ? t('rag.quality.pass') : t('rag.quality.fail')) : t('rag.table.noQualityReport');
                      return (
                        <TableRow
                          key={d.docId}
                          hover
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                          onClick={() => navigate(`${SYNAPSE_ROUTES.RAG}/${d.docId}`)}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {d.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {d.docId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={d.sourceType} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                          </TableCell>
                          <TableCell>
                            <Label
                              color={meta.color}
                              startIcon={<Iconify icon={meta.icon} width={14} />}
                              sx={{ fontSize: '0.75rem' }}
                            >
                              {t(`rag.status.${d.status === 'indexed' || d.status === 'indexing' || d.status === 'error' ? d.status : 'default'}`)}
                            </Label>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                              <Chip
                                size="small"
                                color={report ? (report.pass ? 'success' : 'error') : 'default'}
                                label={qualityLabel}
                                variant={report ? 'filled' : 'outlined'}
                                sx={{ fontSize: '0.7rem' }}
                              />
                              {report && (
                                <>
                                  <Chip
                                    size="small"
                                    label={`${t('rag.quality.articleCoverage')}: ${formatQualityPercent(report.articleCoverage)}`}
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                  <Chip
                                    size="small"
                                    label={`${t('rag.quality.noiseRate')}: ${formatQualityPercent(report.noiseRate)}`}
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                  <Chip
                                    size="small"
                                    label={`${t('rag.quality.duplicateRate')}: ${formatQualityPercent(report.duplicateRate)}`}
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                </>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={t('rag.referenceCountBadge', { count: referenceCount })}
                              sx={{
                                fontSize: '0.7rem',
                                bgcolor: 'primary.lighter',
                                color: 'primary.darker',
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="caption">
                              {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="small"
                              endIcon={<Iconify icon="solar:arrow-right-up-linear" width={14} />}
                              onClick={() => navigate(`${SYNAPSE_ROUTES.RAG}/${d.docId}`)}
                            >
                              {t('rag.open')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={registerOpen} onClose={() => setRegisterOpen(false)} maxWidth="sm" fullWidth>
        <RegisterRagDocumentModal
          onClose={() => setRegisterOpen(false)}
          onSubmit={handleRegisterSubmit}
          isLoading={registerMutation.isPending}
          docTypes={docTypes}
        />
      </Dialog>
    </Box>
  );
};
