export function manifestImportClosure(manifest, rootKey, collected = new Set()) {
  if (collected.has(rootKey)) return collected;
  const current = manifest[rootKey];
  if (!current) throw new Error(`Manifest import is missing: ${rootKey}.`);
  collected.add(rootKey);
  for (const importedKey of current.imports ?? []) {
    manifestImportClosure(manifest, importedKey, collected);
  }
  return collected;
}

export function initialManifestKeys(manifest) {
  const initialKeys = new Set();
  for (const [key, entry] of Object.entries(manifest)) {
    if (!entry.isEntry) continue;
    for (const importedKey of manifestImportClosure(manifest, key)) {
      initialKeys.add(importedKey);
    }
  }
  return initialKeys;
}

export function incrementalRouteKeys(manifest, routeKey) {
  const initialKeys = initialManifestKeys(manifest);
  return new Set(
    [...manifestImportClosure(manifest, routeKey)].filter((key) => !initialKeys.has(key))
  );
}
