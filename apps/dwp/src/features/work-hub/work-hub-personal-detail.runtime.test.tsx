// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPersonalWorkTask,
  getPersonalWorkTimeline,
  updatePersonalWorkTask,
} from '@dwp-frontend/shared-utils/api/personal-work-api';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { WorkHubPersonalDetail } from './work-hub-personal-detail';
import { personalWorkToHub } from './work-hub-source-adapters';
import { personal, snapshot } from './work-hub.test-support';
import type { PersonalWorkTask } from '@dwp-frontend/shared-utils/api/personal-work-contracts';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@dwp-frontend/shared-utils/api/personal-work-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPersonalWorkTask: vi.fn(),
  getPersonalWorkTimeline: vi.fn(),
  updatePersonalWorkTask: vi.fn(),
}));

const original = personal({
  version: 4,
  checklist: [{ itemId: 'one', title: 'Review source material', completed: false }],
});
const concurrent: PersonalWorkTask = {
  ...original,
  version: 5,
  checklist: [
    ...original.checklist!,
    { itemId: 'two', title: 'A concurrent step', completed: false },
  ],
};
const otherTaskId = 'a4444444-4444-4444-8444-444444444444';
const detailKey = (task: PersonalWorkTask, owner = 'owner-a') => [
  'workspace',
  'work-hub',
  'personal-detail',
  task.taskId,
  task.version,
  owner,
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let host: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;
const button = (name: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) => element.textContent === name
  );
const checkbox = () => host.querySelector<HTMLInputElement>('input[type="checkbox"]');

async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

async function render(task: PersonalWorkTask, ownerFingerprint: string | null = 'owner-a') {
  const item = personalWorkToHub(task, true);
  await act(async () =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <WorkHubPersonalDetail
          item={item}
          ownerFingerprint={ownerFingerprint}
          canEdit
          preflight={async () => snapshot([item])}
          snapshot={snapshot([item])}
          onEdit={vi.fn()}
        />
      </QueryClientProvider>
    )
  );
  await settle();
}

async function makeDirty() {
  await render(original);
  await act(async () => checkbox()!.click());
  expect(checkbox()?.checked).toBe(true);
  expect(button('workHub.checklist.save')?.disabled).toBe(false);
}

