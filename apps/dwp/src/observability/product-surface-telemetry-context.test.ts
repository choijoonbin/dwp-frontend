// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProductSurfaceTelemetry } from './product-surface-telemetry-context';
import ProductSurfaceTelemetryProvider from './product-surface-telemetry-provider';

import type { ProductSurfaceTelemetryEvent } from '@dwp-frontend/shared-utils/api/observability-api';

const UUID_ONE =
  'd2e63316-8564-4d8c-bd02-eaede882f982' as `${string}-${string}-${string}-${string}-${string}`;
const UUID_TWO =
  '2df2663c-0e19-4e6c-934c-84d8b0d95ce2' as `${string}-${string}-${string}-${string}-${string}`;
const UUID_THREE =
  '3b9f4b6d-bcd5-4a56-b1b6-72bf85a298eb' as `${string}-${string}-${string}-${string}-${string}`;
const UUID_FOUR =
  '41ee13b4-66b8-480d-a039-140510b1ca67' as `${string}-${string}-${string}-${string}-${string}`;

type Telemetry = ReturnType<typeof useProductSurfaceTelemetry>;

let root: Root | null;
let container: HTMLDivElement | null;
let telemetry: Telemetry | null;
let nowMs: number;
let report: ReturnType<typeof vi.fn<(event: ProductSurfaceTelemetryEvent) => Promise<void>>>;

function TelemetryProbe() {
  telemetry = useProductSurfaceTelemetry();
  return null;
}

async function mountTelemetry() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      createElement(
        ProductSurfaceTelemetryProvider,
        {
          privacyConsentGranted: true,
          productionCollectionEnabled: true,
          report,
        },
        createElement(TelemetryProbe)
      )
    );
  });
}

function events(): ProductSurfaceTelemetryEvent[] {
  return report.mock.calls.map(([event]) => event);
}

function attemptId(event: ProductSurfaceTelemetryEvent): string {
  if (!('attemptId' in event)) throw new Error(`Missing attempt ID: ${event.eventName}`);
  return event.attemptId;
}

