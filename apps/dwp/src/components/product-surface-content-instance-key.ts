export function productSurfaceContentInstanceKey(identity: {
  contextKey: string;
  surfaceKey: string;
  contextScopeKey: string;
  decisionRevision: string;
}): string {
  return [
    identity.contextKey,
    identity.surfaceKey,
    identity.contextScopeKey,
    identity.decisionRevision,
  ].join('\u0000');
}
