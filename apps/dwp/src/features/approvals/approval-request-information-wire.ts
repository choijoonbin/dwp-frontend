import { HttpError } from '@dwp-frontend/shared-utils';

import type { RequestActionCommand } from './approval-request-action-model';
import type { ApprovalManagementScopeBinding } from './approval-management-command-scope';

function commandPins(command: RequestActionCommand) {
  return JSON.stringify([
    command.scopeIdentity,
    command.scopeEpoch,
    command.input.action.kind,
    command.input.action.request.requestId,
    command.input.action.request.version,
    command.input.idempotencyKey,
    command.input.schemaHash,
    command.input.informationSnapshot,
  ]);
}

/** Owned by the stable lifecycle hook; no draft reconstruction or persistent storage. */
export class ApprovalRequestInformationWire {
  private epoch = '';
  private binding = '';
  private generation = 0;
  private original?: Readonly<{
    command: RequestActionCommand;
    pins: string;
    originalBodyBase64: string;
  }>;

  configure(binding: ApprovalManagementScopeBinding, ownerKey = '') {
    this.binding = JSON.stringify([binding.scopeIdentity, binding.scopeEpoch]);
    const epoch = JSON.stringify([this.binding, ownerKey]);
    if (this.epoch !== epoch) {
      this.epoch = epoch;
      this.generation += 1;
      this.original = undefined;
    }
  }

  get ownerGeneration() {
    return this.generation;
  }

  capture(
    command: RequestActionCommand,
    originalBodyBase64: string,
    ownerGeneration = this.generation
  ): void {
    const snapshot = command.input.informationSnapshot;
    if (
      command.input.action.kind !== 'respond' ||
      !command.input.idempotencyKey ||
      ownerGeneration !== this.generation ||
      JSON.stringify([command.scopeIdentity, command.scopeEpoch]) !== this.binding ||
      (snapshot &&
        (snapshot.requestId !== command.input.action.request.requestId ||
          snapshot.requestVersion !== command.input.action.request.version ||
          snapshot.informationGeneration !== snapshot.sourceGeneration))
    )
      throw new HttpError('Original information command binding changed.', 409);
    let decoded: string;
    try {
      decoded = atob(originalBodyBase64);
      if (!decoded.length || decoded.length > 262144 || btoa(decoded) !== originalBodyBase64)
        throw new Error('Invalid original information bytes.');
    } catch {
      throw new HttpError('Original information bytes are invalid.', 409);
    }
    const pins = commandPins(command);
    if (
      this.original &&
      (this.original.command !== command ||
        this.original.pins !== pins ||
        this.original.originalBodyBase64 !== originalBodyBase64)
    )
      throw new HttpError('Original information wire body changed.', 409);
    this.original ??= Object.freeze({ command, pins, originalBodyBase64 });
  }

  read(command: RequestActionCommand): string | undefined {
    return this.original?.command === command &&
      this.original.pins === commandPins(command) &&
      JSON.stringify([command.scopeIdentity, command.scopeEpoch]) === this.binding
      ? this.original.originalBodyBase64
      : undefined;
  }

  clear(command: RequestActionCommand) {
    if (this.original?.command === command) this.original = undefined;
  }

  purge() {
    this.original = undefined;
  }
}
