import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EmptyState,
  ErrorState,
  GuidedEmptyState,
  InlineFeedback,
  LoadingState,
  ProgressMeter,
} from '@dwp-frontend/design-system';
import { AlertTriangle, Clock3, GitCompareArrows, RefreshCw, Save } from 'lucide-react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton } from '@dwp-frontend/design-system';

export const HOME_CONTENT_STATES = [
  'initial-loading',
  'background-refresh',
  'empty',
  'partial',
  'forbidden',
  'stale',
  'widget-error',
  'dirty',
  'conflict',
] as const;

export type HomeContentStateKind = (typeof HOME_CONTENT_STATES)[number];

export type HomeContentStateSemantics = Readonly<{
  blocksContent: boolean;
  preservesVerifiedContent: boolean;
  role: 'status' | 'alert';
}>;

export function resolveHomeContentStateSemantics(
  kind: HomeContentStateKind
): HomeContentStateSemantics {
  switch (kind) {
    case 'initial-loading':
      return { blocksContent: true, preservesVerifiedContent: false, role: 'status' };
    case 'empty':
    case 'forbidden':
      return { blocksContent: true, preservesVerifiedContent: false, role: 'status' };
    case 'widget-error':
    case 'conflict':
      return { blocksContent: true, preservesVerifiedContent: false, role: 'alert' };
    case 'background-refresh':
    case 'partial':
    case 'stale':
    case 'dirty':
      return { blocksContent: false, preservesVerifiedContent: true, role: 'status' };
  }
}

type HomeContentStateProps = Readonly<{
  kind: HomeContentStateKind;
  title?: string;
  description?: string;
  affectedSources?: readonly string[];
  lastSuccessfulAt?: string;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
  preservedContent?: ReactNode;
  size?: 'compact' | 'standard' | 'page';
}>;

export function HomeContentState({
  kind,
  title,
  description,
  affectedSources = [],
  lastSuccessfulAt,
  actionLabel,
  onAction,
  busy = false,
  preservedContent,
  size = 'compact',
}: HomeContentStateProps) {
  const { t } = useTranslation('home');
  const semantics = resolveHomeContentStateSemantics(kind);
  const resolvedTitle = title ?? t(`states.${kind}.title`);
  const resolvedDescription = description ?? t(`states.${kind}.description`);
  const resolvedActionLabel = actionLabel ?? t('states.retry');
  const metadata = (
    <Stack gap={0.25} sx={{ mt: 0.75 }}>
      {affectedSources.length > 0 && (
        <Typography variant="caption" color="text.secondary" data-home-state-sources>
          {t('states.affectedSources', { sources: affectedSources.join(', ') })}
        </Typography>
      )}
      {lastSuccessfulAt && (
        <Typography variant="caption" color="text.secondary" data-home-state-last-success>
          {t('states.lastSuccessfulAt', { time: lastSuccessfulAt })}
        </Typography>
      )}
    </Stack>
  );

  let statePanel: ReactNode;
  if (kind === 'initial-loading') {
    statePanel = (
      <LoadingState
        label={resolvedTitle}
        description={resolvedDescription}
        variant="skeleton"
        skeletonRows={3}
        size={size}
      />
    );
  } else if (kind === 'empty') {
    statePanel = (
      <EmptyState
        title={resolvedTitle}
        description={resolvedDescription}
        action={
          onAction ? (
            <ActionButton intent="secondary" onClick={onAction} sx={{ minHeight: 44 }}>
              {resolvedActionLabel}
            </ActionButton>
          ) : undefined
        }
        size={size}
      />
    );
  } else if (kind === 'forbidden') {
    statePanel = (
      <GuidedEmptyState
        kind="permission"
        title={resolvedTitle}
        description={resolvedDescription}
        size={size}
      />
    );
  } else if (kind === 'widget-error') {
    statePanel = (
      <ErrorState
        title={resolvedTitle}
        description={resolvedDescription}
        retryLabel={onAction ? resolvedActionLabel : undefined}
        onRetry={onAction}
        retrying={busy}
        size={size}
      />
    );
  } else {
    const severity =
      kind === 'conflict' ? 'error' : kind === 'background-refresh' ? 'info' : 'warning';
    const Icon =
      kind === 'background-refresh'
        ? RefreshCw
        : kind === 'stale'
          ? Clock3
          : kind === 'dirty'
            ? Save
            : kind === 'conflict'
              ? GitCompareArrows
              : AlertTriangle;
    statePanel = (
      <InlineFeedback
        severity={severity}
        role={semantics.role}
        icon={<Icon size={19} aria-hidden="true" />}
        title={resolvedTitle}
        action={
          onAction ? (
            <ActionButton
              intent="quiet"
              size="small"
              loading={busy}
              onClick={onAction}
              sx={{ minHeight: 44 }}
            >
              {resolvedActionLabel}
            </ActionButton>
          ) : undefined
        }
        sx={{ alignItems: 'flex-start', border: 1, borderColor: 'divider' }}
      >
        {resolvedDescription}
        {metadata}
        {kind === 'background-refresh' && (
          <Box aria-hidden="true" sx={{ mt: 1 }}>
            <ProgressMeter showLabel={false} label={resolvedTitle} value={42} size="compact" />
          </Box>
        )}
      </InlineFeedback>
    );
  }

  return (
    <Box
      data-home-content-state={kind}
      data-home-content-size={size}
      data-home-content-blocking={semantics.blocksContent ? 'true' : 'false'}
      data-home-content-preserved={semantics.preservesVerifiedContent ? 'true' : 'false'}
      aria-busy={kind === 'initial-loading' || kind === 'background-refresh' ? 'true' : undefined}
    >
      {preservedContent}
      {statePanel}
    </Box>
  );
}

type HomeWidgetErrorBoundaryProps = Readonly<{
  widgetKey: string;
  resetKey?: string | number;
  onError?: (error: Error, info: ErrorInfo) => void;
  children: ReactNode;
}>;

type HomeWidgetErrorBoundaryState = Readonly<{ error: Error | null }>;

function HomeWidgetCrashFallback({
  widgetKey,
  onRetry,
}: {
  widgetKey: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation('home');
  return (
    <HomeContentState
      kind="widget-error"
      title={t('states.widget-error.title')}
      description={t('states.widget-error.description', { widget: widgetKey })}
      actionLabel={t('states.retry')}
      onAction={onRetry}
    />
  );
}

/** Isolates one widget renderer so the remaining Home document stays operational. */
export class HomeWidgetErrorBoundary extends Component<
  HomeWidgetErrorBoundaryProps,
  HomeWidgetErrorBoundaryState
> {
  state: HomeWidgetErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): HomeWidgetErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(previous: HomeWidgetErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <HomeWidgetCrashFallback widgetKey={this.props.widgetKey} onRetry={this.retry} />;
    }
    return this.props.children;
  }
}
