// @vitest-environment jsdom
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', async () => {
  const { hcmTestUseTranslation } = await import('../../../../../test-utils/hcm-i18n-test-stub');
  return { useTranslation: hcmTestUseTranslation };
});

import { HrisWorkflowPolicyWorkspace } from '../pages/hris-workflow-policy-workspace';
import { policy, workflowAdmission } from './hris-approval-adapter-fixtures.test-support';

import type { HrisWorkflowPolicyDataSource } from '../api/hris-workflow-policy-adapter';

describe('HRIS workflow policy workspace', () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    window.history.replaceState(null, '', '/hr/settings/workflow?tab=overview');
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    document.body.replaceChildren();
  });

  it('is default-off and starts no owner query without exact admission', async () => {
    const source: HrisWorkflowPolicyDataSource = {
      list: vi.fn(),
      publish: vi.fn(),
    };
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <HrisWorkflowPolicyWorkspace dataSource={source} />
        </QueryClientProvider>
      )
    );
    expect(host.querySelector('[data-runtime-state="OFF"]')).not.toBeNull();
    expect(source.list).not.toHaveBeenCalled();
    expect(source.publish).not.toHaveBeenCalled();
  });

  it('loads only the authorized owner scope and removes a stale focus without disclosure', async () => {
    window.history.replaceState(
      null,
      '',
      '/hr/settings/workflow?tab=overview&focus=missing-policy'
    );
    const source: HrisWorkflowPolicyDataSource = {
      list: vi.fn().mockResolvedValue([policy()]),
      publish: vi.fn(),
    };
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <HrisWorkflowPolicyWorkspace admission={workflowAdmission()} dataSource={source} />
        </QueryClientProvider>
      )
    );
    await vi.waitFor(() => expect(source.list).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(window.location.search).toContain('focus=policy-0001'));
    expect(source.list).toHaveBeenCalledWith('approval-admin-scope-42', expect.any(AbortSignal));
    expect(host.textContent).toContain('HR change approval policy');
    expect(source.publish).not.toHaveBeenCalled();
  });
});
