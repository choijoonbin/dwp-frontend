import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { matchRoutes, type RouteObject } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AccountHomeWorkspaceLegacyRedirect, accountRoutes } from './account-routes';

function matchedLeaf(pathname: string): RouteObject {
  const matches = matchRoutes(accountRoutes, pathname);
  expect(matches).toBeTruthy();
  return matches!.at(-1)!.route;
}

function elementChild(element: ReactNode): ReactElement<{ children?: ReactNode }> {
  expect(isValidElement(element)).toBe(true);
  return element as ReactElement<{ children?: ReactNode }>;
}

describe('Account application Home boundary', () => {
  it('keeps the canonical Home settings URL on the Account-owned settings summary', () => {
    expect(matchedLeaf('/account/settings/home').path).toBe('settings/:section');
  });

  it('routes legacy rich-studio children through the document-level Workspace handoff', () => {
    const route = matchedLeaf('/account/settings/home/history');
    expect(route.path).toBe('settings/home/:homeSection');

    const sectionGuard = elementChild(route.element);
    const redirect = elementChild(sectionGuard.props.children);
    expect(redirect.type).toBe(AccountHomeWorkspaceLegacyRedirect);
  });
});
