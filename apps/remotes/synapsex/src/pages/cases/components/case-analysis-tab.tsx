/**
 * Case Analysis Tab — API 바인딩
 * @see docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt
 */

import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useCaseAnalysisQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme } from '@mui/material/styles';

import { TabEmptyState } from '../../../components/ux/tab-empty-state';
import { TabErrorState } from '../../../components/ux/tab-error-state';
import { ConfidenceRing } from '../../../components/finance/confidence-meter';
import { TabContentSkeleton } from '../../../components/ux/tab-content-skeleton';

type CaseAnalysisTabProps = {
  caseId: string | undefined;
  enabled: boolean;
  fallbackConfidence?: number;
  fallbackTitle?: string;
  fallbackAnomalyType?: string;
  fallbackSeverity?: string;
};

export const CaseAnalysisTab = ({
  caseId,
  enabled,
  fallbackConfidence = 0,
  fallbackTitle = '',
  fallbackAnomalyType = '',
  fallbackSeverity = '',
}: CaseAnalysisTabProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const { data, isLoading, isError, error, refetch } = useCaseAnalysisQuery(caseId, { enabled });

  if (isLoading) {
    return <TabContentSkeleton cards={2} />;
  }

  if (isError) {
    return (
      <Box sx={{ p: 2 }}>
        <TabErrorState
          title={t('cases.tabs.analysis.error.title')}
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
        />
      </Box>
    );
  }

  const score = data?.score ?? fallbackConfidence;
  const reasonText = data?.reasonText ?? fallbackTitle;
  const anomalyType = data?.anomalyType ?? fallbackAnomalyType;
  const severity = data?.severity ?? fallbackSeverity;
  const keyFactors = data?.keyFactors ?? [];

  if (!data && !reasonText && keyFactors.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <TabEmptyState
          icon="solar:brain-bold-duotone"
          title={t('cases.tabs.analysis.empty.title')}
          description={t('cases.tabs.analysis.empty.description')}
        />
      </Box>
    );
  }

  return (
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
                  {typeof score === 'number' ? score : Number(score) || 0}%
                </Typography>
              </Box>
              <ConfidenceRing value={typeof score === 'number' ? score : Number(score) || 0} size={80} />
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
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};
