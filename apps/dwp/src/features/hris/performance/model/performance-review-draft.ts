import type {
  PerformanceReviewAnswer,
  PerformanceReviewDraftCommand,
  PerformanceReviewForm,
  PerformanceReviewFormItem,
  PerformanceReviewValidation,
  PerformanceReviewValidationIssue,
} from './performance-review-types';

const DECIMAL_6 = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/;

function decimalScale(value: string): number {
  return value.includes('.') ? value.length - value.indexOf('.') - 1 : 0;
}

function compareUnsigned(left: string, right: string): number {
  const [leftInteger, leftFraction = ''] = left.split('.');
  const [rightInteger, rightFraction = ''] = right.split('.');
  if (leftInteger!.length !== rightInteger!.length) {
    return leftInteger!.length < rightInteger!.length ? -1 : 1;
  }
  if (leftInteger !== rightInteger) return leftInteger! < rightInteger! ? -1 : 1;
  const leftPadded = leftFraction.padEnd(6, '0');
  const rightPadded = rightFraction.padEnd(6, '0');
  if (leftPadded === rightPadded) return 0;
  return leftPadded < rightPadded ? -1 : 1;
}

export function comparePerformanceReviewDecimal(left: string, right: string): number {
  const leftNegative = left.startsWith('-');
  const rightNegative = right.startsWith('-');
  const comparison = compareUnsigned(
    leftNegative ? left.slice(1) : left,
    rightNegative ? right.slice(1) : right
  );
  // The sealed decimal grammar permits signed zero; canonical numeric comparison must not
  // treat -0 as smaller than 0 before the owner normalizes both spellings to "0".
  if (comparison === 0) return 0;
  if (leftNegative !== rightNegative) return leftNegative ? -1 : 1;
  return leftNegative ? -comparison : comparison;
}

function issue(
  itemKey: string,
  code: PerformanceReviewValidationIssue['code'],
  message: string
): PerformanceReviewValidationIssue {
  return Object.freeze({ itemKey, code, message });
}

function answerIssue(
  form: PerformanceReviewForm,
  item: PerformanceReviewFormItem,
  answer: PerformanceReviewAnswer,
  requireComplete: boolean
): PerformanceReviewValidationIssue | null {
  if (item.kind !== answer.kind) {
    return issue(item.itemKey, 'INVALID_OPTION', 'The answer type does not match this item.');
  }
  const constraints = item.answerConstraints;
  if (answer.kind === 'TEXT' && constraints.kind === 'TEXT') {
    if (
      answer.textValue.length > constraints.maxLength ||
      (!constraints.multiline && /[\r\n]/u.test(answer.textValue))
    ) {
      return issue(
        item.itemKey,
        'INVALID_TEXT',
        'Enter text within the allowed format and length.'
      );
    }
    if (requireComplete && item.required && answer.textValue.trim().length === 0) {
      return issue(item.itemKey, 'REQUIRED', 'Enter a response.');
    }
    return null;
  }
  if (answer.kind === 'DECIMAL' && constraints.kind === 'DECIMAL') {
    if (
      !DECIMAL_6.test(answer.decimalValue) ||
      decimalScale(answer.decimalValue) > constraints.scale
    ) {
      return issue(item.itemKey, 'INVALID_DECIMAL', 'Enter a valid decimal value.');
    }
    if (
      (constraints.minimum !== null &&
        comparePerformanceReviewDecimal(answer.decimalValue, constraints.minimum) < 0) ||
      (constraints.maximum !== null &&
        comparePerformanceReviewDecimal(answer.decimalValue, constraints.maximum) > 0)
    ) {
      return issue(item.itemKey, 'OUT_OF_RANGE', 'Enter a value within the allowed range.');
    }
    return null;
  }
  if (answer.kind === 'RATING' && constraints.kind === 'RATING') {
    const scale = form.rubricScales.find(
      (candidate) => candidate.scaleKey === constraints.scaleKey
    );
    if (!scale?.levels.some((level) => level.numericValue === answer.ratingValue)) {
      return issue(item.itemKey, 'INVALID_OPTION', 'Choose an available rating.');
    }
    return null;
  }
  if (answer.kind === 'CHOICE' && constraints.kind === 'CHOICE') {
    if (!constraints.options.some((option) => option.optionKey === answer.optionKey)) {
      return issue(item.itemKey, 'INVALID_OPTION', 'Choose an available option.');
    }
    return null;
  }
  return issue(item.itemKey, 'INVALID_OPTION', 'The answer type does not match this item.');
}

export function validatePerformanceReviewAnswers(
  form: PerformanceReviewForm,
  answers: readonly PerformanceReviewAnswer[],
  requireComplete = true
): PerformanceReviewValidation {
  const issues: PerformanceReviewValidationIssue[] = [];
  const items = new Map(form.items.map((item) => [item.itemKey, item]));
  const seen = new Set<string>();
  for (const answer of answers) {
    const item = items.get(answer.itemKey);
    if (!item || seen.has(answer.itemKey)) {
      issues.push(
        issue(answer.itemKey, 'INVALID_OPTION', 'This answer is not part of the assigned form.')
      );
      continue;
    }
    seen.add(answer.itemKey);
    const candidate = answerIssue(form, item, answer, requireComplete);
    if (candidate) issues.push(candidate);
  }
  if (requireComplete) {
    for (const item of form.items) {
      if (item.kind !== 'SECTION' && item.required && !seen.has(item.itemKey)) {
        issues.push(issue(item.itemKey, 'REQUIRED', 'Enter a response.'));
      }
    }
  }
  issues.sort((left, right) => {
    const leftSequence = items.get(left.itemKey)?.sequence ?? Number.MAX_SAFE_INTEGER;
    const rightSequence = items.get(right.itemKey)?.sequence ?? Number.MAX_SAFE_INTEGER;
    return leftSequence - rightSequence || (left.itemKey < right.itemKey ? -1 : 1);
  });
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function buildPerformanceReviewDraftCommand(
  form: PerformanceReviewForm,
  answers: readonly PerformanceReviewAnswer[]
): PerformanceReviewDraftCommand {
  const validation = validatePerformanceReviewAnswers(form, answers, false);
  if (!validation.valid || answers.length === 0) {
    throw new Error('Performance-review draft answers are invalid.');
  }
  const canonical = [...answers]
    .sort((left, right) =>
      left.itemKey < right.itemKey ? -1 : left.itemKey > right.itemKey ? 1 : 0
    )
    .map((answer) => Object.freeze({ ...answer })) as PerformanceReviewAnswer[];
  return Object.freeze({ answers: Object.freeze(canonical) });
}

export function setPerformanceReviewAnswer(
  answers: readonly PerformanceReviewAnswer[],
  answer: PerformanceReviewAnswer | null,
  itemKey: string
): readonly PerformanceReviewAnswer[] {
  const next = answers.filter((candidate) => candidate.itemKey !== itemKey);
  if (answer) next.push(Object.freeze({ ...answer }));
  next.sort((left, right) =>
    left.itemKey < right.itemKey ? -1 : left.itemKey > right.itemKey ? 1 : 0
  );
  return Object.freeze(next);
}
