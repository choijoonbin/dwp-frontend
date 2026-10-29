// @vitest-environment jsdom
import { act, useId } from 'react';
import { fireEvent, getByLabelText } from '@testing-library/dom';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DesignSystem from '@dwp-frontend/design-system';

import { Per008ClientError, Per008CommandOutcomeUnknownError } from '../../feedback/per008-client';
import {
  PER008_CREATE_ACTION_KEY,
  PER008_FEATURE_DEFAULT_ENABLED,
  PER008_PROVIDER_BOUND,
  PER008_ROUTES,
} from '../../feedback/per008-model';
import type {
  Per008AssignedFeedbackDetail,
  Per008AssignedFeedbackList,
  Per008RequestOptions,
  Per008TeamProjection,
  Per008TeamQuery,
} from '../../feedback/per008-model';
import {
  Per008PersonalFeedbackView,
  Per008PersonalFeedbackWorkspace,
} from '../../feedback/per008-personal-workspace';
import {
  Per008TeamPerformanceView,
  Per008TeamPerformanceWorkspace,
} from '../../feedback/per008-team-workspace';
import { Per008ProtectedNotice, Per008RequestComposer } from '../../feedback/per008-ui';

import type { LocalDateTimePickerFieldProps } from '@dwp-frontend/design-system';

// Domain tests exercise civil values and callbacks; the DS suite covers the real picker UI.
vi.mock('@dwp-frontend/design-system', async (importOriginal) => {
  const actual = await importOriginal<typeof DesignSystem>();
  return {
    ...actual,
    LocalDateTimePickerField: function CivilDateTimeField({
      label,
      value,
      onValueChange,
      disabled,
      required,
      supportingText,
      errorMessage,
      minDateTime,
      maxDateTime,
    }: LocalDateTimePickerFieldProps) {
      const id = useId();
      return (
        <div data-testid="civil-date-time-picker">
          <label htmlFor={id}>{label}</label>
          <input
            id={id}
            value={value ?? ''}
            disabled={disabled}
            required={required}
            aria-describedby={`${id}-feedback`}
            aria-invalid={Boolean(errorMessage)}
            data-min={minDateTime?.format('YYYY-MM-DDTHH:mm')}
            data-max={maxDateTime?.format('YYYY-MM-DDTHH:mm')}
            onChange={(event) => onValueChange(event.target.value || null)}
          />
          <span id={`${id}-feedback`}>{errorMessage ?? supportingText}</span>
        </div>
      );
    },
  };
});

const ID = {
  item: '11111111-1111-4111-8111-111111111111',
  cycle: '22222222-2222-4222-8222-222222222222',
  worker: '33333333-3333-4333-8333-333333333333',
  assignment: '44444444-4444-4444-8444-444444444444',
  assignment2: '44444444-4444-4444-8444-444444444445',
  template: '55555555-5555-4555-8555-555555555555',
  request: '66666666-6666-4666-8666-666666666666',
  request2: '66666666-6666-4666-8666-666666666667',
  question: '77777777-7777-4777-8777-777777777777',
  optional: '88888888-8888-4888-8888-888888888888',
  choice: '99999999-9999-4999-8999-999999999999',
  correlation: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
} as const;
const NOW = '2026-10-23T01:00:00Z';
const LATER = '2026-10-30T01:00:00Z';
const HASH = 'b'.repeat(64);
const SCOPE_A = 'tenant-a:user-a:role-a';
const SCOPE_B = 'tenant-b:user-b:role-b';

