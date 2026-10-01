import type {
  ProviderFeatureFlag,
  ProviderFeatureRollout,
  ProviderFeatureValue,
} from '@dwp-frontend/shared-utils';

export type TypedScalarKind = 'STRING' | 'NUMBER' | 'BOOLEAN';
export type TypedEntryDraft = { id: string; key: string; kind: TypedScalarKind; value: string };
export type FeatureValueDraft = {
  primitive: string;
  entries: TypedEntryDraft[];
};
export type FeatureSchemaDraft = {
  description: string;
  minimum: string;
  maximum: string;
  requiredKeys: string[];
};
export type RolloutTargetingDraft = {
  tenantIds: string[];
  tenantKeys: string[];
  regions: string[];
  serviceTiers: string[];
  isolationModels: string[];
};
export type HealthGateDraft = {
  maxErrorRate: string;
  maxP95LatencyMs: string;
  minSuccessRate: string;
};
export type RolloutStageDraft = {
  id: string;
  exposurePercentage: string;
  minimumObservationMinutes: string;
  gate: HealthGateDraft;
};

export type RolloutFormIssue =
  | 'VALUE_REQUIRED'
  | 'NUMBER_REQUIRED'
  | 'ENTRY_KEY_REQUIRED'
  | 'ENTRY_DUPLICATE'
  | 'SCHEMA_RANGE'
  | 'TARGET_VALUE_REQUIRED'
  | 'STAGE_REQUIRED'
  | 'STAGE_PERCENTAGE'
  | 'STAGE_INCREASING'
  | 'STAGE_FINAL'
  | 'ALL_AT_ONCE_STAGE'
  | 'OBSERVATION_MINUTES'
  | 'HEALTH_VALUE';

export class RolloutFormError extends Error {
  constructor(readonly issue: RolloutFormIssue) {
    super(issue);
  }
}

export function buildFeatureValue(
  valueType: ProviderFeatureFlag['valueType'],
  draft: FeatureValueDraft
): ProviderFeatureValue {
  if (valueType === 'BOOLEAN') return draft.primitive === 'true';
  if (valueType === 'STRING') {
    if (!draft.primitive.trim()) throw new RolloutFormError('VALUE_REQUIRED');
    return draft.primitive;
  }
  if (valueType === 'NUMBER') {
    const number = Number(draft.primitive);
    if (!draft.primitive.trim() || !Number.isFinite(number)) {
      throw new RolloutFormError('NUMBER_REQUIRED');
    }
    return number;
  }
  const entries = buildTypedObject(draft.entries);
  if (!Object.keys(entries).length) throw new RolloutFormError('VALUE_REQUIRED');
  return entries;
}

export function buildFeatureSchema(
  valueType: ProviderFeatureFlag['valueType'],
  draft: FeatureSchemaDraft
): Record<string, unknown> {
  const type = { BOOLEAN: 'boolean', STRING: 'string', NUMBER: 'number', JSON: 'object' }[
    valueType
  ];
  const schema: Record<string, unknown> = { type };
  if (draft.description.trim()) schema.description = draft.description.trim();
  if (valueType === 'NUMBER') {
    const minimum = optionalNumber(draft.minimum);
    const maximum = optionalNumber(draft.maximum);
    if (minimum != null) schema.minimum = minimum;
    if (maximum != null) schema.maximum = maximum;
    if (minimum != null && maximum != null && minimum > maximum) {
      throw new RolloutFormError('SCHEMA_RANGE');
    }
  }
  if (valueType === 'JSON') {
    schema.additionalProperties = true;
    const required = cleanList(draft.requiredKeys);
    if (required.length) schema.required = required;
  }
  return schema;
}

export function buildTargeting(draft: RolloutTargetingDraft): Record<string, unknown> {
  const targeting: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as Array<keyof RolloutTargetingDraft>) {
    const values = cleanList(draft[key]);
    if (values.length !== draft[key].filter((value) => value.trim()).length) {
      throw new RolloutFormError('TARGET_VALUE_REQUIRED');
    }
    if (values.length) targeting[key] = values;
  }
  return targeting;
}

