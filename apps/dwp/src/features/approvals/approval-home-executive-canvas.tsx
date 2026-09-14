import Box from '@mui/material/Box';

import type { ReactNode } from 'react';
import type { HomeWidgetHeight, HomeWidgetSize } from '@dwp-frontend/shared-utils';
import type { WorkspaceWidgetDefinition } from '../../components/workspace-composer/workspace-composer-model';
import type { ApprovalHomeWidgetKey } from './approval-home-widget-registry';

const PRIMARY_WIDGETS: readonly ApprovalHomeWidgetKey[] = ['focus-queue', 'my-requests', 'flow'];
const SUPPORT_WIDGETS: readonly ApprovalHomeWidgetKey[] = [
  'quick-actions',
  'insights',
  'recent-activity',
];

export function ApprovalHomeExecutiveCanvas({
  registry,
  renderWidget,
}: {
  registry: readonly WorkspaceWidgetDefinition<ApprovalHomeWidgetKey>[];
  renderWidget: (
    key: ApprovalHomeWidgetKey,
    size: HomeWidgetSize,
    height: HomeWidgetHeight
  ) => ReactNode;
}) {
  const render = (key: ApprovalHomeWidgetKey) => {
    const definition = registry.find((item) => item.key === key);
    if (!definition) return null;
    return (
      <Box key={key} data-workspace-widget={key} sx={{ minWidth: 0 }}>
        <Box data-workspace-widget-content>
          {renderWidget(key, definition.defaultSize, definition.defaultHeight)}
        </Box>
      </Box>
    );
  };
  const hasSupport = registry.some((item) => SUPPORT_WIDGETS.includes(item.key));
  return (
    <Box data-approval-executive-layout sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
      {render('decision-pulse')}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: hasSupport ? 'minmax(0, 2fr) minmax(0, 1fr)' : 'minmax(0, 1fr)',
          },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box data-approval-primary-column sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          {PRIMARY_WIDGETS.map(render)}
        </Box>
        {hasSupport && (
          <Box data-approval-support-column sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
            {SUPPORT_WIDGETS.map(render)}
          </Box>
        )}
      </Box>
    </Box>
  );
}
