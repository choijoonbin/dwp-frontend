import {
  isCanonicalOwnerWidgetSourceRoute,
  resolveOwnerWidgetContract,
} from './owner-widget-contracts';
import type {
  OwnerWidgetBindingIdentity,
  OwnerWidgetContract,
  OwnerWidgetDefinitionKey,
} from './owner-widget-contracts';
import { parseOwnerWidgetPayload } from './owner-widget-payload-parsers';
import type { OwnerWidgetPayload } from './owner-widget-payload-types';

const SOURCE_ACTION_KEYS = [
  'actionId',
  'labelKey',
  'kind',
  'sourceRoute',
  'commandKey',
  'expectedResultVersion',
  'requiresConfirmation',
] as const;

const NO_COMMAND_ACTIONS = [] as const;

export type OwnerWidgetSourceAction = Readonly<{
  actionId: 'open-source';
  labelKey: 'home.action.openSource';
  kind: 'SOURCE_ROUTE';
  sourceRoute: OwnerWidgetContract['canonicalSourceRoute'];
  requiresConfirmation: false;
}>;

type NormalizedOwnerWidgetFor<K extends OwnerWidgetDefinitionKey> = Readonly<{
  definitionKey: K;
  definitionVersion: '1.0.0';
  rendererKey: `home.${string}`;
  surface: OwnerWidgetContract['surface'];
  sourceRoute: OwnerWidgetContract['canonicalSourceRoute'];
  sourceAction: OwnerWidgetSourceAction | null;
  commandActions: readonly [];
  payload: OwnerWidgetPayload<K>;
}>;

export type NormalizedOwnerWidget = {
  [K in OwnerWidgetDefinitionKey]: NormalizedOwnerWidgetFor<K>;
}[OwnerWidgetDefinitionKey];

export type NormalizeOwnerWidgetInput = OwnerWidgetBindingIdentity &
  Readonly<{
    payload: unknown;
    governanceSourceRoute: unknown;
    actions: unknown;
    locale?: string;
  }>;

export type NormalizeOwnerWidgetFailureCode =
  | 'UNSUPPORTED_BINDING'
  | 'SOURCE_ROUTE_MISMATCH'
  | 'ACTION_CONTRACT_MISMATCH'
  | 'MALFORMED_PAYLOAD';

export type NormalizeOwnerWidgetResult =
  | Readonly<{ ok: true; value: NormalizedOwnerWidget }>
  | Readonly<{ ok: false; code: NormalizeOwnerWidgetFailureCode }>;

function exactActionRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const action = value as Record<string, unknown>;
  const actual = Object.keys(action).sort();
  const expected = [...SOURCE_ACTION_KEYS].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? action
    : null;
}

function parseSourceAction(
  contract: OwnerWidgetContract,
  value: unknown
): OwnerWidgetSourceAction | null | false {
  const action = exactActionRecord(value);
  if (!action) return false;
  if (
    action.actionId !== 'open-source' ||
    action.labelKey !== 'home.action.openSource' ||
    action.kind !== 'SOURCE_ROUTE' ||
    action.sourceRoute !== contract.canonicalSourceRoute ||
    action.commandKey !== null ||
    action.expectedResultVersion !== null ||
    action.requiresConfirmation !== false
  ) {
    return false;
  }
  return {
    actionId: 'open-source',
    labelKey: 'home.action.openSource',
    kind: 'SOURCE_ROUTE',
    sourceRoute: contract.canonicalSourceRoute,
    requiresConfirmation: false,
  };
}

export function normalizeOwnerWidget(input: NormalizeOwnerWidgetInput): NormalizeOwnerWidgetResult {
  const contract = resolveOwnerWidgetContract(input);
  if (!contract) return { ok: false, code: 'UNSUPPORTED_BINDING' };
  if (!isCanonicalOwnerWidgetSourceRoute(contract, input.governanceSourceRoute)) {
    return { ok: false, code: 'SOURCE_ROUTE_MISMATCH' };
  }
  if (!Array.isArray(input.actions) || input.actions.length > 1) {
    return { ok: false, code: 'ACTION_CONTRACT_MISMATCH' };
  }
  const sourceAction =
    input.actions.length === 0 ? null : parseSourceAction(contract, input.actions[0]);
  if (sourceAction === false) return { ok: false, code: 'ACTION_CONTRACT_MISMATCH' };

  const parsed = parseOwnerWidgetPayload(contract.definitionKey, input.payload, input.locale);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    value: {
      definitionKey: contract.definitionKey,
      definitionVersion: contract.definitionVersion,
      rendererKey: contract.rendererKey,
      surface: contract.surface,
      sourceRoute: contract.canonicalSourceRoute,
      sourceAction,
      commandActions: NO_COMMAND_ACTIONS,
      payload: parsed.value,
    } as NormalizedOwnerWidget,
  };
}
