export const DWAION_AGENT_KEY = 'DWP_ASSISTANT';
export const DWAION_APPROVAL_EXPERT_AGENT_KEY = 'DWP_APPROVAL_EXPERT';
export const DWAION_PRODUCT_PATH = '/dwaion';
export const DWAION_WORKSPACE_PATH = '/dwaion/new';
export const DWAION_LEGACY_PATH = '/ask';
export const DWAION_HANDOFF_TTL_MS = 15 * 60 * 1000;

export const DWAION_ACTION_KEYS = [
  'CALENDAR.EVENT.CREATE',
  'MAIL.DRAFT.CREATE',
  'SERVICE.REQUEST.CREATE',
  'APPROVAL.REQUEST.CREATE',
] as const;

export type DwaionAgentKey = typeof DWAION_AGENT_KEY | typeof DWAION_APPROVAL_EXPERT_AGENT_KEY;
export type DwaionActionKey = (typeof DWAION_ACTION_KEYS)[number];
export type DwaionHandoffInputValue = string | string[];

export type DwaionHandoff = {
  version: 1;
  handoffId: string;
  actionKey: DwaionActionKey;
  planHash: string;
  reviewedInputs: Record<string, DwaionHandoffInputValue>;
  sourceReferences: string[];
  createdAt: string;
  expiresAt: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PLAN_HASH_PATTERN = /^[a-f0-9]{64}$/u;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/u;
const INPUT_CONTRACTS: Record<DwaionActionKey, Record<string, number | 'emails' | 'datetime'>> = {
  'CALENDAR.EVENT.CREATE': {
    title: 300,
    startsAt: 'datetime',
    endsAt: 'datetime',
    attendees: 'emails',
  },
  'MAIL.DRAFT.CREATE': { to: 'emails', subject: 500, body: 100_000 },
  'SERVICE.REQUEST.CREATE': { serviceCategory: 100, requestSummary: 240 },
  'APPROVAL.REQUEST.CREATE': {
    formType: 128,
    title: 300,
    businessJustification: 2_000,
    approvers: 'emails',
  },
};

export function resolveDwaionAgentKey(value: string | null | undefined): DwaionAgentKey {
  return value?.trim().toUpperCase() === DWAION_APPROVAL_EXPERT_AGENT_KEY
    ? DWAION_APPROVAL_EXPERT_AGENT_KEY
    : DWAION_AGENT_KEY;
}

export function dwaionWorkspaceRoute(
  query?: string,
  conversationId?: string,
  agentKey: DwaionAgentKey = DWAION_AGENT_KEY
): string {
  const params = new URLSearchParams();
  const normalizedConversationId = conversationId?.trim();
  if (!normalizedConversationId && query?.trim()) params.set('q', query.trim());
  if (agentKey !== DWAION_AGENT_KEY) params.set('agent', agentKey);
  const search = params.toString();
  const path = normalizedConversationId
    ? `${DWAION_PRODUCT_PATH}/conversations/${encodeURIComponent(normalizedConversationId)}`
    : DWAION_WORKSPACE_PATH;
  return search ? `${path}?${search}` : path;
}

export function createDwaionHandoff(
  input: Pick<DwaionHandoff, 'actionKey' | 'planHash' | 'reviewedInputs' | 'sourceReferences'>,
  now = new Date()
): DwaionHandoff {
  const createdAt = now.toISOString();
  return {
    version: 1,
    handoffId: globalThis.crypto.randomUUID(),
    ...input,
    createdAt,
    expiresAt: new Date(now.getTime() + DWAION_HANDOFF_TTL_MS).toISOString(),
  };
}

export function parseDwaionHandoff(
  state: unknown,
  expectedAction?: DwaionActionKey,
  now = Date.now()
): DwaionHandoff | null {
  if (!isRecord(state)) return null;
  const value = state.dwaionHandoff;
  if (!isRecord(value) || value.version !== 1) return null;
  if (!isActionKey(value.actionKey) || (expectedAction && value.actionKey !== expectedAction)) {
    return null;
  }
  if (
    typeof value.handoffId !== 'string' ||
    !UUID_PATTERN.test(value.handoffId) ||
    typeof value.planHash !== 'string' ||
    !PLAN_HASH_PATTERN.test(value.planHash) ||
    !isDate(value.createdAt) ||
    !isDate(value.expiresAt)
  ) {
    return null;
  }
  const createdAt = Date.parse(value.createdAt);
  const expiresAt = Date.parse(value.expiresAt);
  if (
    createdAt > now + 60_000 ||
    expiresAt <= now ||
    expiresAt <= createdAt ||
    expiresAt - createdAt > DWAION_HANDOFF_TTL_MS + 5_000
  ) {
    return null;
  }
  if (!isSourceReferences(value.sourceReferences)) return null;
  const reviewedInputs = parseReviewedInputs(value.reviewedInputs, value.actionKey);
  if (!reviewedInputs) return null;
  return {
    version: 1,
    handoffId: value.handoffId,
    actionKey: value.actionKey,
    planHash: value.planHash,
    reviewedInputs,
    sourceReferences: value.sourceReferences,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
  };
}

export function dwaionHandoffText(handoff: DwaionHandoff | null, field: string): string | null {
  const value = handoff?.reviewedInputs[field];
  return typeof value === 'string' ? value : null;
}

export function dwaionHandoffStrings(handoff: DwaionHandoff | null, field: string): string[] {
  const value = handoff?.reviewedInputs[field];
  return Array.isArray(value) ? value : [];
}

function parseReviewedInputs(
  value: unknown,
  actionKey: DwaionActionKey
): Record<string, DwaionHandoffInputValue> | null {
  if (!isRecord(value) || Object.keys(value).length > 20) return null;
  const contract = INPUT_CONTRACTS[actionKey];
  const entries: [string, DwaionHandoffInputValue][] = [];
  for (const [key, item] of Object.entries(value)) {
    const rule = contract[key];
    if (!rule) return null;
    if (typeof rule === 'number') {
      if (typeof item !== 'string' || item.length > rule) return null;
      entries.push([key, item]);
      continue;
    }
    if (rule === 'datetime') {
      if (typeof item !== 'string' || !isDate(item) || !hasTimeZone(item)) return null;
      entries.push([key, item]);
      continue;
    }
    if (
      !Array.isArray(item) ||
      item.length > 50 ||
      !item.every((email) => typeof email === 'string' && EMAIL_PATTERN.test(email))
    ) {
      return null;
    }
    entries.push([key, item]);
  }
  return Object.fromEntries(entries);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isActionKey(value: unknown): value is DwaionActionKey {
  return typeof value === 'string' && DWAION_ACTION_KEYS.includes(value as DwaionActionKey);
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function hasTimeZone(value: string): boolean {
  return /(?:Z|[+-][0-9]{2}:[0-9]{2})$/u.test(value);
}

function isSourceReferences(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 20 &&
    value.every((item) => typeof item === 'string' && item.length > 0 && item.length <= 200)
  );
}
