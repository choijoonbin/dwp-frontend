import { useTranslation } from 'react-i18next';
import { Download, FlaskConical, History } from 'lucide-react';
import { ActionButton, GuidedEmptyState } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import type { DwaionEvaluationRun, DwaionEvaluationRunSummary } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { evaluationRuleSample } from './dwaion-evaluation-results';

type Props = {
  runs: DwaionEvaluationRunSummary[];
  selectedRunId: string | null;
  run?: DwaionEvaluationRun;
  loading: boolean;
  canExport: boolean;
  exporting: boolean;
  onSelect: (runId: string) => void;
  onExport: () => void;
};

export function DwaionEvaluationHistory({
  runs,
  selectedRunId,
  run,
  loading,
  canExport,
  exporting,
  onSelect,
  onExport,
}: Props) {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);

  return (
    <Box component="section" aria-labelledby="dwaion-evaluation-history-title">
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Box>
          <Stack direction="row" spacing={0.8} alignItems="center">
            <History size={18} color="var(--dwp-product-accent)" />
            <Typography
              id="dwaion-evaluation-history-title"
              component="h3"
              variant="subtitle1"
              fontWeight={850}
            >
              {t('dwaionAdmin.evaluation.history.title')}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t('dwaionAdmin.evaluation.history.description')}
          </Typography>
        </Box>
        {canExport && run && (
          <ActionButton
            intent="secondary"
            size="small"
            startIcon={<Download size={15} />}
            loading={exporting}
            onClick={onExport}
          >
            {t('dwaionAdmin.evaluation.history.export')}
          </ActionButton>
        )}
      </Stack>

      {!runs.length && !loading ? (
        <GuidedEmptyState
          kind="empty"
          title={t('dwaionAdmin.evaluation.history.emptyTitle')}
          description={t('dwaionAdmin.evaluation.history.emptyDescription')}
        />
      ) : (
        <Box
          sx={{
            mt: 1.5,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(9rem, .7fr) minmax(0, 1.3fr)',
            },
            borderBlock: 1,
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              borderInlineEnd: { lg: 1 },
              borderColor: 'divider',
              maxHeight: 360,
              overflowY: 'auto',
            }}
          >
            {loading
              ? Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} height={70} sx={{ mx: 1 }} />
                ))
              : runs.map((item, index) => (
                  <Box key={item.evaluationRunId}>
                    {index > 0 && <Divider />}
                    <ButtonBase
                      aria-pressed={selectedRunId === item.evaluationRunId}
                      onClick={() => onSelect(item.evaluationRunId)}
                      sx={{
                        width: '100%',
                        minHeight: 68,
                        px: 1.5,
                        py: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        gap: 1,
                        flexWrap: 'wrap',
                        '&:focus-visible': {
                          outline: '2px solid',
                          outlineColor: 'primary.main',
                          outlineOffset: -2,
                        },
                        bgcolor:
                          selectedRunId === item.evaluationRunId
                            ? 'action.selected'
                            : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          fontWeight={800}
                          sx={{ overflowWrap: 'anywhere' }}
                        >
                          {formatDate(
                            item.createdAt,
                            { dateStyle: 'medium', timeStyle: 'short' },
                            locale
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.modelRef || t('dwaionAdmin.evaluation.history.noModel')}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={
                          item.runState === 'COMPLETED'
                            ? 'success'
                            : item.runState === 'FAILED'
                              ? 'error'
                              : 'warning'
                        }
                        sx={{ bgcolor: 'background.paper' }}
                        label={evaluationRuleSample(item) ?? item.runState}
                      />
                    </ButtonBase>
                  </Box>
                ))}
          </Box>
          <Box sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
            {run ? <EvaluationRunResult run={run} /> : <Skeleton variant="rounded" height={220} />}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function EvaluationRunResult({ run }: { run: DwaionEvaluationRun }) {
  const { t } = useTranslation('work');
  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <FlaskConical size={18} color="var(--dwp-product-accent)" />
          <Typography component="h4" variant="subtitle1" fontWeight={850}>
            {t('dwaionAdmin.evaluation.runResult')}
          </Typography>
          <Chip size="small" variant="outlined" label={run.runState} />
        </Stack>
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
        <Chip
          color="success"
          variant="outlined"
          label={t('dwaionAdmin.evaluation.passed', { count: run.passedCount })}
        />
        <Chip
          color="error"
          variant="outlined"
          label={t('dwaionAdmin.evaluation.failed', { count: run.failedCount })}
        />
        <Chip
          color="warning"
          variant="outlined"
          label={t('dwaionAdmin.evaluation.configuration', {
            count: run.configurationRequiredCount,
          })}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
        {t('dwaionAdmin.evaluation.ruleSample', { passed: run.passedCount, total: run.caseCount })}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {t('dwaionAdmin.evaluation.comparisonUnavailable')}
      </Typography>
      <Box sx={{ mt: 1.5, borderBlock: 1, borderColor: 'divider' }}>
        {run.results.map((result, index) => {
          return (
            <Box key={result.evaluationCaseId}>
              {index > 0 && <Divider />}
              <Stack
                direction="row"
                justifyContent="space-between"
                gap={2}
                flexWrap="wrap"
                sx={{ py: 1.2 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={750} sx={{ overflowWrap: 'anywhere' }}>
                    {result.caseName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('dwaionAdmin.evaluation.ruleObserved', {
                      matched: result.expectedTermsMatched,
                      total: result.expectedTermsTotal,
                      grounded: t(
                        result.grounded
                          ? 'dwaionAdmin.evaluation.groundedYes'
                          : 'dwaionAdmin.evaluation.groundedNo'
                      ),
                    })}
                    {' · '}
                    {result.statusCode} ·{' '}
                    {t('dwaionAdmin.evaluation.latency', { count: result.latencyMs })}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color={
                    result.outcome === 'PASS'
                      ? 'success'
                      : result.outcome === 'FAIL'
                        ? 'error'
                        : 'warning'
                  }
                  label={t(`dwaionAdmin.evaluation.outcomes.${result.outcome}`)}
                />
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
