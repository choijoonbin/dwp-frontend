import type { OwnerWidgetDefinitionKey } from './owner-widget-contracts';
import type {
  OwnerApprovalItem,
  OwnerHrDomainState,
  OwnerMeetingItem,
  OwnerMessagingItem,
  OwnerNotificationCounter,
  OwnerSpaceChangeItem,
  OwnerSpaceResponseItem,
  OwnerWidgetPayload,
  OwnerWidgetPayloadParseResult,
} from './owner-widget-payload-types';

const MAX_ITEMS = 50;
const MAX_COUNTER = 2_147_483_647;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CODE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/u;
const APP_KEY = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const DECIMAL_VERSION = /^[0-9]{1,40}$/u;
const OFFSET_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/u;

type JsonRecord = Record<string, unknown>;

function recordWithKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = []
): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = value as JsonRecord;
  const actual = Object.keys(result);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(result, key)) &&
    actual.every((key) => allowed.has(key)) &&
    actual.length <= allowed.size
    ? result
    : null;
}

function text(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maximum ? normalized : null;
}

function localizedText(value: unknown, maximum: number): string | null {
  return value === null ? null : text(value, maximum);
}

function code(value: unknown): string | null {
  const normalized = text(value, 80);
  return normalized && CODE.test(normalized) ? normalized : null;
}

function count(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_COUNTER
    ? (value as number)
    : null;
}

function version(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : null;
}

function leapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return leapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function timestamp(value: unknown): string | null {
  const normalized = text(value, 48);
  if (!normalized) return null;
  const match = OFFSET_TIMESTAMP.exec(normalized);
  if (!match) return null;
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [
    match[1],
    match[2],
    match[3],
    match[4],
    match[5],
    match[6],
    match[8] ?? '00',
    match[9] ?? '00',
  ].map(Number);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 18 ||
    offsetMinute > 59 ||
    (offsetHour === 18 && offsetMinute !== 0)
  ) {
    return null;
  }
  return Number.isFinite(Date.parse(normalized)) ? normalized : null;
}

function uuid(value: unknown): string | null {
  const normalized = text(value, 36);
  return normalized && UUID.test(normalized) ? normalized : null;
}

function list<T>(value: unknown, parser: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return null;
  const parsed: T[] = [];
  for (const item of value) {
    const result = parser(item);
    if (result === null) return null;
    parsed.push(result);
  }
  return parsed;
}

function uniqueBy<T>(items: readonly T[], key: (item: T) => string): boolean {
  return new Set(items.map(key)).size === items.length;
}

function approvalItem(value: unknown): OwnerApprovalItem | null {
  const item = recordWithKeys(
    value,
    ['id', 'requestNumber', 'title', 'status', 'priority', 'version'],
    ['dueAt']
  );
  if (!item) return null;
  const parsed = {
    id: uuid(item.id),
    requestNumber: text(item.requestNumber, 160),
    title: text(item.title, 500),
    status: code(item.status),
    priority: code(item.priority),
    dueAt: Object.hasOwn(item, 'dueAt') ? timestamp(item.dueAt) : undefined,
    version: version(item.version),
  };
  if (
    !parsed.id ||
    !parsed.requestNumber ||
    !parsed.title ||
    !parsed.status ||
    !parsed.priority ||
    (Object.hasOwn(item, 'dueAt') && !parsed.dueAt) ||
    parsed.version === null
  ) {
    return null;
  }
  return parsed as OwnerApprovalItem;
}

