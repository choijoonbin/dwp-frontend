import type {
  AssignedPerformanceReview,
  AssignedPerformanceReviewWire,
} from './performance-review-types';

export const PERFORMANCE_REVIEW_TEST_ID = Object.freeze({
  review: '11111111-1111-4111-8111-111111111111',
  participant: '22222222-2222-4222-8222-222222222222',
  assignment: '33333333-3333-4333-8333-333333333333',
  template: '44444444-4444-4444-8444-444444444444',
  submission: '55555555-5555-4555-8555-555555555555',
});

export const PERFORMANCE_REVIEW_TEST_HASH = 'a'.repeat(64);
export const PERFORMANCE_REVIEW_TEST_ETAG = '"review:7:' + 'b'.repeat(64) + '"';

export function assignedPerformanceReviewFixture(
  overrides: Partial<AssignedPerformanceReview> = {}
): AssignedPerformanceReview {
  return {
    reviewId: PERFORMANCE_REVIEW_TEST_ID.review,
    participantId: PERFORMANCE_REVIEW_TEST_ID.participant,
    reviewerAssignmentId: PERFORMANCE_REVIEW_TEST_ID.assignment,
    reviewerType: 'SELF',
    stageKey: 'SELF_REVIEW',
    state: 'IN_PROGRESS',
    templateVersionId: PERFORMANCE_REVIEW_TEST_ID.template,
    templateContentHash: 'c'.repeat(64),
    aggregateVersion: 7,
    writable: true,
    draftContentHash: PERFORMANCE_REVIEW_TEST_HASH,
    dueAt: '2027-03-31T08:00:00Z',
    form: {
      schemaVersion: '1',
      items: [
        {
          itemKey: 'section_overview',
          parentItemKey: null,
          kind: 'SECTION',
          sequence: 1,
          required: false,
          weight: null,
          label: 'Your impact',
          helpText: 'Reflect on outcomes and how you achieved them.',
          answerConstraints: { kind: 'SECTION' },
        },
        {
          itemKey: 'a_text',
          parentItemKey: 'section_overview',
          kind: 'TEXT',
          sequence: 2,
          required: true,
          weight: '0.400000',
          label: 'Describe your most important outcome',
          helpText: 'Use evidence that your reviewer can verify.',
          answerConstraints: { kind: 'TEXT', maxLength: 1000, multiline: true },
        },
        {
          itemKey: 'b_decimal',
          parentItemKey: 'section_overview',
          kind: 'DECIMAL',
          sequence: 3,
          required: false,
          weight: '0.100000',
          label: 'Outcome completion',
          helpText: null,
          answerConstraints: { kind: 'DECIMAL', minimum: '0', maximum: '100', scale: 2 },
        },
        {
          itemKey: 'c_rating',
          parentItemKey: 'section_overview',
          kind: 'RATING',
          sequence: 4,
          required: true,
          weight: '0.300000',
          label: 'Overall impact',
          helpText: null,
          answerConstraints: { kind: 'RATING', scaleKey: 'overall' },
        },
        {
          itemKey: 'd_choice',
          parentItemKey: 'section_overview',
          kind: 'CHOICE',
          sequence: 5,
          required: true,
          weight: '0.200000',
          label: 'Development focus',
          helpText: null,
          answerConstraints: {
            kind: 'CHOICE',
            minimumSelections: 1,
            maximumSelections: 1,
            options: [
              { optionKey: 'DEPTH', label: 'Deepen current expertise' },
              { optionKey: 'BREADTH', label: 'Broaden cross-team impact' },
            ],
          },
        },
      ],
      rubricScales: [
        {
          scaleKey: 'overall',
          levels: [
            { levelKey: 'MEETS', sequence: 1, numericValue: '3', label: 'Meets expectations' },
            { levelKey: 'EXCEEDS', sequence: 2, numericValue: '4', label: 'Exceeds expectations' },
          ],
        },
      ],
    },
    answers: [
      { itemKey: 'a_text', kind: 'TEXT', textValue: 'Delivered the governed review workflow.' },
      { itemKey: 'b_decimal', kind: 'DECIMAL', decimalValue: '95.5' },
      { itemKey: 'c_rating', kind: 'RATING', ratingValue: '4' },
      { itemKey: 'd_choice', kind: 'CHOICE', optionKey: 'BREADTH' },
    ],
    ...overrides,
  };
}

export function assignedPerformanceReviewWireFixture(): AssignedPerformanceReviewWire {
  const wire = structuredClone(assignedPerformanceReviewFixture()) as unknown as {
    form: {
      items: Array<{
        answerConstraints: Record<string, unknown>;
      }>;
    };
  };
  for (const item of wire.form.items) {
    delete item.answerConstraints.kind;
  }
  return wire as unknown as AssignedPerformanceReviewWire;
}