describe('mounted product surface telemetry journeys', () => {
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    root = null;
    container = null;
    telemetry = null;
    nowMs = 0;
    report = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(UUID_ONE)
      .mockReturnValueOnce(UUID_TWO)
      .mockReturnValueOnce(UUID_THREE)
      .mockReturnValue(UUID_FOUR);
    await mountTelemetry();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
    vi.restoreAllMocks();
  });

  it('correlates exposure, first task, and return without rotating the journey attempt', () => {
    act(() => telemetry?.captureExposure('approvals', 'approvals.admin', 'DESKTOP'));
    nowMs = 1_400;
    let task: ReturnType<Telemetry['beginTask']> | undefined;
    act(() => {
      task = telemetry?.beginTask('approvals', 'approvals.admin', 'ADMINISTRATION');
    });
    nowMs = 5_600;
    act(() =>
      telemetry?.completeTask(
        'approvals',
        'approvals.admin',
        'ADMINISTRATION',
        task!.attemptId,
        task!.startedAtMs
      )
    );
    nowMs = 20_000;
    act(() => telemetry?.captureReturn('approvals', 'approvals.admin', 'approvals.work'));
    nowMs = 20_100;
    act(() => telemetry?.captureExposure('approvals', 'approvals.work', 'DESKTOP'));

    const captured = events();
    expect(captured.map((event) => event.eventName)).toEqual([
      'surface.exposed',
      'surface.task.started',
      'surface.task.completed',
      'surface.returned',
      'surface.exposed',
    ]);
    expect(new Set(captured.map((event) => 'attemptId' in event && event.attemptId))).toEqual(
      new Set([UUID_ONE])
    );
    expect(captured[2]).toMatchObject({ elapsedBucket: 'S1_TO_5' });
    expect(captured[3]).toMatchObject({ elapsedBucket: 'S15_TO_30' });
  });

  it('shares switch and first scope timing, then rotates for the next task attempt', () => {
    act(() => telemetry?.beginSurfaceSwitch('hcm', 'hcm.personal', 'hcm.management'));
    nowMs = 2_500;
    act(() => telemetry?.captureExposure('hcm', 'hcm.management', 'TABLET'));
    nowMs = 3_000;
    let scope: ReturnType<Telemetry['beginScopeSwitch']> | undefined;
    act(() => {
      scope = telemetry?.beginScopeSwitch('hcm', 'hcm.management', 'RESOURCE_SET');
    });
    nowMs = 4_100;
    act(() =>
      telemetry?.completeScopeSwitch(
        'hcm',
        'hcm.management',
        'RESOURCE_SET',
        scope!.attemptId,
        scope!.startedAtMs
      )
    );
    nowMs = 5_000;
    let task: ReturnType<Telemetry['beginTask']> | undefined;
    act(() => {
      task = telemetry?.beginTask('hcm', 'hcm.management', 'DESIGN');
    });
    nowMs = 6_000;
    act(() =>
      telemetry?.abandonTask('hcm', 'hcm.management', 'DESIGN', task!.attemptId, task!.startedAtMs)
    );

    const captured = events();
    expect(captured.map((event) => event.eventName)).toEqual([
      'surface.switch.started',
      'surface.switch.completed',
      'surface.exposed',
      'surface.scope.switch.started',
      'surface.scope.switch.completed',
      'surface.task.started',
      'surface.task.abandoned',
    ]);
    expect(captured.slice(0, 5).every((event) => attemptId(event) === UUID_ONE)).toBe(true);
    expect(captured.slice(5).every((event) => attemptId(event) === UUID_TWO)).toBe(true);
  });

  it('settles an initial scope choice only after exact route authority resolves', () => {
    act(() => telemetry?.beginScopeSwitch('approvals', 'approvals.admin', 'RESOURCE_SET'));
    nowMs = 2_400;
    act(() =>
      telemetry?.completePendingScopeSwitch('approvals', 'approvals.admin', 'RESOURCE_SET')
    );
    act(() => telemetry?.beginScopeSwitch('hcm', 'hcm.management', 'LEGAL_ENTITY'));
    act(() => telemetry?.failPendingScopeSwitch('hcm', 'hcm.management', 'SCOPE_INVALID'));

    const captured = events();
    expect(captured.map((event) => event.eventName)).toEqual([
      'surface.scope.switch.started',
      'surface.scope.switch.completed',
      'surface.scope.switch.started',
      'surface.scope.switch.failed',
    ]);
    expect(captured.slice(0, 2).every((event) => attemptId(event) === UUID_ONE)).toBe(true);
    expect(captured.slice(2).every((event) => attemptId(event) === UUID_TWO)).toBe(true);
    expect(captured[1]).toMatchObject({ elapsedBucket: 'S1_TO_5' });
    expect(captured[3]).toMatchObject({ reasonCode: 'SCOPE_INVALID' });
  });

  it('cancels replaced surface and scope journeys before starting their successors', () => {
    act(() => telemetry?.beginSurfaceSwitch('hcm', 'hcm.personal', 'hcm.management'));
    act(() => telemetry?.beginSurfaceSwitch('hcm', 'hcm.personal', 'hcm.operations'));
    act(() => telemetry?.beginScopeSwitch('hcm', 'hcm.operations', 'LEGAL_ENTITY'));
    act(() => telemetry?.beginScopeSwitch('hcm', 'hcm.operations', 'RESOURCE_SET'));

    const captured = events();
    expect(captured.map((event) => event.eventName)).toEqual([
      'surface.switch.started',
      'surface.switch.failed',
      'surface.switch.started',
      'surface.scope.switch.started',
      'surface.scope.switch.failed',
      'surface.scope.switch.started',
    ]);
    expect(captured[1]).toMatchObject({ attemptId: UUID_ONE, reasonCode: 'CANCELLED' });
    expect(captured[4]).toMatchObject({ attemptId: UUID_THREE, reasonCode: 'CANCELLED' });
  });
});