function meetingItem(value: unknown): OwnerMeetingItem | null {
  const item = recordWithKeys(
    value,
    ['id', 'title', 'state', 'attendeeCount', 'version'],
    ['startsAt', 'endsAt']
  );
  if (!item) return null;
  const startsAt = Object.hasOwn(item, 'startsAt') ? timestamp(item.startsAt) : undefined;
  const endsAt = Object.hasOwn(item, 'endsAt') ? timestamp(item.endsAt) : undefined;
  const parsed = {
    id: uuid(item.id),
    title: text(item.title, 500),
    state: code(item.state),
    startsAt,
    endsAt,
    attendeeCount: count(item.attendeeCount),
    version: version(item.version),
  };
  if (
    !parsed.id ||
    !parsed.title ||
    !parsed.state ||
    (Object.hasOwn(item, 'startsAt') && !startsAt) ||
    (Object.hasOwn(item, 'endsAt') && !endsAt) ||
    parsed.attendeeCount === null ||
    parsed.version === null ||
    (startsAt && endsAt && Date.parse(endsAt) < Date.parse(startsAt))
  ) {
    return null;
  }
  return parsed as OwnerMeetingItem;
}

function notificationCounter(value: unknown): OwnerNotificationCounter | null {
  const item = recordWithKeys(value, [
    'appKey',
    'totalUnread',
    'actionableUnread',
    'urgentUnread',
    'lastActivityAt',
  ]);
  if (!item) return null;
  const appKey = text(item.appKey, 64);
  const totalUnread = count(item.totalUnread);
  const actionableUnread = count(item.actionableUnread);
  const urgentUnread = count(item.urgentUnread);
  const lastActivityAt = timestamp(item.lastActivityAt);
  if (
    !appKey ||
    !APP_KEY.test(appKey) ||
    totalUnread === null ||
    actionableUnread === null ||
    urgentUnread === null ||
    actionableUnread > totalUnread ||
    urgentUnread > totalUnread ||
    !lastActivityAt
  ) {
    return null;
  }
  return { appKey, totalUnread, actionableUnread, urgentUnread, lastActivityAt };
}

function localeIsKorean(locale: string | undefined): boolean {
  return locale?.trim().toLowerCase().startsWith('ko') ?? false;
}

function localized(primary: string | null, fallback: string | null): string | null {
  return primary ?? fallback;
}

function spaceChangeItem(value: unknown, locale?: string): OwnerSpaceChangeItem | null {
  const item = recordWithKeys(value, [
    'id',
    'spaceKey',
    'spaceNameKo',
    'spaceNameEn',
    'activityType',
    'titleKo',
    'titleEn',
    'occurredAt',
  ]);
  if (!item) return null;
  const korean = localeIsKorean(locale);
  const spaceNameKo = localizedText(item.spaceNameKo, 240);
  const spaceNameEn = localizedText(item.spaceNameEn, 240);
  const titleKo = localizedText(item.titleKo, 500);
  const titleEn = localizedText(item.titleEn, 500);
  const parsed = {
    id: uuid(item.id),
    spaceKey: code(item.spaceKey),
    spaceNameKo,
    spaceNameEn,
    spaceName: localized(korean ? spaceNameKo : spaceNameEn, korean ? spaceNameEn : spaceNameKo),
    activityType: code(item.activityType),
    titleKo,
    titleEn,
    title: localized(korean ? titleKo : titleEn, korean ? titleEn : titleKo),
    occurredAt: timestamp(item.occurredAt),
  };
  return parsed.id &&
    parsed.spaceKey &&
    parsed.spaceName &&
    parsed.activityType &&
    parsed.title &&
    parsed.occurredAt
    ? (parsed as OwnerSpaceChangeItem)
    : null;
}

function spaceResponseItem(value: unknown, locale?: string): OwnerSpaceResponseItem | null {
  const item = recordWithKeys(value, [
    'id',
    'spaceKey',
    'nameKo',
    'nameEn',
    'memberRole',
    'unreadCount',
    'version',
  ]);
  if (!item) return null;
  const korean = localeIsKorean(locale);
  const nameKo = localizedText(item.nameKo, 240);
  const nameEn = localizedText(item.nameEn, 240);
  const parsed = {
    id: uuid(item.id),
    spaceKey: code(item.spaceKey),
    nameKo,
    nameEn,
    name: localized(korean ? nameKo : nameEn, korean ? nameEn : nameKo),
    memberRole: code(item.memberRole),
    unreadCount: count(item.unreadCount),
    version: version(item.version),
  };
  return parsed.id &&
    parsed.spaceKey &&
    parsed.name &&
    parsed.memberRole &&
    parsed.unreadCount !== null &&
    parsed.version !== null
    ? (parsed as OwnerSpaceResponseItem)
    : null;
}

