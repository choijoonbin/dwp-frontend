export function mailWritingAssetCommandKey(
  keys: Map<string, string>,
  fingerprint: string,
  createKey: () => string = () => crypto.randomUUID()
) {
  const existing = keys.get(fingerprint);
  if (existing) return existing;
  const created = createKey();
  keys.set(fingerprint, created);
  return created;
}

export function mailWritingAssetDraftFingerprint(
  editorIdentity: string,
  input: Record<string, unknown>
) {
  return `draft:${editorIdentity}:${JSON.stringify(input)}`;
}

export function mailWritingAssetTransitionFingerprint(input: {
  kind: string;
  assetId: string;
  action: string;
  version: number;
}) {
  return `transition:${input.kind}:${input.assetId}:${input.action}:${input.version}`;
}
