import { describe, expect, it, vi } from 'vitest';
import type {
  PersonalWorkTask,
  PersonalWorkTaskInput,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import { personal } from './work-hub.test-support';
import { createWorkTaskSaveCoordinator } from './work-hub-task-save-coordinator';

const owner = 'tenant:user:access';
const sourceReference = {
  sourceSystem: 'PRIVATE_SOURCE',
  sourceReference: 'private-source-reference',
  obligationKey: 'private-obligation',
};
const input: PersonalWorkTaskInput = {
  title: 'Create once',
  description: 'Private task detail',
  priority: 'NORMAL',
  dueAt: null,
  sourceReference,
  checklist: [{ itemId: 'check-1', title: 'Private checklist', completed: false }],
};
const otherInput: PersonalWorkTaskInput = {
  ...input,
  title: 'Create another',
  description: 'A different private task detail',
};
const source = {
  availability: 'REFERENCE_ONLY' as const,
  reference: sourceReference,
  title: null,
  sourceRoute: null,
  status: null,
  dueAt: null,
};
const receipt = personal({
  title: input.title,
  description: input.description ?? null,
  priority: input.priority,
  dueAt: input.dueAt ?? null,
  checklist: input.checklist ?? [],
  source,
  sources: [source],
  version: 0,
});
const otherReceipt = personal({
  ...receipt,
  taskId: '2d48ca30-9f34-4f6d-8e73-9f75d4483eba',
  title: otherInput.title,
  description: otherInput.description ?? null,
});
const firstKey = '11111111-1111-4111-8111-111111111111';
const secondKey = '22222222-2222-4222-8222-222222222222';
const thirdKey = '44444444-4444-4444-8444-444444444444';
const fourthKey = '55555555-5555-4555-8555-555555555555';
const planIntent = {
  date: '2026-09-08',
  idempotencyKey: '33333333-3333-4333-8333-333333333333',
};

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  };
}

