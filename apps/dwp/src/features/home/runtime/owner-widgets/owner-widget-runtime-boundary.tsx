import { HomeContentState, HomeWidgetErrorBoundary } from '../home-content-state';
import { OwnerWidgetRenderer } from './owner-widget-renderer';
import { normalizeOwnerWidget, normalizeOwnerWidgetEnvelope } from './owner-widget-view-model';

import type { OwnerWidgetBindingIdentity } from './owner-widget-contracts';
import type { OwnerWidgetLabelResolver, OwnerWidgetRendererVariant } from './owner-widget-renderer';

export type OwnerWidgetRuntimeState =
  'AVAILABLE' | 'EMPTY' | 'PARTIAL' | 'FORBIDDEN' | 'UNAVAILABLE' | 'STALE';

export type OwnerWidgetRuntimeRecord = OwnerWidgetBindingIdentity &
  Readonly<{
    state: OwnerWidgetRuntimeState;
    payload: unknown;
    actions: unknown;
    governanceSourceRoute: unknown;
    source: Readonly<{
      sourceKey: string;
      lastSuccessAt?: string | null;
      retryable: boolean;
      resultVersion?: string | null;
    }>;
  }>;

export type OwnerWidgetRuntimeBoundaryProps = Readonly<{
  runtimeWidget: OwnerWidgetRuntimeRecord;
  variant: OwnerWidgetRendererVariant;
  label: OwnerWidgetLabelResolver;
  locale?: string;
  maxItems?: number;
  refreshing?: boolean;
  onOpenSource?: (sourceRoute: string) => void;
  onRetry?: () => void;
}>;

function safeLastSuccessAt(value: string | null | undefined): string | undefined {
  if (!value || value.length > 48 || !Number.isFinite(Date.parse(value))) return undefined;
  return value;
}

export function OwnerWidgetRuntimeBoundary({
  runtimeWidget,
  variant,
  label,
  locale,
  maxItems,
  refreshing = false,
  onOpenSource,
  onRetry,
}: OwnerWidgetRuntimeBoundaryProps) {
  // This definition is projected into appDock by the broker and must never
  // occupy a composition card, including when its tuple or data is invalid.
  if (runtimeWidget.definitionKey === 'notification.app-badges') return null;

  const envelope = normalizeOwnerWidgetEnvelope(runtimeWidget);
  if (!envelope.ok) return <HomeContentState kind="widget-error" size="compact" />;
  if (envelope.value.contract.surface === 'APP_DOCK') return null;

  if (runtimeWidget.state === 'EMPTY') {
    return <HomeContentState kind="empty" size="compact" />;
  }
  if (runtimeWidget.state === 'FORBIDDEN') {
    return <HomeContentState kind="forbidden" size="compact" />;
  }
  if (runtimeWidget.state === 'UNAVAILABLE') {
    return (
      <HomeContentState
        kind="widget-error"
        size="compact"
        onAction={runtimeWidget.source.retryable ? onRetry : undefined}
      />
    );
  }

  const normalized = normalizeOwnerWidget({ ...runtimeWidget, locale });
  if (!normalized.ok) return <HomeContentState kind="widget-error" size="compact" />;
  const affectedSources = [label('ownerWidgets.sourceLabel')];
  const content = (
    <HomeWidgetErrorBoundary
      widgetKey={normalized.value.definitionKey}
      resetKey={runtimeWidget.source.resultVersion ?? runtimeWidget.state}
    >
      <OwnerWidgetRenderer
        widget={normalized.value}
        variant={variant}
        label={label}
        locale={locale}
        maxItems={maxItems}
        onOpenSource={onOpenSource}
      />
    </HomeWidgetErrorBoundary>
  );

  if (runtimeWidget.state === 'PARTIAL') {
    return (
      <HomeContentState
        kind="partial"
        size="compact"
        affectedSources={affectedSources}
        preservedContent={content}
        onAction={runtimeWidget.source.retryable ? onRetry : undefined}
      />
    );
  }
  if (runtimeWidget.state === 'STALE') {
    return (
      <HomeContentState
        kind="stale"
        size="compact"
        affectedSources={affectedSources}
        lastSuccessfulAt={safeLastSuccessAt(runtimeWidget.source.lastSuccessAt)}
        preservedContent={content}
        onAction={runtimeWidget.source.retryable ? onRetry : undefined}
      />
    );
  }
  if (refreshing) {
    return (
      <HomeContentState
        kind="background-refresh"
        size="compact"
        affectedSources={affectedSources}
        preservedContent={content}
      />
    );
  }
  return content;
}
