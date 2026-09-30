const REVISION_STATE_KEYS: Record<string, string> = {
  DRAFT: 'navigationManager.studio.history.states.draft',
  PUBLISHED: 'navigationManager.studio.history.states.published',
  SUPERSEDED: 'navigationManager.studio.history.states.superseded',
  CANCELLED: 'navigationManager.studio.history.states.cancelled',
};

const NODE_TYPE_KEYS: Record<string, string> = {
  GROUP: 'navigationManager.types.GROUP',
  APP: 'navigationManager.types.APP',
};

const NODE_LIFECYCLE_KEYS: Record<string, string> = {
  DRAFT: 'common.lifecycle.DRAFT',
  ACTIVE: 'common.lifecycle.ACTIVE',
  RETIRED: 'common.lifecycle.RETIRED',
};

export function navigationRevisionStateLabelKey(value: string): string {
  return REVISION_STATE_KEYS[value] ?? 'navigationManager.studio.history.states.unavailable';
}

export function navigationNodeTypeLabelKey(value: string): string {
  return NODE_TYPE_KEYS[value] ?? 'navigationManager.types.UNKNOWN';
}

export function navigationNodeLifecycleLabelKey(value: string): string {
  return NODE_LIFECYCLE_KEYS[value] ?? 'common.lifecycle.UNKNOWN';
}
