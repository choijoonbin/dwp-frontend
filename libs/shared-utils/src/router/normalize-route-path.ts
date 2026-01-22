export const normalizeRoutePath = (input: string | null | undefined): string | null => {
  if (!input) return null;

  let normalized = input.trim();
  if (!normalized) return null;

  normalized = normalized.replace(/\/{2,}/g, '/');

  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  if (normalized === '/app/admin/audit-logs') {
    return '/admin/audit';
  }

  if (normalized === '/app/admin/code-usage') {
    return '/admin/code-usages';
  }

  if (normalized === '/app/admin/aiworkspace') {
    return '/ai-workspace';
  }

  if (normalized.startsWith('/app/admin/')) {
    const rest = normalized.slice('/app/admin/'.length);
    return rest ? `/admin/${rest}` : '/admin';
  }

  if (normalized.startsWith('/admin/')) {
    if (normalized === '/admin/audit-logs') return '/admin/audit';
    if (normalized === '/admin/code-usage') return '/admin/code-usages';
  }

  return normalized;
};
