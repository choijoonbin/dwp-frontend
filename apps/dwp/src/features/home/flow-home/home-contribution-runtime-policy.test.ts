import { describe, expect, it } from 'vitest';

import {
  hrHomeUnavailableSources,
  homeQuerySnapshotTimestamp,
  homeProviderQueryState,
  homeQueryRetry,
  homeHcmPulseAllRoute,
  isHomeAuthorizationFailure,
  promoteHomeProviderPartialState,
  resolveHomeContributionPermissions,
  trustedHomeSourceTimestamp,
} from './home-contribution-runtime-policy';
import { homeHcmReadAuthority } from './home-contribution-providers';
import { hasHomeContributionAuthority } from '../contributions';

import type { AppEntitlementPermission, HrHomeOverview } from '@dwp-frontend/shared-utils';
import { HttpError } from '@dwp-frontend/shared-utils';

const explicitPermission: AppEntitlementPermission = {
  resourceType: 'APP',
  resourceKey: 'APP.PEOPLE_DIRECTORY',
  permissionCode: 'VIEW',
  effect: 'ALLOW',
};

describe('Flow Home contribution runtime policy', () => {
  it('uses the HCM legacy role fallback only when the entitlement list is empty', () => {
    expect(resolveHomeContributionPermissions([], ['WORKSPACE_MEMBER'])).toEqual([]);
    expect(resolveHomeContributionPermissions([], ['WORKSPACE_MEMBER'], true)).toEqual([
      {
        resourceType: 'APP',
        resourceKey: 'APP.HCM',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
    ]);
    expect(resolveHomeContributionPermissions([], ['GUEST'])).toEqual([]);
    expect(resolveHomeContributionPermissions([explicitPermission], ['HR_ADMIN'])).toEqual([
      explicitPermission,
    ]);
  });

  it('matches only the backend HCM/HRIS read contract', () => {
    const permission = (resourceKey: string): AppEntitlementPermission => ({
      resourceType: 'APP',
      resourceKey,
      permissionCode: 'VIEW',
      effect: 'ALLOW',
    });

    expect(hasHomeContributionAuthority(homeHcmReadAuthority, [permission('APP.HCM')])).toBe(true);
    expect(hasHomeContributionAuthority(homeHcmReadAuthority, [permission('APP.HRIS')])).toBe(true);
    expect(
      hasHomeContributionAuthority(homeHcmReadAuthority, [permission('APP.PEOPLE_DIRECTORY')])
    ).toBe(false);
    expect(
      hasHomeContributionAuthority(homeHcmReadAuthority, [permission('APP.WORKFORCE_MANAGEMENT')])
    ).toBe(false);
  });

  it('promotes only an otherwise available provider to partial', () => {
    expect(promoteHomeProviderPartialState('AVAILABLE', true)).toBe('PARTIAL');
    expect(promoteHomeProviderPartialState('PARTIAL', true)).toBe('PARTIAL');
    expect(promoteHomeProviderPartialState('UNAVAILABLE', true)).toBe('UNAVAILABLE');
    expect(promoteHomeProviderPartialState('AVAILABLE', false)).toBe('AVAILABLE');
  });

  it('never fabricates freshness for missing source or query clocks', () => {
    expect(trustedHomeSourceTimestamp(undefined)).toBe('');
    expect(trustedHomeSourceTimestamp('not-an-instant')).toBe('');
    expect(trustedHomeSourceTimestamp('2026-08-25T01:00:00.000Z')).toBe('2026-08-25T01:00:00.000Z');
    expect(homeQuerySnapshotTimestamp(0)).toBe('');
    expect(homeQuerySnapshotTimestamp(Date.parse('2026-08-25T01:00:00.000Z'))).toBe(
      '2026-08-25T01:00:00.000Z'
    );
  });

  it('reports unavailable HCM domains and their reason codes deterministically', () => {
    const home = {
      domainStates: {
        TIME: { availability: 'UNAVAILABLE', dataOrigin: 'NONE', reasonCode: 'SOURCE_TIMEOUT' },
        PAY: { availability: 'AVAILABLE', dataOrigin: 'SOURCE', reasonCode: null },
        TEAM: { availability: 'UNAVAILABLE', dataOrigin: 'NONE' },
      },
    } as HrHomeOverview;

    expect(hrHomeUnavailableSources(home)).toEqual(['HCM.TEAM', 'HCM.TIME:SOURCE_TIMEOUT']);
  });

  it('fails cached query data closed as soon as authorization is revoked', () => {
    const forbidden = new HttpError('Forbidden', 403);
    expect(isHomeAuthorizationFailure(forbidden)).toBe(true);
    expect(
      homeProviderQueryState(true, {
        data: { private: 'cached' },
        loading: false,
        failed: true,
        refreshFailed: true,
        error: forbidden,
      })
    ).toBe('FORBIDDEN');
    expect(
      homeProviderQueryState(true, {
        data: { safe: true },
        loading: false,
        failed: true,
        refreshFailed: true,
        error: new HttpError('Unavailable', 503),
      })
    ).toBe('PARTIAL');
  });

  it('never retries authorization failures and allows only one transient retry', () => {
    expect(homeQueryRetry(0, new HttpError('Unauthorized', 401))).toBe(false);
    expect(homeQueryRetry(0, new HttpError('Forbidden', 403))).toBe(false);
    expect(homeQueryRetry(0, new HttpError('Unavailable', 503))).toBe(true);
    expect(homeQueryRetry(1, new HttpError('Unavailable', 503))).toBe(false);
  });

  it('uses a shared HCM destination only when every pulse has the same safe route', () => {
    expect(homeHcmPulseAllRoute([{ deepLink: '/hr/talent' }, { deepLink: '/hr/talent' }])).toBe(
      '/hr/talent'
    );
    expect(homeHcmPulseAllRoute([{ deepLink: '/hr/benefits' }, { deepLink: '/hr/team' }])).toBe(
      '/hr/home'
    );
    expect(homeHcmPulseAllRoute([{ deepLink: '/hr/team' }, { deepLink: '' }])).toBe('/hr/home');
  });
});
