// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import type { VideoMeetingEffectivePermissions } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type {
  VideoMeetingChatMessage,
  VideoMeetingCollaborationPage,
  VideoMeetingHandRequest,
} from '@dwp-frontend/shared-utils/api/video-meeting-collaboration-api';

import type { MeetingCollaborationPanelProps } from './meeting-collaboration-panel';
import { MeetingCollaborationRuntime } from './meeting-collaboration-runtime';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  panel: vi.fn(),
  getChatMessages: vi.fn(),
  getHandRequests: vi.fn(),
  sendChatMessage: vi.fn(),
  deleteChatMessage: vi.fn(),
  raiseHand: vi.fn(),
  lowerHand: vi.fn(),
  acknowledgeHand: vi.fn(),
  dismissHand: vi.fn(),
  clearHandRequests: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({ useQuery: mocks.useQuery }));

vi.mock('@dwp-frontend/shared-utils/api/video-meeting-collaboration-api', () => ({
  getVideoMeetingChatMessages: mocks.getChatMessages,
  getVideoMeetingHandRequests: mocks.getHandRequests,
  sendVideoMeetingChatMessage: mocks.sendChatMessage,
  deleteVideoMeetingChatMessage: mocks.deleteChatMessage,
  raiseVideoMeetingHand: mocks.raiseHand,
  lowerVideoMeetingHand: mocks.lowerHand,
  acknowledgeVideoMeetingHand: mocks.acknowledgeHand,
  dismissVideoMeetingHand: mocks.dismissHand,
  clearVideoMeetingHandRequests: mocks.clearHandRequests,
}));

vi.mock('./meeting-collaboration-panel', () => ({
  MeetingCollaborationPanel: (props: MeetingCollaborationPanelProps) => {
    mocks.panel(props);
    return null;
  },
}));

