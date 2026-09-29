// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import {
  defaultRegionalPreference,
  writeRegionalPreference,
} from '@dwp-frontend/shared-utils/regional-preference';
import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';

const runtime = vi.hoisted(() => ({
  read: vi.fn(),
  update: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  governed: vi.fn((operation: (authority: Record<string, never>) => unknown) => operation({})),
  scope: null as unknown as ProductSurfaceRequestScope,
}));

vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof SharedUtils>()),
  updateHrGoal: runtime.update,
  useToast: () => ({ success: runtime.success, error: runtime.error }),
}));

vi.mock('../../../../components/use-product-action-mutation', () => ({
  useProductActionMutation: () => runtime.governed,
}));

vi.mock('../../../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => runtime.scope,
}));

vi.mock('../api/performance-talent-api', () => ({
  getScopedPerformanceTalent: runtime.read,
  updateScopedPerformanceGoal: runtime.update,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

import { HttpError } from '@dwp-frontend/shared-utils';
import { HrisPerformanceWorkspace } from '../index';

import type { HrTalentWorkspace } from '@dwp-frontend/shared-utils';
import type { PerformanceDataProvenance } from '../index';

const workspace: HrTalentWorkspace = {
  employee: {
    personId: 'person-1',
    displayName: 'Alex Kim',
    businessTitle: 'Product manager',
    organizationName: 'People Experience',
    directReportCount: 0,
  },
  goals: [
    {
      goalId: 'goal-1',
      title: 'Improve customer response time',
      goalType: 'PERSONAL',
      progressPercent: 40,
      dueDate: '2026-12-31',
      status: 'ACTIVE',
      version: 3,
    },
  ],
  journeys: [],
  learning: [],
};

let root: Root;
let mount: HTMLDivElement;
let client: QueryClient;

const baseCacheKey = [
  'tenant-1',
  'actor-1',
  'NORMAL',
  'hcm.personal',
  'scope:self',
  'revision-1',
] as const;

function requestScope(
  cacheKey: ProductSurfaceRequestScope['cacheKey'] = baseCacheKey,
  ready = true
): ProductSurfaceRequestScope {
  return {
    governed: true,
    ready,
    contextScopeKey: cacheKey[4],
    cacheKey,
    queryMeta: {
      accessSensitive: true,
      tenantId: cacheKey[0],
      actorId: cacheKey[1],
      accessMode: cacheKey[2],
      productId: 'hcm',
      surfaceId: 'hcm.personal',
      contextScopeKey: cacheKey[4],
      decisionRevision: cacheKey[5],
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function render(dataProvenance?: PerformanceDataProvenance) {
  const props = dataProvenance ? { dataProvenance } : {};
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client }, createElement(HrisPerformanceWorkspace, props))
    );
  });
}

async function shown(text: string) {
  await act(async () => {
    await vi.waitFor(() => expect(document.body.textContent).toContain(text));
  });
}

function button(label: string) {
  const match = [...document.querySelectorAll('button')].find(
    (item) => item.textContent === label || item.getAttribute('aria-label') === label
  );
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

async function click(label: string) {
  await act(async () => button(label).click());
}

async function setProgress(value: number) {
  const input = document.querySelector('input[type="range"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('Missing progress input');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('HRIS performance Phase 1 runtime', () => {
  beforeEach(() => {
    window.localStorage.clear();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.values(runtime).forEach((value) => {
      if (vi.isMockFunction(value)) value.mockClear();
    });
    runtime.scope = requestScope();
    runtime.read.mockResolvedValue(workspace);
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(async () => {
    window.localStorage.clear();
    await act(async () => root.unmount());
    client.clear();
    mount.remove();
    vi.restoreAllMocks();
  });

  it('renders an explicit loading state while the real query is unresolved', async () => {
    runtime.read.mockReturnValue(new Promise(() => undefined));

    await render('SOURCE');

    expect(document.querySelector('[data-query-state="loading"]')).not.toBeNull();
  });

  it('does not issue a personal Talent GET until the request scope is ready', async () => {
    runtime.scope = requestScope(baseCacheKey, false);

    await render('SOURCE');

    expect(runtime.read).not.toHaveBeenCalled();
    expect(document.querySelector('[data-query-state="loading"]')).not.toBeNull();

    runtime.scope = requestScope();
    await render('SOURCE');
    await shown(workspace.employee.displayName);
    expect(runtime.read).toHaveBeenCalledWith('scope:self', expect.any(AbortSignal));
    expect(
      client
        .getQueryCache()
        .find({ queryKey: ['hcm', 'talent', 'personal-goals-v2', ...baseCacheKey] })?.meta
    ).toEqual(runtime.scope.queryMeta);
  });

  it('leaves the page-level h1 to ProductAreaPageHeader', async () => {
    await render('SOURCE');
    await shown('My goal progress');

    expect(mount.querySelector('h1')).toBeNull();
    expect(mount.querySelector('h2')?.textContent).toBe('My goal progress');
  });

  it.each([
    ['tenant', ['tenant-2', 'actor-1', 'NORMAL', 'hcm.personal', 'scope:self', 'revision-1']],
    ['actor', ['tenant-1', 'actor-2', 'NORMAL', 'hcm.personal', 'scope:self', 'revision-1']],
    ['access mode', ['tenant-1', 'actor-1', 'SUPPORT', 'hcm.personal', 'scope:self', 'revision-1']],
    [
      'context scope',
      ['tenant-1', 'actor-1', 'NORMAL', 'hcm.personal', 'scope:team', 'revision-1'],
    ],
    [
      'decision revision',
      ['tenant-1', 'actor-1', 'NORMAL', 'hcm.personal', 'scope:self', 'revision-2'],
    ],
  ] as const)('hides old personal data while the %s identity loads', async (label, nextKey) => {
    await render('SOURCE');
    await shown(workspace.employee.displayName);
    const next = deferred<HrTalentWorkspace>();
    let nextSignal: AbortSignal | undefined;
    runtime.read.mockImplementationOnce((_scopeKey: string, signal: AbortSignal) => {
      nextSignal = signal;
      return next.promise;
    });
    runtime.scope = requestScope(nextKey);

    await render('SOURCE');
    await act(async () => {
      await vi.waitFor(() => expect(runtime.read).toHaveBeenCalledTimes(2));
    });

    expect(document.querySelector('[data-query-state="loading"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain(workspace.employee.displayName);
    expect(runtime.read).toHaveBeenLastCalledWith(nextKey[4], expect.any(AbortSignal));
    expect(nextSignal).toBeInstanceOf(AbortSignal);

    next.resolve({
      ...workspace,
      employee: { ...workspace.employee, displayName: `${label} employee` },
    });
    await shown(`${label} employee`);
  });

  it('aborts the prior scope and ignores its late response after a new scope resolves', async () => {
    const oldRequest = deferred<HrTalentWorkspace>();
    const newRequest = deferred<HrTalentWorkspace>();
    let oldSignal: AbortSignal | undefined;
    let newSignal: AbortSignal | undefined;
    runtime.read
      .mockImplementationOnce((_scopeKey: string, signal: AbortSignal) => {
        oldSignal = signal;
        return oldRequest.promise;
      })
      .mockImplementationOnce((_scopeKey: string, signal: AbortSignal) => {
        newSignal = signal;
        return newRequest.promise;
      });

    await render('SOURCE');
    await act(async () => {
      await vi.waitFor(() => expect(runtime.read).toHaveBeenCalledTimes(1));
    });
    const nextKey = [
      'tenant-2',
      'actor-2',
      'SUPPORT',
      'hcm.personal',
      'scope:team',
      'revision-2',
    ] as const;
    runtime.scope = requestScope(nextKey);
    await render('SOURCE');
    await act(async () => {
      await vi.waitFor(() => expect(runtime.read).toHaveBeenCalledTimes(2));
    });

    expect(oldSignal?.aborted).toBe(true);
    expect(newSignal).toBeInstanceOf(AbortSignal);
    expect(newSignal).not.toBe(oldSignal);
    expect(newSignal?.aborted).toBe(false);

    newRequest.resolve({
      ...workspace,
      employee: { ...workspace.employee, displayName: 'New scope employee' },
    });
    await shown('New scope employee');
    oldRequest.resolve({
      ...workspace,
      employee: { ...workspace.employee, displayName: 'Old deferred employee' },
    });
    await act(async () => Promise.resolve());

    expect(document.body.textContent).not.toContain('Old deferred employee');
    expect(
      client.getQueryData(['hcm', 'talent', 'personal-goals-v2', ...baseCacheKey])
    ).toBeUndefined();
  });

  it('discards an open private draft when the request identity changes', async () => {
    await render('SOURCE');
    await shown(workspace.employee.displayName);
    await click(`Edit progress: ${workspace.goals[0].title}`);
    await setProgress(55);
    expect(document.querySelector('input[type="range"]')).not.toBeNull();

    const nextKey = [
      'tenant-2',
      'actor-2',
      'SUPPORT',
      'hcm.personal',
      'scope:team',
      'revision-2',
    ] as const;
    runtime.scope = requestScope(nextKey);
    runtime.read.mockResolvedValue({
      ...workspace,
      employee: { ...workspace.employee, displayName: 'Replacement employee' },
    });
    await render('SOURCE');
    await shown('Replacement employee');

    expect(document.querySelector('input[type="range"]')).toBeNull();
    expect(document.body.textContent).not.toContain('domains.talent.updateGoalTitle');
  });

  it('ignores a late mutation success after the request identity changes', async () => {
    const oldMutation = deferred<HrTalentWorkspace>();
    runtime.update.mockReturnValue(oldMutation.promise);

    await render('SOURCE');
    await shown(workspace.employee.displayName);
    await click(`Edit progress: ${workspace.goals[0].title}`);
    await setProgress(55);
    await click('domains.actions.save');
    expect(runtime.update).toHaveBeenCalledTimes(1);

    const nextKey = [
      'tenant-2',
      'actor-2',
      'SUPPORT',
      'hcm.personal',
      'scope:team',
      'revision-2',
    ] as const;
    const nextWorkspace = {
      ...workspace,
      employee: { ...workspace.employee, displayName: 'New mutation scope employee' },
    };
    runtime.scope = requestScope(nextKey);
    runtime.read.mockResolvedValue(nextWorkspace);
    await render('SOURCE');
    await shown(nextWorkspace.employee.displayName);

    oldMutation.resolve({
      ...workspace,
      employee: { ...workspace.employee, displayName: 'Late old mutation employee' },
      goals: [{ ...workspace.goals[0], progressPercent: 55, version: 4 }],
    });
    await act(async () => {
      await oldMutation.promise;
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain(nextWorkspace.employee.displayName);
    expect(document.body.textContent).not.toContain('Late old mutation employee');
    expect(client.getQueryData(['hcm', 'talent', 'personal-goals-v2', ...nextKey])).toEqual({
      employee: {
        displayName: nextWorkspace.employee.displayName,
        organizationName: nextWorkspace.employee.organizationName,
      },
      goals: nextWorkspace.goals,
      provenance: 'UNKNOWN',
    });
    expect(client.getQueryData(['hcm', 'talent', 'personal-goals-v2', ...baseCacheKey])).toEqual({
      employee: {
        displayName: workspace.employee.displayName,
        organizationName: workspace.employee.organizationName,
      },
      goals: workspace.goals,
      provenance: 'UNKNOWN',
    });
    expect(runtime.success).not.toHaveBeenCalled();
    expect(runtime.error).not.toHaveBeenCalled();
    expect(document.querySelector('input[type="range"]')).toBeNull();
  });

  it('rejects a late mutation from an earlier visit after the scope returns from A to B to A', async () => {
    const firstVisitMutation = deferred<HrTalentWorkspace>();
    runtime.update.mockReturnValue(firstVisitMutation.promise);

    await render('SOURCE');
    await shown(workspace.employee.displayName);
    await click(`Edit progress: ${workspace.goals[0].title}`);
    await setProgress(55);
    await click('domains.actions.save');
    expect(runtime.update).toHaveBeenCalledTimes(1);

    const scopeBKey = [
      'tenant-2',
      'actor-2',
      'SUPPORT',
      'hcm.personal',
      'scope:team',
      'revision-2',
    ] as const;
    const scopeBWorkspace = {
      ...workspace,
      employee: { ...workspace.employee, displayName: 'Scope B employee' },
    };
    runtime.scope = requestScope(scopeBKey);
    runtime.read.mockResolvedValue(scopeBWorkspace);
    await render('SOURCE');
    await shown(scopeBWorkspace.employee.displayName);

    const returnedAWorkspace = {
      employee: {
        displayName: 'Newest returned A employee',
        organizationName: workspace.employee.organizationName,
      },
      goals: [{ ...workspace.goals[0], progressPercent: 70, version: 7 }],
      provenance: 'SOURCE',
    } as const;
    client.setQueryData(
      ['hcm', 'talent', 'personal-goals-v2', ...baseCacheKey],
      returnedAWorkspace
    );
    runtime.scope = requestScope();
    await render('SOURCE');
    await shown(returnedAWorkspace.employee.displayName);

    firstVisitMutation.resolve({
      ...workspace,
      employee: { ...workspace.employee, displayName: 'Late first A mutation employee' },
      goals: [{ ...workspace.goals[0], progressPercent: 55, version: 4 }],
    });
    await act(async () => {
      await firstVisitMutation.promise;
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain(returnedAWorkspace.employee.displayName);
    expect(document.body.textContent).not.toContain('Late first A mutation employee');
    expect(client.getQueryData(['hcm', 'talent', 'personal-goals-v2', ...baseCacheKey])).toEqual(
      returnedAWorkspace
    );
    expect(runtime.success).not.toHaveBeenCalled();
    expect(runtime.error).not.toHaveBeenCalled();
  });

  it('prevents a pre-mutation GET from replacing a newer mutation response', async () => {
    await render('SOURCE');
    await shown(workspace.employee.displayName);

    const staleRead = deferred<HrTalentWorkspace>();
    runtime.read.mockReturnValueOnce(staleRead.promise);
    let backgroundRefetch!: Promise<unknown>;
    await act(async () => {
      backgroundRefetch = client.refetchQueries({
        queryKey: ['hcm', 'talent', 'personal-goals-v2', ...baseCacheKey],
        exact: true,
      });
      await vi.waitFor(() => expect(runtime.read).toHaveBeenCalledTimes(2));
    });

    const mutationWorkspace = {
      ...workspace,
      employee: { ...workspace.employee, displayName: 'Mutation version 4 employee' },
      goals: [{ ...workspace.goals[0], progressPercent: 55, version: 4 }],
    };
    runtime.update.mockResolvedValue(mutationWorkspace);
    await click(`Edit progress: ${workspace.goals[0].title}`);
    await setProgress(55);
    await click('domains.actions.save');
    await shown(mutationWorkspace.employee.displayName);

    staleRead.resolve({
      ...workspace,
      employee: { ...workspace.employee, displayName: 'Stale GET version 3 employee' },
    });
    await act(async () => {
      await backgroundRefetch;
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain(mutationWorkspace.employee.displayName);
    expect(document.body.textContent).not.toContain('Stale GET version 3 employee');
    expect(client.getQueryData(['hcm', 'talent', 'personal-goals-v2', ...baseCacheKey])).toEqual({
      employee: {
        displayName: mutationWorkspace.employee.displayName,
        organizationName: mutationWorkspace.employee.organizationName,
      },
      goals: mutationWorkspace.goals,
      provenance: 'UNKNOWN',
    });
  });

  it('renders the empty personal-goal state without exposing adjacent talent domains', async () => {
    runtime.read.mockResolvedValue({ ...workspace, goals: [] });

    await render('SOURCE');
    await shown('domains.talent.noGoalsTitle');

    expect(document.body.textContent).not.toContain('domains.talent.learningTitle');
    expect(document.body.textContent).not.toContain('domains.talent.journeyTitle');
  });

  it('keeps DRAFT goals read only instead of offering an approval-bypassing transition', async () => {
    runtime.read.mockResolvedValue({
      ...workspace,
      goals: [{ ...workspace.goals[0], status: 'DRAFT' }],
    });

    await render('SOURCE');
    await shown(workspace.goals[0].title);

    const edit = button(`Edit progress: ${workspace.goals[0].title}`);
    expect(edit.hasAttribute('disabled')).toBe(true);
    expect(edit.textContent).toContain('Read-only goal');
    await act(async () => edit.click());
    expect(document.querySelector('input[type="range"]')).toBeNull();
    expect(runtime.update).not.toHaveBeenCalled();
  });

  it('fails closed with the established permission state on a 403 read', async () => {
    runtime.read.mockRejectedValue(new HttpError('denied', 403));

    await render('SOURCE');
    await shown('domains.queryState.permissionTitle');

    expect(document.querySelector('[data-query-state="permission"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain(workspace.employee.displayName);
  });

  it.each([
    [new HttpError('unavailable', 503), 'unavailable'],
    [new Error('unexpected'), 'unknown'],
  ] as const)('renders the established %s read failure state', async (error, state) => {
    runtime.read.mockRejectedValue(error);

    await render('SOURCE');
    await shown(
      state === 'unavailable' ? 'domains.queryState.unavailableTitle' : 'common.loadError'
    );

    expect(document.querySelector(`[data-query-state="${state}"]`)).not.toBeNull();
  });

  it('distinguishes reference data from unknown provenance', async () => {
    await render('REFERENCE');
    await shown('domains.reference.title');
    expect(document.body.textContent).not.toContain('Data provenance is not available');

    await act(async () => root.unmount());
    client.clear();
    root = createRoot(mount);
    await render();
    await shown('Data provenance is not available');
  });

  it('preserves a conflicted draft, rebases it, and submits against the latest version', async () => {
    runtime.update.mockRejectedValueOnce(new HttpError('stale', 409)).mockResolvedValueOnce({
      ...workspace,
      goals: [{ ...workspace.goals[0], progressPercent: 55, version: 5 }],
    });

    await render('SOURCE');
    await shown(workspace.goals[0].title);
    await click(`Edit progress: ${workspace.goals[0].title}`);
    await setProgress(55);
    await click('domains.actions.save');
    await shown('Another change was saved first.');

    runtime.read.mockResolvedValue({
      ...workspace,
      goals: [{ ...workspace.goals[0], progressPercent: 60, version: 4 }],
    });
    await click('Load latest values');
    await act(async () => {
      await vi.waitFor(() =>
        expect(document.body.textContent).not.toContain('Another change was saved first.')
      );
    });
    await click('domains.actions.save');

    expect(runtime.update).toHaveBeenNthCalledWith(
      2,
      'goal-1',
      { progressPercent: 55, status: 'ACTIVE', version: 4 },
      expect.any(Object)
    );
    expect(runtime.success).toHaveBeenCalledWith('domains.talent.saved');
  });

  it('fails closed when loading the latest conflicted goal loses read authority', async () => {
    runtime.update.mockRejectedValueOnce(new HttpError('stale', 409));

    await render('SOURCE');
    await shown(workspace.goals[0].title);
    await click(`Edit progress: ${workspace.goals[0].title}`);
    await setProgress(55);
    await click('domains.actions.save');
    await shown('Another change was saved first.');

    runtime.read.mockRejectedValueOnce(new HttpError('goal read denied', 403));
    await click('Load latest values');
    await shown('domains.queryState.permissionTitle');

    expect(document.querySelector('[data-query-state="permission"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain(workspace.employee.displayName);
    expect(document.body.textContent).not.toContain(workspace.goals[0].title);
    expect(document.body.textContent).not.toContain('goal read denied');
    expect(document.querySelector('input[type="range"]')).toBeNull();
    expect(runtime.update).toHaveBeenCalledTimes(1);
  });

  it('preserves a draft after a 403 update and blocks another submission', async () => {
    runtime.update.mockRejectedValue(new HttpError('denied', 403));

    await render('SOURCE');
    await shown(workspace.goals[0].title);
    await click(`Edit progress: ${workspace.goals[0].title}`);
    await setProgress(55);
    await click('domains.actions.save');
    await shown('Your update permission could not be confirmed.');

    expect(document.body.textContent).toContain('Your progress is preserved');
    expect(button('domains.actions.save').hasAttribute('disabled')).toBe(true);
    await act(async () => button('domains.actions.save').click());
    expect(runtime.update).toHaveBeenCalledTimes(1);
  });

  it('keeps status ACTIVE when progress reaches 100 and exposes no completion transition', async () => {
    runtime.update.mockResolvedValue({
      ...workspace,
      goals: [{ ...workspace.goals[0], progressPercent: 100 }],
    });

    await render('SOURCE');
    await shown(workspace.goals[0].title);
    await click(`Edit progress: ${workspace.goals[0].title}`);
    expect(document.querySelector('input[type="checkbox"]')).toBeNull();
    await setProgress(100);
    await click('domains.actions.save');

    expect(runtime.update).toHaveBeenCalledWith(
      'goal-1',
      { progressPercent: 100, status: 'ACTIVE', version: 3 },
      expect.any(Object)
    );
  });
  it('does not persist adjacent-domain or employee/goal private fields in the read cache', async () => {
    runtime.read.mockResolvedValue({
      ...workspace,
      employee: { ...workspace.employee, bankAccount: 'synthetic-private-bank' },
      goals: [{ ...workspace.goals[0], privateReview: 'synthetic-private-review' }],
      learning: [{ privateNotes: 'synthetic-private-learning' }],
    });
    await render('SOURCE');
    await shown(workspace.goals[0].title);
    const cached = client.getQueryData(['hcm', 'talent', 'personal-goals-v2', ...baseCacheKey]);
    expect(cached).toEqual({
      employee: {
        displayName: workspace.employee.displayName,
        organizationName: workspace.employee.organizationName,
      },
      goals: workspace.goals,
      provenance: 'UNKNOWN',
    });
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data)
      )
    ).not.toContain('synthetic-private');
  });

  it('projects a successful mutation response before storing it in the private cache', async () => {
    const updatedGoals = [{ ...workspace.goals[0], progressPercent: 55, version: 4 }];
    runtime.update.mockResolvedValue({
      ...workspace,
      employee: { ...workspace.employee, bankAccount: 'synthetic-private-bank' },
      goals: updatedGoals.map((goal) => ({ ...goal, privateReview: 'synthetic-private-review' })),
    });
    await render('SOURCE');
    await shown(workspace.goals[0].title);
    await click(`Edit progress: ${workspace.goals[0].title}`);
    await setProgress(55);
    await click('domains.actions.save');
    await act(async () => {
      await vi.waitFor(() => expect(runtime.success).toHaveBeenCalledWith('domains.talent.saved'));
    });
    expect(client.getQueryData(['hcm', 'talent', 'personal-goals-v2', ...baseCacheKey])).toEqual({
      employee: {
        displayName: workspace.employee.displayName,
        organizationName: workspace.employee.organizationName,
      },
      goals: updatedGoals,
      provenance: 'UNKNOWN',
    });
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data)
      )
    ).not.toContain('synthetic-private');
  });

  it('does not render a preexisting raw legacy cache as the new personal-goal model', async () => {
    client.setQueryData(['hcm', 'talent', ...baseCacheKey], {
      ...workspace,
      employee: {
        ...workspace.employee,
        displayName: 'Legacy cached employee',
        bankAccount: 'synthetic-private-bank',
      },
    });
    runtime.read.mockReturnValue(new Promise(() => undefined));
    await render('SOURCE');
    expect(runtime.read).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-query-state="loading"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Legacy cached employee');
  });

  it('preserves a civil goal due date under the employee regional timezone', async () => {
    writeRegionalPreference({
      ...defaultRegionalPreference,
      timeZone: 'America/Los_Angeles',
      dateFormat: 'iso',
    });
    await render('SOURCE');
    await shown(workspace.goals[0].title);
    expect(document.body.textContent).toContain('2026-12-31');
    expect(document.body.textContent).not.toContain('2026-12-30');
  });

  it('does not settle private UI or cache from a mutation after the feature unmounts', async () => {
    const pending = deferred<HrTalentWorkspace>();
    runtime.update.mockReturnValue(pending.promise);
    await render('SOURCE');
    await shown(workspace.goals[0].title);
    await click(`Edit progress: ${workspace.goals[0].title}`);
    await setProgress(55);
    await click('domains.actions.save');
    await act(async () => root.render(null));
    pending.resolve({
      ...workspace,
      goals: [{ ...workspace.goals[0], progressPercent: 55, version: 4 }],
    });
    await act(async () => {
      await pending.promise;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(runtime.success).not.toHaveBeenCalled();
    expect(runtime.error).not.toHaveBeenCalled();
    expect(client.getQueryData(['hcm', 'talent', 'personal-goals-v2', ...baseCacheKey])).toEqual({
      employee: {
        displayName: workspace.employee.displayName,
        organizationName: workspace.employee.organizationName,
      },
      goals: workspace.goals,
      provenance: 'UNKNOWN',
    });
  });
});
