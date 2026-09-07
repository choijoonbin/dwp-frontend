// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import { HttpError } from '@dwp-frontend/shared-utils';
import type {
  VideoMeetingAdminOverview,
  VideoMeetingAdminPolicy,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

const runtime = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true,
    user: { identityPlane: 'TENANT', tenantId: 1, userId: 7 },
  },
  getOverview: vi.fn(),
  getPolicy: vi.fn(),
  getReadiness: vi.fn(),
  updatePolicy: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof SharedUtils>()),
  useAuth: () => runtime.auth,
  usePermissions: () => ({ hasPermission: () => true }),
  useToast: () => ({ success: runtime.success, error: runtime.error }),
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-api', () => ({
  getVideoMeetingAdminOverview: runtime.getOverview,
  getVideoMeetingAdminPolicy: runtime.getPolicy,
  updateVideoMeetingAdminPolicy: runtime.updatePolicy,
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-admin-intelligence-api', () => ({
  getVideoMeetingAdminIntelligenceReadiness: runtime.getReadiness,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: 'en' },
  }),
}));

import { MeetingAdminOperations, MeetingAdminPolicies } from './meeting-admin';

function policy(overrides: Partial<VideoMeetingAdminPolicy> = {}): VideoMeetingAdminPolicy {
  return {
    meetingsEnabled: true,
    waitingRoomRequired: true,
    guestsAllowed: false,
    participantChatAllowed: true,
    reactionsAllowed: true,
    screenShareAllowed: true,
    unmuteControl: 'REQUEST_ONLY',
    recordingPolicy: 'NEVER',
    allowJoinBeforeHost: false,
    requireAuthenticatedInternalUsers: true,
    maximumParticipants: 100,
    retentionDays: 90,
    artifactRetentionDays: 30,
    chatRetentionDays: 60,
    recordingConfigured: false,
    aiNotesConfigured: false,
    version: 4,
    ...overrides,
  };
}

const overview: VideoMeetingAdminOverview = {
  liveMeetings: 2,
  scheduledToday: 7,
  waitingParticipants: 1,
  meetingsLastSevenDays: 42,
  averageQualityScore: 91,
  failedJoinAttempts: 3,
  capabilities: {
    video: true,
    screenShare: true,
    chat: true,
    captions: false,
    recordingConfigured: false,
    transcriptConfigured: false,
    aiNotesConfigured: false,
  },
};

