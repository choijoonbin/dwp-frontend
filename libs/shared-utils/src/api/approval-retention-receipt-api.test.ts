import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  APPROVAL_RETENTION_RECEIPT_BINDINGS,
  getApprovalRetentionCommandReceipt,
} from './approval-retention-receipt-api';
import type { ApprovalRetentionReceiptReadAuthority } from './approval-retention-receipt-api';
import {
  APPROVAL_RETENTION_RECEIPT_PROFILE,
  prepareApprovalRetentionReceiptOriginal,
} from './approval-retention-receipt-profile';
import type { ApprovalRetentionReceiptCommand } from './approval-retention-receipt-profile';

const target = '00000000-0000-0000-0000-000000000042';
const intentId = '00000000-0000-0000-0000-000000000043';
const key = 'original:receipt';
const commands: ApprovalRetentionReceiptCommand[] = [
  {
    operation: 'INITIALIZE_POLICY',
    originalTargetId: null,
    body: { expectedAbsent: true, idempotencyKey: key },
  },
  {
    operation: 'SAVE_POLICY',
    originalTargetId: target,
    body: {
      expectedVersion: 7,
      idempotencyKey: key,
      rules: {
        allowPurge: false,
        allowedClassifications: ['INTERNAL'],
        recordRetentionDays: 365,
        deletedDraftRecoveryDays: 30,
        receiptRetentionDays: 365,
        holdEvidenceRetentionDays: 365,
        auditEvidenceRetentionDays: 365,
        maxInventoryRows: 50000,
        maxObjectsPerRecord: 1000,
      },
    },
  },
  {
    operation: 'PUBLISH_POLICY',
    originalTargetId: target,
    body: { expectedVersion: 7, idempotencyKey: key, reviewComment: 'Independent review accepted' },
  },
  {
    operation: 'CLAIM_RECORD',
    originalTargetId: target,
    body: {
      expectedVersion: 7,
      expectedPolicyVersion: 4,
      expectedHoldVersion: 0,
      policyId: intentId,
      inventorySha256: 'a'.repeat(64),
      idempotencyKey: key,
    },
  },
];
const paths = [
  `/policy-initialization-commands/${key}`,
  `/policies/${target}/draft-commands/${key}`,
  `/policies/${target}/publication-commands/${key}`,
  `/records/${target}/claim-commands/${key}`,
];
function readAuthority(command = commands[2]!, rolloutState: '110' | '111' = '110') {
  return {
    mode: 'SECURE',
    rolloutState,
    routeContractKey: APPROVAL_RETENTION_RECEIPT_BINDINGS[command.operation].routeContractKey,
    expectedDecisionRevision: `psr-${'b'.repeat(64)}`,
    contextKey: 'management-current',
    contextScopeKey: 'opaque/current',
  } as const;
}
const options = () => ({ routeInstalled: () => true, beforeDispatch: vi.fn() });

