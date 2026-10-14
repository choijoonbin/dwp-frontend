import { Temporal } from 'temporal-polyfill';

import {
  comparePerformanceReviewDecimal,
  validatePerformanceReviewAnswers,
} from './performance-review-draft';
import {
  PERFORMANCE_REVIEWER_TYPES,
  PERFORMANCE_REVIEW_ITEM_KINDS,
  PERFORMANCE_REVIEW_STATES,
} from './performance-review-types';

import type {
  AssignedPerformanceReview,
  PerformanceReviewAnswer,
  PerformanceReviewAnswerConstraints,
  PerformanceReviewDraftCommand,
  PerformanceReviewForm,
  PerformanceReviewFormItem,
  PerformanceReviewItemKind,
  PerformanceReviewRubricLevel,
  PerformanceReviewRubricScale,
  PerformanceReviewSnapshot,
  PerformanceReviewState,
  PerformanceReviewSubmission,
  PerformanceReviewerType,
  SubmitPerformanceReviewCommand,
} from './performance-review-types';

export const PERFORMANCE_REVIEW_BASE_PATH = '/api/people/v1/hris/performance/reviews' as const;
export const PERFORMANCE_REVIEW_DATA_CONTRACT =
  'route.hcm.performance.assigned-review.data' as const;
export const PERFORMANCE_REVIEW_DRAFT_CONTRACT =
  'route.hcm.performance.assigned-review-draft-update.action' as const;
export const PERFORMANCE_REVIEW_SUBMIT_CONTRACT =
  'route.hcm.performance.assigned-review-submit.action' as const;
export const PERFORMANCE_REVIEW_DEFAULT_ENABLED = false as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_256 = /^[0-9a-f]{64}$/;
const DECIMAL_6 = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/;
const ETAG = /^(?:W\/)?"[\x21\x23-\x7e]*"$/u;
const REVIEW_STATES = new Set<PerformanceReviewState>(PERFORMANCE_REVIEW_STATES);
const REVIEWER_TYPES = new Set<PerformanceReviewerType>(PERFORMANCE_REVIEWER_TYPES);
const ITEM_KINDS = new Set<PerformanceReviewItemKind>(PERFORMANCE_REVIEW_ITEM_KINDS);

function invalid(): never {
  throw new Error('Assigned performance-review payload is invalid.');
}

function record(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = []
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  const source = value as Record<string, unknown>;
  if (required.some((key) => !Object.hasOwn(source, key))) return invalid();
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(source).some((key) => !allowed.has(key))) return invalid();
  return source;
}

function array(value: unknown, minimum: number, maximum: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return invalid();
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return invalid();
  }
  return value;
}

function text(value: unknown, minimum: number, maximum: number): string {
  if (typeof value !== 'string' || value.length < minimum || value.length > maximum)
    return invalid();
  return value;
}

function nonblankText(value: unknown, maximum: number): string {
  const candidate = text(value, 1, maximum);
  return candidate.trim().length > 0 ? candidate : invalid();
}

function uuid(value: unknown): string {
  const candidate = text(value, 36, 36);
  return UUID.test(candidate) ? candidate.toLowerCase() : invalid();
}

function digest(value: unknown): string {
  const candidate = text(value, 64, 64);
  return SHA_256.test(candidate) ? candidate : invalid();
}

function decimal(value: unknown): string {
  if (typeof value !== 'string' || !DECIMAL_6.test(value)) return invalid();
  return value;
}

function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : invalid();
}

function bool(value: unknown): boolean {
  return typeof value === 'boolean' ? value : invalid();
}

function instant(value: unknown): string {
  const candidate = text(value, 1, 100);
  try {
    Temporal.Instant.from(candidate);
    return candidate;
  } catch {
    return invalid();
  }
}

function nullableInstant(value: unknown): string | null {
  return value === null ? null : instant(value);
}

function enumeration<T extends string>(value: unknown, choices: ReadonlySet<T>): T {
  const candidate = text(value, 1, 100) as T;
  return choices.has(candidate) ? candidate : invalid();
}

function strictlyOrdered(values: readonly string[]): void {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1]! >= values[index]!) return invalid();
  }
}

