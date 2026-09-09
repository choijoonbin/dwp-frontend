// @vitest-environment jsdom
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPersonalWorkTask,
  getPersonalWorkTimeline,
  transitionPersonalWorkTask,
} from '@dwp-frontend/shared-utils/api/personal-work-api';

import { WorkHubPersonalDetail } from './work-hub-personal-detail';
import { personalWorkToHub } from './work-hub-source-adapters';
import { personal, snapshot } from './work-hub.test-support';
import type { WorkHubSnapshot } from './work-hub-contracts';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@dwp-frontend/shared-utils/api/personal-work-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPersonalWorkTask: vi.fn(),
  getPersonalWorkTimeline: vi.fn(),
  transitionPersonalWorkTask: vi.fn(),
}));

const task = personal({ version: 4 });
const item = personalWorkToHub(task, true);
let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
let preflight: ReturnType<typeof vi.fn<() => Promise<WorkHubSnapshot | null>>>;
type EditHandler = ComponentProps<typeof WorkHubPersonalDetail>['onEdit'];
let onEdit: ReturnType<typeof vi.fn<EditHandler>>;
const region = () =>
  host.querySelector<HTMLElement>('[aria-label="workHub.keyboardShortcuts.personalRegion"]')!;

async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

async function render(props: Partial<ComponentProps<typeof WorkHubPersonalDetail>> = {}) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <WorkHubPersonalDetail
          item={item}
          ownerFingerprint="owner-a"
          canEdit
          preflight={preflight}
          snapshot={snapshot([item])}
          onEdit={onEdit}
          {...props}
        />
      </QueryClientProvider>
    )
  );
  await settle();
}

async function key(key: string, target = region()) {
  target.focus();
  await act(async () =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  );
  await settle();
}

describe('personal keyboard commands use the displayed identity and fresh command authority', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    vi.mocked(getPersonalWorkTask).mockResolvedValue(task);
    vi.mocked(getPersonalWorkTimeline).mockResolvedValue({
      items: [],
      page: 0,
      size: 100,
      totalElements: 0,
      hasMore: false,
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    preflight = vi.fn(async () => snapshot([item]));
    onEdit = vi.fn<EditHandler>();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it('E opens the same displayed task editor; C uses the existing fresh versioned complete command', async () => {
    const completed = {
      ...task,
      version: 5,
      status: 'COMPLETED' as const,
      completedAt: '2026-09-08T11:00:00Z',
      updatedAt: '2026-09-08T11:00:00Z',
    };
    vi.mocked(transitionPersonalWorkTask).mockImplementation(async () => {
      vi.mocked(getPersonalWorkTask).mockResolvedValue(completed);
      return completed;
    });
    await render();
    expect(region().getAttribute('tabindex')).toBe('0');
    expect(host.querySelector('[aria-keyshortcuts="E"]')).not.toBeNull();
    expect(host.querySelector('[aria-keyshortcuts="C"]')).not.toBeNull();
    await key('e');
    expect(onEdit).toHaveBeenCalledWith(task);
    expect(transitionPersonalWorkTask).not.toHaveBeenCalled();
    await key('c');
    expect(preflight).toHaveBeenCalledOnce();
    expect(transitionPersonalWorkTask).toHaveBeenCalledWith(
      task.taskId,
      'complete',
      { version: 4 },
      expect.any(String),
      expect.any(AbortSignal)
    );
    expect(host.textContent).toContain('workHub.personal.statusSaved');
  });

  it.each(['permission', 'wrong-detail', 'unavailable-source', 'archived'] as const)(
    'blocks %s commands without side effects',
    async (state) => {
      if (state === 'wrong-detail')
        vi.mocked(getPersonalWorkTask).mockResolvedValue({ ...task, version: 5 });
      if (state === 'archived')
        vi.mocked(getPersonalWorkTask).mockResolvedValue({ ...task, status: 'ARCHIVED' });
      const denied = {
        ...snapshot([item]),
        sources: [{ ...snapshot([item]).sources[0], state: 'UNAVAILABLE' as const }],
      };
      await render({
        canEdit: state !== 'permission' && state !== 'unavailable-source',
        snapshot: state === 'unavailable-source' ? denied : snapshot([item]),
      });
      await key('e');
      await key('c');
      expect(onEdit).not.toHaveBeenCalled();
      expect(preflight).not.toHaveBeenCalled();
      expect(transitionPersonalWorkTask).not.toHaveBeenCalled();
    }
  );

  it('fresh preflight rejects a version change even when the displayed command was available', async () => {
    preflight.mockResolvedValue(snapshot([personalWorkToHub({ ...task, version: 5 }, true)]));
    await render();
    await key('c');
    expect(preflight).toHaveBeenCalledOnce();
    expect(transitionPersonalWorkTask).not.toHaveBeenCalled();
    expect(host.textContent).toContain('workHub.personal.conflict');
  });

  it('does not start a second command or edit while the first preflight is pending and aborts when authority is withdrawn', async () => {
    let release!: (value: WorkHubSnapshot | null) => void;
    preflight.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    await render();
    await key('c');
    await key('c');
    await key('e');
    expect(preflight).toHaveBeenCalledOnce();
    expect(onEdit).not.toHaveBeenCalled();
    await render({ canEdit: false });
    await act(async () => release(snapshot([item])));
    await settle();
    expect(transitionPersonalWorkTask).not.toHaveBeenCalled();
  });

  it('never completes through a deletion dialog and leaves editable checklist input alone', async () => {
    await render();
    const descriptionInput = document.createElement('input');
    region().appendChild(descriptionInput);
    await key('c', descriptionInput);
    expect(preflight).not.toHaveBeenCalled();
    const deleteButton = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'workHub.personal.delete'
    )!;
    await act(async () => deleteButton.click());
    await key('c');
    await key('e');
    expect(preflight).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
    expect(transitionPersonalWorkTask).not.toHaveBeenCalled();
  });

  it('does not retain the prior editor handler when the selected owner/task changes', async () => {
    await render();
    const next = { ...task, taskId: 'a4444444-4444-4444-8444-444444444444' };
    const nextItem = personalWorkToHub(next, true);
    vi.mocked(getPersonalWorkTask).mockResolvedValue(next);
    await render({ item: nextItem, ownerFingerprint: 'owner-b', snapshot: snapshot([nextItem]) });
    await key('e');
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith(next);
    expect(onEdit).not.toHaveBeenCalledWith(task);
  });
});
