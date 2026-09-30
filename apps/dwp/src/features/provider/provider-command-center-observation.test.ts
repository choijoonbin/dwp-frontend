import { describe, expect, it } from 'vitest';

import type { ProviderActionItem } from '@dwp-frontend/shared-utils';

import {
  providerActionPresentation,
  providerActionCategoryPresentation,
  providerServiceObservationState,
  providerServiceObservationWatermark,
} from './provider-command-center-observation';

const t = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${JSON.stringify(values)}` : key;

function action(overrides: Partial<ProviderActionItem>): ProviderActionItem {
  return {
    itemId: 'item-1',
    category: 'CHANGE',
    severity: 'HIGH',
    title: 'TENANT_UPGRADE',
    detail: 'Customer approved maintenance window',
    targetId: 'target-1',
    createdAt: '2026-09-17T00:00:00Z',
    route: '/provider/operations',
    ...overrides,
  };
}

describe('provider command-center observation truth', () => {
  const now = Date.parse('2026-09-17T00:02:00Z');

  it('keeps current, stale, and unobserved services distinct', () => {
    expect(providerServiceObservationState({ lastReconciledAt: '2026-09-17T00:01:00Z' }, now)).toBe(
      'CURRENT'
    );
    expect(providerServiceObservationState({ lastReconciledAt: '2026-09-16T23:00:00Z' }, now)).toBe(
      'STALE'
    );
    expect(providerServiceObservationState({ lastReconciledAt: null }, now)).toBe('UNOBSERVED');
  });

  it('uses the oldest fully covered service observation as the live watermark', () => {
    expect(
      providerServiceObservationWatermark([
        { lastReconciledAt: '2026-09-17T00:01:40Z' },
        { lastReconciledAt: '2026-09-17T00:01:10Z' },
      ])
    ).toBe(Date.parse('2026-09-17T00:01:10Z'));
    expect(
      Number.isNaN(
        providerServiceObservationWatermark([
          { lastReconciledAt: '2026-09-17T00:01:40Z' },
          { lastReconciledAt: null },
        ])
      )
    ).toBe(true);
  });

  it('localizes known operation and state enums without exposing raw values', () => {
    expect(providerActionPresentation(action({}), t)).toEqual({
      title: 'operationTypes.TENANT_UPGRADE',
      detail: 'Customer approved maintenance window',
    });
    expect(
      providerActionPresentation(
        action({
          category: 'SERVICE_HEALTH',
          title: 'Workspace',
          detail: 'Acme / DEGRADED',
        }),
        t
      )
    ).toEqual({
      title: 'Workspace',
      detail:
        'command.action.serviceState:{"tenant":"Acme","state":"command.action.serviceStates.DEGRADED"}',
    });
  });

  it('fails closed for unknown categories and enum values', () => {
    const expected = {
      title: 'command.action.unavailableTitle',
      detail: 'command.action.unavailableDetail',
    };
    expect(
      providerActionPresentation(
        action({ category: 'SERVICE_HEALTH', detail: 'Acme / FUTURE_STATE' }),
        t
      )
    ).toEqual(expected);
    expect(
      providerActionPresentation(action({ category: 'FUTURE_OWNER', title: 'RAW_ENUM' }), t)
    ).toEqual(expected);
    expect(providerActionCategoryPresentation('FUTURE_OWNER')).toBe('unavailable');
  });
});
