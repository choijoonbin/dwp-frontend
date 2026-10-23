import {
  PER008_CREATE_ACTION_KEY,
  PER008_ROUTES,
  PER008_TEAM_SORTS,
} from './per008-model';
import type {
  Per008AnonymityMode,
  Per008AssignedFeedbackDetail,
  Per008AssignedFeedbackList,
  Per008AssignedFeedbackListItem,
  Per008CreateAction,
  Per008CreateFeedbackRequestCommand,
  Per008FeedbackAnswer,
  Per008FeedbackActionTarget,
  Per008FeedbackRelease,
  Per008FeedbackRequestReceipt,
  Per008FeedbackResponseCommand,
  Per008FeedbackSubmissionReceipt,
  Per008Field,
  Per008Question,
  Per008RequestOptions,
  Per008TeamItem,
  Per008TeamAction,
  Per008TeamProjection,
  Per008TeamQuery,
} from './per008-model';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const STATUS = /^[A-Z][A-Z0-9_]{1,63}$/;
const REVISION = /^[A-Za-z0-9._:-]{1,128}$/;
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/;
const DISPLAY_KEY = /^[a-z][a-z0-9._-]{1,127}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|([+-])(\d{2}):(\d{2}))$/;

const REQUEST_STATES = new Set(['DRAFT', 'OPEN', 'CLOSED', 'AGGREGATED', 'RELEASED', 'CANCELLED']);
const ASSIGNMENT_STATES = new Set(['ASSIGNED', 'SUBMITTED', 'DECLINED', 'CANCELLED']);
const QUERY_STATES = new Set(['COMPLETE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE']);
const ANONYMITY_MODES = new Set<Per008AnonymityMode>(['IDENTIFIED', 'MASKED', 'ANONYMOUS_AGGREGATE']);
const ANSWER_TYPES = new Set(['TEXT', 'NUMBER', 'SINGLE_CHOICE', 'MULTI_CHOICE']);
const FIELD_GROUPS = [
  'PERFORMANCE_ASSIGNMENT',
  'DUE_STATUS',
  'LIMITED_PROFILE',
  'PERFORMANCE_FEEDBACK_ACTION_TARGET',
] as const;
const TEAM_SORTS = new Set<string>(PER008_TEAM_SORTS);

