import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  askWorkHubAssist,
  isWorkHubAssistSourceSystem,
  verifiedWorkAssistExcerpt,
  workHubAssistDisposition,
  workHubAssistDraft,
} from './work-hub-assist';
import type { WorkHubItem } from './work-hub-contracts';
import type { AskDwpResponse } from '@dwp-frontend/shared-utils/api/agent-runtime-api';
import { askDwpStream } from '@dwp-frontend/shared-utils/api/agent-runtime-api';

vi.mock('@dwp-frontend/shared-utils/api/agent-runtime-api', () => ({ askDwpStream: vi.fn() }));

const verifiedAt = '2026-09-04T01:00:00Z';
const item: WorkHubItem = {
  key: 'PERSONAL_TASK:b1111111-1111-4111-8111-111111111111:',
  reference: {
    sourceSystem: 'PERSONAL_TASK',
    sourceReference: 'b1111111-1111-4111-8111-111111111111',
  },
  sourceId: 'personal',
  title: '검토한 업무 제목',
  summary: '전체 원문을 임의로 전달하지 않음',
  lifecycle: 'OPEN',
  sourceStatus: 'OPEN',
  originSystem: 'PERSONAL_TASK',
  priority: 'NORMAL',
  dueAt: null,
  waitingFor: 'ME',
  sourceRoute: null,
  version: 3,
  updatedAt: verifiedAt,
  reason: null,
  dataClassification: 'INTERNAL',
  actions: [],
};

