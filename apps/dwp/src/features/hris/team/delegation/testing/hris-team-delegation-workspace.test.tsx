// @vitest-environment jsdom
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HrisTeamDelegationWorkspace } from '../pages/hris-team-delegation-workspace';
import {
  delegation,
  delegationAdmission,
} from '../../../administration/workflow/testing/hris-approval-adapter-fixtures.test-support';

import type { HrisDelegationDataSource } from '../api/hris-delegation-adapter';

describe('HRIS team delegation workspace', () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    window.history.replaceState(null, '', '/hr/team/delegation?tab=overview');
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

  it('is default-off and starts no owner query or mutation without exact admission', async () => {
    const source: HrisDelegationDataSource = {
      list: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
    };
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <HrisTeamDelegationWorkspace dataSource={source} />
        </QueryClientProvider>
      )
    );
    expect(host.querySelector('[data-runtime-state="OFF"]')).not.toBeNull();
    expect(source.list).not.toHaveBeenCalled();
    expect(source.create).not.toHaveBeenCalled();
    expect(source.revoke).not.toHaveBeenCalled();
  });

  it('loads only the installed population scope and renders explicit owner state', async () => {
    const source: HrisDelegationDataSource = {
      list: vi.fn().mockResolvedValue([delegation()]),
      create: vi.fn(),
      revoke: vi.fn(),
    };
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <HrisTeamDelegationWorkspace admission={delegationAdmission()} dataSource={source} />
        </QueryClientProvider>
      )
    );
    await vi.waitFor(() => expect(source.list).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(host.textContent).toContain('Alex Delegate'));
    expect(source.list).toHaveBeenCalledWith('approval-work-scope-42', expect.any(AbortSignal));
    expect(host.textContent).toContain('Alex Delegate');
    expect(host.textContent).toContain('subject revision 9');
    expect(source.create).not.toHaveBeenCalled();
    expect(source.revoke).not.toHaveBeenCalled();
  });
});
