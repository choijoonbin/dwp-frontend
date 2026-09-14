// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getByText } from '@testing-library/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApprovalSignatureProvider } from '@dwp-frontend/shared-utils';
import type * as Shared from '@dwp-frontend/shared-utils';
import { ApprovalSignatureAdmin } from './approval-signature-admin';

const state = vi.hoisted(() => ({ read: vi.fn<() => Promise<unknown[]>>() }));
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
    contextScopeKey: 'opaque-provider-context',
    cacheKey: ['1', '13', 'NORMAL', 'approvals.admin', 'opaque-provider-context', 'revision'],
  }),
}));
vi.mock('./approval-management-scope', () => ({
  useApprovalManagementScopeReady: () => true,
}));
vi.mock('./approval-admin-attachment-policy-controller', () => ({
  ApprovalAdminAttachmentPolicyController: () => null,
}));

const provider = (patch: Partial<ApprovalSignatureProvider> = {}): ApprovalSignatureProvider => ({
  providerId: '11111111-1111-4111-8111-111111111111',
  providerKey: 'DOCUSIGN',
  displayName: 'Native provider metadata',
  providerType: 'DOCUSIGN',
  lifecycleState: 'CONFIGURATION_REQUIRED',
  capabilities: {
    internalAttestation: false,
    auditEvidence: false,
    verifiedIdentity: false,
    remoteSigningSupported: true,
    readiness: 'CONFIGURATION_REQUIRED',
  },
  credentialConfigured: false,
  version: 1,
  lastHealthCheckedAt: null,
  ...patch,
});
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
async function mount(value: unknown) {
  state.read.mockResolvedValue([value]);
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <ApprovalSignatureAdmin />
      </QueryClientProvider>
    );
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
}
function valueFor(label: string) {
  const term = getByText(container, label);
  return term.parentElement?.querySelector('dd')?.textContent;
}
describe('signature admin separates declared metadata from actual verification', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
  });
  it('renders a declared DocuSign protocol without claiming adapter or production probe verification', async () => {
    await mount(provider({ credentialConfigured: true }));
    expect(valueFor('admin.signatures.declaredProtocolCapability')).toBe(
      'admin.signatures.protocolDeclared'
    );
    for (const key of ['adapterVerification', 'probeVerification']) {
      expect(valueFor(`admin.signatures.${key}`)).toBe('admin.signatures.verificationNotReported');
    }
    expect(container.textContent).toContain('admin.signatures.credentialReferenceRegistered');
    expect(container.textContent).not.toContain('admin.signatures.configured');
    expect(container.textContent).not.toContain('status.READY');
    expect(state.read).toHaveBeenCalledTimes(1);
  });
  it('a false Adobe protocol declaration is not described as a tested unsupported adapter', async () => {
    await mount(
      provider({
        providerKey: 'ADOBE_SIGN',
        providerType: 'ADOBE_SIGN',
        capabilities: { remoteSigningSupported: false, readiness: 'NOT_VERIFIED' },
      })
    );
    expect(valueFor('admin.signatures.declaredProtocolCapability')).toBe(
      'admin.signatures.protocolNotDeclared'
    );
    expect(container.textContent).toContain('admin.signatures.credentialReferenceMissing');
    expect(container.textContent).not.toContain('admin.signatures.notConfigured');
    expect(container.textContent).not.toContain('admin.signatures.capabilityUnsupported');
  });
  it('preserves internal metadata READY while explicitly separating native signing key verification', async () => {
    await mount(
      provider({
        providerKey: 'INTERNAL_ATTESTATION',
        providerType: 'INTERNAL_ATTESTATION',
        lifecycleState: 'ACTIVE',
        capabilities: {
          internalAttestation: true,
          auditEvidence: true,
          verifiedIdentity: true,
          readiness: 'READY',
        },
      })
    );
    const metadata = getByText(container, 'admin.signatures.metadataReadiness');
    expect(metadata.parentElement?.textContent).toContain('status.READY');
    expect(valueFor('admin.signatures.nativeKeyVerification')).toBe(
      'admin.signatures.verificationNotReported'
    );
    expect(container.textContent).not.toContain('VERIFIED_INTERNAL_KEY');
  });
  it('missing runtime capabilities remain UNKNOWN without guessing a protocol or readiness', async () => {
    const { capabilities: _capabilities, ...projection } = provider();
    await mount(projection);
    expect(container.textContent).toContain('status.UNKNOWN');
    expect(container.textContent).not.toContain('status.READY');
    expect(container.textContent).not.toContain('admin.signatures.protocolDeclared');
    expect(valueFor('admin.signatures.adapterVerification')).toBe(
      'admin.signatures.verificationNotReported'
    );
  });
});
