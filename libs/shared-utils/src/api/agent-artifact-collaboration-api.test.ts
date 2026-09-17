import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createDwaionTeamArtifactComment,
  createDwaionTeamArtifactAccessRequest,
  getDwaionTeamArtifactComments,
  replyDwaionTeamArtifactComment,
  resolveDwaionTeamArtifactComment,
  resolveDwaionTeamArtifactConflict,
  runDwaionTeamArtifactPreflight,
} from './agent-artifact-collaboration-api';
import {
  parseDwaionTeamArtifactAccessRequest,
  parseDwaionTeamArtifactCapabilities,
  parseDwaionTeamArtifactComment,
  parseDwaionTeamArtifactPreflight,
  parseDwaionTeamArtifactShare,
  parseDwaionTeamArtifactWorkspace,
} from './agent-artifact-collaboration-parser';

const ARTIFACT_ID = '00000000-0000-4000-8000-000000000401';
const TEAM_ID = '00000000-0000-4000-8000-000000000402';
const PREFLIGHT_ID = '00000000-0000-4000-8000-000000000403';
const WORKSPACE_ID = '00000000-0000-4000-8000-000000000404';
const CONFLICT_ID = '00000000-0000-4000-8000-000000000405';
const COMMENT_ID = '00000000-0000-4000-8000-000000000406';

const allowedMember = {
  subjectId: 'owner@company.com',
  role: 'OWNER',
  allowed: true,
  deniedSourceCount: 0,
  reasonCode: null,
} as const;
const content = {
  title: 'Governed team artifact',
  body: 'Reviewed body',
  format: 'MARKDOWN',
} as const;

function preflight(state: 'READY' | 'PARTIAL' | 'PERMISSION_DENIED' = 'READY') {
  const denied = {
    subjectId: 'blocked@company.com',
    role: 'VIEWER',
    allowed: false,
    deniedSourceCount: 1,
    reasonCode: 'SOURCE_ACCESS_DENIED',
  } as const;
  return {
    preflightId: PREFLIGHT_ID,
    artifactId: ARTIFACT_ID,
    teamId: TEAM_ID,
    artifactRevision: 7,
    state,
    decisionRevision: 11,
    members: state === 'PERMISSION_DENIED' ? [allowedMember, denied] : [allowedMember],
    allowedSourceCount: 2,
    excludedSourceCount: state === 'PARTIAL' ? 1 : 0,
    evidenceSha256: 'a'.repeat(64),
    expiresAt: '2099-09-18T00:00:00Z',
    createdAt: '2026-09-17T00:00:00Z',
  };
}

function conflict() {
  return {
    conflictId: CONFLICT_ID,
    workspaceId: WORKSPACE_ID,
    baseRevision: 3,
    serverRevision: 4,
    state: 'OPEN',
    localContent: { ...content, body: 'Local change' },
    serverContent: { ...content, body: 'Server change' },
    localSha256: 'b'.repeat(64),
    serverSha256: 'c'.repeat(64),
    createdAt: '2026-09-17T00:01:00Z',
    resolvedAt: null,
  } as const;
}

function workspace(openConflict: ReturnType<typeof conflict> | null = null) {
  return {
    workspaceId: WORKSPACE_ID,
    artifactId: ARTIFACT_ID,
    teamId: TEAM_ID,
    state: 'ACTIVE',
    revision: 4,
    content,
    contentSha256: 'd'.repeat(64),
    members: [allowedMember],
    openConflict,
    shares: [],
    reviewStages: [
      {
        stageId: '00000000-0000-4000-8000-000000000411',
        stageOrder: 1,
        stageKey: 'AUTHOR',
        assigneeSubjectId: 'owner@company.com',
        state: 'APPROVED',
        revision: 1,
        evidenceFingerprint: '1'.repeat(64),
        decidedBySubjectId: 'owner@company.com',
        decidedAt: '2026-09-17T00:00:30Z',
      },
    ],
    governanceGates: [
      ...(['DLP', 'CITATION', 'RECIPIENT_ACL', 'IMMUTABLE_VERSION'] as const).map((key) => ({
        key,
        state: 'PASS',
        detailCode: `${key}_VERIFIED`,
        evidenceReference: `evidence:${key}`,
        evidenceFingerprint: '2'.repeat(64),
        evaluatedAt: '2026-09-17T00:01:00Z',
      })),
    ],
    signatureEvidence: {
      capability: unavailableCapability('ARTIFACT_SIGNED_WORM_RECEIPT_NOT_CONFIGURED'),
      provider: null,
      keyReferenceFingerprint: null,
      signature: null,
      signedAt: null,
    },
    reviewSlaDueAt: '2026-09-18T00:00:00Z',
    createdAt: '2026-09-17T00:00:00Z',
    updatedAt: '2026-09-17T00:02:00Z',
  } as const;
}

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

