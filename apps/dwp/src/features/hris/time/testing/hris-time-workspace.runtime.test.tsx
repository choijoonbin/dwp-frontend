// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import { HrisTimeRuntime } from '../index';

import type { ReactNode } from 'react';
import type { HrisTimeRuntimeProps, TimeCardDisplay, TimeEntryDisplay } from '../index';

type ProductSurfaceRequestScope = HrisTimeRuntimeProps['requestScope'];
type HrisTimeDataSource = NonNullable<HrisTimeRuntimeProps['dataSource']>;

type TimeWorkspaceSourceFixture = {
  employee: {
    personId: string;
    displayName: string;
    directReportCount: number;
  };
  card?: {
    timeCardId: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    scheduledMinutes: number;
    recordedMinutes: number;
    exceptionCount: number;
    dataOrigin: string;
    version: number;
  } | null;
  entries: Array<{
    timeEntryId: string;
    workDate: string;
    entryType: string;
    minutes: number;
    workMode?: string | null;
    note?: string | null;
    version: number;
  }>;
  exceptions: Array<Record<string, unknown>>;
  teamQueue: unknown[];
};

const runtime = vi.hoisted(() => ({
  actionRoutes: [] as string[],
  rolloutState: '100' as '000' | '100',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; value?: string }) =>
      (options?.defaultValue ?? key).replace('{{value}}', options?.value ?? ''),
  }),
}));
vi.mock('../../../../components/use-product-action-mutation', () => ({
  useProductActionMutation: (route: string) => {
    runtime.actionRoutes.push(route);
    return (command: (authority: object) => unknown) =>
      command({ mode: 'LEGACY_COMPATIBILITY', rolloutState: runtime.rolloutState });
  },
}));
vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({
    children,
    disabled,
    loading,
    onClick,
    type,
  }: {
    children: ReactNode;
    disabled?: boolean;
    loading?: boolean;
    onClick?: () => void;
    type?: 'button' | 'submit';
  }) => createElement('button', { disabled: disabled || loading, onClick, type }, children),
  EmptyState: ({ title }: { title: string }) => createElement('div', null, title),
  FormDialog: ({
    open,
    children,
    submitLabel,
    submitDisabled,
    onSubmit,
  }: {
    open: boolean;
    children: ReactNode;
    submitLabel: string;
    submitDisabled?: boolean;
    onSubmit: () => void;
  }) =>
    open
      ? createElement(
          'div',
          { role: 'dialog' },
          children,
          createElement(
            'button',
            { type: 'button', disabled: submitDisabled, onClick: onSubmit },
            submitLabel
          )
        )
      : null,
  FormField: ({
    type,
    label,
    value,
    onChange,
  }: {
    type?: string;
    label: string;
    value: string | number;
    onChange: (event: { target: { value: string } }) => void;
  }) =>
    createElement('input', {
      type: type ?? 'text',
      'aria-label': label,
      value,
      onChange,
    }),
  InlineFeedback: ({ children }: { children: ReactNode }) =>
    createElement('div', { role: 'status' }, children),
  SelectField: ({
    label,
    value,
    onValueChange,
  }: {
    label: string;
    value: string;
    onValueChange: (value: string) => void;
  }) =>
    createElement(
      'select',
      {
        'aria-label': label,
        value,
        onChange: (event: Event) => onValueChange((event.currentTarget as HTMLSelectElement).value),
      },
      createElement('option', { value }, value)
    ),
}));
vi.mock('../../shared', () => ({
  HrisDomainSection: ({ children }: { children: ReactNode }) =>
    createElement('section', null, children),
  HrisProgressSignal: ({ value }: { value: string }) => createElement('output', null, value),
  HrisQueryBoundary: ({
    loading,
    error,
    children,
  }: {
    loading: boolean;
    error: unknown;
    children: ReactNode;
  }) => {
    if (loading) {
      return createElement('div', { 'data-query-state': 'loading' }, 'loading');
    }
    if (error) {
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? (error as { status?: number }).status
          : undefined;
      const state = status === 403 ? 'permission' : 'error';
      return createElement('div', { 'data-query-state': state }, state);
    }
    return createElement('div', { 'data-query-state': 'ready' }, children);
  },
  HrisReferenceNotice: () => createElement('aside', null, 'reference'),
  HrisStatusChip: ({ status }: { status: string }) => createElement('span', null, status),
}));
vi.mock('../components/hris-time-calendar', () => ({
  HrisTimeCalendar: ({
    card,
    entries,
    onEdit,
  }: {
    card: TimeCardDisplay;
    entries: readonly TimeEntryDisplay[];
    onEdit: (date: string, entry: TimeEntryDisplay) => void;
  }) =>
    createElement(
      'section',
      { 'data-testid': 'time-calendar' },
      createElement('span', null, card.timeCardId),
      createElement('span', null, entries[0]?.note),
      entries[0]
        ? createElement(
            'button',
            { type: 'button', onClick: () => onEdit(entries[0]!.workDate, entries[0]!) },
            'open-entry-editor'
          )
        : null
    ),
}));