describe('Work task save coordinator', () => {
  it('shares an in-flight create and preserves the first idempotency identity', async () => {
    let finish!: (task: PersonalWorkTask) => void;
    const execute = vi.fn(
      () =>
        new Promise<PersonalWorkTask>((resolve) => {
          finish = resolve;
        })
    );
    const coordinator = createWorkTaskSaveCoordinator(owner);

    const first = coordinator.runCreate(owner, input, firstKey, execute, planIntent);
    const remounted = coordinator.runCreate(owner, { ...input }, secondKey, execute, null);
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(input, firstKey, expect.any(Object));
    finish(receipt);

    await expect(first).resolves.toMatchObject({ planIntent, task: receipt });
    await expect(remounted).resolves.toEqual(await first);
  });

  it('retries an unknown result with the original key and clears only acknowledged confirmation', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('connection lost'))
      .mockResolvedValue(receipt);
    const coordinator = createWorkTaskSaveCoordinator(owner);

    await expect(coordinator.runCreate(owner, input, firstKey, execute)).rejects.toThrow(
      'connection lost'
    );
    const confirmed = await coordinator.runCreate(owner, input, secondKey, execute);
    expect(execute.mock.calls.map((call) => call[1])).toEqual([firstKey, firstKey]);

    await coordinator.runCreate(owner, input, secondKey, execute);
    expect(execute).toHaveBeenCalledTimes(2);
    const claim = coordinator.claimCreate(owner, confirmed.confirmationId)!;
    coordinator.acknowledgeCreate(owner, claim);
    await coordinator.runCreate(owner, input, secondKey, execute);
    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute.mock.calls[2]?.[1]).toBe(secondKey);
  });

  it('retains a malformed receipt as unknown and never exposes it as confirmed', async () => {
    const malformed = { ...receipt, title: 'Different task' };
    const execute = vi.fn().mockResolvedValue(malformed);
    const coordinator = createWorkTaskSaveCoordinator(owner);

    await expect(coordinator.runCreate(owner, input, firstKey, execute)).rejects.toThrow(
      'Unverified personal task creation receipt'
    );
    await expect(coordinator.runCreate(owner, input, secondKey, execute)).rejects.toThrow(
      'Unverified personal task creation receipt'
    );
    expect(execute.mock.calls.map((call) => call[1])).toEqual([firstKey, firstKey]);
  });

  it('cancels and forgets sensitive intents when authority changes', async () => {
    let observedSignal!: AbortSignal;
    const execute = vi.fn(
      (_input, _key, guard) =>
        new Promise<PersonalWorkTask>((_resolve, reject) => {
          observedSignal = guard.signal!;
          guard.signal!.addEventListener('abort', () => reject(guard.signal!.reason), {
            once: true,
          });
        })
    );
    const coordinator = createWorkTaskSaveCoordinator(owner);
    const pending = coordinator.runCreate(owner, input, firstKey, execute);

    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());

    coordinator.dispose();
    expect(observedSignal.aborted).toBe(true);
    await expect(pending).rejects.toBeDefined();
    await expect(coordinator.runCreate(owner, input, firstKey, execute)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('never returns another owner task confirmation', async () => {
    const coordinator = createWorkTaskSaveCoordinator(owner);
    await expect(
      coordinator.runCreate('different-owner', input, firstKey, vi.fn())
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('does not let a stale claimant release or acknowledge a newer lease', async () => {
    const coordinator = createWorkTaskSaveCoordinator(owner);
    const confirmation = await coordinator.runCreate(
      owner,
      input,
      firstKey,
      vi.fn().mockResolvedValue(receipt)
    );
    const stale = coordinator.claimCreate(owner, confirmation.confirmationId)!;
    coordinator.releaseCreate(owner, stale);
    const current = coordinator.claimCreate(owner, confirmation.confirmationId)!;

    coordinator.releaseCreate(owner, stale);
    coordinator.acknowledgeCreate(owner, stale);
    expect(coordinator.claimCreate(owner, confirmation.confirmationId)).toBeNull();
    coordinator.acknowledgeCreate(owner, current);
    expect(coordinator.confirmedCreates(owner)).toEqual([]);
  });

  it('restores only opaque owner/input identity after reload and never stores task content', async () => {
    const storage = memoryStorage();
    const lost = createWorkTaskSaveCoordinator(owner, storage);
    await expect(
      lost.runCreate(owner, input, firstKey, vi.fn().mockRejectedValue(new TypeError('lost')))
    ).rejects.toThrow('lost');
    const serialized = [...storage.values.values()].join('');
    expect(serialized).toContain(firstKey);
    expect(serialized).toMatch(/sha256:[0-9a-f]{64}/u);
    expect(serialized).not.toContain(input.title);
    expect(serialized).not.toContain(input.description!);
    expect(serialized).not.toContain(input.checklist![0]!.title);
    expect(serialized).not.toContain(sourceReference.sourceSystem);
    expect(serialized).not.toContain(sourceReference.sourceReference);
    expect(serialized).not.toContain(sourceReference.obligationKey);

    const afterReload = createWorkTaskSaveCoordinator(owner, storage);
    const execute = vi.fn().mockResolvedValue(receipt);
    const confirmed = await afterReload.runCreate(owner, { ...input }, secondKey, execute);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining(input),
      firstKey,
      expect.any(Object)
    );
    const claim = afterReload.claimCreate(owner, confirmed.confirmationId)!;
    afterReload.acknowledgeCreate(owner, claim);
    expect(storage.values.size).toBe(0);
  });

  it('does not restore an opaque intent for another owner', async () => {
    const storage = memoryStorage();
    await expect(
      createWorkTaskSaveCoordinator(owner, storage).runCreate(
        owner,
        input,
        firstKey,
        vi.fn().mockRejectedValue(new TypeError('lost'))
      )
    ).rejects.toThrow('lost');
    const execute = vi.fn().mockResolvedValue(receipt);

    await createWorkTaskSaveCoordinator('other-owner', storage).runCreate(
      'other-owner',
      input,
      secondKey,
      execute
    );
    expect(execute).toHaveBeenCalledWith(expect.any(Object), secondKey, expect.any(Object));
  });

  it('keeps distinct in-flight creates recoverable when their responses are lost in reverse order', async () => {
    const storage = memoryStorage();
    const pending = new Map<string, (reason: Error) => void>();
    const execute = vi.fn(
      (submitted: PersonalWorkTaskInput) =>
        new Promise<PersonalWorkTask>((_resolve, reject) => {
          pending.set(submitted.title, reject);
        })
    );
    const beforeReload = createWorkTaskSaveCoordinator(owner, storage);
    const first = beforeReload.runCreate(owner, input, firstKey, execute);
    const second = beforeReload.runCreate(owner, otherInput, secondKey, execute);

    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    const stored = JSON.parse(
      storage.values.get('dwp.work.personal-create-intents.v2') ?? '{}'
    ) as { entries?: Array<{ idempotencyKey: string }>; schema?: number };
    expect(stored.schema).toBe(2);
    expect(stored.entries?.map((entry) => entry.idempotencyKey).sort()).toEqual(
      [firstKey, secondKey].sort()
    );
    expect(JSON.stringify(stored)).not.toContain(input.title);
    expect(JSON.stringify(stored)).not.toContain(otherInput.title);

    pending.get(otherInput.title)?.(new TypeError('second response lost'));
    pending.get(input.title)?.(new TypeError('first response lost'));
    await expect(second).rejects.toThrow('second response lost');
    await expect(first).rejects.toThrow('first response lost');

    const afterReload = createWorkTaskSaveCoordinator(owner, storage);
    const retry = vi.fn((submitted: PersonalWorkTaskInput, _idempotencyKey: string) =>
      Promise.resolve(submitted.title === input.title ? receipt : otherReceipt)
    );
    const secondConfirmation = await afterReload.runCreate(owner, otherInput, thirdKey, retry);
    const firstConfirmation = await afterReload.runCreate(owner, input, fourthKey, retry);

    expect(retry.mock.calls.map((call) => call[1])).toEqual([secondKey, firstKey]);
    const firstClaim = afterReload.claimCreate(owner, firstConfirmation.confirmationId)!;
    afterReload.acknowledgeCreate(owner, firstClaim);
    const remaining = JSON.parse(
      storage.values.get('dwp.work.personal-create-intents.v2') ?? '{}'
    ) as { entries?: Array<{ idempotencyKey: string }> };
    expect(remaining.entries?.map((entry) => entry.idempotencyKey)).toEqual([secondKey]);
    const secondClaim = afterReload.claimCreate(owner, secondConfirmation.confirmationId)!;
    afterReload.acknowledgeCreate(owner, secondClaim);
    expect(storage.values.get('dwp.work.personal-create-intents.v2')).toBeUndefined();
  });

  it('recovers and removes one valid legacy create marker', async () => {
    const storage = memoryStorage();
    const now = Date.now();
    const cryptoCoordinator = createWorkTaskSaveCoordinator(owner, storage);
    await expect(
      cryptoCoordinator.runCreate(
        owner,
        input,
        firstKey,
        vi.fn().mockRejectedValue(new TypeError('lost'))
      )
    ).rejects.toThrow('lost');
    const current = JSON.parse(
      storage.values.get('dwp.work.personal-create-intents.v2') ?? '{}'
    ) as { entries: Array<Record<string, unknown>> };
    storage.values.delete('dwp.work.personal-create-intents.v2');
    storage.values.set(
      'dwp.work.personal-create-intent.v1',
      JSON.stringify({ ...current.entries[0], recordedAt: now, schema: 1 })
    );

    const afterUpgrade = createWorkTaskSaveCoordinator(owner, storage);
    const execute = vi.fn().mockResolvedValue(receipt);
    const confirmation = await afterUpgrade.runCreate(owner, input, secondKey, execute);
    expect(execute).toHaveBeenCalledWith(expect.any(Object), firstKey, expect.any(Object));
    const claim = afterUpgrade.claimCreate(owner, confirmation.confirmationId)!;
    afterUpgrade.acknowledgeCreate(owner, claim);
    expect(storage.values.get('dwp.work.personal-create-intent.v1')).toBeUndefined();
  });

  it('bounds opaque recovery state and evicts the oldest distinct create', async () => {
    const storage = memoryStorage();
    const coordinator = createWorkTaskSaveCoordinator(owner, storage);
    const keys = Array.from(
      { length: 9 },
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
    );

    for (const [index, idempotencyKey] of keys.entries()) {
      await expect(
        coordinator.runCreate(
          owner,
          { ...input, title: `Create item ${index + 1}` },
          idempotencyKey!,
          vi.fn().mockRejectedValue(new TypeError('lost'))
        )
      ).rejects.toThrow('lost');
    }

    const stored = JSON.parse(
      storage.values.get('dwp.work.personal-create-intents.v2') ?? '{}'
    ) as { entries?: Array<{ idempotencyKey: string }>; schema?: number };
    expect(stored.schema).toBe(2);
    expect(stored.entries).toHaveLength(8);
    expect(stored.entries?.map((entry) => entry.idempotencyKey)).not.toContain(keys[0]);
    expect(stored.entries?.map((entry) => entry.idempotencyKey)).toContain(keys[8]);
    expect(new TextEncoder().encode(JSON.stringify(stored)).byteLength).toBeLessThanOrEqual(8192);
  });

  it.each(['expired', 'future', 'oversized', 'unexpected content'] as const)(
    'replaces an %s recovery marker with a fresh opaque identity',
    async (invalid) => {
      const storage = memoryStorage();
      await expect(
        createWorkTaskSaveCoordinator(owner, storage).runCreate(
          owner,
          input,
          firstKey,
          vi.fn().mockRejectedValue(new TypeError('lost'))
        )
      ).rejects.toThrow('lost');
      const stored = JSON.parse(storage.values.get('dwp.work.personal-create-intents.v2')!) as {
        entries: Array<Record<string, unknown>>;
        schema: 2;
      };
      const entry = stored.entries[0]!;
      if (invalid === 'expired') entry.recordedAt = Date.now() - 31 * 60 * 1000;
      if (invalid === 'future') entry.recordedAt = Date.now() + 60 * 1000;
      if (invalid === 'unexpected content') entry.title = input.title;
      storage.values.set(
        'dwp.work.personal-create-intents.v2',
        invalid === 'oversized' ? 'x'.repeat(8193) : JSON.stringify(stored)
      );
      const execute = vi.fn().mockResolvedValue(receipt);
      const coordinator = createWorkTaskSaveCoordinator(owner, storage);
      const confirmation = await coordinator.runCreate(owner, input, secondKey, execute);
      expect(execute).toHaveBeenCalledWith(expect.any(Object), secondKey, expect.any(Object));
      expect(storage.values.get('dwp.work.personal-create-intents.v2')).not.toContain(input.title);
      const claim = coordinator.claimCreate(owner, confirmation.confirmationId)!;
      coordinator.acknowledgeCreate(owner, claim);
      expect(storage.values.size).toBe(0);
    }
  );

  it('retains the in-memory retry identity when all storage writes fail', async () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new DOMException('quota unavailable', 'QuotaExceededError');
      }),
    };
    const coordinator = createWorkTaskSaveCoordinator(owner, storage);
    const execute = vi.fn().mockRejectedValueOnce(new TypeError('lost')).mockResolvedValue(receipt);
    await expect(coordinator.runCreate(owner, input, firstKey, execute)).rejects.toThrow('lost');
    const confirmation = await coordinator.runCreate(owner, input, secondKey, execute);
    expect(execute.mock.calls.map((call) => call[1])).toEqual([firstKey, firstKey]);
    const claim = coordinator.claimCreate(owner, confirmation.confirmationId)!;
    coordinator.acknowledgeCreate(owner, claim);
    expect(coordinator.confirmedCreates(owner)).toEqual([]);
  });

  it('reuses a fresh identity when best-effort expired-entry cleanup cannot be written', async () => {
    const backing = memoryStorage();
    await expect(
      createWorkTaskSaveCoordinator(owner, backing).runCreate(
        owner,
        input,
        firstKey,
        vi.fn().mockRejectedValue(new TypeError('lost'))
      )
    ).rejects.toThrow('lost');
    await expect(
      createWorkTaskSaveCoordinator(owner, backing).runCreate(
        owner,
        otherInput,
        secondKey,
        vi.fn().mockRejectedValue(new TypeError('another lost response'))
      )
    ).rejects.toThrow('another lost response');
    const stored = JSON.parse(
      backing.values.get('dwp.work.personal-create-intents.v2') ?? '{}'
    ) as {
      entries: Array<{
        idempotencyKey: string;
        inputFingerprint: string;
        ownerFingerprint: string;
        recordedAt: number;
      }>;
      schema: 2;
    };
    backing.values.set(
      'dwp.work.personal-create-intents.v2',
      JSON.stringify({
        ...stored,
        entries: [
          ...stored.entries,
          {
            ...stored.entries[0],
            idempotencyKey: fourthKey,
            recordedAt: Date.now() - 31 * 60 * 1000,
          },
        ],
      })
    );
    const storage = {
      getItem: backing.getItem,
      removeItem: backing.removeItem,
      setItem: vi.fn(() => {
        throw new DOMException('quota unavailable', 'QuotaExceededError');
      }),
    };
    const execute = vi.fn().mockResolvedValue(receipt);

    const coordinator = createWorkTaskSaveCoordinator(owner, storage);
    const confirmation = await coordinator.runCreate(owner, input, thirdKey, execute);

    expect(execute).toHaveBeenCalledWith(expect.any(Object), firstKey, expect.any(Object));
    expect(storage.setItem).toHaveBeenCalled();
    const claim = coordinator.claimCreate(owner, confirmation.confirmationId)!;
    coordinator.acknowledgeCreate(owner, claim);
    const afterFailedCleanup = JSON.parse(
      backing.values.get('dwp.work.personal-create-intents.v2') ?? '{}'
    ) as { entries?: Array<{ idempotencyKey: string }> };
    expect(afterFailedCleanup.entries?.map((entry) => entry.idempotencyKey)).toContain(secondKey);
  });

  it('replaces malformed recovery state without exposing submitted task content', async () => {
    const storage = memoryStorage();
    storage.values.set('dwp.work.personal-create-intents.v2', '{malformed');
    const coordinator = createWorkTaskSaveCoordinator(owner, storage);
    const execute = vi.fn().mockResolvedValue(receipt);

    const confirmation = await coordinator.runCreate(owner, input, firstKey, execute);

    expect(execute).toHaveBeenCalledWith(expect.any(Object), firstKey, expect.any(Object));
    const serialized = storage.values.get('dwp.work.personal-create-intents.v2') ?? '';
    expect(JSON.parse(serialized)).toMatchObject({
      entries: [{ idempotencyKey: firstKey }],
      schema: 2,
    });
    expect(serialized).not.toContain(input.title);
    expect(serialized).not.toContain(input.description!);
    const claim = coordinator.claimCreate(owner, confirmation.confirmationId)!;
    coordinator.acknowledgeCreate(owner, claim);
    expect(storage.values.get('dwp.work.personal-create-intents.v2')).toBeUndefined();
  });

  it('reuses one key for semantically empty create fields and separates a real value change', async () => {
    const storage = memoryStorage();
    const minimal: PersonalWorkTaskInput = { title: 'Canonical create', priority: 'NORMAL' };
    const explicitEmpty: PersonalWorkTaskInput = {
      ...minimal,
      description: null,
      dueAt: null,
      clearSourceReference: false,
      checklist: [],
      sourceReferences: [],
    };
    await expect(
      createWorkTaskSaveCoordinator(owner, storage).runCreate(
        owner,
        explicitEmpty,
        firstKey,
        vi.fn().mockRejectedValue(new TypeError('lost'))
      )
    ).rejects.toThrow('lost');
    const recoveredReceipt = personal({
      checklist: [],
      description: null,
      dueAt: null,
      priority: 'NORMAL',
      source: null,
      sources: [],
      title: minimal.title,
      version: 0,
    });
    const retry = vi.fn().mockResolvedValue(recoveredReceipt);

    await createWorkTaskSaveCoordinator(owner, storage).runCreate(owner, minimal, secondKey, retry);
    expect(retry).toHaveBeenCalledWith(expect.any(Object), firstKey, expect.any(Object));

    const changed = { ...minimal, title: 'Canonical create changed' };
    const changedExecute = vi.fn().mockRejectedValue(new TypeError('changed request lost'));
    await expect(
      createWorkTaskSaveCoordinator(owner, storage).runCreate(
        owner,
        changed,
        thirdKey,
        changedExecute
      )
    ).rejects.toThrow('changed request lost');
    expect(changedExecute).toHaveBeenCalledWith(expect.any(Object), thirdKey, expect.any(Object));
  });
});