const readiness = {
  readinessVersion: 'meeting-intelligence-readiness-v1',
  observedAt: '2026-09-05T00:00:00Z',
  recordingPolicy: 'NEVER',
  providerCode: null,
  providerModel: null,
  processingRegion: null,
  capabilities: {
    recording: { state: 'BLOCKED', reason: 'PROVIDER_NOT_READY' },
    transcript: { state: 'BLOCKED', reason: 'STT_NOT_READY' },
    aiNotes: { state: 'BLOCKED', reason: 'LLM_NOT_READY' },
  },
  dependencies: Object.fromEntries(
    ['provider', 'region', 'kms', 'audit', 'egress', 'storage', 'stt', 'llm'].map((key) => [
      key,
      { state: 'BLOCKED', reason: `${key.toUpperCase()}_NOT_READY` },
    ])
  ),
  governance: Object.fromEntries(
    [
      'humanReview',
      'explicitPublish',
      'adminContentAccess',
      'workFollowUpPromotion',
      'followUpReassignment',
      'legalHold',
      'deletionEvidence',
    ].map((key) => [key, { state: 'NOT_VERIFIED', reason: `${key.toUpperCase()}_NOT_VERIFIED` }])
  ),
  retention: {
    meetingDays: 90,
    artifactDays: 30,
    chatDays: 60,
    intelligenceWorkerReady: false,
    signals: {
      intelligenceReports: { state: 'BLOCKED', reason: 'WORKER_NOT_READY' },
      meetingRecords: { state: 'NOT_VERIFIED', reason: 'WORKER_NOT_CONFIGURED' },
      artifacts: { state: 'NOT_VERIFIED', reason: 'WORKER_NOT_CONFIGURED' },
      chat: { state: 'NOT_VERIFIED', reason: 'WORKER_NOT_CONFIGURED' },
    },
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let root: Root | null;
let container: HTMLDivElement;
let client: QueryClient;

async function render(component: React.ReactNode) {
  await act(async () => {
    root?.render(createElement(QueryClientProvider, { client }, component));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function shown(text: string, host: ParentNode = container) {
  await act(async () => {
    await vi.waitFor(() => expect(host.textContent).toContain(text));
  });
}

async function policyLoaded(scope = JSON.stringify([true, 'TENANT', 1, 7])) {
  await vi.waitFor(() =>
    expect(client.getQueryData(['meetings', 'admin', 'policy', scope])).toBeDefined()
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function button(text: string, host: ParentNode = container) {
  const match = [...host.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === text
  );
  if (!match) throw new Error(`Missing button: ${text}`);
  return match;
}

function switchInput(label: string) {
  const match = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(
    (candidate) =>
      document.getElementById(candidate.getAttribute('aria-labelledby') ?? '')?.textContent ===
      label
  );
  if (!match) throw new Error(`Missing switch: ${label}`);
  return match;
}

function numberInput(label: string) {
  const element = [...container.querySelectorAll<HTMLLabelElement>('label')].find(
    (candidate) => candidate.textContent === label
  );
  const match = element?.htmlFor ? document.getElementById(element.htmlFor) : null;
  if (!(match instanceof HTMLInputElement)) throw new Error(`Missing number input: ${label}`);
  return match;
}

function recordingPolicySelect() {
  const match = container.querySelector<HTMLElement>('[role="combobox"]');
  if (!match) throw new Error('Missing recording policy select');
  return match;
}

async function click(target: HTMLElement) {
  await act(async () => target.click());
}

async function submitPolicy() {
  await click(button('actions.save'));
  await shown('admin.policy.confirmTitle', document.body);
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) throw new Error('Missing policy confirmation dialog');
  await click(button('actions.save', dialog));
}

describe('meeting admin policy conflict and authority scope', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    runtime.auth = {
      isAuthenticated: true,
      user: { identityPlane: 'TENANT', tenantId: 1, userId: 7 },
    };
    runtime.getOverview.mockReset().mockResolvedValue(overview);
    runtime.getPolicy.mockReset().mockResolvedValue(policy());
    runtime.getReadiness.mockReset().mockResolvedValue(readiness);
    runtime.updatePolicy.mockReset();
    runtime.success.mockReset();
    runtime.error.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    client.clear();
    container.remove();
    document.querySelectorAll('.MuiModal-root').forEach((modal) => modal.remove());
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('reapplies only the submitted patch over the latest version after a 409', async () => {
    const latest = policy({ version: 5, retentionDays: 180, maximumParticipants: 200 });
    runtime.getPolicy.mockReset().mockResolvedValueOnce(policy()).mockResolvedValueOnce(latest);
    runtime.updatePolicy
      .mockRejectedValueOnce(new HttpError('Conflict', 409))
      .mockImplementationOnce(async (submitted: VideoMeetingAdminPolicy) => ({
        ...submitted,
        version: 6,
      }));
    await render(createElement(MeetingAdminPolicies));
    await policyLoaded();
    await shown('admin.policy.meetingsEnabled');

    await click(switchInput('admin.policy.chat'));
    await click(switchInput('admin.policy.reactions'));
    await submitPolicy();

    await shown('admin.policy.conflictDescription');
    expect(runtime.updatePolicy).toHaveBeenCalledTimes(1);
    expect(runtime.updatePolicy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        version: 4,
        participantChatAllowed: false,
        reactionsAllowed: false,
        retentionDays: 90,
        maximumParticipants: 100,
      })
    );
    expect(container.textContent).toContain('"version":4');
    expect(container.textContent).toContain('"latestVersion":5');
    expect(container.textContent).toContain('"count":2');
    expect(switchInput('admin.policy.chat').disabled).toBe(true);
    expect(numberInput('admin.policy.retention').value).toBe('180');
    expect(numberInput('admin.policy.maximumParticipants').value).toBe('200');

    await click(button('admin.policy.conflictReapply'));
    expect(runtime.updatePolicy).toHaveBeenCalledTimes(1);
    expect(switchInput('admin.policy.chat').checked).toBe(false);
    expect(switchInput('admin.policy.reactions').checked).toBe(false);
    expect(numberInput('admin.policy.retention').value).toBe('180');
    expect(numberInput('admin.policy.maximumParticipants').value).toBe('200');

    await submitPolicy();
    await vi.waitFor(() => expect(runtime.updatePolicy).toHaveBeenCalledTimes(2));
    expect(runtime.updatePolicy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        version: 5,
        participantChatAllowed: false,
        reactionsAllowed: false,
        retentionDays: 180,
        maximumParticipants: 200,
      })
    );
  });

  it('keeps recording policy disabled when canonical runtime readiness fails closed', async () => {
    await render(createElement(MeetingAdminPolicies));
    await policyLoaded();
    await shown('admin.policy.recording');

    expect(recordingPolicySelect().getAttribute('aria-disabled')).toBe('true');
  });

  it('enables recording policy only when the canonical policy contract is configured', async () => {
    runtime.getPolicy.mockResolvedValue(policy({ recordingConfigured: true }));
    await render(createElement(MeetingAdminPolicies));
    await policyLoaded();
    await shown('admin.policy.recording');

    expect(recordingPolicySelect().getAttribute('aria-disabled')).not.toBe('true');
  });

  it('discards a preserved conflict patch without issuing another write', async () => {
    const latest = policy({ version: 5, waitingRoomRequired: false });
    runtime.getPolicy.mockReset().mockResolvedValueOnce(policy()).mockResolvedValueOnce(latest);
    runtime.updatePolicy.mockRejectedValueOnce(new HttpError('Conflict', 409));
    await render(createElement(MeetingAdminPolicies));
    await policyLoaded();
    await shown('admin.policy.meetingsEnabled');
    await click(switchInput('admin.policy.chat'));
    await submitPolicy();
    await shown('admin.policy.conflictDescription');

    await click(button('admin.policy.conflictDiscard'));
    expect(runtime.updatePolicy).toHaveBeenCalledTimes(1);
    expect(switchInput('admin.policy.chat').checked).toBe(true);
    expect(switchInput('admin.policy.waitingRoom').checked).toBe(false);
    expect(button('actions.save').hasAttribute('disabled')).toBe(true);
  });

  it('fences a late policy save when the identity plane changes', async () => {
    const write = deferred<VideoMeetingAdminPolicy>();
    runtime.updatePolicy.mockReturnValue(write.promise);
    await render(createElement(MeetingAdminPolicies));
    await policyLoaded();
    await shown('admin.policy.meetingsEnabled');
    await click(switchInput('admin.policy.chat'));
    await submitPolicy();
    await vi.waitFor(() => expect(runtime.updatePolicy).toHaveBeenCalledOnce());

    runtime.auth = {
      isAuthenticated: true,
      user: { identityPlane: 'SUPPORT', tenantId: 2, userId: 9 },
    };
    runtime.getPolicy.mockResolvedValue(policy({ version: 8, maximumParticipants: 50 }));
    await render(createElement(MeetingAdminPolicies));
    await policyLoaded(JSON.stringify([true, 'SUPPORT', 2, 9]));
    await vi.waitFor(() =>
      expect(numberInput('admin.policy.maximumParticipants').value).toBe('50')
    );
    await act(async () => write.resolve(policy({ version: 5, maximumParticipants: 999 })));

    expect(runtime.success).not.toHaveBeenCalled();
    expect(numberInput('admin.policy.maximumParticipants').value).toBe('50');
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data)
      )
    ).not.toContain('999');
  });

  it('binds operations data to a zero-lived sensitive identity cache', async () => {
    await render(createElement(MeetingAdminOperations));
    await shown('admin.operations.title');
    const scope = JSON.stringify([true, 'TENANT', 1, 7]);
    const queries = client
      .getQueryCache()
      .getAll()
      .filter((query) => query.queryKey.at(-1) === scope);
    expect(queries).toHaveLength(2);
    queries.forEach((query) => {
      expect(query.meta).toMatchObject({ accessSensitive: true });
      expect(query.gcTime).toBe(0);
    });
  });
});
