import { AnnouncementsWidget } from '../announcements-widget';

import type { GovernedWorkspaceWidget } from '../../../components/workspace-composer/workspace-widget-canvas';
import type { GovernedHomeZone, HomeOverview } from '@dwp-frontend/shared-utils';

type ClassicHomeGovernedWidgetsOptions = {
  zone: GovernedHomeZone;
  label: string;
  overview?: HomeOverview;
  loading: boolean;
  fetching: boolean;
  requestFailed: boolean;
  onRetry: () => void;
};

export function classicHomeGovernedWidgets({
  zone,
  label,
  overview,
  loading,
  fetching,
  requestFailed,
  onRetry,
}: ClassicHomeGovernedWidgetsOptions): GovernedWorkspaceWidget[] {
  if (!zone.visible) return [];
  return [
    {
      widgetKey: zone.zoneKey,
      label,
      size: zone.size,
      height: zone.height,
      surface: 'plain',
      content: (
        <AnnouncementsWidget
          overview={overview}
          loading={loading}
          fetching={fetching}
          requestFailed={requestFailed}
          onRetry={onRetry}
        />
      ),
    },
  ];
}