const scope: ProductSurfaceRequestScope = {
  governed: true,
  ready: true,
  contextScopeKey: 'scope:hris/time',
  cacheKey: ['tenant-1', 'actor-3', 'SELF', 'hcm.personal', 'scope:hris/time', '91'],
  queryMeta: {
    accessSensitive: true,
    tenantId: 'tenant-1',
    actorId: 'actor-3',
    accessMode: 'SELF',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    contextScopeKey: 'scope:hris/time',
    decisionRevision: '91',
  },
};

const deniedCommandCases = [
  { status: 401, rolloutState: '000', title: 'Your session is no longer valid' },
  { status: 401, rolloutState: '100', title: 'Your session is no longer valid' },
  { status: 403, rolloutState: '000', title: 'This action is no longer permitted' },
  { status: 403, rolloutState: '100', title: 'This action is no longer permitted' },
] as const;

function workspace(version: number): TimeWorkspaceSourceFixture {
  return {
    employee: {
      personId: 'person-1',
      displayName: 'Min Seo',
      directReportCount: 0,
    },
    card: {
      timeCardId: 'card-1',
      periodStart: '2026-03-02',
      periodEnd: '2026-03-08',
      status: 'OPEN',
      scheduledMinutes: 2_400,
      recordedMinutes: 480,
      exceptionCount: 0,
      dataOrigin: 'SOURCE',
      version,
    },
    entries: [
      {
        timeEntryId: 'entry-1',
        workDate: '2026-03-02',
        entryType: 'WORK',
        minutes: 480,
        workMode: 'OFFICE',
        note: 'Initial',
        version,
      },
    ],
    exceptions: [],
    teamQueue: [],
  };
}

function markedWorkspace(marker: string, version: number): TimeWorkspaceSourceFixture {
  const base = workspace(version);
  if (!base.card) throw new Error('Expected a time card fixture');
  return {
    ...base,
    employee: {
      ...base.employee,
      personId: `${marker}-person`,
      displayName: `${marker} employee`,
    },
    card: {
      ...base.card,
      timeCardId: `${marker} card`,
    },
    entries: [
      {
        ...base.entries[0]!,
        timeEntryId: `${marker}-entry`,
        note: `${marker} entry`,
      },
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

function button(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === label
  );
}

async function renderTime(
  requestScope: ProductSurfaceRequestScope,
  dataSource: HrisTimeDataSource
) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <HrisTimeRuntime requestScope={requestScope} dataSource={dataSource} />
      </QueryClientProvider>
    )
  );
  await settle();
}

