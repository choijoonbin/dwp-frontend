// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NotificationCenterPresentationControls,
  NotificationCenterPresentationList,
} from './notification-center-presentation';
import { DEFAULT_NOTIFICATION_CENTER_PRESENTATION } from './notification-saved-view-model';

import type {
  NotificationDeliveryProfile,
  NotificationItem,
} from '@dwp-frontend/shared-utils/api/notification-api';
import type { NotificationCenterPresentation } from './notification-saved-view-model';

vi.mock('./notification-action-card', () => ({
  NotificationActionCard: ({
    item,
    density,
  }: {
    item: NotificationItem;
    density: 'standard' | 'compact';
  }) => (
    <button type="button" data-testid="notification-card" data-density={density}>
      {item.title}
    </button>
  ),
}));

const notification = (
  notificationId: string,
  threadKey: string,
  source = { appKey: 'approvals', appName: 'Approvals' }
): NotificationItem => ({
  notificationId,
  threadKey,
  threadCount: 1,
  source,
  typeKey: 'APPROVAL.ACTION_REQUIRED',
  title: `Review ${notificationId}`,
  preview: `Preview ${notificationId}`,
  priority: 'HIGH',
  reason: { kind: 'DIRECT', label: 'Assigned directly' },
  receivedAt: '2026-09-16T01:00:00Z',
  lastActivityAt: '2026-09-16T01:00:00Z',
  actionable: true,
  sensitive: false,
  actions: [],
  version: '1',
});

const profile = {
  presentation: { previewMode: 'FULL' },
} as NotificationDeliveryProfile;

function PresentationControlHarness() {
  const [presentation, setPresentation] = useState<NotificationCenterPresentation>({
    ...DEFAULT_NOTIFICATION_CENTER_PRESENTATION,
  });
  return (
    <NotificationCenterPresentationControls
      presentation={presentation}
      onDensityChange={(density) => setPresentation((current) => ({ ...current, density }))}
      onGroupingChange={(grouping) => setPresentation((current) => ({ ...current, grouping }))}
    />
  );
}

describe('notification center presentation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.replaceChildren();
  });

  it('supports roving density keys and keyboard selection from the grouping menu', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider theme={createTheme()}>
          <PresentationControlHarness />
        </ThemeProvider>
      );
    });

    const densityGroup = getByRole(container, 'radiogroup', { name: 'Display density' });
    const compact = getByRole(densityGroup, 'radio', { name: 'Compact' });
    const detailed = getByRole(densityGroup, 'radio', { name: 'Detailed' });
    expect(detailed.getAttribute('aria-checked')).toBe('true');
    expect(compact.getAttribute('tabindex')).toBe('-1');

    await act(async () => fireEvent.keyDown(detailed, { key: 'ArrowLeft' }));
    expect(compact.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(compact);

    const groupingButton = getByRole(container, 'button', {
      name: 'Group notifications: No grouping',
    });
    await act(async () => fireEvent.click(groupingButton));
    expect(groupingButton.getAttribute('aria-expanded')).toBe('true');
    const menu = getByRole(document.body, 'menu', { name: 'Group notifications' });
    const context = getByRole(menu, 'menuitemradio', { name: 'Context' });
    await act(async () => {
      context.focus();
      fireEvent.keyDown(context, { key: 'Enter' });
      fireEvent.keyUp(context, { key: 'Enter' });
    });
    expect(
      getByRole(container, 'button', { name: 'Group notifications: Context' }).getAttribute(
        'aria-expanded'
      )
    ).toBe('false');
  });

  it('renders genuinely compact dense cards and keeps detailed cards informative', async () => {
    const items = [
      notification('one', 'approval:budget-43'),
      notification('two', 'approval:budget-43'),
      notification('three', 'approval:budget-44'),
    ];
    const renderList = (presentation: NotificationCenterPresentation) => (
      <ThemeProvider theme={createTheme()}>
        <NotificationCenterPresentationList
          items={items}
          presentation={presentation}
          listLabel="Notifications"
          profile={profile}
          protectedTitle="Protected notification"
          now={Date.parse('2026-09-16T02:00:00Z')}
          selectedId="one"
          selectedIds={new Set()}
          detailItemId={null}
          detailOpen={false}
          compactDetail={false}
          busy={false}
          rowRefs={{ current: [] }}
          onKeyDown={() => undefined}
          onFocusItem={() => undefined}
          onToggleChecked={() => undefined}
          onOpenDetails={() => undefined}
          onTriage={() => undefined}
          onQuickReply={() => Promise.resolve()}
        />
      </ThemeProvider>
    );

    await act(async () =>
      root.render(
        renderList({ ...DEFAULT_NOTIFICATION_CENTER_PRESENTATION, density: 'DENSE', grouping: 'CONTEXT' })
      )
    );
    expect(container.querySelectorAll('[data-density="compact"]')).toHaveLength(3);
    expect(container.textContent).not.toContain('approval:budget-43');
    expect(container.textContent).not.toContain('approval:budget-44');
    expect(getByRole(container, 'heading', { name: 'Approvals context 1' })).toBeTruthy();

    await act(async () =>
      root.render(
        renderList({ ...DEFAULT_NOTIFICATION_CENTER_PRESENTATION, grouping: 'CONTEXT' })
      )
    );
    expect(container.querySelectorAll('[data-density="standard"]')).toHaveLength(3);
  });
});
