// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDwaionAdminAgent, type RegistryEntryDetail } from '@dwp-frontend/shared-utils';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { DwaionAdminAgentHistory } from './dwaion-admin-agent-history';

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getDwaionAdminAgent: vi.fn(),
}));
vi.mock('./dwaion-admin-registry', () => ({
  useAdminRegistryCopy: () => ({
    history: 'Revision history',
    historyError: 'Revision history could not be verified.',
    loading: 'Loading governance items',
  }),
}));

const current: RegistryEntryDetail['current'] = {
  registryType: 'AGENT',
  entryKey: 'PRIVATE_AGENT',
  revision: 991,
  name: 'Private agent',
  ownerRef: 'private-owner-before-revocation',
  riskTier: 'HIGH',
  artifactVersion: 'private-version-991',
  lifecycleState: 'DRAFT',
  version: 1,
};
const original: RegistryEntryDetail = { current, history: [current] };
const queryKey = ['dwaion', 'admin', 'agent-detail', current.entryKey];
let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function waitForQuery(status: 'success' | 'error') {
  await act(async () => {
    await vi.waitFor(() => expect(client.getQueryState(queryKey)?.status).toBe(status));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('administrator revision history revalidation', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.mocked(getDwaionAdminAgent).mockReset().mockResolvedValue(original);
    // The sensitive history query must override retries and hide on the first failed response.
    client = new QueryClient({ defaultOptions: { queries: { retry: 2, retryDelay: 0 } } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it.each([403, 503])(
    'hides retained revision and owner data after a %s refetch until a fresh success',
    async (status) => {
      await act(async () => {
        root.render(
          <QueryClientProvider client={client}>
            <DwaionAdminAgentHistory entryKey={current.entryKey} />
          </QueryClientProvider>
        );
      });
      await waitForQuery('success');
      expect(host.textContent).toContain(current.ownerRef);
      expect(host.textContent).toContain('991 · private-version-991');

      vi.mocked(getDwaionAdminAgent).mockRejectedValue(new HttpError('Request failed', status));
      await act(async () => client.refetchQueries({ queryKey }));
      await waitForQuery('error');

      // TanStack retains the last successful payload; rendering must not treat it as authority.
      expect(client.getQueryData(queryKey)).toEqual(original);
      expect(getDwaionAdminAgent).toHaveBeenCalledTimes(2);
      expect(host.querySelector('[role="alert"]')?.textContent).toContain(
        'Revision history could not be verified.'
      );
      expect(host.textContent).not.toContain(current.ownerRef);
      expect(host.textContent).not.toContain('991 · private-version-991');

      const refreshed = { ...current, revision: 992, ownerRef: 'newly-authorized-owner' };
      vi.mocked(getDwaionAdminAgent).mockResolvedValue({
        current: refreshed,
        history: [refreshed],
      });
      await act(async () => client.refetchQueries({ queryKey }));
      await waitForQuery('success');
      expect(host.querySelector('[role="alert"]')).toBeNull();
      expect(host.textContent).toContain(refreshed.ownerRef);
      expect(host.textContent).not.toContain(current.ownerRef);
    }
  );
});
