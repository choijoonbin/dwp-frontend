import { CommandRailWidget } from './command-rail-widget';
import { CalendarInsightHomeWidget } from './calendar-insight-home-widget';
import { ActivityWidget, DailyBriefWidget, FocusWidget, ScheduleWidget } from './home-widgets';
import { HomeWidgetRuntimeBoundary } from './home-widget-runtime-boundary';

import type { HomeOverviewWidgetProps } from './home-widgets';
import type { HomeWidgetHeight, HomeWidgetKey, HomeWidgetSize } from '@dwp-frontend/shared-utils';
import type { HomeWidgetRuntimeDecision } from './runtime/widget-registry-runtime';

type HomeOverviewWidgetComponentProps = {
  widgetKey: HomeWidgetKey;
  size: HomeWidgetSize;
  height: HomeWidgetHeight;
  runtimeDecision: HomeWidgetRuntimeDecision;
  label: string;
} & HomeOverviewWidgetProps;

export function HomeOverviewWidget({
  widgetKey,
  size,
  height,
  runtimeDecision,
  label,
  ...overviewProps
}: HomeOverviewWidgetComponentProps) {
  let content = null;
  switch (widgetKey) {
    case 'command-rail':
      content = <CommandRailWidget {...overviewProps} />;
      break;
    case 'daily-brief':
      content = <DailyBriefWidget {...overviewProps} />;
      break;
    case 'focus':
      content = <FocusWidget {...overviewProps} size={size} height={height} />;
      break;
    case 'schedule':
      content = <ScheduleWidget {...overviewProps} size={size} height={height} />;
      break;
    case 'activity':
      content = <ActivityWidget {...overviewProps} size={size} height={height} />;
      break;
    case 'focus-balance':
    case 'meeting-load':
      content = (
        <CalendarInsightHomeWidget
          {...overviewProps}
          widgetKey={widgetKey}
          compact={size === 'quarter' || size === 'compact'}
          height={height}
        />
      );
      break;
  }
  return (
    <HomeWidgetRuntimeBoundary decision={runtimeDecision} label={label}>
      {content}
    </HomeWidgetRuntimeBoundary>
  );
}
