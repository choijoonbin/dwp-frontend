export const OWNER_WIDGET_DEFINITION_KEYS = [
  'approval.focus-queue',
  'approval.my-requests',
  'meetings.next-prep',
  'meetings.followup-candidates',
  'notification.app-badges',
  'notification.response-queue',
  'space.change-feed',
  'space.response-queue',
  'messaging.response-queue',
  'messaging.change-feed',
  'hr.edu',
  'hr.team-pulse',
] as const;

export type OwnerWidgetDefinitionKey = (typeof OWNER_WIDGET_DEFINITION_KEYS)[number];

export type OwnerWidgetSurface = 'WIDGET' | 'APP_DOCK';

export type OwnerWidgetContract = Readonly<{
  definitionKey: OwnerWidgetDefinitionKey;
  definitionVersion: '1.0.0';
  definitionManifestHash: string;
  rendererBindingRevision: string;
  rendererKey: `home.${string}`;
  canonicalSourceRoute: `/${string}`;
  surface: OwnerWidgetSurface;
  commandCapabilities: readonly [];
}>;

export type OwnerWidgetBindingIdentity = Readonly<{
  definitionKey: unknown;
  definitionVersion: unknown;
  definitionManifestHash: unknown;
  rendererBindingRevision: unknown;
  rendererKey: unknown;
}>;

type ContractSeed = Readonly<{
  definitionKey: OwnerWidgetDefinitionKey;
  hash: string;
  rendererKey: `home.${string}`;
  canonicalSourceRoute: `/${string}`;
  surface?: OwnerWidgetSurface;
}>;

const NO_COMMAND_CAPABILITIES = [] as const;

function contract(seed: ContractSeed): OwnerWidgetContract {
  return Object.freeze({
    definitionKey: seed.definitionKey,
    definitionVersion: '1.0.0',
    definitionManifestHash: seed.hash,
    rendererBindingRevision: seed.hash,
    rendererKey: seed.rendererKey,
    canonicalSourceRoute: seed.canonicalSourceRoute,
    surface: seed.surface ?? 'WIDGET',
    commandCapabilities: NO_COMMAND_CAPABILITIES,
  });
}

/**
 * Exact Wave 4 owner binding allowlist.
 *
 * Hashes and binding revisions are copied from the canonical backend fixture
 * `contracts/widget-registry/wave4-owner-widget-manifests.v1.json`. A runtime
 * widget must match every identity field before any payload parser is selected.
 */
export const OWNER_WIDGET_CONTRACTS = Object.freeze([
  contract({
    definitionKey: 'approval.focus-queue',
    hash: 'd203595d9b713745a5e46e3545f29bd47cf403d016b6773aabc13b24d29f1600',
    rendererKey: 'home.approval.focus-queue',
    canonicalSourceRoute: '/approvals/home',
  }),
  contract({
    definitionKey: 'approval.my-requests',
    hash: 'a80bb5bc85786cc1b045eae227dd4b083de6089e41f037ff735e79fdd8ef8d12',
    rendererKey: 'home.approval.my-requests',
    canonicalSourceRoute: '/approvals/home',
  }),
  contract({
    definitionKey: 'meetings.next-prep',
    hash: '12b4b13ad8838b821931247cbaae7bb694d80f0301138c75d5364759410aeb71',
    rendererKey: 'home.meetings.next-prep',
    canonicalSourceRoute: '/meetings/home',
  }),
  contract({
    definitionKey: 'meetings.followup-candidates',
    hash: '9a18a83a2b704e4cad302365305ff112ad444629ff49ccca310a98d7c94b5e3b',
    rendererKey: 'home.meetings.followup-candidates',
    canonicalSourceRoute: '/meetings/home',
  }),
  contract({
    definitionKey: 'notification.app-badges',
    hash: '99f8e3d68f8c7b7d6fb175b6bedb24653bf838a47d87eaa11861078ea789d930',
    rendererKey: 'home.notification.app-badges',
    canonicalSourceRoute: '/notifications/home',
    surface: 'APP_DOCK',
  }),
  contract({
    definitionKey: 'notification.response-queue',
    hash: '1095138bdafd1c04e638e65f458f207f7d4616cc395e3da82969c34a0b5ce14b',
    rendererKey: 'home.notification.response-queue',
    canonicalSourceRoute: '/notifications/home',
  }),
  contract({
    definitionKey: 'space.change-feed',
    hash: '679133ea378aebfe3259d41615e084a74b3f02136ca273edd023df3896e45ce1',
    rendererKey: 'home.space.change-feed',
    canonicalSourceRoute: '/spaces/home',
  }),
  contract({
    definitionKey: 'space.response-queue',
    hash: 'cf00ea0674e3dcaec95b5dac3c74305e156815911d74570056e13721e4873457',
    rendererKey: 'home.space.response-queue',
    canonicalSourceRoute: '/spaces/home',
  }),
  contract({
    definitionKey: 'messaging.response-queue',
    hash: '3ade20ba736ad8436a43b7877006b0393be15fd42ca711aaf1631990cabc65a1',
    rendererKey: 'home.messaging.response-queue',
    canonicalSourceRoute: '/messages/home',
  }),
  contract({
    definitionKey: 'messaging.change-feed',
    hash: 'c25cb2b6e21b33e7fa1712956cae92f56fafd5cdb6b426c55db9a64924bcf0bc',
    rendererKey: 'home.messaging.change-feed',
    canonicalSourceRoute: '/messages/home',
  }),
  contract({
    definitionKey: 'hr.edu',
    hash: '05806990658c73ffaf4e5f5656721778641dfef19b4734c96d1f4fa9f3463eb8',
    rendererKey: 'home.hr.edu',
    canonicalSourceRoute: '/hr',
  }),
  contract({
    definitionKey: 'hr.team-pulse',
    hash: '9cf2e1770e377a3a7a7721ee795beaf9ad1649bac8a8977046e9990f9c6604df',
    rendererKey: 'home.hr.team-pulse',
    canonicalSourceRoute: '/hr',
  }),
] satisfies readonly OwnerWidgetContract[]);

const CONTRACT_BY_DEFINITION = new Map(
  OWNER_WIDGET_CONTRACTS.map((value) => [value.definitionKey, value] as const)
);

export function isOwnerWidgetDefinitionKey(value: unknown): value is OwnerWidgetDefinitionKey {
  return typeof value === 'string' && CONTRACT_BY_DEFINITION.has(value as OwnerWidgetDefinitionKey);
}

export function resolveOwnerWidgetContract(
  identity: OwnerWidgetBindingIdentity
): OwnerWidgetContract | null {
  if (!isOwnerWidgetDefinitionKey(identity.definitionKey)) return null;
  const expected = CONTRACT_BY_DEFINITION.get(identity.definitionKey);
  if (!expected) return null;
  return identity.definitionVersion === expected.definitionVersion &&
    identity.definitionManifestHash === expected.definitionManifestHash &&
    identity.rendererBindingRevision === expected.rendererBindingRevision &&
    identity.rendererKey === expected.rendererKey
    ? expected
    : null;
}

export function isCanonicalOwnerWidgetSourceRoute(
  contractValue: OwnerWidgetContract,
  sourceRoute: unknown
): sourceRoute is OwnerWidgetContract['canonicalSourceRoute'] {
  return sourceRoute === contractValue.canonicalSourceRoute;
}

