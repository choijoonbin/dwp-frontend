// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MeetingCollaborationPanel,
  type MeetingCollaborationPanelProps,
} from './meeting-collaboration-panel';
import {
  countActionableFloorRequests,
  findOwnFloorRequest,
  normalizeMeetingChatDraft,
  type MeetingChatPanelState,
  type MeetingCollaborationActions,
  type MeetingCollaborationLabels,
  type MeetingCollaborationPermissions,
  type MeetingFloorPanelState,
  type MeetingFloorRequest,
} from './meeting-collaboration-model';

const labels: MeetingCollaborationLabels = {
  panelTitle: 'Meeting collaboration',
  close: 'Close collaboration',
  chatTab: 'Chat',
  floorTab: 'Speaking queue',
  unreadMessages: (count) => `${count} unread messages`,
  pendingFloorRequests: (count) => `${count} pending requests`,
  chatDescription: 'Messages retained by meeting policy',
  chatLoading: 'Loading messages',
  chatEmptyTitle: 'No messages yet',
  chatEmptyDescription: 'Messages will appear here.',
  chatPermissionTitle: 'Chat is unavailable',
  chatPermissionDescription: 'Policy does not allow access.',
  loadMoreMessages: 'Load more messages',
  loadingMoreMessages: 'Loading more messages',
  chatErrorTitle: 'Messages could not be loaded',
  retry: 'Retry',
  deletedMessage: 'Message removed by a moderator',
  pendingMessage: 'Sending',
  failedMessage: 'Message failed',
  retryMessage: 'Retry message',
  deleteMessage: 'Delete message',
  confirmDeleteMessage: 'Confirm delete',
  cancelDeleteMessage: 'Cancel delete',
  timestamp: (value) => value,
  chatPlaceholder: 'Write a message',
  sendMessage: 'Send',
  sendingMessage: 'Sending message',
  charactersRemaining: (count) => `${count} characters remaining`,
  floorDescription: 'Current requests in speaking order',
  floorLoading: 'Loading speaking requests',
  floorEmptyTitle: 'No speaking requests',
  floorEmptyDescription: 'Raised hands will appear here.',
  floorPermissionTitle: 'Speaking queue is unavailable',
  floorPermissionDescription: 'Policy does not allow access.',
  floorErrorTitle: 'Speaking requests could not be loaded',
  requestFloor: 'Raise hand',
  withdrawRequest: 'Lower hand',
  requestPending: 'Your hand is raised',
  ownQueuePosition: (position) => `Queue position ${position}`,
  raised: 'Raised',
  acknowledged: 'Called on',
  lowered: 'Lowered',
  dismissed: 'Dismissed',
  cleared: 'Cleared',
  acknowledgeRequest: 'Call on participant',
  dismissRequest: 'Dismiss request',
  clearFloorQueue: 'Clear all',
  confirmClearFloorQueue: 'Confirm clear',
  cancelClearFloorQueue: 'Cancel clear',
  loadMoreFloorRequests: 'Load more requests',
  loadingMoreFloorRequests: 'Loading more requests',
  requestedAt: (value) => `Requested ${value}`,
  participantInitials: (name) => name.slice(0, 2),
};

const permissions: MeetingCollaborationPermissions = {
  canReadChat: true,
  canSendChat: true,
  canModerateChat: true,
  canViewFloorQueue: true,
  canRequestFloor: true,
  canModerateFloor: true,
};

const chat: MeetingChatPanelState = {
  messages: [
    {
      messageId: 'message-1',
      sequence: 11,
      createdSequence: 11,
      participantId: 'participant-1',
      senderName: '박지민',
      body: '결정 사항을 회의록에 남겨 주세요.',
      sentAt: '2026-08-27T08:00:00Z',
      retentionUntil: '2026-09-26T08:00:00Z',
      deliveryState: 'DELIVERED',
      isOwn: false,
      canDelete: true,
    },
    {
      messageId: 'message-2',
      sequence: 12,
      createdSequence: 9,
      participantId: 'participant-2',
      senderName: 'Alex Morgan',
      body: '',
      sentAt: '2026-08-27T08:01:00Z',
      retentionUntil: '2026-09-26T08:01:00Z',
      deliveryState: 'DELIVERED',
      isOwn: false,
      canDelete: false,
      deletedAt: '2026-08-27T08:02:00Z',
    },
  ],
  unreadCount: 2,
  loading: false,
  hasMore: true,
  nextSequence: 12,
  retentionNotice: 'Messages are retained for 30 days.',
};