describe('DWAI.ON artifact collaboration contract', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('accepts the four honest provider states and requires fail-closed recovery evidence', () => {
    const available = {
      teamWorkspaceAvailable: true,
      aclPreflightAvailable: true,
      accessRequestAvailable: true,
      collaborationAvailable: true,
      conflictResolutionAvailable: true,
      internalSharingAvailable: true,
      externalSharingAvailable: false,
      shareExpiryAvailable: true,
      shareRevocationAvailable: true,
      inlineComments: {
        available: true,
        configured: true,
        reasonCode: null,
        recoveryHint: null,
      },
      stagedReview: {
        available: true,
        configured: true,
        reasonCode: null,
        recoveryHint: null,
      },
      signedWormReceipt: unavailableCapability('ARTIFACT_SIGNED_WORM_RECEIPT_NOT_CONFIGURED'),
      automaticMasking: unavailableCapability('AUTOMATIC_MASKING_NOT_CONFIGURED'),
      syntheticReplacement: unavailableCapability('SYNTHETIC_REPLACEMENT_NOT_CONFIGURED'),
      reviewNotification: unavailableCapability('REVIEW_NOTIFICATION_NOT_CONFIGURED'),
      reviewRejection: {
        available: true,
        configured: true,
        reasonCode: null,
        recoveryHint: null,
      },
      providerState: 'AVAILABLE',
      recoveryHint: null,
    };
    expect(parseDwaionTeamArtifactCapabilities(available).providerState).toBe('AVAILABLE');
    for (const providerState of [
      'NOT_CONFIGURED',
      'DATABASE_NOT_CONFIGURED',
      'SECURITY_NOT_CONFIGURED',
    ]) {
      expect(
        parseDwaionTeamArtifactCapabilities({
          ...available,
          ...Object.fromEntries(
            Object.keys(available)
              .filter((key) => key.endsWith('Available'))
              .map((key) => [key, false])
          ),
          inlineComments: unavailableCapability('INLINE_COMMENTS_NOT_CONFIGURED'),
          stagedReview: unavailableCapability('ARTIFACT_STAGED_REVIEW_NOT_CONFIGURED'),
          reviewRejection: unavailableCapability('REVIEW_REJECTION_NOT_CONFIGURED'),
          providerState,
          recoveryHint: 'Configure the governed collaboration dependency.',
        }).providerState
      ).toBe(providerState);
    }
    expect(() =>
      parseDwaionTeamArtifactCapabilities({
        ...available,
        providerState: 'DATABASE_NOT_CONFIGURED',
        recoveryHint: null,
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionTeamArtifactCapabilities({ ...available, automaticMasking: undefined })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(
      parseDwaionTeamArtifactCapabilities({
        ...available,
        automaticMasking: {
          available: true,
          configured: true,
          reasonCode: null,
          recoveryHint: null,
        },
        syntheticReplacement: {
          available: true,
          configured: true,
          reasonCode: null,
          recoveryHint: null,
        },
        reviewNotification: {
          available: true,
          configured: true,
          reasonCode: null,
          recoveryHint: null,
        },
      })
    ).toMatchObject({
      automaticMasking: { available: true },
      syntheticReplacement: { available: true },
      reviewNotification: { available: true },
    });
  });

  it('binds access requests to the denied preflight and preserves caller retry identity', async () => {
    const accessRequest = {
      accessRequestId: '00000000-0000-4000-8000-000000000409',
      artifactId: ARTIFACT_ID,
      teamId: TEAM_ID,
      preflightId: PREFLIGHT_ID,
      state: 'PENDING',
      deniedSubjectCount: 1,
      deniedSourceCount: 1,
      submissionEvidenceSha256: 'f'.repeat(64),
      createdAt: '2026-09-17T00:03:00Z',
    } as const;
    expect(parseDwaionTeamArtifactAccessRequest(accessRequest).state).toBe('PENDING');
    expect(() =>
      parseDwaionTeamArtifactAccessRequest({
        ...accessRequest,
        deniedSubjectCount: 0,
        deniedSourceCount: 0,
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValue(response({ success: true, data: accessRequest }, 202));
    vi.stubGlobal('fetch', fetchMock);
    const command = {
      commandId: '00000000-0000-4000-8000-000000000410',
      expectedRevision: 7,
      reasonCode: 'USER_REQUESTED_ARTIFACT_ACCESS',
      changeReason: 'The user reviewed the denied subjects and requested access.',
    } as const;
    await createDwaionTeamArtifactAccessRequest(ARTIFACT_ID, TEAM_ID, PREFLIGHT_ID, command);
    await createDwaionTeamArtifactAccessRequest(ARTIFACT_ID, TEAM_ID, PREFLIGHT_ID, command);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/agent/v1/artifact-collaboration/${ARTIFACT_ID}/access-requests`,
      expect.objectContaining({ body: expect.stringContaining(command.commandId) })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/agent/v1/artifact-collaboration/${ARTIFACT_ID}/access-requests`,
      expect.objectContaining({ body: expect.stringContaining(command.commandId) })
    );
  });

  it('enforces ready, partial, and permission-denied preflight semantics', () => {
    expect(parseDwaionTeamArtifactPreflight(preflight()).state).toBe('READY');
    expect(parseDwaionTeamArtifactPreflight(preflight('PARTIAL')).state).toBe('PARTIAL');
    expect(parseDwaionTeamArtifactPreflight(preflight('PERMISSION_DENIED')).members).toHaveLength(
      2
    );
    expect(() =>
      parseDwaionTeamArtifactPreflight({ ...preflight(), excludedSourceCount: 1 })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionTeamArtifactPreflight({
        ...preflight('PERMISSION_DENIED'),
        members: [allowedMember],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });

  it('requires exactly one allowed owner and bound open-conflict evidence', () => {
    expect(parseDwaionTeamArtifactWorkspace(workspace(conflict())).openConflict?.state).toBe(
      'OPEN'
    );
    expect(() =>
      parseDwaionTeamArtifactWorkspace({
        ...workspace(),
        members: [{ ...allowedMember, role: 'EDITOR' }],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionTeamArtifactWorkspace({
        ...workspace(conflict()),
        openConflict: { ...conflict(), workspaceId: ARTIFACT_ID },
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });

  it('requires expiry and sealed revocation receipts for shares', () => {
    const share = {
      shareId: '00000000-0000-4000-8000-000000000406',
      workspaceId: WORKSPACE_ID,
      state: 'ACTIVE',
      permission: 'COMMENT',
      memberCount: 2,
      expiresAt: '2026-09-19T00:00:00Z',
      revokedAt: null,
      receiptId: '00000000-0000-4000-8000-000000000407',
      receiptSha256: 'e'.repeat(64),
      revocationReceiptId: null,
      revocationReceiptSha256: null,
      createdAt: '2026-09-17T00:00:00Z',
    } as const;
    expect(parseDwaionTeamArtifactShare(share).state).toBe('ACTIVE');
    expect(() =>
      parseDwaionTeamArtifactShare({ ...share, expiresAt: share.createdAt })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() => parseDwaionTeamArtifactShare({ ...share, state: 'REVOKED' })).toThrowError(
      expect.objectContaining({ status: 502 })
    );
  });

  it('parses bound comments and sends create, reply, and resolve commands with revisions', async () => {
    const comment = {
      commentId: COMMENT_ID,
      workspaceId: WORKSPACE_ID,
      artifactId: ARTIFACT_ID,
      authorSubjectId: 'reviewer@company.com',
      authorDisplayName: 'Review Owner',
      body: 'Please verify the exchange-rate assumption.',
      anchor: '3. Exchange-rate sensitivity',
      state: 'OPEN',
      revision: 2,
      replies: [],
      createdAt: '2026-09-17T00:00:00Z',
      updatedAt: '2026-09-17T00:01:00Z',
      resolvedAt: null,
    } as const;
    expect(parseDwaionTeamArtifactComment(comment).state).toBe('OPEN');
    expect(() => parseDwaionTeamArtifactComment({ ...comment, state: 'RESOLVED' })).toThrowError(
      expect.objectContaining({ status: 502 })
    );

    const resolved = {
      ...comment,
      state: 'RESOLVED',
      revision: 4,
      resolvedAt: '2026-09-17T00:04:00Z',
      updatedAt: '2026-09-17T00:04:00Z',
    } as const;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ success: true, data: [comment] }))
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: comment }, 201))
      .mockResolvedValueOnce(response({ success: true, data: { ...comment, revision: 3 } }, 201))
      .mockResolvedValueOnce(response({ success: true, data: resolved }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDwaionTeamArtifactComments(ARTIFACT_ID)).resolves.toHaveLength(1);
    await createDwaionTeamArtifactComment(ARTIFACT_ID, comment.body, comment.anchor, {
      commandId: '00000000-0000-4000-8000-000000000420',
      expectedRevision: 4,
      reasonCode: 'USER_CREATED_ARTIFACT_COMMENT',
    });
    await replyDwaionTeamArtifactComment(ARTIFACT_ID, COMMENT_ID, 'Confirmed by Finance.', {
      commandId: '00000000-0000-4000-8000-000000000421',
      expectedRevision: 2,
      reasonCode: 'USER_REPLIED_TO_ARTIFACT_COMMENT',
    });
    await resolveDwaionTeamArtifactComment(ARTIFACT_ID, COMMENT_ID, {
      commandId: '00000000-0000-4000-8000-000000000422',
      expectedRevision: 3,
      reasonCode: 'USER_RESOLVED_ARTIFACT_COMMENT',
      changeReason: 'The reviewer confirmed the assumption and closed the discussion.',
    });
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      `/api/agent/v1/artifact-collaboration/${ARTIFACT_ID}/workspace/comments`,
      '/api/auth/csrf',
      `/api/agent/v1/artifact-collaboration/${ARTIFACT_ID}/workspace/comments`,
      `/api/agent/v1/artifact-collaboration/${ARTIFACT_ID}/workspace/comments/${COMMENT_ID}/replies`,
      `/api/agent/v1/artifact-collaboration/${ARTIFACT_ID}/workspace/comments/${COMMENT_ID}/resolve`,
    ]);
    expect(JSON.parse(fetchMock.mock.calls[2]?.[1].body).expectedRevision).toBe(4);
    expect(JSON.parse(fetchMock.mock.calls[3]?.[1].body).expectedRevision).toBe(2);
    expect(JSON.parse(fetchMock.mock.calls[4]?.[1].body).expectedRevision).toBe(3);
  });

  it('keeps caller-owned identity for preflight retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValue(response({ success: true, data: preflight() }));
    vi.stubGlobal('fetch', fetchMock);
    const input = {
      commandId: '00000000-0000-4000-8000-000000000408',
      expectedRevision: 7,
      reasonCode: 'USER_REQUESTED_TEAM_PREFLIGHT',
      teamId: TEAM_ID,
      artifactRevision: 7,
      members: [{ subjectId: allowedMember.subjectId, role: allowedMember.role }],
      sources: [],
      excludeInaccessibleSources: false,
    } as const;
    await runDwaionTeamArtifactPreflight(ARTIFACT_ID, input);
    await runDwaionTeamArtifactPreflight(ARTIFACT_ID, input);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/agent/v1/artifact-collaboration/${ARTIFACT_ID}/preflights`,
      expect.objectContaining({ body: expect.stringContaining(input.commandId) })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/agent/v1/artifact-collaboration/${ARTIFACT_ID}/preflights`,
      expect.objectContaining({ body: expect.stringContaining(input.commandId) })
    );
  });

  it('sends all five explicit conflict recovery branches with reviewed content only for merge', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValue(response({ success: true, data: workspace() }));
    vi.stubGlobal('fetch', fetchMock);
    const resolutions = ['USE_LOCAL', 'USE_SERVER', 'MERGE', 'STASH', 'ROLLBACK'] as const;
    for (const [index, resolution] of resolutions.entries()) {
      await resolveDwaionTeamArtifactConflict(
        ARTIFACT_ID,
        CONFLICT_ID,
        resolution,
        resolution === 'MERGE' ? content : null,
        {
          commandId: `00000000-0000-4000-8000-00000000041${index}`,
          expectedRevision: 4,
          reasonCode: `USER_RESOLVED_ARTIFACT_${resolution}`,
          changeReason: 'The user reviewed both versions and selected recovery.',
        }
      );
    }
    const bodies = fetchMock.mock.calls.slice(1).map((call) => JSON.parse(call[1].body));
    expect(bodies.map((body) => body.resolution)).toEqual(resolutions);
    expect(bodies.find((body) => body.resolution === 'MERGE').mergedContent).toEqual(content);
    expect(
      bodies
        .filter((body) => body.resolution !== 'MERGE')
        .every((body) => body.mergedContent === null)
    ).toBe(true);
  });
});

function unavailableCapability(reasonCode: string) {
  return {
    available: false,
    configured: false,
    reasonCode,
    recoveryHint: 'Ask an administrator to configure this governed collaboration action.',
  };
}
