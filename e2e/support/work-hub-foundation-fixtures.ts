import { DEFAULT_APP_PERMISSIONS } from './runtime-access';
import { fulfillSuccess, mockShellSession } from './shell-session';

import type { Page } from '@playwright/test';
import type {
  PersonalWorkTask,
  PersonalWorkTaskInput,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

/** Fictional fixtures: these assertions exercise the integrated UI, not a live tenant. */
export const WORK_HUB_FIXTURE = {
  personalId: 'b1111111-1111-4111-8111-111111111111',
  secondaryPersonalId: 'b2222222-2222-4222-8222-222222222222',
  personalTitle: 'Prepare the customer handover notes',
  secondaryTitle: 'Draft next week team checklist',
  approvalId: 'c1111111-1111-4111-8111-111111111111',
  approvalTitle: 'Review project data access',
  serviceId: 'd1111111-1111-4111-8111-111111111111',
  serviceTitle: 'Provide the laptop delivery address',
  workspaceId: 'e1111111-1111-4111-8111-111111111111',
  workspaceTitle: 'Publish the verified handover package',
};

const base = '/api/platform/v1/workspace/work-hub/personal-tasks';
const stamp = '2026-09-04T00:00:00Z';

export function personalTaskRoute(taskId = WORK_HUB_FIXTURE.personalId) {
  return `/work/queue?work=PERSONAL_TASK%3A${taskId}%3A`;
}

export type WorkHubCapturedMutation = {
  path: string;
  body: { version: number; status?: PersonalWorkTask['status'] };
  idempotencyKey: string | undefined;
};

export type WorkHubCapturedCreation = {
  body: PersonalWorkTaskInput;
  idempotencyKey: string | undefined;
};

export async function mockWorkHubFoundation(
  page: Page,
  options: {
    personal?: boolean;
    sourceOwned?: boolean;
    failServices?: boolean;
    failAllSources?: boolean;
    canUpdate?: boolean;
    mode?: 'light' | 'dark';
    highContrast?: boolean;
    loseFirstMutationResponse?: boolean;
    personalTitle?: string;
    nativeWorkspace?: boolean;
  } = {}
) {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: options.mode ?? 'light' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    appearance: {
      mode: options.mode ?? 'light',
      density: 'standard',
      highContrast: options.highContrast ?? false,
      reduceMotion: true,
    },
    permissions: [
      ...DEFAULT_APP_PERMISSIONS.map((permission) => ({ ...permission, effect: 'ALLOW' as const })),
      ...['APP.APPROVALS', 'APP.SERVICES'].map((resourceKey) => ({
        resourceType: 'APP',
        resourceKey,
        permissionCode: 'VIEW',
        effect: 'ALLOW' as const,
      })),
      ...(options.canUpdate === false
        ? []
        : [
            {
              resourceType: 'APP',
              resourceKey: 'APP.WORK',
              permissionCode: 'UPDATE',
              effect: 'ALLOW' as const,
            },
          ]),
    ],
  });

  let tasks: PersonalWorkTask[] =
    options.personal === false
      ? []
      : [
          {
            taskId: WORK_HUB_FIXTURE.personalId,
            title: options.personalTitle ?? WORK_HUB_FIXTURE.personalTitle,
            description: 'Summarize the three open customer questions before the handover.',
            status: 'OPEN',
            priority: 'HIGH',
            dueAt: null,
            source: null,
            version: 4,
            createdAt: stamp,
            updatedAt: stamp,
            completedAt: null,
          },
          {
            taskId: WORK_HUB_FIXTURE.secondaryPersonalId,
            title: WORK_HUB_FIXTURE.secondaryTitle,
            description:
              'A separate low-priority task proves deep links do not select the first row.',
            status: 'OPEN',
            priority: 'LOW',
            dueAt: null,
            source: null,
            version: 0,
            createdAt: stamp,
            updatedAt: stamp,
            completedAt: null,
          },
        ];
  const approval = {
    taskId: WORK_HUB_FIXTURE.approvalId,
    requestId: 'c2222222-2222-4222-8222-222222222222',
    requestNumber: 'APR-2026-0904-001',
    title: WORK_HUB_FIXTURE.approvalTitle,
    summary: 'Read the source evidence before an approval decision.',
    workflowNameKo: '프로젝트 데이터 접근',
    workflowNameEn: 'Project data access',
    stepKey: 'SECURITY_REVIEW',
    stepName: 'Security review',
    stepSequence: 1,
    requesterName: 'Jisoo Park',
    requesterOrgName: 'Delivery',
    status: 'PENDING',
    priority: 'HIGH',
    dataClassification: 'CONFIDENTIAL',
    riskScore: 35,
    submittedAt: stamp,
    dueAt: null,
    version: 2,
  };
  const service = {
    requestId: WORK_HUB_FIXTURE.serviceId,
    requestNumber: 'SR-2026-0904-001',
    serviceKey: 'laptop-delivery',
    serviceNameKo: '업무용 기기 배송',
    serviceNameEn: 'Laptop delivery',
    summary: WORK_HUB_FIXTURE.serviceTitle,
    dataClassification: 'INTERNAL',
    status: 'AWAITING_REQUESTER',
    priority: 'NORMAL',
    assignedGroup: 'IT Service',
    assignedTo: null,
    submittedAt: stamp,
    slaDueAt: null,
    updatedAt: stamp,
    version: 3,
  };
  const mutations: WorkHubCapturedMutation[] = [];
  const batchMutations: Array<{ body: unknown }> = [];
  const creations: WorkHubCapturedCreation[] = [];
  const failedSourceReads: string[] = [];
  const forbiddenWorkspaceMutations: string[] = [];
  const receipts = new Map<string, PersonalWorkTask>();
  let personalReads = 0;
  let releaseMutation: (() => void) | undefined;
  let nextMutationGate: Promise<void> | undefined;
  let responseLost = false;
  let failSourceReads = options.failAllSources === true;
  let nativeWorkspace = {
    workItemId: WORK_HUB_FIXTURE.workspaceId,
    id: 'WK-2026-0904-001',
    title: WORK_HUB_FIXTURE.workspaceTitle,
    summary: 'A DWP-owned task that supports atomic batch status changes.',
    type: 'TASK',
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    owner: 'Mina Kim',
    sourceSystem: 'WORKSPACE',
    sourceReference: null,
    sourceRoute: null,
    reason: null,
    version: 1,
    updatedAt: stamp,
    capabilities: { canStart: true, canComplete: true, canWait: true },
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (
      failSourceReads &&
      request.method() === 'GET' &&
      (path === '/api/platform/v1/workspace/work-items' ||
        path === '/api/approvals/v1/tasks' ||
        path === '/api/approvals/v1/requests' ||
        path === '/api/platform/v1/services/requests' ||
        path === base)
    ) {
      failedSourceReads.push(`${path}${url.search}`);
      return route.fulfill({
        status: 503,
        json: { status: 'ERROR', message: 'Work source temporarily unavailable' },
      });
    }
    if (path === '/api/platform/v1/workspace/work-items') {
      const items = options.nativeWorkspace ? [nativeWorkspace] : [];
      return fulfillSuccess(route, {
        summary: {
          total: items.length,
          dueSoon: 0,
          inProgress: nativeWorkspace.status === 'IN_PROGRESS' ? 1 : 0,
          waiting: 0,
          completed: nativeWorkspace.status === 'COMPLETED' ? 1 : 0,
        },
        items,
        generatedAt: new Date().toISOString(),
      });
    }
    if (
      path === '/api/platform/v1/workspace/work-items/batch/status' &&
      request.method() === 'PATCH'
    ) {
      const body = request.postDataJSON() as {
        items: Array<{ workItemId: string; version: number }>;
        status: 'IN_PROGRESS' | 'COMPLETED';
      };
      batchMutations.push({ body });
      if (
        body.items.length !== 1 ||
        body.items[0].workItemId !== nativeWorkspace.workItemId ||
        body.items[0].version !== nativeWorkspace.version
      ) {
        return route.fulfill({ status: 409 });
      }
      nativeWorkspace = {
        ...nativeWorkspace,
        status: body.status,
        version: nativeWorkspace.version + 1,
        updatedAt: new Date().toISOString(),
      };
      return fulfillSuccess(route, [nativeWorkspace]);
    }
    if (path.startsWith('/api/platform/v1/workspace/work-items/') && request.method() !== 'GET') {
      forbiddenWorkspaceMutations.push(path);
      return route.fulfill({
        status: 403,
        json: { status: 'ERROR', message: 'Source-owned work' },
      });
    }
    if (path === '/api/approvals/v1/tasks') {
      return fulfillSuccess(
        route,
        options.sourceOwned !== false && url.searchParams.get('view') === 'INBOX' ? [approval] : []
      );
    }
    if (path === '/api/approvals/v1/requests') return fulfillSuccess(route, []);
    if (path === `/api/approvals/v1/tasks/${approval.taskId}`) {
      return fulfillSuccess(route, {
        task: approval,
        payload: {},
        timeline: [],
        canClaim: false,
        canDecide: false,
        selfApprovalBlocked: false,
      });
    }
    if (path === '/api/platform/v1/services/requests') {
      if (options.failServices)
        return route.fulfill({
          status: 503,
          json: { status: 'ERROR', message: 'Service source temporarily unavailable' },
        });
      return fulfillSuccess(route, options.sourceOwned === false ? [] : [service]);
    }
    if (path === `/api/platform/v1/services/requests/${service.requestId}`) {
      return fulfillSuccess(route, {
        request: service,
        timeline: [],
        fields: [],
        payload: {},
        canEdit: false,
        canCancel: false,
        canSubmit: false,
      });
    }
    if (path.startsWith('/api/platform/v1/workspace/work-hub/day-plans/')) {
      const date = path.slice(path.lastIndexOf('/') + 1);
      return fulfillSuccess(route, { date, version: 0, items: [], updatedAt: null });
    }
    if (path === base) {
      if (request.method() === 'GET') {
        personalReads += 1;
        return fulfillSuccess(route, {
          items: tasks,
          page: 0,
          size: 100,
          totalElements: tasks.length,
          hasMore: false,
        });
      }
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as PersonalWorkTaskInput;
        const idempotencyKey = request.headers()['idempotency-key'];
        creations.push({ body, idempotencyKey });
        const created: PersonalWorkTask = {
          taskId: 'b3333333-3333-4333-8333-333333333333',
          title: body.title,
          description: body.description ?? null,
          status: 'OPEN',
          priority: body.priority,
          dueAt: body.dueAt ?? null,
          source: null,
          version: 0,
          createdAt: stamp,
          updatedAt: stamp,
          completedAt: null,
        };
        tasks = [created, ...tasks];
        return fulfillSuccess(route, created);
      }
    }
    if (path.startsWith(`${base}/`)) {
      const [taskId, command] = path.slice(base.length + 1).split('/');
      const task = tasks.find((item) => item.taskId === taskId);
      if (!task) return route.fulfill({ status: 404 });
      if (command === 'timeline' && request.method() === 'GET') {
        return fulfillSuccess(route, {
          items: [],
          page: 0,
          size: 50,
          totalElements: 0,
          hasMore: false,
        });
      }
      if (request.method() === 'GET') return fulfillSuccess(route, task);
      const body = request.postDataJSON() as WorkHubCapturedMutation['body'];
      const idempotencyKey = request.headers()['idempotency-key'];
      mutations.push({ path, body, idempotencyKey });
      const gate = nextMutationGate;
      nextMutationGate = undefined;
      if (gate) await gate;
      const receipt = idempotencyKey ? receipts.get(idempotencyKey) : undefined;
      if (receipt) return fulfillSuccess(route, receipt);
      if (!idempotencyKey || body.version !== task.version) {
        return route.fulfill({
          status: 409,
          json: { status: 'ERROR', message: 'Version or request identity mismatch' },
        });
      }
      const status = command === 'complete' ? 'COMPLETED' : body.status!;
      const updated: PersonalWorkTask = {
        ...task,
        status,
        version: task.version + 1,
        updatedAt: new Date().toISOString(),
        completedAt: status === 'COMPLETED' ? new Date().toISOString() : null,
      };
      tasks = tasks.map((item) => (item.taskId === taskId ? updated : item));
      receipts.set(idempotencyKey, updated);
      if (options.loseFirstMutationResponse && !responseLost) {
        responseLost = true;
        return route.abort('failed');
      }
      return fulfillSuccess(route, updated);
    }
    return route.fallback();
  });

  return {
    mutations,
    batchMutations,
    creations,
    failedSourceReads,
    forbiddenWorkspaceMutations,
    get personalReads() {
      return personalReads;
    },
    holdNextMutation() {
      nextMutationGate = new Promise<void>((resolve) => {
        releaseMutation = resolve;
      });
    },
    releaseMutation() {
      releaseMutation?.();
    },
    failFutureReads() {
      failSourceReads = true;
    },
  };
}
