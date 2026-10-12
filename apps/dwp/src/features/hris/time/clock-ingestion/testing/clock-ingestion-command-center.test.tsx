// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClockIngestionCommandCenter } from '../components/clock-ingestion-command-center';
import { clockIngestionCopy } from '../model/clock-ingestion-copy';

import type { ClockEvidenceFilter } from '../components/clock-ingestion-command-center';
import type { ClockEvent, ClockWorkspace } from '../model/clock-ingestion-model';

const EVENT_ID = '40000000-0000-4000-8000-000000000001';
const EXCEPTION_ID = '40000000-0000-4000-8000-000000000006';

const event: ClockEvent = {
  clockEventId: EVENT_ID,
  deepLinkResourceId: EVENT_ID,
  title: 'IN clock event',
  statusCode: 'ACCEPTED',
  occurredAt: '2026-10-12T01:30:00Z',
  eventOrder: 1,
  qualityCode: 'SOURCE_SEQUENCE_GAP',
  evidenceDigest: 'b'.repeat(64),
  availableActions: [
    {
      actionKey: 'hris.action.tim.clock.void',
      method: 'POST',
      hrefTemplate: '/api/time/v1/clock-events/{eventId}/voids',
      idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
      stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
    },
  ],
};

const workspace: ClockWorkspace = {
  state: 'READY',
  freshness: 'CURRENT',
  asOf: '2026-10-12T02:00:00Z',
  failures: [],
  events: [event],
  exceptions: [
    {
      exceptionId: EXCEPTION_ID,
      deepLinkResourceId: EXCEPTION_ID,
      clockEventId: EVENT_ID,
      code: 'SOURCE_SEQUENCE_GAP',
      state: 'OPEN',
      eventOrder: 1,
      evidenceDigest: 'b'.repeat(64),
      availableActions: [],
    },
  ],
  eventPage: { asOf: '2026-10-12T02:00:00Z', nextCursor: null },
  exceptionPage: { asOf: '2026-10-12T02:00:00Z', nextCursor: null },
};

describe('clock ingestion command center', () => {
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

  it('exposes current work, linked exception review, and an append-only void action', async () => {
    const onVoid = vi.fn();

    function Harness() {
      const [selected, setSelected] = useState<string | null>(null);
      const [filter, setFilter] = useState<ClockEvidenceFilter>('ALL');
      return createElement(ClockIngestionCommandCenter, {
        workspace,
        copy: clockIngestionCopy('ko'),
        entryMode: 'CLOCK_INGESTION',
        selectedEventId: selected,
        filter,
        canIngest: true,
        canVoid: true,
        onSelectEvent: (selectedEvent) => setSelected(selectedEvent.clockEventId),
        onSelectException: (exception) => setSelected(exception.clockEventId),
        onFilterChange: setFilter,
        onIngest: vi.fn(),
        onVoid,
      });
    }

    await act(async () => root.render(createElement(Harness)));
    expect(host.textContent).toContain('순서가 보장된 출퇴근 증적');
    expect(host.textContent).toContain('SOURCE_SEQUENCE_GAP');
    expect(host.textContent).toContain('미해결 예외');

    const review = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === '검토'
    );
    expect(review).toBeDefined();
    await act(async () => review?.click());
    expect(host.textContent).toContain('원본 증적은 변경되지 않고 그대로 보존됩니다.');

    const voidButton = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === '정정 무효화 추가'
    );
    expect(voidButton).toBeDefined();
    await act(async () => voidButton?.click());
    expect(onVoid).toHaveBeenCalledWith(event);
  });

  it('keeps unavailable and partial states distinct', async () => {
    await act(async () => {
      root.render(
        createElement(ClockIngestionCommandCenter, {
          workspace: {
            ...workspace,
            state: 'PARTIAL',
            freshness: 'STALE',
            failures: ['TIME_EXCEPTIONS_UNAVAILABLE'],
          },
          copy: clockIngestionCopy('en'),
          entryMode: 'TIME_EXCEPTIONS',
          selectedEventId: null,
          filter: 'ALL',
          onSelectEvent: vi.fn(),
          onSelectException: vi.fn(),
          onFilterChange: vi.fn(),
        })
      );
    });
    expect(host.textContent).toContain('Some clock evidence is unavailable');
    expect(host.textContent).toContain('Clock evidence may be stale');
    expect(host.textContent).toContain('TIME_EXCEPTIONS_UNAVAILABLE');
    expect(host.textContent).toContain('Time exceptions');
    expect(host.textContent).toContain('Prioritize open clock exceptions');
  });

  it('never exposes a corrective command when the item omits its exact availableAction', async () => {
    await act(async () => {
      root.render(
        createElement(ClockIngestionCommandCenter, {
          workspace: {
            ...workspace,
            events: [{ ...event, availableActions: [] }],
          },
          copy: clockIngestionCopy('en'),
          entryMode: 'CLOCK_INGESTION',
          selectedEventId: EVENT_ID,
          filter: 'ALL',
          canVoid: true,
          onSelectEvent: vi.fn(),
          onSelectException: vi.fn(),
          onFilterChange: vi.fn(),
          onVoid: vi.fn(),
        })
      );
    });
    expect(host.textContent).not.toContain('Append corrective void');
  });
});