describe('actual retention receipt DATA transport, no command replay', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  it.each(['110', '111'] as const)(
    'uses four exact bodyless GET paths under %s',
    async (rollout) => {
      for (const [index, command] of commands.entries()) {
        const original = await prepareApprovalRetentionReceiptOriginal(command, 42, 'RS_APPROVALS');
        const metadata = {
          commandId: '00000000-0000-0000-0000-000000000044',
          operation: command.operation,
          idempotencyKey: key,
          actorUserId: 42,
          resourceSetKey: 'RS_APPROVALS',
          originalTargetId: command.originalTargetId,
          resultReferenceId: command.operation === 'CLAIM_RECORD' ? intentId : target,
          requestBodySha256: original.requestBodySha256,
          originalExpectedVersion: original.originalExpectedVersion,
          resultVersion:
            command.operation === 'SAVE_POLICY' || command.operation === 'PUBLISH_POLICY' ? 8 : 0,
          status: 'COMMITTED',
          committedAt: '2026-09-14T11:30:00.123Z',
          originAuthorityProfile:
            command.operation === 'CLAIM_RECORD'
              ? 'RETENTION_RECORD_EXECUTE_SIGNED_HIGH'
              : command.operation === 'PUBLISH_POLICY'
                ? 'POLICY_PUBLISH_SIGNED_HIGH_INDEPENDENT_CHECKER'
                : 'POLICY_UPDATE_TRUSTED',
          profileVersion: APPROVAL_RETENTION_RECEIPT_PROFILE,
        };
        const fetch = vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ data: metadata }), {
            headers: { 'Content-Type': 'application/json' },
          })
        );
        vi.stubGlobal('fetch', fetch);
        const guard = options();
        const result = await getApprovalRetentionCommandReceipt(
          original,
          readAuthority(command, rollout),
          guard
        );
        expect(result.status).toBe('COMMITTED');
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, init] = fetch.mock.calls[0]!;
        expect(url).toBe(
          `/api/approvals/v1/admin/retention${paths[index]}?contextScopeKey=opaque%2Fcurrent`
        );
        expect(init.method).toBe('GET');
        expect(init.body).toBeUndefined();
        const headers = new Headers(init.headers);
        expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(`psr-${'b'.repeat(64)}`);
        expect(headers.has('Idempotency-Key')).toBe(false);
        expect(headers.has('X-DWP-Step-Up-Challenge')).toBe(false);
        expect(headers.has('X-DWP-Expected-Object-Version')).toBe(false);
        expect(guard.beforeDispatch.mock.calls.length).toBeGreaterThanOrEqual(2);
      }
    }
  );

  it.each(['000', '100', '112'])(
    'rejects old/unknown rollout %s with HTTP0',
    async (rolloutState) => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      const original = await prepareApprovalRetentionReceiptOriginal(
        commands[2]!,
        42,
        'RS_APPROVALS'
      );
      const authority = { ...readAuthority(), rolloutState };
      await expect(
        getApprovalRetentionCommandReceipt(
          original,
          authority as ApprovalRetentionReceiptReadAuthority,
          options()
        )
      ).rejects.toThrow();
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it.each(['idempotencyKey', 'stepUp', 'objectVersion'])(
    'does not borrow prior ACTION %s',
    async (field) => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      const original = await prepareApprovalRetentionReceiptOriginal(
        commands[2]!,
        42,
        'RS_APPROVALS'
      );
      await expect(
        getApprovalRetentionCommandReceipt(
          original,
          { ...readAuthority(), [field]: 'borrowed' },
          options()
        )
      ).rejects.toThrow();
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it('requires the installed exact DATA route and privately prepared original before HTTP', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const original = await prepareApprovalRetentionReceiptOriginal(
      commands[2]!,
      42,
      'RS_APPROVALS'
    );
    await expect(
      getApprovalRetentionCommandReceipt(original, readAuthority(), {
        ...options(),
        routeInstalled: () => false,
      })
    ).rejects.toThrow();
    await expect(
      getApprovalRetentionCommandReceipt({ ...original }, readAuthority(), options())
    ).rejects.toThrow();
    await expect(
      getApprovalRetentionCommandReceipt(original, readAuthority(commands[0]!), options())
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('discards a late receipt when the current read authority changes', async () => {
    let resolve!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        })
    );
    vi.stubGlobal('fetch', fetch);
    const original = await prepareApprovalRetentionReceiptOriginal(
      commands[2]!,
      42,
      'RS_APPROVALS'
    );
    let current = true;
    const request = getApprovalRetentionCommandReceipt(original, readAuthority(), {
      ...options(),
      beforeDispatch: () => {
        if (!current) throw new Error('read authority changed');
      },
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    current = false;
    resolve(
      new Response(JSON.stringify({ data: { status: 'COMMITTED' } }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await expect(request).rejects.toThrow('read authority changed');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([403, 404, 409, 503])(
    'preserves UNKNOWN after receipt %s without another GET or mutation',
    async (status) => {
      const fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'unavailable' }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      vi.stubGlobal('fetch', fetch);
      const original = await prepareApprovalRetentionReceiptOriginal(
        commands[2]!,
        42,
        'RS_APPROVALS'
      );
      await expect(
        getApprovalRetentionCommandReceipt(original, readAuthority(), options())
      ).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0]![1].method).toBe('GET');
      expect(original.command.body.idempotencyKey).toBe(key);
    }
  );

  it('sends HTTP0 for a cancelled lookup', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const original = await prepareApprovalRetentionReceiptOriginal(
      commands[2]!,
      42,
      'RS_APPROVALS'
    );
    const abort = new AbortController();
    abort.abort();
    await expect(
      getApprovalRetentionCommandReceipt(original, readAuthority(), {
        ...options(),
        signal: abort.signal,
      })
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
