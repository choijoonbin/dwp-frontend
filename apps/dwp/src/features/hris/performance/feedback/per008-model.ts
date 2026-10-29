/** Default-off projection of the Auth-owned HRIS_PER_TEAM_PERFORMANCE_FEEDBACK feature. */
export const PER008_FEATURE_DEFAULT_ENABLED = false;
export const PER008_PROVIDER_BOUND = false;

export const PER008_ROUTES = {
  teamPerformance: '/api/people/v1/hris/performance/workbench/team-performance',
  requestOptions: '/api/people/v1/hris/performance/feedback-request-options',
  createRequest: '/api/people/v1/hris/performance/feedback-requests',
  mine: '/api/people/v1/hris/performance/feedback-assignments/mine',
  assignment: (feedbackAssignmentId: string) =>
    `/api/people/v1/hris/performance/feedback-assignments/${feedbackAssignmentId}`,
  submitResponse: (feedbackAssignmentId: string) =>
    `/api/people/v1/hris/performance/feedback-assignments/${feedbackAssignmentId}/responses`,
  release: (feedbackRequestId: string) =>
    `/api/people/v1/hris/performance/feedback-requests/${feedbackRequestId}/release`,
} as const;

export const PER008_CREATE_ACTION_KEY = 'hris.action.per.create-feedback-request';
export const PER008_SUBMIT_ACTION_KEY = 'hris.action.per.submit-feedback-response';
export const PER008_TEAM_SORTS = [
  'performanceAssignment:ASC',
  'dueStatus:ASC',
  'limitedProfile:ASC',
  'performanceAssignment:DESC',
  'dueStatus:DESC',
  'limitedProfile:DESC',
  'itemPublicId:ASC',
  'itemPublicId:DESC',
] as const;

export type Per008TeamSort = (typeof PER008_TEAM_SORTS)[number];
export type Per008QueryState = 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE';
export type Per008ProtectedState = Per008QueryState | 'LOADING' | 'DENIED' | 'STALE' | 'SUPPRESSED';
export type Per008Freshness = 'CURRENT' | 'STALE' | 'UNAVAILABLE';
export type Per008RequestState =
  'DRAFT' | 'OPEN' | 'CLOSED' | 'AGGREGATED' | 'RELEASED' | 'CANCELLED';
export type Per008AssignmentState = 'ASSIGNED' | 'SUBMITTED' | 'DECLINED' | 'CANCELLED';
export type Per008AnonymityMode = 'IDENTIFIED' | 'MASKED' | 'ANONYMOUS_AGGREGATE';
export type Per008AnswerType = 'TEXT' | 'NUMBER' | 'SINGLE_CHOICE' | 'MULTI_CHOICE';

export type Per008ViewField<T> = Readonly<{ decision: 'VIEW'; value: T }>;
export type Per008MaskedField = Readonly<{
  decision: 'MASK';
  value: null;
  maskReason: string;
  maskedDisplayKey: string;
}>;
export type Per008Field<T> = Per008ViewField<T> | Per008MaskedField;
export type Per008ReferenceValue = Readonly<{
  publicId: string;
  code: string;
  label: string;
  revision: number;
}>;
export type Per008StatusValue = Readonly<{ code: string; revision: number }>;
export type Per008FeedbackActionTarget = Readonly<{
  cycleVersionId: string;
  subjectWorkerPublicId: string;
  subjectAssignmentPublicId: string;
  scopeDecisionRevision: string;
  authorizationDecisionRevision: string;
}>;

type Per008BaseAction = Readonly<{
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY';
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED';
}>;
export type Per008PriorAction = Per008BaseAction &
  Readonly<{
    actionKey:
      | 'hris.action.per.create-goal'
      | 'hris.action.per.submit-goal'
      | 'hris.action.per.save-review-draft'
      | 'hris.action.per.submit-review';
    method: 'POST' | 'PATCH';
    hrefTemplate: string;
  }>;
export type Per008CreateAction = Per008BaseAction &
  Readonly<{
    actionKey: typeof PER008_CREATE_ACTION_KEY;
    method: 'POST';
    hrefTemplate: typeof PER008_ROUTES.createRequest;
  }>;
export type Per008TeamAction = Per008PriorAction | Per008CreateAction;

export type Per008TeamItem = Readonly<{
  itemPublicId: string;
  title: string;
  statusCode: string;
  fieldGroups: Readonly<{
    PERFORMANCE_ASSIGNMENT?: Per008Field<Per008ReferenceValue>;
    DUE_STATUS?: Per008Field<Per008StatusValue>;
    LIMITED_PROFILE?: Per008Field<Per008StatusValue>;
    PERFORMANCE_FEEDBACK_ACTION_TARGET?: Per008Field<Per008FeedbackActionTarget>;
  }>;
  deepLink: Readonly<{ route: '/hr/team/performance'; resourcePublicId: string }>;
  availableActions: readonly Per008TeamAction[];
}>;

export type Per008QueryMetadata = Readonly<{
  state: Per008QueryState;
  scopeDecisionRevision: string;
  freshness: Per008Freshness;
  nextCursor: string | null;
  fieldDecisionSummary: Readonly<{ viewCount: number; maskedCount: number; omittedCount: number }>;
  partialFailures: readonly Readonly<{
    componentKey: string;
    errorCode: string;
    correlationId: string;
    retryable: boolean;
  }>[];
  correlationId: string;
  cachePolicy: Readonly<{
    authorizationDecisionRevision: string;
    invalidationEvent: 'dwp.hris.access.assignment.changed.v1';
    maxAgeSeconds: number;
  }>;
}>;
export type Per008TeamProjection = Readonly<{
  projectionVersion: '2';
  asOf: string;
  variantKey: 'PERFORMANCE';
  queryState: Per008QueryMetadata;
  items: readonly Per008TeamItem[];
}>;

