import { describe, expect, it, vi } from 'vitest';
import { launchWorkHubAssist, prepareWorkHubAssist } from './work-hub-assist';
import type { WorkHubItem } from './work-hub-contracts';

const verifiedAt = '2026-09-04T01:00:00Z';
const item: WorkHubItem = {
  key: 'PERSONAL_TASK:one:',
  reference: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'one' },
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
  it('uses a short lived launch reference and keeps source content out of URLs and navigation state', async () => {
    const createQuestionLaunch = vi
      .fn()
      .mockResolvedValue({ launchId: 'e31e4143-f786-4b41-82c9-37984c5e74a1' });
    const result = await launchWorkHubAssist(
      item,
      { expectedKey: item.key, expectedVersion: 3, question: '확인할 항목을 정리해 주세요.' },
      verifiedAt,
      { createQuestionLaunch },
      Date.parse(verifiedAt)
    );
    expect(result.route).toBe('/dwaion/new');
    expect(result.sourceChanged).toBe(false);
    expect(JSON.stringify(result)).not.toContain(item.title);
    const prompt = createQuestionLaunch.mock.calls[0]?.[0];
    expect(prompt).toContain(item.title);
    expect(prompt).toContain('원본 문서 전체를 읽거나 업무를 처리한 것으로 표현하지 마세요');
    expect(prompt).not.toContain(item.summary);
    expect(prepareWorkHubAssist(item, verifiedAt)).toMatchObject({
      key: item.key,
      version: 3,
      verifiedAt,
    });
  });

  it('requires renewed context review after selection, version or freshness changes', async () => {
    const createQuestionLaunch = vi.fn();
    const request = { expectedKey: item.key, expectedVersion: 2, question: '검토해 주세요' };
    await expect(
      launchWorkHubAssist(
        item,
        request,
        verifiedAt,
        { createQuestionLaunch },
        Date.parse(verifiedAt)
      )
    ).rejects.toThrow('changed');
    await expect(
      launchWorkHubAssist(
        item,
        { ...request, expectedVersion: 3 },
        verifiedAt,
        { createQuestionLaunch },
        Date.parse(verifiedAt) + 300_001
      )
    ).rejects.toThrow('Refresh');
    expect(createQuestionLaunch).not.toHaveBeenCalled();
  });
});
