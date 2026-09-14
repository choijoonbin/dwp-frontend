// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, getByLabelText, getByRole } from '@testing-library/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalRequestComposer } from './approval-request-composer';

import type { ApprovalForm } from '@dwp-frontend/shared-utils';

const dependencies = vi.hoisted(() => ({
  getPublishedApprovalForms: vi.fn(),
  getPublishedApprovalFormTemplate: vi.fn(),
  createApprovalRequest: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  scope: {
    current: {
      governed: true,
      ready: true,
      contextScopeKey: 'scope-a',
      cacheKey: ['tenant-a', 'user-a', 'NORMAL', 'approvals.work', 'scope-a', 'revision-a'],
      queryMeta: {
        accessSensitive: true,
        tenantId: 'tenant-a',
        actorId: 'user-a',
        accessMode: 'NORMAL',
        productId: 'approvals',
        surfaceId: 'approvals.work',
        contextScopeKey: 'scope-a',
        decisionRevision: 'revision-a',
      },
    },
  },
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
    getPublishedApprovalForms: dependencies.getPublishedApprovalForms,
    getPublishedApprovalFormTemplate: dependencies.getPublishedApprovalFormTemplate,
    createApprovalRequest: dependencies.createApprovalRequest,
    useToast: () => ({ success: dependencies.success, error: dependencies.error }),
  };
});

vi.mock('../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => dependencies.scope.current,
}));

vi.mock('./use-approval-governed-mutation', () => ({
  isProductSurfaceOperationCancelledError: () => false,
  useApprovalGovernedMutation: () =>
    vi.fn((operation: (execution: Record<string, never>) => Promise<unknown>) => operation({})),
}));

vi.mock('./approval-request-form-context', () => ({
  ApprovalQueryErrorAlert: ({ message }: { message: string }) => <div role="alert">{message}</div>,
  PublishedApprovalFormSelector: ({
    forms,
    onChange,
  }: {
    forms: ApprovalForm[];
    onChange: (formId: string) => void;
  }) => (
    <div data-testid="published-forms">
      {forms.map((form) => form.nameEn).join(',')}
      {forms[0] && (
        <button type="button" onClick={() => onChange(forms[0]!.formId)}>
          select published form
        </button>
      )}
    </div>
  ),
  PublishedApprovalTemplateSummary: () => null,
}));

const form = (suffix: string): ApprovalForm => ({
  formId: `form-${suffix}`,
  formKey: `FORM_${suffix.toUpperCase()}`,
  categoryId: 'category-1',
  categoryKey: 'GENERAL',
  categoryNameKo: '일반',
  categoryNameEn: 'General',
  nameKo: `양식 ${suffix}`,
  nameEn: `Form ${suffix}`,
  descriptionKo: '설명',
  descriptionEn: 'Description',
  ownerGroupRef: 'APPROVAL_OWNER',
  formKind: 'REQUEST',
  lifecycleState: 'PUBLISHED',
  currentVersion: 1,
  fieldCount: 0,
  routeCount: 1,
  usageCount: 0,
  version: 1,
  updatedAt: '2026-09-11T00:00:00Z',
});

const template = (suffix: string) => ({
  workflow: {
    workflowId: `workflow-${suffix}`,
    workflowKey: `WORKFLOW_${suffix.toUpperCase()}`,
    nameKo: `프로세스 ${suffix}`,
    nameEn: `Workflow ${suffix}`,
    descriptionKo: '',
    descriptionEn: '',
    category: 'GENERAL',
    dataClassification: 'INTERNAL',
    lifecycleState: 'PUBLISHED',
    currentVersion: 1,
    slaMinutes: 60,
    allowSelfApproval: false,
    version: 1,
    updatedAt: '2026-09-11T00:00:00Z',
  },
  routeDefinition: { steps: [] },
  form: {
    form: form(suffix),
    schema: { schemaVersion: 1, fields: [] },
  },
});

const persistedRequest = {
  requestId: 'request-a',
  requestNumber: 'APR-A',
  title: '',
  summary: '',
  workflowNameKo: '프로세스 A',
  workflowNameEn: 'Workflow A',
  totalSteps: 1,
  status: 'DRAFT' as const,
  priority: 'NORMAL' as const,
  dataClassification: 'INTERNAL',
  version: 1,
};

function scope(suffix: 'a' | 'b') {
  return {
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
  };
}

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

function renderComposer() {
  root.render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        MemoryRouter,
        { initialEntries: ['/approvals/requests/new'] },
        createElement(ApprovalRequestComposer)
      )
    )
  );
}