function answerConstraints(
  kind: PerformanceReviewItemKind,
  value: unknown
): PerformanceReviewAnswerConstraints {
  if (kind === 'SECTION') {
    record(value, []);
    return Object.freeze({ kind });
  }
  if (kind === 'TEXT') {
    const source = record(value, ['maxLength', 'multiline']);
    return Object.freeze({
      kind,
      maxLength: integer(source.maxLength, 1, 10_000),
      multiline: bool(source.multiline),
    });
  }
  if (kind === 'DECIMAL') {
    const source = record(value, ['minimum', 'maximum', 'scale']);
    const minimum = source.minimum === null ? null : decimal(source.minimum);
    const maximum = source.maximum === null ? null : decimal(source.maximum);
    if (
      minimum !== null &&
      maximum !== null &&
      comparePerformanceReviewDecimal(minimum, maximum) > 0
    ) {
      return invalid();
    }
    return Object.freeze({
      kind,
      minimum,
      maximum,
      scale: integer(source.scale, 0, 6),
    });
  }
  if (kind === 'RATING') {
    const source = record(value, ['scaleKey']);
    return Object.freeze({ kind, scaleKey: nonblankText(source.scaleKey, 80) });
  }
  const source = record(value, ['minimumSelections', 'maximumSelections', 'options']);
  const options = array(source.options, 1, 100).map((candidate) => {
    const option = record(candidate, ['optionKey', 'label']);
    return Object.freeze({
      optionKey: nonblankText(option.optionKey, 120),
      label: nonblankText(option.label, 200),
    });
  });
  if (new Set(options.map((option) => option.optionKey)).size !== options.length) return invalid();
  const minimumSelections = integer(source.minimumSelections, 0, 1);
  if (source.maximumSelections !== 1) return invalid();
  return Object.freeze({
    kind,
    minimumSelections: minimumSelections as 0 | 1,
    maximumSelections: 1,
    options: Object.freeze(options),
  });
}

function formItem(value: unknown): PerformanceReviewFormItem {
  const source = record(value, [
    'itemKey',
    'parentItemKey',
    'kind',
    'sequence',
    'required',
    'weight',
    'label',
    'helpText',
    'answerConstraints',
  ]);
  const kind = enumeration(source.kind, ITEM_KINDS);
  return Object.freeze({
    itemKey: nonblankText(source.itemKey, 100),
    parentItemKey: source.parentItemKey === null ? null : text(source.parentItemKey, 1, 100),
    kind,
    sequence: integer(source.sequence, 1),
    required: bool(source.required),
    weight: source.weight === null ? null : decimal(source.weight),
    label: nonblankText(source.label, 2_000),
    helpText: source.helpText === null ? null : text(source.helpText, 0, 5_000),
    answerConstraints: answerConstraints(kind, source.answerConstraints),
  });
}

function rubricLevel(value: unknown): PerformanceReviewRubricLevel {
  const source = record(value, ['levelKey', 'sequence', 'numericValue', 'label']);
  return Object.freeze({
    levelKey: nonblankText(source.levelKey, 80),
    sequence: integer(source.sequence, 1),
    numericValue: decimal(source.numericValue),
    label: nonblankText(source.label, 200),
  });
}

function rubricScale(value: unknown): PerformanceReviewRubricScale {
  const source = record(value, ['scaleKey', 'levels']);
  const levels = array(source.levels, 1, 20).map(rubricLevel);
  if (levels.some((level, index) => level.sequence !== index + 1)) return invalid();
  if (new Set(levels.map((level) => level.levelKey)).size !== levels.length) return invalid();
  if (
    levels.some((level, index) =>
      levels
        .slice(0, index)
        .some(
          (candidate) =>
            comparePerformanceReviewDecimal(candidate.numericValue, level.numericValue) === 0
        )
    )
  )
    return invalid();
  return Object.freeze({
    scaleKey: nonblankText(source.scaleKey, 80),
    levels: Object.freeze(levels),
  });
}

function form(value: unknown): PerformanceReviewForm {
  const source = record(value, ['schemaVersion', 'items', 'rubricScales']);
  const items = array(source.items, 1, 500).map(formItem);
  if (items.some((item, index) => item.sequence !== index + 1)) return invalid();
  const itemKeys = items.map((item) => item.itemKey);
  if (new Set(itemKeys).size !== itemKeys.length) return invalid();
  const byKey = new Map(items.map((item) => [item.itemKey, item]));
  if (
    items.some(
      (item) =>
        item.parentItemKey !== null &&
        (item.parentItemKey === item.itemKey || byKey.get(item.parentItemKey)?.kind !== 'SECTION')
    )
  )
    return invalid();
  const scales = array(source.rubricScales, 0, 100).map(rubricScale);
  const scaleKeys = scales.map((scale) => scale.scaleKey);
  strictlyOrdered(scaleKeys);
  if (
    items.some(
      (item) =>
        item.answerConstraints.kind === 'RATING' &&
        !scaleKeys.includes(item.answerConstraints.scaleKey)
    )
  )
    return invalid();
  return Object.freeze({
    schemaVersion: nonblankText(source.schemaVersion, 30).trim(),
    items: Object.freeze(items),
    rubricScales: Object.freeze(scales),
  });
}

