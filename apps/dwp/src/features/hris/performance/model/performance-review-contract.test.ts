import { describe, expect, it } from 'vitest';

import {
  parseAssignedPerformanceReview,
  parsePerformanceReviewEtag,
  parsePerformanceReviewSubmission,
} from './performance-review-contract';
import {
  buildPerformanceReviewDraftCommand,
  comparePerformanceReviewDecimal,
  validatePerformanceReviewAnswers,
} from './performance-review-draft';
import {
  assignedPerformanceReviewFixture,
  assignedPerformanceReviewWireFixture,
  PERFORMANCE_REVIEW_TEST_HASH,
  PERFORMANCE_REVIEW_TEST_ID,
} from './performance-review-test-fixtures';
import type {
  PerformanceReviewGeneratedContractAssertions,
  PerformanceReviewGeneratedEnumAssertions,
} from './performance-review-types';

const GENERATED_CONTRACT_ASSERTIONS = {
  getResponse: true,
  saveRequest: true,
  saveResponse: true,
  submitRequest: true,
  submitResponse: true,
} as const satisfies PerformanceReviewGeneratedContractAssertions;
const GENERATED_ENUM_ASSERTIONS = {
  itemKinds: true,
  states: true,
  reviewerTypes: true,
} as const satisfies PerformanceReviewGeneratedEnumAssertions;

type MutableAssignedReviewWire = {
  stageKey: string;
  form: {
    schemaVersion: string;
    items: Array<{
      itemKey: string;
      parentItemKey: string | null;
      label: string;
      answerConstraints: {
        scaleKey?: string;
        options?: Array<{ optionKey: string; label: string }>;
      };
    }>;
    rubricScales: Array<{
      scaleKey: string;
      levels: Array<{ levelKey: string; numericValue: string; label: string }>;
    }>;
  };
  answers: Array<{ itemKey: string; optionKey?: string }>;
};

function mutableWireFixture(): MutableAssignedReviewWire {
  return structuredClone(
    assignedPerformanceReviewWireFixture()
  ) as unknown as MutableAssignedReviewWire;
}

