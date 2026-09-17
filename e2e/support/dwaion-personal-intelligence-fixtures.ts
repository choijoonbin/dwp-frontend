import type { Page } from '@playwright/test';
import type { DwaionTeamArtifactComment } from '@dwp-frontend/shared-utils';

import {
  ARTIFACT_ID,
  artifactCollaborationCapabilities,
  artifactComment,
  artifactVersion,
  artifactWorkspace,
  availablePersonalDataCapability,
  baseArtifact,
  completedDeletionJob,
  completedDeletionTarget,
  controls,
  deletionStages,
  MEMORY_ID,
  preflight,
  REPLY_ID,
  routine,
  routineHealth,
  routineRun,
  routineRuntimeCapabilities,
  routineTelemetryEvent,
  routineVersions,
  routineVisualVariants,
  ROUTINE_ID,
  ROUTINE_RUN_ID,
  success,
  unavailablePersonalDataCapability,
} from './dwaion-personal-intelligence-data';

export { DWAION_PERSONAL_PERMISSIONS } from './dwaion-personal-intelligence-data';

export type PersonalIntelligenceProbe = {
  artifactAutosaves: number;
  lastArtifactBody: string | null;
  artifactCommentMutations: number;
  dryRuns: number;
  runtimePreferenceUpdates: number;
  lastRuntimeApplicationState: string | null;
  deletionRequests: number;
  deletionStatusReads: number;
};

