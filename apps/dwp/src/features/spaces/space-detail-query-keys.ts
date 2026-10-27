export type SpaceQueryIdentity = { tenantId: number; userId: number };

// Preserve the existing prefixes so content/member mutations still invalidate these queries.
export const spaceDetailQueryKeys = {
  detail: (spaceKey: string, identity: SpaceQueryIdentity) =>
    ['spaces', 'detail', spaceKey, identity.tenantId, identity.userId] as const,
  content: (spaceKey: string, identity: SpaceQueryIdentity) =>
    ['spaces', 'content', spaceKey, identity.tenantId, identity.userId] as const,
  members: (spaceKey: string, identity: SpaceQueryIdentity) =>
    ['spaces', 'members', spaceKey, identity.tenantId, identity.userId] as const,
  ownerRequests: (spaceKey: string, identity: SpaceQueryIdentity) =>
    [
      'spaces',
      'owner-access-requests',
      spaceKey,
      'ALL',
      identity.tenantId,
      identity.userId,
    ] as const,
  people: (query: string, identity: SpaceQueryIdentity) =>
    ['spaces', 'people-search', query, identity.tenantId, identity.userId] as const,
  pending: (identity: SpaceQueryIdentity) =>
    ['spaces', 'access-requests', 'PENDING', identity.tenantId, identity.userId] as const,
};
