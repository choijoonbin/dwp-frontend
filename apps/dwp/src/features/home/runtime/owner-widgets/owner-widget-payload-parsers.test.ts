import { describe, expect, it } from 'vitest';
import { OWNER_WIDGET_DEFINITION_KEYS } from './owner-widget-contracts';
import type { OwnerWidgetDefinitionKey } from './owner-widget-contracts';
import { parseOwnerWidgetPayload } from './owner-widget-payload-parsers';

const ID_1 = '11111111-1111-4111-8111-111111111111';
const ID_2 = '22222222-2222-4222-8222-222222222222';
const AT = '2026-09-16T06:10:30.123Z';

const approvalItem = {
  id: ID_1,
  requestNumber: 'APR-2026-0042',
  title: '분기 예산 승인',
  status: 'PENDING',
  priority: 'HIGH',
  dueAt: AT,
  version: 3,
};

const meetingItem = {
  id: ID_1,
  title: '제품 운영 검토',
  state: 'SCHEDULED',
  startsAt: '2026-09-16T15:00:00+09:00',
  endsAt: '2026-09-16T16:00:00+09:00',
  attendeeCount: 8,
  version: 2,
};

const notificationItem = {
  appKey: 'approvals',
  totalUnread: 5,
  actionableUnread: 3,
  urgentUnread: 1,
  lastActivityAt: AT,
};

const spaceChangeItem = {
  id: ID_1,
  spaceKey: 'product-ops',
  spaceNameKo: '제품 운영',
  spaceNameEn: 'Product operations',
  activityType: 'DOCUMENT_UPDATED',
  titleKo: '운영 계획이 변경되었습니다',
  titleEn: 'The operating plan changed',
  occurredAt: AT,
};

const spaceResponseItem = {
  id: ID_1,
  spaceKey: 'product-ops',
  nameKo: null,
  nameEn: 'Product operations',
  memberRole: 'EDITOR',
  unreadCount: 2,
  version: 4,
};

const messagingItem = {
  id: ID_1,
  type: 'GROUP',
  name: '제품 운영 대화방',
  unreadCount: 4,
  lastActivityAt: AT,
  version: 5,
};

const availableHrState = {
  availability: 'AVAILABLE',
  dataOrigin: 'SOURCE',
};

const VALID_PAYLOADS: Readonly<Record<OwnerWidgetDefinitionKey, unknown>> = {
  'approval.focus-queue': {
    pendingCount: 7,
    dueTodayCount: 2,
    overdueCount: 1,
    items: [approvalItem],
  },
  'approval.my-requests': { inFlightCount: 3, items: [approvalItem] },
  'meetings.next-prep': {
    meetingsToday: 3,
    meetingMinutesToday: 120,
    items: [meetingItem],
  },
  'meetings.followup-candidates': {
    meetingsToday: 2,
    meetingMinutesToday: 75,
    items: [meetingItem],
  },
  'notification.app-badges': { counterVersion: '42', items: [notificationItem] },
  'notification.response-queue': { counterVersion: '42', items: [notificationItem] },
  'space.change-feed': { unreadSignals: 3, items: [spaceChangeItem] },
  'space.response-queue': {
    pendingRequests: 2,
    reviewQueue: 1,
    items: [spaceResponseItem],
  },
  'messaging.response-queue': {
    unreadConversations: 4,
    mentions: 1,
    items: [messagingItem],
  },
  'messaging.change-feed': {
    unreadConversations: 4,
    mentions: 1,
    items: [messagingItem],
  },
  'hr.edu': {
    requiredLearningCount: 2,
    activeGoalCount: 1,
    state: availableHrState,
  },
  'hr.team-pulse': {
    teamPendingCount: 4,
    teamTimePendingCount: 2,
    teamAbsencePendingCount: 1,
    state: availableHrState,
  },
};

function parse<K extends OwnerWidgetDefinitionKey>(key: K, payload: unknown, locale?: string) {
  return parseOwnerWidgetPayload(key, payload, locale);
}