export async function mockDwaionPersonalIntelligence(
  page: Page,
  options: {
    published?: boolean;
    deletionExecutionAvailable?: boolean;
    locale?: 'en' | 'ko';
  } = {}
): Promise<PersonalIntelligenceProbe> {
  const probe: PersonalIntelligenceProbe = {
    artifactAutosaves: 0,
    lastArtifactBody: null,
    artifactCommentMutations: 0,
    dryRuns: 0,
    runtimePreferenceUpdates: 0,
    lastRuntimeApplicationState: null,
    deletionRequests: 0,
    deletionStatusReads: 0,
  };
  let artifact = {
    ...structuredClone(baseArtifact),
    ...(options.published ? { state: 'PUBLISHED', publishedVersionNumber: 2 } : {}),
    ...(options.locale === 'ko'
      ? {
          content: {
            ...baseArtifact.content,
            title: '출시 준비 계획',
            body: '접근 경계, 연결된 근거, 배포 준비 상태를 검토합니다.',
          },
        }
      : {}),
  };
  let controlsState = structuredClone(controls);
  let collaborationWorkspace = artifactWorkspace(options.locale ?? 'en');
  let memoryState = {
    memoryId: MEMORY_ID,
    kind: 'TONE',
    state: 'ACTIVE',
    revision: 2,
    memory: {
      value:
        options.locale === 'ko'
          ? '항상 세 줄 핵심 요약과 간결한 문장을 사용합니다.'
          : 'Use a concise, direct tone.',
    },
    origin: 'MANUAL',
    sourceType: 'USER_EXPLICIT_ENTRY',
    confidence: null,
    factVector: [],
    useCount: 9,
    lastUsedAt: '2026-09-04T01:30:00Z',
    encryptionProvider: 'AWS_KMS',
    encryptionKeyVersion: 'v7',
    encryptionKeyReferenceFingerprint: '4e8201a4c301',
    scope: ['ASK', 'RESEARCH', 'PROPOSALS'],
    expiresAt: '2026-10-14T09:00:00+09:00',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-04T00:00:00Z',
  };
  let artifactComments: DwaionTeamArtifactComment[] = [artifactComment(options.locale ?? 'en')];
  const routinePayloads =
    options.locale === 'ko'
      ? routineVisualVariants.map((item, index) => ({
          ...item,
          definition: {
            ...item.definition,
            name: [
              '아침 우선순위 검토',
              '주간 이해관계자 회의 준비',
              '결산 예외 접근 재확인',
              '금요일 상태 보고 초안 검증',
            ][index],
            objective: [
              '업무를 시작하기 전 마감 업무와 일정 참조 범위를 검증합니다.',
              '주간 검토에 허용된 업무 참조가 연결되어 있는지 확인합니다.',
              '결산 예외 참조를 검증하기 전에 변경된 접근 권한을 다시 확인합니다.',
              '제안을 만들지 않고 주간 상태 보고서의 참조만 미리 점검합니다.',
            ][index],
          },
        }))
      : routineVisualVariants;

  await page.route('**/api/agent/v1/routines**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET' && path.endsWith('/routines/capabilities')) {
      return success(route, routineRuntimeCapabilities());
    }
    if (route.request().method() === 'GET' && path.endsWith('/advanced-commands')) {
      return success(route, []);
    }
    if (route.request().method() === 'GET' && path === '/api/agent/v1/routines') {
      return success(route, routinePayloads);
    }
    if (
      route.request().method() === 'GET' &&
      path === `/api/agent/v1/routines/${ROUTINE_ID}/runs`
    ) {
      return success(route, [routineRun()]);
    }
    if (
      route.request().method() === 'GET' &&
      path === `/api/agent/v1/routines/${ROUTINE_ID}/versions`
    ) {
      return success(route, routineVersions(routinePayloads[0]!));
    }
    if (
      route.request().method() === 'GET' &&
      path === `/api/agent/v1/routines/${ROUTINE_ID}/health`
    ) {
      return success(route, routineHealth());
    }
    if (
      route.request().method() === 'GET' &&
      path === `/api/agent/v1/routines/${ROUTINE_ID}/telemetry/download`
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        headers: {
          'Cache-Control': 'no-store',
          'Content-Disposition': `attachment; filename="routine-${ROUTINE_ID}-telemetry.jsonl"`,
        },
        body: `${JSON.stringify(routineTelemetryEvent())}\n`,
      });
    }
    if (route.request().method() === 'POST' && path.endsWith('/dry-runs')) {
      probe.dryRuns += 1;
      return success(route, {
        routineRunId: '55555555-5555-4555-8555-555555555555',
        routineId: ROUTINE_ID,
        routineRevision: routine.revision,
        outcome: 'VALIDATED',
        proposalOnly: true,
        evidenceCount: 2,
        evidenceScope: 'AUTHORIZED_SOURCE_BINDING',
        businessEvidenceCount: 0,
        proposalsCreated: 0,
        externalWritesPerformed: 0,
        validatedSources: ['WORK_ITEM', 'MAIL'],
        previewNextRunAt: '2026-09-05T00:00:00Z',
        schedulingAvailable: false,
        evaluatedAt: '2026-09-04T00:00:00Z',
      });
    }
    return route.fulfill({ status: 501, json: { detail: 'Routine command is not mocked.' } });
  });

  await page.route('**/api/agent/v1/ai-controls**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/memories')) {
      return success(route, [memoryState]);
    }
    if (request.method() === 'GET' && path === '/api/agent/v1/ai-controls') {
      return success(route, controlsState);
    }
    if (request.method() === 'PUT' && path.endsWith('/runtime')) {
      const body = request.postDataJSON() as {
        expectedRevision: number;
        runtimeApplicationState: 'ENABLED' | 'DISABLED';
      };
      if (body.expectedRevision !== controlsState.revision) {
        return route.fulfill({ status: 409, json: { detail: 'Revision conflict.' } });
      }
      probe.runtimePreferenceUpdates += 1;
      probe.lastRuntimeApplicationState = body.runtimeApplicationState;
      controlsState = {
        ...controlsState,
        revision: controlsState.revision + 1,
        memoryEffective: body.runtimeApplicationState === 'ENABLED',
        runtimeApplicationState: body.runtimeApplicationState,
        runtimeApplicationEnabled: body.runtimeApplicationState === 'ENABLED',
        updatedAt: '2026-09-04T01:00:00Z',
      };
      return success(route, controlsState);
    }
    if (request.method() === 'PUT' && path.endsWith(`/memories/${MEMORY_ID}`)) {
      const body = request.postDataJSON() as {
        expectedRevision: number;
        memory?: { value: string };
        scope?: string[];
        expiresAt?: string | null;
      };
      if (body.expectedRevision !== memoryState.revision) {
        return route.fulfill({ status: 409, json: { detail: 'Revision conflict.' } });
      }
      memoryState = {
        ...memoryState,
        revision: memoryState.revision + 1,
        ...(body.memory ? { memory: body.memory } : {}),
        ...(body.scope ? { scope: body.scope } : {}),
        ...(Object.prototype.hasOwnProperty.call(body, 'expiresAt')
          ? { expiresAt: body.expiresAt ?? null }
          : {}),
        updatedAt: '2026-09-17T03:00:00Z',
      };
      return success(route, memoryState);
    }
    return route.fulfill({ status: 501, json: { detail: 'AI control command is not mocked.' } });
  });

  await page.route('**/api/agent/v1/personal-data/**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/deletions/evidence/receipt-index.json')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Cache-Control': 'no-store' },
        body: JSON.stringify({
          schemaVersion: 1,
          generatedAt: '2026-09-17T03:00:00Z',
          deletionJobs: [
            {
              deletionJobId: '66666666-6666-4666-8666-666666666666',
              state: 'COMPLETED',
              receiptFingerprint: '6'.repeat(64),
            },
          ],
        }),
      });
    }
    if (
      request.method() === 'GET' &&
      path.endsWith('/deletions/66666666-6666-4666-8666-666666666678/evidence/legal-hold.json')
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Cache-Control': 'no-store' },
        body: JSON.stringify({
          schemaVersion: 1,
          deletionJobId: '66666666-6666-4666-8666-666666666678',
          generatedAt: '2026-09-17T03:00:00Z',
          legalHolds: [
            {
              holdId: '15151515-1515-4515-8515-151515151515',
              authorityReference: 'LEGAL-2026-0914-001',
              dpoSubjectId: 'dpo@company.com',
              state: 'ACTIVE',
            },
          ],
        }),
      });
    }
    if (path.endsWith('/capabilities')) {
      return success(route, {
        supportedDeletionDomains: ['ROUTINE', 'MEMORY', 'ARTIFACT', 'ARTIFACT_EXPORT'],
        deletionRequestAvailable: true,
        deletionExecutionAvailable: options.deletionExecutionAvailable ?? false,
        deletionCompletionClaimAvailable: options.deletionExecutionAvailable ?? false,
        proposalClearManagedSeparately: true,
        proposalClearRoute: '/v1/proposals/clear',
        sourceSystemDataAffected: false,
        auditMetadataMayBeRetained: true,
        analysisReceiptClearAvailable: false,
        backupDestructionLog: unavailablePersonalDataCapability(
          'BACKUP_DESTRUCTION_LOG_NOT_CONFIGURED'
        ),
        sreSupport: unavailablePersonalDataCapability('SRE_SUPPORT_NOT_CONFIGURED'),
        legalHoldEvidence: availablePersonalDataCapability(),
        legalHoldAppeal: unavailablePersonalDataCapability('LEGAL_HOLD_APPEAL_NOT_CONFIGURED'),
        signedCertificate: unavailablePersonalDataCapability('SIGNED_CERTIFICATE_NOT_CONFIGURED'),
        siemSync: unavailablePersonalDataCapability('SIEM_SYNC_NOT_CONFIGURED'),
      });
    }
    if (path.endsWith('/retention')) {
      return success(
        route,
        ['ROUTINE', 'MEMORY', 'ARTIFACT', 'ARTIFACT_EXPORT'].map((domain) => ({
          domain,
          retentionDays: 90,
          deletionGraceDays: 7,
          legalHold: false,
          revision: 1,
          updatedAt: '2026-09-04T00:00:00Z',
        }))
      );
    }
    if (request.method() === 'POST' && path.endsWith('/deletions')) {
      probe.deletionRequests += 1;
      const body = request.postDataJSON() as { domains: string[] };
      return success(route, {
        deletionJobId: '66666666-6666-4666-8666-666666666666',
        state: options.deletionExecutionAvailable ? 'RUNNING' : 'REQUESTED',
        domains: body.domains,
        requestedAt: '2026-09-04T00:05:00Z',
        completedAt: null,
        deletionPerformed: false,
        deletionExecutionAvailable: options.deletionExecutionAvailable ?? false,
        blockedDomains: [],
        attemptCount: 1,
        stages: deletionStages(options.deletionExecutionAvailable ? 'RUNNING' : 'REQUESTED'),
        legalHolds: [],
        targets: body.domains.map((domain) => ({
          domain,
          state: options.deletionExecutionAvailable ? 'RUNNING' : 'REQUESTED',
          affectedCount: null,
          safeErrorCode: null,
          disposition: null,
          legalHoldEvidence: null,
        })),
      });
    }
    if (request.method() === 'GET' && path.endsWith('/deletions')) {
      return success(route, [completedDeletionJob()]);
    }
    if (
      request.method() === 'GET' &&
      path.endsWith('/deletions/66666666-6666-4666-8666-666666666666')
    ) {
      probe.deletionStatusReads += 1;
      const completed = probe.deletionStatusReads >= 2;
      return success(route, {
        deletionJobId: '66666666-6666-4666-8666-666666666666',
        state: completed ? 'COMPLETED' : 'RUNNING',
        domains: ['MEMORY'],
        requestedAt: '2026-09-04T00:05:00Z',
        completedAt: completed ? '2026-09-04T00:06:00Z' : null,
        deletionPerformed: completed,
        deletionExecutionAvailable: true,
        blockedDomains: [],
        attemptCount: 1,
        stages: deletionStages(completed ? 'COMPLETED' : 'RUNNING'),
        legalHolds: [],
        targets: [
          completed
            ? completedDeletionTarget('MEMORY')
            : {
                domain: 'MEMORY',
                state: 'RUNNING',
                affectedCount: null,
                safeErrorCode: null,
                disposition: null,
                legalHoldEvidence: null,
              },
        ],
      });
    }
    return route.fulfill({ status: 501, json: { detail: 'Personal data command is not mocked.' } });
  });

  await page.route('**/api/agent/v1/artifacts**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/agent/v1/artifacts') {
      return success(route, [artifact]);
    }
    if (request.method() === 'GET' && path === `/api/agent/v1/artifacts/${ARTIFACT_ID}`) {
      return success(route, artifact);
    }
    if (request.method() === 'GET' && path.endsWith('/versions')) {
      return success(route, [artifactVersion(1), artifactVersion(2)]);
    }
    if (request.method() === 'GET' && path.endsWith('/versions/1')) {
      return success(route, artifactVersion(1, 'Initial governed draft'));
    }
    if (request.method() === 'GET' && path.endsWith('/versions/2')) {
      return success(route, artifactVersion(2, artifact.content.body));
    }
    if (request.method() === 'GET' && path.endsWith('/preflights/current')) {
      return success(route, preflight(artifact.revision));
    }
    if (request.method() === 'PUT' && path.endsWith('/draft')) {
      const body = request.postDataJSON() as {
        content: typeof baseArtifact.content;
        sources: typeof baseArtifact.sources;
        metadata: typeof baseArtifact.metadata;
      };
      probe.artifactAutosaves += 1;
      probe.lastArtifactBody = body.content.body;
      artifact = {
        ...artifact,
        revision: artifact.revision + 1,
        draftRevision: artifact.draftRevision + 1,
        content: body.content,
        sources: body.sources,
        metadata: body.metadata,
        updatedAt: '2026-09-04T01:00:00Z',
      };
      return success(route, artifact);
    }
    return route.fulfill({ status: 501, json: { detail: 'Artifact command is not mocked.' } });
  });

  await page.route('**/api/agent/v1/artifact-collaboration/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/capabilities')) {
      return success(route, artifactCollaborationCapabilities());
    }
    if (request.method() === 'GET' && path.endsWith(`/${ARTIFACT_ID}/workspace`)) {
      return success(route, collaborationWorkspace);
    }
    const reviewDecisionMatch = path.match(
      new RegExp(`/${ARTIFACT_ID}/workspace/review-stages/([^/]+)/decision$`, 'u')
    );
    if (request.method() === 'POST' && reviewDecisionMatch) {
      const stageId = reviewDecisionMatch[1]!;
      const body = request.postDataJSON() as { decision: 'APPROVE' | 'REJECT' };
      collaborationWorkspace = {
        ...collaborationWorkspace,
        revision: collaborationWorkspace.revision + 1,
        reviewStages: collaborationWorkspace.reviewStages.map((stage) =>
          stage.stageId === stageId
            ? {
                ...stage,
                state: body.decision === 'APPROVE' ? ('APPROVED' as const) : ('REJECTED' as const),
                revision: stage.revision + 1,
                evidenceFingerprint: 'a'.repeat(64),
                decidedBySubjectId: '1',
                decidedAt: '2026-09-17T03:01:00Z',
              }
            : stage
        ),
        updatedAt: '2026-09-17T03:01:00Z',
      };
      return success(route, collaborationWorkspace);
    }
    if (path.endsWith(`/${ARTIFACT_ID}/workspace/comments`)) {
      if (request.method() === 'GET') return success(route, artifactComments);
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as {
          body: string;
          anchor: string | null;
        };
        const created = {
          ...artifactComment(options.locale ?? 'en'),
          commentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          authorSubjectId: 'current.user@company.com',
          authorDisplayName: options.locale === 'ko' ? '현재 사용자' : 'Current user',
          body: body.body,
          anchor: body.anchor,
          revision: 1,
          replies: [],
          createdAt: '2026-09-04T02:00:00Z',
          updatedAt: '2026-09-04T02:00:00Z',
        };
        artifactComments = [...artifactComments, created];
        probe.artifactCommentMutations += 1;
        return success(route, created, 201);
      }
    }
    const commentReplyMatch = path.match(
      new RegExp(`/${ARTIFACT_ID}/workspace/comments/([^/]+)/replies$`, 'u')
    );
    if (request.method() === 'POST' && commentReplyMatch) {
      const commentId = commentReplyMatch[1]!;
      const body = request.postDataJSON() as { body: string };
      artifactComments = artifactComments.map((comment) =>
        comment.commentId === commentId
          ? {
              ...comment,
              revision: comment.revision + 1,
              replies: [
                ...comment.replies,
                {
                  replyId: REPLY_ID,
                  commentId,
                  authorSubjectId: 'current.user@company.com',
                  authorDisplayName: options.locale === 'ko' ? '현재 사용자' : 'Current user',
                  body: body.body,
                  createdAt: '2026-09-04T02:01:00Z',
                },
              ],
              updatedAt: '2026-09-04T02:01:00Z',
            }
          : comment
      );
      probe.artifactCommentMutations += 1;
      return success(
        route,
        artifactComments.find((comment) => comment.commentId === commentId)
      );
    }
    const commentResolveMatch = path.match(
      new RegExp(`/${ARTIFACT_ID}/workspace/comments/([^/]+)/resolve$`, 'u')
    );
    if (request.method() === 'POST' && commentResolveMatch) {
      const commentId = commentResolveMatch[1]!;
      artifactComments = artifactComments.map((comment) =>
        comment.commentId === commentId
          ? {
              ...comment,
              state: 'RESOLVED',
              revision: comment.revision + 1,
              updatedAt: '2026-09-04T02:02:00Z',
              resolvedAt: '2026-09-04T02:02:00Z',
            }
          : comment
      );
      probe.artifactCommentMutations += 1;
      return success(
        route,
        artifactComments.find((comment) => comment.commentId === commentId)
      );
    }
    return route.fulfill({
      status: 501,
      json: { detail: 'Artifact collaboration command is not mocked.' },
    });
  });

  return probe;
}

