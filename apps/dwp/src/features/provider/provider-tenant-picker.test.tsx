// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProviderTenantPicker } from './provider-tenant-picker';

import type { ProviderTenant } from '@dwp-frontend/shared-utils';

const dependencies = vi.hoisted(() => ({
  getTenant: vi.fn(),
  listTenants: vi.fn(),
  tenantChanged: vi.fn(),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@dwp-frontend/shared-utils', () => ({
  getProviderTenant: dependencies.getTenant,
  listProviderTenants: dependencies.listTenants,
}));
vi.mock('@dwp-frontend/design-system', () => ({
  AutocompleteField: ({
    label,
    disabled,
    options,
    onOpen,
    onInputChange,
    onChange,
  }: {
    label: string;
    disabled?: boolean;
    options: ProviderTenant[];
    onOpen: () => void;
    onInputChange: (event: null, value: string, reason: string) => void;
    onChange: (event: null, value: ProviderTenant | null) => void;
  }) => (
    <div>
      <input
        aria-label={label}
        disabled={disabled}
        onFocus={onOpen}
        onChange={(event) => onInputChange(null, event.target.value, 'input')}
      />
      {options.map((tenant) => (
        <button key={tenant.tenantId} onClick={() => onChange(null, tenant)}>
          {tenant.displayName}
        </button>
      ))}
    </div>
  ),
}));

function tenant(tenantId: string, displayName: string, environmentKey: string): ProviderTenant {
  return {
    tenantId,
    displayName,
    environmentKey,
    organizationId: `org-${tenantId}`,
    organizationKey: `org-${tenantId}`,
    organizationName: displayName,
    tenantKey: tenantId,
    serviceTier: 'ENTERPRISE',
    dataRegion: 'eu-west',
    isolationModel: 'POOL',
    defaultLocale: 'en-US',
    timeZone: 'UTC',
    lifecycleState: 'ACTIVE',
    onboardingState: 'COMPLETED',
    schemaVersion: 1,
    configuration: '{}',
    version: 1,
    entitlements: [],
    services: [],
    domains: [],
    administratorPosture: {
      configuredCount: 1,
      activeCount: 1,
      pendingDeliveryCount: 0,
      primaryConfigured: true,
    },
  };
}

const initialTenant = tenant('tenant-001', 'Initial tenant', 'production');
const searchedTenant = tenant('tenant-187', 'Searched tenant', 'regulated-eu');

let root: Root;
let client: QueryClient;
let container: HTMLDivElement;

function Harness() {
  const [value, setValue] = useState(initialTenant.tenantId);
  return (
    <ProviderTenantPicker
      label="Target tenant"
      value={value}
      initialOptions={[initialTenant]}
      onChange={setValue}
      onTenantChange={dependencies.tenantChanged}
    />
  );
}

describe('ProviderTenantPicker server search', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    dependencies.listTenants.mockImplementation(async ({ query }: { query?: string }) => ({
      content: query ? [searchedTenant] : [initialTenant],
      page: 0,
      size: 25,
      totalElements: 1,
      totalPages: 1,
    }));
    dependencies.getTenant.mockResolvedValue(initialTenant);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('finds a tenant outside the initial page and returns its exact environment', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>
      );
    });

    const input = getByRole(container, 'textbox', { name: 'Target tenant' });
    await act(async () => fireEvent.focus(input));
    await act(async () => fireEvent.change(input, { target: { value: 'tenant-187' } }));

    const option = await vi.waitFor(() =>
      getByRole(container, 'button', { name: searchedTenant.displayName })
    );
    await act(async () => fireEvent.click(option));

    expect(dependencies.listTenants).toHaveBeenLastCalledWith({
      query: 'tenant-187',
      page: 0,
      size: 25,
    });
    expect(dependencies.tenantChanged).toHaveBeenCalledWith(searchedTenant);
    expect(dependencies.getTenant).not.toHaveBeenCalled();
  });
});
