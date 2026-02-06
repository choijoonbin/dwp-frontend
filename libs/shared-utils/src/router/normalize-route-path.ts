export const normalizeRoutePath = (input: string | null | undefined): string | null => {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const queryIndex = trimmed.indexOf('?');
  const hashIndex = trimmed.indexOf('#');
  const splitIndex =
    queryIndex === -1
      ? hashIndex
      : hashIndex === -1
        ? queryIndex
        : Math.min(queryIndex, hashIndex);

  const suffix = splitIndex === -1 ? '' : trimmed.slice(splitIndex);
  let normalized = splitIndex === -1 ? trimmed : trimmed.slice(0, splitIndex);

  normalized = normalized.replace(/\/{2,}/g, '/');

  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  if (normalized === '/app/admin/audit-logs') {
    return `/admin/audit${suffix}`;
  }

  if (normalized === '/app/admin/code-usage') {
    return `/admin/code-usages${suffix}`;
  }

  if (normalized === '/app/admin/aiworkspace') {
    return `/ai-workspace${suffix}`;
  }

  if (normalized.startsWith('/app/admin/')) {
    const rest = normalized.slice('/app/admin/'.length);
    return `${rest ? `/admin/${rest}` : '/admin'}${suffix}`;
  }

  if (normalized === '/app/synapse' || normalized === '/app/synapse/') {
    return `/synapse${suffix}`;
  }
  if (normalized.startsWith('/app/synapse/')) {
    const rest = normalized.slice('/app/synapse/'.length);
    return `${rest ? `/synapse/${rest}` : '/synapse'}${suffix}`;
  }

  // /synapse/admin/code-usages|menus|codes → /admin/* (동일 화면 버그 수정: Admin Remote로 라우팅)
  const synapseAdminMatch =
    normalized.match(/^(?:\/)?synapse\/admin\/(code-usages|menus|codes)(?:\/|$)/) ?? [];
  if (synapseAdminMatch[1]) {
    return `/admin/${synapseAdminMatch[1]}${suffix}`;
  }

  if (normalized.startsWith('/admin/')) {
    if (normalized === '/admin/audit-logs') return `/admin/audit${suffix}`;
    if (normalized === '/admin/code-usage') return `/admin/code-usages${suffix}`;
  }

  // Tree API path는 그대로 사용 (동적 디스패치에서 처리). 선행 슬래시만 보장
  if (normalized.length > 0 && !normalized.startsWith('/')) {
    return `/${normalized}${suffix}`;
  }

  return `${normalized}${suffix}`;
};