const floorRequests: readonly MeetingFloorRequest[] = [
  {
    requestId: 'hand-own',
    sequence: 31,
    raisedSequence: 31,
    participantId: 'participant-own',
    participantName: '나',
    requestedAt: '2026-08-27T08:03:00Z',
    state: 'RAISED',
    position: 1,
    mine: true,
    canLower: true,
    canAcknowledge: false,
    canDismiss: false,
  },
  {
    requestId: 'hand-other',
    sequence: 32,
    raisedSequence: 32,
    participantId: 'participant-other',
    participantName: '김서연',
    requestedAt: '2026-08-27T08:04:00Z',
    state: 'RAISED',
    position: 2,
    mine: false,
    canLower: false,
    canAcknowledge: true,
    canDismiss: true,
  },
];

const floor: MeetingFloorPanelState = {
  requests: floorRequests,
  nextSequence: 32,
  hasMore: true,
  loading: false,
};

function createActions(): MeetingCollaborationActions {
  return {
    onClose: vi.fn(),
    onTabChange: vi.fn(),
    onMarkChatRead: vi.fn(),
    onLoadMoreMessages: vi.fn(),
    onRetryChat: vi.fn(),
    onSendChat: vi.fn().mockResolvedValue(undefined),
    onRetryMessage: vi.fn(),
    onDeleteMessage: vi.fn(),
    onRetryFloor: vi.fn(),
    onLoadMoreFloorRequests: vi.fn(),
    onRequestFloor: vi.fn(),
    onLowerHand: vi.fn(),
    onAcknowledgeFloor: vi.fn(),
    onDismissFloor: vi.fn(),
    onClearFloorQueue: vi.fn(),
  };
}

let root: Root | null;
let container: HTMLDivElement | null;

async function mount(
  activeTab: 'chat' | 'floor',
  actions: MeetingCollaborationActions,
  overrides: Partial<MeetingCollaborationPanelProps> = {}
) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      createElement(MeetingCollaborationPanel, {
        activeTab,
        chat,
        floor,
        permissions,
        labels,
        actions,
        maxMessageLength: 4_000,
        ...overrides,
      })
    );
  });
}

