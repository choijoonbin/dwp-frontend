import { describe, expect, it } from 'vitest';

import { ApprovalRequestInformationWire } from './approval-request-information-wire';
import { APPROVAL_REQUEST_FIXTURE } from '../../../../../e2e/support/product-area-fixtures';

import type { RequestActionCommand } from './approval-request-action-model';

const command = (): RequestActionCommand => ({
  scopeIdentity: 'original-actor',
  scopeEpoch: 1,
  input: {
    action: {
      kind: 'respond',
      request: { ...APPROVAL_REQUEST_FIXTURE, status: 'NEEDS_INFO', version: 3 },
    },
    responseMessage: 'Original response',
    responsePayload: { summary: 'Original payload' },
    idempotencyKey: 'original:reply',
  },
});
const bytes = 'eyJtZXNzYWdlIjoiT3JpZ2luYWwgcmVzcG9uc2UifQ==';
const setup = () => {
  const original = command();
  const wire = new ApprovalRequestInformationWire();
  wire.configure(original);
  wire.capture(original, bytes);
  return { original, wire };
};

describe('original information wire privately bound to the exact command', () => {
  it('purges on owner view ABA and rejects a delayed capture from the original view generation', () => {
    const { original, wire } = setup();
    wire.configure(original, 'needs-info');
    const generation = wire.ownerGeneration;
    wire.capture(original, bytes, generation);
    wire.configure(original, 'submitted');
    wire.configure(original, 'needs-info');
    expect(wire.read(original)).toBeUndefined();
    expect(() => wire.capture(original, bytes, generation)).toThrow();
    const next = command();
    wire.capture(next, bytes, wire.ownerGeneration);
    expect(wire.read(next)).toBe(bytes);
    expect(wire.read(original)).toBeUndefined();
  });
  it('retains the exact captured bytes through same epoch close/refetch without reconstructing mutable inputs', () => {
    const { original, wire } = setup();
    wire.configure(original);
    Object.assign(original.input.responsePayload, { summary: 'Changed local draft' });
    expect(wire.read(original)).toBe(bytes);
    wire.capture(original, bytes);
    expect(wire.read(original)).toBe(bytes);
  });
  it('rejects a different body or descriptor under the same key and retains the private original', () => {
    const { original, wire } = setup();
    expect(() => wire.capture(original, btoa('{"different":true}'))).toThrow('wire body changed');
    expect(() => wire.capture(command(), bytes)).toThrow('wire body changed');
    expect(wire.read(original)).toBe(bytes);
    expect(wire.read(command())).toBeUndefined();
  });
  it.each(['request', 'version', 'key'] as const)(
    'quarantines modified %s pins without accepting substituted input',
    (pin) => {
      const { original, wire } = setup();
      if (pin === 'request')
        Object.assign(original.input.action.request, { requestId: 'other-owner' });
      if (pin === 'version') Object.assign(original.input.action.request, { version: 4 });
      if (pin === 'key') Object.assign(original.input, { idempotencyKey: 'other:reply' });
      expect(wire.read(original)).toBeUndefined();
      expect(() => wire.capture(original, bytes)).toThrow();
    }
  );
  it('purges on actual scope epoch change and cannot restore the old A command after A→B→A', () => {
    const { original, wire } = setup();
    wire.configure({ scopeIdentity: 'other-actor', scopeEpoch: 2 });
    expect(wire.read(original)).toBeUndefined();
    wire.configure({ scopeIdentity: original.scopeIdentity, scopeEpoch: 3 });
    expect(() => wire.capture(original, bytes)).toThrow('binding changed');
    expect(wire.read(original)).toBeUndefined();
  });
  it.each([
    { label: 'empty', body: '' },
    { label: 'malformed', body: 'not base64' },
    { label: 'noncanonical', body: 'YQ' },
    { label: 'oversized', body: btoa('a'.repeat(262145)) },
  ])('rejects $label byte captures before accepting them', ({ body }) => {
    const wire = new ApprovalRequestInformationWire();
    const original = command();
    wire.configure(original);
    expect(() => wire.capture(original, body)).toThrow('bytes are invalid');
    expect(wire.read(original)).toBeUndefined();
  });
  it('a delayed different command cannot clear the current original record', () => {
    const { original, wire } = setup();
    wire.clear(command());
    expect(wire.read(original)).toBe(bytes);
    wire.clear(original);
    expect(wire.read(original)).toBeUndefined();
  });
});
