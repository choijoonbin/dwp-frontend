import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getProviderTenant, listProviderTenants } from '@dwp-frontend/shared-utils';
import { AutocompleteField } from '@dwp-frontend/design-system';

import type { ProviderTenant } from '@dwp-frontend/shared-utils';

function uniqueTenants(tenants: ProviderTenant[]): ProviderTenant[] {
  return Array.from(new Map(tenants.map((tenant) => [tenant.tenantId, tenant])).values());
}

export function ProviderTenantPicker({
  value,
  onChange,
  onTenantChange,
  initialOptions = [],
  disabled = false,
  required = true,
  label,
  supportingText,
  loadingText,
  emptyText,
  errorText,
}: {
  value: string;
  onChange: (tenantId: string) => void;
  onTenantChange?: (tenant: ProviderTenant | null) => void;
  initialOptions?: ProviderTenant[];
  disabled?: boolean;
  required?: boolean;
  label?: string;
  supportingText?: string;
  loadingText?: string;
  emptyText?: string;
  errorText?: string;
}) {
  const { t } = useTranslation('provider');
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const query = useDeferredValue(input.trim());
  const optionsQuery = useQuery({
    queryKey: ['provider', 'tenants', 'picker', query],
    queryFn: () => listProviderTenants({ query: query || undefined, page: 0, size: 25 }),
    enabled: open || Boolean(query),
    staleTime: 15_000,
  });
  const searched = useMemo(() => optionsQuery.data?.content ?? [], [optionsQuery.data?.content]);
  const selectedInitial = initialOptions.find((tenant) => tenant.tenantId === value);
  const selectedQuery = useQuery({
    queryKey: ['provider', 'tenant', value, 'picker'],
    queryFn: () => getProviderTenant(value),
    enabled:
      Boolean(value) && !selectedInitial && !searched.some((tenant) => tenant.tenantId === value),
    staleTime: 30_000,
  });
  const options = useMemo(() => {
    const candidates = query ? searched : [...initialOptions, ...searched];
    const selected = selectedInitial ?? selectedQuery.data;
    return uniqueTenants(selected ? [selected, ...candidates] : candidates);
  }, [initialOptions, query, searched, selectedInitial, selectedQuery.data]);
  const selected = options.find((tenant) => tenant.tenantId === value) ?? null;

  return (
    <AutocompleteField<ProviderTenant>
      required={required}
      disabled={disabled}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={options}
      value={selected}
      loading={optionsQuery.isFetching || selectedQuery.isFetching}
      filterOptions={(candidates) => candidates}
      getOptionLabel={(tenant) => `${tenant.displayName} (${tenant.tenantKey})`}
      isOptionEqualToValue={(option, candidate) => option.tenantId === candidate.tenantId}
      noOptionsText={
        optionsQuery.isError
          ? (errorText ?? t('support.tenantPicker.error'))
          : (emptyText ?? t('support.tenantPicker.empty'))
      }
      loadingText={loadingText ?? t('support.tenantPicker.loading')}
      label={label ?? t('fields.tenant')}
      supportingText={supportingText ?? t('support.tenantPicker.help')}
      onInputChange={(_event, next, reason) => {
        if (reason === 'input' || reason === 'clear') setInput(next);
      }}
      onChange={(_event, tenant) => {
        onChange(tenant?.tenantId ?? '');
        onTenantChange?.(tenant);
      }}
    />
  );
}
