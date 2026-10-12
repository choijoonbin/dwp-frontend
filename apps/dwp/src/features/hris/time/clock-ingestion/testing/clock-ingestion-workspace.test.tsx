// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClockIngestionWorkspace } from '../pages/clock-ingestion-workspace';
import { clockIngestionCopy } from '../model/clock-ingestion-copy';

import type { ClockIngestionDataSource } from '../api/clock-ingestion-api';
import type {
  ClockEvent,
  ClockException,
  ClockIngestionScope,
} from '../model/clock-ingestion-model';

const scope: ClockIngestionScope = {
  ready: true,
  contextScopeKey: 'hcm-scope-clock-ingestion',
  decisionRevision: 'psr-clock-9',
  locale: 'en-US',
  timeZone: 'UTC',
  correlationId: '50000000-0000-4000-8000-000000000001',
};
const EVENT_ID = '50000000-0000-4000-8000-000000000002';
const EXCEPTION_ID = '50000000-0000-4000-8000-000000000003';
const event: ClockEvent = {
  clockEventId: EVENT_ID,
  deepLinkResourceId: EVENT_ID,
  title: 'IN clock event',
  statusCode: 'ACCEPTED',
  occurredAt: '2026-10-12T01:30:00Z',
  eventOrder: 1,
  qualityCode: 'SOURCE_SEQUENCE_GAP',
  evidenceDigest: 'a'.repeat(64),
  availableActions: [],
};
const exception: ClockException = {
  exceptionId: EXCEPTION_ID,
  deepLinkResourceId: EXCEPTION_ID,
  clockEventId: EVENT_ID,
  code: 'SOURCE_SEQUENCE_GAP',
  state: 'OPEN',
  eventOrder: 1,
  evidenceDigest: 'b'.repeat(64),
  availableActions: [],
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
          entryMode: 'CLOCK_INGESTION',
        })
      );
      await Promise.resolve();
    });
    expect(host.textContent).toContain('Clock evidence is unavailable');
    expect(host.textContent).toContain('No owner facts were returned');
  });

  it('retains accepted facts when IAQ-042 fails and reports one partial projection', async () => {
    const readEvents: ClockIngestionDataSource['readEvents'] = vi.fn(async () => ({
      queryState: 'EMPTY' as const,
      freshness: 'CURRENT' as const,
      asOf: '2026-10-12T02:00:00Z',
      nextCursor: null,
      partialFailures: [],
      events: [],
    }));
    const readExceptions: ClockIngestionDataSource['readExceptions'] = vi.fn(async () => {
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
          entryMode: 'CLOCK_INGESTION',
          ownerBinding: {
            eventPage: {
              routeContractKey: 'route.hcm.operations.time-clock-ingestion.page',
              read: dataSource.readEvents,
            },
            exceptionPage: {
              routeContractKey: 'route.hcm.operations.time-exceptions.page',
              read: dataSource.readExceptions,
            },
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

  it('restores a controlled deep-link focus and clears an exhausted invalid focus', async () => {
    const onFocusResourceChange = vi.fn();
    const readEvents = vi.fn<ClockIngestionDataSource['readEvents']>().mockResolvedValue({
      queryState: 'COMPLETE',
      freshness: 'CURRENT',
      asOf: '2026-10-12T02:00:00Z',
      nextCursor: null,
      partialFailures: [],
      events: [event],
    });
    const readExceptions = vi.fn<ClockIngestionDataSource['readExceptions']>().mockResolvedValue({
      queryState: 'COMPLETE',
      freshness: 'CURRENT',
      asOf: '2026-10-12T02:00:00Z',
      nextCursor: null,
      partialFailures: [],
      exceptions: [exception],
    });
    const ownerBinding = {
      eventPage: {
        routeContractKey: 'route.hcm.operations.time-clock-ingestion.page' as const,
        read: readEvents,
      },
      exceptionPage: {
        routeContractKey: 'route.hcm.operations.time-exceptions.page' as const,
        read: readExceptions,
      },
    };

    await act(async () => {
      root.render(
        createElement(ClockIngestionWorkspace, {
          scope,
          copy: clockIngestionCopy('en'),
          entryMode: 'CLOCK_INGESTION',
          ownerBinding,
          focusResourceId: EVENT_ID,
          onFocusResourceChange,
        })
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain('Original evidence remains immutable.');
    expect(onFocusResourceChange).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        createElement(ClockIngestionWorkspace, {
          scope,
          copy: clockIngestionCopy('en'),
          entryMode: 'CLOCK_INGESTION',
          ownerBinding,
          focusResourceId: 'missing-resource',
          onFocusResourceChange,
        })
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onFocusResourceChange).toHaveBeenCalledWith(null);
  });

  it('continues event and exception pages with their own first asOf and cursor', async () => {
    const readEvents = vi
      .fn<ClockIngestionDataSource['readEvents']>()
      .mockImplementation(async (_scope, page) => ({
        queryState: 'COMPLETE',
        freshness: 'CURRENT',
        asOf: '2026-10-12T02:00:00Z',
        nextCursor: page.cursor ? null : 'eventcursor000001',
        partialFailures: [],
        events: [event],
      }));
    const readExceptions = vi
      .fn<ClockIngestionDataSource['readExceptions']>()
      .mockImplementation(async (_scope, page) => ({
        queryState: 'COMPLETE',
        freshness: 'CURRENT',
        asOf: '2026-10-12T03:00:00Z',
        nextCursor: page.cursor ? null : 'exceptioncursor01',
        partialFailures: [],
        exceptions: [exception],
      }));

    await act(async () => {
      root.render(
        createElement(ClockIngestionWorkspace, {
          scope,
          copy: clockIngestionCopy('en'),
          entryMode: 'TIME_EXCEPTIONS',
          ownerBinding: {
            eventPage: {
              routeContractKey: 'route.hcm.operations.time-clock-ingestion.page',
              read: readEvents,
            },
            exceptionPage: {
              routeContractKey: 'route.hcm.operations.time-exceptions.page',
              read: readExceptions,
            },
          },
        })
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    const more = [...host.querySelectorAll('button')].filter(
      (button) => button.textContent === 'Load more'
    );
    expect(more).toHaveLength(2);
    await act(async () => {
      more[0]?.click();
      more[1]?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(readEvents.mock.calls[1]?.[1]).toEqual({
      asOf: '2026-10-12T02:00:00Z',
      cursor: 'eventcursor000001',
    });
    expect(readExceptions.mock.calls[1]?.[1]).toEqual({
      asOf: '2026-10-12T03:00:00Z',
      cursor: 'exceptioncursor01',
    });
  });
});
