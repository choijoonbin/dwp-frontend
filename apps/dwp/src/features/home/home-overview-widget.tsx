import { CommandRailWidget } from './command-rail-widget';
import { CalendarInsightHomeWidget } from './calendar-insight-home-widget';
import { ActivityWidget, DailyBriefWidget, FocusWidget, ScheduleWidget } from './home-widgets';

import type { HomeOverviewWidgetProps } from './home-widgets';
import type { HomeWidgetHeight, HomeWidgetKey, HomeWidgetSize } from '@dwp-frontend/shared-utils';

type HomeOverviewWidgetComponentProps = {
  widgetKey: HomeWidgetKey;
  size: HomeWidgetSize;
  height: HomeWidgetHeight;
} & HomeOverviewWidgetProps;

export function HomeOverviewWidget({
  widgetKey,
  size,
  height,
  ...overviewProps
}: HomeOverviewWidgetComponentProps) {
  switch (widgetKey) {
    case 'command-rail':
      return <CommandRailWidget {...overviewProps} />;
    case 'daily-brief':
      return <DailyBriefWidget {...overviewProps} />;
    case 'focus':
      return <FocusWidget {...overviewProps} size={size} height={height} />;
    case 'schedule':
      return <ScheduleWidget {...overviewProps} size={size} height={height} />;
    case 'activity':
      return <ActivityWidget {...overviewProps} size={size} height={height} />;
    case 'focus-balance':
    case 'meeting-load':
      return (
        <CalendarInsightHomeWidget
          {...overviewProps}
          widgetKey={widgetKey}
          compact={size === 'quarter' || size === 'compact'}
          height={height}
        />
      );
  }
}
