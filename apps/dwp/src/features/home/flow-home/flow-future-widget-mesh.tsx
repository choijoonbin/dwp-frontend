import { useTranslation } from 'react-i18next';
import {
  BookOpenCheck,
  Bot,
  Building2,
  CalendarCheck2,
  Check,
  FilePenLine,
  MessageSquareText,
} from 'lucide-react';
import { ActionButton, ProgressMeter } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HomeContentState } from '../runtime/home-content-state';

import type { HomeContentStateKind } from '../runtime/home-content-state';

export type FlowFutureWidgetKey =
  | 'space-change-feed'
  | 'meetings-prep-decisions'
  | 'dwaion-artifact'
  | 'workplace-booking'
  | 'learning-progress';

export type FlowFutureWidgetContract = Readonly<{
  key: FlowFutureWidgetKey;
  owner: string;
  source: string;
  permission: string;
  connection: 'WAVE4_PROVIDER_PROJECTION';
}>;

export const FLOW_FUTURE_WIDGET_CONTRACTS: readonly FlowFutureWidgetContract[] = [
  {
    key: 'space-change-feed',
    owner: 'DWP Space',
    source: 'space.change-feed',
    permission: 'APP.SPACES:VIEW',
    connection: 'WAVE4_PROVIDER_PROJECTION',
  },
  {
    key: 'meetings-prep-decisions',
    owner: 'DWP Meetings',
    source: 'meetings.next-prep',
    permission: 'APP.MEETINGS:VIEW',
    connection: 'WAVE4_PROVIDER_PROJECTION',
  },
  {
    key: 'dwaion-artifact',
    owner: 'DWAI·ON',
    source: 'dwaion.artifact',
    permission: 'APP.DWAION_ARTIFACTS:VIEW',
    connection: 'WAVE4_PROVIDER_PROJECTION',
  },
  {
    key: 'workplace-booking',
    owner: 'DWP Workplace',
    source: 'workplace.booking',
    permission: 'APP.WORKPLACE:VIEW',
    connection: 'WAVE4_PROVIDER_PROJECTION',
  },
  {
    key: 'learning-progress',
    owner: 'DWP People',
    source: 'hr.edu',
    permission: 'APP.HCM:VIEW',
    connection: 'WAVE4_PROVIDER_PROJECTION',
  },
] as const;

export type FlowFutureWidgetState =
  'loaded' | 'preview' | Extract<HomeContentStateKind, 'empty' | 'partial' | 'stale'>;

type FlowFutureWidgetMeshProps = Readonly<{
  stateByKey?: Partial<Record<FlowFutureWidgetKey, FlowFutureWidgetState>>;
}>;

function Surface({
  contract,
  state,
  children,
}: {
  contract: FlowFutureWidgetContract;
  state: FlowFutureWidgetState;
  children: React.ReactNode;
}) {
  const { t } = useTranslation('home');
  const verified = (
    <Box data-flow-prototype-verified-content sx={{ display: 'contents' }}>
      {children}
    </Box>
  );
  return (
    <Box
      component="article"
      data-flow-future-widget={contract.key}
      data-widget-owner={contract.owner}
      data-widget-source={contract.source}
      data-widget-permission={contract.permission}
      data-integration-boundary={contract.connection}
      data-flow-projection-kind={state === 'loaded' ? 'deterministic-evidence' : 'preview'}
      data-flow-provider-status={state === 'loaded' ? 'available' : 'unavailable'}
      data-flow-provider-activation={state === 'loaded' ? 'fixture-only' : 'blocked'}
      sx={{
        minWidth: 0,
        height: '100%',
        minHeight: { xs: 0, md: 308 },
        p: { xs: 2, md: 2.5 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.home.radius.card,
        boxShadow: foundationTokens.home.shadow.quietCard,
      }}
    >
      {state === 'loaded' ? (
        verified
      ) : state === 'preview' ? (
        <>
          <Typography role="status" variant="caption" color="text.secondary">
            {t('flow.future.previewUnavailable')}
          </Typography>
          {verified}
        </>
      ) : (
        <HomeContentState
          kind={state}
          affectedSources={[contract.source]}
          lastSuccessfulAt={state === 'stale' ? t('flow.future.lastVerified') : undefined}
          preservedContent={state === 'partial' || state === 'stale' ? verified : undefined}
        />
      )}
    </Box>
  );
}

export function FlowBaseSpaceCompactPreview() {
  const { t } = useTranslation('home');
  const contract = FLOW_FUTURE_WIDGET_CONTRACTS.find(
    (candidate) => candidate.key === 'space-change-feed'
  )!;
  return (
    <Box
      data-flow-base-space-feed
      sx={{ display: { xs: 'block', sm: 'none' }, minWidth: 0, gridColumn: '1 / -1' }}
    >
      <Surface contract={contract} state="preview">
        <Header
          icon={MessageSquareText}
          eyebrow={t('flow.future.space.eyebrow')}
          title={t('flow.future.space.title')}
        />
        <Typography variant="body2" color="text.secondary">
          {t('flow.future.space.items.one.detail')}
        </Typography>
        <ActionButton disabled intent="quiet" sx={{ minHeight: 44, alignSelf: 'flex-start' }}>
          {t('flow.future.space.action')}
        </ActionButton>
      </Surface>
    </Box>
  );
}

function Header({
  icon: Icon,
  title,
  eyebrow,
}: {
  icon: typeof MessageSquareText;
  title: string;
  eyebrow: string;
}) {
  return (
    <Stack direction="row" alignItems="flex-start" gap={1.25}>
      <Box
        aria-hidden="true"
        sx={{
          width: 36,
          height: 36,
          flex: '0 0 auto',
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: 'action.hover',
          borderRadius: foundationTokens.home.radius.card,
        }}
      >
        <Icon size={19} />
      </Box>
      <Box minWidth={0}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ lineHeight: foundationTokens.home.typography.tightLineHeight }}
        >
          {eyebrow}
        </Typography>
        <Typography
          component="h3"
          variant="subtitle1"
          fontWeight={foundationTokens.home.typography.weightBold}
          sx={{ lineHeight: foundationTokens.home.typography.cardLineHeight }}
        >
          {title}
        </Typography>
      </Box>
    </Stack>
  );
}

