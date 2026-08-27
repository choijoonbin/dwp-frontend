export type MeetingCollaborationTab = 'chat' | 'floor';

export type MeetingChatDeliveryState = 'PENDING' | 'DELIVERED' | 'FAILED';

export type MeetingChatMessage = {
  messageId: string;
  clientMessageId?: string;
  sequence: number;
  createdSequence: number;
  participantId: string;
  senderName: string;
  body: string;
  sentAt: string;
  retentionUntil?: string | null;
  deliveryState: MeetingChatDeliveryState;
  isOwn: boolean;
  canDelete: boolean;
  deletedAt?: string | null;
};

export type MeetingChatPanelState = {
  messages: readonly MeetingChatMessage[];
  unreadCount: number;
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  nextSequence?: number;
  sending?: boolean;
  error?: string | null;
  retentionNotice?: string | null;
  disabledReason?: string | null;
  busyMessageIds?: ReadonlySet<string>;
};

export type MeetingFloorRequestState =
  'RAISED' | 'ACKNOWLEDGED' | 'LOWERED' | 'DISMISSED' | 'CLEARED';

export type MeetingFloorRequest = {
  requestId: string;
  sequence: number;
  raisedSequence: number;
  participantId: string;
  participantName: string;
  requestedAt: string;
  state: MeetingFloorRequestState;
  position: number;
  mine: boolean;
  canLower: boolean;
  canAcknowledge: boolean;
  canDismiss: boolean;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
};

export type MeetingFloorPanelState = {
  requests: readonly MeetingFloorRequest[];
  nextSequence?: number;
  hasMore?: boolean;
  loading: boolean;
  loadingMore?: boolean;
  mutating?: boolean;
  error?: string | null;
  disabledReason?: string | null;
  busyRequestIds?: ReadonlySet<string>;
};

export type MeetingCollaborationPermissions = {
  canReadChat: boolean;
  canSendChat: boolean;
  canModerateChat: boolean;
  canViewFloorQueue: boolean;
  canRequestFloor: boolean;
  canModerateFloor: boolean;
};

export type MeetingCollaborationLabels = {
  panelTitle: string;
  close: string;
  chatTab: string;
  floorTab: string;
  unreadMessages: (count: number) => string;
  pendingFloorRequests: (count: number) => string;
  chatDescription: string;
  chatLoading: string;
  chatEmptyTitle: string;
  chatEmptyDescription: string;
  chatPermissionTitle: string;
  chatPermissionDescription: string;
  loadMoreMessages: string;
  loadingMoreMessages: string;
  chatErrorTitle: string;
  retry: string;
  deletedMessage: string;
  pendingMessage: string;
  failedMessage: string;
  retryMessage: string;
  deleteMessage: string;
  confirmDeleteMessage: string;
  cancelDeleteMessage: string;
  timestamp: (value: string) => string;
  chatPlaceholder: string;
  sendMessage: string;
  sendingMessage: string;
  charactersRemaining: (count: number) => string;
  floorDescription: string;
  floorLoading: string;
  floorEmptyTitle: string;
  floorEmptyDescription: string;
  floorPermissionTitle: string;
  floorPermissionDescription: string;
  floorErrorTitle: string;
  requestFloor: string;
  withdrawRequest: string;
  requestPending: string;
  ownQueuePosition: (position: number) => string;
  raised: string;
  acknowledged: string;
  lowered: string;
  dismissed: string;
  cleared: string;
  acknowledgeRequest: string;
  dismissRequest: string;
  clearFloorQueue: string;
  confirmClearFloorQueue: string;
  cancelClearFloorQueue: string;
  loadMoreFloorRequests: string;
  loadingMoreFloorRequests: string;
  requestedAt: (value: string) => string;
  participantInitials: (name: string) => string;
};

export type MeetingCollaborationActions = {
  onClose: () => void;
  onTabChange: (tab: MeetingCollaborationTab) => void;
  onMarkChatRead: () => void;
  onLoadMoreMessages: (afterSequence: number) => void;
  onRetryChat: () => void;
  onSendChat: (body: string, clientMessageId: string) => Promise<void>;
  onRetryMessage: (messageId: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onRetryFloor: () => void;
  onLoadMoreFloorRequests: (afterSequence: number) => void;
  onRequestFloor: () => void;
  onLowerHand: (requestId: string) => void;
  onAcknowledgeFloor: (requestId: string) => void;
  onDismissFloor: (requestId: string) => void;
  onClearFloorQueue: () => void;
};

export function countActionableFloorRequests(requests: readonly MeetingFloorRequest[]): number {
  return requests.filter((request) => request.state === 'RAISED').length;
}

export function findOwnFloorRequest(
  requests: readonly MeetingFloorRequest[]
): MeetingFloorRequest | undefined {
  return requests.find(
    (request) => request.mine && (request.state === 'RAISED' || request.state === 'ACKNOWLEDGED')
  );
}

export function normalizeMeetingChatDraft(value: string, maxLength: number): string {
  return value.trim().slice(0, Math.max(0, maxLength));
}
