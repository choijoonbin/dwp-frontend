import { HttpError } from '../http-error';

export const HOME_V2_RUNTIME_STATES = [
  'DISABLED',
  'SHADOW_COMPARE',
  'READ_ONLY_ACTIVE',
  'COMMAND_CANARY',
] as const;
export type HomeV2RuntimeState = (typeof HOME_V2_RUNTIME_STATES)[number];

export const HOME_V2_ROLLOUT_RINGS = [
  'CONTROL',
  'INTERNAL',
  'PILOT',
  'EARLY_ADOPTER',
  'GA',
] as const;
export type HomeV2RolloutRing = (typeof HOME_V2_ROLLOUT_RINGS)[number];

export type HomeV2RuntimeMode = 'ACTIVE' | 'SHADOW';
export type HomeV2RegistryMode = 'STATIC' | 'SHADOW' | 'AUTHORITATIVE';
export type HomeV2RenderAuthority = 'LEGACY' | 'HOME_V2';
export type HomeV2ActionAuthority = 'DISABLED' | 'EXACT_ALLOWLIST';

export type HomeV2ResponseMetadata = Readonly<{
  actionAuthority: HomeV2ActionAuthority;
  cacheControl: 'private, max-age=0, must-revalidate';
  commandsEnabled: boolean;
  decisionRevision: string;
  registryAuthoritative: boolean;
  renderAuthority: HomeV2RenderAuthority;
  rolloutRing: HomeV2RolloutRing;
  rolloutRevision: string;
  runtimeMode: HomeV2RuntimeMode;
  runtimeState: HomeV2RuntimeState;
  vary: string;
}>;

export const HOME_V2_RUNTIME_HEADER = 'X-DWP-Home-Runtime-Mode' as const;
export const HOME_V2_DECISION_REVISION_HEADER = 'X-DWP-Decision-Revision' as const;
export const HOME_V2_STATE_HEADER = 'X-DWP-Home-Runtime-State' as const;
export const HOME_V2_RING_HEADER = 'X-DWP-Home-Rollout-Ring' as const;
export const HOME_V2_REVISION_HEADER = 'X-DWP-Home-Rollout-Revision' as const;
export const HOME_V2_COMMANDS_HEADER = 'X-DWP-Home-Commands-Enabled' as const;
export const HOME_V2_REGISTRY_HEADER = 'X-DWP-Widget-Registry-Authoritative' as const;

const HOME_V2_VARY_TOKENS = new Set([
  'accept-language',
  'x-dwp-tenant-id',
  'x-dwp-user-id',
  'x-dwp-person-public-id',
  'x-dwp-permissions',
  'x-dwp-roles',
  'x-dwp-group-refs',
  'x-dwp-current-decision-revision',
  'x-dwp-current-revalidate-at',
  'x-dwp-home-runtime-state',
  'x-dwp-home-rollout-ring',
  'x-dwp-home-rollout-revision',
]);
const RUNTIME_STATES = new Set<string>(HOME_V2_RUNTIME_STATES);
const ROLLOUT_RINGS = new Set<string>(HOME_V2_ROLLOUT_RINGS);
const ROLLOUT_REVISION_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/u;

function parseDecisionRevision(headers: Headers): string {
  const decisionRevision = headers.get(HOME_V2_DECISION_REVISION_HEADER)?.trim() ?? '';
  if (!decisionRevision || decisionRevision.length > 200) {
    invalid(`headers.${HOME_V2_DECISION_REVISION_HEADER}`);
  }
  return decisionRevision;
}

function invalid(path: string): never {
  throw new HttpError(`Home v2 response is invalid at ${path}.`, 502);
}

function parseBooleanHeader(headers: Headers, name: string): boolean {
  const value = headers.get(name)?.trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  invalid(`headers.${name}`);
}

