import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getProviderTenant, listProviderTenants } from '@dwp-frontend/shared-utils';
import { AutocompleteField } from '@dwp-frontend/design-system';

import type { ProviderTenant } from '@dwp-frontend/shared-utils';

type TenantOption = Pick<ProviderTenant, 'tenantId' | 'displayName' | 'tenantKey'>;

export function ProviderTenantPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (tenantId: string) => void;
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
  const listed = useMemo(() => optionsQuery.data?.content ?? [], [optionsQuery.data?.content]);
  const selectedQuery = useQuery({
    queryKey: ['provider', 'tenant', value, 'picker'],
    queryFn: () => getProviderTenant(value),
    enabled: Boolean(value) && !listed.some((tenant) => tenant.tenantId === value),
    staleTime: 30_000,
  });
  const options = useMemo<TenantOption[]>(() => {
    const selected = selectedQuery.data;
    return selected && !listed.some((tenant) => tenant.tenantId === selected.tenantId)
      ? [selected, ...listed]
      : listed;
  }, [listed, selectedQuery.data]);
  const selected = options.find((tenant) => tenant.tenantId === value) ?? null;

  return (
    <AutocompleteField<TenantOption>
      required
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
        optionsQuery.isError ? t('support.tenantPicker.error') : t('support.tenantPicker.empty')
      }
      loadingText={t('support.tenantPicker.loading')}
      label={t('fields.tenant')}
      supportingText={t('support.tenantPicker.help')}
      onInputChange={(_event, next, reason) => {
        if (reason === 'input' || reason === 'clear') setInput(next);
      }}
      onChange={(_event, tenant) => onChange(tenant?.tenantId ?? '')}
    />
  );
}
