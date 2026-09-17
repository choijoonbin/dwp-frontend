import type { HomeWidgetKey, WidgetPublicReasonCode } from '@dwp-frontend/shared-utils';

export type HomeWidgetRuntimeDecision = Readonly<{
  widgetKey: HomeWidgetKey;
  rendererKey: string | null;
  render: 'NATIVE' | 'UNAVAILABLE';
  canAdd: boolean;
  canRestore: boolean;
  deprecated: boolean;
  publicReason: WidgetPublicReasonCode;
}>;

export type HomeWidgetRuntimeDecisions = Readonly<Record<HomeWidgetKey, HomeWidgetRuntimeDecision>>;

export type HomeWidgetShadowObservationStatus =
  'MATCH' | 'DRIFT' | 'INVALID' | 'PENDING' | 'INACTIVE';

export type HomeWidgetShadowObservation = Readonly<{
  status: HomeWidgetShadowObservationStatus;
  mismatchCount: number;
  decisionRevision: string | null;
  mismatches: readonly Readonly<{
    widgetKey: HomeWidgetKey;
    observedRender: HomeWidgetRuntimeDecision['render'];
    observedReason: WidgetPublicReasonCode;
  }>[];
}>;
