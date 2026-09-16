import type { OwnerWidgetDefinitionKey } from './owner-widget-contracts';

export type OwnerApprovalItem = Readonly<{
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  priority: string;
  dueAt?: string;
  version: number;
}>;

export type OwnerApprovalFocusQueuePayload = Readonly<{
  pendingCount: number;
  dueTodayCount: number;
  overdueCount: number;
  items: readonly OwnerApprovalItem[];
}>;

export type OwnerApprovalMyRequestsPayload = Readonly<{
  inFlightCount: number;
  items: readonly OwnerApprovalItem[];
}>;

export type OwnerMeetingItem = Readonly<{
  id: string;
  title: string;
  state: string;
  startsAt?: string;
  endsAt?: string;
  attendeeCount: number;
  version: number;
}>;

export type OwnerMeetingPayload = Readonly<{
  meetingsToday: number;
  meetingMinutesToday: number;
  items: readonly OwnerMeetingItem[];
}>;

export type OwnerNotificationCounter = Readonly<{
  appKey: string;
  totalUnread: number;
  actionableUnread: number;
  urgentUnread: number;
  lastActivityAt: string;
}>;

export type OwnerNotificationPayload = Readonly<{
  counterVersion: string;
  items: readonly OwnerNotificationCounter[];
}>;

export type OwnerSpaceChangeItem = Readonly<{
  id: string;
  spaceKey: string;
  spaceNameKo: string | null;
  spaceNameEn: string | null;
  spaceName: string;
  activityType: string;
  titleKo: string | null;
  titleEn: string | null;
  title: string;
  occurredAt: string;
}>;

export type OwnerSpaceChangeFeedPayload = Readonly<{
  unreadSignals: number;
  items: readonly OwnerSpaceChangeItem[];
}>;

export type OwnerSpaceResponseItem = Readonly<{
  id: string;
  spaceKey: string;
  nameKo: string | null;
  nameEn: string | null;
  name: string;
  memberRole: string;
  unreadCount: number;
  version: number;
}>;

export type OwnerSpaceResponseQueuePayload = Readonly<{
  pendingRequests: number;
  reviewQueue: number;
  items: readonly OwnerSpaceResponseItem[];
}>;

export type OwnerMessagingItem = Readonly<{
  id: string;
  type: string;
  name: string;
  unreadCount: number;
  lastActivityAt?: string;
  version: number;
}>;

export type OwnerMessagingPayload = Readonly<{
  unreadConversations: number;
  mentions: number;
  items: readonly OwnerMessagingItem[];
}>;

export type OwnerHrDomainState = Readonly<{
  availability: 'AVAILABLE' | 'UNAVAILABLE';
  dataOrigin?: 'SOURCE' | 'MANUAL' | 'REFERENCE' | 'MIXED' | 'NONE' | 'UNKNOWN';
  reasonCode?: string;
}>;

export type OwnerHrEducationPayload = Readonly<{
  requiredLearningCount: number;
  activeGoalCount: number;
  state: OwnerHrDomainState;
}>;

export type OwnerHrTeamPulsePayload = Readonly<{
  teamPendingCount: number;
  teamTimePendingCount: number;
  teamAbsencePendingCount: number;
  state: OwnerHrDomainState;
}>;

export type OwnerWidgetPayloadMap = Readonly<{
  'approval.focus-queue': OwnerApprovalFocusQueuePayload;
  'approval.my-requests': OwnerApprovalMyRequestsPayload;
  'meetings.next-prep': OwnerMeetingPayload;
  'meetings.followup-candidates': OwnerMeetingPayload;
  'notification.app-badges': OwnerNotificationPayload;
  'notification.response-queue': OwnerNotificationPayload;
  'space.change-feed': OwnerSpaceChangeFeedPayload;
  'space.response-queue': OwnerSpaceResponseQueuePayload;
  'messaging.response-queue': OwnerMessagingPayload;
  'messaging.change-feed': OwnerMessagingPayload;
  'hr.edu': OwnerHrEducationPayload;
  'hr.team-pulse': OwnerHrTeamPulsePayload;
}>;

export type OwnerWidgetPayload<K extends OwnerWidgetDefinitionKey> = OwnerWidgetPayloadMap[K];

export type OwnerWidgetPayloadParseResult<K extends OwnerWidgetDefinitionKey> =
  | Readonly<{ ok: true; value: OwnerWidgetPayload<K> }>
  | Readonly<{ ok: false; code: 'MALFORMED_PAYLOAD' }>;
