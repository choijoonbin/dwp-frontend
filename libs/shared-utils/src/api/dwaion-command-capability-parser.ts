import { HttpError } from '../http-error';

import type {
  DwaionAdminCommandCapabilitiesSnapshot,
  DwaionGovernedCommandKind,
} from './dwaion-control-plane-contract';
import {
  DWAION_GOVERNED_COMMAND_KINDS,
  isDwaionGovernedCommandKind,
} from './dwaion-control-plane-parser';

const STATUSES = new Set(['AVAILABLE', 'PARTIAL', 'NOT_CONFIGURED', 'UNAVAILABLE']);
const FAMILIES = new Set(['A01', 'A02', 'A03', 'A04', 'A05', 'A06']);
const MODES = new Set(['INTERNAL', 'EXTERNAL_ADAPTER']);

export function parseDwaionCommandCapabilities(
  value: unknown
): DwaionAdminCommandCapabilitiesSnapshot {
  const snapshot = object(value, 'snapshot');
  timestamp(snapshot.generatedAt, 'generatedAt');
  if (typeof snapshot.workerAvailable !== 'boolean') invalid('workerAvailable');
  if (
    !Array.isArray(snapshot.commands) ||
    snapshot.commands.length !== DWAION_GOVERNED_COMMAND_KINDS.size
  ) {
    invalid('commands');
  }
  const observed = new Set<DwaionGovernedCommandKind>();
  snapshot.commands.forEach((candidate, index) => {
    const item = object(candidate, `commands[${index}]`);
    if (!isDwaionGovernedCommandKind(item.kind)) invalid(`commands[${index}].kind`);
    const kind = item.kind;
    if (observed.has(kind)) invalid(`commands[${index}].kind`);
    observed.add(kind);
    enumValue(item.family, FAMILIES, `commands[${index}].family`);
    enumValue(item.executionMode, MODES, `commands[${index}].executionMode`);
    const status = enumValue(item.status, STATUSES, `commands[${index}].status`);
    if (typeof item.configured !== 'boolean') invalid(`commands[${index}].configured`);
    optionalText(item.reason, `commands[${index}].reason`);
    optionalText(item.recoveryHint, `commands[${index}].recoveryHint`);
    if ((status === 'AVAILABLE') !== item.configured) {
      invalid(`commands[${index}].configured`);
    }
    if (status !== 'AVAILABLE' && (!item.reason || !item.recoveryHint)) {
      invalid(`commands[${index}].recovery`);
    }
  });
  if (
    observed.size !== DWAION_GOVERNED_COMMAND_KINDS.size ||
    [...DWAION_GOVERNED_COMMAND_KINDS].some((kind) => !observed.has(kind))
  ) {
    invalid('commands');
  }
  return snapshot as DwaionAdminCommandCapabilitiesSnapshot;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(label);
  return value as Record<string, unknown>;
}

function timestamp(value: unknown, label: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) invalid(label);
}

function enumValue(value: unknown, values: ReadonlySet<string>, label: string): string {
  if (typeof value !== 'string' || !values.has(value)) invalid(label);
  return value;
}

function optionalText(value: unknown, label: string): void {
  if (value != null && (typeof value !== 'string' || !value.trim())) invalid(label);
}

function invalid(label: string): never {
  throw new HttpError(`DWAI-ON command capability ${label} response is invalid.`, 502);
}
