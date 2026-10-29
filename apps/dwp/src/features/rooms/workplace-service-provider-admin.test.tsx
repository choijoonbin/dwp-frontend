// @vitest-environment jsdom
import { act, createElement, type ChangeEvent, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import WorkplaceServiceProviderAdminPage from './workplace-service-provider-admin';

const api = vi.hoisted(() => ({ providers: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', () => ({
  createWorkplaceIdempotencyKey: () => 'idempotency-key',
  createWorkplaceServiceProvider: vi.fn(),
  getWorkplaceServiceProviders: api.providers,
  resolveIdempotentMutationIntent: () => ({ key: 'idempotency-key' }),
  setWorkplaceServiceProviderState: vi.fn(),
  updateWorkplaceServiceProvider: vi.fn(),
  useProductSurfaceAuthority: () => ({
    snapshot: { envelope: { activeAccessMode: 'ELEVATED' } },
  }),
  verifyWorkplaceServiceProvider: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-i18n', () => ({ resolveSupportedLocale: () => 'en' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en' },
  }),
}));

vi.mock('./rooms-capabilities', () => ({
  useRoomsCapabilities: () => ({
    isLoaded: true,
    canViewWorkplaceAdmin: true,
    canManageWorkplaceAdmin: true,
  }),
}));

vi.mock('./workplace-member-surfaces', () => ({
  workplaceMemberCard: () => ({}),
  workplaceMemberSoftSurface: () => ({}),
}));

vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => createElement('button', { disabled, onClick }, children),
  EmptyState: ({ title }: { title: ReactNode }) => createElement('div', null, title),
  FormField: ({
    disabled,
    label,
    onChange,
    value,
  }: {
    disabled?: boolean;
    label: string;
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    value: string;
  }) => createElement('input', { 'aria-label': label, disabled, onChange, value }),
  InlineFeedback: ({
    children,
    'data-testid': testId,
  }: {
    children: ReactNode;
    'data-testid'?: string;
  }) => createElement('div', { 'data-testid': testId, role: 'alert' }, children),
  SelectField: ({ label, value }: { label: string; value: string }) =>
    createElement('select', { 'aria-label': label, value, onChange: () => undefined }),
}));

const providers = [
  {
    providerProfileId: '18000000-0000-4000-8000-000000000001',
    providerCode: 'DWP_NATIVE',
    displayNameKo: '네이티브',
    displayNameEn: 'Native provider',
    adapterType: 'DWP_NATIVE',
    lifecycleState: 'ACTIVE',
    siteScope: [],
    capabilities: [],
    support: {},
    credentialBindingConfigured: true,
    configurationVersion: 1,
    readiness: 'READY',
    evidenceConfigurationVersion: 1,
    evidenceReference: 'evidence-native',
    evidenceObservedAt: '2026-10-28T11:00:00Z',
    evidenceReceivedAt: '2026-10-28T11:00:01Z',
    evidenceErrorCode: null,
    version: 1,
    updatedAt: '2026-10-28T11:00:01Z',
  },
  {
    providerProfileId: '18000000-0000-4000-8000-000000000002',
    providerCode: 'EXTERNAL_AV',
    displayNameKo: '외부 AV',
    displayNameEn: 'External AV',
    adapterType: 'EXTERNAL_AV',
    lifecycleState: 'ACTIVE',
    siteScope: [],
    capabilities: ['AV'],
    support: {},
    credentialBindingConfigured: true,
    configurationVersion: 2,
    readiness: 'READY',
    evidenceConfigurationVersion: 2,
    evidenceReference: 'evidence-av',
    evidenceObservedAt: '2026-10-28T11:00:00Z',
    evidenceReceivedAt: '2026-10-28T11:00:01Z',
    evidenceErrorCode: null,
    version: 3,
    updatedAt: '2026-10-28T11:00:01Z',
  },
];

describe('Workplace service provider exception target', () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    api.providers.mockResolvedValue({ items: providers, generatedAt: '2026-10-28T11:00:00Z' });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  async function renderTarget(providerCode: string) {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter
            initialEntries={[
              `/workplace/admin/service-providers?provider=${encodeURIComponent(providerCode)}`,
            ]}
          >
            <WorkplaceServiceProviderAdminPage />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
    }
  }

  it('selects the exact provider code from the authorized list', async () => {
    await renderTarget('EXTERNAL_AV');

    const providerCode = host.querySelector<HTMLInputElement>(
      '[aria-label="workplace.services.extensions.providerCode"]'
    );
    expect(providerCode?.value).toBe('EXTERNAL_AV');
    expect(host.querySelector('[data-testid="workplace-service-provider-target-error"]')).toBe(
      null
    );
    const otherProviderActions = host.querySelectorAll<HTMLButtonElement>(
      '[data-testid="workplace-service-provider-DWP_NATIVE"] button'
    );
    expect(otherProviderActions[0]?.disabled).toBe(false);
    expect(otherProviderActions[1]?.disabled).toBe(true);
    expect(otherProviderActions[2]?.disabled).toBe(true);
  });

  it('keeps an absent provider target fail-closed instead of opening another editor', async () => {
    await renderTarget('MISSING_PROVIDER');

    expect(host.querySelector('[data-testid="workplace-service-provider-target-error"]')).not.toBe(
      null
    );
    expect(host.querySelector('[data-testid="workplace-service-provider-editor"]')).toBe(null);
    for (const providerCode of ['DWP_NATIVE', 'EXTERNAL_AV']) {
      const actions = host.querySelectorAll<HTMLButtonElement>(
        `[data-testid="workplace-service-provider-${providerCode}"] button`
      );
      expect(actions[1]?.disabled).toBe(true);
      expect(actions[2]?.disabled).toBe(true);
    }
  });
});