describe('personal detail checklist refresh retention', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    vi.mocked(getPersonalWorkTask).mockResolvedValue(original);
    vi.mocked(getPersonalWorkTimeline).mockResolvedValue({
      items: [],
      page: 0,
      size: 100,
      totalElements: 0,
      hasMore: false,
    });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
  });

  it('keeps a dirty v4 draft mounted during v5 loading and requires explicit review before saving', async () => {
    await makeDirty();
    const loading = deferred<PersonalWorkTask>();
    vi.mocked(getPersonalWorkTask).mockReturnValue(loading.promise);
    await render(concurrent);
    expect(checkbox()?.checked).toBe(true);
    expect(checkbox()?.disabled).toBe(true);
    expect(button('workHub.checklist.save')?.disabled).toBe(true);
    expect(updatePersonalWorkTask).not.toHaveBeenCalled();

    vi.mocked(getPersonalWorkTask).mockResolvedValue(concurrent);
    await act(async () => loading.resolve(concurrent));
    await settle();
    expect(checkbox()?.checked).toBe(true);
    expect(host.textContent).toContain('workHub.checklist.latest');
    expect(host.textContent).toContain('A concurrent step');
    expect(button('workHub.checklist.save')?.disabled).toBe(true);
    await act(async () => button('workHub.checklist.save')!.click());
    expect(updatePersonalWorkTask).not.toHaveBeenCalled();
    await act(async () => button('workHub.checklist.replaceLatest')!.click());
    expect(updatePersonalWorkTask).not.toHaveBeenCalled();
    expect(button('workHub.checklist.save')?.disabled).toBe(false);

    const saved = {
      ...concurrent,
      version: 6,
      checklist: [{ ...original.checklist![0], completed: true }],
    };
    vi.mocked(updatePersonalWorkTask).mockImplementation(async () => {
      vi.mocked(getPersonalWorkTask).mockResolvedValue(saved);
      return saved;
    });
    await act(async () => button('workHub.checklist.save')!.click());
    await settle();
    expect(updatePersonalWorkTask).toHaveBeenCalledTimes(1);
    expect(updatePersonalWorkTask).toHaveBeenCalledWith(
      original.taskId,
      expect.objectContaining({ version: 5, checklist: saved.checklist }),
      expect.any(String),
      expect.any(AbortSignal)
    );
    expect(host.textContent).toContain('workHub.personal.checklistSaved');
  });

  it.each([new HttpError('Unavailable', 503), new Error('Network unavailable')])(
    'preserves the draft with disabled actions through a transient latest-detail failure: %s',
    async (error) => {
      await makeDirty();
      vi.mocked(getPersonalWorkTask).mockRejectedValue(error);
      await render(concurrent);
      expect(host.textContent).toContain('workHub.personal.unavailableTitle');
      expect(checkbox()?.checked).toBe(true);
      expect(checkbox()?.disabled).toBe(true);
      expect(button('workHub.checklist.save')?.disabled).toBe(true);
      expect(updatePersonalWorkTask).not.toHaveBeenCalled();

      vi.mocked(getPersonalWorkTask).mockResolvedValue(concurrent);
      await act(async () => button('workPage.retry')!.click());
      await settle();
      expect(checkbox()?.checked).toBe(true);
      expect(host.textContent).toContain('workHub.checklist.latest');
      expect(button('workHub.checklist.save')?.disabled).toBe(true);
      expect(updatePersonalWorkTask).not.toHaveBeenCalled();
    }
  );

  it.each([401, 403, 404, 409])(
    'removes retained content after HTTP %s and does not revive it on a later outage',
    async (status) => {
      await makeDirty();
      vi.mocked(getPersonalWorkTask).mockRejectedValue(new HttpError('Access changed', status));
      await render(concurrent);
      expect(checkbox()).toBeNull();
      expect(host.textContent).not.toContain('Review source material');
      vi.mocked(getPersonalWorkTask).mockRejectedValue(new HttpError('Unavailable', 503));
      await act(async () => button('workPage.retry')!.click());
      await settle();
      expect(checkbox()).toBeNull();
      expect(host.textContent).not.toContain('Review source material');
      expect(updatePersonalWorkTask).not.toHaveBeenCalled();
    }
  );

  it('does not revive cached query data after a denied refetch followed by a transient failure', async () => {
    await makeDirty();
    vi.mocked(getPersonalWorkTask).mockRejectedValue(new HttpError('Access changed', 403));
    await act(async () => queryClient.refetchQueries({ queryKey: detailKey(original) }));
    await settle();
    expect(checkbox()).toBeNull();
    vi.mocked(getPersonalWorkTask).mockRejectedValue(new HttpError('Unavailable', 503));
    await act(async () => button('workPage.retry')!.click());
    await settle();
    expect(checkbox()).toBeNull();
    expect(host.textContent).not.toContain('Review source material');
    expect(updatePersonalWorkTask).not.toHaveBeenCalled();
  });

  it.each(['owner', 'task', 'signed-out'] as const)(
    'never shows the old draft while a changed %s scope is loading',
    async (scope) => {
      await makeDirty();
      vi.mocked(getPersonalWorkTask).mockReturnValue(deferred<PersonalWorkTask>().promise);
      await render(
        scope === 'task' ? { ...original, taskId: otherTaskId } : original,
        scope === 'owner' ? 'owner-b' : scope === 'signed-out' ? null : 'owner-a'
      );
      expect(checkbox()).toBeNull();
      expect(host.textContent).not.toContain('Review source material');
      expect(updatePersonalWorkTask).not.toHaveBeenCalled();
    }
  );

  it.each(['owner', 'task'] as const)(
    'resets the dirty checklist for a changed %s even when its detail is already cached',
    async (scope) => {
      await makeDirty();
      const next = scope === 'task' ? { ...original, taskId: otherTaskId } : original;
      const owner = scope === 'owner' ? 'owner-b' : 'owner-a';
      queryClient.setQueryData(detailKey(next, owner), next);
      vi.mocked(getPersonalWorkTask).mockResolvedValue(next);
      await render(next, owner);
      expect(checkbox()?.checked).toBe(false);
      expect(button('workHub.checklist.save')).toBeUndefined();
      expect(host.textContent).not.toContain('workHub.checklist.latest');
      expect(updatePersonalWorkTask).not.toHaveBeenCalled();
    }
  );
});
