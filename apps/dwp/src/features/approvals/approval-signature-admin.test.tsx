// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';
import { ApprovalSignatureAdmin } from './approval-signature-admin';
import type * as Shared from '@dwp-frontend/shared-utils';
import type { ApprovalSignatureProvider } from '@dwp-frontend/shared-utils';

const state = vi.hoisted(() => ({ ready: true, read: vi.fn<() => Promise<unknown[]>>() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ko', resolvedLanguage: 'ko' },
  }),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof Shared>()),
  getApprovalSignatureProviders: () => state.read(),
}));
vi.mock('./use-approval-experience', () => ({
  useApprovalManagementRequestScope: () => ({
    contextScopeKey: 'actual-scope',
    cacheKey: ['1', '13', 'NORMAL', 'approvals.admin', 'actual-scope', 'actual-revision'],
  }),
}));
vi.mock('./approval-management-scope', () => ({
  useApprovalManagementScopeReady: () => state.ready,
}));
vi.mock('./approval-admin-attachment-policy-controller', () => ({
  ApprovalAdminAttachmentPolicyController: () => null,
}));
const provider: ApprovalSignatureProvider = {
  providerId: '11111111-1111-4111-8111-111111111111',
  providerKey: 'INTERNAL_ATTESTATION',
  displayName: 'Current internal attestation',
  providerType: 'INTERNAL_ATTESTATION',
  lifecycleState: 'ACTIVE',
  capabilities: {
    readiness: 'READY',
    internalAttestation: true,
    auditEvidence: true,
    verifiedIdentity: true,
  },
  credentialConfigured: false,
  version: 1,
  lastHealthCheckedAt: '2026-09-14T00:00:00Z',
};
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
const key = [
  'approvals',
  'admin',
  'signatures',
  '1',
  '13',
  'NORMAL',
  'approvals.admin',
  'actual-scope',
  'actual-revision',
];
const render = () =>
  root.render(
    <QueryClientProvider client={client}>
      <ApprovalSignatureAdmin />
    </QueryClientProvider>
  );
const settle = async (callback: () => void = () => {}) => {
  await act(async () => {
    callback();
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
};
describe('signature admin actual source readiness presentation', () => {
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    state.ready = true;
    state.read.mockResolvedValue([provider]);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await settle(render);
    await settle();
    expect(container.textContent).toContain('status.READY');
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
  });
  it('first 403 masks cached provider and does not retry authority', async () => {
    state.read.mockRejectedValue(new HttpError('Denied', 403));
    await settle(() => {
      void client.refetchQueries({ queryKey: key, exact: true });
    });
    await settle();
    expect(container.textContent).not.toContain(provider.displayName);
    expect(container.textContent).not.toContain('status.READY');
    expect(state.read).toHaveBeenCalledTimes(2);
  });
  it('first generic 503 retry hold closes READY before isError becomes final', async () => {
    state.read.mockRejectedValue(
      new HttpError('Unavailable', 503, { errorCode: 'TEMPORARY_UNAVAILABLE' })
    );
    await settle(() => {
      void client.refetchQueries({ queryKey: key, exact: true });
    });
    await settle();
    expect(client.getQueryState(key)?.fetchStatus).toBe('fetching');
    expect(container.textContent).toContain(provider.displayName);
    expect(container.textContent).toContain('status.UNKNOWN');
    expect(container.textContent).not.toContain('status.READY');
    expect(container.textContent).toContain('admin.signatures.sourceStale');
  });
  it('authority 503 is read-only unknown and no retry; fresh 200 alone recovers', async () => {
    state.read.mockRejectedValue(
      new HttpError('Authority unavailable', 503, { errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE' })
    );
    await settle(() => {
      void client.refetchQueries({ queryKey: key, exact: true });
    });
    await settle();
    expect(state.read).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('status.UNKNOWN');
    expect(container.textContent).not.toContain('status.READY');
    state.read.mockResolvedValue([provider]);
    await settle(() => {
      void client.refetchQueries({ queryKey: key, exact: true });
    });
    await settle();
    expect(container.textContent).toContain('status.READY');
    expect(container.textContent).not.toContain('admin.signatures.sourceStale');
  });
  it('in-flight refresh and runtime missing capabilities never reuse cached READY', async () => {
    let resolve!: (providers: unknown[]) => void;
    state.read.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    await settle(() => {
      void client.refetchQueries({ queryKey: key, exact: true });
    });
    expect(container.textContent).toContain('status.UNKNOWN');
    expect(container.textContent).toContain('admin.signatures.sourceChecking');
    expect(container.textContent).not.toContain('status.READY');
    const { capabilities: _capabilities, ...withoutCapabilities } = provider;
    await settle(() => resolve([withoutCapabilities]));
    await settle();
    expect(container.textContent).toContain(provider.displayName);
    expect(container.textContent).toContain('status.UNKNOWN');
    expect(container.textContent).not.toContain('status.READY');
  });
  it('current scope revocation masks cached configuration independent of directory grants', async () => {
    state.ready = false;
    await settle(render);
    expect(container.textContent).not.toContain(provider.displayName);
    expect(container.textContent).not.toContain('status.READY');
  });
});
