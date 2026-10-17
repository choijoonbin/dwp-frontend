import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import {
  HrisWorkbenchPolicyIndex,
  hcmRoutes,
  resolveHrisWorkbenchPolicyAccessState,
} from './hcm-routes';
import { ProductCanaryRoot } from './product-surface-canary-routes';

import type { HrisWorkbenchId } from '../features/hris/shell/navigation-policy';
import type { RouteObject } from 'react-router-dom';

describe('HRIS aggregate landing route wiring', () => {
  it('keeps /hr on the exact shell Home resolver', () => {
    const index = hrisRoot().children?.find((route) => route.index);
    expect(isValidElement(index?.element)).toBe(true);
    expect((index!.element as ReactElement).type).toBe(ProductCanaryRoot);
    expect((index!.element as ReactElement).props).toMatchObject({ legacyPath: '/hr/home' });
  });

  it.each([
    ['operations', 'HRIS-WB-HR-OPERATIONS'],
    ['team', 'HRIS-WB-TEAM'],
    ['manage', 'HRIS-WB-SETTINGS'],
  ] as const)('binds the %s index to its aggregate workbench landing', (path, workbenchId) => {
    const surface = hrisRoot().children?.find((route) => route.path === path);
    const index = surface?.children?.find((route) => route.index);
    expect(isValidElement(index?.element)).toBe(true);
    const element = index!.element as ReactElement<{
      workbenchId: HrisWorkbenchId;
      fallback: ReactNode;
    }>;
    expect(element.type).toBe(HrisWorkbenchPolicyIndex);
    expect(element.props.workbenchId).toBe(workbenchId);
    expect(element.props.fallback).toBeTruthy();
  });

  it('surfaces an invalid legal-entity selector as scope-invalid at a workbench index', () => {
    expect(resolveHrisWorkbenchPolicyAccessState('INVALID_LEGAL_ENTITY_SELECTOR')).toBe(
      'scope-invalid'
    );
  });
});

function hrisRoot(): RouteObject {
  const root = hcmRoutes.find((route) => route.path === 'hr');
  if (!root) throw new Error('Missing HRIS route root.');
  return root;
}