export type DwaionRoutineConflictProbe = {
  writes: Array<{
    method: string;
    path: string;
    expectedRevision: number | null;
    commandId: string | null;
  }>;
  routines: () => readonly Record<string, unknown>[];
};

type RoutineFixture = typeof routine;
type RoutineVersionFixture = ReturnType<typeof routineVersions>[number];
type RoutineMutationBody = {
  expectedRevision?: unknown;
  commandId?: unknown;
  definition?: unknown;
  scope?: unknown;
  consentState?: unknown;
};

export async function mockDwaionRoutineConflictRuntime(
  page: Page,
  options: {
    locale?: 'en' | 'ko';
    failConsentAttempt?: number;
  } = {}
): Promise<DwaionRoutineConflictProbe> {
  const locale = options.locale ?? 'ko';
  const writes: DwaionRoutineConflictProbe['writes'] = [];
  const original: RoutineFixture = structuredClone(routine);
  if (locale === 'ko') {
    original.definition.name = '아침 우선순위 검토';
    original.definition.objective = '업무를 시작하기 전 마감 업무와 일정 참조 범위를 검증합니다.';
    original.definition.locale = 'ko';
  }
  const routines = new Map<string, RoutineFixture>([[ROUTINE_ID, original]]);
  const ledgers = new Map<string, RoutineVersionFixture[]>([
    [ROUTINE_ID, structuredClone(routineVersions(original))],
  ]);
  let conflictArmed = true;
  let consentAttempts = 0;
  let forkSequence = 0;

  const recordVersion = (current: RoutineFixture, commandId: string, commandType: string) => {
    const entry: RoutineVersionFixture = {
      commandId,
      commandType,
      revision: current.revision,
      snapshot: structuredClone(current),
      createdAt: current.updatedAt,
      integrityFingerprint: Number(current.revision).toString(16).slice(-1).repeat(64),
      rollbackTargetRevision: null,
      rollbackTargetFingerprint: null,
    };
    ledgers.set(
      current.routineId,
      [entry, ...(ledgers.get(current.routineId) ?? [])].sort(
        (left, right) => Number(right.revision) - Number(left.revision)
      )
    );
  };

  await page.route('**/api/agent/v1/routines**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method === 'GET' && path.endsWith('/routines/capabilities')) {
      return success(route, routineRuntimeCapabilities());
    }
    if (method === 'GET' && path.endsWith('/advanced-commands')) {
      return success(route, []);
    }
    if (method === 'GET' && path === '/api/agent/v1/routines') {
      return success(route, [...routines.values()]);
    }

    const segments = path.split('/').filter(Boolean);
    const routineIndex = segments.indexOf('routines');
    const routineId = routineIndex >= 0 ? segments[routineIndex + 1] : undefined;
    const suffix = routineIndex >= 0 ? segments.slice(routineIndex + 2) : [];
    if (method === 'GET' && routineId && suffix.length === 0) {
      const current = routines.get(routineId);
      return current
        ? success(route, current)
        : route.fulfill({ status: 404, json: { detail: 'Routine not found.' } });
    }
    if (method === 'GET' && routineId && suffix.join('/') === 'versions') {
      return success(route, ledgers.get(routineId) ?? []);
    }
    if (method === 'GET' && routineId && suffix.join('/') === 'runs') {
      return success(route, []);
    }
    if (method === 'GET' && routineId && suffix.join('/') === 'health') {
      const current = routines.get(routineId);
      if (!current) return route.fulfill({ status: 404, json: { detail: 'Routine not found.' } });
      const allConsentsEnabled = Object.values(current.consents).every(
        (state) => state === 'ENABLED'
      );
      return success(route, {
        routineId,
        routineRevision: current.revision,
        state: allConsentsEnabled ? 'HEALTHY' : 'BLOCKED',
        workerAvailable: true,
        scheduleCurrent: true,
        allConsentsEnabled,
        latestRunId: null,
        latestRunState: null,
        latestRunAt: null,
        recoveryHints: allConsentsEnabled ? [] : ['Complete the governed consent chain.'],
        checkedAt: '2026-09-17T03:04:00Z',
      });
    }

    const body = (request.postDataJSON() ?? {}) as RoutineMutationBody;
    const expectedRevision =
      typeof body.expectedRevision === 'number' && Number.isInteger(body.expectedRevision)
        ? body.expectedRevision
        : null;
    const commandId =
      typeof body.commandId === 'string' ? body.commandId : 'fefefefe-fefe-4efe-8efe-fefefefefefe';
    if (method === 'PUT' && routineId && suffix.length === 0) {
      writes.push({
        method,
        path,
        expectedRevision,
        commandId,
      });
      const current = routines.get(routineId);
      if (!current) return route.fulfill({ status: 404, json: { detail: 'Routine not found.' } });
      if (conflictArmed && routineId === ROUTINE_ID) {
        conflictArmed = false;
        const serverLatest = {
          ...current,
          revision: current.revision + 1,
          definition: {
            ...current.definition,
            name:
              locale === 'ko'
                ? '아침 우선순위 검토 · 서버 정본'
                : 'Morning priority review · server canonical',
            localTime: '09:30:00',
            budget: { ...current.definition.budget, maximumRunsPerMonth: 24 },
          },
          updatedAt: '2026-09-17T03:01:00Z',
        };
        routines.set(routineId, serverLatest);
        recordVersion(serverLatest, 'abababab-abab-4bab-8bab-abababababab', 'REMOTE_UPDATE');
        return route.fulfill({ status: 409, json: { detail: 'Revision conflict.' } });
      }
      if (expectedRevision !== current.revision) {
        return route.fulfill({ status: 409, json: { detail: 'Revision conflict.' } });
      }
      const updated = {
        ...current,
        revision: current.revision + 1,
        definition: structuredClone(body.definition) as RoutineFixture['definition'],
        updatedAt: '2026-09-17T03:02:00Z',
      };
      routines.set(routineId, updated);
      recordVersion(updated, commandId, 'UPDATE');
      return success(route, updated);
    }
    if (method === 'POST' && path === '/api/agent/v1/routines') {
      writes.push({
        method,
        path,
        expectedRevision,
        commandId,
      });
      forkSequence += 1;
      const newRoutineId = `eeeeeeee-eeee-4eee-8eee-${String(forkSequence).padStart(12, '0')}`;
      const created = {
        ...structuredClone(original),
        routineId: newRoutineId,
        lifecycleState: 'DRAFT',
        consentState: 'UNSET',
        executionMode: 'DRY_RUN_ONLY',
        revision: 1,
        definition: structuredClone(body.definition) as RoutineFixture['definition'],
        consents: {
          sourceAccess: 'UNSET',
          analysis: 'UNSET',
          proposalDelivery: 'UNSET',
        },
        createdAt: '2026-09-17T03:02:00Z',
        updatedAt: '2026-09-17T03:02:00Z',
      };
      routines.set(newRoutineId, created);
      ledgers.set(newRoutineId, []);
      recordVersion(created, commandId, 'CREATE');
      return success(route, created);
    }
    if (method === 'POST' && routineId && suffix.join('/') === 'consent') {
      consentAttempts += 1;
      writes.push({
        method,
        path,
        expectedRevision,
        commandId,
      });
      const current = routines.get(routineId);
      if (!current) return route.fulfill({ status: 404, json: { detail: 'Routine not found.' } });
      if (expectedRevision !== current.revision) {
        return route.fulfill({ status: 409, json: { detail: 'Revision conflict.' } });
      }
      if (options.failConsentAttempt === consentAttempts) {
        return route.fulfill({ status: 409, json: { detail: 'Consent revision conflict.' } });
      }
      const consentField: keyof RoutineFixture['consents'] =
        body.scope === 'SOURCE_ACCESS'
          ? 'sourceAccess'
          : body.scope === 'ANALYSIS'
            ? 'analysis'
            : 'proposalDelivery';
      const updated = {
        ...current,
        revision: current.revision + 1,
        consentState: body.consentState === 'ENABLED' ? current.consentState : 'UNSET',
        consents: {
          ...current.consents,
          [consentField]:
            body.consentState === 'ENABLED' || body.consentState === 'DISABLED'
              ? body.consentState
              : 'UNSET',
        },
        updatedAt: '2026-09-17T03:03:00Z',
      };
      updated.consentState = Object.values(updated.consents).every((state) => state === 'ENABLED')
        ? 'ENABLED'
        : 'UNSET';
      routines.set(routineId, updated);
      recordVersion(updated, commandId, 'CONSENT');
      return success(route, updated);
    }
    return route.fulfill({
      status: 501,
      json: { detail: `Routine conflict fixture does not handle ${method} ${path}.` },
    });
  });

  return { writes, routines: () => [...routines.values()].map((item) => structuredClone(item)) };
}

