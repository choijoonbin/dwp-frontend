import type { Page, Route } from '@playwright/test';

import { fulfillSuccess } from './shell-session';

const GOVERNANCE_ID = '10000000-0000-4000-8000-000000000001';

const settings = {
  maxActiveUserRules: 30,
  maxVipRules: 8,
  maxFollowRules: 20,
  approvedTopicAllowlist: ['#sec-soc-alert', '#infra-deploy'],
  mandatoryPolicyPrecedence: true,
  minimumAnalyticsCohort: 25,
  independentReviewerRequired: true,
} as const;

function revision(
  state: 'DRAFT' | 'PUBLISHED' | 'REJECTED' | 'WITHDRAWN',
  creatorUserId: number,
  version: string
) {
  return {
    governanceId: GOVERNANCE_ID,
    state,
    settings,
    revisionNumber: 4,
    version,
    changeReason: '고신호 관심 규칙의 운영 한도와 개인정보 기준을 정합화합니다.',
    createdBy: creatorUserId,
    createdAt: '2026-09-17T01:00:00Z',
    approvedBy: state === 'PUBLISHED' ? 90 : null,
    approvedAt: state === 'PUBLISHED' ? '2026-09-17T01:30:00Z' : null,
    updatedBy: creatorUserId,
    updatedAt: '2026-09-17T01:00:00Z',
    decisionReason: null,
    supersedesGovernanceId: null,
  };
}

function fail(route: Route, status: number, message: string) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ERROR', message, errorCode: 'STALE_WRITE' }),
  });
}

export async function mockNotificationAttentionGovernance(
  page: Page,
  options: {
    actorUserId?: number;
    draftCreatorUserId?: number | null;
    loadFailure?: boolean;
    stalePublishOnce?: boolean;
    staleWithdrawOnce?: boolean;
  } = {}
) {
  const actorUserId = options.actorUserId ?? 100;
  let active = revision('PUBLISHED', 90, '3');
  let draft =
    options.draftCreatorUserId === null
      ? null
      : revision('DRAFT', options.draftCreatorUserId ?? actorUserId, '4');
  let loadFailure = options.loadFailure === true;
  let stalePublish = options.stalePublishOnce === true;
  let staleWithdraw = options.staleWithdrawOnce === true;
  let reads = 0;
  const commands: Array<{
    action: 'draft' | 'publish' | 'reject' | 'withdraw';
    body: Record<string, unknown>;
    idempotencyKey: string | undefined;
  }> = [];

  await page.route(
    '**/api/notifications/v1/admin/policies/attention-governance**',
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET') {
        reads += 1;
        if (loadFailure) return fail(route, 503, 'Attention governance unavailable');
        return fulfillSuccess(route, {
          activeRevision: active,
          drafts: draft ? [draft] : [],
          changeVersion: draft?.version ?? active.version,
          generatedAt: '2026-09-17T02:00:00Z',
        });
      }

      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      const idempotencyKey = request.headers()['idempotency-key'];
      if (path.endsWith('/drafts')) {
        commands.push({ action: 'draft', body, idempotencyKey });
        draft = {
          ...revision('DRAFT', actorUserId, String(Number(active.version) + 1)),
          settings: body.settings ?? settings,
          changeReason: String(body.changeReason ?? ''),
        };
        return fulfillSuccess(route, draft);
      }
      if (!draft) return fail(route, 404, 'Draft not found');

      if (path.endsWith('/publish')) {
        commands.push({ action: 'publish', body, idempotencyKey });
        if (stalePublish) {
          stalePublish = false;
          return fail(route, 409, 'Attention governance version is stale');
        }
        active = {
          ...draft,
          state: 'PUBLISHED',
          version: String(Number(draft.version) + 1),
          approvedBy: actorUserId,
          approvedAt: '2026-09-17T02:01:00Z',
          decisionReason: String(body.reason ?? ''),
        };
        draft = null;
        return fulfillSuccess(route, active);
      }
      if (path.endsWith('/reject')) {
        commands.push({ action: 'reject', body, idempotencyKey });
        const rejected = {
          ...draft,
          state: 'REJECTED',
          version: String(Number(draft.version) + 1),
          decisionReason: String(body.reason ?? ''),
        };
        draft = null;
        return fulfillSuccess(route, rejected);
      }
      if (path.endsWith('/withdraw')) {
        commands.push({ action: 'withdraw', body, idempotencyKey });
        if (staleWithdraw) {
          staleWithdraw = false;
          return fail(route, 409, 'Attention governance version is stale');
        }
        const withdrawn = {
          ...draft,
          state: 'WITHDRAWN',
          version: String(Number(draft.version) + 1),
          decisionReason: String(body.reason ?? ''),
        };
        draft = null;
        return fulfillSuccess(route, withdrawn);
      }
      return fail(route, 404, 'Unsupported governance command');
    }
  );

  return {
    commands,
    reads: () => reads,
    recover: () => {
      loadFailure = false;
    },
  };
}
