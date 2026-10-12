// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClockIngestionWorkspace } from '../pages/clock-ingestion-workspace';
import { clockIngestionCopy } from '../model/clock-ingestion-copy';

import type { ClockIngestionDataSource } from '../api/clock-ingestion-api';
import type { ClockIngestionScope } from '../model/clock-ingestion-model';

const scope: ClockIngestionScope = {
  ready: true,
  contextScopeKey: 'hcm-scope-clock-ingestion',
  decisionRevision: 'psr-clock-9',
  locale: 'en-US',
  timeZone: 'UTC',
  correlationId: '50000000-0000-4000-8000-000000000001',
};

describe('clock ingestion workspace runtime', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('performs no owner I/O without the Control-provided binding', async () => {
    await act(async () => {
      root.render(
        createElement(ClockIngestionWorkspace, {
          scope,
          copy: clockIngestionCopy('en'),
        })
      );
      await Promise.resolve();
    });
    expect(host.textContent).toContain('Clock evidence is unavailable');
    expect(host.textContent).toContain('No owner facts were returned');
  });

  it('retains accepted facts when IAQ-042 fails and reports one partial projection', async () => {
    const readEvents = vi.fn(async () => ({
      queryState: 'EMPTY' as const,
      freshness: 'CURRENT' as const,
      asOf: '2026-10-12T02:00:00Z',
      nextCursor: null,
      partialFailures: [],
      events: [],
    }));
    const readExceptions = vi.fn(async () => {
      throw new Error('unavailable');
    });
    const dataSource: ClockIngestionDataSource = {
      readEvents,
      readExceptions,
      record: vi.fn(),
      voidEvent: vi.fn(),
    };

    await act(async () => {
      root.render(
        createElement(ClockIngestionWorkspace, {
          scope,
          copy: clockIngestionCopy('en'),
          ownerBinding: {
            dataSource,
            canIngest: false,
            canVoid: false,
            onIngest: vi.fn(),
            onVoid: vi.fn(),
          },
        })
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(readEvents).toHaveBeenCalledTimes(1);
    expect(readExceptions).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Some clock evidence is unavailable');
    expect(host.textContent).toContain('TIME_EXCEPTIONS_UNAVAILABLE');
  });
});
