import { describe, expect, it } from 'vitest';
import { OWNER_WIDGET_CONTRACTS } from './owner-widget-contracts';
import { normalizeOwnerWidget } from './owner-widget-view-model';

const approval = OWNER_WIDGET_CONTRACTS.find(
  (value) => value.definitionKey === 'approval.focus-queue'
)!;
const badges = OWNER_WIDGET_CONTRACTS.find(
  (value) => value.definitionKey === 'notification.app-badges'
)!;

const approvalPayload = {
  pendingCount: 2,
  dueTodayCount: 1,
  overdueCount: 0,
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      requestNumber: 'APR-42',
      title: '예산 승인',
      status: 'PENDING',
      priority: 'HIGH',
      dueAt: '2026-09-16T08:00:00Z',
      version: 2,
    },
  ],
};

function input(contract = approval) {
  return {
    definitionKey: contract.definitionKey,
    definitionVersion: contract.definitionVersion,
    definitionManifestHash: contract.definitionManifestHash,
    rendererBindingRevision: contract.rendererBindingRevision,
    rendererKey: contract.rendererKey,
    governanceSourceRoute: contract.canonicalSourceRoute,
    actions: [
      {
        actionId: 'open-source',
        labelKey: 'home.action.openSource',
        kind: 'SOURCE_ROUTE',
        sourceRoute: contract.canonicalSourceRoute,
        commandKey: null,
        expectedResultVersion: null,
        requiresConfirmation: false,
      },
    ],
    payload: approvalPayload,
    locale: 'ko-KR',
  };
}

describe('normalizeOwnerWidget', () => {
  it('returns a presentation-safe model with a canonical source action and no commands', () => {
    const result = normalizeOwnerWidget(input());
    expect(result).toEqual({
      ok: true,
      value: {
        definitionKey: 'approval.focus-queue',
        definitionVersion: '1.0.0',
        rendererKey: 'home.approval.focus-queue',
        surface: 'WIDGET',
        sourceRoute: '/approvals/home',
        sourceAction: {
          actionId: 'open-source',
          labelKey: 'home.action.openSource',
          kind: 'SOURCE_ROUTE',
          sourceRoute: '/approvals/home',
          requiresConfirmation: false,
        },
        commandActions: [],
        payload: approvalPayload,
      },
    });
    if (result.ok) expect(Object.isFrozen(result.value.commandActions)).toBe(true);
  });

  it('fails closed when any signed binding identity field mismatches', () => {
    expect(normalizeOwnerWidget({ ...input(), rendererKey: 'home.attacker' })).toEqual({
      ok: false,
      code: 'UNSUPPORTED_BINDING',
    });
    expect(normalizeOwnerWidget({ ...input(), rendererBindingRevision: '0'.repeat(64) })).toEqual({
      ok: false,
      code: 'UNSUPPORTED_BINDING',
    });
  });

  it('rejects external, cross-product and action route mismatches', () => {
    expect(
      normalizeOwnerWidget({ ...input(), governanceSourceRoute: 'https://example.invalid' })
    ).toEqual({ ok: false, code: 'SOURCE_ROUTE_MISMATCH' });
    expect(normalizeOwnerWidget({ ...input(), governanceSourceRoute: '/meetings/home' })).toEqual({
      ok: false,
      code: 'SOURCE_ROUTE_MISMATCH',
    });
    const wrongAction = input();
    expect(
      normalizeOwnerWidget({
        ...wrongAction,
        actions: [{ ...wrongAction.actions[0], sourceRoute: '/meetings/home' }],
      })
    ).toEqual({ ok: false, code: 'ACTION_CONTRACT_MISMATCH' });
  });

  it('rejects commands and action extensions even when their route looks safe', () => {
    const candidate = input();
    expect(
      normalizeOwnerWidget({
        ...candidate,
        actions: [
          {
            ...candidate.actions[0],
            kind: 'COMMAND',
            commandKey: 'approve',
            expectedResultVersion: 'v1',
          },
        ],
      })
    ).toEqual({ ok: false, code: 'ACTION_CONTRACT_MISMATCH' });
    expect(
      normalizeOwnerWidget({
        ...candidate,
        actions: [{ ...candidate.actions[0], analyticsPayload: { title: 'private' } }],
      })
    ).toEqual({ ok: false, code: 'ACTION_CONTRACT_MISMATCH' });
  });

  it('allows a state with no action while keeping the canonical route metadata', () => {
    const result = normalizeOwnerWidget({ ...input(), actions: [] });
    expect(result.ok && result.value.sourceAction).toBeNull();
    expect(result.ok && result.value.sourceRoute).toBe('/approvals/home');
    expect(result.ok && result.value.commandActions).toEqual([]);
  });

  it('isolates malformed payloads without reflecting their content', () => {
    expect(normalizeOwnerWidget({ ...input(), payload: { secret: 'do-not-reflect' } })).toEqual({
      ok: false,
      code: 'MALFORMED_PAYLOAD',
    });
  });

  it('keeps notification app badges on the app-dock surface', () => {
    const result = normalizeOwnerWidget({
      ...input(badges),
      payload: {
        counterVersion: '7',
        items: [
          {
            appKey: 'approvals',
            totalUnread: 2,
            actionableUnread: 1,
            urgentUnread: 1,
            lastActivityAt: '2026-09-16T08:00:00Z',
          },
        ],
      },
    });
    expect(result.ok && result.value.surface).toBe('APP_DOCK');
    expect(result.ok && result.value.definitionKey).toBe('notification.app-badges');
  });
});