function parseExplicitRuntimeState(
  headers: Headers,
  runtimeMode: HomeV2RuntimeMode,
  commandsEnabled: boolean,
  registryAuthoritative: boolean
): Pick<HomeV2ResponseMetadata, 'rolloutRevision' | 'rolloutRing' | 'runtimeState'> {
  const stateHeader = headers.get(HOME_V2_STATE_HEADER)?.trim();
  if (!stateHeader) invalid(`headers.${HOME_V2_STATE_HEADER}`);
  if (!RUNTIME_STATES.has(stateHeader)) invalid(`headers.${HOME_V2_STATE_HEADER}`);
  const runtimeState = stateHeader as HomeV2RuntimeState;
  const ringHeader = headers.get(HOME_V2_RING_HEADER)?.trim();
  if (!ringHeader || !ROLLOUT_RINGS.has(ringHeader)) invalid(`headers.${HOME_V2_RING_HEADER}`);
  const rolloutRing = ringHeader as HomeV2RolloutRing;
  const rolloutRevision = headers.get(HOME_V2_REVISION_HEADER)?.trim() ?? '';
  if (!ROLLOUT_REVISION_PATTERN.test(rolloutRevision)) {
    invalid(`headers.${HOME_V2_REVISION_HEADER}`);
  }
  if (runtimeState === 'DISABLED') invalid(`headers.${HOME_V2_STATE_HEADER}`);
  if (runtimeState === 'SHADOW_COMPARE' && runtimeMode !== 'SHADOW') {
    invalid(`headers.${HOME_V2_RUNTIME_HEADER}`);
  }
  if (runtimeState !== 'SHADOW_COMPARE' && runtimeMode !== 'ACTIVE') {
    invalid(`headers.${HOME_V2_RUNTIME_HEADER}`);
  }
  if (commandsEnabled !== (runtimeState === 'COMMAND_CANARY')) {
    invalid(`headers.${HOME_V2_COMMANDS_HEADER}`);
  }
  if (runtimeState === 'SHADOW_COMPARE' && registryAuthoritative) {
    invalid(`headers.${HOME_V2_REGISTRY_HEADER}`);
  }
  if (runtimeState !== 'SHADOW_COMPARE' && rolloutRing === 'CONTROL') {
    invalid(`headers.${HOME_V2_RING_HEADER}`);
  }
  return { rolloutRevision, rolloutRing, runtimeState };
}

export function parseHomeV2ResponseMetadata(headers: Headers | undefined): HomeV2ResponseMetadata {
  if (!headers) invalid('headers');
  const cacheControl = headers.get('Cache-Control')?.trim().toLowerCase();
  if (cacheControl !== 'private, max-age=0, must-revalidate') invalid('headers.Cache-Control');
  const runtimeModeHeader = headers.get(HOME_V2_RUNTIME_HEADER)?.trim();
  if (runtimeModeHeader !== 'ACTIVE' && runtimeModeHeader !== 'SHADOW') {
    invalid(`headers.${HOME_V2_RUNTIME_HEADER}`);
  }
  const runtimeMode = runtimeModeHeader as HomeV2RuntimeMode;
  const vary = headers.get('Vary')?.trim();
  if (!vary) invalid('headers.Vary');
  const varyTokens = vary.split(',').map((token) => token.trim().toLowerCase());
  if (
    varyTokens.length !== HOME_V2_VARY_TOKENS.size ||
    new Set(varyTokens).size !== HOME_V2_VARY_TOKENS.size ||
    varyTokens.some((token) => !HOME_V2_VARY_TOKENS.has(token))
  ) {
    invalid('headers.Vary');
  }
  const commandsEnabled = parseBooleanHeader(headers, HOME_V2_COMMANDS_HEADER);
  const registryAuthoritative = parseBooleanHeader(headers, HOME_V2_REGISTRY_HEADER);
  const decisionRevision = parseDecisionRevision(headers);
  const explicit = parseExplicitRuntimeState(
    headers,
    runtimeMode,
    commandsEnabled,
    registryAuthoritative
  );
  return {
    actionAuthority: explicit.runtimeState === 'COMMAND_CANARY' ? 'EXACT_ALLOWLIST' : 'DISABLED',
    cacheControl,
    commandsEnabled,
    decisionRevision,
    registryAuthoritative,
    renderAuthority: explicit.runtimeState === 'SHADOW_COMPARE' ? 'LEGACY' : 'HOME_V2',
    rolloutRing: explicit.rolloutRing,
    rolloutRevision: explicit.rolloutRevision,
    runtimeMode,
    runtimeState: explicit.runtimeState,
    vary,
  };
}

export function assertHomeV2RegistryAuthority(
  metadata: HomeV2ResponseMetadata,
  registryMode: HomeV2RegistryMode
): void {
  const modelAuthoritative = registryMode === 'AUTHORITATIVE';
  if (
    modelAuthoritative !== metadata.registryAuthoritative ||
    (modelAuthoritative && metadata.runtimeState === 'SHADOW_COMPARE')
  ) {
    invalid('data.registryMode');
  }
}

export function assertHomeV2RuntimeDecision(
  metadata: HomeV2ResponseMetadata,
  runtime: Readonly<{
    commandsEnabled: boolean;
    registryAuthoritative: boolean;
    rolloutRing: HomeV2RolloutRing;
    rolloutRevision: string;
    state: HomeV2RuntimeState;
  }>,
  registryMode: HomeV2RegistryMode
): void {
  if (
    runtime.state !== metadata.runtimeState ||
    runtime.rolloutRing !== metadata.rolloutRing ||
    runtime.rolloutRevision !== metadata.rolloutRevision ||
    runtime.commandsEnabled !== metadata.commandsEnabled ||
    runtime.registryAuthoritative !== metadata.registryAuthoritative
  ) {
    invalid('data.runtime');
  }
  assertHomeV2RegistryAuthority(metadata, registryMode);
}
