import type { RagQualityReport } from '@dwp-frontend/shared-utils';

import { useMemo, useState } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

type QualityMetricRow = {
  key:
    | 'article_coverage'
    | 'noise_rate'
    | 'duplicate_rate'
    | 'short_chunk_rate'
    | 'chunk_summary';
  label: string;
  value: string;
};

type KnownQualityErrorCode =
  | 'MISSING_REQUIRED_METADATA'
  | 'ARTICLE_COVERAGE_LOW'
  | 'NOISE_RATE_HIGH'
  | 'DUPLICATE_RATE_HIGH'
  | 'SHORT_CHUNK_RATE_HIGH'
  | 'NO_VALID_CHUNKS_AFTER_QUALITY_GATE';

export type QualityReportView = {
  pass: boolean;
  runId: string | null;
  articleCoverage: number | null;
  noiseRate: number | null;
  duplicateRate: number | null;
  shortChunkRate: number | null;
  inputChunks: number | null;
  finalChunks: number | null;
  errors: string[];
  missingRequired: string[];
  raw: unknown;
};

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function formatQualityPercent(value: number | null): string {
  if (value == null) return '-';
  const normalized = value <= 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
}

function parseCode(raw: string): string {
  return raw.trim().toUpperCase().split('(')[0].trim();
}

const ERROR_PRIORITY: Record<KnownQualityErrorCode, number> = {
  MISSING_REQUIRED_METADATA: 1,
  NO_VALID_CHUNKS_AFTER_QUALITY_GATE: 2,
  ARTICLE_COVERAGE_LOW: 3,
  NOISE_RATE_HIGH: 4,
  DUPLICATE_RATE_HIGH: 5,
  SHORT_CHUNK_RATE_HIGH: 6,
};

type QualityErrorMessage = {
  code: string;
  title: string;
  description: string;
  actions: string[];
};

function toErrorMessage(
  code: string,
  t: (key: string, options?: Record<string, unknown>) => string
): QualityErrorMessage {
  const byCode = (name: KnownQualityErrorCode): QualityErrorMessage => ({
    code: name,
    title: t(`rag.quality.errorMap.${name}.title`),
    description: t(`rag.quality.errorMap.${name}.description`),
    actions: [
      t(`rag.quality.errorMap.${name}.actions.0`),
      t(`rag.quality.errorMap.${name}.actions.1`),
      t(`rag.quality.errorMap.${name}.actions.2`),
    ],
  });

  switch (code) {
    case 'MISSING_REQUIRED_METADATA':
      return byCode('MISSING_REQUIRED_METADATA');
    case 'ARTICLE_COVERAGE_LOW':
      return byCode('ARTICLE_COVERAGE_LOW');
    case 'NOISE_RATE_HIGH':
      return byCode('NOISE_RATE_HIGH');
    case 'DUPLICATE_RATE_HIGH':
      return byCode('DUPLICATE_RATE_HIGH');
    case 'SHORT_CHUNK_RATE_HIGH':
      return byCode('SHORT_CHUNK_RATE_HIGH');
    case 'NO_VALID_CHUNKS_AFTER_QUALITY_GATE':
      return byCode('NO_VALID_CHUNKS_AFTER_QUALITY_GATE');
    default:
      return {
        code,
        title: t('rag.quality.errorMap.UNKNOWN.title'),
        description: t('rag.quality.errorMap.UNKNOWN.description'),
        actions: [
          t('rag.quality.errorMap.UNKNOWN.actions.0'),
          t('rag.quality.errorMap.UNKNOWN.actions.1'),
          t('rag.quality.errorMap.UNKNOWN.actions.2'),
        ],
      };
  }
}

export function normalizeQualityReport(report: RagQualityReport | null | undefined): QualityReportView | null {
  if (!report || typeof report !== 'object') return null;
  const errors = Array.isArray(report.errors) ? report.errors.map(String) : [];
  const missingRequired = Array.isArray(report.missing_required ?? report.missingRequired)
    ? (report.missing_required ?? report.missingRequired ?? []).map(String)
    : [];

  return {
    pass: typeof report.pass === 'boolean' ? report.pass : errors.length === 0,
    runId: typeof (report.run_id ?? report.runId) === 'string' ? String(report.run_id ?? report.runId) : null,
    articleCoverage: toNumber(report.article_coverage ?? report.articleCoverage),
    noiseRate: toNumber(report.noise_rate ?? report.noiseRate),
    duplicateRate: toNumber(report.duplicate_rate ?? report.duplicateRate),
    shortChunkRate: toNumber(report.short_chunk_rate ?? report.shortChunkRate),
    inputChunks: toNumber(report.input_chunks ?? report.inputChunks),
    finalChunks: toNumber(report.final_chunks ?? report.finalChunks),
    errors,
    missingRequired,
    raw: report,
  };
}

