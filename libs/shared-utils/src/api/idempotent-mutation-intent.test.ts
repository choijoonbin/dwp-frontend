import { describe, expect, it, vi } from 'vitest';

import { resolveIdempotentMutationIntent } from './idempotent-mutation-intent';

describe('resolveIdempotentMutationIntent', () => {
  it('keeps the key for a retry of the same user intent', () => {
    const createKey = vi.fn().mockReturnValueOnce('intent-1').mockReturnValueOnce('intent-2');
    const first = resolveIdempotentMutationIntent(
      null,
      { roomId: 'room-1', startsAt: '2026-08-28T01:00:00Z' },
      createKey
    );
    const retry = resolveIdempotentMutationIntent(
      first,
      { startsAt: '2026-08-28T01:00:00Z', roomId: 'room-1' },
      createKey
    );

    expect(retry).toBe(first);
    expect(retry.key).toBe('intent-1');
    expect(createKey).toHaveBeenCalledTimes(1);
  });

  it('rotates the key when the user changes the booking intent', () => {
    const createKey = vi.fn().mockReturnValueOnce('intent-1').mockReturnValueOnce('intent-2');
    const first = resolveIdempotentMutationIntent(null, { roomId: 'room-1' }, createKey);
    const changed = resolveIdempotentMutationIntent(first, { roomId: 'room-2' }, createKey);

    expect(changed.key).toBe('intent-2');
    expect(createKey).toHaveBeenCalledTimes(2);
  });
});