const query: Per008TeamQuery = {
  limit: 25,
  filter: {},
  sort: ['itemPublicId:ASC'],
  locale: 'ko-KR',
  timeZone: 'Asia/Seoul',
  correlationId: ID.correlation,
};
function teamProjection(title = 'Tenant A team member'): Per008TeamProjection {
  return {
    projectionVersion: '2',
    asOf: NOW,
    variantKey: 'PERFORMANCE',
    queryState: {
      state: 'COMPLETE',
      scopeDecisionRevision: 'scope-1',
      freshness: 'CURRENT',
      nextCursor: null,
      fieldDecisionSummary: { viewCount: 4, maskedCount: 0, omittedCount: 0 },
      partialFailures: [],
      correlationId: ID.correlation,
      cachePolicy: {
        authorizationDecisionRevision: 'auth-1',
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 0,
      },
    },
    items: [
      {
        itemPublicId: ID.item,
        title,
        statusCode: 'OPEN',
        fieldGroups: {
          PERFORMANCE_ASSIGNMENT: {
            decision: 'VIEW',
            value: {
              publicId: ID.assignment,
              code: 'FY27_REVIEW',
              label: 'FY27 Review',
              revision: 1,
            },
          },
          DUE_STATUS: { decision: 'VIEW', value: { code: 'DUE_SOON', revision: 1 } },
          LIMITED_PROFILE: { decision: 'VIEW', value: { code: 'ACTIVE', revision: 1 } },
          PERFORMANCE_FEEDBACK_ACTION_TARGET: {
            decision: 'VIEW',
            value: {
              cycleVersionId: ID.cycle,
              subjectWorkerPublicId: ID.worker,
              subjectAssignmentPublicId: ID.assignment,
              scopeDecisionRevision: 'scope-1',
              authorizationDecisionRevision: 'auth-1',
            },
          },
        },
        deepLink: { route: '/hr/team/performance', resourcePublicId: ID.item },
        availableActions: [
          {
            actionKey: 'hris.action.per.create-goal',
            method: 'POST',
            hrefTemplate: '/api/people/v1/hris/performance/goals',
            idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
            stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
          },
          {
            actionKey: PER008_CREATE_ACTION_KEY,
            method: 'POST',
            hrefTemplate: PER008_ROUTES.createRequest,
            idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
            stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
          },
        ],
      },
    ],
  };
}
function teamPage(title: string, nextCursor: string | null): Per008TeamProjection {
  const projection = teamProjection(title);
  return { ...projection, queryState: { ...projection.queryState, nextCursor } };
}
const options: Per008RequestOptions = {
  schemaKey: 'Per008FeedbackRequestOptionsV1',
  cycleVersionId: ID.cycle,
  subjectWorkerPublicId: ID.worker,
  subjectAssignmentPublicId: ID.assignment,
  templates: [
    {
      templateVersionId: ID.template,
      label: 'Peer feedback',
      schemaKey: 'dwp.hris.performance.review-form.v1',
      schemaVersion: 1,
      templateContentHash: HASH,
    },
  ],
  anonymityModes: ['MASKED'],
  thresholdLimits: { minimum: 2, maximum: 10 },
  windowLimits: { earliestOpensAt: NOW, latestClosesAt: LATER, maximumDurationDays: 3 },
  correlationId: ID.correlation,
};
const inbox: Per008AssignedFeedbackList = {
  schemaVersion: '1',
  asOf: NOW,
  queryState: 'COMPLETE',
  nextCursor: null,
  problemCorrelationId: null,
  items: [
    {
      feedbackAssignmentId: ID.assignment,
      feedbackRequestId: ID.request,
      requestTitle: 'Tenant A assigned feedback',
      requestState: 'OPEN',
      assignmentState: 'ASSIGNED',
      opensAt: NOW,
      closesAt: LATER,
    },
  ],
};
function inboxPage(
  title: string,
  feedbackAssignmentId: string,
  feedbackRequestId: string,
  nextCursor: string | null
): Per008AssignedFeedbackList {
  return {
    ...inbox,
    nextCursor,
    items: [{ ...inbox.items[0]!, feedbackAssignmentId, feedbackRequestId, requestTitle: title }],
  };
}
const detail: Per008AssignedFeedbackDetail = {
  schemaKey: 'Per008AssignedFeedbackDetailV1',
  feedbackAssignmentId: ID.assignment,
  feedbackRequestId: ID.request,
  requestTitle: 'Tenant A assigned feedback',
  requestState: 'OPEN',
  assignmentState: 'ASSIGNED',
  expectedRequestVersion: 2,
  templateVersionId: ID.template,
  templateContentHash: HASH,
  opensAt: NOW,
  closesAt: LATER,
  questions: [
    {
      questionPublicId: ID.question,
      prompt: 'Required strength',
      answerType: 'TEXT',
      required: true,
      choiceOptions: [],
    },
    {
      questionPublicId: ID.optional,
      prompt: 'Optional score',
      answerType: 'NUMBER',
      required: false,
      choiceOptions: [],
    },
    {
      questionPublicId: ID.choice,
      prompt: 'Required themes',
      answerType: 'MULTI_CHOICE',
      required: true,
      choiceOptions: [{ choiceOptionPublicId: ID.item, label: 'Collaboration' }],
    },
  ],
  correlationId: ID.correlation,
};

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolveValue) => {
    resolvePromise = resolveValue;
  });
  return { promise, resolve: resolvePromise };
}

