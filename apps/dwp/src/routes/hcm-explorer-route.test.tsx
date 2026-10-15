import { readFileSync } from 'node:fs';
import { isValidElement, Suspense, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { ProductSurfaceAccessState } from '../components/product-surface-access-state';
import { ProductCanaryRouteBoundary } from './product-surface-canary-routes';
import { hcmRoutes } from './hcm-routes';
import { routeFallback } from './route-support';

import type { RouteObject } from 'react-router-dom';

type BoundaryProps = Readonly<{
  productId: string;
  surfaceId: string;
  routeContractKey: string;
  legacy: ReactNode;
  children: ReactNode;
}>;

function explorerRoute(): RouteObject {
  const root = hcmRoutes.find((route) => route.path === 'hr');
  const explorer = root?.children?.find((route) => route.path === 'explore');
  expect(explorer).toBeDefined();
  return explorer!;
}

function renderModuleBoundary(): ReactElement<BoundaryProps> {
  const element = explorerRoute().element;
  expect(isValidElement(element)).toBe(true);
  if (!isValidElement(element) || typeof element.type !== 'function') {
    throw new Error('Expected the sealed Explorer module boundary.');
  }
  const render = element.type as (props: BoundaryProps) => ReactElement;
  const rendered = render(element.props as BoundaryProps);
  expect(isValidElement<BoundaryProps>(rendered)).toBe(true);
  return rendered as ReactElement<BoundaryProps>;
}

describe('HCM Work Explorer governed route', () => {
  it('mounts only at /hr/explore with the exact hcm.utility PAGE contract', () => {
    const route = explorerRoute();
    expect(route.handle).toEqual({ routeContractKey: 'route.hcm.utility.explorer.page' });
    const boundary = renderModuleBoundary();
    expect(boundary.type).toBe(ProductCanaryRouteBoundary);
    expect(boundary.props).toMatchObject({
      productId: 'hcm',
      surfaceId: 'hcm.utility',
      routeContractKey: 'route.hcm.utility.explorer.page',
    });
    const chunkBoundary = boundary.props.children as ReactElement<{
      children: ReactNode;
      fallback: ReactNode;
    }>;
    expect(chunkBoundary.type).toBe(Suspense);
    expect(chunkBoundary.props.fallback).toBe(routeFallback);
    expect((chunkBoundary.props.children as ReactElement).type).toHaveProperty(
      '$$typeof',
      Symbol.for('react.lazy')
    );
  });

  it('keeps the legacy/default-off boundary withheld instead of mounting a static map', () => {
    const boundary = renderModuleBoundary();
    expect(isValidElement(boundary.props.legacy)).toBe(true);
    const legacy = boundary.props.legacy as ReactElement<{ decision: { state: string } }>;
    expect(legacy.type).toBe(ProductSurfaceAccessState);
    expect(legacy.props.decision).toEqual({ state: 'route-denied' });

    const source = readFileSync(new URL('./hcm-routes.tsx', import.meta.url), 'utf8');
    const explorerBoundary = source.slice(
      source.indexOf('function HcmWorkExplorerModuleBoundary'),
      source.indexOf('function hcmSurfaceRoutes')
    );
    expect(explorerBoundary).toContain('<Suspense fallback={routeFallback}>');
    expect(explorerBoundary).toContain('<HrisWorkExplorer />');
    expect(explorerBoundary).not.toContain('HrisProductMap');
  });

  it('does not add an eighth HRIS sidebar workbench', () => {
    const source = readFileSync(
      new URL('../features/hris/shell/model/hris-shell-navigation-contract.ts', import.meta.url),
      'utf8'
    );
    const shellEntries = source.slice(
      source.indexOf('export const HRIS_SHELL_ENTRIES'),
      source.indexOf('const HRIS_SHELL_EXCLUDED_PATHS')
    );
    expect(shellEntries.match(/view: 'workbench-/g)).toHaveLength(7);
    expect(shellEntries).not.toContain("'/hr/explore'");
  });
});