describe('selected work AI handoff', () => {
  beforeEach(() => {
    vi.mocked(askDwpStream)
      .mockReset()
      .mockResolvedValue({ state: 'COMPLETED' } as AskDwpResponse);
  });
  it.each(['PERSONAL_TASK', 'SERVICE_REQUEST', 'APPROVAL_TASK', 'APPROVAL_REQUEST'] as const)(
    'sends only the question and typed %s reference through the shared helper',
    async (sourceSystem) => {
      const current = {
        ...item,
        reference: {
          ...item.reference,
          sourceSystem,
          ...(sourceSystem === 'APPROVAL_TASK' ? { obligationKey: 'SECURITY_REVIEW' } : {}),
        },
      };
      const signal = new AbortController().signal;
      const progress = vi.fn();
      await askWorkHubAssist(
        current,
        { question: '응답 초안을 작성해 주세요', expectedKey: item.key, expectedVersion: 3 },
        verifiedAt,
        {
          locale: 'ko',
          route: '/work/action-required?work=private-key',
          signal,
          onProgress: progress,
        },
        undefined,
        Date.parse(verifiedAt)
      );
      const approval = sourceSystem === 'APPROVAL_TASK' || sourceSystem === 'APPROVAL_REQUEST';
      expect(askDwpStream).toHaveBeenCalledWith(
        expect.objectContaining({
          query: '응답 초안을 작성해 주세요',
          agentKey: approval ? 'DWP_APPROVAL_EXPERT' : 'DWP_ASSISTANT',
          sourceScopes: approval ? [sourceSystem] : ['WORK_ITEM'],
          pageContext: {
            appKey: approval
              ? 'APP.APPROVALS'
              : sourceSystem === 'SERVICE_REQUEST'
                ? 'APP.EMPLOYEE_SERVICES'
                : 'APP.WORK',
            route: '/work/action-required',
            surface: 'selected-work-assist',
            entityType: sourceSystem,
            entityRef: item.reference.sourceReference,
            selectedWork: { ...current.reference, expectedVersion: 3 },
          },
        }),
        expect.objectContaining({ signal, onProgress: progress })
      );
      const payload = JSON.stringify(vi.mocked(askDwpStream).mock.calls[0][0]);
      for (const excluded of [item.title, item.summary!, verifiedAt, 'private-key'])
        expect(payload).not.toContain(excluded);
    }
  );

  it('continues a verified conversation with the same selected work binding', async () => {
    const conversationId = 'cefaef98-4cf6-46ee-a057-984c5e9c6cc8';
    const current = {
      ...item,
      reference: {
        sourceSystem: 'APPROVAL_TASK',
        sourceReference: 'c1111111-1111-4111-8111-111111111111',
        obligationKey: 'SECURITY_REVIEW',
      },
    };
    await askWorkHubAssist(
      current,
      { question: '첫 질문입니다', expectedKey: item.key, expectedVersion: 3 },
      verifiedAt,
      { locale: 'ko', route: '/work/queue' },
      undefined,
      Date.parse(verifiedAt)
    );
    await askWorkHubAssist(
      current,
      { question: '후속 질문입니다', expectedKey: item.key, expectedVersion: 3 },
      verifiedAt,
      { locale: 'ko', route: '/work/queue', conversationId },
      undefined,
      Date.parse(verifiedAt)
    );
    expect(vi.mocked(askDwpStream).mock.calls[0][0]).not.toHaveProperty('conversationId');
    expect(vi.mocked(askDwpStream).mock.calls[1][0]).toMatchObject({
      conversationId,
      agentKey: 'DWP_APPROVAL_EXPERT',
      pageContext: {
        selectedWork: {
          sourceSystem: 'APPROVAL_TASK',
          sourceReference: current.reference.sourceReference,
          expectedVersion: 3,
          obligationKey: 'SECURITY_REVIEW',
        },
      },
    });
  });

  it('excludes stale, wrong-source, and wrong-version excerpts from the AI context', () => {
    const context = { workKey: item.key, sourceVersion: 3, excerpt: '원본 메모', verifiedAt };
    expect(verifiedWorkAssistExcerpt(item, context, Date.parse(verifiedAt))).toBe('원본 메모');
    expect(
      verifiedWorkAssistExcerpt(
        item,
        { ...context, workKey: 'another-work' },
        Date.parse(verifiedAt)
      )
    ).toBeNull();
    expect(
      verifiedWorkAssistExcerpt(item, { ...context, sourceVersion: 2 }, Date.parse(verifiedAt))
    ).toBeNull();
    expect(verifiedWorkAssistExcerpt(item, context, Date.parse(verifiedAt) + 300_001)).toBeNull();
  });

  it('produces only an editable service message draft from an allowed completed answer', () => {
    const service = {
      ...item,
      reference: { sourceSystem: 'SERVICE_REQUEST', sourceReference: 'req-1' },
      sourceStatus: 'AWAITING_REQUESTER',
    };
    const response = {
      state: 'COMPLETED',
      policy: { outcome: 'ALLOW', mutationAllowed: false },
    } as AskDwpResponse;
    const text = '프로젝트 지원을 위한 접속 목적입니다.';
    expect(workHubAssistDraft(service, response, text)).toEqual({
      workKey: item.key,
      sourceVersion: 3,
      message: text,
    });
    expect(workHubAssistDraft(item, response, text)).toBeNull();
    expect(workHubAssistDraft({ ...service, sourceStatus: 'CLOSED' }, response, text)).toBeNull();
    expect(workHubAssistDraft(service, { ...response, state: 'ABSTAINED' }, text)).toBeNull();
    expect(workHubAssistDraft(service, response, 'x'.repeat(2001))).toBeNull();
  });
  it('requires renewed context review after selection, version or freshness changes', async () => {
    const request = { expectedKey: item.key, expectedVersion: 2, question: '검토해 주세요' };
    await expect(
      askWorkHubAssist(
        item,
        request,
        verifiedAt,
        { locale: 'ko', route: '/work/queue' },
        undefined,
        Date.parse(verifiedAt)
      )
    ).rejects.toThrow('changed');
    await expect(
      askWorkHubAssist(
        item,
        { ...request, expectedVersion: 3 },
        verifiedAt,
        { locale: 'ko', route: '/work/queue' },
        undefined,
        Date.parse(verifiedAt) + 300_001
      )
    ).rejects.toThrow('Refresh');
    expect(askDwpStream).not.toHaveBeenCalled();
  });
  it.each(['WORKSPACE', 'LEGACY_PROJECTION', 'IDENTITY_GOVERNANCE', 'UNKNOWN_SOURCE'])(
    'rejects unsupported %s without a list snapshot fallback',
    async (sourceSystem) => {
      await expect(
        askWorkHubAssist(
          { ...item, reference: { ...item.reference, sourceSystem } },
          { expectedKey: item.key, expectedVersion: 3, question: '검토해 주세요' },
          verifiedAt,
          { locale: 'ko', route: '/work/queue' },
          undefined,
          Date.parse(verifiedAt)
        )
      ).rejects.toThrow('source work');
      expect(askDwpStream).not.toHaveBeenCalled();
    }
  );
  it('exposes only owner-backed source systems to the Work AI trigger', () => {
    for (const source of ['PERSONAL_TASK', 'SERVICE_REQUEST', 'APPROVAL_TASK', 'APPROVAL_REQUEST'])
      expect(isWorkHubAssistSourceSystem(source)).toBe(true);
    for (const source of ['WORKSPACE', 'LEGACY_PROJECTION', 'IDENTITY_GOVERNANCE', 'UNKNOWN'])
      expect(isWorkHubAssistSourceSystem(source)).toBe(false);
  });

  it.each([
    ['COMPLETED', 'ANSWER_OK', 'ANSWER'],
    ['ABSTAINED', 'SELECTED_WORK_FORBIDDEN', 'PURGE'],
    ['ABSTAINED', 'SELECTED_WORK_NOT_FOUND', 'PURGE'],
    ['ABSTAINED', 'SELECTED_WORK_STALE', 'REFRESH'],
    ['ABSTAINED', 'SELECTED_WORK_INVALID_SOURCE', 'REFRESH'],
    ['ABSTAINED', 'SELECTED_WORK_UNAVAILABLE', 'RETRY'],
    ['ABSTAINED', 'SELECTED_WORK_AUTHORIZATION_REQUIRED', 'RETRY'],
    ['ABSTAINED', 'SELECTED_WORK_RESTRICTED', 'RESTRICTED'],
    ['ABSTAINED', 'SELECTED_WORK_UNSUPPORTED', 'UNSUPPORTED'],
    ['ABSTAINED', 'OTHER_ABSTENTION', 'RETRY'],
    ['CONFIGURATION_REQUIRED', 'MODEL_CONFIGURATION_REQUIRED', 'RETRY'],
  ] as const)('maps %s/%s to %s recovery', (state, statusCode, disposition) => {
    expect(workHubAssistDisposition({ state, statusCode } as AskDwpResponse)).toBe(disposition);
  });
});