function buttonNamed(name: string): HTMLButtonElement {
  const button = [...(container?.querySelectorAll('button') ?? [])].find(
    (candidate) => candidate.textContent?.trim() === name || candidate.ariaLabel === name
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${name}`);
  return button;
}

describe('meeting collaboration panel', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    root = null;
    container = null;
  });

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = null;
    container?.remove();
    vi.clearAllMocks();
  });

  it('renders governed persistent chat states and submits a trimmed message', async () => {
    const actions = createActions();
    await mount('chat', actions);

    expect(container?.textContent).toContain('Messages are retained for 30 days.');
    expect(container?.textContent).toContain('결정 사항을 회의록에 남겨 주세요.');
    expect(container?.textContent).toContain('Message removed by a moderator');
    expect(actions.onMarkChatRead).toHaveBeenCalledOnce();
    await act(async () => buttonNamed('Load more messages').click());
    await act(async () => buttonNamed('Delete message').click());
    expect(actions.onDeleteMessage).not.toHaveBeenCalled();
    await act(async () => buttonNamed('Confirm delete').click());
    expect(actions.onLoadMoreMessages).toHaveBeenCalledWith(12);
    expect(actions.onDeleteMessage).toHaveBeenCalledWith('message-1');

    const textarea = container?.querySelector('textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('Composer not found');
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      valueSetter?.call(textarea, '  서버에 남는 메시지  ');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => buttonNamed('Send').click());

    expect(actions.onSendChat).toHaveBeenCalledWith('서버에 남는 메시지', expect.any(String));
  });

  it('exposes server-authorized host moderation and own-hand callbacks', async () => {
    const actions = createActions();
    await mount('floor', actions);

    expect(container?.textContent).toContain('2 pending requests');
    await act(async () => buttonNamed('Lower hand').click());
    await act(async () => buttonNamed('Call on participant').click());
    await act(async () => buttonNamed('Dismiss request').click());
    await act(async () => buttonNamed('Load more requests').click());
    await act(async () => buttonNamed('Clear all').click());
    expect(actions.onClearFloorQueue).not.toHaveBeenCalled();
    await act(async () => buttonNamed('Confirm clear').click());

    expect(actions.onLowerHand).toHaveBeenCalledWith('hand-own');
    expect(actions.onAcknowledgeFloor).toHaveBeenCalledWith('hand-other');
    expect(actions.onDismissFloor).toHaveBeenCalledWith('hand-other');
    expect(actions.onLoadMoreFloorRequests).toHaveBeenCalledWith(32);
    expect(actions.onClearFloorQueue).toHaveBeenCalledOnce();
  });

  it('supports arrow-key tab navigation while leaving tab state controlled', async () => {
    const actions = createActions();
    await mount('chat', actions);
    const chatTab = buttonNamed('2 unread messages');

    await act(async () => {
      chatTab.focus();
      chatTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    expect(actions.onTabChange).toHaveBeenCalledWith('floor');
    expect((document.activeElement as HTMLButtonElement | null)?.ariaLabel).toBe(
      '2 pending requests'
    );
    expect(chatTab.getAttribute('aria-controls')).toBeTruthy();
  });

  it('keeps permission and policy failures explicit without inventing content', async () => {
    const actions = createActions();
    await mount('chat', actions, {
      permissions: { ...permissions, canReadChat: false },
      disabled: true,
      disabledReason: 'Chat is blocked for this protected meeting.',
    });

    expect(container?.textContent).toContain('Chat is blocked for this protected meeting.');
    expect(container?.textContent).toContain('Chat is unavailable');
    expect(container?.querySelector('textarea')).toBeNull();
  });

  it('renders a retryable partial chat failure without replacing retained messages', async () => {
    const actions = createActions();
    await mount('chat', actions, {
      chat: { ...chat, unreadCount: 0, error: 'The message stream is temporarily unavailable.' },
    });

    expect(container?.textContent).toContain('The message stream is temporarily unavailable.');
    expect(container?.textContent).toContain('결정 사항을 회의록에 남겨 주세요.');
    await act(async () => buttonNamed('Retry').click());
    expect(actions.onRetryChat).toHaveBeenCalledOnce();
  });

  it('announces queue loading as an active operation', async () => {
    const actions = createActions();
    await mount('floor', actions, {
      floor: { ...floor, requests: [], loading: true },
    });
    expect(container?.textContent).toContain('Loading speaking requests');
    expect(container?.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('renders an intentional empty chat state with the composer still available', async () => {
    const actions = createActions();
    await mount('chat', actions, {
      chat: { ...chat, messages: [], unreadCount: 0, hasMore: false, retentionNotice: null },
    });

    expect(container?.textContent).toContain('No messages yet');
    expect(container?.querySelector('textarea')).not.toBeNull();
  });
});

describe('meeting collaboration model', () => {
  it('uses canonical active hand states for queue counts and own request lookup', () => {
    const acknowledged: MeetingFloorRequest = {
      ...floorRequests[0],
      state: 'ACKNOWLEDGED',
    };
    expect(countActionableFloorRequests([acknowledged, floorRequests[1]])).toBe(1);
    expect(findOwnFloorRequest([acknowledged, floorRequests[1]])?.requestId).toBe('hand-own');
  });

  it('trims only transport-edge whitespace and enforces the server-provided limit', () => {
    expect(normalizeMeetingChatDraft('  first\nsecond  ', 9)).toBe('first\nsec');
    expect(normalizeMeetingChatDraft('  ', 4)).toBe('');
  });
});
