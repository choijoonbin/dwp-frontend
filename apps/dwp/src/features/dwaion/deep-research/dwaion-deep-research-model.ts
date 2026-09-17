import type {
  DwaionResearchDeliverableType,
  DwaionResearchDeliveryCapabilities,
  DwaionResearchDeliveryType,
  DwaionResearchPlanDefinition,
  DwaionResearchRunState,
} from '@dwp-frontend/shared-utils';

const DELIVERY_CAPABILITY_BY_TYPE: Record<
  DwaionResearchDeliveryType,
  keyof DwaionResearchDeliveryCapabilities
> = {
  ARTIFACT: 'artifact',
  PROPOSAL: 'proposal',
  EXPORT: 'export',
  HANDOFF: 'handoff',
  SHARE: 'share',
  ROUTINE: 'routine',
};

export const DWAION_RESEARCH_SOURCES = [
  'WORK_ITEM',
  'MAIL',
  'CALENDAR',
  'ARTIFACT',
  'APPROVAL_REQUEST',
] as const;

export const DWAION_RESEARCH_DELIVERABLES: readonly DwaionResearchDeliverableType[] = [
  'REPORT',
  'EXECUTIVE_SUMMARY',
  'COMPARISON',
  'SOURCE_MAP',
];

export type DwaionResearchDraft = {
  goal: string;
  question: string;
  successCriteria: string;
  deliverableTypes: DwaionResearchDeliverableType[];
  allowedSources: string[];
  requireAllAllowedSources: boolean;
  maximumMinutes: number;
  maximumSources: number;
  maximumTokens: number;
};

export type DwaionResearchDraftError =
  'GOAL' | 'QUESTION' | 'CRITERIA' | 'DELIVERABLE' | 'SOURCE' | 'BUDGET';

export function createDwaionResearchDraft(): DwaionResearchDraft {
  return {
    goal: '',
    question: '',
    successCriteria: '',
    deliverableTypes: ['REPORT', 'EXECUTIVE_SUMMARY'],
    allowedSources: ['WORK_ITEM', 'MAIL', 'CALENDAR'],
    requireAllAllowedSources: false,
    maximumMinutes: 25,
    maximumSources: 30,
    maximumTokens: 85_000,
  };
}

export function dwaionResearchDraftFromDefinition(
  definition: DwaionResearchPlanDefinition
): DwaionResearchDraft {
  return {
    goal: definition.goal,
    question: definition.question,
    successCriteria: definition.successCriteria.join('\n'),
    deliverableTypes: [...definition.deliverableTypes],
    allowedSources: definition.sourcePolicies
      .filter((source) => source.allowed)
      .map((source) => source.sourceKey),
    requireAllAllowedSources: definition.requireAllAllowedSources,
    maximumMinutes: definition.budget.maximumMinutes,
    maximumSources: definition.budget.maximumSources,
    maximumTokens: definition.budget.maximumTokens,
  };
}

export function validateDwaionResearchDraft(
  draft: DwaionResearchDraft
): DwaionResearchDraftError | null {
  if (draft.goal.trim().length < 10 || draft.goal.length > 4_000) return 'GOAL';
  if (draft.question.trim().length < 10 || draft.question.length > 4_000) return 'QUESTION';
  if (!normalizedLines(draft.successCriteria).length) return 'CRITERIA';
  if (!draft.deliverableTypes.length) return 'DELIVERABLE';
  if (!draft.allowedSources.length) return 'SOURCE';
  if (
    !integerWithin(draft.maximumMinutes, 1, 240) ||
    !integerWithin(draft.maximumSources, 1, 500) ||
    !integerWithin(draft.maximumTokens, 128, 2_000_000)
  )
    return 'BUDGET';
  return null;
}

export function dwaionResearchDefinition(draft: DwaionResearchDraft): DwaionResearchPlanDefinition {
  const error = validateDwaionResearchDraft(draft);
  if (error) throw new TypeError(`Deep research draft is invalid: ${error}`);
  const allowed = new Set(draft.allowedSources);
  return {
    goal: draft.goal.trim(),
    question: draft.question.trim(),
    successCriteria: normalizedLines(draft.successCriteria),
    deliverableTypes: [...draft.deliverableTypes],
    sourcePolicies: DWAION_RESEARCH_SOURCES.map((sourceKey) => ({
      sourceKey,
      allowed: allowed.has(sourceKey),
      scope: allowed.has(sourceKey) ? 'Current user authorized scope' : 'Excluded by user',
    })),
    requireAllAllowedSources: draft.requireAllAllowedSources,
    budget: {
      maximumMinutes: draft.maximumMinutes,
      maximumSources: draft.maximumSources,
      maximumTokens: draft.maximumTokens,
    },
  };
}

export function dwaionResearchRunNeedsPolling(state: DwaionResearchRunState): boolean {
  return ['QUEUED', 'RUNNING', 'CANCELLING'].includes(state);
}

export function dwaionResearchRunCanDeliver(state: DwaionResearchRunState): boolean {
  return state === 'COMPLETED';
}

export function dwaionResearchDeliveryCapabilityKey(
  type: DwaionResearchDeliveryType
): keyof DwaionResearchDeliveryCapabilities {
  return DELIVERY_CAPABILITY_BY_TYPE[type];
}

export function dwaionResearchProgressPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
}

function normalizedLines(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function integerWithin(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}
