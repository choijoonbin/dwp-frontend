export function getAuthorizationClosureReleaseBlocker(closure, authorization, canonicalJson) {
  const reference = closure?.generatedFrom?.authorizationBundle;
  const bundle = authorization?.bundles?.find((item) => item?.version === reference?.version);
  const index = authorization?.index;
  const latestAlias = authorization?.latestAlias;
  if (
    bundle?.checksum === reference?.checksum &&
    index?.latestVersion === reference?.version &&
    index?.latestArtifact === reference?.artifact &&
    index?.latestChecksum === reference?.checksum &&
    latestAlias?.version === reference?.version &&
    latestAlias?.checksum === reference?.checksum &&
    canonicalJson(latestAlias) === canonicalJson(bundle)
  ) {
    return null;
  }
  return (
    'AUTHORIZATION_CLOSURE_ATTESTATION: latest authorization registry ' +
    `v${index?.latestVersion ?? 'UNKNOWN'} (${index?.latestChecksum ?? 'UNKNOWN'}) ` +
    `does not match attested closure v${reference?.version ?? 'UNKNOWN'} ` +
    `(${reference?.checksum ?? 'UNKNOWN'}).`
  );
}
