import { describe, expect, it } from 'vitest';

import {
  workplaceDeviceCommandMaySubmit,
  workplaceDeviceCommandNeedsGetRecovery,
  workplaceMaskedSchedule,
  workplaceNavigationCanRenderGuidedRoute,
  workplaceNavigationFallbackBreadcrumb,
  workplaceProviderDisplayState,
} from './workplace-navigation-model';

describe('Screen 19 navigation and device model', () => {
  it('never treats fallback coordinates as a guided route', () => {
    const route = {
      outcome: 'GRAPH_MISSING',
      graphRevisionId: null,
      graphRevisionNumber: 0,
      origin: null,
      destination: null,
      steps: [],
      totalTravelSeconds: 0,
      fallback: {
        siteId: 'site',
        floorId: 'floor',
        resourceId: 'room',
        siteName: '본사',
        floorName: '19층',
        resourceName: '회의실',
        floorMapPath: '/floor.svg',
        helpDesks: [],
      },
      limitations: ['PUBLISHED_GRAPH_MISSING'],
      graphPublishedAt: null,
      asOf: '2026-09-16T00:00:00Z',
    } as const;
    expect(workplaceNavigationCanRenderGuidedRoute(route)).toBe(false);
    expect(workplaceNavigationFallbackBreadcrumb(route)).toEqual(['본사', '19층', '회의실']);
  });

  it('downgrades an unevidenced provider healthy claim', () => {
    expect(
      workplaceProviderDisplayState({
        state: 'HEALTHY',
        evidenceReference: null,
        observedConfigurationVersion: 2,
        configurationVersion: 2,
        lastSuccessAt: null,
      } as never)
    ).toBe('CONFIGURED_UNVERIFIED');
  });

  it('requires GET-only recovery and blocks a duplicate mutation for RESULT_UNKNOWN', () => {
    const receipt = { state: 'RESULT_UNKNOWN' } as never;
    expect(workplaceDeviceCommandNeedsGetRecovery(receipt)).toBe(true);
    expect(workplaceDeviceCommandMaySubmit(receipt)).toBe(false);
  });

  it('replaces masked schedule data even if a provider sends display text', () => {
    expect(
      workplaceMaskedSchedule(
        { privacyMasked: true, title: 'Secret project', organizer: 'Raw Person' } as never,
        'en'
      )
    ).toMatchObject({ title: 'Private event', organizer: null });
  });
});
