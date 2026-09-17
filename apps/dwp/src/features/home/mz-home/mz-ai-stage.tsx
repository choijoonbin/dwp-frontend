import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Bot, CalendarClock, CheckCircle2, Files, ListChecks } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import type { HomeAppDefinition } from '../../../components/workspace-composer/app-launchpad-model';

type MzStarterEvidence = Readonly<{
  id: string;
  title: string;
  source: string;
  bucket: 'action' | 'timeline' | 'response' | 'request' | 'pulse';
  appKey: string;
}>;

type MzAiStageProps = Readonly<{
  currentDate: string;
  headline: string;
  subheadline: string;
  actionCount: number;
  timelineCount: number;
  responseCount: number;
  appCount: number;
  contextLoading: boolean;
  contextFetching: boolean;
  contextPartial: boolean;
  busy: boolean;
  aiAvailable: boolean;
  starterEvidence: readonly MzStarterEvidence[];
  relatedApps: readonly HomeAppDefinition[];
  onStart: (intent: string) => void;
}>;

/**
 * First-class MZ entry surface. It only assembles permission-scoped context and hands the
 * user's explicit intent to DWAI·ON. Planning, review, approval, and execution stay in the
 * governed owner product; Home never fabricates an AI result or command receipt.
 */
export function MzAiStage({
  currentDate,
  headline,
  subheadline,
  actionCount,
  timelineCount,
  responseCount,
  appCount,
  contextLoading,
  contextFetching,
  contextPartial,
  busy,
  aiAvailable,
  starterEvidence,
  relatedApps,
  onStart,
}: MzAiStageProps) {
  const { t } = useTranslation('home');
  const [intent, setIntent] = useState('');
  const [scene, setScene] = useState<'focus' | 'meeting' | 'team'>('focus');
  const normalizedIntent = intent.trim();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!normalizedIntent || busy || !aiAvailable) return;
    onStart(`${t(`mz.stage.scenes.${scene}`)}: ${normalizedIntent}`);
  };

  const context = [
    { key: 'action', icon: ListChecks, value: actionCount },
    { key: 'timeline', icon: CalendarClock, value: timelineCount },
    { key: 'response', icon: CheckCircle2, value: responseCount },
    { key: 'apps', icon: Files, value: appCount },
  ] as const;
  const sceneBuckets = {
    focus: ['action', 'request'],
    meeting: ['timeline', 'response'],
    team: ['response', 'pulse'],
  } as const;
  const sceneEvidence = useMemo(() => {
    const buckets: readonly MzStarterEvidence['bucket'][] = sceneBuckets[scene];
    return starterEvidence.filter((item) => buckets.includes(item.bucket));
  }, [scene, starterEvidence]);
  const hasGroundedStarters = sceneEvidence.length > 0;
  const groundedStarters = useMemo(
    () =>
      contextLoading
        ? []
        : hasGroundedStarters
          ? sceneEvidence.slice(0, 3)
          : (['brief', 'plan', 'followup'] as const).map((key) => ({
              id: key,
              title: t(`mz.stage.starters.${key}`),
              source: t('mz.stage.suggestedSource'),
              bucket: 'action' as const,
              appKey: '',
            })),
    [contextLoading, hasGroundedStarters, sceneEvidence, t]
  );
  const sceneAppKeys = new Set(sceneEvidence.map((item) => item.appKey));
  const sceneRelatedApps = relatedApps.filter((app) => sceneAppKeys.has(app.resourceKey));

  return (
    <Box
      component="section"
      data-testid="mz-ai-stage"
      data-mz-stage-contract="intent-grounding-review-handoff"
      data-mz-execution-boundary="dwaion-review-required"
      data-mz-context-state={
        contextLoading
          ? 'loading'
          : contextFetching
            ? 'refreshing'
            : contextPartial
              ? 'partial'
              : 'ready'
      }
      aria-busy={contextLoading || contextFetching ? 'true' : 'false'}
      aria-labelledby="mz-ai-stage-title"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 'var(--home-radius-section)',
        bgcolor: 'background.paper',
        boxShadow: '0 16px 38px rgba(15,23,42,0.08)',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: { xs: 2, sm: 3, lg: 4 },
          py: { xs: 2.5, sm: 3.5 },
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 1.35fr) minmax(280px, .65fr)',
          },
          gap: { xs: 2.5, lg: 4 },
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? theme.palette.background.paper : '#F8FAFF',
        }}
      >
        <Stack component="form" onSubmit={submit} gap={2.25} minWidth={0}>
          <Stack gap={0.75}>
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Chip
                size="small"
                color="primary"
                icon={<Bot size={15} aria-hidden="true" />}
                label={t('mz.stage.eyebrow')}
              />
              <Typography variant="caption" color="text.secondary">
                {currentDate}
              </Typography>
            </Stack>
            <Typography
              id="mz-ai-stage-title"
              component="h1"
              variant="h4"
              fontWeight={foundationTokens.home.typography.weightHeavy}
              sx={{ overflowWrap: 'anywhere' }}
            >
              {t('mz.stage.title')}
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 760, overflowWrap: 'anywhere' }}>
              {t('mz.stage.description')}
            </Typography>
          </Stack>

          <TextField
            value={intent}
            onChange={(event) => setIntent(event.target.value.slice(0, 1000))}
            label={t('mz.stage.intentLabel')}
            placeholder={t('mz.stage.intentPlaceholder')}
            multiline
            minRows={3}
            fullWidth
            inputProps={{ 'data-testid': 'mz-intent-input', maxLength: 1000 }}
            helperText={t('mz.stage.intentHelper')}
          />

          <Box>
            <Typography variant="caption" color="text.secondary">
              {t('mz.stage.scenes.title')}
            </Typography>
            <Stack direction="row" gap={0.75} mt={0.75} mb={1.5} flexWrap="wrap">
              {(['focus', 'meeting', 'team'] as const).map((key) => (
                <ActionButton
                  key={key}
                  type="button"
                  intent={scene === key ? 'primary' : 'quiet'}
                  size="small"
                  aria-pressed={scene === key}
                  onClick={() => setScene(key)}
                  data-mz-context-scene={key}
                >
                  {t(`mz.stage.scenes.${key}`)}
                </ActionButton>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {t(
                contextLoading
                  ? 'mz.stage.loadingEvidence'
                  : hasGroundedStarters
                    ? 'mz.stage.startersTitle'
                    : 'mz.stage.suggestedTitle'
              )}
            </Typography>
            <Stack direction="row" gap={0.75} mt={0.75} flexWrap="wrap">
              {groundedStarters.map((item) => (
                <ActionButton
                  key={item.id}
                  type="button"
                  intent="quiet"
                  size="small"
                  disabled={busy || !aiAvailable}
                  onClick={() => setIntent(item.title)}
                  data-mz-grounded-starter={item.id}
                  title={item.source}
                >
                  {item.title}
                </ActionButton>
              ))}
            </Stack>
          </Box>

          {sceneRelatedApps.length > 0 && (
            <Box data-mz-stage-related-apps>
              <Typography variant="caption" color="text.secondary">
                {t('mz.stage.relatedApps')}
              </Typography>
              <Stack direction="row" gap={0.75} mt={0.75} flexWrap="wrap">
                {sceneRelatedApps.slice(0, 4).map((app) => (
                  <Chip
                    key={app.id}
                    size="small"
                    variant="outlined"
                    label={app.shortName ?? app.name}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {!aiAvailable && (
            <Alert severity="warning" data-mz-stage-ai-unavailable>
              {t('mz.stage.aiUnavailable')}
            </Alert>
          )}
          {!contextLoading && (contextFetching || contextPartial) && (
            <Alert severity={contextPartial ? 'warning' : 'info'} data-mz-stage-context-notice>
              {t(contextPartial ? 'mz.stage.partialEvidence' : 'mz.stage.refreshingEvidence')}
            </Alert>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} alignItems={{ sm: 'center' }}>
            <ActionButton
              type="submit"
              intent="primary"
              loading={busy}
              loadingLabel={t('mz.stage.handoffPending')}
              disabled={!normalizedIntent || busy || !aiAvailable}
              endIcon={<ArrowRight size={17} aria-hidden="true" />}
              data-testid="mz-intent-handoff"
            >
              {t('mz.stage.handoff')}
            </ActionButton>
            <Typography variant="caption" color="text.secondary">
              {t('mz.stage.reviewBoundary')}
            </Typography>
          </Stack>
        </Stack>

        <Stack
          component="aside"
          aria-label={t('mz.stage.contextTitle')}
          gap={1.5}
          sx={{
            p: { xs: 2, sm: 2.5 },
            border: 1,
            borderColor: 'divider',
            borderRadius: 'var(--home-radius-section)',
            bgcolor: 'background.paper',
          }}
        >
          <Box>
            <Typography variant="overline" color="primary.main">
              {t('mz.stage.contextEyebrow')}
            </Typography>
            <Typography
              variant="subtitle1"
              fontWeight={foundationTokens.home.typography.weightHeavy}
            >
              {t('mz.stage.contextTitle')}
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
            {context.map(({ key, icon: Icon, value }) => (
              <Stack
                key={key}
                gap={0.5}
                sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: 2, minWidth: 0 }}
              >
                <Icon size={17} color={foundationTokens.color.product.primary} aria-hidden="true" />
                <Typography
                  variant="h6"
                  component="span"
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {contextLoading ? '—' : value}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {t(`mz.stage.context.${key}`)}
                </Typography>
              </Stack>
            ))}
          </Box>
          <Box sx={{ pt: 1.25, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('mz.stage.homeContext')}
            </Typography>
            <Typography
              variant="body2"
              fontWeight={foundationTokens.home.typography.weightEmphasis}
            >
              {headline}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {subheadline}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