function messagingItem(value: unknown): OwnerMessagingItem | null {
  const item = recordWithKeys(
    value,
    ['id', 'type', 'name', 'unreadCount', 'version'],
    ['lastActivityAt']
  );
  if (!item) return null;
  const lastActivityAt = Object.hasOwn(item, 'lastActivityAt')
    ? timestamp(item.lastActivityAt)
    : undefined;
  const parsed = {
    id: uuid(item.id),
    type: code(item.type),
    name: text(item.name, 240),
    unreadCount: count(item.unreadCount),
    lastActivityAt,
    version: version(item.version),
  };
  return parsed.id &&
    parsed.type &&
    parsed.name &&
    parsed.unreadCount !== null &&
    parsed.version !== null &&
    (!Object.hasOwn(item, 'lastActivityAt') || Boolean(lastActivityAt))
    ? (parsed as OwnerMessagingItem)
    : null;
}

function hrState(value: unknown): OwnerHrDomainState | null {
  const state = recordWithKeys(value, ['availability'], ['dataOrigin', 'reasonCode']);
  if (!state || !['AVAILABLE', 'UNAVAILABLE'].includes(state.availability as string)) return null;
  const dataOrigin = Object.hasOwn(state, 'dataOrigin') ? code(state.dataOrigin) : undefined;
  const reasonCode = Object.hasOwn(state, 'reasonCode') ? code(state.reasonCode) : undefined;
  if (
    (dataOrigin &&
      !['SOURCE', 'MANUAL', 'REFERENCE', 'MIXED', 'NONE', 'UNKNOWN'].includes(dataOrigin)) ||
    (Object.hasOwn(state, 'dataOrigin') && !dataOrigin) ||
    (Object.hasOwn(state, 'reasonCode') && !reasonCode) ||
    (state.availability === 'AVAILABLE' && !dataOrigin)
  ) {
    return null;
  }
  return { availability: state.availability, dataOrigin, reasonCode } as OwnerHrDomainState;
}

function parseApproval(key: OwnerWidgetDefinitionKey, value: unknown): unknown | null {
  const focus = key === 'approval.focus-queue';
  const payload = recordWithKeys(
    value,
    focus ? ['pendingCount', 'dueTodayCount', 'overdueCount', 'items'] : ['inFlightCount', 'items']
  );
  if (!payload) return null;
  const items = list(payload.items, approvalItem);
  if (!items || !uniqueBy(items, (item) => item.id)) return null;
  if (focus) {
    const pendingCount = count(payload.pendingCount);
    const dueTodayCount = count(payload.dueTodayCount);
    const overdueCount = count(payload.overdueCount);
    return pendingCount !== null && dueTodayCount !== null && overdueCount !== null
      ? { pendingCount, dueTodayCount, overdueCount, items }
      : null;
  }
  const inFlightCount = count(payload.inFlightCount);
  return inFlightCount !== null ? { inFlightCount, items } : null;
}

function parseMeeting(value: unknown): unknown | null {
  const payload = recordWithKeys(value, ['meetingsToday', 'meetingMinutesToday', 'items']);
  if (!payload) return null;
  const meetingsToday = count(payload.meetingsToday);
  const meetingMinutesToday = count(payload.meetingMinutesToday);
  const items = list(payload.items, meetingItem);
  return meetingsToday !== null &&
    meetingMinutesToday !== null &&
    items &&
    uniqueBy(items, (item) => item.id)
    ? { meetingsToday, meetingMinutesToday, items }
    : null;
}

