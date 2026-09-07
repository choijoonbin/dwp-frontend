import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { loadWorkHub, workHubSourceReaders, type WorkHubSourceReaders } from './work-hub-loader';
import { workHubReferenceKey } from './work-hub-contracts';
import { hubItem, NOW, personal } from './work-hub.test-support';

const personalApi = vi.hoisted(() => ({ getPersonalWorkTasks: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/personal-work-api', () => personalApi);
beforeEach(() => vi.clearAllMocks());
function readers(): WorkHubSourceReaders {
  const reader = () => vi.fn().mockResolvedValue({ items: [] });
  return {
    workspace: reader(),
    'approval-inbox': reader(),
    'approval-completed': reader(),
    'approval-needs-info': reader(),
    services: reader(),
    personal: reader(),
  };
}
describe('Work Hub source aggregation', () => {
  it('does not read unrequested apps or mistake forbidden and failed sources for empty', async () => {
    const api = readers();
    api.workspace = vi.fn().mockResolvedValue({ items: [hubItem()] });
    api.services = vi.fn().mockRejectedValue(new HttpError('denied', 403));
    api.personal = vi.fn().mockRejectedValue(new Error('network'));
    const result = await loadWorkHub({
      enabledSources: ['workspace', 'services', 'personal'],
      readers: api,
      now: () => NOW,
    });
    expect(result.completeness).toBe('PARTIAL');
    expect(result.sources.find((source) => source.sourceId === 'services')?.state).toBe(
      'FORBIDDEN'
    );
    expect(result.sources.find((source) => source.sourceId === 'personal')?.state).toBe(
      'UNAVAILABLE'
    );
    expect(api['approval-inbox']).not.toHaveBeenCalled();
  });
  it('classifies an expired session as authorization loss so cached rows can be purged', async () => {
    const api = readers();
    api.workspace = vi.fn().mockRejectedValue(new HttpError('expired', 401));
    const result = await loadWorkHub({ enabledSources: ['workspace'], readers: api });
    expect(result.completeness).toBe('UNAVAILABLE');
    expect(result.sources.find((source) => source.sourceId === 'workspace')?.state).toBe(
      'FORBIDDEN'
    );
  });
  it('keeps bounded owner lists explicitly partial', async () => {
    const api = readers();
    api.services = vi.fn().mockResolvedValue({ items: [hubItem()], hasMore: true });
    expect((await loadWorkHub({ enabledSources: ['services'], readers: api })).completeness).toBe(
      'PARTIAL'
    );
  });
  it('deduplicates only exact obligation identity and prefers owner data over a projection version', async () => {
    const api = readers();
    api.workspace = vi
      .fn()
      .mockResolvedValue({ items: [hubItem({ key: 'same', sourceId: 'workspace', version: 99 })] });
    api['approval-inbox'] = vi.fn().mockResolvedValue({
      items: [
        hubItem({ key: 'same', sourceId: 'approval-inbox', version: 1, title: 'Owner' }),
        hubItem({ key: 'another-step', sourceId: 'approval-inbox' }),
      ],
    });
    const result = await loadWorkHub({
      enabledSources: ['workspace', 'approval-inbox'],
      readers: api,
    });
    expect(result.items).toHaveLength(2);
    expect(result.items.find((item) => item.key === 'same')?.title).toBe('Owner');
  });
  it('selects the newest owner row across approval readers without merging distinct obligations', async () => {
    const api = readers();
    const review = {
      sourceSystem: 'APPROVAL_TASK',
      sourceReference: 'approval-1',
      obligationKey: 'review',
    };
    const confirmation = { ...review, obligationKey: 'confirmation' };
    api['approval-inbox'] = vi.fn().mockResolvedValue({
      items: [
        hubItem({
          key: workHubReferenceKey(review),
          reference: review,
          sourceId: 'approval-inbox',
          title: 'Stale inbox row',
          version: 3,
        }),
        hubItem({
          key: workHubReferenceKey(confirmation),
          reference: confirmation,
          sourceId: 'approval-inbox',
          title: 'Separate confirmation obligation',
          version: 1,
        }),
      ],
    });
    api['approval-completed'] = vi.fn().mockResolvedValue({
      items: [
        hubItem({
          key: workHubReferenceKey(review),
          reference: review,
          sourceId: 'approval-completed',
          title: 'Current completed row',
          lifecycle: 'COMPLETED',
          version: 4,
        }),
      ],
    });

    const result = await loadWorkHub({
      enabledSources: ['approval-inbox', 'approval-completed'],
      readers: api,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.find((item) => item.key === workHubReferenceKey(review))).toMatchObject({
      sourceId: 'approval-completed',
      title: 'Current completed row',
      version: 4,
    });
    expect(result.items.find((item) => item.key === workHubReferenceKey(confirmation))?.title).toBe(
      'Separate confirmation obligation'
    );
  });
  it('loads the second personal page so the 101st item is selectable', async () => {
    personalApi.getPersonalWorkTasks
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, index) => personal({ taskId: `task-${index}` })),
        page: 0,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [personal({ taskId: 'task-100' })],
        page: 1,
        hasMore: false,
      })
      .mockResolvedValueOnce({ items: [], page: 0, hasMore: false });
    const result = await workHubSourceReaders.personal({ canUpdatePersonal: true });
    expect(result.items).toHaveLength(101);
    expect(result.items[100].reference.sourceReference).toBe('task-100');
    expect(result.hasMore).toBe(false);
  });
  it('does not loop or claim completeness when the server repeats a page', async () => {
    personalApi.getPersonalWorkTasks.mockResolvedValue({
      items: [personal()],
      page: 0,
      hasMore: true,
    });
    await expect(workHubSourceReaders.personal({ canUpdatePersonal: false })).rejects.toThrow(
      'pagination'
    );
  });
});
