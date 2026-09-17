export function mailAccountScopedPath(path: string, accountId?: string | null) {
  if (!accountId) return path;
  const [pathAndSearch, hash = ''] = path.split('#', 2);
  const [pathname, query = ''] = pathAndSearch!.split('?', 2);
  const params = new URLSearchParams(query);
  params.set('accountId', accountId);
  const search = params.toString();
  return `${pathname}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`;
}

export function validMailAccountScope(
  requestedAccountId: string | null,
  accounts: ReadonlyArray<{ accountId: string }>
) {
  return accounts.some((account) => account.accountId === requestedAccountId)
    ? requestedAccountId
    : null;
}