export type Per008ReferenceFilter = Readonly<{
  codes?: readonly string[];
  publicIds?: readonly string[];
}>;
export type Per008StatusFilter = Readonly<{
  codes?: readonly string[];
  minimumRevision?: number | null;
}>;
export type Per008TeamQuery = Readonly<{
  limit: number;
  filter: Readonly<{
    performanceAssignment?: Per008ReferenceFilter | null;
    dueStatus?: Per008StatusFilter | null;
    limitedProfile?: Per008StatusFilter | null;
    effectiveOn?: string | null;
  }>;
  sort: readonly Per008TeamSort[];
  locale: string;
  timeZone: string;
  correlationId: string;
  asOf?: string | null;
  cursor?: string | null;
}>;

export type Per008RequestSubject = Readonly<{
  cycleVersionId: string;
  subjectWorkerPublicId: string;
  subjectAssignmentPublicId: string;
}>;
export type Per008RequestOptions = Per008RequestSubject &
  Readonly<{
    schemaKey: 'Per008FeedbackRequestOptionsV1';
    templates: readonly Readonly<{
      templateVersionId: string;
      label: string;
      schemaKey: 'dwp.hris.performance.review-form.v1';
      schemaVersion: 1;
      templateContentHash: string;
    }>[];
    anonymityModes: readonly Per008AnonymityMode[];
    thresholdLimits: Readonly<{ minimum: number; maximum: number }>;
    windowLimits: Readonly<{
      earliestOpensAt: string;
      latestClosesAt: string;
      maximumDurationDays: number;
    }>;
    correlationId: string;
  }>;
export type Per008CreateFeedbackRequestCommand = Per008RequestSubject &
  Readonly<{
    templateVersionId: string;
    anonymityMode: Per008AnonymityMode;
    minimumReleaseCount: number;
    opensAt: string;
    closesAt: string;
  }>;
export type Per008FeedbackRequestReceipt = Readonly<{
  receiptId: string;
  requestId: string;
  state: 'DRAFT';
  version: number;
  occurredAt: string;
  replayed: boolean;
}>;

export type Per008AssignedFeedbackListItem = Readonly<{
  feedbackAssignmentId: string;
  feedbackRequestId: string;
  requestTitle: string;
  requestState: Per008RequestState;
  assignmentState: Per008AssignmentState;
  opensAt: string;
  closesAt: string;
}>;
export type Per008AssignedFeedbackList = Readonly<{
  schemaVersion: '1';
  asOf: string;
  queryState: Per008QueryState;
  items: readonly Per008AssignedFeedbackListItem[];
  nextCursor: string | null;
  problemCorrelationId: string | null;
}>;

export type Per008Question = Readonly<{
  questionPublicId: string;
  prompt: string;
  answerType: Per008AnswerType;
  required: boolean;
  choiceOptions: readonly Readonly<{ choiceOptionPublicId: string; label: string }>[];
}>;
export type Per008AssignedFeedbackDetail = Readonly<{
  schemaKey: 'Per008AssignedFeedbackDetailV1';
  feedbackAssignmentId: string;
  feedbackRequestId: string;
  requestTitle: string;
  requestState: Per008RequestState;
  assignmentState: Per008AssignmentState;
  expectedRequestVersion: number;
  templateVersionId: string;
  templateContentHash: string;
  opensAt: string;
  closesAt: string;
  questions: readonly Per008Question[];
  correlationId: string;
}>;
export type Per008FeedbackAnswer = Readonly<{
  questionPublicId: string;
  answerType: Per008AnswerType;
  textValue: string | null;
  numberValue: number | null;
  choiceOptionPublicIds: readonly string[];
}>;
export type Per008FeedbackResponseCommand = Readonly<{
  expectedRequestVersion: number;
  templateContentHash: string;
  response: Readonly<{
    schemaKey: 'PerformanceFeedbackResponse.v1';
    answers: readonly Per008FeedbackAnswer[];
  }>;
}>;
export type Per008FeedbackSubmissionReceipt = Readonly<{
  receiptId: string;
  requestId: string;
  assignmentId: string;
  assignmentState: 'SUBMITTED';
  version: number;
  submittedAt: string;
  replayed: boolean;
}>;

/** Contributor identity, response items/content, scores, counts, digests and encryption metadata cannot be represented. */
export type Per008FeedbackRelease = Readonly<{
  schemaKey: 'Per008FeedbackReleaseV1';
  aggregateSchemaKey: 'PerformanceFeedbackAggregate.v1';
  feedbackRequestId: string;
  requestState: 'RELEASED';
  anonymityMode: Per008AnonymityMode;
  policyRevision: string;
  aggregatedAt: string;
  releasedAt: string;
  title: string;
  correlationId: string;
}>;

export type Per008AuthorizedReleaseTarget = Readonly<{
  contextScopeKey: string;
  feedbackRequestId: string;
  authorizationDecisionRevision: string;
  provenance: 'OWNER_AUTHORIZED_RELEASE_REFERENCE';
}>;

export type Per008CommandContext = Readonly<{
  idempotencyKey: string;
  expectedDecisionRevision: string;
  stepUpChallenge?: string;
}>;
