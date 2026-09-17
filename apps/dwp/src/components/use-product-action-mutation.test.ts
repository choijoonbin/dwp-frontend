import { beforeEach, describe, expect, it, vi } from 'vitest';

const taskKind = vi.hoisted(() =>
  vi.fn(({ routeContractKey }: { routeContractKey: string }) => {
    if (routeContractKey === 'route.workplace.management.access-zones-by-zone-id-put.action') {
      throw new Error(`Unclassified governed mutation telemetry binding: ${routeContractKey}`);
    }
    return 'WORK' as const;
  })
);

vi.mock('../observability/product-surface-task-kind', () => ({
  resolveProductSurfaceTaskKind: taskKind,
}));

import {
  productActionMutationBinding,
  type ProductActionRouteContractKey,
} from './use-product-action-mutation';

describe('product ACTION mutation binding', () => {
  beforeEach(() => {
    taskKind.mockClear();
  });

  it('does not classify an unrelated ACTION while resolving a meeting command', () => {
    expect(
      productActionMutationBinding('route.meetings.work.intelligence-report-export.action')
    ).toEqual({
      productKey: 'meetings',
      surfaceKey: 'meetings.work',
      routeContractKey: 'route.meetings.work.intelligence-report-export.action',
      taskKind: 'WORK',
    });
    expect(taskKind).toHaveBeenCalledOnce();
  });

  it('still fails closed when the requested ACTION is unclassified', () => {
    expect(() =>
      productActionMutationBinding('route.workplace.management.access-zones-by-zone-id-put.action')
    ).toThrow(/Unclassified governed mutation telemetry binding/u);
  });

  it('rejects an unknown ACTION before attempting telemetry classification', () => {
    expect(() =>
      productActionMutationBinding(
        'route.meetings.work.unknown.action' as ProductActionRouteContractKey
      )
    ).toThrow(/Unknown governed product ACTION/u);
    expect(taskKind).not.toHaveBeenCalled();
  });
});