vi.mock('./meeting-components', () => ({
  formatMeetingTime: (value: string) => value,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

type QueryState<T> = {
  data?: VideoMeetingCollaborationPage<T>;
  error?: unknown;
  isError: boolean;
  isLoading: boolean;
  isFetching: boolean;
  refetch: ReturnType<typeof vi.fn>;
};

type ObservedQueryOptions = {
  queryKey: readonly unknown[];
  enabled: boolean;
  refetchInterval: number | false;
  retry: number | ((failureCount: number, error: unknown) => boolean);
};

const enabledPermissions: VideoMeetingEffectivePermissions = {
  microphone: true,
  camera: true,
  screenShare: true,
  participantList: true,
  chat: true,
  reactions: true,
  handRaise: true,
};

const emptyPage = <T>(): VideoMeetingCollaborationPage<T> => ({
  items: [],
  nextSequence: 0,
  hasMore: false,
});

function queryState<T>(data?: VideoMeetingCollaborationPage<T>): QueryState<T> {
  return {
    data,
    isError: false,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  };
}

function chatMessage(
  messageId: string,
  sequence: number,
  text: string,
  mine = false
): VideoMeetingChatMessage {
  return {
    messageId,
    sequence,
    createdSequence: sequence,
    sender: {
      participantId: mine ? 'participant-viewer' : 'participant-peer',
      userId: mine ? 7 : 8,
      displayName: mine ? 'Viewer' : 'Peer',
      participantRole: 'ATTENDEE',
    },
    state: 'ACTIVE',
    text,
    sentAt: `2026-08-27T08:00:${String(sequence).padStart(2, '0')}Z`,
    retentionUntil: '2026-09-26T08:00:00Z',
    mine,
    canDelete: mine,
  };
}

let root: Root | null;
let container: HTMLDivElement | null;
let chatQuery: QueryState<VideoMeetingChatMessage>;
let floorQuery: QueryState<VideoMeetingHandRequest>;

type RuntimeProps = Parameters<typeof MeetingCollaborationRuntime>[0];

const baseProps: RuntimeProps = {
  meetingId: 'meeting-runtime-1',
  authorizationScope: 'tenant:1:user:7:revision:1',
  activeTab: null,
  meetingLive: true,
  canModerate: false,
  permissions: enabledPermissions,
  onClose: vi.fn(),
  onTabChange: vi.fn(),
};

function latestQueryOptions(stream: 'chat' | 'floor'): ObservedQueryOptions {
  const match = [...mocks.useQuery.mock.calls]
    .reverse()
    .map(([options]) => options as ObservedQueryOptions)
    .find((options) => options.queryKey.at(-1) === stream);
  if (!match) throw new Error(`Query options not observed for ${stream}`);
  return match;
}

function latestPanelProps(): MeetingCollaborationPanelProps {
  const latest = mocks.panel.mock.calls.at(-1)?.[0] as MeetingCollaborationPanelProps | undefined;
  if (!latest) throw new Error('Collaboration panel props were not observed');
  return latest;
}

async function renderRuntime(overrides: Partial<RuntimeProps> = {}) {
  if (!container) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => {
    root?.render(createElement(MeetingCollaborationRuntime, { ...baseProps, ...overrides }));
  });
}

describe('meeting collaboration runtime', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    root = null;
    container = null;
    chatQuery = queryState(emptyPage<VideoMeetingChatMessage>());
    floorQuery = queryState(emptyPage<VideoMeetingHandRequest>());
    mocks.useQuery.mockImplementation((options: ObservedQueryOptions) =>
      options.queryKey.at(-1) === 'chat' ? chatQuery : floorQuery
    );
    mocks.sendChatMessage.mockReset();
    mocks.panel.mockClear();
  });

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = null;
    container?.remove();
    container = null;
    vi.clearAllMocks();
  });

  it('keeps both governed streams enabled and polling while the panel UI is closed', async () => {
    await renderRuntime({ activeTab: null });

    expect(latestQueryOptions('chat')).toMatchObject({
      enabled: true,
      refetchInterval: 2_000,
    });
    expect(latestQueryOptions('floor')).toMatchObject({
      enabled: true,
      refetchInterval: 2_000,
    });
    expect(latestQueryOptions('chat').retry).toBeTypeOf('function');
    expect(
      (latestQueryOptions('chat').retry as (count: number, error: unknown) => boolean)(
        0,
        new HttpError('Forbidden', 403)
      )
    ).toBe(false);
    expect(mocks.panel).not.toHaveBeenCalled();
    expect(container?.childElementCount).toBe(0);
  });

  it('passes the active tab, effective permissions, and host moderation to the panel', async () => {
    const permissions = { ...enabledPermissions, chat: false, handRaise: true };

    await renderRuntime({ activeTab: 'floor', canModerate: true, permissions });

    expect(latestQueryOptions('chat').enabled).toBe(false);
    expect(latestQueryOptions('floor').enabled).toBe(true);
    expect(latestPanelProps()).toMatchObject({
      activeTab: 'floor',
      disabled: false,
      permissions: {
        canReadChat: false,
        canSendChat: false,
        canModerateChat: true,
        canViewFloorQueue: true,
        canRequestFloor: true,
        canModerateFloor: true,
      },
      labels: { close: 'room.controls.floorClose' },
    });
    expect(container?.querySelector('.dwp-meeting-side-panel--collaboration')).not.toBeNull();
  });

  it('preserves an optimistic message when a polling response arrives before send completes', async () => {
    let resolveSend: ((message: VideoMeetingChatMessage) => void) | undefined;
    const pendingSend = new Promise<VideoMeetingChatMessage>((resolve) => {
      resolveSend = resolve;
    });
    mocks.sendChatMessage.mockReturnValue(pendingSend);
    await renderRuntime({ activeTab: 'chat' });

    let sendPromise: Promise<void> | undefined;
    await act(async () => {
      sendPromise = latestPanelProps().actions.onSendChat(
        'The optimistic message remains visible.',
        'client-message-1234'
      );
      await Promise.resolve();
    });
    expect(latestPanelProps().chat.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageId: 'pending:client-message-1234',
          deliveryState: 'PENDING',
        }),
      ])
    );

    chatQuery = queryState({
      items: [chatMessage('server-peer-1', 1, 'A message from the server poll.')],
      nextSequence: 1,
      hasMore: false,
    });
    await renderRuntime({ activeTab: 'chat' });

    expect(latestPanelProps().chat.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ messageId: 'server-peer-1', deliveryState: 'DELIVERED' }),
        expect.objectContaining({
          messageId: 'pending:client-message-1234',
          deliveryState: 'PENDING',
        }),
      ])
    );

    await act(async () => {
      resolveSend?.(
        chatMessage('server-own-2', 2, 'The optimistic message remains visible.', true)
      );
      await sendPromise;
    });
    expect(latestPanelProps().chat.messages.map((message) => message.messageId)).toEqual([
      'server-peer-1',
      'server-own-2',
    ]);
  });

  it('redacts chat and disables its stream immediately after an authority denial', async () => {
    chatQuery = queryState({
      items: [chatMessage('sensitive-message', 1, 'Confidential room text')],
      nextSequence: 1,
      hasMore: false,
    });
    await renderRuntime({ activeTab: 'chat' });
    expect(latestPanelProps().chat.messages[0]?.body).toBe('Confidential room text');

    chatQuery = {
      ...queryState<VideoMeetingChatMessage>(),
      error: new HttpError('Forbidden', 403),
      isError: true,
    };
    await renderRuntime({ activeTab: 'chat' });

    expect(latestPanelProps().chat.messages).toEqual([]);
    expect(latestPanelProps().permissions.canReadChat).toBe(false);
    expect(latestPanelProps().permissions.canSendChat).toBe(false);
    expect(latestQueryOptions('chat').enabled).toBe(false);
    expect(JSON.stringify(latestPanelProps())).not.toContain('Confidential room text');
  });
});
