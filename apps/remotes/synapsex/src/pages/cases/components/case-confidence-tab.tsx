/**
 * Case Confidence Tab — API 바인딩
 * @see docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt
 * @see docs/job/PROMPT_FE_CASE_TABS_DEBUG_UX_P11.txt — Debug payload
 */

import { useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { getErrorMessage, useCaseConfidenceQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { useCaseTabsDebug } from '../context/case-tabs-debug-context';
import { CaseTabQueryBoundary, TabEmptyState } from '../../../components/ux';

const ICON_MAP: Record<string, string> = {
  amount: 'solar:dollar-minimalistic-bold-duotone',
  history: 'solar:history-bold-duotone',
  policy: 'solar:shield-check-bold-duotone',
  timing: 'solar:clock-circle-bold-duotone',
  pattern: 'solar:graph-up-bold-duotone',
};

type CaseConfidenceTabProps = {
  caseId: string | undefined;
  enabled: boolean;
  tabKey?: string;
};

export const CaseConfidenceTab = ({ caseId, enabled, tabKey = 'confidence' }: CaseConfidenceTabProps) => {
  const { t } = useTranslation('common');
  const debugCtx = useCaseTabsDebug();
  const { data, isLoading, isError, error, refetch } = useCaseConfidenceQuery(caseId, { enabled });

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

  const factors = data?.factors ?? [];
  const overallScore = data?.overallScore ?? data?.score;
  const isEmpty = factors.length === 0 || overallScore == null;

  return (
    <CaseTabQueryBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      errorTitle={t('cases.tabs.confidence.error.title')}
      skeletonCards={4}
      empty={isEmpty}
      emptyContent={
        <Box sx={{ p: 2 }}>
          <TabEmptyState
            icon="solar:graph-up-bold-duotone"
            title={t('cases.tabs.confidence.empty.title')}
            description={t('cases.tabs.confidence.empty.description')}
            reason={t('cases.tabs.confidence.empty.reason.factorsZeroOrScoreNull')}
          />
        </Box>
      }
    >
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t('caseDetail.confidenceBreakdown')}
        </Typography>
        {factors.map((factor, i) => {
          const score = factor.score ?? 0;
          const weight = factor.weight ?? 0;
          const iconName = factor.icon ?? 'pattern';
          const icon = ICON_MAP[iconName] ?? 'solar:info-circle-bold-duotone';
          const label = factor.label ?? factor.i18nKey ?? '';

          return (
            <Card key={factor.id ?? i}>
              <CardContent sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Iconify icon={icon} width={20} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                        {label}
                      </Typography>
                    </Stack>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {score}%
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      position: 'relative',
                      height: 8,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        width: `${Math.min(100, score)}%`,
                        bgcolor:
                          score >= 90 ? 'success.main' : score >= 70 ? 'warning.main' : 'error.main',
                      }}
                    />
                  </Box>
                  {factor.description && (
                    <Typography variant="caption" color="text.secondary">
                      {t('caseDetail.weight')}: {weight}% • {factor.description}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
    </CaseTabQueryBoundary>
  );
};