describe('owner widget payload parsers', () => {
  it('strictly parses every canonical owner payload', () => {
    expect(OWNER_WIDGET_DEFINITION_KEYS).toHaveLength(12);
    for (const key of OWNER_WIDGET_DEFINITION_KEYS) {
      expect(parse(key, VALID_PAYLOADS[key], 'ko-KR')).toMatchObject({ ok: true });
    }
  });

  it('normalizes localized Space labels with deterministic fallback', () => {
    const english = parse('space.change-feed', VALID_PAYLOADS['space.change-feed'], 'en-US');
    const korean = parse('space.change-feed', VALID_PAYLOADS['space.change-feed'], 'ko-KR');
    const fallback = parse('space.response-queue', VALID_PAYLOADS['space.response-queue'], 'ko');

    expect(english.ok && english.value.items[0]?.spaceName).toBe('Product operations');
    expect(english.ok && english.value.items[0]?.title).toBe('The operating plan changed');
    expect(korean.ok && korean.value.items[0]?.spaceName).toBe('제품 운영');
    expect(korean.ok && korean.value.items[0]?.title).toBe('운영 계획이 변경되었습니다');
    expect(fallback.ok && fallback.value.items[0]?.name).toBe('Product operations');
  });

  it('rejects unknown top-level and item fields', () => {
    expect(
      parse('approval.focus-queue', {
        ...(VALID_PAYLOADS['approval.focus-queue'] as object),
        injectedHtml: '<script />',
      })
    ).toEqual({ ok: false, code: 'MALFORMED_PAYLOAD' });
    expect(
      parse('approval.focus-queue', {
        pendingCount: 1,
        dueTodayCount: 0,
        overdueCount: 0,
        items: [{ ...approvalItem, deepLink: 'https://example.invalid' }],
      })
    ).toEqual({ ok: false, code: 'MALFORMED_PAYLOAD' });
  });

  it('enforces item, identity, string, integer and duplicate bounds', () => {
    const tooManyItems = Array.from({ length: 51 }, (_, index) => ({
      ...approvalItem,
      id: `${String(index + 1).padStart(8, '0')}-1111-4111-8111-111111111111`,
    }));
    expect(parse('approval.my-requests', { inFlightCount: 51, items: tooManyItems })).toEqual({
      ok: false,
      code: 'MALFORMED_PAYLOAD',
    });
    expect(
      parse('approval.my-requests', {
        inFlightCount: 2,
        items: [approvalItem, { ...approvalItem }],
      })
    ).toEqual({ ok: false, code: 'MALFORMED_PAYLOAD' });
    expect(
      parse('approval.my-requests', {
        inFlightCount: -1,
        items: [{ ...approvalItem, title: 'x'.repeat(501) }],
      })
    ).toEqual({ ok: false, code: 'MALFORMED_PAYLOAD' });
    expect(
      parse('approval.my-requests', {
        inFlightCount: 1,
        items: [{ ...approvalItem, id: 'not-a-uuid', version: Number.MAX_SAFE_INTEGER + 1 }],
      })
    ).toEqual({ ok: false, code: 'MALFORMED_PAYLOAD' });
  });

  it('requires real offset timestamps and chronological meetings', () => {
    expect(
      parse('approval.my-requests', {
        inFlightCount: 1,
        items: [{ ...approvalItem, dueAt: '2026-02-30T10:00:00Z' }],
      })
    ).toEqual({ ok: false, code: 'MALFORMED_PAYLOAD' });
    expect(
      parse('meetings.next-prep', {
        meetingsToday: 1,
        meetingMinutesToday: 30,
        items: [
          {
            ...meetingItem,
            startsAt: '2026-09-16T16:00:00+09:00',
            endsAt: '2026-09-16T15:00:00+09:00',
          },
        ],
      })
    ).toEqual({ ok: false, code: 'MALFORMED_PAYLOAD' });
    expect(
      parse('messaging.change-feed', {
        unreadConversations: 1,
        mentions: 0,
        items: [{ ...messagingItem, lastActivityAt: '2026-09-16T06:10:30' }],
      })
    ).toEqual({ ok: false, code: 'MALFORMED_PAYLOAD' });
  });

  it('enforces notification subset counters, versions and unique app keys', () => {
    expect(
      parse('notification.response-queue', {
        counterVersion: 'v42',
        items: [notificationItem],
      })
    ).toEqual({ ok: false, code: 'MALFORMED_PAYLOAD' });
    expect(
      parse('notification.response-queue', {
        counterVersion: '42',
        items: [{ ...notificationItem, actionableUnread: 6 }],
      })
    ).toEqual({ ok: false, code: 'MALFORMED_PAYLOAD' });
    expect(
      parse('notification.response-queue', {
        counterVersion: '42',
        items: [notificationItem, { ...notificationItem, lastActivityAt: '2026-09-16T07:00:00Z' }],
      })
    ).toEqual({ ok: false, code: 'MALFORMED_PAYLOAD' });
  });

  it('accepts unavailable HR state without origin and rejects incomplete available state', () => {
    expect(
      parse('hr.edu', {
        requiredLearningCount: 2,
        activeGoalCount: 1,
        state: { availability: 'UNAVAILABLE' },
      })
    ).toMatchObject({ ok: true });
    expect(
      parse('hr.edu', {
        requiredLearningCount: 2,
        activeGoalCount: 1,
        state: { availability: 'AVAILABLE' },
      })
    ).toEqual({ ok: false, code: 'MALFORMED_PAYLOAD' });
  });

  it('fails closed without throwing for non-object payloads', () => {
    for (const key of OWNER_WIDGET_DEFINITION_KEYS) {
      expect(() => parse(key, null)).not.toThrow();
      expect(parse(key, null)).toEqual({ ok: false, code: 'MALFORMED_PAYLOAD' });
      expect(parse(key, [])).toEqual({ ok: false, code: 'MALFORMED_PAYLOAD' });
    }
  });

  it('accepts a second distinct item to prove duplicate checks are key-based', () => {
    const result = parse('messaging.response-queue', {
      unreadConversations: 5,
      mentions: 1,
      items: [messagingItem, { ...messagingItem, id: ID_2, name: '운영 공지' }],
    });
    expect(result.ok && result.value.items).toHaveLength(2);
  });
});
