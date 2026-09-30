const ACTION_LABELS: Record<string, string> = {
  'reference-set.seeded': 'referenceData.activity.actions.seeded',
  'reference-set.created': 'referenceData.activity.actions.setCreated',
  'reference-set.updated': 'referenceData.activity.actions.setUpdated',
  'reference-set.activated': 'referenceData.activity.actions.setActivated',
  'reference-set.retired': 'referenceData.activity.actions.setRetired',
  'reference-item.created': 'referenceData.activity.actions.itemCreated',
  'reference-item.updated': 'referenceData.activity.actions.itemUpdated',
  'reference-item.activated': 'referenceData.activity.actions.itemActivated',
  'reference-item.retired': 'referenceData.activity.actions.itemRetired',
};
const OUTCOMES = new Set(['SUCCESS', 'DENIED', 'FAILED']);

export function referenceActivityActionLabelKey(value: string): string {
  return ACTION_LABELS[value] ?? 'referenceData.activity.actions.UNKNOWN';
}

export function referenceActivityOutcomeLabelKey(value: string): string {
  return `referenceData.activity.outcomes.${OUTCOMES.has(value) ? value : 'UNKNOWN'}`;
}

export function referenceActivityActorLabelKey(value: string): string {
  if (value === 'SERVICE') return 'referenceData.activity.systemActor';
  if (value === 'USER') return 'referenceData.activity.userActor';
  return 'referenceData.activity.unknownActor';
}
