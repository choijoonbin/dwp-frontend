import { describe, expect, it } from 'vitest';
import {
  OWNER_WIDGET_CONTRACTS,
  OWNER_WIDGET_DEFINITION_KEYS,
  isCanonicalOwnerWidgetSourceRoute,
  isOwnerWidgetDefinitionKey,
  resolveOwnerWidgetContract,
} from './owner-widget-contracts';

const EXPECTED_TUPLES = [
  [
    'approval.focus-queue',
    'd203595d9b713745a5e46e3545f29bd47cf403d016b6773aabc13b24d29f1600',
    'home.approval.focus-queue',
    '/approvals/home',
    'WIDGET',
  ],
  [
    'approval.my-requests',
    'a80bb5bc85786cc1b045eae227dd4b083de6089e41f037ff735e79fdd8ef8d12',
    'home.approval.my-requests',
    '/approvals/home',
    'WIDGET',
  ],
  [
    'meetings.next-prep',
    '12b4b13ad8838b821931247cbaae7bb694d80f0301138c75d5364759410aeb71',
    'home.meetings.next-prep',
    '/meetings/home',
    'WIDGET',
  ],
  [
    'meetings.followup-candidates',
    '9a18a83a2b704e4cad302365305ff112ad444629ff49ccca310a98d7c94b5e3b',
    'home.meetings.followup-candidates',
    '/meetings/home',
    'WIDGET',
  ],
  [
    'notification.app-badges',
    '99f8e3d68f8c7b7d6fb175b6bedb24653bf838a47d87eaa11861078ea789d930',
    'home.notification.app-badges',
    '/notifications/home',
    'APP_DOCK',
  ],
  [
    'notification.response-queue',
    '1095138bdafd1c04e638e65f458f207f7d4616cc395e3da82969c34a0b5ce14b',
    'home.notification.response-queue',
    '/notifications/home',
    'WIDGET',
  ],
  [
    'space.change-feed',
    '679133ea378aebfe3259d41615e084a74b3f02136ca273edd023df3896e45ce1',
    'home.space.change-feed',
    '/spaces/home',
    'WIDGET',
  ],
  [
    'space.response-queue',
    'cf00ea0674e3dcaec95b5dac3c74305e156815911d74570056e13721e4873457',
    'home.space.response-queue',
    '/spaces/home',
    'WIDGET',
  ],
  [
    'messaging.response-queue',
    '3ade20ba736ad8436a43b7877006b0393be15fd42ca711aaf1631990cabc65a1',
    'home.messaging.response-queue',
    '/messages/home',
    'WIDGET',
  ],
  [
    'messaging.change-feed',
    'c25cb2b6e21b33e7fa1712956cae92f56fafd5cdb6b426c55db9a64924bcf0bc',
    'home.messaging.change-feed',
    '/messages/home',
    'WIDGET',
  ],
  [
    'hr.edu',
    '05806990658c73ffaf4e5f5656721778641dfef19b4734c96d1f4fa9f3463eb8',
    'home.hr.edu',
    '/hr',
    'WIDGET',
  ],
  [
    'hr.team-pulse',
    '9cf2e1770e377a3a7a7721ee795beaf9ad1649bac8a8977046e9990f9c6604df',
    'home.hr.team-pulse',
    '/hr',
    'WIDGET',
  ],
] as const;

describe('Wave 4 owner widget contracts', () => {
  it('pins the exact twelve canonical manifest and renderer tuples', () => {
    expect(
      OWNER_WIDGET_CONTRACTS.map((value) => [
        value.definitionKey,
        value.definitionManifestHash,
        value.rendererKey,
        value.canonicalSourceRoute,
        value.surface,
      ])
    ).toEqual(EXPECTED_TUPLES);
    expect(OWNER_WIDGET_DEFINITION_KEYS).toHaveLength(12);
    expect(new Set(OWNER_WIDGET_DEFINITION_KEYS).size).toBe(12);
  });

  it('uses the signed manifest hash as the renderer binding revision', () => {
    for (const value of OWNER_WIDGET_CONTRACTS) {
      expect(value.definitionVersion).toBe('1.0.0');
      expect(value.definitionManifestHash).toMatch(/^[a-f0-9]{64}$/u);
      expect(value.rendererBindingRevision).toBe(value.definitionManifestHash);
      expect(value.commandCapabilities).toEqual([]);
    }
  });

  it('resolves only an exact five-field identity', () => {
    for (const value of OWNER_WIDGET_CONTRACTS) {
      const identity = {
        definitionKey: value.definitionKey,
        definitionVersion: value.definitionVersion,
        definitionManifestHash: value.definitionManifestHash,
        rendererBindingRevision: value.rendererBindingRevision,
        rendererKey: value.rendererKey,
      };
      expect(resolveOwnerWidgetContract(identity)).toBe(value);
      expect(resolveOwnerWidgetContract({ ...identity, definitionVersion: '1.0.1' })).toBeNull();
      expect(
        resolveOwnerWidgetContract({ ...identity, definitionManifestHash: '0'.repeat(64) })
      ).toBeNull();
      expect(
        resolveOwnerWidgetContract({ ...identity, rendererBindingRevision: '0'.repeat(64) })
      ).toBeNull();
      expect(resolveOwnerWidgetContract({ ...identity, rendererKey: 'home.attacker' })).toBeNull();
    }
    expect(
      resolveOwnerWidgetContract({
        definitionKey: 'unknown.widget',
        definitionVersion: '1.0.0',
        definitionManifestHash: '0'.repeat(64),
        rendererBindingRevision: '0'.repeat(64),
        rendererKey: 'home.unknown',
      })
    ).toBeNull();
  });

  it('recognizes only canonical definitions and source routes', () => {
    expect(isOwnerWidgetDefinitionKey('hr.edu')).toBe(true);
    expect(isOwnerWidgetDefinitionKey('hr.edu ')).toBe(false);
    expect(isOwnerWidgetDefinitionKey(null)).toBe(false);

    for (const value of OWNER_WIDGET_CONTRACTS) {
      expect(isCanonicalOwnerWidgetSourceRoute(value, value.canonicalSourceRoute)).toBe(true);
      expect(isCanonicalOwnerWidgetSourceRoute(value, `${value.canonicalSourceRoute}/evil`)).toBe(
        false
      );
      expect(isCanonicalOwnerWidgetSourceRoute(value, 'https://example.invalid')).toBe(false);
    }
  });

  it('marks app badges as an app-dock projection rather than a widget renderer', () => {
    expect(
      OWNER_WIDGET_CONTRACTS.filter((value) => value.surface === 'APP_DOCK').map(
        (value) => value.definitionKey
      )
    ).toEqual(['notification.app-badges']);
  });
});
