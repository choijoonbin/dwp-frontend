/**
 * Case Analysis Tab — API 바인딩
 * @see docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt
 * @see docs/job/PROMPT_FE_CASE_TABS_DEBUG_UX_P11.txt — Debug payload
 */

import { useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { getErrorMessage, useCaseAnalysisQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme } from '@mui/material/styles';

import { useCaseTabsDebug } from '../context/case-tabs-debug-context';
import { CaseTabQueryBoundary, TabEmptyState } from '../../../components/ux';
import { ConfidenceRing } from '../../../components/finance/confidence-meter';

type CaseAnalysisTabProps = {
  caseId: string | undefined;
  runId?: string | null;
  enabled: boolean;
  tabKey?: string;
  fallbackConfidence?: number;
  fallbackTitle?: string;
  fallbackAnomalyType?: string;
  fallbackSeverity?: string;
};

export const CaseAnalysisTab = ({
  caseId,
  runId,
  enabled,
  tabKey = 'analysis',
  fallbackConfidence = 0,
  fallbackTitle = '',
  fallbackAnomalyType = '',
  fallbackSeverity = '',
}: CaseAnalysisTabProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const debugCtx = useCaseTabsDebug();
  const { data, isLoading, isError, error, refetch } = useCaseAnalysisQuery(caseId, { enabled, runId });

  const setPayload = debugCtx?.setPayload;
  useEffect(() => {
    if (!enabled || !setPayload) return;
    if (isError && error) {
      setPayload(tabKey, {
        status: 'error',
        payload: { message: getErrorMessage(error) ?? String(error) },
        error: getErrorMessage(error) ?? String(error),
      });
    } else if (!isLoading && data !== undefined) {
      setPayload(tabKey, { status: 'success', payload: data });
    }
  }, [enabled, setPayload, isLoading, isError, error, data, tabKey]);

  const scoreRaw =
    data?.score ??
    (data?.confidenceBreakdown?.overall != null ? Number(data.confidenceBreakdown.overall) * 100 : undefined) ??
    fallbackConfidence;
  const score = typeof scoreRaw === 'number' ? scoreRaw : Number(scoreRaw) || 0;
  /** 대표 Score 표기: % 통일, 소수 2자리 고정 */
  const scoreDisplay = `${Number(score.toFixed(2))}%`;
  const reasonText = data?.reasonText ?? fallbackTitle;
  const anomalyType = data?.anomalyType ?? fallbackAnomalyType;
  const severity = data?.severity ?? fallbackSeverity;
  const keyFactors = data?.keyFactors ?? [];
  const evidence = (data?.evidence ?? []) as Array<{ key?: string }>;
  const ragRefs = (data?.ragRefs ?? []) as Array<{ refId?: string; sourceType?: string; sourceKey?: string; excerpt?: string; score?: number }>;
  const isEmpty =
    !data || (!reasonText && keyFactors.length === 0 && evidence.length === 0 && ragRefs.length === 0);

  return (
    <CaseTabQueryBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      errorTitle={t('cases.tabs.analysis.error.title')}
      skeletonCards={2}
      empty={isEmpty}
      emptyContent={
        <Box sx={{ p: 2 }}>
          <TabEmptyState
            icon="solar:brain-bold-duotone"
            title={t('cases.tabs.analysis.empty.title')}
            description={t('cases.tabs.analysis.empty.description')}
            reason={t('cases.tabs.analysis.empty.reason.summaryRecommendationsZero')}
          />
        </Box>
      }
    >
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Card
          sx={{
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            border: 1,
            borderColor: alpha(theme.palette.primary.main, 0.2),
          }}
        >
          <CardContent sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {t('caseDetail.anomalyConfidenceScore')}
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {scoreDisplay}
                </Typography>
              </Box>
              <ConfidenceRing value={score} size={80} showScore={false} />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap">
              {anomalyType && (
                <Chip
                  label={String(anomalyType).replace(/_/g, ' ')}
                  size="small"
                  variant="outlined"
                  sx={{ textTransform: 'capitalize' }}
                />
              )}
              {severity && (
                <Chip
                  label={t('caseDetail.severityLabel', { severity })}
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
          <CardHeader
            title={
              <Stack direction="row" spacing={1} alignItems="center">
                <Iconify icon="solar:brain-bold-duotone" width={18} />
                <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                  {t('caseDetail.aiReasoning')}
                </Typography>
              </Stack>
            }
            sx={{ pb: 1, px: 2, pt: 2 }}
          />
          <CardContent sx={{ px: 2, pt: 0, pb: 2 }}>
            {reasonText && (
              <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.75 }}>
                {reasonText}
              </Typography>
            )}
            {keyFactors.length > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 500, color: 'text.secondary', mb: 1, display: 'block' }}
                >
                  {t('caseDetail.keyFactors')}
                </Typography>
                <Stack spacing={1}>
                  {keyFactors.map((f, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <Iconify
                        icon={
                          f.type === 'warning'
                            ? 'solar:danger-triangle-bold-duotone'
                            : 'solar:check-circle-bold-duotone'
                        }
                        width={16}
                        sx={{
                          color: f.type === 'warning' ? 'warning.main' : 'primary.main',
                          mt: 0.25,
                        }}
                      />
                      <Typography variant="caption">
                        {f.description ?? f.label ?? ''}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </>
            )}
            {evidence.length > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 500, color: 'text.secondary', mb: 1, display: 'block' }}
                >
                  {t('caseDetail.evidence')}
                </Typography>
                <Stack spacing={1}>
                  {evidence.map((e, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <Iconify
                        icon="solar:document-text-bold-duotone"
                        width={16}
                        sx={{ color: 'primary.main', mt: 0.25 }}
                      />
                      <Typography variant="caption">{e.key ?? ''}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </>
            )}
            {ragRefs.length > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 500, color: 'text.secondary', mb: 1, display: 'block' }}
                >
                  {t('caseDetail.ragRefs')}
                </Typography>
                <Stack spacing={1.5}>
                  {ragRefs.map((r, i) => (
                    <Box
                      key={r.refId ?? i}
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                        border: 1,
                        borderColor: alpha(theme.palette.primary.main, 0.12),
                      }}
                    >
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 0.5 }}>
                        {r.sourceType != null && r.sourceType !== '' && (
                          <Chip label={String(r.sourceType)} size="small" variant="outlined" />
                        )}
                        {r.sourceKey != null && r.sourceKey !== '' && (
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', alignSelf: 'center' }}>
                            {r.sourceKey}
                          </Typography>
                        )}
                        {typeof r.score === 'number' && (
                          <Typography variant="caption" color="text.secondary">
                            {t('caseDetail.scoreShort', { value: Number((r.score as number).toFixed(2)) })}
                          </Typography>
                        )}
                      </Stack>
                      {r.excerpt != null && r.excerpt !== '' && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5 }}>
                          {r.excerpt}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </>
            )}
          </CardContent>
        </Card>
                </Stack>
    </Box>
    </CaseTabQueryBoundary>
  );
};
