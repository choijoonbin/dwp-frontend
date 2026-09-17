export function resolveMailAdminCommandKey(
  keys: Map<string, string>,
  scope: string,
  create: () => string = () => crypto.randomUUID()
): string {
  const existing = keys.get(scope);
  if (existing) return existing;
  const created = create();
  keys.set(scope, created);
  return created;
}