describe('ApprovalRequestComposer scope transition', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    dependencies.scope.current = {
      governed: true,
      ready: true,
      contextScopeKey: 'scope-a',
      cacheKey: ['tenant-a', 'user-a', 'NORMAL', 'approvals.work', 'scope-a', 'revision-a'],
      queryMeta: {
        accessSensitive: true,
        tenantId: 'tenant-a',
        actorId: 'user-a',
        accessMode: 'NORMAL',
        productId: 'approvals',
        surfaceId: 'approvals.work',
        contextScopeKey: 'scope-a',
        decisionRevision: 'revision-a',
      },
    };
    dependencies.getPublishedApprovalFormTemplate.mockImplementation((formId: string) =>
      Promise.resolve(template(formId.endsWith('B') ? 'B' : 'A'))
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('aborts the previous catalog and never restores its response or local draft', async () => {
    let resolvePrevious!: (forms: ApprovalForm[]) => void;
    let previousSignal: AbortSignal | undefined;
    dependencies.getPublishedApprovalForms.mockImplementation(
      (contextScopeKey: string, signal: AbortSignal) => {
        if (contextScopeKey === 'scope-b') return Promise.resolve([form('B')]);
        previousSignal = signal;
        return new Promise<ApprovalForm[]>((resolve) => {
          resolvePrevious = resolve;
        });
      }
    );

    await act(async () => renderComposer());
    await vi.waitFor(() =>
      expect(dependencies.getPublishedApprovalForms).toHaveBeenCalledWith(
        'scope-a',
        expect.any(AbortSignal)
      )
    );
    const title = getByLabelText(container, /requests\.fields\.title/u) as HTMLInputElement;
    await act(async () => fireEvent.change(title, { target: { value: 'scope-a draft' } }));
    expect(title.value).toBe('scope-a draft');

    dependencies.scope.current = {
      governed: true,
      ready: true,
      contextScopeKey: 'scope-b',
      cacheKey: ['tenant-b', 'user-b', 'NORMAL', 'approvals.work', 'scope-b', 'revision-b'],
      queryMeta: {
        accessSensitive: true,
        tenantId: 'tenant-b',
        actorId: 'user-b',
        accessMode: 'NORMAL',
        productId: 'approvals',
        surfaceId: 'approvals.work',
        contextScopeKey: 'scope-b',
        decisionRevision: 'revision-b',
      },
    };
    await act(async () => renderComposer());
    await vi.waitFor(() => expect(container.textContent).toContain('Form B'));

    expect(previousSignal?.aborted).toBe(true);
    expect(title.value).toBe('');
    await act(async () => resolvePrevious([form('A')]));
    await act(async () => Promise.resolve());
    expect(container.textContent).toContain('Form B');
    expect(container.textContent).not.toContain('Form A');
  });

  it('drops a delayed draft completion after an A to B to A scope replay', async () => {
    let resolvePrevious!: (request: typeof persistedRequest) => void;
    dependencies.getPublishedApprovalForms.mockImplementation((contextScopeKey: string) =>
      Promise.resolve([form(contextScopeKey === 'scope-b' ? 'B' : 'A')])
    );
    dependencies.createApprovalRequest.mockImplementation(
      () =>
        new Promise<typeof persistedRequest>((resolve) => {
          resolvePrevious = resolve;
        })
    );

    await act(async () => renderComposer());
    await vi.waitFor(() => expect(container.textContent).toContain('Form A'));
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'select published form' }))
    );
    await vi.waitFor(() =>
      expect(
        (getByRole(container, 'button', { name: 'actions.saveDraft' }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    );
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'actions.saveDraft' }))
    );
    await vi.waitFor(() => expect(dependencies.createApprovalRequest).toHaveBeenCalledTimes(1));

    dependencies.scope.current = scope('b');
    await act(async () => renderComposer());
    await vi.waitFor(() => expect(container.textContent).toContain('Form B'));
    dependencies.scope.current = scope('a');
    await act(async () => renderComposer());
    await vi.waitFor(() => expect(container.textContent).toContain('Form A'));

    await act(async () => resolvePrevious(persistedRequest));
    await act(async () => Promise.resolve());

    expect(dependencies.success).not.toHaveBeenCalled();
    expect(dependencies.error).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Form A');
  });
});
vi.mock('./use-approval-attachment-mutation', () => ({
  approvalAttachmentRouteInstalled: () => false,
  useApprovalAttachmentMutation: () => ({ available: false, run: vi.fn() }),
}));
