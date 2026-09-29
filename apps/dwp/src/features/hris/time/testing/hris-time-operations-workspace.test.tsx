// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import enHcm from '../../../../../../../libs/shared-i18n/src/locales/en/hcm.json';

import {
  HrisTimeOperationsWorkspaceRuntime,
  resolveHrisTimeWorkPlanOperationsScope,
  resolveWorkPlanOperationsEffectiveOn,
  workPlanOperationsToday,
} from '../index';

import type { HrisTimeWorkPlanOperationsOwnerBinding, WorkPlanStudioDataSource } from '../index';
import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';

const requestScope: ProductSurfaceRequestScope = {
  governed: true,
  ready: true,
  contextScopeKey: 'scope:tenant/time-operations',
  cacheKey: [
    'tenant-1',
    'actor-1',
    'NORMAL',
    'hcm.operations',
    'scope:tenant/time-operations',
    'psr-work-plan-revision',
  ],
  queryMeta: {
    accessSensitive: true,
    tenantId: 'tenant-1',
    actorId: 'actor-1',
    accessMode: 'NORMAL',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    contextScopeKey: 'scope:tenant/time-operations',
    decisionRevision: 'psr-work-plan-revision',
  },
};

const effectiveOn = '2026-09-29';
const operationsI18n = createInstance();

function withHcmI18n(children: ReactNode) {
  return createElement(I18nextProvider, { i18n: operationsI18n }, children);
}

function emptyCatalog() {
  return {
    queryState: 'EMPTY',
    freshness: 'CURRENT',
    asOf: '2026-09-29T00:00:00Z',
    partialFailures: [],
    workPlans: [],
  };
}

describe('HRIS time operations workspace adapter', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeAll(async () => {
    await operationsI18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      defaultNS: 'hcm',
      ns: ['hcm'],
      resources: { en: { hcm: enHcm } },
      interpolation: { escapeValue: false },
    });
  });

  beforeEach(async () => {
    await operationsI18n.changeLanguage('en');
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

  it('binds a runtime scope to the exact tenant scope, revision, and effective date', () => {
    expect(resolveHrisTimeWorkPlanOperationsScope(requestScope, effectiveOn)).toEqual({
      ready: true,
      scopeKey: 'scope:tenant/time-operations',
      decisionRevision: 'psr-work-plan-revision',
      effectiveOn,
    });
    expect(
      resolveHrisTimeWorkPlanOperationsScope(
        {
          ...requestScope,
          cacheKey: [
            requestScope.cacheKey[0],
            requestScope.cacheKey[1],
            requestScope.cacheKey[2],
            requestScope.cacheKey[3],
            requestScope.cacheKey[4],
            'different-revision',
          ],
        },
        effectiveOn
      )
    ).toBeNull();
    expect(resolveHrisTimeWorkPlanOperationsScope(requestScope, '2026-02-30')).toBeNull();
  });

  it('uses a valid effectiveOn query value and safely falls back for invalid input', () => {
    expect(resolveWorkPlanOperationsEffectiveOn('2026-10-01', effectiveOn)).toBe('2026-10-01');
    expect(resolveWorkPlanOperationsEffectiveOn('2026-02-30', effectiveOn)).toBe(effectiveOn);
    expect(workPlanOperationsToday('Asia/Seoul', '2026-09-28T16:00:00Z')).toBe('2026-09-29');
  });

  it('keeps the owner API closed while scope binding is incomplete', async () => {
    const dataSource: WorkPlanStudioDataSource = {
      read: vi.fn(() => Promise.resolve(emptyCatalog())),
      simulate: vi.fn(() => Promise.resolve({})),
      reconcileReceipt: vi.fn(() => Promise.resolve({})),
    };
    const ownerBinding: HrisTimeWorkPlanOperationsOwnerBinding = {
      dataSource,
      simulationExecutor: vi.fn(),
    };

    await act(async () => {
      root.render(
        withHcmI18n(
          createElement(HrisTimeOperationsWorkspaceRuntime, {
            requestScope: { ...requestScope, ready: false },
            effectiveOn,
            ownerBinding,
          })
        )
      );
      await Promise.resolve();
    });

    expect(dataSource.read).not.toHaveBeenCalled();
    expect(ownerBinding.simulationExecutor).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="hris-time-operations-closed-scope"]')).not.toBeNull();
  });

  it('keeps the owner API closed until an exact owner binding is injected', async () => {
    await act(async () => {
      root.render(
        withHcmI18n(
          createElement(HrisTimeOperationsWorkspaceRuntime, {
            requestScope,
            effectiveOn,
          })
        )
      );
      await Promise.resolve();
    });

    expect(
      host.querySelector('[data-testid="hris-time-operations-closed-owner-contract"]')
    ).not.toBeNull();
    expect(host.textContent).toContain('No work-plan data or simulations have been requested.');
  });

  it('opens only with an injected owner binding and passes the bound scope to its read', async () => {
    const read = vi.fn(() => Promise.resolve(emptyCatalog()));
    const ownerBinding: HrisTimeWorkPlanOperationsOwnerBinding = {
      dataSource: {
        read,
        simulate: vi.fn(() => Promise.resolve({})),
        reconcileReceipt: vi.fn(() => Promise.resolve({})),
      },
      simulationExecutor: vi.fn(),
    };

    await act(async () => {
      root.render(
        withHcmI18n(
          createElement(HrisTimeOperationsWorkspaceRuntime, {
            requestScope,
            effectiveOn,
            ownerBinding,
          })
        )
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(read).toHaveBeenCalledWith(
      {
        ready: true,
        scopeKey: 'scope:tenant/time-operations',
        decisionRevision: 'psr-work-plan-revision',
        effectiveOn,
      },
      expect.any(AbortSignal)
    );
    expect(ownerBinding.simulationExecutor).not.toHaveBeenCalled();
  });
});