function parseNotification(value: unknown): unknown | null {
  const payload = recordWithKeys(value, ['counterVersion', 'items']);
  if (!payload) return null;
  const counterVersion = text(payload.counterVersion, 40);
  const items = list(payload.items, notificationCounter);
  return counterVersion &&
    DECIMAL_VERSION.test(counterVersion) &&
    items &&
    uniqueBy(items, (item) => item.appKey)
    ? { counterVersion, items }
    : null;
}

function parseSpaceChange(value: unknown, locale?: string): unknown | null {
  const payload = recordWithKeys(value, ['unreadSignals', 'items']);
  if (!payload) return null;
  const unreadSignals = count(payload.unreadSignals);
  const items = list(payload.items, (item) => spaceChangeItem(item, locale));
  return unreadSignals !== null && items && uniqueBy(items, (item) => item.id)
    ? { unreadSignals, items }
    : null;
}

function parseSpaceResponse(value: unknown, locale?: string): unknown | null {
  const payload = recordWithKeys(value, ['pendingRequests', 'reviewQueue', 'items']);
  if (!payload) return null;
  const pendingRequests = count(payload.pendingRequests);
  const reviewQueue = count(payload.reviewQueue);
  const items = list(payload.items, (item) => spaceResponseItem(item, locale));
  return pendingRequests !== null &&
    reviewQueue !== null &&
    items &&
    uniqueBy(items, (item) => item.id)
    ? { pendingRequests, reviewQueue, items }
    : null;
}

function parseMessaging(value: unknown): unknown | null {
  const payload = recordWithKeys(value, ['unreadConversations', 'mentions', 'items']);
  if (!payload) return null;
  const unreadConversations = count(payload.unreadConversations);
  const mentions = count(payload.mentions);
  const items = list(payload.items, messagingItem);
  return unreadConversations !== null &&
    mentions !== null &&
    items &&
    uniqueBy(items, (item) => item.id)
    ? { unreadConversations, mentions, items }
    : null;
}

function parseHr(key: OwnerWidgetDefinitionKey, value: unknown): unknown | null {
  const education = key === 'hr.edu';
  const payload = recordWithKeys(
    value,
    education
      ? ['requiredLearningCount', 'activeGoalCount', 'state']
      : ['teamPendingCount', 'teamTimePendingCount', 'teamAbsencePendingCount', 'state']
  );
  if (!payload) return null;
  const state = hrState(payload.state);
  if (!state) return null;
  if (education) {
    const requiredLearningCount = count(payload.requiredLearningCount);
    const activeGoalCount = count(payload.activeGoalCount);
    return requiredLearningCount !== null && activeGoalCount !== null
      ? { requiredLearningCount, activeGoalCount, state }
      : null;
  }
  const teamPendingCount = count(payload.teamPendingCount);
  const teamTimePendingCount = count(payload.teamTimePendingCount);
  const teamAbsencePendingCount = count(payload.teamAbsencePendingCount);
  return teamPendingCount !== null &&
    teamTimePendingCount !== null &&
    teamAbsencePendingCount !== null
    ? { teamPendingCount, teamTimePendingCount, teamAbsencePendingCount, state }
    : null;
}

export function parseOwnerWidgetPayload<K extends OwnerWidgetDefinitionKey>(
  definitionKey: K,
  payload: unknown,
  locale?: string
): OwnerWidgetPayloadParseResult<K> {
  let value: unknown | null = null;
  if (definitionKey.startsWith('approval.')) value = parseApproval(definitionKey, payload);
  else if (definitionKey.startsWith('meetings.')) value = parseMeeting(payload);
  else if (definitionKey.startsWith('notification.')) value = parseNotification(payload);
  else if (definitionKey === 'space.change-feed') value = parseSpaceChange(payload, locale);
  else if (definitionKey === 'space.response-queue') value = parseSpaceResponse(payload, locale);
  else if (definitionKey.startsWith('messaging.')) value = parseMessaging(payload);
  else if (definitionKey.startsWith('hr.')) value = parseHr(definitionKey, payload);
  return value === null
    ? { ok: false, code: 'MALFORMED_PAYLOAD' }
    : { ok: true, value: value as OwnerWidgetPayload<K> };
}
