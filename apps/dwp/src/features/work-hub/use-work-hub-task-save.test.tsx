// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { useWorkHubTaskSave } from './use-work-hub-task-save';
import { personal, snapshot } from './work-hub.test-support';
import type { createWorkHubController } from './work-hub-controller';

const state = vi.hoisted(() => ({
  owner: 'A' as string | null,
  params: new URLSearchParams('scope=all'),
  setParams: vi.fn(),
  latest: vi.fn(),
}));
vi.mock('./use-work-hub-operation-owner', () => ({ useWorkHubOperationOwner: () => state.owner }));
vi.mock('react-router-dom', () => ({ useSearchParams: () => [state.params, state.setParams] }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@dwp-frontend/design-system', () => ({
  mergeFilterSearchParams: (params: URLSearchParams, patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null) next.delete(key);
      else next.set(key, value);
    }
    return next;
  },
}));
vi.mock('@dwp-frontend/shared-utils/api/personal-work-api', () => ({
  getPersonalWorkTask: state.latest,
}));
let root: Root | undefined;
let host: HTMLDivElement;
let client: QueryClient;
let save: ReturnType<typeof useWorkHubTaskSave>;
let editing: ReturnType<typeof personal> | null;
const callbacks = {
  onTaskClosed: vi.fn(),
  onEditingTaskChange: vi.fn(),
  onPlanDraftChange: vi.fn(),
  onPlanError: vi.fn(),
  onFeedback: vi.fn(),
  onCreated: vi.fn(),
};
const controller = {
  capture: vi.fn(),
  savePersonalTask: vi.fn(),
  adopt: vi.fn(),
  select: vi.fn(),
  addToPlan: vi.fn(),
  savePlan: vi.fn(),
  state: () => ({ planDraft: [] }),
};
const input = { title: 'My work', description: null, priority: 'NORMAL' as const, dueAt: null };
function Harness() {
  save = useWorkHubTaskSave({
    controller: controller as unknown as ReturnType<typeof createWorkHubController>,
    snapshot: snapshot(),
    editingTask: editing,
    today: '2026-09-07',
    ...callbacks,
  });
  return null;
}
async function render() {
  await act(async () =>
    root!.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    )
  );
}
describe('Work task save lifecycle', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    state.owner = 'A';
    state.params = new URLSearchParams('scope=all');
    editing = null;
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    client.clear();
    host.remove();
  });
  it('does not navigate, close a dialog, or send a follow-up plan after identity changes', async () => {
    let finish!: (value: ReturnType<typeof personal>) => void;
    controller.capture.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    const result = save(input, { idempotencyKey: 'capture-1', addToTodayPlan: true }).catch(
      (error: Error) => error
    );
    state.owner = 'B';
    await render();
    await act(async () => finish(personal()));
    expect(await result).toMatchObject({ name: 'AbortError' });
    expect(controller.savePlan).not.toHaveBeenCalled();
    expect(state.setParams).not.toHaveBeenCalled();
    for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
  });
  it('does not publish a late create response after unmount', async () => {
    let finish!: (value: ReturnType<typeof personal>) => void;
    controller.capture.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    const result = save(input, { idempotencyKey: 'capture-1', addToTodayPlan: false }).catch(
      (error: Error) => error
    );
    await act(async () => root!.unmount());
    root = undefined;
    finish(personal());
    expect(await result).toMatchObject({ name: 'AbortError' });
    expect(callbacks.onCreated).not.toHaveBeenCalled();
    expect(state.setParams).not.toHaveBeenCalled();
  });
  it("drops a late 409 recovery read rather than repopulating another owner's cache", async () => {
    editing = personal();
    controller.savePersonalTask.mockRejectedValueOnce(new HttpError('Conflict', 409));
    let finish!: (value: ReturnType<typeof personal>) => void;
    state.latest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    const result = save(
      { ...input, version: 2 },
      { idempotencyKey: 'edit-1', addToTodayPlan: false }
    ).catch((error: Error) => error);
    await act(async () => {
      await Promise.resolve();
    });
    expect(state.latest).toHaveBeenCalledOnce();
    state.owner = 'B';
    await render();
    finish(personal({ version: 3 }));
    await result;
    expect(callbacks.onEditingTaskChange).not.toHaveBeenCalled();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
  it('locks duplicate submissions synchronously and preserves current URL refinements', async () => {
    let finish!: (value: ReturnType<typeof personal>) => void;
    controller.capture.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    const first = save(input, { idempotencyKey: 'capture-1', addToTodayPlan: false });
    await expect(
      save(input, { idempotencyKey: 'capture-1', addToTodayPlan: false })
    ).rejects.toMatchObject({ name: 'AbortError' });
    state.params = new URLSearchParams('query=new-filter');
    await render();
    await act(async () => {
      finish(personal());
      await first;
    });
    expect(controller.capture).toHaveBeenCalledOnce();
    expect(state.setParams.mock.calls[0][0].get('query')).toBe('new-filter');
    expect(callbacks.onTaskClosed).toHaveBeenCalledOnce();
  });
});