export function FlowFutureWidgetMesh({ stateByKey = {} }: FlowFutureWidgetMeshProps) {
  const { t } = useTranslation('home');
  const contract = (key: FlowFutureWidgetKey) =>
    FLOW_FUTURE_WIDGET_CONTRACTS.find((candidate) => candidate.key === key)!;
  const state = (key: FlowFutureWidgetKey): FlowFutureWidgetState => stateByKey[key] ?? 'preview';
  const fixtureActionEnabled = (key: FlowFutureWidgetKey) => state(key) === 'loaded';
  const loadedEvidence = FLOW_FUTURE_WIDGET_CONTRACTS.every(({ key }) => state(key) === 'loaded');

  return (
    <Box
      component="section"
      aria-labelledby="flow-future-mesh-title"
      data-flow-future-widget-mesh
      data-flow-future-widget-count={FLOW_FUTURE_WIDGET_CONTRACTS.length}
      data-flow-future-layout="desktop-38-34-28-mobile-stack"
      data-flow-future-mobile-order="meetings-space-ai-workplace-learning"
    >
      <Stack direction="row" alignItems="flex-end" justifyContent="space-between" gap={2} mb={1.5}>
        <Box>
          <Typography
            id="flow-future-mesh-title"
            component="h2"
            variant="h6"
            fontWeight={foundationTokens.home.typography.weightEmphasis}
          >
            {t('flow.future.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('flow.future.description')}
          </Typography>
        </Box>
        <Chip
          size="small"
          color="primary"
          variant="outlined"
          label={t(loadedEvidence ? 'flow.future.loadedEvidence' : 'flow.future.preview')}
        />
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: 'minmax(0, 38fr) minmax(0, 34fr) minmax(0, 28fr)',
          },
          gap: 2,
          alignItems: 'stretch',
          '@media (min-width: 900px)': {
            gridAutoRows: 'minmax(308px, auto)',
            '& > [data-flow-future-widget="space-change-feed"]': {
              gridColumn: 1,
              gridRow: 1,
            },
            '& > [data-flow-future-widget="meetings-prep-decisions"]': {
              gridColumn: 2,
              gridRow: 1,
            },
            '& > [data-flow-future-widget="dwaion-artifact"]': {
              gridColumn: 3,
              gridRow: '1 / span 2',
            },
            '& > [data-flow-future-widget="workplace-booking"]': {
              gridColumn: 1,
              gridRow: 2,
            },
            '& > [data-flow-future-widget="learning-progress"]': {
              gridColumn: 2,
              gridRow: 2,
            },
          },
        }}
      >
        <Surface
          contract={contract('meetings-prep-decisions')}
          state={state('meetings-prep-decisions')}
        >
          <Header
            icon={CalendarCheck2}
            eyebrow={t('flow.future.meeting.eyebrow')}
            title={t('flow.future.meeting.title')}
          />
          <Stack gap={0.75}>
            {(['agenda', 'brief', 'room'] as const).map((item, index) => (
              <Stack key={item} direction="row" alignItems="center" gap={1}>
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 22,
                    height: 22,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '50%',
                    bgcolor: index < 2 ? 'success.main' : 'action.selected',
                    color: index < 2 ? 'success.contrastText' : 'text.secondary',
                  }}
                >
                  {index < 2 && <Check size={14} />}
                </Box>
                <Typography variant="body2">{t(`flow.future.meeting.checks.${item}`)}</Typography>
              </Stack>
            ))}
          </Stack>
          <Box
            sx={{
              p: 1.25,
              bgcolor: 'action.hover',
              borderInlineStart: 3,
              borderColor: 'warning.main',
              borderRadius: foundationTokens.home.radius.compactCard,
            }}
          >
            <Typography
              variant="caption"
              fontWeight={foundationTokens.home.typography.weightBold}
              color="text.primary"
            >
              {t('flow.future.meeting.decisionLabel')}
            </Typography>
            <Typography variant="body2">{t('flow.future.meeting.decision')}</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <ActionButton
              disabled={!fixtureActionEnabled('meetings-prep-decisions')}
              intent="primary"
              sx={{ minHeight: 44 }}
            >
              {t('flow.future.meeting.accept')}
            </ActionButton>
            <ActionButton
              disabled={!fixtureActionEnabled('meetings-prep-decisions')}
              intent="secondary"
              sx={{ minHeight: 44 }}
            >
              {t('flow.future.meeting.assign')}
            </ActionButton>
          </Stack>
        </Surface>

        <Surface contract={contract('space-change-feed')} state={state('space-change-feed')}>
          <Header
            icon={MessageSquareText}
            eyebrow={t('flow.future.space.eyebrow')}
            title={t('flow.future.space.title')}
          />
          <Stack gap={1}>
            {(['one', 'two'] as const).map((item) => (
              <Box
                key={item}
                sx={{
                  p: 1.25,
                  bgcolor: 'background.default',
                  borderRadius: foundationTokens.home.radius.compactCard,
                }}
              >
                <Typography
                  variant="body2"
                  fontWeight={foundationTokens.home.typography.weightSemibold}
                >
                  {t(`flow.future.space.items.${item}.title`)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(`flow.future.space.items.${item}.detail`)}
                </Typography>
              </Box>
            ))}
          </Stack>
          <ActionButton
            disabled={!fixtureActionEnabled('space-change-feed')}
            intent="quiet"
            sx={{ minHeight: 44, alignSelf: 'flex-start' }}
          >
            {t('flow.future.space.action')}
          </ActionButton>
        </Surface>

        <Surface contract={contract('dwaion-artifact')} state={state('dwaion-artifact')}>
          <Header
            icon={Bot}
            eyebrow={t('flow.future.artifact.eyebrow')}
            title={t('flow.future.artifact.title')}
          />
          <Box
            sx={{
              p: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: foundationTokens.home.radius.compactCard,
            }}
          >
            <Stack direction="row" alignItems="center" gap={1} mb={1}>
              <FilePenLine size={17} aria-hidden="true" />
              <Typography
                variant="subtitle2"
                fontWeight={foundationTokens.home.typography.weightBold}
              >
                {t('flow.future.artifact.document')}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {t('flow.future.artifact.detail')}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t('flow.future.artifact.saved')}
          </Typography>
          <ActionButton
            disabled={!fixtureActionEnabled('dwaion-artifact')}
            intent="primary"
            sx={{ minHeight: 44 }}
          >
            {t('flow.future.artifact.action')}
          </ActionButton>
        </Surface>

        <Surface contract={contract('workplace-booking')} state={state('workplace-booking')}>
          <Header
            icon={Building2}
            eyebrow={t('flow.future.booking.eyebrow')}
            title={t('flow.future.booking.title')}
          />
          <Typography variant="body2" color="text.secondary">
            {t('flow.future.booking.detail')}
          </Typography>
          <Box
            component="img"
            src="/assets/home/wave2/flow-workplace-booth.jpg"
            alt=""
            aria-hidden="true"
            sx={{
              width: 1,
              height: { xs: 136, md: 112 },
              objectFit: 'cover',
              borderRadius: foundationTokens.home.radius.control,
              border: 1,
              borderColor: 'divider',
            }}
          />
          <ActionButton
            disabled={!fixtureActionEnabled('workplace-booking')}
            intent="secondary"
            sx={{ minHeight: 44, alignSelf: 'flex-start' }}
          >
            {t('flow.future.booking.action')}
          </ActionButton>
        </Surface>

        <Surface contract={contract('learning-progress')} state={state('learning-progress')}>
          <Header
            icon={BookOpenCheck}
            eyebrow={t('flow.future.learning.eyebrow')}
            title={t('flow.future.learning.title')}
          />
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="body2">{t('flow.future.learning.detail')}</Typography>
            <Typography variant="body2" fontWeight={foundationTokens.home.typography.weightHeavy}>
              75%
            </Typography>
          </Stack>
          <ProgressMeter
            showLabel={false}
            value={75}
            size="compact"
            label={t('flow.future.learning.progress')}
          />
        </Surface>
      </Box>
    </Box>
  );
}
