// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NOTIFICATION_LIVE_EVENT,
  type NotificationDeliveryProfile,
  type NotificationEffectiveSettings,
  type NotificationItem,
} from '@dwp-frontend/shared-utils/api/notification-api';

import { NotificationArrivalHost } from './notification-arrival-host';
import { notificationQueryKeys } from '../features/notifications/integration-contract';

const dependencies = vi.hoisted(() => ({
  getNotificationDetail: vi.fn(),
  user: { tenantId: 1, userId: 11 },
}));

vi.mock('@dwp-frontend/shared-utils/api/notification-api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getNotificationDetail: dependencies.getNotificationDetail,
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => ({ isAuthenticated: true, user: dependencies.user }),
}));

vi.mock('../providers/personal-preference-provider', () => ({
  usePersonalPreference: () => ({ preference: null }),
}));

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => `${key}:${options?.count ?? ''}`,
  }),
}));

const firstId = '93af7315-2271-462e-a819-3d238a28830f';
const secondId = '93af7315-2271-462e-a819-3d238a288310';
const item = {
  notificationId: firstId,
  threadCount: 1,
  source: { appKey: 'messaging', appName: 'Messaging' },
  typeKey: 'MESSAGING.DIRECT_MESSAGE',
  title: 'New message',
  priority: 'NORMAL',
  reason: { kind: 'DIRECT', label: 'Direct' },
  receivedAt: '2026-09-04T00:00:00Z',
  lastActivityAt: '2026-09-04T00:00:00Z',
  actionable: false,
  sensitive: false,
  actions: [],
  version: '1',
} satisfies NotificationItem;

const profile = {
  channels: {
    IN_APP: true,
    EMAIL: false,
    WEB_PUSH: false,
    MOBILE_PUSH: false,
    TEAMS: false,
    SLACK: false,
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
    timeZone: 'Asia/Seoul',
    days: [],
    allowUrgentBypass: false,
  },
  digest: { mode: 'OFF', deliveryTime: '09:00' },
  presentation: { bannerMode: 'SMART', previewMode: 'HIDDEN' },
  version: '1',
  updatedAt: '2026-09-04T00:00:00Z',
} satisfies NotificationDeliveryProfile;

const settings = {
  partial: false,
  unavailableSources: [],
  globalChannels: {},
  apps: [],
  generatedAt: '2026-09-04T00:00:00Z',
} satisfies NotificationEffectiveSettings;

let root: Root;
let container: HTMLDivElement;
let queryClient: QueryClient;

async function emitArrivals(ids: string[]) {
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent(NOTIFICATION_LIVE_EVENT, {
        detail: { changeVersion: '1', counterVersion: '1', changedIds: ids, arrivalIds: ids },
      })
    );
  });
}

async function mountHost() {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(MemoryRouter, null, createElement(NotificationArrivalHost))
      )
    );
  });
}

describe('notification arrival detail boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dependencies.getNotificationDetail.mockReset();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(notificationQueryKeys.preferences(), profile);
    queryClient.setQueryData(notificationQueryKeys.effectiveSettings(), settings);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it.each([
    ['undefined detail', undefined],
    ['null detail', null],
    ['missing item', {}],
    ['undefined item', { item: undefined }],
    ['null item', { item: null }],
    ['inbox page instead of detail', { items: [item], hasMore: false }],
  ])('retries %s without interrupting valid siblings or losing the arrival', async (_, invalid) => {
    dependencies.getNotificationDetail
      .mockResolvedValueOnce(invalid)
      .mockResolvedValueOnce({ item: { ...item, notificationId: secondId } })
      .mockResolvedValueOnce({ item });
    await mountHost();
    await emitArrivals([firstId, secondId]);

    expect(dependencies.getNotificationDetail).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('glance.newItems:1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(dependencies.getNotificationDetail).toHaveBeenCalledTimes(3);
    expect(dependencies.getNotificationDetail).toHaveBeenLastCalledWith(firstId);
    expect(document.body.textContent).toContain('glance.newItems:2');

    await emitArrivals([firstId, secondId]);
    expect(dependencies.getNotificationDetail).toHaveBeenCalledTimes(3);
    expect(document.body.textContent).toContain('glance.newItems:2');
  });

  it('bounds repeated empty detail responses without surfacing an arrival', async () => {
    dependencies.getNotificationDetail.mockResolvedValue({});
    await mountHost();
    await emitArrivals([firstId]);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500);
      });
    }
    expect(dependencies.getNotificationDetail).toHaveBeenCalledTimes(3);
    expect(document.body.textContent).not.toContain('glance.newItems');
  });

  it('retains the same bounded retry behavior for rejected requests', async () => {
    dependencies.getNotificationDetail.mockRejectedValue(new Error('Detail unavailable'));
    await mountHost();
    await emitArrivals([firstId]);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500);
      });
    }
    expect(dependencies.getNotificationDetail).toHaveBeenCalledTimes(3);
    expect(document.body.textContent).not.toContain('glance.newItems');
  });
});