describe('assigned performance-review contract', () => {
  it('parses and freezes the sealed form, rubric, typed answers, hashes, and decimal order', () => {
    const parsed = parseAssignedPerformanceReview(assignedPerformanceReviewWireFixture());

    expect(parsed.reviewId).toBe(PERFORMANCE_REVIEW_TEST_ID.review);
    expect(parsed.form.items.map((item) => item.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(parsed.answers.map((answer) => answer.itemKey)).toEqual([
      'a_text',
      'b_decimal',
      'c_rating',
      'd_choice',
    ]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.form.items)).toBe(true);
    expect(Object.values(GENERATED_CONTRACT_ASSERTIONS).every(Boolean)).toBe(true);
    expect(Object.values(GENERATED_ENUM_ASSERTIONS).every(Boolean)).toBe(true);
    expect(comparePerformanceReviewDecimal('-10.5', '-2')).toBeLessThan(0);
    expect(comparePerformanceReviewDecimal('3.000000', '3')).toBe(0);
    expect(comparePerformanceReviewDecimal('-0', '0')).toBe(0);
  });

  it('fails closed on shadow fields, noncanonical order, and answers outside the sealed form', () => {
    expect(() =>
      parseAssignedPerformanceReview({
        ...(assignedPerformanceReviewWireFixture() as Record<string, unknown>),
        privateComment: 'x',
      })
    ).toThrow('Assigned performance-review payload is invalid');

    const unordered = structuredClone(assignedPerformanceReviewWireFixture()) as {
      answers: unknown[];
    };
    unordered.answers.reverse();
    expect(() => parseAssignedPerformanceReview(unordered)).toThrow(
      'Assigned performance-review payload is invalid'
    );

    const wrongRating = structuredClone(assignedPerformanceReviewWireFixture()) as {
      answers: Array<Record<string, unknown>>;
    };
    const rating = wrongRating.answers.find((answer) => answer.kind === 'RATING');
    if (rating) rating.ratingValue = '5';
    expect(() => parseAssignedPerformanceReview(wrongRating)).toThrow(
      'Assigned performance-review payload is invalid'
    );

    const invertedDecimalRange = structuredClone(assignedPerformanceReviewWireFixture()) as {
      form: { items: Array<Record<string, unknown>> };
    };
    const decimalItem = invertedDecimalRange.form.items.find((item) => item.kind === 'DECIMAL');
    if (decimalItem) {
      decimalItem.answerConstraints = { minimum: '10', maximum: '1', scale: 2 };
    }
    expect(() => parseAssignedPerformanceReview(invertedDecimalRange)).toThrow(
      'Assigned performance-review payload is invalid'
    );

    const duplicateRubricValue = structuredClone(assignedPerformanceReviewWireFixture()) as {
      form: { rubricScales: Array<{ levels: Array<Record<string, unknown>> }> };
    };
    const levels = duplicateRubricValue.form.rubricScales[0]?.levels;
    if (levels?.[0] && levels[1]) levels[1].numericValue = levels[0].numericValue + '.0';
    expect(() => parseAssignedPerformanceReview(duplicateRubricValue)).toThrow(
      'Assigned performance-review payload is invalid'
    );

    const selfParent = mutableWireFixture();
    const section = selfParent.form.items[0]!;
    section.parentItemKey = section.itemKey;
    expect(() => parseAssignedPerformanceReview(selfParent)).toThrow(
      'Assigned performance-review payload is invalid'
    );
  });

  it('rejects whitespace-only sealed identifiers and user-visible labels', () => {
    const malformed: ReadonlyArray<
      readonly [string, (payload: MutableAssignedReviewWire) => void]
    > = [
      ['stage key', (payload) => (payload.stageKey = '  ')],
      ['schema version', (payload) => (payload.form.schemaVersion = '\t')],
      ['form item key', (payload) => (payload.form.items[1]!.itemKey = ' ')],
      ['form item label', (payload) => (payload.form.items[1]!.label = '\n')],
      [
        'rating scale reference',
        (payload) => (payload.form.items[3]!.answerConstraints.scaleKey = '  '),
      ],
      [
        'choice option key',
        (payload) => (payload.form.items[4]!.answerConstraints.options![0]!.optionKey = ' '),
      ],
      [
        'choice option label',
        (payload) => (payload.form.items[4]!.answerConstraints.options![0]!.label = '\t'),
      ],
      ['rubric scale key', (payload) => (payload.form.rubricScales[0]!.scaleKey = ' ')],
      ['rubric level key', (payload) => (payload.form.rubricScales[0]!.levels[0]!.levelKey = '\n')],
      ['rubric level label', (payload) => (payload.form.rubricScales[0]!.levels[0]!.label = '  ')],
      ['answer item key', (payload) => (payload.answers[0]!.itemKey = ' ')],
      ['answer choice key', (payload) => (payload.answers[3]!.optionKey = '\t')],
    ];

    for (const [field, mutate] of malformed) {
      const payload = mutableWireFixture();
      mutate(payload);
      expect(() => parseAssignedPerformanceReview(payload), field).toThrow(
        'Assigned performance-review payload is invalid'
      );
    }

    const paddedSchemaVersion = mutableWireFixture();
    paddedSchemaVersion.form.schemaVersion = ' 1 ';
    expect(parseAssignedPerformanceReview(paddedSchemaVersion).form.schemaVersion).toBe('1');
  });

  it('validates completeness separately from a canonical partial draft', () => {
    const review = assignedPerformanceReviewFixture({ answers: [] });
    const partial = [
      { itemKey: 'd_choice', kind: 'CHOICE' as const, optionKey: 'DEPTH' },
      { itemKey: 'a_text', kind: 'TEXT' as const, textValue: 'A measurable outcome.' },
    ];
    const command = buildPerformanceReviewDraftCommand(review.form, partial);
    expect(command.answers.map((answer) => answer.itemKey)).toEqual(['a_text', 'd_choice']);
    expect(validatePerformanceReviewAnswers(review.form, command.answers, true)).toMatchObject({
      valid: false,
      issues: [{ itemKey: 'c_rating', code: 'REQUIRED' }],
    });
    expect(() =>
      buildPerformanceReviewDraftCommand(review.form, [
        { itemKey: 'b_decimal', kind: 'DECIMAL', decimalValue: '100.001' },
      ])
    ).toThrow('Performance-review draft answers are invalid');
    expect(
      buildPerformanceReviewDraftCommand(review.form, [
        { itemKey: 'b_decimal', kind: 'DECIMAL', decimalValue: '-0' },
      ]).answers
    ).toEqual([{ itemKey: 'b_decimal', kind: 'DECIMAL', decimalValue: '-0' }]);

    const blankDraft = structuredClone(assignedPerformanceReviewWireFixture()) as {
      answers: Array<Record<string, unknown>>;
    };
    const textAnswer = blankDraft.answers.find((answer) => answer.kind === 'TEXT');
    if (textAnswer) textAnswer.textValue = '';
    const parsedBlankDraft = parseAssignedPerformanceReview(blankDraft);
    expect(parsedBlankDraft.answers.find((answer) => answer.kind === 'TEXT')).toMatchObject({
      textValue: '',
    });
    expect(
      validatePerformanceReviewAnswers(parsedBlankDraft.form, parsedBlankDraft.answers, true)
    ).toMatchObject({ valid: false, issues: [{ itemKey: 'a_text', code: 'REQUIRED' }] });
  });

  it('requires an HTTP entity tag and the immutable submission contract', () => {
    expect(parsePerformanceReviewEtag('"review:7"')).toBe('"review:7"');
    expect(() => parsePerformanceReviewEtag('review:7')).toThrow();
    expect(
      parsePerformanceReviewSubmission({
        submissionId: PERFORMANCE_REVIEW_TEST_ID.submission,
        submissionNo: 1,
        state: 'SUBMITTED',
        contentHash: PERFORMANCE_REVIEW_TEST_HASH,
        submittedAt: '2027-03-01T00:00:00Z',
      })
    ).toMatchObject({ state: 'SUBMITTED', submissionNo: 1 });
  });
});
