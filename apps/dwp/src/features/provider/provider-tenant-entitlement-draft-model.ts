export type ProviderTenantEntitlementDraft = {
  tenantId: string | null;
  selected: ReadonlySet<string>;
  baselineFingerprint: string | null;
  dirty: boolean;
  conflict: boolean;
};

export type ProviderTenantEntitlementSaveToken = {
  tenantId: string;
  baselineFingerprint: string;
  selectedFingerprint: string;
  serverSnapshotFingerprint: string;
  serverSnapshotVersion: number;
  dirty: boolean;
  conflict: boolean;
};

export type ProviderTenantEntitlementSaveCommand = {
  token: ProviderTenantEntitlementSaveToken;
  selected: string[];
  justification: string;
};

export type ProviderTenantEntitlementServerState = {
  tenantId: string;
  version: number;
  entitlements: readonly { entitlementKey: string }[];
};

export const PROVIDER_TENANT_ENTITLEMENT_SERVER_DRIFT = 'SERVER_DRIFT' as const;

export function emptyProviderTenantEntitlementDraft(): ProviderTenantEntitlementDraft {
  return {
    tenantId: null,
    selected: new Set(),
    baselineFingerprint: null,
    dirty: false,
    conflict: false,
  };
}

export function providerTenantEntitlementFingerprint(keys: Iterable<string>): string {
  return [...new Set(keys)].sort().join('\u0000');
}

export function rebaseProviderTenantEntitlementDraft(
  tenantId: string,
  serverKeys: Iterable<string>
): ProviderTenantEntitlementDraft {
  const selected = new Set(serverKeys);
  return {
    tenantId,
    selected,
    baselineFingerprint: providerTenantEntitlementFingerprint(selected),
    dirty: false,
    conflict: false,
  };
}

export function rebaseProviderTenantEntitlementServerState(
  server: ProviderTenantEntitlementServerState
): ProviderTenantEntitlementDraft {
  return rebaseProviderTenantEntitlementDraft(
    server.tenantId,
    server.entitlements.map((entitlement) => entitlement.entitlementKey)
  );
}

export function hydrateProviderTenantEntitlementDraft(
  draft: ProviderTenantEntitlementDraft,
  tenantId: string,
  serverKeys: Iterable<string>
): ProviderTenantEntitlementDraft {
  const server = [...serverKeys];
  const serverFingerprint = providerTenantEntitlementFingerprint(server);
  if (draft.tenantId !== tenantId || draft.baselineFingerprint === null || !draft.dirty) {
    return rebaseProviderTenantEntitlementDraft(tenantId, server);
  }
  if (serverFingerprint === draft.baselineFingerprint) {
    return draft.conflict ? { ...draft, conflict: false } : draft;
  }
  return draft.conflict ? draft : { ...draft, conflict: true };
}

export function markProviderTenantEntitlementDraftConflict(
  draft: ProviderTenantEntitlementDraft,
  tenantId: string
): ProviderTenantEntitlementDraft {
  return draft.tenantId === tenantId && draft.dirty && !draft.conflict
    ? { ...draft, conflict: true }
    : draft;
}

export function toggleProviderTenantEntitlementDraft(
  draft: ProviderTenantEntitlementDraft,
  entitlementKey: string
): ProviderTenantEntitlementDraft {
  const selected = new Set(draft.selected);
  if (selected.has(entitlementKey)) selected.delete(entitlementKey);
  else selected.add(entitlementKey);
  return {
    ...draft,
    selected,
    dirty:
      draft.baselineFingerprint !== null &&
      providerTenantEntitlementFingerprint(selected) !== draft.baselineFingerprint,
  };
}