function invalid(): never { throw new Error('PER008_CONTRACT_INVALID'); }
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  if (required.some((key) => !(key in value)) ||
      Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) invalid();
}
function nonBlank(value: unknown, max = 512): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;
}
function uuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
function instant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = INSTANT.exec(value);
  if (!parts || Number(parts[2]) > 23 || Number(parts[3]) > 59 ||
      parts[4] !== undefined && Number(parts[4]) > 59) return false;
  if (parts[6] !== 'Z' && (Number(parts[8]) > 18 || Number(parts[9]) > 59 ||
      Number(parts[8]) === 18 && Number(parts[9]) !== 0)) return false;
  return Number.isFinite(Date.parse(value));
}
function date(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
function stringList(value: unknown, max: number): readonly string[] {
  if (!Array.isArray(value) || value.length > max || value.some((item) => !uuid(item))) invalid();
  const list = value as string[];
  if (new Set(list).size !== list.length || list.some((item, index) => index > 0 && list[index - 1]! >= item)) invalid();
  return list;
}

function uniqueList(value: unknown, pattern: RegExp, max = 50): readonly string[] {
  if (!Array.isArray(value) || value.length > max ||
      value.some((item) => typeof item !== 'string' || !pattern.test(item)) ||
      new Set(value).size !== value.length) invalid();
  return value as string[];
}

export function parsePer008TeamQuery(wire: unknown): Per008TeamQuery {
  const query = record(wire);
  keys(query, ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId'], ['asOf', 'cursor']);
  if (!integer(query.limit, 1, 100) || !Array.isArray(query.sort) || query.sort.length < 1 ||
      query.sort.length > 3 || query.sort.some((sort) => !TEAM_SORTS.has(String(sort))) ||
      new Set(query.sort).size !== query.sort.length || !nonBlank(query.locale, 35) ||
      query.locale.length < 2 || !nonBlank(query.timeZone, 255) || !uuid(query.correlationId) ||
      query.asOf !== undefined && query.asOf !== null && !instant(query.asOf) ||
      query.cursor !== undefined && query.cursor !== null &&
        (typeof query.cursor !== 'string' || !CURSOR.test(query.cursor))) invalid();
  const filter = record(query.filter);
  keys(filter, [], ['performanceAssignment', 'dueStatus', 'limitedProfile', 'effectiveOn']);
  const resultFilter: Record<string, unknown> = {};
  if (filter.performanceAssignment !== undefined) {
    if (filter.performanceAssignment === null) resultFilter.performanceAssignment = null;
    else {
      const value = record(filter.performanceAssignment);
      keys(value, [], ['codes', 'publicIds']);
      resultFilter.performanceAssignment = {
        ...(value.codes === undefined ? {} : { codes: uniqueList(value.codes, STATUS) }),
        ...(value.publicIds === undefined ? {} : { publicIds: uniqueList(value.publicIds, PUBLIC_ID) }),
      };
    }
  }
  for (const name of ['dueStatus', 'limitedProfile'] as const) {
    const input = filter[name];
    if (input === undefined) continue;
    if (input === null) { resultFilter[name] = null; continue; }
    const value = record(input);
    keys(value, [], ['codes', 'minimumRevision']);
    if (value.minimumRevision !== undefined && value.minimumRevision !== null &&
        !integer(value.minimumRevision, 1)) invalid();
    resultFilter[name] = {
      ...(value.codes === undefined ? {} : { codes: uniqueList(value.codes, STATUS) }),
      ...(value.minimumRevision === undefined ? {} : { minimumRevision: value.minimumRevision as number | null }),
    };
  }
  if (filter.effectiveOn !== undefined) {
    if (filter.effectiveOn !== null && !date(filter.effectiveOn)) invalid();
    resultFilter.effectiveOn = filter.effectiveOn as string | null;
  }
  return { ...query, filter: resultFilter } as Per008TeamQuery;
}

function parseField<T>(wire: unknown, parseValue: (value: unknown) => T): Per008Field<T> {
  const field = record(wire);
  if (field.decision === 'VIEW') {
    keys(field, ['decision', 'value']);
    return { decision: 'VIEW', value: parseValue(field.value) };
  }
  keys(field, ['decision', 'value', 'maskReason', 'maskedDisplayKey']);
  if (field.decision !== 'MASK' || field.value !== null ||
      typeof field.maskReason !== 'string' || !STATUS.test(field.maskReason) ||
      typeof field.maskedDisplayKey !== 'string' || !DISPLAY_KEY.test(field.maskedDisplayKey)) invalid();
  return field as Per008Field<T>;
}

function parseReferenceValue(value: unknown) {
  const item = record(value);
  keys(item, ['publicId', 'code', 'label', 'revision']);
  if (typeof item.publicId !== 'string' || !PUBLIC_ID.test(item.publicId) ||
      typeof item.code !== 'string' || !STATUS.test(item.code) || !nonBlank(item.label) ||
      !integer(item.revision, 1)) invalid();
  return item as { publicId: string; code: string; label: string; revision: number };
}
function parseStatusValue(value: unknown) {
  const item = record(value);
  keys(item, ['code', 'revision']);
  if (typeof item.code !== 'string' || !STATUS.test(item.code) || !integer(item.revision, 1)) invalid();
  return item as { code: string; revision: number };
}
function parseTarget(value: unknown): Per008FeedbackActionTarget {
  const target = record(value);
  keys(target, ['cycleVersionId', 'subjectWorkerPublicId', 'subjectAssignmentPublicId',
    'scopeDecisionRevision', 'authorizationDecisionRevision']);
  if (!uuid(target.cycleVersionId) || !uuid(target.subjectWorkerPublicId) ||
      !uuid(target.subjectAssignmentPublicId) || typeof target.scopeDecisionRevision !== 'string' ||
      !REVISION.test(target.scopeDecisionRevision) || typeof target.authorizationDecisionRevision !== 'string' ||
      !REVISION.test(target.authorizationDecisionRevision)) invalid();
  return target as Per008FeedbackActionTarget;
}

const PRIOR_ACTIONS = {
  'hris.action.per.create-goal': ['POST', '/api/people/v1/hris/performance/goals'],
  'hris.action.per.submit-goal': ['POST', '/api/people/v1/hris/performance/goals/{goalId}/submit'],
  'hris.action.per.save-review-draft': ['PATCH', '/api/people/v1/hris/performance/reviews/{reviewId}'],
  'hris.action.per.submit-review': ['POST', '/api/people/v1/hris/performance/reviews/{reviewId}/submit'],
} as const;

function parseTeamAction(wire: unknown): Per008TeamAction {
  const action = record(wire);
  keys(action, ['actionKey', 'method', 'hrefTemplate', 'idempotencyPolicy', 'stepUpPolicy']);
  if (action.idempotencyPolicy !== 'REQUIRED_IDEMPOTENCY_KEY' ||
      action.stepUpPolicy !== 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED') invalid();
  if (action.actionKey === PER008_CREATE_ACTION_KEY) {
    if (action.method !== 'POST' || action.hrefTemplate !== PER008_ROUTES.createRequest) invalid();
    return action as Per008CreateAction;
  }
  const expected = PRIOR_ACTIONS[action.actionKey as keyof typeof PRIOR_ACTIONS];
  if (!expected || action.method !== expected[0] || action.hrefTemplate !== expected[1]) invalid();
  return action as Per008TeamAction;
}

function parseTeamItem(wire: unknown): Per008TeamItem {
  const item = record(wire);
  keys(item, ['itemPublicId', 'title', 'statusCode', 'fieldGroups', 'deepLink', 'availableActions']);
  if (typeof item.itemPublicId !== 'string' || !PUBLIC_ID.test(item.itemPublicId) || !nonBlank(item.title) ||
      typeof item.statusCode !== 'string' || !STATUS.test(item.statusCode) ||
      !Array.isArray(item.availableActions) || item.availableActions.length > 5) invalid();
  const deepLink = record(item.deepLink);
  keys(deepLink, ['route', 'resourcePublicId']);
  if (deepLink.route !== '/hr/team/performance' || deepLink.resourcePublicId !== item.itemPublicId) invalid();
  const groups = record(item.fieldGroups);
  if (Object.keys(groups).length === 0 ||
      Object.keys(groups).some((key) => !FIELD_GROUPS.includes(key as (typeof FIELD_GROUPS)[number]))) invalid();
  const parsedGroups: Per008TeamItem['fieldGroups'] = {
    ...('PERFORMANCE_ASSIGNMENT' in groups ? {
      PERFORMANCE_ASSIGNMENT: parseField(groups.PERFORMANCE_ASSIGNMENT, parseReferenceValue),
    } : {}),
    ...('DUE_STATUS' in groups ? { DUE_STATUS: parseField(groups.DUE_STATUS, parseStatusValue) } : {}),
    ...('LIMITED_PROFILE' in groups ? {
      LIMITED_PROFILE: parseField(groups.LIMITED_PROFILE, parseStatusValue),
    } : {}),
    ...('PERFORMANCE_FEEDBACK_ACTION_TARGET' in groups ? {
      PERFORMANCE_FEEDBACK_ACTION_TARGET: parseField(groups.PERFORMANCE_FEEDBACK_ACTION_TARGET, parseTarget),
    } : {}),
  };
  const actions = (item.availableActions as unknown[]).map(parseTeamAction);
  if (new Set(actions.map((action) => action.actionKey)).size !== actions.length) invalid();
  return { ...item, fieldGroups: parsedGroups, availableActions: actions } as unknown as Per008TeamItem;
}

export function parsePer008TeamProjection(wire: unknown): Per008TeamProjection {
  const root = record(wire);
  keys(root, ['projectionVersion', 'asOf', 'variantKey', 'queryState', 'items']);
  if (root.projectionVersion !== '2' || root.variantKey !== 'PERFORMANCE' || !instant(root.asOf) ||
      !Array.isArray(root.items) || root.items.length > 500) invalid();
  const state = record(root.queryState);
  keys(state, ['state', 'scopeDecisionRevision', 'freshness', 'nextCursor', 'fieldDecisionSummary',
    'partialFailures', 'correlationId', 'cachePolicy']);
  if (!QUERY_STATES.has(String(state.state)) || !['CURRENT', 'STALE', 'UNAVAILABLE'].includes(String(state.freshness)) ||
      typeof state.scopeDecisionRevision !== 'string' || !REVISION.test(state.scopeDecisionRevision) ||
      state.nextCursor !== null && (typeof state.nextCursor !== 'string' || !CURSOR.test(state.nextCursor)) ||
      !Array.isArray(state.partialFailures) || state.partialFailures.length > 32 || !uuid(state.correlationId) ||
      (state.state === 'EMPTY' || state.state === 'UNAVAILABLE') && root.items.length !== 0 ||
      state.state === 'COMPLETE' && root.items.length === 0 ||
      state.state === 'PARTIAL' && state.partialFailures.length === 0 ||
      state.state === 'COMPLETE' && state.partialFailures.length !== 0 ||
      state.state === 'UNAVAILABLE' && (state.nextCursor !== null || state.freshness !== 'UNAVAILABLE') ||
      state.freshness === 'UNAVAILABLE' && state.state !== 'UNAVAILABLE') invalid();
  const summary = record(state.fieldDecisionSummary);
  keys(summary, ['viewCount', 'maskedCount', 'omittedCount']);
  if (!integer(summary.viewCount) || !integer(summary.maskedCount) || !integer(summary.omittedCount)) invalid();
  for (const wireFailure of state.partialFailures) {
    const failure = record(wireFailure);
    keys(failure, ['componentKey', 'errorCode', 'correlationId', 'retryable']);
    if (typeof failure.componentKey !== 'string' || !/^[a-z][a-z0-9._-]{0,127}$/.test(failure.componentKey) ||
        typeof failure.errorCode !== 'string' || !STATUS.test(failure.errorCode) ||
        !uuid(failure.correlationId) || typeof failure.retryable !== 'boolean') invalid();
  }
  const cache = record(state.cachePolicy);
  keys(cache, ['authorizationDecisionRevision', 'invalidationEvent', 'maxAgeSeconds']);
  if (typeof cache.authorizationDecisionRevision !== 'string' || !REVISION.test(cache.authorizationDecisionRevision) ||
      cache.invalidationEvent !== 'dwp.hris.access.assignment.changed.v1' ||
      !integer(cache.maxAgeSeconds, 0, 300)) invalid();
  const items = root.items.map(parseTeamItem);
  const seenItems = new Set<string>();
  const targetCounts = new Map<string, number>();
  let views = 0;
  let masks = 0;
  let omits = 0;
  for (const item of items) {
    if (seenItems.has(item.itemPublicId)) invalid();
    seenItems.add(item.itemPublicId);
    for (const key of FIELD_GROUPS) {
      const field = item.fieldGroups[key];
      if (!field) omits++;
      else if (field.decision === 'VIEW') views++;
      else masks++;
    }
    const target = item.fieldGroups.PERFORMANCE_FEEDBACK_ACTION_TARGET;
    if (target?.decision === 'VIEW') {
      const identity = `${target.value.cycleVersionId}:${target.value.subjectWorkerPublicId}:${target.value.subjectAssignmentPublicId}`;
      targetCounts.set(identity, (targetCounts.get(identity) ?? 0) + 1);
    }
  }
  if (views !== summary.viewCount || masks !== summary.maskedCount || omits !== summary.omittedCount) invalid();
  for (const item of items) {
    const target = item.fieldGroups.PERFORMANCE_FEEDBACK_ACTION_TARGET;
    const feedbackAction = item.availableActions.some((action) => action.actionKey === PER008_CREATE_ACTION_KEY);
    if (!feedbackAction) continue;
    if (state.state !== 'COMPLETE' || state.freshness !== 'CURRENT' || target?.decision !== 'VIEW' ||
        target.value.scopeDecisionRevision !== state.scopeDecisionRevision ||
        target.value.authorizationDecisionRevision !== cache.authorizationDecisionRevision) invalid();
    const identity = `${target.value.cycleVersionId}:${target.value.subjectWorkerPublicId}:${target.value.subjectAssignmentPublicId}`;
    if (targetCounts.get(identity) !== 1) invalid();
  }
  return { ...root, queryState: state, items } as unknown as Per008TeamProjection;
}

export function parsePer008RequestOptions(wire: unknown): Per008RequestOptions {
  const root = record(wire);
  keys(root, ['schemaKey', 'cycleVersionId', 'subjectWorkerPublicId', 'subjectAssignmentPublicId',
    'templates', 'anonymityModes', 'thresholdLimits', 'windowLimits', 'correlationId']);
  if (root.schemaKey !== 'Per008FeedbackRequestOptionsV1' || !uuid(root.cycleVersionId) ||
      !uuid(root.subjectWorkerPublicId) || !uuid(root.subjectAssignmentPublicId) ||
      !Array.isArray(root.templates) || root.templates.length === 0 || root.templates.length > 100 ||
      !Array.isArray(root.anonymityModes) || root.anonymityModes.length === 0 ||
      new Set(root.anonymityModes).size !== root.anonymityModes.length ||
      root.anonymityModes.some((mode) => !ANONYMITY_MODES.has(mode as Per008AnonymityMode)) ||
      !uuid(root.correlationId)) invalid();
  const templates = root.templates.map((wireTemplate) => {
    const template = record(wireTemplate);
    keys(template, ['templateVersionId', 'label', 'schemaKey', 'schemaVersion', 'templateContentHash']);
    if (!uuid(template.templateVersionId) || !nonBlank(template.label) ||
        template.schemaKey !== 'dwp.hris.performance.review-form.v1' || template.schemaVersion !== 1 ||
        typeof template.templateContentHash !== 'string' || !SHA256.test(template.templateContentHash)) invalid();
    return template;
  });
  if (new Set(templates.map((template) => template.templateVersionId)).size !== templates.length) invalid();
  const threshold = record(root.thresholdLimits);
  keys(threshold, ['minimum', 'maximum']);
  if (!integer(threshold.minimum, 1) || !integer(threshold.maximum, threshold.minimum as number, 10_000)) invalid();
  const window = record(root.windowLimits);
  keys(window, ['earliestOpensAt', 'latestClosesAt', 'maximumDurationDays']);
  if (!instant(window.earliestOpensAt) || !instant(window.latestClosesAt) ||
      Date.parse(window.earliestOpensAt) >= Date.parse(window.latestClosesAt) ||
      !integer(window.maximumDurationDays, 1, 366)) invalid();
  return { ...root, templates } as unknown as Per008RequestOptions;
}

export function parsePer008CreateCommand(wire: unknown): Per008CreateFeedbackRequestCommand {
  const command = record(wire);
  keys(command, ['cycleVersionId', 'subjectWorkerPublicId', 'subjectAssignmentPublicId', 'templateVersionId',
    'anonymityMode', 'minimumReleaseCount', 'opensAt', 'closesAt']);
  if (!uuid(command.cycleVersionId) || !uuid(command.subjectWorkerPublicId) ||
      !uuid(command.subjectAssignmentPublicId) || !uuid(command.templateVersionId) ||
      !ANONYMITY_MODES.has(command.anonymityMode as Per008AnonymityMode) ||
      !integer(command.minimumReleaseCount, 1, 10_000) || !instant(command.opensAt) ||
      !instant(command.closesAt) || Date.parse(command.opensAt) >= Date.parse(command.closesAt)) invalid();
  return command as Per008CreateFeedbackRequestCommand;
}

export function parsePer008RequestReceipt(wire: unknown): Per008FeedbackRequestReceipt {
  const receipt = record(wire);
  keys(receipt, ['receiptId', 'requestId', 'state', 'version', 'occurredAt', 'replayed']);
  if (!uuid(receipt.receiptId) || !uuid(receipt.requestId) || receipt.state !== 'DRAFT' ||
      !integer(receipt.version, 1) || !instant(receipt.occurredAt) || typeof receipt.replayed !== 'boolean') invalid();
  return receipt as Per008FeedbackRequestReceipt;
}

function parseListItem(wire: unknown): Per008AssignedFeedbackListItem {
  const item = record(wire);
  keys(item, ['feedbackAssignmentId', 'feedbackRequestId', 'requestTitle', 'requestState',
    'assignmentState', 'opensAt', 'closesAt']);
  if (!uuid(item.feedbackAssignmentId) || !uuid(item.feedbackRequestId) || !nonBlank(item.requestTitle) ||
      !REQUEST_STATES.has(String(item.requestState)) || !ASSIGNMENT_STATES.has(String(item.assignmentState)) ||
      !instant(item.opensAt) || !instant(item.closesAt) || Date.parse(item.opensAt) >= Date.parse(item.closesAt)) invalid();
  return item as Per008AssignedFeedbackListItem;
}

export function parsePer008AssignedList(wire: unknown): Per008AssignedFeedbackList {
  const root = record(wire);
  keys(root, ['schemaVersion', 'asOf', 'queryState', 'items', 'nextCursor', 'problemCorrelationId']);
  if (root.schemaVersion !== '1' || !instant(root.asOf) || !QUERY_STATES.has(String(root.queryState)) ||
      !Array.isArray(root.items) || root.items.length > 100 ||
      root.nextCursor !== null && (typeof root.nextCursor !== 'string' || !CURSOR.test(root.nextCursor)) ||
      root.problemCorrelationId !== null && !uuid(root.problemCorrelationId)) invalid();
  if ((root.queryState === 'EMPTY' || root.queryState === 'UNAVAILABLE') && root.items.length !== 0 ||
      root.queryState === 'COMPLETE' && root.items.length === 0) invalid();
  const items = root.items.map(parseListItem);
  if (new Set(items.map((item) => item.feedbackAssignmentId)).size !== items.length) invalid();
  return { ...root, items } as unknown as Per008AssignedFeedbackList;
}

function parseQuestion(wire: unknown): Per008Question {
  const question = record(wire);
  keys(question, ['questionPublicId', 'prompt', 'answerType', 'required', 'choiceOptions']);
  if (!uuid(question.questionPublicId) || !nonBlank(question.prompt, 4_000) ||
      !ANSWER_TYPES.has(String(question.answerType)) || typeof question.required !== 'boolean' ||
      !Array.isArray(question.choiceOptions) || question.choiceOptions.length > 100) invalid();
  const options = question.choiceOptions.map((wireOption) => {
    const option = record(wireOption);
    keys(option, ['choiceOptionPublicId', 'label']);
    if (!uuid(option.choiceOptionPublicId) || !nonBlank(option.label)) invalid();
    return option;
  });
  const choiceType = question.answerType === 'SINGLE_CHOICE' || question.answerType === 'MULTI_CHOICE';
  if (choiceType !== (options.length > 0) ||
      new Set(options.map((option) => option.choiceOptionPublicId)).size !== options.length) invalid();
  return { ...question, choiceOptions: options } as unknown as Per008Question;
}

export function parsePer008AssignedDetail(wire: unknown): Per008AssignedFeedbackDetail {
  const detail = record(wire);
  keys(detail, ['schemaKey', 'feedbackAssignmentId', 'feedbackRequestId', 'requestTitle', 'requestState',
    'assignmentState', 'expectedRequestVersion', 'templateVersionId', 'templateContentHash', 'opensAt',
    'closesAt', 'questions', 'correlationId']);
  if (detail.schemaKey !== 'Per008AssignedFeedbackDetailV1' || !uuid(detail.feedbackAssignmentId) ||
      !uuid(detail.feedbackRequestId) || !nonBlank(detail.requestTitle) ||
      !REQUEST_STATES.has(String(detail.requestState)) || !ASSIGNMENT_STATES.has(String(detail.assignmentState)) ||
      !integer(detail.expectedRequestVersion, 1) || !uuid(detail.templateVersionId) ||
      typeof detail.templateContentHash !== 'string' || !SHA256.test(detail.templateContentHash) ||
      !instant(detail.opensAt) || !instant(detail.closesAt) || Date.parse(detail.opensAt) >= Date.parse(detail.closesAt) ||
      !Array.isArray(detail.questions) || detail.questions.length === 0 || detail.questions.length > 100 ||
      !uuid(detail.correlationId)) invalid();
  const questions = detail.questions.map(parseQuestion);
  if (new Set(questions.map((question) => question.questionPublicId)).size !== questions.length) invalid();
  return { ...detail, questions } as unknown as Per008AssignedFeedbackDetail;
}

function parseAnswer(wire: unknown): Per008FeedbackAnswer {
  const answer = record(wire);
  keys(answer, ['questionPublicId', 'answerType', 'textValue', 'numberValue', 'choiceOptionPublicIds']);
  if (!uuid(answer.questionPublicId) || !ANSWER_TYPES.has(String(answer.answerType))) invalid();
  const choices = stringList(answer.choiceOptionPublicIds, 100);
  const text = typeof answer.textValue === 'string' && answer.textValue.trim() === answer.textValue &&
    answer.textValue.length > 0 && answer.textValue.length <= 20_000;
  const number = typeof answer.numberValue === 'number' && Number.isFinite(answer.numberValue);
  const valid = answer.answerType === 'TEXT' && text && answer.numberValue === null && choices.length === 0 ||
    answer.answerType === 'NUMBER' && answer.textValue === null && number && choices.length === 0 ||
    answer.answerType === 'SINGLE_CHOICE' && answer.textValue === null && answer.numberValue === null && choices.length === 1 ||
    answer.answerType === 'MULTI_CHOICE' && answer.textValue === null && answer.numberValue === null && choices.length > 0;
  if (!valid) invalid();
  return { ...answer, choiceOptionPublicIds: choices } as Per008FeedbackAnswer;
}

export function parsePer008ResponseCommand(wire: unknown): Per008FeedbackResponseCommand {
  const command = record(wire);
  keys(command, ['expectedRequestVersion', 'templateContentHash', 'response']);
  if (!integer(command.expectedRequestVersion, 1) || typeof command.templateContentHash !== 'string' ||
      !SHA256.test(command.templateContentHash)) invalid();
  const response = record(command.response);
  keys(response, ['schemaKey', 'answers']);
  if (response.schemaKey !== 'PerformanceFeedbackResponse.v1' || !Array.isArray(response.answers) ||
      response.answers.length === 0 || response.answers.length > 100) invalid();
  const answers = response.answers.map(parseAnswer);
  if (new Set(answers.map((answer) => answer.questionPublicId)).size !== answers.length) invalid();
  return { ...command, response: { schemaKey: 'PerformanceFeedbackResponse.v1', answers } } as unknown as
    Per008FeedbackResponseCommand;
}

export function parsePer008SubmissionReceipt(wire: unknown): Per008FeedbackSubmissionReceipt {
  const receipt = record(wire);
  keys(receipt, ['receiptId', 'requestId', 'assignmentId', 'assignmentState', 'version', 'submittedAt', 'replayed']);
  if (!uuid(receipt.receiptId) || !uuid(receipt.requestId) || !uuid(receipt.assignmentId) ||
      receipt.assignmentState !== 'SUBMITTED' || !integer(receipt.version, 1) ||
      !instant(receipt.submittedAt) || typeof receipt.replayed !== 'boolean') invalid();
  return receipt as Per008FeedbackSubmissionReceipt;
}

export function parsePer008Release(wire: unknown): Per008FeedbackRelease {
  const release = record(wire);
  keys(release, ['schemaKey', 'aggregateSchemaKey', 'feedbackRequestId', 'requestState', 'anonymityMode',
    'policyRevision', 'aggregatedAt', 'releasedAt', 'title', 'correlationId']);
  if (release.schemaKey !== 'Per008FeedbackReleaseV1' ||
      release.aggregateSchemaKey !== 'PerformanceFeedbackAggregate.v1' || !uuid(release.feedbackRequestId) ||
      release.requestState !== 'RELEASED' || !ANONYMITY_MODES.has(release.anonymityMode as Per008AnonymityMode) ||
      typeof release.policyRevision !== 'string' || !REVISION.test(release.policyRevision) ||
      !instant(release.aggregatedAt) || !instant(release.releasedAt) ||
      Date.parse(release.aggregatedAt) > Date.parse(release.releasedAt) || !nonBlank(release.title) ||
      !uuid(release.correlationId)) invalid();
  return release as Per008FeedbackRelease;
}

export function isPer008Date(value: string): boolean { return date(value); }
