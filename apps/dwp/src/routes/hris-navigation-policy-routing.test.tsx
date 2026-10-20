import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import {
  HCM_CONFIGURED_TASK_NAVIGATION_LAYOUT_PROPS,
  HrisWorkbenchPolicyIndex,
  hcmRoutes,
  resolveHcmAuthorizedNavigationPaths,
  resolveHrisWorkbenchPolicyAccessState,
} from './hcm-routes';
import { ProductCanaryRoot } from './product-surface-canary-routes';
import { HCM_LEGACY_TASK_NAVIGATION_LAYOUT_PROPS } from '../layouts/hcm-layout';
import { HRIS_TASK_NAVIGATION_LAYOUT_PROPS } from '../features/hris/shell/navigation-policy';

import type { HrisWorkbenchId } from '../features/hris/shell/navigation-policy';
import type { RouteObject } from 'react-router-dom';

describe('HRIS aggregate landing route wiring', () => {
  it('uses one inline task-navigation presentation in legacy and configured shells', () => {
    expect(HCM_LEGACY_TASK_NAVIGATION_LAYOUT_PROPS).toBe(HRIS_TASK_NAVIGATION_LAYOUT_PROPS);
    expect(HCM_CONFIGURED_TASK_NAVIGATION_LAYOUT_PROPS).toBe(HRIS_TASK_NAVIGATION_LAYOUT_PROPS);
    expect(HRIS_TASK_NAVIGATION_LAYOUT_PROPS.navigationChildrenPresentation).toBe('inline');
  });

  it('distinguishes an unavailable compatibility projection from an explicit empty projection', () => {
    expect(resolveHcmAuthorizedNavigationPaths(undefined)).toBeNull();
    expect(resolveHcmAuthorizedNavigationPaths(new Map())).toEqual(new Set());
    expect(
      resolveHcmAuthorizedNavigationPaths(
        new Map([
          ['/hr/me', { state: 'allowed' }],
          ['/hr/me/requests', { state: 'allowed' }],
        ])
      )
    ).toEqual(new Set(['/hr/me', '/hr/me/requests']));
  });

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