export function createProviderTenantEntitlementSaveToken(
  draft: ProviderTenantEntitlementDraft,
  serverSnapshotFingerprint: string,
  serverSnapshotVersion: number
): ProviderTenantEntitlementSaveToken | null {
  if (
    draft.tenantId === null ||
    draft.baselineFingerprint === null ||
    draft.baselineFingerprint !== serverSnapshotFingerprint ||
    draft.selected.size === 0 ||
    !draft.dirty ||
    draft.conflict
  ) {
    return null;
  }
  return {
    tenantId: draft.tenantId,
    baselineFingerprint: draft.baselineFingerprint,
    selectedFingerprint: providerTenantEntitlementFingerprint(draft.selected),
    serverSnapshotFingerprint,
    serverSnapshotVersion,
    dirty: draft.dirty,
    conflict: draft.conflict,
  };
}

export function providerTenantEntitlementSaveTokenMatches(
  token: ProviderTenantEntitlementSaveToken,
  currentTenantId: string,
  currentDraft: ProviderTenantEntitlementDraft,
  currentServer: ProviderTenantEntitlementServerState | null | undefined
): boolean {
  return (
    currentTenantId === token.tenantId &&
    currentServer?.tenantId === token.tenantId &&
    currentServer.version === token.serverSnapshotVersion &&
    currentDraft.tenantId === token.tenantId &&
    currentDraft.baselineFingerprint === token.baselineFingerprint &&
    providerTenantEntitlementFingerprint(currentDraft.selected) === token.selectedFingerprint &&
    providerTenantEntitlementFingerprint(
      currentServer.entitlements.map((entitlement) => entitlement.entitlementKey)
    ) === token.serverSnapshotFingerprint &&
    currentDraft.dirty === token.dirty &&
    currentDraft.conflict === token.conflict
  );
}

export function createProviderTenantEntitlementSaveCommand(
  draft: ProviderTenantEntitlementDraft,
  currentTenantId: string,
  currentServer: ProviderTenantEntitlementServerState | null | undefined,
  reason: string,
  blocked: boolean
): ProviderTenantEntitlementSaveCommand | typeof PROVIDER_TENANT_ENTITLEMENT_SERVER_DRIFT | null {
  if (
    blocked ||
    currentServer?.tenantId !== currentTenantId ||
    draft.tenantId !== currentTenantId
  ) {
    return null;
  }
  const serverSnapshotFingerprint = providerTenantEntitlementFingerprint(
    currentServer.entitlements.map((entitlement) => entitlement.entitlementKey)
  );
  if (
    draft.baselineFingerprint !== null &&
    draft.baselineFingerprint !== serverSnapshotFingerprint
  ) {
    return PROVIDER_TENANT_ENTITLEMENT_SERVER_DRIFT;
  }
  const token = createProviderTenantEntitlementSaveToken(
    draft,
    serverSnapshotFingerprint,
    currentServer.version
  );
  const justification = reason.trim();
  if (!token || !justification) return null;
  return { token, selected: [...draft.selected], justification };
}

export function providerTenantEntitlementSaveResponseMatches(
  token: ProviderTenantEntitlementSaveToken,
  currentTenantId: string,
  currentDraft: ProviderTenantEntitlementDraft,
  currentServer: ProviderTenantEntitlementServerState | null | undefined,
  responseServer: ProviderTenantEntitlementServerState
): boolean {
  return (
    responseServer.tenantId === token.tenantId &&
    responseServer.version >= token.serverSnapshotVersion + 1 &&
    providerTenantEntitlementFingerprint(
      responseServer.entitlements.map((entitlement) => entitlement.entitlementKey)
    ) === token.selectedFingerprint &&
    providerTenantEntitlementSaveTokenMatches(token, currentTenantId, currentDraft, currentServer)
  );
}

export function rebaseProviderTenantEntitlementSaveResponse(
  token: ProviderTenantEntitlementSaveToken,
  currentTenantId: string,
  currentDraft: ProviderTenantEntitlementDraft,
  currentServer: ProviderTenantEntitlementServerState | null | undefined,
  responseServer: ProviderTenantEntitlementServerState
): ProviderTenantEntitlementDraft | null {
  return providerTenantEntitlementSaveResponseMatches(
    token,
    currentTenantId,
    currentDraft,
    currentServer,
    responseServer
  )
    ? rebaseProviderTenantEntitlementServerState(responseServer)
    : null;
}
