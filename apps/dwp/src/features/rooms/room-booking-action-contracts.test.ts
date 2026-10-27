import { describe, expect, it } from 'vitest';

import { productActionMutationBinding } from '../../components/use-product-action-mutation';
import { ROOM_BOOKING_ACTION_CONTRACTS } from './room-booking-action-contracts';

describe('room booking action contracts', () => {
  it.each(Object.entries(ROOM_BOOKING_ACTION_CONTRACTS))(
    'resolves %s through the canonical Workplace work action registry',
    (_command, routeContractKey) => {
      expect(productActionMutationBinding(routeContractKey)).toMatchObject({
        productKey: 'workplace',
        surfaceKey: 'workplace.work',
        routeContractKey,
      });
    }
  );

  it('keeps every write command on its own exact route contract', () => {
    expect(new Set(Object.values(ROOM_BOOKING_ACTION_CONTRACTS)).size).toBe(4);
  });
});
