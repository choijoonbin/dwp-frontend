// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Per008CommandOutcomeUnknownError } from '../../feedback/per008-client';
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

const ID = {
  item: '11111111-1111-4111-8111-111111111111',
  cycle: '22222222-2222-4222-8222-222222222222',
  worker: '33333333-3333-4333-8333-333333333333',
  assignment: '44444444-4444-4444-8444-444444444444',
  template: '55555555-5555-4555-8555-555555555555',
  request: '66666666-6666-4666-8666-666666666666',
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
  limit: 25, filter: {}, sort: ['itemPublicId:ASC'], locale: 'ko-KR', timeZone: 'Asia/Seoul',
  correlationId: ID.correlation,
};
function teamProjection(title = 'Tenant A team member'): Per008TeamProjection {
  return {
    projectionVersion: '2', asOf: NOW, variantKey: 'PERFORMANCE',
    queryState: {
      state: 'COMPLETE', scopeDecisionRevision: 'scope-1', freshness: 'CURRENT', nextCursor: null,
      fieldDecisionSummary: { viewCount: 4, maskedCount: 0, omittedCount: 0 }, partialFailures: [],
      correlationId: ID.correlation,
      cachePolicy: { authorizationDecisionRevision: 'auth-1',
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1', maxAgeSeconds: 0 },
    },
    items: [{
      itemPublicId: ID.item, title, statusCode: 'OPEN',
      fieldGroups: {
        PERFORMANCE_ASSIGNMENT: { decision: 'VIEW', value: {
          publicId: ID.assignment, code: 'FY27_REVIEW', label: 'FY27 Review', revision: 1,
        } },
        DUE_STATUS: { decision: 'VIEW', value: { code: 'DUE_SOON', revision: 1 } },
        LIMITED_PROFILE: { decision: 'VIEW', value: { code: 'ACTIVE', revision: 1 } },
        PERFORMANCE_FEEDBACK_ACTION_TARGET: { decision: 'VIEW', value: {
          cycleVersionId: ID.cycle, subjectWorkerPublicId: ID.worker,
          subjectAssignmentPublicId: ID.assignment, scopeDecisionRevision: 'scope-1',
          authorizationDecisionRevision: 'auth-1',
        } },
      }, deepLink: { route: '/hr/team/performance', resourcePublicId: ID.item },
      availableActions: [{
        actionKey: 'hris.action.per.create-goal', method: 'POST',
        hrefTemplate: '/api/people/v1/hris/performance/goals',
        idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
        stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
      }, {
        actionKey: PER008_CREATE_ACTION_KEY, method: 'POST', hrefTemplate: PER008_ROUTES.createRequest,
        idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
        stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
      }],
    }],
  };
}
const options: Per008RequestOptions = {
  schemaKey: 'Per008FeedbackRequestOptionsV1', cycleVersionId: ID.cycle,
  subjectWorkerPublicId: ID.worker, subjectAssignmentPublicId: ID.assignment,
  templates: [{ templateVersionId: ID.template, label: 'Peer feedback',
    schemaKey: 'dwp.hris.performance.review-form.v1', schemaVersion: 1, templateContentHash: HASH }],
  anonymityModes: ['MASKED'], thresholdLimits: { minimum: 2, maximum: 10 },
  windowLimits: { earliestOpensAt: NOW, latestClosesAt: LATER, maximumDurationDays: 3 },
  correlationId: ID.correlation,
};
const inbox: Per008AssignedFeedbackList = {
  schemaVersion: '1', asOf: NOW, queryState: 'COMPLETE', nextCursor: null, problemCorrelationId: null,
  items: [{ feedbackAssignmentId: ID.assignment, feedbackRequestId: ID.request,
    requestTitle: 'Tenant A assigned feedback', requestState: 'OPEN', assignmentState: 'ASSIGNED',
    opensAt: NOW, closesAt: LATER }],
};
const detail: Per008AssignedFeedbackDetail = {
  schemaKey: 'Per008AssignedFeedbackDetailV1', feedbackAssignmentId: ID.assignment,
  feedbackRequestId: ID.request, requestTitle: 'Tenant A assigned feedback', requestState: 'OPEN',
  assignmentState: 'ASSIGNED', expectedRequestVersion: 2, templateVersionId: ID.template,
  templateContentHash: HASH, opensAt: NOW, closesAt: LATER,
  questions: [
    { questionPublicId: ID.question, prompt: 'Required strength', answerType: 'TEXT', required: true,
      choiceOptions: [] },
    { questionPublicId: ID.optional, prompt: 'Optional score', answerType: 'NUMBER', required: false,
      choiceOptions: [] },
    { questionPublicId: ID.choice, prompt: 'Required themes', answerType: 'MULTI_CHOICE', required: true,
      choiceOptions: [{ choiceOptionPublicId: ID.item, label: 'Collaboration' }] },
  ], correlationId: ID.correlation,
};

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolveValue) => { resolvePromise = resolveValue; });
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
    const teamClient = { loadTeamPerformance: vi.fn(), loadRequestOptions: vi.fn(),
      createFeedbackRequest: vi.fn() };
    const personalClient = { loadMyAssignments: vi.fn(), loadAssignment: vi.fn(),
      loadRequestOptions: vi.fn(), createFeedbackRequest: vi.fn(), submitResponse: vi.fn(),
      loadRelease: vi.fn() };
    await act(async () => root.render(<><Per008TeamPerformanceWorkspace client={teamClient}
      initialQuery={query} /><Per008PersonalFeedbackWorkspace client={personalClient} /></>));
    expect(mount.innerHTML).toBe('');
    expect(Object.values(teamClient).every((call) => call.mock.calls.length === 0)).toBe(true);
    expect(Object.values(personalClient).every((call) => call.mock.calls.length === 0)).toBe(true);
  });

  it('PER008-AC-01/02 uses the feedback action by key after prior actions and never index zero', () => {
    const begin = vi.fn();
    const html = renderToStaticMarkup(<Per008TeamPerformanceView state="COMPLETE"
      projection={teamProjection()} onBeginRequest={begin} />);
    expect(html).toContain('피드백 요청');
    expect(html).toContain('성과 피드백');
    expect(teamProjection().items[0]?.availableActions[0]?.actionKey).not.toBe(PER008_CREATE_ACTION_KEY);
  });

  it('PER008-AC-12 renders all protected states without leaking protected list content', () => {
    for (const state of ['LOADING', 'EMPTY', 'PARTIAL', 'UNAVAILABLE', 'DENIED', 'STALE',
      'SUPPRESSED'] as const) {
      const html = renderToStaticMarkup(<Per008ProtectedNotice state={state} locale="en" onRetry={vi.fn()} />);
      expect(html).toMatch(/role="(status|alert)"/);
      expect(html).not.toContain('Tenant A team member');
    }
    expect(renderToStaticMarkup(<Per008ProtectedNotice state="COMPLETE" />)).toBe('');
  });

  it('PER008-AC-05 exposes release availability metadata without protected aggregate content', () => {
    const html = renderToStaticMarkup(<Per008PersonalFeedbackView state="EMPTY" releaseState="COMPLETE"
      releaseTarget={{ contextScopeKey: SCOPE_A, feedbackRequestId: ID.request,
        authorizationDecisionRevision: 'auth-1', provenance: 'OWNER_AUTHORIZED_RELEASE_REFERENCE' }}
      release={{ schemaKey: 'Per008FeedbackReleaseV1',
        aggregateSchemaKey: 'PerformanceFeedbackAggregate.v1', feedbackRequestId: ID.request,
        requestState: 'RELEASED', anonymityMode: 'ANONYMOUS_AGGREGATE', policyRevision: 'policy-3',
        aggregatedAt: NOW, releasedAt: LATER, title: 'Released feedback available',
        correlationId: ID.correlation }} />);
    expect(html).toContain('Released feedback available');
    expect(html).toContain('ANONYMOUS AGGREGATE');
    expect(html).not.toMatch(/narrative|answer|score|contributor|raw count|digest|encrypt/i);
  });

  it('PER008-AC-12 hides team evidence synchronously across authority context changes', async () => {
    const next = deferred<Per008TeamProjection>();
    const clientA = { loadTeamPerformance: vi.fn().mockResolvedValue(teamProjection()),
      loadRequestOptions: vi.fn(), createFeedbackRequest: vi.fn() };
    const clientB = { loadTeamPerformance: vi.fn().mockReturnValue(next.promise),
      loadRequestOptions: vi.fn(), createFeedbackRequest: vi.fn() };
    await act(async () => root.render(<Per008TeamPerformanceWorkspace mounted featureEnabled enrolled providerBound
      contextScopeKey={SCOPE_A} client={clientA} initialQuery={query}
      commandContextFactory={() => ({ idempotencyKey: 'per008-command-key-1',
        expectedDecisionRevision: 'auth-1' })} />));
    expect(mount.textContent).toContain('Tenant A team member');
    await act(async () => root.render(<Per008TeamPerformanceWorkspace mounted featureEnabled enrolled providerBound
      contextScopeKey={SCOPE_B} client={clientB} initialQuery={query}
      commandContextFactory={() => ({ idempotencyKey: 'per008-command-key-2',
        expectedDecisionRevision: 'auth-2' })} />));
    expect(mount.textContent).not.toContain('Tenant A team member');
    expect(mount.textContent).not.toContain('피드백 요청');
    expect(clientA.loadRequestOptions).not.toHaveBeenCalled();
    expect(clientB.loadRequestOptions).not.toHaveBeenCalled();
  });

  it('PER008-AC-02/12 hides SELF, detail and release authority across context changes', async () => {
    const next = deferred<Per008AssignedFeedbackList>();
    const clientA = { loadMyAssignments: vi.fn().mockResolvedValue(inbox),
      loadAssignment: vi.fn().mockResolvedValue(detail), loadRequestOptions: vi.fn(),
      createFeedbackRequest: vi.fn(), submitResponse: vi.fn(), loadRelease: vi.fn() };
    const clientB = { loadMyAssignments: vi.fn().mockReturnValue(next.promise),
      loadAssignment: vi.fn(), loadRequestOptions: vi.fn(), createFeedbackRequest: vi.fn(),
      submitResponse: vi.fn(), loadRelease: vi.fn() };
    const self = { cycleVersionId: ID.cycle, subjectWorkerPublicId: ID.worker,
      subjectAssignmentPublicId: ID.assignment };
    const releaseTarget = { contextScopeKey: SCOPE_A, feedbackRequestId: ID.request,
      authorizationDecisionRevision: 'auth-1', provenance: 'OWNER_AUTHORIZED_RELEASE_REFERENCE' as const };
    await act(async () => root.render(<Per008PersonalFeedbackWorkspace mounted featureEnabled enrolled providerBound
      contextScopeKey={SCOPE_A} selfSubject={self} selfSubjectContextScopeKey={SCOPE_A}
      releaseTarget={releaseTarget} client={clientA} />));
    expect(mount.textContent).toContain('Tenant A assigned feedback');
    expect(mount.textContent).toContain('피드백 요청');
    await act(async () => root.render(<Per008PersonalFeedbackWorkspace mounted featureEnabled enrolled providerBound
      contextScopeKey={SCOPE_B} selfSubject={self} selfSubjectContextScopeKey={SCOPE_A}
      releaseTarget={releaseTarget} client={clientB} />));
    expect(mount.textContent).not.toContain('Tenant A assigned feedback');
    expect(mount.textContent).not.toContain('공개 상태 열기');
    expect(mount.textContent).not.toContain('피드백 요청');
    expect(clientA.loadRequestOptions).not.toHaveBeenCalled();
    expect(clientA.loadRelease).not.toHaveBeenCalled();
  });

  it('PER008-AC-03/05 enforces maximum response window and does not invent target data', async () => {
    const submit = vi.fn();
    await act(async () => root.render(<Per008RequestComposer options={options} locale="en"
      onCancel={vi.fn()} onSubmit={submit} />));
    await act(async () => {
      (mount.querySelector('form') as HTMLFormElement).requestSubmit();
    });
    expect(submit).not.toHaveBeenCalled();
    expect(mount.querySelector('[role="alert"]')?.textContent).toContain('allowed duration');
  });

  it('PER008-AC-04/06/07 freezes a reviewed answer snapshot and omits unanswered optional answers', async () => {
    const submit = vi.fn();
    await act(async () => root.render(<Per008PersonalFeedbackView state="COMPLETE" detailState="COMPLETE"
      inbox={inbox} detail={detail} selectedAssignmentId={ID.assignment} onSubmitResponse={submit} />));
    const requiredText = mount.querySelector<HTMLTextAreaElement>(`textarea[name="${ID.question}"]`)!;
    const requiredChoice = mount.querySelector<HTMLInputElement>(`input[name="${ID.choice}"]`)!;
    expect(requiredChoice.required).toBe(false);
    expect(requiredChoice.closest('[role="group"]')?.getAttribute('aria-required')).toBe('true');
    await act(async () => {
      requiredText.value = 'Kept the team aligned';
      requiredText.dispatchEvent(new Event('input', { bubbles: true }));
      requiredChoice.click();
      (mount.querySelector('.per008-response-form') as HTMLFormElement).requestSubmit();
    });
    const dialog = mount.querySelector<HTMLElement>('[role="alertdialog"]');
    expect(dialog?.textContent).toContain('Kept the team aligned');
    expect(dialog?.textContent).toContain('Collaboration');
    expect(dialog?.textContent).not.toContain('Optional score0');
    await act(async () => (dialog?.querySelectorAll('button')[1] as HTMLButtonElement).click());
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0].response.answers).toHaveLength(2);
    expect(submit.mock.calls[0]?.[0].response.answers.some((answer: { questionPublicId: string }) =>
      answer.questionPublicId === ID.optional)).toBe(false);
  });

  it('PER008-AC-03 replays an unknown create outcome with the frozen command, context and key', async () => {
    const context = { idempotencyKey: 'per008-create-key-0001', expectedDecisionRevision: 'auth-1' };
    const create = vi.fn()
      .mockRejectedValueOnce(new Per008CommandOutcomeUnknownError(context.idempotencyKey, new Error('timeout')))
      .mockResolvedValue({});
    const contextFactory = vi.fn().mockReturnValue(context);
    const client = { loadTeamPerformance: vi.fn().mockResolvedValue(teamProjection()),
      loadRequestOptions: vi.fn().mockResolvedValue({ ...options,
        windowLimits: { ...options.windowLimits, maximumDurationDays: 7 } }),
      createFeedbackRequest: create };
    await act(async () => root.render(<Per008TeamPerformanceWorkspace mounted featureEnabled enrolled providerBound
      contextScopeKey={SCOPE_A} client={client} initialQuery={query}
      commandContextFactory={contextFactory} />));
    const begin = [...mount.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === '피드백 요청')!;
    await act(async () => begin.click());
    await act(async () => (mount.querySelector('.per008-composer form') as HTMLFormElement).requestSubmit());
    expect(mount.querySelector('.per008-composer')).toBeNull();
    const replay = [...mount.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === '동일 키로 재실행')!;
    await act(async () => replay.click());
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]).toEqual(create.mock.calls[0]);
    expect(contextFactory).toHaveBeenCalledTimes(1);
  });

  it('PER008-AC-04/06 replays an unknown immutable submit with the frozen answer snapshot and key', async () => {
    const context = { idempotencyKey: 'per008-submit-key-0001', expectedDecisionRevision: 'auth-1' };
    const submit = vi.fn()
      .mockRejectedValueOnce(new Per008CommandOutcomeUnknownError(context.idempotencyKey, new Error('timeout')))
      .mockResolvedValue({});
    const contextFactory = vi.fn().mockReturnValue(context);
    const singleQuestionDetail = { ...detail, questions: [detail.questions[0]!] };
    const client = { loadMyAssignments: vi.fn().mockResolvedValue(inbox),
      loadAssignment: vi.fn().mockResolvedValue(singleQuestionDetail), loadRequestOptions: vi.fn(),
      createFeedbackRequest: vi.fn(), submitResponse: submit, loadRelease: vi.fn() };
    await act(async () => root.render(<Per008PersonalFeedbackWorkspace mounted featureEnabled enrolled providerBound
      contextScopeKey={SCOPE_A} client={client} commandContextFactory={contextFactory} />));
    const textarea = mount.querySelector('textarea')!;
    await act(async () => {
      textarea.value = 'Frozen response';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      (mount.querySelector('.per008-response-form') as HTMLFormElement).requestSubmit();
    });
    await act(async () => (mount.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')[1]!).click());
    expect(mount.querySelector('.per008-response-form')).toBeNull();
    const replay = [...mount.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === '동일 키로 재실행')!;
    await act(async () => replay.click());
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]).toEqual(submit.mock.calls[0]);
    expect(contextFactory).toHaveBeenCalledTimes(1);
  });

  it('PER008-AC-12 supports confirmation Escape/focus and bounded responsive accessibility modes', async () => {
    await act(async () => root.render(<Per008PersonalFeedbackView state="COMPLETE" detailState="COMPLETE"
      inbox={inbox} detail={{ ...detail, questions: [detail.questions[0]!] }}
      selectedAssignmentId={ID.assignment} onSubmitResponse={vi.fn()} />));
    const textarea = mount.querySelector('textarea')!;
    const review = mount.querySelector<HTMLButtonElement>('.per008-response-form button[type="submit"]')!;
    await act(async () => {
      textarea.value = 'Accessible response';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      review.focus();
      review.click();
    });
    expect(mount.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toContain('수정으로 돌아가기');
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(mount.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.activeElement).toBe(review);
    const css = readFileSync(resolve(process.cwd(),
      'apps/dwp/src/features/hris/performance/feedback/per008-workspace.css'), 'utf8');
    expect(css).toContain('@media (max-width: 1280px)');
    expect(css).toContain('@media (max-width: 390px)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('overflow-wrap: anywhere');
  });
});