export function buildStages(
  strategy: ProviderFeatureRollout['strategy'],
  drafts: RolloutStageDraft[],
  stageName: (index: number, percentage: number) => string
): Array<{
  stageName: string;
  exposurePercentage: number;
  minimumObservationMinutes: number;
  healthGate: Record<string, unknown>;
}> {
  if (!drafts.length) throw new RolloutFormError('STAGE_REQUIRED');
  let previous = 0;
  const stages = drafts.map((draft, index) => {
    const percentage = Number(draft.exposurePercentage);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      throw new RolloutFormError('STAGE_PERCENTAGE');
    }
    if (percentage <= previous) throw new RolloutFormError('STAGE_INCREASING');
    previous = percentage;
    const observation = Number(draft.minimumObservationMinutes);
    if (!Number.isInteger(observation) || observation < 0) {
      throw new RolloutFormError('OBSERVATION_MINUTES');
    }
    return {
      stageName: stageName(index + 1, percentage),
      exposurePercentage: percentage,
      minimumObservationMinutes: observation,
      healthGate: buildHealthEvidence(draft.gate, false),
    };
  });
  if (previous !== 100) throw new RolloutFormError('STAGE_FINAL');
  if (strategy === 'ALL_AT_ONCE' && (stages.length !== 1 || previous !== 100)) {
    throw new RolloutFormError('ALL_AT_ONCE_STAGE');
  }
  return stages;
}

export function buildHealthEvidence(
  draft: HealthGateDraft,
  requireAll: boolean
): Record<string, unknown> {
  const entries = [
    ['maxErrorRate', draft.maxErrorRate, 0, 100],
    ['maxP95LatencyMs', draft.maxP95LatencyMs, 0, Number.MAX_SAFE_INTEGER],
    ['minSuccessRate', draft.minSuccessRate, 0, 100],
  ] as const;
  const evidence: Record<string, unknown> = {};
  for (const [key, raw, minimum, maximum] of entries) {
    if (!raw.trim()) {
      if (requireAll) throw new RolloutFormError('HEALTH_VALUE');
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new RolloutFormError('HEALTH_VALUE');
    }
    evidence[key] = value;
  }
  return evidence;
}

export function canDecideFeatureRollout(
  rollout: Pick<ProviderFeatureRollout, 'requestedBy'>,
  operatorId: number | null | undefined,
  canApprove: boolean
): boolean {
  return canApprove && operatorId != null && operatorId !== rollout.requestedBy;
}

export function featureValueTypePresentation(
  value: string
): ProviderFeatureFlag['valueType'] | 'UNAVAILABLE' {
  return ['BOOLEAN', 'STRING', 'NUMBER', 'JSON'].includes(value)
    ? (value as ProviderFeatureFlag['valueType'])
    : 'UNAVAILABLE';
}

export function featureRolloutStrategyPresentation(
  value: string
): ProviderFeatureRollout['strategy'] | 'UNAVAILABLE' {
  return ['RING', 'PERCENTAGE', 'ALL_AT_ONCE'].includes(value)
    ? (value as ProviderFeatureRollout['strategy'])
    : 'UNAVAILABLE';
}

export function rolloutTargetingPresentation(
  value: Record<string, unknown>
): Array<{ key: keyof RolloutTargetingDraft; values: string[] }> | null {
  const allowed = new Set<keyof RolloutTargetingDraft>([
    'tenantIds',
    'tenantKeys',
    'regions',
    'serviceTiers',
    'isolationModels',
  ]);
  const result: Array<{ key: keyof RolloutTargetingDraft; values: string[] }> = [];
  for (const [key, raw] of Object.entries(value)) {
    if (!allowed.has(key as keyof RolloutTargetingDraft) || !Array.isArray(raw)) return null;
    if (raw.some((candidate) => typeof candidate !== 'string' || !candidate.trim())) return null;
    result.push({ key: key as keyof RolloutTargetingDraft, values: raw as string[] });
  }
  return result;
}

function buildTypedObject(entries: TypedEntryDraft[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) throw new RolloutFormError('ENTRY_KEY_REQUIRED');
    if (key in result) throw new RolloutFormError('ENTRY_DUPLICATE');
    if (entry.kind === 'BOOLEAN') result[key] = entry.value === 'true';
    else if (entry.kind === 'NUMBER') {
      const value = Number(entry.value);
      if (!entry.value.trim() || !Number.isFinite(value)) {
        throw new RolloutFormError('NUMBER_REQUIRED');
      }
      result[key] = value;
    } else {
      if (!entry.value.trim()) throw new RolloutFormError('VALUE_REQUIRED');
      result[key] = entry.value;
    }
  }
  return result;
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new RolloutFormError('NUMBER_REQUIRED');
  return number;
}

function cleanList(values: string[]): string[] {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  return [...new Set(cleaned)];
}
