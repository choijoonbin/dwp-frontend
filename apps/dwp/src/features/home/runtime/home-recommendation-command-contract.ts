import {
  HOME_DISMISS_RECOMMENDATION_ACTION,
  type HomeV2ReadModel,
  type HomeV2ResponseMetadata,
} from '@dwp-frontend/shared-utils';

import {
  HOME_WIDGET_BINDING_CATALOG_REVISION,
  NATIVE_HOME_WIDGET_BINDINGS,
} from './widget-registry-runtime';

export type HomeRecommendationCommandAvailability =
  | Readonly<{ kind: 'DISABLED' }>
  | Readonly<{ kind: 'DENIED' }>
  | Readonly<{ kind: 'UNAVAILABLE' }>
  | Readonly<{
      kind: 'READY';
      command: Readonly<{
        actionId: typeof HOME_DISMISS_RECOMMENDATION_ACTION.actionId;
        expectedResultVersion: string;
        instanceId: string;
        recommendationKeys: readonly string[];
      }>;
    }>;

function recommendationKeys(payload: Readonly<Record<string, unknown>>): readonly string[] | null {
  if (!Array.isArray(payload.data) || payload.data.length > 30) return null;
  const keys: string[] = [];
  for (const item of payload.data) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const key = (item as Record<string, unknown>).key;
    if (typeof key !== 'string' || !key.trim() || key.length > 160 || keys.includes(key)) {
      return null;
    }
    keys.push(key);
  }
  return keys;
}

/**
 * Resolves the single Wave 6 owner command. Every binding and capability field is exact;
 * a global commands flag alone never creates a callable action.
 */
export function resolveHomeRecommendationCommand(
  model: HomeV2ReadModel,
  metadata: HomeV2ResponseMetadata
): HomeRecommendationCommandAvailability {
  if (
    metadata.runtimeState !== 'COMMAND_CANARY' ||
    metadata.runtimeMode !== 'ACTIVE' ||
    metadata.renderAuthority !== 'HOME_V2' ||
    metadata.actionAuthority !== 'EXACT_ALLOWLIST' ||
    !metadata.commandsEnabled ||
    model.runtime.state !== 'COMMAND_CANARY' ||
    !model.runtime.commandsEnabled
  ) {
    return { kind: 'DISABLED' };
  }

  const widget = model.widgets.find(
    (candidate) => candidate.definitionKey === HOME_DISMISS_RECOMMENDATION_ACTION.definitionKey
  );
  if (!widget) return { kind: 'UNAVAILABLE' };
  if (widget.state === 'FORBIDDEN') return { kind: 'DENIED' };
  if (widget.state !== 'AVAILABLE' && widget.state !== 'PARTIAL') {
    return { kind: 'UNAVAILABLE' };
  }

  const binding = NATIVE_HOME_WIDGET_BINDINGS.find(
    (candidate) => candidate.definitionKey === HOME_DISMISS_RECOMMENDATION_ACTION.definitionKey
  );
  if (
    !binding ||
    widget.definitionVersion !== HOME_DISMISS_RECOMMENDATION_ACTION.definitionVersion ||
    widget.definitionVersion !== binding.semanticVersion ||
    widget.definitionManifestHash !== binding.expectedManifestHash ||
    widget.rendererBindingRevision !== HOME_WIDGET_BINDING_CATALOG_REVISION ||
    widget.rendererKey !== binding.rendererKey ||
    widget.governance.owner !== 'core.workspace' ||
    widget.governance.sourceAppResourceKey !== 'APP.WORK' ||
    widget.governance.sourceRoute !== '/work' ||
    widget.governance.requiredAuthorities.length !== 1 ||
    widget.governance.requiredAuthorities[0] !== 'APP.WORK:VIEW'
  ) {
    return { kind: 'UNAVAILABLE' };
  }

  const matching = widget.actions.filter(
    (action) => action.actionId === HOME_DISMISS_RECOMMENDATION_ACTION.actionId
  );
  const action = matching.length === 1 ? matching[0] : undefined;
  if (
    !action ||
    action.kind !== 'COMMAND' ||
    action.commandKey !== HOME_DISMISS_RECOMMENDATION_ACTION.commandKey ||
    action.labelKey !== HOME_DISMISS_RECOMMENDATION_ACTION.labelKey ||
    action.requiresConfirmation !== true ||
    action.sourceRoute !== null ||
    !action.expectedResultVersion ||
    action.expectedResultVersion !== widget.source.resultVersion ||
    widget.actions.some(
      (candidate) =>
        candidate.kind === 'COMMAND' &&
        candidate.actionId !== HOME_DISMISS_RECOMMENDATION_ACTION.actionId
    )
  ) {
    return { kind: 'DENIED' };
  }

  const keys = recommendationKeys(widget.payload);
  if (!keys) return { kind: 'UNAVAILABLE' };
  return {
    kind: 'READY',
    command: {
      actionId: HOME_DISMISS_RECOMMENDATION_ACTION.actionId,
      expectedResultVersion: action.expectedResultVersion,
      instanceId: widget.instanceId,
      recommendationKeys: keys,
    },
  };
}
