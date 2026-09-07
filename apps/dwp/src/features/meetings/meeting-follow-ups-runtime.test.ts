// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Shared from '@dwp-frontend/shared-utils';
import type * as Api from '@dwp-frontend/shared-utils/api/work-assignment-api';
import type * as MeetingApi from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type * as IntelligenceApi from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';
import type {
  WorkAssignmentTask,
  WorkAssignmentVersionCommand,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';
import { HttpError } from '@dwp-frontend/shared-utils';

const runtime = vi.hoisted(() => ({
  auth: { userId: 1, tenantId: 1, identityPlane: 'TENANT' },
  list: vi.fn(),
  detail: vi.fn(),
  transition: vi.fn(),
  receipt: vi.fn(),
  create: vi.fn(),
  bySource: vi.fn(),
  reassign: vi.fn(),
  home: vi.fn(),
  published: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof Shared>()),
  useAuth: () => ({ isAuthenticated: true, user: runtime.auth }),
}));
vi.mock('@dwp-frontend/shared-utils/api/work-assignment-api', async (original) => ({
  ...(await original<typeof Api>()),
  getWorkAssignments: runtime.list,
  getWorkAssignment: runtime.detail,
  transitionWorkAssignment: runtime.transition,
  getWorkAssignmentCommand: runtime.receipt,
  createWorkAssignment: runtime.create,
  getWorkAssignmentBySource: runtime.bySource,
  reassignWorkAssignment: runtime.reassign,
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-api', async (original) => ({
  ...(await original<typeof MeetingApi>()),
  getVideoMeetingHome: runtime.home,
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-intelligence-api', async (original) => ({
  ...(await original<typeof IntelligenceApi>()),
  getLatestPublishedVideoMeetingIntelligenceReport: runtime.published,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
import { MeetingFollowUps } from './meeting-follow-ups';

const id = '99000000-0000-4000-8000-000000000001';
const reportId = '99000000-0000-4000-8000-000000000002';
const task: WorkAssignmentTask = {
  assignmentId: id,
  createdByUserId: 2,
  assignedByUserId: 2,
  assigneeUserId: 1,
  title: 'Publish rollout checklist',
  description: 'Human-confirmed independent task terms',
  priority: 'HIGH',
  dueAt: null,
  assignmentState: 'PENDING',
  workState: 'OPEN',
  assignmentRevision: 1,
  version: 3,
  source: {
    availability: 'AVAILABLE',
    reference: {
      sourceSystem: 'MEETING_FOLLOWUP',
      meetingId: id,
      reportId,
      candidateId: '99000000-0000-4000-8000-000000000003',
    },
    sourceVersion: 8,
    sourceRoute: 'https://evil.example/secret',
  },
  capabilities: {
    canAccept: true,
    canDecline: true,
    canStart: false,
    canWait: false,
    canComplete: false,
    canReassign: true,
    canCancel: false,
  },
  createdAt: '2026-09-04T01:00:00Z',
  updatedAt: '2026-09-04T01:00:00Z',
  acceptedAt: null,
  completedAt: null,
};
const page = { items: [task], page: 0, size: 20, totalElements: 1, hasMore: false };
const candidateSource = {
  sourceSystem: 'MEETING_FOLLOWUP' as const,
  meetingId: id,
  reportId,
  candidateId: '99000000-0000-4000-8000-000000000003',
};
function enableCandidate() {
  runtime.home.mockResolvedValue({ recent: [{ meetingId: id, title: 'Planning' }] });
  runtime.published.mockResolvedValue({
    reportId,
    meetingId: id,
    runId: '99000000-0000-4000-8000-000000000004',
    state: 'PUBLISHED',
    audience: 'MEETING_PARTICIPANTS',
    schemaVersion: 'meeting-intelligence-v1',
    retentionUntil: '2100-01-01T00:00:00Z',
    legalHold: false,
    publishedAt: '2026-09-04T01:00:00Z',
    version: 8,
    canCurrentViewerReview: false,
    reviews: [],
    analysis: {
      executiveSummary: { text: 'Summary', citations: [] },
      topics: [],
      decisions: [],
      openQuestions: [],
      risks: [],
      actionItems: [{ text: 'Publish rollout checklist', citations: [] }],
      conversationClimate: { label: 'ALIGNED', signals: [], citations: [] },
    },
    followUpCandidates: [
      {
        candidateId: candidateSource.candidateId,
        sourceVersion: 8,
        actionItemIndex: 0,
      },
    ],
  });
}
function applied(
  assignmentId: string,
  action: string,
  input: WorkAssignmentVersionCommand,
  commandId: string
) {
  return {
    assignment: {
      ...task,
      assignmentId,
      assignmentState: 'ACCEPTED',
      version: input.version + 1,
      capabilities: { ...task.capabilities, canAccept: false, canDecline: false, canStart: true },
    },
    receipt: {
      assignmentId,
      commandId,
      operation: action.toUpperCase(),
      appliedVersion: input.version + 1,
      appliedAssignmentRevision: input.assignmentRevision,
      appliedAt: '2026-09-04T01:01:00Z',
      replayed: false,
    },
  };
}
let root: Root;
let mount: HTMLDivElement;
let client: QueryClient;
let router: ReturnType<typeof createMemoryRouter>;
const element = () => createElement(MeetingFollowUps);
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
async function render() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mount = document.createElement('div');
  document.body.append(mount);
  root = createRoot(mount);
  router = createMemoryRouter(
    [
      { path: '/', element: element() },
      {
        path: '/meetings/history',
        element: createElement('div', null, 'Exact report destination'),
      },
    ],
    { initialEntries: ['/'] }
  );
  await act(async () =>
    root.render(
      createElement(QueryClientProvider, { client }, createElement(RouterProvider, { router }))
    )
  );
  await settle();
}
function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find(
    (value) => value.getAttribute('aria-label') === label || value.textContent === label
  );
  if (!found) throw new Error('Missing button: ' + label);
  return found;
}
async function click(label: string) {
  await act(async () => button(label).click());
  await settle();
}
async function selectTask() {
  await act(async () =>
    (document.querySelector(`[data-testid="follow-up-row-${id}"]`) as HTMLButtonElement).click()
  );
  await settle();
}
async function accept() {
  await click('followUps.actions.accept');
  await click('followUps.confirmCommand');
}

describe('meeting follow-up Work runtime', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    runtime.auth = { userId: 1, tenantId: 1, identityPlane: 'TENANT' };
    runtime.list.mockResolvedValue(page);
    runtime.detail.mockResolvedValue(task);
    runtime.transition.mockImplementation(applied);
    runtime.receipt.mockRejectedValue(new HttpError('Not found', 404));
    runtime.bySource.mockRejectedValue(new HttpError('Not found', 404));
    runtime.home.mockResolvedValue({ recent: [] });
  });
  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    router?.dispose();
    client?.clear();
    mount?.remove();
  });
  it('loads only the explicitly scoped page without source fan-out', async () => {
    await render();
    expect(runtime.list).toHaveBeenCalledWith({ scope: 'ASSIGNED_TO_ME', page: 0, size: 20 });
    expect(runtime.detail).not.toHaveBeenCalled();
    expect(mount.textContent).toContain('followUps.sourceStates.NOT_REQUESTED');
    expect(mount.textContent).not.toContain('followUps.openSource');
    expect(mount.textContent).toContain('followUps.pageOnlyHint');
  });
  it('opens only the selected canonical detail and keeps accept separate from start', async () => {
    await render();
    await selectTask();
    expect(runtime.detail).toHaveBeenCalledTimes(1);
    expect(runtime.detail).toHaveBeenCalledWith(id);
    expect(button('followUps.actions.accept')).toBeTruthy();
    expect(mount.textContent).not.toContain('followUps.actions.start');
    expect(button('followUps.openWork').disabled).toBe(true);
    expect(runtime.create).not.toHaveBeenCalled();
    expect(runtime.reassign).not.toHaveBeenCalled();
  });
  it('sends a confirmed command with exact version, assignment revision, and UUID key', async () => {
    await render();
    await selectTask();
    await accept();
    expect(runtime.transition).toHaveBeenCalledWith(
      id,
      'accept',
      { version: 3, assignmentRevision: 1 },
      expect.stringMatching(/^[0-9a-f-]{36}$/u)
    );
    expect(mount.textContent).toContain('followUps.commandConfirmed');
    expect(button('followUps.actions.start')).toBeTruthy();
  });
  it('keeps source unavailable independent from authorized Work actions', async () => {
    runtime.detail.mockResolvedValue({
      ...task,
      source: {
        availability: 'UNAVAILABLE',
        reference: null,
        sourceVersion: null,
        sourceRoute: null,
      },
    });
    await render();
    await selectTask();
    expect(mount.textContent).toContain('followUps.sourceStates.UNAVAILABLE');
    expect(mount.textContent).not.toContain('followUps.openSource');
    await accept();
    expect(runtime.transition).toHaveBeenCalledTimes(1);
  });
  it('navigates to the bound report identity instead of an untrusted sourceRoute', async () => {
    await render();
    await selectTask();
    await click('followUps.openSource');
    expect(router.state.location.pathname).toBe('/meetings/history');
    expect(router.state.location.search).toBe(`?meeting=${id}&reportId=${reportId}`);
  });
  it('requires an approved explicit reason before declining', async () => {
    await render();
    await selectTask();
    await click('followUps.actions.decline');
    await click('followUps.confirmCommand');
    expect(runtime.transition).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('followUps.reasonRequired');
  });
  it('retries an uncertain command with the same key and unchanged input', async () => {
    runtime.transition.mockRejectedValue(new Error('Connection lost'));
    await render();
    await selectTask();
    await accept();
    expect(mount.textContent).toContain('followUps.uncertainTitle');
    expect(button('followUps.actions.accept').disabled).toBe(true);
    await click('followUps.retrySameCommand');
    expect(runtime.transition.mock.calls[1]).toEqual(runtime.transition.mock.calls[0]);
  });
  it('recovers the original receipt without issuing a new mutation', async () => {
    runtime.transition.mockRejectedValue(new Error('Lost response'));
    await render();
    await selectTask();
    await accept();
    const [assignmentId, action, input, commandId] = runtime.transition.mock.calls[0];
    runtime.receipt.mockResolvedValue(applied(assignmentId, action, input, commandId));
    await click('followUps.checkReceipt');
    expect(runtime.receipt).toHaveBeenCalledWith(commandId);
    expect(runtime.transition).toHaveBeenCalledTimes(1);
    expect(mount.textContent).toContain('followUps.commandConfirmed');
  });
  it('does not interpret a missing receipt as either success or permission to create a new command', async () => {
    runtime.transition.mockRejectedValue(new Error('Lost response'));
    await render();
    await selectTask();
    await accept();
    await click('followUps.checkReceipt');
    expect(mount.textContent).toContain('followUps.uncertainTitle');
    expect(mount.textContent).not.toContain('followUps.commandConfirmed');
    await click('followUps.retrySameCommand');
    expect(runtime.transition.mock.calls[1][3]).toBe(runtime.transition.mock.calls[0][3]);
  });
  it('rejects mismatched success receipts instead of declaring completion', async () => {
    runtime.transition.mockImplementation((assignmentId, action, input, commandId) => ({
      ...applied(assignmentId, action, input, commandId),
      receipt: {
        ...applied(assignmentId, action, input, commandId).receipt,
        assignmentId: reportId,
      },
    }));
    await render();
    await selectTask();
    await accept();
    expect(mount.textContent).toContain('followUps.uncertainTitle');
    expect(mount.textContent).not.toContain('followUps.commandConfirmed');
  });
  it('requires latest-version review after 409 and does not auto-resend stale input', async () => {
    runtime.transition.mockRejectedValue(new HttpError('Conflict', 409));
    await render();
    await selectTask();
    runtime.detail.mockResolvedValue({ ...task, version: 8 });
    await accept();
    expect(button('followUps.actions.accept').disabled).toBe(true);
    expect(runtime.transition).toHaveBeenCalledTimes(1);
    await click('followUps.reviewLatest');
    runtime.transition.mockImplementation(applied);
    await accept();
    expect(runtime.transition.mock.calls[1][2].version).toBe(8);
    expect(runtime.transition.mock.calls[1][3]).not.toBe(runtime.transition.mock.calls[0][3]);
  });
  it('clears raw task content and discards a late success after authority revocation', async () => {
    let complete!: (value: unknown) => void;
    runtime.transition.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    await render();
    await selectTask();
    await accept();
    runtime.list.mockRejectedValue(new HttpError('Denied', 403));
    await click('actions.refresh');
    expect(mount.textContent).not.toContain(task.title);
    const [assignmentId, action, input, commandId] = runtime.transition.mock.calls[0];
    await act(async () => complete(applied(assignmentId, action, input, commandId)));
    await settle();
    expect(mount.textContent).toContain('followUps.accessTitle');
    expect(mount.textContent).not.toContain(task.title);
    expect(mount.textContent).not.toContain('followUps.commandConfirmed');
  });
  it('clears previous-account content and ignores its late mutation', async () => {
    let complete!: (value: unknown) => void;
    runtime.transition.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    await render();
    await selectTask();
    await accept();
    runtime.auth = { userId: 8, tenantId: 2, identityPlane: 'TENANT' };
    runtime.list.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      router.routes[0].element = element();
      await router.navigate('/?identity=2');
    });
    expect(mount.textContent).not.toContain(task.title);
    const [assignmentId, action, input, commandId] = runtime.transition.mock.calls[0];
    await act(async () => complete(applied(assignmentId, action, input, commandId)));
    await settle();
    expect(mount.textContent).not.toContain(task.title);
    expect(mount.textContent).not.toContain('followUps.commandConfirmed');
  });
  it('does not revive source metadata from an older mutation after an independent source ACL inspection', async () => {
    let complete!: (value: unknown) => void;
    runtime.transition.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    await render();
    await selectTask();
    await accept();
    runtime.detail.mockResolvedValue({
      ...task,
      version: 4,
      source: {
        availability: 'UNAVAILABLE',
        reference: null,
        sourceVersion: null,
        sourceRoute: null,
      },
    });
    await act(async () =>
      client.invalidateQueries({ predicate: (entry) => entry.queryKey.includes('detail') })
    );
    await settle();
    expect(mount.textContent).not.toContain('followUps.openSource');
    const [assignmentId, action, input, commandId] = runtime.transition.mock.calls[0];
    await act(async () => complete(applied(assignmentId, action, input, commandId)));
    await settle();
    expect(mount.textContent).not.toContain('followUps.openSource');
    expect(mount.textContent).toContain('followUps.sourceStates.UNAVAILABLE');
  });
  it.each(['start', 'wait', 'complete'] as const)(
    'uses the separate server-authorized %s execution command',
    async (action) => {
      runtime.detail.mockResolvedValue({
        ...task,
        assignmentState: 'ACCEPTED',
        capabilities: {
          ...task.capabilities,
          canAccept: false,
          canDecline: false,
          canStart: true,
          canWait: true,
          canComplete: true,
        },
      });
      await render();
      await selectTask();
      await click('followUps.actions.' + action);
      await click('followUps.confirmCommand');
      expect(runtime.transition).toHaveBeenCalledWith(
        id,
        action,
        { version: 3, assignmentRevision: 1 },
        expect.any(String)
      );
    }
  );
  it('isolates scope changes and never leaks an old selected detail into requested-by-me', async () => {
    await render();
    await selectTask();
    runtime.list.mockResolvedValue({ ...page, items: [], totalElements: 0 });
    await click('followUps.tabs.ASSIGNED_BY_ME');
    expect(runtime.list).toHaveBeenLastCalledWith({ scope: 'ASSIGNED_BY_ME', page: 0, size: 20 });
    expect(mount.textContent).not.toContain(task.title);
    expect(mount.querySelector('[data-testid="meeting-follow-up-detail"]')).toBeNull();
  });
  it('shows an explicit empty state without presenting fake candidate counts', async () => {
    await render();
    await click('followUps.tabs.CANDIDATES');
    expect(mount.textContent).toContain('followUps.candidates.emptyTitle');
    expect(mount.textContent).not.toContain('followUps.scopeTotal');
    expect(runtime.create).not.toHaveBeenCalled();
    expect(runtime.reassign).not.toHaveBeenCalled();
  });
  it('keeps confirmed candidate promotion closed until current Meeting authority is available', async () => {
    enableCandidate();
    await render();
    await click('followUps.tabs.CANDIDATES');
    expect(mount.textContent).toContain('followUps.candidates.promotionBlockedTitle');
    const createButton = Array.from(mount.querySelectorAll('button')).find(
      (button) => button.textContent === 'followUps.createCandidate'
    );
    expect(createButton).toBeDefined();
    expect((createButton as HTMLButtonElement).disabled).toBe(true);
    await click('followUps.candidates.reviewCandidate');
    expect(document.body.textContent).toContain('followUps.candidates.reviewTitle');
    expect(document.body.textContent).toContain('followUps.candidates.sourceReviewBlocked');
    expect(document.body.textContent).toContain('followUps.candidates.impactHint');
    expect(runtime.create).not.toHaveBeenCalled();
    expect(runtime.bySource).not.toHaveBeenCalled();
  });
  it('passes pagination to the server and does not reuse a prior page detail', async () => {
    runtime.list.mockResolvedValueOnce({ ...page, totalElements: 21, hasMore: true });
    await render();
    await selectTask();
    runtime.list.mockResolvedValue({ ...page, items: [], page: 1, totalElements: 21 });
    await click('followUps.next');
    expect(runtime.list).toHaveBeenLastCalledWith({ scope: 'ASSIGNED_TO_ME', page: 1, size: 20 });
    expect(mount.querySelector('[data-testid="meeting-follow-up-detail"]')).toBeNull();
  });
  it('renders failures as failures instead of zero work', async () => {
    runtime.list.mockRejectedValue(new Error('Service unavailable'));
    await render();
    expect(mount.textContent).toContain('followUps.loadError');
    expect(mount.textContent).not.toContain('followUps.emptyTitle');
  });
});
