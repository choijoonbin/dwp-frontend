import { describe, expect, it } from 'vitest';

import {
  messagingConversationHeaderResponsiveLayout,
  messagingMobileThreadDrawerLayout,
  messagingMobileThreadTransitionDuration,
  messagingWorkspaceGridColumns,
} from './messaging-workspace-layout';

describe('messaging workspace responsive layout', () => {
  it('reserves a visible first row for the conversation heading on narrow screens', () => {
    expect(messagingConversationHeaderResponsiveLayout).toMatchObject({
      flexWrap: { xs: 'wrap' },
      titleFlex: { xs: '1 1 calc(100% - 52px)' },
      actionsWidth: { xs: 1 },
    });
  });

  it('allocates the thread column from the selected root even before thread data loads', () => {
    expect(messagingWorkspaceGridColumns('root-message-id', false)).toEqual({
      desktop: 'minmax(0, 1fr) minmax(336px, 372px)',
      wide: 'minmax(0, 1fr) 340px',
      extraWide: '258px minmax(0, 1fr) 340px',
    });
  });

  it('pins the mobile thread paper to both viewport edges without a viewport-unit width', () => {
    expect(messagingMobileThreadDrawerLayout).toMatchObject({
      left: { xs: 0 },
      right: 0,
      width: { xs: 'auto' },
      minWidth: 0,
    });
    expect(messagingMobileThreadTransitionDuration).toBe(0);
  });
});
