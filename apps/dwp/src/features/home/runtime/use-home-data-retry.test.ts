// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { retryHomeDataSources, useHomeDataRetry } from './use-home-data-retry';

describe('retryHomeDataSources', () => {
  it('starts every governed home source and waits for all of them', async () => {
    const overview = vi.fn().mockResolvedValue('overview');
    const notifications = vi.fn().mockResolvedValue('notifications');
    const contributions = vi.fn().mockResolvedValue('contributions');

    await retryHomeDataSources([overview, notifications, contributions]);

    expect(overview).toHaveBeenCalledOnce();
    expect(notifications).toHaveBeenCalledOnce();
    expect(contributions).toHaveBeenCalledOnce();
  });

  it('waits for independent sources to settle before reporting a failure', async () => {
    const failed = vi.fn().mockRejectedValue(new Error('unavailable'));
    let settleHealthy: (() => void) | undefined;
    const healthy = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settleHealthy = resolve;
        })
    );
    let transactionSettled = false;

    const transaction = retryHomeDataSources([failed, healthy]).finally(() => {
      transactionSettled = true;
    });

    await vi.waitFor(() => expect(failed).toHaveBeenCalledOnce());

    expect(healthy).toHaveBeenCalledOnce();
    expect(transactionSettled).toBe(false);

    settleHealthy?.();
    await expect(transaction).rejects.toThrow('unavailable');
    expect(transactionSettled).toBe(true);
  });

  it('coalesces synchronous retry requests into one in-flight transaction', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const settleSources: Array<() => void> = [];
    const source = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settleSources.push(resolve);
        })
    );
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const container = document.createElement('div');
    const root = createRoot(container);
    let retry: () => void = () => undefined;

    function Probe() {
      retry = useHomeDataRetry(['tenant-1', 'user-1'], [source]).retry;
      return null;
    }

    try {
      await act(async () => {
        root.render(createElement(QueryClientProvider, { client }, createElement(Probe)));
      });

      await act(async () => {
        retry();
        retry();
        await vi.waitFor(() => expect(source).toHaveBeenCalledOnce());
      });

      await act(async () => {
        settleSources[0]?.();
        await vi.waitFor(() => expect(client.isMutating()).toBe(0));
      });

      await act(async () => {
        retry();
        await vi.waitFor(() => expect(source).toHaveBeenCalledTimes(2));
      });

      await act(async () => {
        settleSources[1]?.();
        await vi.waitFor(() => expect(client.isMutating()).toBe(0));
      });
    } finally {
      await act(async () => root.unmount());
      client.clear();
    }
  });
});
