import { useTranslation } from 'react-i18next';
import { Activity, CircleHelp } from 'lucide-react';
import { ActionButton, foundationTokens } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import type { DwaionUserRun } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function DwaionActivityLatency({
  runs,
  selectedRunId,
  onSelect,
}: {
  runs: readonly DwaionUserRun[];
  selectedRunId: string;
  onSelect: (runId: string) => void;
}) {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const korean = locale === 'ko';
  // In-flight, partial, unclassified and design sample measurements must never
  // imply a successful operational latency measurement.
  const measured = runs
    .filter((run) => run.dataProvenance === 'LIVE' && run.measurementStatus === 'MEASURED')
    .filter((run) => run.runState !== 'RUNNING' && Boolean(run.completedAt))
    .filter((run) => Number.isFinite(run.latencyMs) && run.latencyMs >= 0)
    .slice()
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 6)
    .reverse();
  const maxLatency = Math.max(1, ...measured.map((run) => run.latencyMs));

  return (
    <Box
      component="section"
      aria-label={korean ? '실행 응답 시간' : 'Run response time'}
      sx={{
        mt: 2,
        p: { xs: 1.5, md: 2 },
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface + 'px',
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Activity size={17} aria-hidden="true" />
        <Typography component="h2" variant="subtitle2">
          {korean ? '실행 응답 시간' : 'Run response time'}
        </Typography>
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 0.5, mb: 1 }}
      >
        {korean
          ? '현재까지 불러온 실행 중 서버 실측이 확인된 최신 6건 · 행을 선택하면 실행 근거를 엽니다.'
          : 'Latest 6 server-measured runs loaded so far. Select a row to inspect its evidence.'}
      </Typography>
      {measured.length ? (
        <Stack component="ul" spacing={0.5} sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {measured.map((run) => (
            <Box component="li" key={run.runId}>
              <ActionButton
                intent="quiet"
                onClick={() => onSelect(run.runId)}
                aria-pressed={selectedRunId === run.runId}
                aria-label={`${formatDate(run.createdAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }, locale)} · ${run.agentKey} · ${t('dwaionActivity.details.latencyValue', { count: run.latencyMs })}`}
                sx={{
                  width: 1,
                  display: 'grid',
                  gridTemplateColumns: '72px minmax(0, 1fr) 64px',
                  gap: 1,
                  px: 1,
                  minHeight: 44,
                  border: 1,
                  borderColor: selectedRunId === run.runId ? 'primary.main' : 'transparent',
                }}
              >
                <Typography component="span" variant="caption" color="text.secondary">
                  {formatDate(run.createdAt, { hour: '2-digit', minute: '2-digit' }, locale)}
                </Typography>
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{
                    height: 18,
                    bgcolor: 'action.hover',
                    width: 1,
                    borderRadius: foundationTokens.radius.compact + 'px',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: 'block',
                      height: 1,
                      width: `${(run.latencyMs / maxLatency) * 100}%`,
                      bgcolor: 'primary.main',
                    }}
                  />
                </Box>
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}
                >
                  {t('dwaionActivity.details.latencyValue', { count: run.latencyMs })}
                </Typography>
              </ActionButton>
            </Box>
          ))}
        </Stack>
      ) : (
        <Stack
          direction="row"
          gap={1}
          alignItems="flex-start"
          sx={{
            p: 1.5,
            bgcolor: 'action.hover',
            borderRadius: foundationTokens.radius.control + 'px',
          }}
        >
          <CircleHelp size={17} aria-hidden="true" />
          <Typography variant="body2" color="text.secondary">
            {korean
              ? '실측 데이터 미연결 — 현재 조회 범위에 운영 실측으로 확인된 응답 시간은 없습니다. 샘플·부분 측정·진행 중 데이터는 그래프에 포함하지 않습니다.'
              : 'Measurements unavailable — no operational response times are verified in this view. Samples, partial measurements and in-flight runs are excluded.'}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