describe('BASE-TFR-PER-008 unmounted feedback slice', () => {
  let mount: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    mount.remove();
    vi.restoreAllMocks();
  });

  it('PER008-AC-12 defaults OFF and makes zero owner calls until every gate and context are present', async () => {
    expect(PER008_FEATURE_DEFAULT_ENABLED).toBe(false);
    expect(PER008_PROVIDER_BOUND).toBe(false);
    const teamClient = {
      loadTeamPerformance: vi.fn(),
      loadRequestOptions: vi.fn(),
      createFeedbackRequest: vi.fn(),
    };
    const personalClient = {
      loadMyAssignments: vi.fn(),
      loadAssignment: vi.fn(),
      loadRequestOptions: vi.fn(),
      createFeedbackRequest: vi.fn(),
      submitResponse: vi.fn(),
      loadRelease: vi.fn(),
    };
    await act(async () =>
      root.render(
        <>
          <Per008TeamPerformanceWorkspace client={teamClient} initialQuery={query} />
          <Per008PersonalFeedbackWorkspace client={personalClient} />
        </>
      )
    );
    expect(mount.innerHTML).toBe('');
    expect(Object.values(teamClient).every((call) => call.mock.calls.length === 0)).toBe(true);
    expect(Object.values(personalClient).every((call) => call.mock.calls.length === 0)).toBe(true);
  });

  it('PER008-AC-01/02 uses the feedback action by key after prior actions and never index zero', () => {
    const begin = vi.fn();
    const html = renderToStaticMarkup(
      <Per008TeamPerformanceView
        state="COMPLETE"
        projection={teamProjection()}
        onBeginRequest={begin}
      />
    );
    expect(html).toContain('피드백 요청');
    expect(html).toContain('성과 피드백');
    expect(teamProjection().items[0]?.availableActions[0]?.actionKey).not.toBe(
      PER008_CREATE_ACTION_KEY
    );
  });

  it('PER008-AC-12 renders all protected states without leaking protected list content', () => {
    for (const state of [
      'LOADING',
      'EMPTY',
      'PARTIAL',
      'UNAVAILABLE',
      'DENIED',
      'STALE',
      'SUPPRESSED',
    ] as const) {
      const html = renderToStaticMarkup(
        <Per008ProtectedNotice state={state} locale="en" onRetry={vi.fn()} />
      );
      expect(html).toMatch(/role="(status|alert)"/);
      expect(html).not.toContain('Tenant A team member');
    }
    expect(renderToStaticMarkup(<Per008ProtectedNotice state="COMPLETE" />)).toBe('');
  });

  it('PER008-AC-12 hides seeded protected evidence in blocking full-view states', () => {
    for (const state of ['LOADING', 'EMPTY', 'UNAVAILABLE', 'DENIED', 'SUPPRESSED'] as const) {
      const teamHtml = renderToStaticMarkup(
        <Per008TeamPerformanceView
          state={state}
          projection={teamProjection('Seeded protected team evidence')}
        />
      );
      const personalHtml = renderToStaticMarkup(
        <Per008PersonalFeedbackView
          state={state}
          detailState="COMPLETE"
          inbox={inbox}
          detail={detail}
          selectedAssignmentId={ID.assignment}
        />
      );
      expect(teamHtml).not.toContain('Seeded protected team evidence');
      expect(personalHtml).not.toContain('Tenant A assigned feedback');
    }
  });

  it('PER008-AC-12 contributes no nested main landmark inside the DWP shell', () => {
    const html = renderToStaticMarkup(
      <main id="dwp-main-content">
        <Per008TeamPerformanceView state="COMPLETE" projection={teamProjection()} />
        <Per008PersonalFeedbackView state="COMPLETE" inbox={inbox} />
      </main>
    );
    expect(html.match(/<main(?:\s|>)/g)).toHaveLength(1);
  });

  it('PER008-AC-05 renders release metadata only in COMPLETE release state', () => {
    const release = {
      schemaKey: 'Per008FeedbackReleaseV1' as const,
      aggregateSchemaKey: 'PerformanceFeedbackAggregate.v1' as const,
      feedbackRequestId: ID.request,
      requestState: 'RELEASED' as const,
      anonymityMode: 'ANONYMOUS_AGGREGATE' as const,
      policyRevision: 'policy-3',
      aggregatedAt: NOW,
      releasedAt: LATER,
      title: 'Released feedback available',
      correlationId: ID.correlation,
    };
    const releaseTarget = {
      contextScopeKey: SCOPE_A,
      feedbackRequestId: ID.request,
      authorizationDecisionRevision: 'auth-1',
      provenance: 'OWNER_AUTHORIZED_RELEASE_REFERENCE' as const,
    };
    for (const releaseState of ['LOADING', 'DENIED', 'SUPPRESSED', 'UNAVAILABLE'] as const) {
      const blocked = renderToStaticMarkup(
        <Per008PersonalFeedbackView
          state="EMPTY"
          releaseState={releaseState}
          releaseTarget={releaseTarget}
          release={release}
        />
      );
      expect(blocked).not.toContain('Released feedback available');
    }
    const html = renderToStaticMarkup(
      <Per008PersonalFeedbackView
        state="EMPTY"
        releaseState="COMPLETE"
        releaseTarget={releaseTarget}
        release={release}
        displayTimeZone="Asia/Seoul"
      />
    );
    expect(html).toContain('Released feedback available');
    expect(html).toContain('익명 집계');
    expect(html).toContain('Asia/Seoul');
    expect(html).not.toMatch(/narrative|answer|score|contributor|raw count|digest|encrypt/i);
  });

  it('PER008-AC-12 hides team evidence synchronously across authority context changes', async () => {
    const next = deferred<Per008TeamProjection>();
    const clientA = {
      loadTeamPerformance: vi.fn().mockResolvedValue(teamProjection()),
      loadRequestOptions: vi.fn(),
      createFeedbackRequest: vi.fn(),
    };
    const clientB = {
      loadTeamPerformance: vi.fn().mockReturnValue(next.promise),
      loadRequestOptions: vi.fn(),
      createFeedbackRequest: vi.fn(),
    };
    await act(async () =>
      root.render(
        <Per008TeamPerformanceWorkspace
          mounted
          featureEnabled
          enrolled
          providerBound
          contextScopeKey={SCOPE_A}
          client={clientA}
          initialQuery={query}
          commandContextFactory={() => ({
            idempotencyKey: 'per008-command-key-1',
            expectedDecisionRevision: 'auth-1',
          })}
        />
      )
    );
    expect(mount.textContent).toContain('Tenant A team member');
    await act(async () =>
      root.render(
        <Per008TeamPerformanceWorkspace
          mounted
          featureEnabled
          enrolled
          providerBound
          contextScopeKey={SCOPE_B}
          client={clientB}
          initialQuery={query}
          commandContextFactory={() => ({
            idempotencyKey: 'per008-command-key-2',
            expectedDecisionRevision: 'auth-2',
          })}
        />
      )
    );
    expect(mount.textContent).not.toContain('Tenant A team member');
    expect(mount.textContent).not.toContain('피드백 요청');
    expect(clientA.loadRequestOptions).not.toHaveBeenCalled();
    expect(clientB.loadRequestOptions).not.toHaveBeenCalled();
  });

  it('PER008-AC-12 keeps read authority state separate from request-action denial', async () => {
    const client = {
      loadTeamPerformance: vi.fn().mockResolvedValue(teamProjection()),
      loadRequestOptions: vi.fn().mockRejectedValue(new Per008ClientError('DENIED', 403)),
      createFeedbackRequest: vi.fn(),
    };
    await act(async () =>
      root.render(
        <Per008TeamPerformanceWorkspace
          mounted
          featureEnabled
          enrolled
          providerBound
          contextScopeKey={SCOPE_A}
          client={client}
          initialQuery={query}
          commandContextFactory={() => ({
            idempotencyKey: 'per008-command-key-1',
            expectedDecisionRevision: 'auth-1',
          })}
        />
      )
    );
    const begin = [...mount.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === '피드백 요청'
    )!;
    await act(async () => begin.click());
    expect(mount.textContent).toContain('Tenant A team member');
    expect(mount.textContent).toContain('이 피드백 작업을 수행할 권한이 없습니다.');
    expect(mount.querySelector('.per008-composer')).toBeNull();
  });

  it('PER008-AC-02/12 hides SELF, detail and release authority across context changes', async () => {
    const next = deferred<Per008AssignedFeedbackList>();
    const clientA = {
      loadMyAssignments: vi.fn().mockResolvedValue(inbox),
      loadAssignment: vi.fn().mockResolvedValue(detail),
      loadRequestOptions: vi.fn(),
      createFeedbackRequest: vi.fn(),
      submitResponse: vi.fn(),
      loadRelease: vi.fn(),
    };
    const clientB = {
      loadMyAssignments: vi.fn().mockReturnValue(next.promise),
      loadAssignment: vi.fn(),
      loadRequestOptions: vi.fn(),
      createFeedbackRequest: vi.fn(),
      submitResponse: vi.fn(),
      loadRelease: vi.fn(),
    };
    const self = {
      cycleVersionId: ID.cycle,
      subjectWorkerPublicId: ID.worker,
      subjectAssignmentPublicId: ID.assignment,
    };
    const releaseTarget = {
      contextScopeKey: SCOPE_A,
      feedbackRequestId: ID.request,
      authorizationDecisionRevision: 'auth-1',
      provenance: 'OWNER_AUTHORIZED_RELEASE_REFERENCE' as const,
    };
    await act(async () =>
      root.render(
        <Per008PersonalFeedbackWorkspace
          mounted
          featureEnabled
          enrolled
          providerBound
          contextScopeKey={SCOPE_A}
          selfSubject={self}
          selfSubjectContextScopeKey={SCOPE_A}
          releaseTarget={releaseTarget}
          client={clientA}
        />
      )
    );
    expect(mount.textContent).toContain('Tenant A assigned feedback');
    expect(mount.textContent).toContain('피드백 요청');
    await act(async () =>
      root.render(
        <Per008PersonalFeedbackWorkspace
          mounted
          featureEnabled
          enrolled
          providerBound
          contextScopeKey={SCOPE_B}
          selfSubject={self}
          selfSubjectContextScopeKey={SCOPE_A}
          releaseTarget={releaseTarget}
          client={clientB}
        />
      )
    );
    expect(mount.textContent).not.toContain('Tenant A assigned feedback');
    expect(mount.textContent).not.toContain('공개 상태 열기');
    expect(mount.textContent).not.toContain('피드백 요청');
    expect(clientA.loadRequestOptions).not.toHaveBeenCalled();
    expect(clientA.loadRelease).not.toHaveBeenCalled();
  });

  it('PER008-AC-01 follows the team nextCursor and resets it on query change', async () => {
    const nextCursor = 'team_next_cursor_0001';
    const client = {
      loadTeamPerformance: vi
        .fn()
        .mockResolvedValueOnce(teamPage('Team page one', nextCursor))
        .mockResolvedValueOnce(teamPage('Team page two', null))
        .mockResolvedValueOnce(teamPage('Filtered team page', null)),
      loadRequestOptions: vi.fn(),
      createFeedbackRequest: vi.fn(),
    };
    await act(async () =>
      root.render(
        <Per008TeamPerformanceWorkspace
          mounted
          featureEnabled
          enrolled
          providerBound
          contextScopeKey={SCOPE_A}
          client={client}
          initialQuery={query}
        />
      )
    );
    const next = [...mount.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === '다음 페이지'
    )!;
    await act(async () => next.click());
    expect(client.loadTeamPerformance).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: nextCursor })
    );
    expect(mount.textContent).toContain('Team page two');
    expect(mount.textContent).not.toContain('Team page one');
    await act(async () =>
      (mount.querySelector('[role="search"]') as HTMLFormElement).requestSubmit()
    );
    expect(client.loadTeamPerformance).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ cursor: null })
    );
    expect(mount.textContent).toContain('Filtered team page');
    expect(mount.textContent).not.toContain('Team page two');
  });

  it('PER008-AC-12 follows the personal inbox nextCursor without retaining another page or scope', async () => {
    const nextCursor = 'inbox_next_cursor_01';
    const firstPage = inboxPage('Personal page one', ID.assignment, ID.request, nextCursor);
    const secondPage = inboxPage('Personal page two', ID.assignment2, ID.request2, null);
    const clientA = {
      loadMyAssignments: vi.fn().mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage),
      loadAssignment: vi.fn().mockImplementation((assignmentId: string) =>
        Promise.resolve({
          ...detail,
          feedbackAssignmentId: assignmentId,
          feedbackRequestId: assignmentId === ID.assignment2 ? ID.request2 : ID.request,
          requestTitle: assignmentId === ID.assignment2 ? 'Personal page two' : 'Personal page one',
        })
      ),
      loadRequestOptions: vi.fn(),
      createFeedbackRequest: vi.fn(),
      submitResponse: vi.fn(),
      loadRelease: vi.fn(),
    };
    await act(async () =>
      root.render(
        <Per008PersonalFeedbackWorkspace
          mounted
          featureEnabled
          enrolled
          providerBound
          contextScopeKey={SCOPE_A}
          client={clientA}
          displayTimeZone="Asia/Seoul"
        />
      )
    );
    const next = [...mount.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === '다음 페이지'
    )!;
    await act(async () => next.click());
    expect(clientA.loadMyAssignments).toHaveBeenNthCalledWith(2, nextCursor);
    expect(mount.textContent).toContain('Personal page two');
    expect(mount.textContent).not.toContain('Personal page one');

    const pendingScope = deferred<Per008AssignedFeedbackList>();
    const clientB = {
      loadMyAssignments: vi.fn().mockReturnValue(pendingScope.promise),
      loadAssignment: vi.fn(),
      loadRequestOptions: vi.fn(),
      createFeedbackRequest: vi.fn(),
      submitResponse: vi.fn(),
      loadRelease: vi.fn(),
    };
    await act(async () =>
      root.render(
        <Per008PersonalFeedbackWorkspace
          mounted
          featureEnabled
          enrolled
          providerBound
          contextScopeKey={SCOPE_B}
          client={clientB}
          displayTimeZone="Asia/Seoul"
        />
      )
    );
    expect(clientB.loadMyAssignments).toHaveBeenCalledWith(undefined);
    expect(mount.textContent).not.toContain('Personal page two');
    expect(mount.textContent).not.toContain('Personal page one');
  });

  it('PER008-AC-03/05 enforces maximum response window and does not invent target data', async () => {
    const submit = vi.fn();
    await act(async () =>
      root.render(
        <Per008RequestComposer
          options={options}
          locale="en"
          timeZone="UTC"
          onCancel={vi.fn()}
          onSubmit={submit}
        />
      )
    );
    const closesAt = getByLabelText<HTMLInputElement>(mount, 'Closes at');
    expect(closesAt.value).toBe('2026-10-26T01:00');
    expect(closesAt.dataset.min).toBe('2026-10-23T01:00');
    expect(closesAt.dataset.max).toBe('2026-10-30T01:00');
    await act(async () => {
      fireEvent.change(closesAt, { target: { value: '2026-10-29T01:00' } });
    });
    expect(closesAt.value).toBe('2026-10-29T01:00');
    await act(async () => (mount.querySelector('form') as HTMLFormElement).requestSubmit());
    expect(submit).not.toHaveBeenCalled();
    expect(mount.querySelector('[role="alert"]')?.textContent).toContain('allowed duration');
    expect(closesAt.getAttribute('aria-invalid')).toBe('true');
    await act(async () => {
      fireEvent.change(closesAt, { target: { value: '2026-10-26T01:00' } });
    });
    await act(async () => (mount.querySelector('form') as HTMLFormElement).requestSubmit());
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        cycleVersionId: ID.cycle,
        subjectWorkerPublicId: ID.worker,
        subjectAssignmentPublicId: ID.assignment,
        templateVersionId: ID.template,
        opensAt: '2026-10-23T01:00:00.000Z',
        closesAt: '2026-10-26T01:00:00.000Z',
      })
    );
  });

  it('PER008-AC-04/06/07 freezes a reviewed answer snapshot and omits unanswered optional answers', async () => {
    const submit = vi.fn();
    await act(async () =>
      root.render(
        <Per008PersonalFeedbackView
          state="COMPLETE"
          detailState="COMPLETE"
          inbox={inbox}
          detail={detail}
          selectedAssignmentId={ID.assignment}
          onSubmitResponse={submit}
        />
      )
    );
    const requiredText = mount.querySelector<HTMLTextAreaElement>(
      `textarea[name="${ID.question}"]`
    )!;
    const requiredChoice = mount.querySelector<HTMLInputElement>(`input[name="${ID.choice}"]`)!;
    expect(requiredChoice.required).toBe(false);
    expect(requiredChoice.closest('[role="group"]')?.getAttribute('aria-required')).toBe('true');
    await act(async () => {
      requiredText.value = 'Kept the team aligned';
      requiredText.dispatchEvent(new Event('input', { bubbles: true }));
      requiredChoice.click();
      (mount.querySelector('.per008-response-form') as HTMLFormElement).requestSubmit();
    });
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.textContent).toContain('Kept the team aligned');
    expect(dialog?.textContent).toContain('Collaboration');
    expect(dialog?.textContent).not.toContain('Optional score0');
    const confirm = [...dialog!.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === '확인 후 제출'
    )!;
    await act(async () => confirm.click());
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0].response.answers).toHaveLength(2);
    expect(
      submit.mock.calls[0]?.[0].response.answers.some(
        (answer: { questionPublicId: string }) => answer.questionPublicId === ID.optional
      )
    ).toBe(false);
  });

  it('PER008-AC-03 replays an accepted-but-unverified create with the frozen command context and key', async () => {
    const context = {
      idempotencyKey: 'per008-create-key-0001',
      expectedDecisionRevision: 'auth-1',
    };
    const create = vi
      .fn()
      .mockRejectedValueOnce(
        new Per008CommandOutcomeUnknownError(context.idempotencyKey, new Error('timeout'))
      )
      .mockResolvedValue({});
    const contextFactory = vi.fn().mockReturnValue(context);
    const client = {
      loadTeamPerformance: vi.fn().mockResolvedValue(teamProjection()),
      loadRequestOptions: vi.fn().mockResolvedValue({
        ...options,
        windowLimits: { ...options.windowLimits, maximumDurationDays: 7 },
      }),
      createFeedbackRequest: create,
    };
    await act(async () =>
      root.render(
        <Per008TeamPerformanceWorkspace
          mounted
          featureEnabled
          enrolled
          providerBound
          contextScopeKey={SCOPE_A}
          client={client}
          initialQuery={query}
          commandContextFactory={contextFactory}
        />
      )
    );
    const begin = [...mount.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === '피드백 요청'
    )!;
    await act(async () => begin.click());
    await act(async () =>
      (mount.querySelector('.per008-composer form') as HTMLFormElement).requestSubmit()
    );
    expect(mount.querySelector('.per008-composer')).toBeNull();
    const replay = [...mount.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === '동일 키로 재실행'
    )!;
    await act(async () => replay.click());
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]).toEqual(create.mock.calls[0]);
    expect(contextFactory).toHaveBeenCalledTimes(1);
  });

  it('PER008-AC-04/06 replays an unknown immutable submit with the frozen answer snapshot and key', async () => {
    const context = {
      idempotencyKey: 'per008-submit-key-0001',
      expectedDecisionRevision: 'auth-1',
    };
    const submit = vi
      .fn()
      .mockRejectedValueOnce(
        new Per008CommandOutcomeUnknownError(context.idempotencyKey, new Error('timeout'))
      )
      .mockResolvedValue({});
    const contextFactory = vi.fn().mockReturnValue(context);
    const singleQuestionDetail = { ...detail, questions: [detail.questions[0]!] };
    const client = {
      loadMyAssignments: vi.fn().mockResolvedValue(inbox),
      loadAssignment: vi.fn().mockResolvedValue(singleQuestionDetail),
      loadRequestOptions: vi.fn(),
      createFeedbackRequest: vi.fn(),
      submitResponse: submit,
      loadRelease: vi.fn(),
    };
    await act(async () =>
      root.render(
        <Per008PersonalFeedbackWorkspace
          mounted
          featureEnabled
          enrolled
          providerBound
          contextScopeKey={SCOPE_A}
          client={client}
          commandContextFactory={contextFactory}
        />
      )
    );
    const textarea = mount.querySelector('textarea')!;
    await act(async () => {
      textarea.value = 'Frozen response';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      (mount.querySelector('.per008-response-form') as HTMLFormElement).requestSubmit();
    });
    const confirm = [
      ...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ].find((button) => button.textContent === '확인 후 제출')!;
    await act(async () => confirm.click());
    expect(mount.querySelector('.per008-response-form')).toBeNull();
    const replay = [...mount.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === '동일 키로 재실행'
    )!;
    await act(async () => replay.click());
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]).toEqual(submit.mock.calls[0]);
    expect(contextFactory).toHaveBeenCalledTimes(1);
  });

  it('PER008-AC-12 makes immutable confirmation truly modal and blocks background interaction', async () => {
    await act(async () =>
      root.render(
        <Per008PersonalFeedbackView
          state="COMPLETE"
          detailState="COMPLETE"
          inbox={inbox}
          detail={{ ...detail, questions: [detail.questions[0]!] }}
          selectedAssignmentId={ID.assignment}
          onSubmitResponse={vi.fn()}
        />
      )
    );
    const textarea = mount.querySelector('textarea')!;
    const review = mount.querySelector<HTMLButtonElement>(
      '.per008-response-form button[type="submit"]'
    )!;
    await act(async () => {
      textarea.value = 'Accessible response';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      review.focus();
      review.click();
    });
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(mount.getAttribute('aria-hidden')).toBe('true');
    expect(dialog?.contains(document.activeElement)).toBe(true);
    const cancel = [...dialog!.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === '수정으로 돌아가기'
    )!;
    await act(async () => {
      cancel.click();
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(review);
    const css = readFileSync(
      resolve(
        process.cwd(),
        'apps/dwp/src/features/hris/performance/feedback/per008-workspace.css'
      ),
      'utf8'
    );
    expect(css).toContain('@media (max-width: 1280px)');
    expect(css).toContain('@media (max-width: 390px)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('overflow-wrap: anywhere');
  });
});
