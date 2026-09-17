import Stack from '@mui/material/Stack';

import { AdminV2ViewTabs } from './admin-v2-foundation';

import type { ReactNode } from 'react';
import type { AdminV2Status } from './admin-v2-types';

export const EMPTY_ADMIN_V2_STATUS: AdminV2Status = {
  label: 'UNAVAILABLE',
  tone: 'neutral',
};

export function selectedAdminV2Id<T extends { id: string }>(
  items: readonly T[],
  selected: string | null
) {
  return items.some((item) => item.id === selected) ? selected : (items[0]?.id ?? null);
}

export function retryAdminV2Source(source: { refetch: () => unknown }) {
  return () => void source.refetch();
}

export function adminV2RequestOptions(source: { requestScope: { contextScopeKey?: string } }) {
  return source.requestScope.contextScopeKey
    ? { contextScopeKey: source.requestScope.contextScopeKey }
    : {};
}

export function AdminWorkspaceTabs<T extends string>({
  label,
  value,
  options,
  onChange,
  children,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  children: ReactNode;
}) {
  return (
    <Stack gap={2.5}>
      <AdminV2ViewTabs label={label} value={value} options={options} onChange={onChange} />
      {children}
    </Stack>
  );
}