export type DwaionRoutineRecoveryProbe = {
  commands: Array<{
    action: string | null;
    commandId: string | null;
    expectedRevision: number | null;
  }>;
};

export async function mockDwaionRoutineRecoveryRuntime(
  page: Page,
  options: { locale?: 'en' | 'ko'; rejectFirstCommand?: boolean } = {}
): Promise<DwaionRoutineRecoveryProbe> {
  const locale = options.locale ?? 'ko';
  const commands: DwaionRoutineRecoveryProbe['commands'] = [];
  const recoveryRoutine: RoutineFixture = structuredClone(routine);
  if (locale === 'ko') {
    recoveryRoutine.definition.name = '아침 우선순위 검토';
    recoveryRoutine.definition.objective =
      '업무를 시작하기 전 마감 업무와 일정 참조 범위를 검증합니다.';
    recoveryRoutine.definition.locale = 'ko';
  }
  const partialRun = {
    ...routineRun(),
    state: 'PARTIAL',
    version: 5,
    completedAt: '2026-09-17T04:01:00Z',
    evidenceCount: 4,
    proposalsCreated: 1,
    approvalGatedActionsCreated: 1,
    tokensUsed: 2240,
    elapsedMs: 6100,
    notificationState: 'FAILED',
    safeErrorCode: 'PROVIDER_ITEM_QUARANTINED',
    recoveryHint:
      locale === 'ko'
        ? '격리 증거를 확인한 뒤 검증된 항목만 계속 처리하거나 안전 취소 및 롤백하세요.'
        : 'Review quarantine evidence, then continue with verified items or cancel and roll back safely.',
    recoveryAction: null,
    recoveryCommandId: null,
    compensationRequired: true,
    receipt: null,
    updatedAt: '2026-09-17T04:01:00Z',
  };
  let currentRun: Record<string, unknown> = partialRun;

  await page.route('**/api/agent/v1/routines**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method === 'GET' && path.endsWith('/routines/capabilities')) {
      return success(route, routineRuntimeCapabilities());
    }
    if (method === 'GET' && path.endsWith('/advanced-commands')) {
      return success(route, []);
    }
    if (method === 'GET' && path === '/api/agent/v1/routines') {
      return success(route, [recoveryRoutine]);
    }
    if (method === 'GET' && path === `/api/agent/v1/routines/${ROUTINE_ID}`) {
      return success(route, recoveryRoutine);
    }
    if (method === 'GET' && path === `/api/agent/v1/routines/${ROUTINE_ID}/runs`) {
      if (currentRun.state === 'QUEUED') {
        const recoveryCommandId = String(currentRun.recoveryCommandId);
        currentRun = {
          ...currentRun,
          state: 'COMPLETED',
          version: 7,
          completedAt: '2026-09-17T04:02:05Z',
          evidenceCount: 4,
          proposalsCreated: 2,
          approvalGatedActionsCreated: 1,
          tokensUsed: 2630,
          elapsedMs: 8800,
          notificationState: 'DELIVERED',
          compensationRequired: false,
          receipt: {
            receiptId: '56565656-5656-4656-8656-565656565656',
            routineRunId: ROUTINE_RUN_ID,
            routineId: ROUTINE_ID,
            routineRevision: recoveryRoutine.revision,
            terminalState: 'COMPLETED',
            providerReceiptId: 'provider-routine-recovery-0917',
            resultSha256: '6'.repeat(64),
            evidenceCount: 4,
            proposalsCreated: 2,
            approvalGatedActionsCreated: 1,
            externalWritesPerformed: 0,
            notificationState: 'DELIVERED',
            authorizationDecisionRevision: 12,
            authorizedSources: ['WORK_ITEM', 'MAIL'],
            recoveryAction: 'SKIP_QUARANTINED_AND_CONTINUE',
            recoveryCommandId,
            completedAt: '2026-09-17T04:02:05Z',
          },
          updatedAt: '2026-09-17T04:02:05Z',
        };
      }
      return success(route, [currentRun]);
    }
    if (method === 'GET' && path === `/api/agent/v1/routines/${ROUTINE_ID}/versions`) {
      return success(route, routineVersions(recoveryRoutine));
    }
    if (method === 'GET' && path === `/api/agent/v1/routines/${ROUTINE_ID}/health`) {
      return success(route, {
        ...routineHealth(),
        state: currentRun.state === 'PARTIAL' ? 'DEGRADED' : 'HEALTHY',
        latestRunState: currentRun.state,
        latestRunAt: currentRun.updatedAt,
        recoveryHints:
          currentRun.state === 'PARTIAL'
            ? ['Review provider quarantine evidence before choosing a recovery action.']
            : [],
        checkedAt: '2026-09-17T04:02:06Z',
      });
    }
    if (
      method === 'POST' &&
      path === `/api/agent/v1/routines/${ROUTINE_ID}/runs/${ROUTINE_RUN_ID}/commands`
    ) {
      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      const command = {
        action: typeof body.action === 'string' ? body.action : null,
        commandId: typeof body.commandId === 'string' ? body.commandId : null,
        expectedRevision: typeof body.expectedRevision === 'number' ? body.expectedRevision : null,
      };
      commands.push(command);
      if (options.rejectFirstCommand && commands.length === 1) {
        return route.fulfill({
          status: 409,
          json: {
            detail: 'Verified provider receipt envelope changed. Refresh and retry recovery.',
          },
        });
      }
      if (
        command.action !== 'SKIP_QUARANTINED_AND_CONTINUE' ||
        command.expectedRevision !== 5 ||
        !command.commandId
      ) {
        return route.fulfill({ status: 409, json: { detail: 'Recovery command is stale.' } });
      }
      currentRun = {
        ...partialRun,
        state: 'QUEUED',
        version: 6,
        completedAt: null,
        safeErrorCode: null,
        recoveryHint: null,
        recoveryAction: 'SKIP_QUARANTINED_AND_CONTINUE',
        recoveryCommandId: command.commandId,
        compensationRequired: false,
        updatedAt: '2026-09-17T04:02:00Z',
      };
      return success(route, currentRun);
    }
    return route.fallback();
  });

  return { commands };
}