function alternateScope(): ProductSurfaceRequestScope {
  return {
    governed: true,
    ready: true,
    contextScopeKey: 'scope:hris/team-time',
    cacheKey: ['tenant-2', 'actor-8', 'ELEVATED', 'hcm.personal', 'scope:hris/team-time', '92'],
    queryMeta: {
      accessSensitive: true,
      tenantId: 'tenant-2',
      actorId: 'actor-8',
      accessMode: 'ELEVATED',
      productId: 'hcm',
      surfaceId: 'hcm.personal',
      contextScopeKey: 'scope:hris/team-time',
      decisionRevision: '92',
    },
  };
}

describe('HRIS time command recovery runtime', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    runtime.actionRoutes.length = 0;
    runtime.rolloutState = '100';
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it('shows loading and issues no GET until the governed scope is ready', async () => {
    const read = vi.fn<HrisTimeDataSource['read']>();
    const notReady: ProductSurfaceRequestScope = {
      ...scope,
      ready: false,
      contextScopeKey: undefined,
      cacheKey: ['tenant-1', 'actor-9', 'TENANT', 'hcm.personal', '', '74'],
      queryMeta: {
        ...scope.queryMeta,
        contextScopeKey: undefined,
        decisionRevision: '74',
      },
    };

    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <HrisTimeRuntime
            requestScope={notReady}
            dataSource={{
              read,
              saveEntry: vi.fn<HrisTimeDataSource['saveEntry']>(),
              submitCard: vi.fn<HrisTimeDataSource['submitCard']>(),
            }}
          />
        </QueryClientProvider>
      )
    );
    await settle();

    expect(read).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('loading');
    expect(document.body.textContent).not.toContain('domains.time.noCardTitle');
  });

  it('aborts the previous GET on a full scope transition and never renders its late response', async () => {
    const oldResponse = deferred<TimeWorkspaceSourceFixture>();
    const nextResponse = deferred<TimeWorkspaceSourceFixture>();
    let oldSignal: AbortSignal | undefined;
    let nextSignal: AbortSignal | undefined;
    const read = vi.fn<HrisTimeDataSource['read']>((contextScopeKey, signal) => {
      if (contextScopeKey === scope.contextScopeKey) {
        oldSignal = signal;
        return oldResponse.promise;
      }
      nextSignal = signal;
      return nextResponse.promise;
    });
    const dataSource: HrisTimeDataSource = {
      read,
      saveEntry: vi.fn<HrisTimeDataSource['saveEntry']>(),
      submitCard: vi.fn<HrisTimeDataSource['submitCard']>(),
    };
    const nextScope: ProductSurfaceRequestScope = {
      governed: true,
      ready: true,
      contextScopeKey: 'scope:hris/team-time',
      cacheKey: ['tenant-2', 'actor-8', 'ELEVATED', 'hcm.personal', 'scope:hris/team-time', '92'],
      queryMeta: {
        accessSensitive: true,
        tenantId: 'tenant-2',
        actorId: 'actor-8',
        accessMode: 'ELEVATED',
        productId: 'hcm',
        surfaceId: 'hcm.personal',
        contextScopeKey: 'scope:hris/team-time',
        decisionRevision: '92',
      },
    };

    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <HrisTimeRuntime requestScope={scope} dataSource={dataSource} />
        </QueryClientProvider>
      )
    );
    await settle();
    expect(read).toHaveBeenNthCalledWith(1, scope.contextScopeKey, expect.any(AbortSignal));

    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <HrisTimeRuntime requestScope={nextScope} dataSource={dataSource} />
        </QueryClientProvider>
      )
    );
    await settle();

    expect(oldSignal?.aborted).toBe(true);
    expect(nextSignal).toBeInstanceOf(AbortSignal);
    expect(read).toHaveBeenNthCalledWith(2, nextScope.contextScopeKey, nextSignal);
    expect(host.querySelector('[data-query-state="loading"]')).not.toBeNull();

    await act(async () => oldResponse.resolve(markedWorkspace('old-scope', 3)));
    await settle();

    expect(host.textContent).not.toContain('old-scope card');
    expect(host.textContent).not.toContain('old-scope entry');
    expect(host.querySelector('[data-query-state="loading"]')).not.toBeNull();

    await act(async () => nextResponse.resolve(markedWorkspace('next-scope', 4)));
    await settle();

    expect(host.textContent).toContain('next-scope card');
    expect(host.textContent).toContain('next-scope entry');
    expect(host.textContent).not.toContain('old-scope card');
    expect(host.textContent).not.toContain('old-scope entry');
    expect(
      client.getQueryCache().find({
        queryKey: ['hris', 'time', 'workspace-v2', ...nextScope.cacheKey],
      })?.meta
    ).toEqual(nextScope.queryMeta);
  });

  it('fails closed on a 403 refetch without exposing the previously cached time payload', async () => {
    const cached = markedWorkspace('revoked-private', 7);
    const read = vi
      .fn<HrisTimeDataSource['read']>()
      .mockResolvedValueOnce(cached)
      .mockRejectedValueOnce(new HttpError('time scope revoked', 403));
    const dataSource: HrisTimeDataSource = {
      read,
      saveEntry: vi.fn<HrisTimeDataSource['saveEntry']>(),
      submitCard: vi.fn<HrisTimeDataSource['submitCard']>(),
    };

    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <HrisTimeRuntime requestScope={scope} dataSource={dataSource} />
        </QueryClientProvider>
      )
    );
    await settle();

    expect(host.textContent).toContain(cached.card!.timeCardId);
    expect(host.textContent).toContain(cached.entries[0]!.note);
    expect(client.getQueryData(['hris', 'time', 'workspace-v2', ...scope.cacheKey])).toEqual({
      card: cached.card,
      entries: cached.entries,
      exceptions: cached.exceptions,
    });

    await act(async () => {
      await client.refetchQueries({
        queryKey: ['hris', 'time', 'workspace-v2', ...scope.cacheKey],
        exact: true,
      });
    });
    await settle();

    expect(read).toHaveBeenCalledTimes(2);
    expect(host.querySelectorAll('[data-query-state]')).toHaveLength(1);
    expect(host.querySelector('[data-query-state="permission"]')).not.toBeNull();
    expect(host.textContent).toBe('permission');
    expect(host.textContent).not.toContain(cached.employee.displayName);
    expect(host.textContent).not.toContain(cached.card!.timeCardId);
    expect(host.textContent).not.toContain(cached.entries[0]!.note);
    expect(host.textContent).not.toContain('time scope revoked');
  });

  it('stores only the strict time display projection and drops adjacent private source fields', async () => {
    const base = workspace(3);
    const privateSource = {
      ...base,
      employee: { ...base.employee, bankAccount: 'synthetic-private-bank' },
      card: { ...base.card!, payrollGroup: 'synthetic-private-payroll' },
      entries: [{ ...base.entries[0]!, privateAttendanceReview: 'synthetic-private-review' }],
      exceptions: [],
      teamQueue: [{ privateManagerNote: 'synthetic-private-manager-note' }],
    } as unknown as TimeWorkspaceSourceFixture;
    const dataSource: HrisTimeDataSource = {
      read: vi.fn<HrisTimeDataSource['read']>().mockResolvedValue(privateSource),
      saveEntry: vi.fn<HrisTimeDataSource['saveEntry']>(),
      submitCard: vi.fn<HrisTimeDataSource['submitCard']>(),
    };

    await renderTime(scope, dataSource);

    const cached = client.getQueryData(['hris', 'time', 'workspace-v2', ...scope.cacheKey]);
    expect(cached).toEqual({
      card: base.card,
      entries: base.entries,
      exceptions: base.exceptions,
    });
    expect(JSON.stringify(cached)).not.toContain('synthetic-private');
    expect(host.textContent).not.toContain('synthetic-private');
  });

  it('fails closed on a malformed source state without caching or echoing it', async () => {
    const malformed = workspace(3);
    malformed.card = {
      ...malformed.card!,
      dataOrigin: 'synthetic-private-origin',
    };
    const dataSource: HrisTimeDataSource = {
      read: vi.fn<HrisTimeDataSource['read']>().mockResolvedValue(malformed),
      saveEntry: vi.fn<HrisTimeDataSource['saveEntry']>(),
      submitCard: vi.fn<HrisTimeDataSource['submitCard']>(),
    };

    await renderTime(scope, dataSource);

    expect(host.querySelector('[data-query-state="error"]')).not.toBeNull();
    expect(host.textContent).not.toContain('synthetic-private-origin');
    expect(
      client.getQueryData(['hris', 'time', 'workspace-v2', ...scope.cacheKey])
    ).toBeUndefined();
  });

  it('rejects a save response from an earlier visit after the scope returns from A to B to A', async () => {
    const oldSave = deferred<TimeWorkspaceSourceFixture>();
    const scopeB = alternateScope();
    const read = vi
      .fn<HrisTimeDataSource['read']>()
      .mockResolvedValueOnce(workspace(3))
      .mockResolvedValueOnce(markedWorkspace('scope-b', 4))
      .mockResolvedValueOnce(markedWorkspace('returned-a', 7));
    const saveEntry = vi.fn<HrisTimeDataSource['saveEntry']>().mockReturnValue(oldSave.promise);
    const dataSource: HrisTimeDataSource = {
      read,
      saveEntry,
      submitCard: vi.fn<HrisTimeDataSource['submitCard']>(),
    };

    await renderTime(scope, dataSource);
    await act(async () => button('open-entry-editor')!.click());
    await act(async () => button('domains.actions.save')!.click());
    expect(saveEntry).toHaveBeenCalledTimes(1);

    await renderTime(scopeB, dataSource);
    expect(host.textContent).toContain('scope-b card');
    client.removeQueries({
      queryKey: ['hris', 'time', 'workspace-v2', ...scope.cacheKey],
      exact: true,
    });
    await renderTime(scope, dataSource);
    expect(host.textContent).toContain('returned-a card');

    await act(async () => oldSave.resolve(markedWorkspace('late-first-a', 4)));
    await settle();

    expect(host.textContent).toContain('returned-a card');
    expect(host.textContent).not.toContain('late-first-a card');
    expect(client.getQueryData(['hris', 'time', 'workspace-v2', ...scope.cacheKey])).toEqual({
      card: markedWorkspace('returned-a', 7).card,
      entries: markedWorkspace('returned-a', 7).entries,
      exceptions: [],
    });
    expect(host.textContent).not.toContain('domains.time.saved');
  });

  it('prevents a pre-save GET from replacing the newer save response', async () => {
    const staleRead = deferred<TimeWorkspaceSourceFixture>();
    const read = vi
      .fn<HrisTimeDataSource['read']>()
      .mockResolvedValueOnce(workspace(3))
      .mockReturnValueOnce(staleRead.promise);
    const saveEntry = vi
      .fn<HrisTimeDataSource['saveEntry']>()
      .mockResolvedValue(markedWorkspace('saved-v4', 4));
    const dataSource: HrisTimeDataSource = {
      read,
      saveEntry,
      submitCard: vi.fn<HrisTimeDataSource['submitCard']>(),
    };
    await renderTime(scope, dataSource);

    let backgroundRead!: Promise<unknown>;
    await act(async () => {
      backgroundRead = client.refetchQueries({
        queryKey: ['hris', 'time', 'workspace-v2', ...scope.cacheKey],
        exact: true,
      });
      await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    });
    await act(async () => button('open-entry-editor')!.click());
    await act(async () => button('domains.actions.save')!.click());
    await settle();
    expect(host.textContent).toContain('saved-v4 card');

    await act(async () => staleRead.resolve(markedWorkspace('stale-v3', 3)));
    await act(async () => backgroundRead);
    await settle();

    expect(host.textContent).toContain('saved-v4 card');
    expect(host.textContent).not.toContain('stale-v3 card');
    expect(client.getQueryData(['hris', 'time', 'workspace-v2', ...scope.cacheKey])).toEqual({
      card: markedWorkspace('saved-v4', 4).card,
      entries: markedWorkspace('saved-v4', 4).entries,
      exceptions: [],
    });
  });

  it('preserves the draft and cache when a successful transport response has invalid state', async () => {
    const invalidResponse = workspace(4);
    invalidResponse.card = {
      ...invalidResponse.card!,
      status: 'synthetic-private-state',
    };
    const dataSource: HrisTimeDataSource = {
      read: vi.fn<HrisTimeDataSource['read']>().mockResolvedValue(workspace(3)),
      saveEntry: vi.fn<HrisTimeDataSource['saveEntry']>().mockResolvedValue(invalidResponse),
      submitCard: vi.fn<HrisTimeDataSource['submitCard']>(),
    };
    await renderTime(scope, dataSource);
    await act(async () => button('open-entry-editor')!.click());
    await act(async () => button('domains.actions.save')!.click());
    await settle();

    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.textContent).toContain('The command outcome is unknown');
    expect(host.textContent).not.toContain('synthetic-private-state');
    expect(client.getQueryData(['hris', 'time', 'workspace-v2', ...scope.cacheKey])).toEqual({
      card: workspace(3).card,
      entries: workspace(3).entries,
      exceptions: [],
    });
  });

  it('does not settle a late save into cache or feedback after the feature unmounts', async () => {
    const pending = deferred<TimeWorkspaceSourceFixture>();
    const dataSource: HrisTimeDataSource = {
      read: vi.fn<HrisTimeDataSource['read']>().mockResolvedValue(workspace(3)),
      saveEntry: vi.fn<HrisTimeDataSource['saveEntry']>().mockReturnValue(pending.promise),
      submitCard: vi.fn<HrisTimeDataSource['submitCard']>(),
    };
    await renderTime(scope, dataSource);
    await act(async () => button('open-entry-editor')!.click());
    await act(async () => button('domains.actions.save')!.click());
    await act(async () => root.render(null));

    await act(async () => pending.resolve(markedWorkspace('late-unmounted', 4)));
    await settle();

    expect(
      client.getQueryData(['hris', 'time', 'workspace-v2', ...scope.cacheKey])
    ).toBeUndefined();
    expect(host.textContent).not.toContain('domains.time.saved');
  });

  it('preserves a changed draft across 409 refresh and requires explicit latest-version review', async () => {
    const read = vi
      .fn<HrisTimeDataSource['read']>()
      .mockResolvedValueOnce(workspace(3))
      .mockResolvedValueOnce(workspace(4));
    const saveEntry = vi
      .fn<HrisTimeDataSource['saveEntry']>()
      .mockRejectedValueOnce(new HttpError('Version conflict', 409))
      .mockResolvedValueOnce(workspace(5));
    const submitCard = vi.fn<HrisTimeDataSource['submitCard']>();

    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <HrisTimeRuntime requestScope={scope} dataSource={{ read, saveEntry, submitCard }} />
        </QueryClientProvider>
      )
    );
    await settle();

    expect(read).toHaveBeenCalledWith('scope:hris/time', expect.any(AbortSignal));
    await act(async () => button('open-entry-editor')!.click());
    const minutes = document.querySelector<HTMLInputElement>(
      'input[aria-label="domains.time.minutes"]'
    )!;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      valueSetter?.call(minutes, '525');
      minutes.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => button('domains.actions.save')!.click());
    await settle();

    expect(document.body.textContent).toContain('The time card changed');
    expect(minutes.value).toBe('525');
    expect(saveEntry).toHaveBeenNthCalledWith(
      1,
      'card-1',
      '2026-03-02',
      expect.objectContaining({ minutes: 525, cardVersion: 3 }),
      expect.any(Object)
    );

    await act(async () => button('Refresh current card')!.click());
    await settle();
    expect(minutes.value).toBe('525');
    expect(button('domains.actions.save')?.disabled).toBe(true);
    await act(async () => button('Review latest and continue')!.click());
    expect(button('domains.actions.save')?.disabled).toBe(false);
    await act(async () => button('domains.actions.save')!.click());
    await settle();

    expect(saveEntry).toHaveBeenNthCalledWith(
      2,
      'card-1',
      '2026-03-02',
      expect.objectContaining({ minutes: 525, cardVersion: 4 }),
      expect.any(Object)
    );
    expect(document.body.textContent).toContain('domains.time.saved');
    expect(runtime.actionRoutes).toContain('route.hcm.personal.time-entry-update.action');
  });

  it.each(deniedCommandCases)(
    'keeps the save draft but blocks the original button after $status in rollout $rolloutState',
    async ({ status, rolloutState, title }) => {
      runtime.rolloutState = rolloutState;
      const saveEntry = vi
        .fn<HrisTimeDataSource['saveEntry']>()
        .mockRejectedValue(new HttpError('Denied time entry command', status));
      const dataSource: HrisTimeDataSource = {
        read: vi.fn<HrisTimeDataSource['read']>().mockResolvedValue(workspace(3)),
        saveEntry,
        submitCard: vi.fn<HrisTimeDataSource['submitCard']>(),
      };

      await act(async () =>
        root.render(
          <QueryClientProvider client={client}>
            <HrisTimeRuntime requestScope={scope} dataSource={dataSource} />
          </QueryClientProvider>
        )
      );
      await settle();

      await act(async () => button('open-entry-editor')!.click());
      const minutes = document.querySelector<HTMLInputElement>(
        'input[aria-label="domains.time.minutes"]'
      )!;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      await act(async () => {
        valueSetter?.call(minutes, '525');
        minutes.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => button('domains.actions.save')!.click());
      await settle();

      const originalSave = button('domains.actions.save')!;
      expect(host.textContent).toContain(title);
      expect(host.querySelector('[role="dialog"]')).not.toBeNull();
      expect(minutes.value).toBe('525');
      expect(originalSave.disabled).toBe(true);
      expect(saveEntry).toHaveBeenCalledTimes(1);
      expect(saveEntry).toHaveBeenCalledWith(
        'card-1',
        '2026-03-02',
        expect.objectContaining({ minutes: 525, cardVersion: 3 }),
        expect.objectContaining({ rolloutState })
      );

      await act(async () => originalSave.click());
      await settle();
      expect(saveEntry).toHaveBeenCalledTimes(1);
    }
  );

  it.each(deniedCommandCases)(
    'blocks the original submit button after $status in rollout $rolloutState',
    async ({ status, rolloutState, title }) => {
      runtime.rolloutState = rolloutState;
      const submitCard = vi
        .fn<HrisTimeDataSource['submitCard']>()
        .mockRejectedValue(new HttpError('Denied time card command', status));
      const dataSource: HrisTimeDataSource = {
        read: vi.fn<HrisTimeDataSource['read']>().mockResolvedValue(workspace(3)),
        saveEntry: vi.fn<HrisTimeDataSource['saveEntry']>(),
        submitCard,
      };

      await act(async () =>
        root.render(
          <QueryClientProvider client={client}>
            <HrisTimeRuntime requestScope={scope} dataSource={dataSource} />
          </QueryClientProvider>
        )
      );
      await settle();

      await act(async () => button('domains.time.submit')!.click());
      await settle();

      const originalSubmit = button('domains.time.submit')!;
      expect(host.textContent).toContain(title);
      expect(host.textContent).toContain('card-1');
      expect(originalSubmit.disabled).toBe(true);
      expect(submitCard).toHaveBeenCalledTimes(1);
      expect(submitCard).toHaveBeenCalledWith(
        'card-1',
        3,
        expect.objectContaining({ rolloutState })
      );

      await act(async () => originalSubmit.click());
      await settle();
      expect(submitCard).toHaveBeenCalledTimes(1);
    }
  );
});