export function extractQualityReport(payload: unknown): QualityReportView | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const direct = normalizeQualityReport((obj.quality_report ?? obj.qualityReport) as RagQualityReport | undefined);
  if (direct) return direct;
  if (obj.data && typeof obj.data === 'object') {
    const dataObj = obj.data as Record<string, unknown>;
    const nested = normalizeQualityReport((dataObj.quality_report ?? dataObj.qualityReport) as RagQualityReport | undefined);
    if (nested) return nested;
  }
  return null;
}

export function RagQualityReportCard({
  report,
  title,
  enableDebug = false,
}: {
  report: QualityReportView;
  title?: string;
  enableDebug?: boolean;
}) {
  const { t } = useTranslation('common');
  const [debugOpen, setDebugOpen] = useState(false);
  const metrics: QualityMetricRow[] = [
    { key: 'article_coverage', label: t('rag.quality.articleCoverage'), value: formatQualityPercent(report.articleCoverage) },
    { key: 'noise_rate', label: t('rag.quality.noiseRate'), value: formatQualityPercent(report.noiseRate) },
    { key: 'duplicate_rate', label: t('rag.quality.duplicateRate'), value: formatQualityPercent(report.duplicateRate) },
    { key: 'short_chunk_rate', label: t('rag.quality.shortChunkRate'), value: formatQualityPercent(report.shortChunkRate) },
    {
      key: 'chunk_summary',
      label: t('rag.quality.chunkSummary'),
      value:
        report.finalChunks != null || report.inputChunks != null
          ? `${report.finalChunks ?? '-'} / ${report.inputChunks ?? '-'}`
          : '-',
    },
  ];

  const sortedErrors = useMemo(
    () =>
      [...report.errors].sort((a, b) => {
        const aCode = parseCode(a) as KnownQualityErrorCode;
        const bCode = parseCode(b) as KnownQualityErrorCode;
        const aP = ERROR_PRIORITY[aCode] ?? 999;
        const bP = ERROR_PRIORITY[bCode] ?? 999;
        if (aP !== bP) return aP - bP;
        return a.localeCompare(b);
      }),
    [report.errors]
  );
  const mappedErrors = useMemo(
    () => sortedErrors.map((raw) => toErrorMessage(parseCode(raw), t)),
    [sortedErrors, t]
  );
  const hasFailureDetails = !report.pass || report.errors.length > 0 || report.missingRequired.length > 0;

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2.25 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:verified-check-bold-duotone" width={18} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {title ?? t('rag.quality.title')}
              </Typography>
            </Stack>
            <Label color={report.pass ? 'success' : 'error'} variant="soft" sx={{ fontSize: '0.72rem' }}>
              {report.pass ? t('rag.quality.pass') : t('rag.quality.fail')}
            </Label>
          </Stack>

          <Alert severity={report.pass ? 'success' : 'error'}>
            {report.pass ? t('rag.quality.bannerPass') : t('rag.quality.bannerFail')}
          </Alert>

          <Divider />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            {metrics.map((m) => (
              <Box key={m.key} sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {m.label}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 700 }}>
                  {m.value}
                </Typography>
              </Box>
            ))}
          </Box>

          {report.runId && (
            <Typography variant="caption" color="text.secondary">
              run_id: {report.runId}
            </Typography>
          )}

          {hasFailureDetails && (
            <Alert severity="warning">
              <Stack spacing={1}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  {t('rag.quality.failReasons')}
                </Typography>
                {report.missingRequired.length > 0 && (
                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                    {report.missingRequired.map((reason, idx) => (
                      <Chip key={`m-${idx}`} size="small" color="warning" variant="outlined" label={reason} />
                    ))}
                  </Stack>
                )}
                {mappedErrors.map((item, idx) => (
                  <Box key={`${item.code}-${idx}`} sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                      {item.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {item.actions.join(' · ')}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Alert>
          )}

          {enableDebug && (
            <Box>
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 0.75 }}>
                <Chip
                  size="small"
                  variant={debugOpen ? 'filled' : 'outlined'}
                  color="default"
                  label={debugOpen ? t('rag.quality.debug.hide') : t('rag.quality.debug.show')}
                  onClick={() => setDebugOpen((prev) => !prev)}
                  sx={{ cursor: 'pointer' }}
                />
              </Stack>
              {debugOpen && (
                <Box
                  sx={{
                    p: 1.25,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.neutral',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    {t('rag.quality.debug.errorCodes')}
                  </Typography>
                  <Typography
                    variant="caption"
                    component="pre"
                    sx={{ mt: 0.5, mb: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}
                  >
                    {JSON.stringify(report.errors, null, 2)}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    {t('rag.quality.debug.rawReport')}
                  </Typography>
                  <Typography
                    variant="caption"
                    component="pre"
                    sx={{ mt: 0.5, mb: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}
                  >
                    {JSON.stringify(report.raw, null, 2)}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
