import type { components, operations } from '@dwp-frontend/api-contracts';

type GatewaySchemas = components['schemas'];

type GetAssignedReviewOperation = operations['people_getAssignedReview'];
type SaveReviewDraftOperation = operations['people_saveReviewDraft'];
type SubmitReviewOperation = operations['people_submitReview'];

export type AssignedPerformanceReviewWire =
  GetAssignedReviewOperation['responses'][200]['content']['application/json'];
export type SavedPerformanceReviewWire =
  SaveReviewDraftOperation['responses'][200]['content']['application/json'];
export type PerformanceReviewDraftCommandWire =
  SaveReviewDraftOperation['requestBody']['content']['application/merge-patch+json'];
export type SubmitPerformanceReviewCommandWire =
  SubmitReviewOperation['requestBody']['content']['application/json'];
export type PerformanceReviewSubmissionWire =
  SubmitReviewOperation['responses'][200]['content']['application/json'];

type SameType<Left, Right> = [Left] extends [Right]
  ? [Right] extends [Left]
    ? true
    : false
  : false;
type Assert<T extends true> = T;

/** Compile-time evidence that operation bodies remain pinned to their generated component schemas. */
export type PerformanceReviewGeneratedContractAssertions = Readonly<{
  getResponse: Assert<
    SameType<AssignedPerformanceReviewWire, GatewaySchemas['people_AssignedReviewV1']>
  >;
  saveRequest: Assert<
    SameType<PerformanceReviewDraftCommandWire, GatewaySchemas['people_ReviewDraftCommandV1']>
  >;
  saveResponse: Assert<
    SameType<SavedPerformanceReviewWire, GatewaySchemas['people_AssignedReviewV1']>
  >;
  submitRequest: Assert<
    SameType<SubmitPerformanceReviewCommandWire, GatewaySchemas['people_SubmitReviewCommandV1']>
  >;
  submitResponse: Assert<
    SameType<PerformanceReviewSubmissionWire, GatewaySchemas['people_ReviewSubmissionV1']>
  >;
}>;

type ReviewFormItemWire = GatewaySchemas['people_ReviewFormItemV1'];
type ReviewFormWire = GatewaySchemas['people_ReviewFormV1'];

export const PERFORMANCE_REVIEW_ITEM_KINDS = [
  'SECTION',
  'TEXT',
  'DECIMAL',
  'RATING',
  'CHOICE',
] as const satisfies readonly ReviewFormItemWire['kind'][];

export type PerformanceReviewItemKind = ReviewFormItemWire['kind'];
export type PerformanceReviewState = AssignedPerformanceReviewWire['state'];
export type PerformanceReviewerType = AssignedPerformanceReviewWire['reviewerType'];
export const PERFORMANCE_REVIEW_STATES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'SUBMITTED',
  'RETURNED',
  'COMPLETED',
  'CANCELLED',
] as const satisfies readonly PerformanceReviewState[];
export const PERFORMANCE_REVIEWER_TYPES = [
  'SELF',
  'MANAGER',
  'SECOND_MANAGER',
  'THIRD_MANAGER',
  'PEER',
  'DIRECT_REPORT',
  'EXTERNAL',
  'REFEREE',
] as const satisfies readonly PerformanceReviewerType[];

export type PerformanceReviewGeneratedEnumAssertions = Readonly<{
  itemKinds: Assert<
    SameType<(typeof PERFORMANCE_REVIEW_ITEM_KINDS)[number], PerformanceReviewItemKind>
  >;
  states: Assert<SameType<(typeof PERFORMANCE_REVIEW_STATES)[number], PerformanceReviewState>>;
  reviewerTypes: Assert<
    SameType<(typeof PERFORMANCE_REVIEWER_TYPES)[number], PerformanceReviewerType>
  >;
}>;
export type PerformanceReviewChoiceOption = Readonly<GatewaySchemas['people_ReviewChoiceOptionV1']>;

/** UI-only discriminants enrich the generated conditional constraint union after validation. */
export type PerformanceReviewAnswerConstraints =
  | Readonly<{ kind: 'SECTION' }>
  | Readonly<GatewaySchemas['people_ReviewTextAnswerConstraintsV1'] & { kind: 'TEXT' }>
  | Readonly<GatewaySchemas['people_ReviewDecimalAnswerConstraintsV1'] & { kind: 'DECIMAL' }>
  | Readonly<GatewaySchemas['people_ReviewRatingAnswerConstraintsV1'] & { kind: 'RATING' }>
  | Readonly<
      Omit<GatewaySchemas['people_ReviewChoiceAnswerConstraintsV1'], 'options'> & {
        kind: 'CHOICE';
        options: readonly PerformanceReviewChoiceOption[];
      }
    >;

export type PerformanceReviewFormItem = Readonly<
  Omit<ReviewFormItemWire, 'answerConstraints'> & {
    answerConstraints: PerformanceReviewAnswerConstraints;
  }
>;

export type PerformanceReviewRubricLevel = Readonly<GatewaySchemas['people_ReviewRubricLevelV1']>;

export type PerformanceReviewRubricScale = Readonly<
  Omit<GatewaySchemas['people_ReviewRubricScaleV1'], 'levels'> & {
    levels: readonly PerformanceReviewRubricLevel[];
  }
>;

export type PerformanceReviewForm = Readonly<
  Omit<ReviewFormWire, 'items' | 'rubricScales'> & {
    items: readonly PerformanceReviewFormItem[];
    rubricScales: readonly PerformanceReviewRubricScale[];
  }
>;

export type PerformanceReviewAnswer = GatewaySchemas['people_ReviewAnswerV1'];

/** Readonly UI command views remain mechanically derived from the generated request DTOs. */
export type PerformanceReviewDraftCommand = Readonly<
  Omit<PerformanceReviewDraftCommandWire, 'answers'> & {
    answers: readonly PerformanceReviewAnswer[];
  }
>;
export type SubmitPerformanceReviewCommand = Readonly<SubmitPerformanceReviewCommandWire>;
export type PerformanceReviewSubmission = Readonly<PerformanceReviewSubmissionWire>;

/** Parsed UI/domain view; wire-owned fields stay derived from AssignedReviewV1. */
export type AssignedPerformanceReview = Readonly<
  Omit<AssignedPerformanceReviewWire, 'form' | 'answers'> & {
    form: PerformanceReviewForm;
    answers: readonly PerformanceReviewAnswer[];
  }
>;

export type PerformanceReviewSnapshot = Readonly<{
  review: AssignedPerformanceReview;
  etag: string;
}>;

export type PerformanceReviewValidationIssue = Readonly<{
  itemKey: string;
  code: 'REQUIRED' | 'INVALID_TEXT' | 'INVALID_DECIMAL' | 'OUT_OF_RANGE' | 'INVALID_OPTION';
  message: string;
}>;

export type PerformanceReviewValidation = Readonly<{
  valid: boolean;
  issues: readonly PerformanceReviewValidationIssue[];
}>;
