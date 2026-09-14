import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateProductSurfaceAccess } from '@dwp-frontend/shared-utils';
import { resetCsrfToken } from '@dwp-frontend/shared-utils/axios-instance';
import { approvalInformationWireBody } from '@dwp-frontend/shared-utils/api/approval-information-wire-body';
import { ApprovalRequestInformationReceiptController } from './approval-request-information-receipt-controller';
import { ApprovalRequestInformationWire } from './approval-request-information-wire';
import { approvalInformationReceiptFixture } from '../../../../../e2e/support/approval-information-receipt-fixtures';
import { approvalInformationDetail } from '../../../../../e2e/support/approval-information-generation-fixtures';
import { approvalRequestInformationSnapshot } from './approval-request-information-snapshot';

import type { ApprovalInformationReceiptPorts } from './approval-request-information-receipt-controller';
import type { RequestActionCommand } from './approval-request-action-model';

const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ status: status === 200 ? 'SUCCESS' : 'ERROR', data }), { status });
const completed = {
  status: 'COMPLETED',
  roundId: '81000000-0000-4000-8000-000000000005',
  generation: 2,
  requestVersion: 8,
  payloadRevision: 3,
  payloadSha256: 'a'.repeat(64),
  materialChange: true,
} as const;

describe('private original wire + fresh DATA evaluation + actual receipt transport', () => {
  let fixture: ReturnType<typeof approvalInformationReceiptFixture>;
  let original: RequestActionCommand;
  let wire: ApprovalRequestInformationWire;
  let controller: ApprovalRequestInformationReceiptController;
  let ports: ApprovalInformationReceiptPorts;
  let originalCurrent: boolean;
  let receiptData: unknown;
  let status: number;
  let fetch: ReturnType<typeof vi.fn>;
  let csrfHook: (() => void | Promise<void>) | undefined;
  let receiptHook: (() => void | Promise<void>) | undefined;
  const receipts = () => fetch.mock.calls.filter(([url]) => String(url).includes('/receipt'));

  beforeEach(async () => {
    vi.stubGlobal('Blob', NodeBlob);
    resetCsrfToken();
    fixture = approvalInformationReceiptFixture();
    const detail = await approvalInformationDetail();
    original = {
      scopeIdentity: 'private-original-owner',
      scopeEpoch: 0,
      input: {
        action: { kind: 'respond', request: detail.request },
        responseMessage: '\uacb0\uc7ac \ubcf4\uc644',
        responsePayload: detail.payload,
        schemaHash: detail.formSchemaSha256 ?? undefined,
        idempotencyKey: 'reply:original',
        informationSnapshot: approvalRequestInformationSnapshot(detail),
      },
    };
    wire = new ApprovalRequestInformationWire();
    wire.configure(original);
    approvalInformationWireBody(
      {
        message: original.input.responseMessage,
        payload: detail.payload,
        expectedVersion: detail.request.version,
        sourceGeneration: 1,
      },
      (bytes) => wire.capture(original, bytes)
    );
    controller = new ApprovalRequestInformationReceiptController();
    originalCurrent = true;
    receiptData = completed;
    status = 200;
    csrfHook = undefined;
    receiptHook = undefined;
    fetch = vi.fn(async (url: string) => {
      if (url.includes('/csrf')) {
        await csrfHook?.();
        return response({ token: 'fresh-csrf', headerName: 'X-XSRF-TOKEN' });
      }
      if (url.includes('/product-surface-access/evaluate')) return response(fixture.evaluation);
      await receiptHook?.();
      return response(receiptData, status);
    });
    vi.stubGlobal('fetch', fetch);
    ports = {
      source: () => fixture.source,
      originalWire: (command) => wire.read(command),
      isOriginal: (command) => originalCurrent && command === original,
      evaluate: evaluateProductSurfaceAccess,
    };
  });
  afterEach(() => {
    controller.cancel();
    wire.purge();
    resetCsrfToken();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(['110', '111'] as const)(
    'uses only new DATA evaluation and exact private original bytes in unit %s',
    async (state) => {
      fixture = approvalInformationReceiptFixture(state);
      const originalBytes = wire.read(original);
      Object.assign(original.input.responsePayload, { changedAfterUnknown: 'not-reconstructed' });
      const result = await controller.read(original, ports);
      expect(result.receipt).toEqual(completed);
      expect(wire.read(original)).toBe(originalBytes);
      expect(originalCurrent).toBe(true);
      const evaluation = fetch.mock.calls.find(([url]) => String(url).includes('/evaluate'))!;
      expect(JSON.parse(evaluation[1].body)).toEqual({
        subject: { type: 'PRODUCT', productKey: 'approvals', surfaceKey: 'approvals.work' },
        routeContractKey: 'route.approvals.work.information-command-receipt.data',
        contextKey: fixture.source.contextKey,
        contextScopeKey: fixture.source.contextScopeKey,
      });
      expect(receipts()).toHaveLength(1);
      const [url, init] = receipts()[0]!;
      expect(url).toContain(
        `/information-commands/reply:original/receipt?contextScopeKey=${fixture.source.contextScopeKey}`
      );
      expect(JSON.parse(init.body)).toEqual({
        operation: 'REPLY',
        originalBodyBase64: originalBytes,
      });
      expect(init.headers['X-DWP-Expected-Decision-Revision']).toBe(
        fixture.evaluation.decisionRevision
      );
      expect(init.headers['X-XSRF-TOKEN']).toBe('fresh-csrf');
      for (const key of [
        'Idempotency-Key',
        'X-DWP-Step-Up-Challenge',
        'X-DWP-Expected-Object-Version',
      ])
        expect(init.headers[key]).toBeUndefined();
      expect(
        fetch.mock.calls.every(([endpoint]) => !String(endpoint).includes('/information-response'))
      ).toBe(true);
    }
  );

  it('missing installed DATA source sends neither evaluation nor receipt', async () => {
    fixture.source = { ...fixture.source, projections: [] };
    await expect(controller.read(original, ports)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect(wire.read(original)).toBeDefined();
  });

  it.each(['round', 'generation', 'payloadRevision', 'noOpSha'])(
    'does not confirm a completed receipt with mismatched original %s',
    async (change) => {
      receiptData = {
        ...completed,
        ...(change === 'round' ? { roundId: '22222222-2222-4222-8222-222222222222' } : {}),
        ...(change === 'generation' ? { generation: 3 } : {}),
        ...(change === 'payloadRevision' ? { payloadRevision: 4 } : {}),
        ...(change === 'noOpSha' ? { materialChange: false, payloadRevision: 2 } : {}),
      };
      await expect(controller.read(original, ports)).rejects.toThrow('original information round');
      expect(wire.read(original)).toBeDefined();
      expect(originalCurrent).toBe(true);
    }
  );

  it.each(['oldAction', 'writable', 'denied', 'otherScope'])(
    'rejects %s evaluated proof with receipt HTTP0',
    async (change) => {
      const grant = fixture.evaluation.context!.effectiveGrants[0]!;
      if (grant.grantKind !== 'CAPABILITY') throw new Error('Expected fixture capability');
      if (change === 'oldAction')
        grant.capabilityContractKey = 'approvals.work.request.information.reply';
      if (change === 'writable') fixture.evaluation.effectiveReadOnly = false;
      if (change === 'denied') fixture.evaluation.decision = 'ROUTE_DENIED';
      if (change === 'otherScope') fixture.evaluation.scope!.key = 'other';
      await expect(controller.read(original, ports)).rejects.toThrow();
      expect(receipts()).toHaveLength(0);
      expect(wire.read(original)).toBeDefined();
    }
  );

  it.each(['403', '503', 'actorABA', 'key', 'wire', 'expiry'])(
    'closes the real post-CSRF dispatch gap for %s',
    async (change) => {
      ports = {
        ...ports,
        evaluate: async (request, options) => {
          const evaluation = await evaluateProductSurfaceAccess(request, options);
          resetCsrfToken();
          csrfHook = () => {
            if (change === '403' || change === '503')
              fixture.source = { ...fixture.source, ready: false };
            if (change === 'actorABA')
              fixture.source = { ...fixture.source, epoch: fixture.source.epoch + 2 };
            if (change === 'key') Object.assign(original.input, { idempotencyKey: 'new-key' });
            if (change === 'wire') wire.purge();
            if (change === 'expiry') fixture.source.snapshot!.clockOffsetMs += 120000;
          };
          return evaluation;
        },
      };
      await expect(controller.read(original, ports)).rejects.toThrow();
      expect(receipts()).toHaveLength(0);
      expect(originalCurrent).toBe(true);
      if (!['key', 'wire'].includes(change)) expect(wire.read(original)).toBeDefined();
    }
  );

  it.each(['PENDING', 'partial', 'extra', '403', '503'])(
    'retains private UNKNOWN for %s receipt instead of fabricating success',
    async (change) => {
      const originalBytes = wire.read(original);
      if (change === 'PENDING') receiptData = { status: 'PENDING' };
      if (change === 'partial') receiptData = { status: 'COMPLETED' };
      if (change === 'extra') receiptData = { ...completed, actor: 'untrusted' };
      if (change === '403' || change === '503') status = Number(change);
      await expect(controller.read(original, ports)).rejects.toThrow();
      expect(receipts()).toHaveLength(1);
      expect(wire.read(original)).toBe(originalBytes);
      expect(originalCurrent).toBe(true);
      expect(controller.busy).toBe(false);
    }
  );

  it('rejects a second lookup during the original read and drops authority changed during response', async () => {
    let entered!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    receiptHook = () => {
      entered();
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    };
    const pending = controller.read(original, ports);
    await waiting;
    expect(controller.busy).toBe(true);
    await expect(controller.read(original, ports)).rejects.toThrow('already running');
    fixture.source = { ...fixture.source, ready: false };
    release();
    await expect(pending).rejects.toThrow();
    expect(receipts()).toHaveLength(1);
    expect(wire.read(original)).toBeDefined();
  });
});
