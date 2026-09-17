import { describe, expect, it } from 'vitest';

import {
  catalogOptionDefinitions,
  catalogOptionValueIsValid,
  providerAllowsFulfillmentWrite,
  parseWorkplaceServiceFulfillmentDirection,
  parseWorkplaceServiceFulfillmentQuery,
  parseWorkplaceServiceFulfillmentSort,
  requireWorkplaceServiceWrite,
  serviceSelectionIsValid,
  updateWorkplaceServiceFulfillmentSearch,
  workplaceServiceAllowedFulfillmentStates,
  workplaceServiceFulfillmentQuantityIsValid,
  workplaceServiceLimitationMessage,
  workplaceServiceReference,
  workplaceServiceResultUnknownAdjustments,
} from './workplace-services-ui-model';

import type { WorkplaceServiceCatalogItem } from '@dwp-frontend/shared-utils';

const item: WorkplaceServiceCatalogItem = {
  catalogItemId: '18000000-0000-4000-8000-000000000002',
  serviceCode: 'AV_ASSIST',
  category: 'AV',
  nameKo: 'AV 사전 점검',
  nameEn: 'AV readiness',
  descriptionKo: null,
  descriptionEn: null,
  providerState: 'READY',
  providerCode: 'DWP_NATIVE_FULFILLMENT',
  optionSchema: [{ key: 'duration', type: 'NUMBER', required: true, minimum: 15, maximum: 240 }],
  supportedResourceTypes: ['ROOM'],
  unitPrice: 0,
  currency: 'KRW',
  minimumQuantity: 1,
  maximumQuantity: 4,
  orderCutoffMinutes: 60,
  cancellationCutoffMinutes: 60,
  slaResponseMinutes: 15,
  slaFulfillmentLeadMinutes: 45,
  cancellationPolicyKo: '시작 1시간 전까지 취소',
  cancellationPolicyEn: 'Cancel until one hour before',
  capacityMode: 'UNBOUNDED',
  capacityFreshnessSeconds: 900,
  inspectionMode: 'NONE',
  inspectionChecklistSchema: [],
  requiresAttendeeCount: false,
  requiresCostCenter: false,
  version: 1,
};

describe('Workplace Services UI safety model', () => {
  it('uses short business references without exposing the raw UUID', () => {
    const reference = workplaceServiceReference('order', item.catalogItemId);
    expect(reference).toMatch(/^WSO-[0-9A-Z]{7}$/u);
    expect(reference).not.toContain(item.catalogItemId);
    expect(reference).not.toContain(item.catalogItemId.slice(-8));
  });

  it('retains numeric boundaries and blocks missing or out-of-range values', () => {
    const option = catalogOptionDefinitions(item)[0]!;
    expect(option).toMatchObject({ minimum: 15, maximum: 240 });
    expect(catalogOptionValueIsValid(option, null)).toBe(false);
    expect(catalogOptionValueIsValid(option, 14)).toBe(false);
    expect(catalogOptionValueIsValid(option, 15)).toBe(true);
    expect(catalogOptionValueIsValid(option, 241)).toBe(false);
    expect(serviceSelectionIsValid([item], {}, { [item.catalogItemId]: { duration: 30 } })).toBe(
      true
    );
    expect(serviceSelectionIsValid([item], {}, { [item.catalogItemId]: { duration: 300 } })).toBe(
      false
    );
  });

  it('retains localized option labels and canonical operations table state', () => {
    const localized = catalogOptionDefinitions({
      ...item,
      optionSchema: [
        {
          key: 'duration',
          labelKo: '지원 시간',
          labelEn: 'Support duration',
          type: 'NUMBER',
          required: true,
          minimum: 15,
          maximum: 240,
        },
      ],
    })[0];
    expect(localized).toMatchObject({ labelKo: '지원 시간', labelEn: 'Support duration' });
    expect(parseWorkplaceServiceFulfillmentSort('provider')).toBe('provider');
    expect(parseWorkplaceServiceFulfillmentSort('internal')).toBe('sla');
    expect(parseWorkplaceServiceFulfillmentDirection('desc')).toBe('desc');
    expect(parseWorkplaceServiceFulfillmentQuery('  AV\u0000 desk  ')).toBe('AV desk');
    expect(
      updateWorkplaceServiceFulfillmentSearch(new URLSearchParams('order=old'), {
        query: 'AV',
        sort: 'provider',
        direction: 'desc',
      }).toString()
    ).toBe('q=AV&sort=provider&direction=desc');
  });

  it('localizes known limitation codes and uses a safe fallback for unknown codes', () => {
    expect(workplaceServiceLimitationMessage('AV_ASSIST:ORDER_CUTOFF_PASSED', 'ko')).toBe(
      '서비스 주문 마감이 지났습니다.'
    );
    expect(workplaceServiceLimitationMessage('OPTION_REQUIRED:layout', 'en')).toBe(
      'Complete the required service option.'
    );
    expect(workplaceServiceLimitationMessage('UNRECOGNIZED_INTERNAL_CODE', 'en')).toBe(
      'This service cannot be ordered under the current conditions.'
    );
  });

  it('fails closed when a write or provider-backed fulfillment is unavailable', () => {
    expect(() => requireWorkplaceServiceWrite(false)).toThrow(/not authorized/u);
    expect(() => requireWorkplaceServiceWrite(true)).not.toThrow();
    expect(providerAllowsFulfillmentWrite('READY')).toBe(true);
    expect(providerAllowsFulfillmentWrite('STALE')).toBe(false);
  });

  it('mirrors the backend fulfillment transition and quantity rules', () => {
    expect(workplaceServiceAllowedFulfillmentStates('SUBMITTED')).toEqual([
      'SUBMITTED',
      'ACCEPTED',
      'BLOCKED',
      'DELAYED',
      'RESULT_UNKNOWN',
    ]);
    expect(workplaceServiceAllowedFulfillmentStates('FULFILLED')).toEqual([]);
    expect(workplaceServiceFulfillmentQuantityIsValid(1, 1, 4, 'FULFILLED', 3)).toBe(true);
    expect(workplaceServiceFulfillmentQuantityIsValid(1, 1, 4, 'FULFILLED', 2)).toBe(false);
    expect(workplaceServiceFulfillmentQuantityIsValid(1, 1, 4, 'PARTIALLY_FULFILLED', 2)).toBe(
      true
    );
    expect(workplaceServiceFulfillmentQuantityIsValid(1, 1, 4, 'ACCEPTED', null)).toBe(true);
    expect(workplaceServiceFulfillmentQuantityIsValid(1, 1, 4, 'ACCEPTED', 2)).toBe(false);
  });

  it('persists queue filters while clearing stale selection and recovers both uncertain events', () => {
    const filtered = updateWorkplaceServiceFulfillmentSearch(
      new URLSearchParams('state=SUBMITTED&order=old&view=compact'),
      { state: 'BLOCKED' }
    );
    expect(filtered.toString()).toBe('state=BLOCKED&view=compact');
    expect(
      workplaceServiceResultUnknownAdjustments([
        {
          eventId: '18000000-0000-4000-8000-000000000021',
          eventType: 'LINE_CANCELLATION_REQUIRES_REVIEW',
          detail: {
            lineAdjustmentId: '18000000-0000-4000-8000-000000000022',
            serviceOrderLineId: '18000000-0000-4000-8000-000000000023',
          },
          occurredAt: '2026-09-17T00:00:00Z',
        },
      ])
    ).toHaveLength(1);
  });
});