function answer(value: unknown): PerformanceReviewAnswer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const kind = (value as Record<string, unknown>).kind;
  if (kind === 'TEXT') {
    const source = record(value, ['itemKey', 'kind', 'textValue']);
    return Object.freeze({
      itemKey: nonblankText(source.itemKey, 120),
      kind,
      textValue: text(source.textValue, 0, 10_000),
    });
  }
  if (kind === 'DECIMAL') {
    const source = record(value, ['itemKey', 'kind', 'decimalValue']);
    return Object.freeze({
      itemKey: nonblankText(source.itemKey, 120),
      kind,
      decimalValue: decimal(source.decimalValue),
    });
  }
  if (kind === 'RATING') {
    const source = record(value, ['itemKey', 'kind', 'ratingValue']);
    return Object.freeze({
      itemKey: nonblankText(source.itemKey, 120),
      kind,
      ratingValue: decimal(source.ratingValue),
    });
  }
  if (kind === 'CHOICE') {
    const source = record(value, ['itemKey', 'kind', 'optionKey']);
    return Object.freeze({
      itemKey: nonblankText(source.itemKey, 120),
      kind,
      optionKey: nonblankText(source.optionKey, 120),
    });
  }
  return invalid();
}

function answers(value: unknown, minimum: number): readonly PerformanceReviewAnswer[] {
  const parsed = array(value, minimum, 500).map(answer);
  strictlyOrdered(parsed.map((candidate) => candidate.itemKey));
  return Object.freeze(parsed);
}

export function parseAssignedPerformanceReview(value: unknown): AssignedPerformanceReview {
  const source = record(
    value,
    [
      'reviewId',
      'participantId',
      'reviewerAssignmentId',
      'reviewerType',
      'stageKey',
      'state',
      'templateVersionId',
      'templateContentHash',
      'aggregateVersion',
      'writable',
      'draftContentHash',
      'form',
      'answers',
    ],
    ['dueAt']
  );
  const parsedForm = form(source.form);
  const parsedAnswers = answers(source.answers, 0);
  const items = new Map(parsedForm.items.map((item) => [item.itemKey, item]));
  for (const candidate of parsedAnswers) {
    const item = items.get(candidate.itemKey);
    if (!item || item.kind === 'SECTION' || item.kind !== candidate.kind) return invalid();
  }
  if (!validatePerformanceReviewAnswers(parsedForm, parsedAnswers, false).valid) return invalid();
  return Object.freeze({
    reviewId: uuid(source.reviewId),
    participantId: uuid(source.participantId),
    reviewerAssignmentId: uuid(source.reviewerAssignmentId),
    reviewerType: enumeration(source.reviewerType, REVIEWER_TYPES),
    stageKey: nonblankText(source.stageKey, 80),
    state: enumeration(source.state, REVIEW_STATES),
    templateVersionId: uuid(source.templateVersionId),
    templateContentHash: digest(source.templateContentHash),
    aggregateVersion: integer(source.aggregateVersion, 0),
    writable: bool(source.writable),
    draftContentHash: digest(source.draftContentHash),
    ...(source.dueAt === undefined ? {} : { dueAt: nullableInstant(source.dueAt) }),
    form: parsedForm,
    answers: parsedAnswers,
  });
}

export function parsePerformanceReviewEtag(value: unknown): string {
  return typeof value === 'string' && value.length <= 256 && ETAG.test(value) ? value : invalid();
}

export function parsePerformanceReviewSnapshot(
  value: unknown,
  etag: unknown
): PerformanceReviewSnapshot {
  return Object.freeze({
    review: parseAssignedPerformanceReview(value),
    etag: parsePerformanceReviewEtag(etag),
  });
}

export function parsePerformanceReviewDraftCommand(value: unknown): PerformanceReviewDraftCommand {
  const source = record(value, ['answers']);
  return Object.freeze({ answers: answers(source.answers, 1) });
}

export function parseSubmitPerformanceReviewCommand(
  value: unknown
): SubmitPerformanceReviewCommand {
  const source = record(value, ['draftContentHash'], ['acknowledgement']);
  if (source.acknowledgement !== undefined && source.acknowledgement !== true) return invalid();
  return Object.freeze({
    draftContentHash: digest(source.draftContentHash),
    ...(source.acknowledgement === true ? { acknowledgement: true as const } : {}),
  });
}

export function parsePerformanceReviewSubmission(value: unknown): PerformanceReviewSubmission {
  const source = record(value, [
    'submissionId',
    'submissionNo',
    'state',
    'contentHash',
    'submittedAt',
  ]);
  if (source.state !== 'SUBMITTED') return invalid();
  return Object.freeze({
    submissionId: uuid(source.submissionId),
    submissionNo: integer(source.submissionNo, 1),
    state: 'SUBMITTED',
    contentHash: digest(source.contentHash),
    submittedAt: instant(source.submittedAt),
  });
}

export function isPerformanceReviewIdentifier(value: string): boolean {
  return UUID.test(value);
}
