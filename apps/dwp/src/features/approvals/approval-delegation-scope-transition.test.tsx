// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getByLabelText, queryByText } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalDelegationEditor } from './approval-delegation-editor';

import type { ApprovalDelegationCandidate } from '@dwp-frontend/shared-utils';
import type { ProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

const dependencies = vi.hoisted(() => ({
  getPublishedApprovalWorkflows: vi.fn(),
  searchApprovalDelegationCandidates: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'ko', resolvedLanguage: 'ko' },
  }),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getPublishedApprovalWorkflows: dependencies.getPublishedApprovalWorkflows,
    searchApprovalDelegationCandidates: dependencies.searchApprovalDelegationCandidates,
  };
});

const requestScope = (suffix: string): ProductSurfaceRequestScope => ({
  governed: true,
  ready: true,
  contextScopeKey: `scope-${suffix}`,
  cacheKey: [
    `tenant-${suffix}`,
    `user-${suffix}`,
    'NORMAL',
    'approvals.work',
    `scope-${suffix}`,
    `revision-${suffix}`,
  ],
  queryMeta: {
    accessSensitive: true,
    tenantId: `tenant-${suffix}`,
    actorId: `user-${suffix}`,
    accessMode: 'NORMAL',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    contextScopeKey: `scope-${suffix}`,
    decisionRevision: `revision-${suffix}`,
  },
});

const previousCandidate: ApprovalDelegationCandidate = {
  userId: 91,
  displayName: 'Previous Scope Candidate',
  email: 'previous@example.test',
  jobTitle: 'Manager',
};

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

function renderEditor(open: boolean, scope: ProductSurfaceRequestScope) {
  root.render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApprovalDelegationEditor, {
        open,
        busy: false,
        sourceReady: true,
        requestScope: scope,
        onClose: vi.fn(),
        onSubmit: vi.fn(),
        onRecover: vi.fn(),
      })
    )
  );
}

describe('ApprovalDelegationEditor scope transition', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    dependencies.getPublishedApprovalWorkflows.mockResolvedValue([]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('aborts candidate lookup and clears the editor before a new scope can reopen it', async () => {
    let resolvePrevious!: (candidates: ApprovalDelegationCandidate[]) => void;
    let previousSignal: AbortSignal | undefined;
    dependencies.searchApprovalDelegationCandidates.mockImplementation(
      (_query: string, _limit: number, contextScopeKey: string, signal: AbortSignal) => {
        if (contextScopeKey === 'scope-b') return Promise.resolve([]);
        previousSignal = signal;
        return new Promise<ApprovalDelegationCandidate[]>((resolve) => {
          resolvePrevious = resolve;
        });
      }
    );

    await act(async () => renderEditor(true, requestScope('a')));
    const user = userEvent.setup();
    const candidateInput = getByLabelText(
      document.body,
      /delegations\.fields\.delegate/u
    ) as HTMLInputElement;
    await user.type(candidateInput, 'pr');
    expect(candidateInput.value).toBe('pr');
    await vi.waitFor(() =>
      expect(dependencies.searchApprovalDelegationCandidates).toHaveBeenCalledWith(
        'pr',
        10,
        'scope-a',
        expect.any(AbortSignal)
      )
    );

    await act(async () => renderEditor(false, requestScope('b')));
    expect(previousSignal?.aborted).toBe(true);
    await act(async () => resolvePrevious([previousCandidate]));
    await act(async () => Promise.resolve());
    await act(async () => renderEditor(true, requestScope('b')));

    const reopenedInput = getByLabelText(
      document.body,
      /delegations\.fields\.delegate/u
    ) as HTMLInputElement;
    expect(reopenedInput.value).toBe('');
    expect(queryByText(document.body, previousCandidate.displayName)).toBeNull();
  });
});
