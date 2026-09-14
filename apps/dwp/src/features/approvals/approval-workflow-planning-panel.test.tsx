// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  fireEvent,
  getByLabelText,
  getByRole,
  queryByLabelText,
  queryByRole,
} from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '@dwp-frontend/shared-utils/axios-instance';
import {
  planningAuthorityFixture,
  planningIds,
  planningResultFixture,
  planningSelectionFixture,
} from '@dwp-frontend/shared-utils/test-utils/approval-workflow-planning-fixtures';
import { planningFormDetailFixture } from '@dwp-frontend/shared-utils/test-utils/approval-workflow-planning-form-fixture';
import { compileApprovalTypedForm } from './approval-form-typed-compiler';
import { ApprovalWorkflowPlanningPanel } from './approval-workflow-planning-panel';
import type { ApprovalWorkflowPlanningOwner } from './approval-workflow-planning-model';
import type { ApprovalTypedFormSchema } from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

const mocks = vi.hoisted(() => ({
  auth: {} as Record<string, unknown>,
  authority: {} as Record<string, unknown>,
  page: {} as Record<string, unknown>,
  projections: [] as unknown[],
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useAuth: () => mocks.auth,
  useProductSurfaceAuthority: () => mocks.authority,
}));
vi.mock('../../components/allowed-product-surface-context', () => ({
  useOptionalAllowedProductSurface: () => mocks.page,
}));
vi.mock('../../routes/product-surface-authorization.generated', () => ({
  get PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS() {
    return mocks.projections;
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
}));

describe('actual planning panel, hook and DATA consumer with explicit unit-only11 metadata', () => {
  let container: HTMLDivElement;
  let root: Root;
  let owner: ApprovalWorkflowPlanningOwner;
  let fetch: ReturnType<typeof vi.fn>;
  let result: ReturnType<typeof planningResultFixture>;
  let releasePost: (() => void) | undefined;
  let selectionStatus: number;
  const render = async () => {
    await act(async () => {
      root.render(
        <StrictMode>
          <ApprovalWorkflowPlanningPanel owner={owner} />
        </StrictMode>
      );
    });
  };
  const settle = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
  };
  beforeEach(async () => {
    vi.stubGlobal('crypto', webcrypto);
    resetCsrfToken();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const fixture = planningAuthorityFixture();
    mocks.auth = { user: { tenantId: 42, userId: 99 } };
    mocks.authority = {
      status: 'ready',
      snapshot: fixture.source.snapshot,
      evaluateProduct: async (request: { routeContractKey: string }) => {
        const evaluation = structuredClone(fixture.evaluation);
        if (request.routeContractKey.includes('simulation'))
          evaluation.context!.effectiveGrants.forEach((grant) => {
            if (grant.grantKind === 'CAPABILITY')
              grant.predicatePolicyKeys = ['predicate.approval.workflow-planning-simulation.v1'];
          });
        return evaluation;
      },
    };
    mocks.page = { context: fixture.evaluation.context, scope: fixture.evaluation.scope };
    mocks.projections = fixture.source.projections;
    owner = {
      workflowId: planningIds.workflow,
      workflowRevision: 7,
      workflowSha256: 'a'.repeat(64),
      definition: {
        schemaContract: 'DWP_APPROVAL_WORKFLOW_QUORUM_V2',
        schemaVersion: 2,
        slaMinutes: 60,
        stages: [
          {
            key: 'FINANCE',
            name: 'Finance',
            candidateRole: 'FINANCE_REVIEWER',
            quorum: { mode: 'PERCENT', value: 67 },
            slaMinutes: 15,
            predecessors: [],
          },
        ],
      },
    };
    const form = planningFormDetailFixture();
    const compiled = await compileApprovalTypedForm(form.schema as ApprovalTypedFormSchema);
    form.schemaHash = compiled.schemaSha256;
    const selection = planningSelectionFixture();
    selection.forms[0]!.formSchemaSha256 = compiled.schemaSha256;
    result = planningResultFixture();
    releasePost = undefined;
    selectionStatus = 200;
    const response = (data: unknown, status = 200) =>
      new Response(JSON.stringify({ data }), { status });
    fetch = vi.fn(async (url: string) => {
      if (url.includes('/csrf')) return response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' });
      if (url.includes('/planning-selection'))
        return response(
          {
            ...selection,
            selectedFormId: url.includes('formId=') ? planningIds.form : null,
          },
          selectionStatus
        );
      if (url.includes('/simulation')) {
        if (releasePost)
          await new Promise<void>((resolve) => {
            releasePost = resolve;
          });
        return response(result);
      }
      if (url.includes(`/forms/${planningIds.form}`)) return response(form);
      if (url.includes('/forms')) return response([form.form]);
      throw new Error('Unexpected HTTP');
    });
    vi.stubGlobal('fetch', fetch);
  });
  afterEach(async () => {
    releasePost?.();
    await act(async () => root.unmount());
    container.remove();
    resetCsrfToken();
    vi.unstubAllGlobals();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });
  const choose = async () => {
    await render();
    await settle();
    await act(async () => {
      fireEvent.mouseDown(getByRole(container, 'combobox', { name: 'admin.planning.form' }));
    });
    await act(async () => {
      fireEvent.click(
        getByRole(document.body, 'option', { name: 'admin.planning.formVersionLabel' })
      );
    });
    await settle();
    await act(async () => {
      fireEvent.change(getByLabelText(container, /Summary/u), {
        target: { value: 'Planning sample' },
      });
    });
  };
  it('Source10 alone renders unavailable and makes zero HTTP calls in StrictMode', async () => {
    mocks.projections = mocks.projections.filter(
      (value) => !(value as { routeContractKey: string }).routeContractKey.includes('selection')
    );
    await render();
    await settle();
    expect(container.textContent).toContain('admin.planning.legacyUnavailable');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('renders real form sample and truthful ceiling preview; edits clear prior results', async () => {
    await choose();
    await act(async () => {
      fireEvent.change(getByLabelText(container, 'Amount'), { target: { value: '20.00' } });
    });
    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: 'admin.planning.run' }));
    });
    await settle();
    expect(container.textContent).toContain('admin.planning.rolePoolPreview');
    expect(container.textContent).toContain('admin.planning.noRuntimeEligibility');
    expect(container.querySelector('dd')?.textContent).toBe('3');
    await act(async () => {
      fireEvent.change(getByLabelText(container, 'Amount'), { target: { value: '50' } });
    });
    expect(container.textContent).not.toContain('admin.planning.rolePoolPreview');
  });
  it('owner advance while POST is pending discards late preview', async () => {
    await choose();
    releasePost = () => {};
    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: 'admin.planning.run' }));
    });
    await settle();
    owner = { ...owner, workflowRevision: 8 };
    await render();
    releasePost?.();
    await settle();
    expect(container.textContent).not.toContain('admin.planning.rolePoolPreview');
  });
  it('keeps a zero pool warning honest and never shows a live approval command', async () => {
    Object.assign(result.stages[0]!, {
      activeMemberCount: 0,
      indicativeThreshold: null,
      poolWarning: 'EMPTY_POOL',
    });
    await choose();
    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: 'admin.planning.run' }));
    });
    await settle();
    expect(container.textContent).toContain('admin.planning.emptyPool');
    expect(queryByRole(container, 'button', { name: 'APPROVE' })).toBeNull();
  });
  it.each([403, 503])(
    'fresh selection %i closes POST and preserves private sample through explicit recovery',
    async (status) => {
      await choose();
      await act(async () => {
        fireEvent.change(getByLabelText(container, 'Amount'), { target: { value: '20.00' } });
      });
      selectionStatus = status;
      await act(async () => {
        fireEvent.click(getByRole(container, 'button', { name: 'admin.planning.run' }));
      });
      await settle();
      expect(fetch.mock.calls.filter(([url]) => String(url).includes('/simulation'))).toHaveLength(
        0
      );
      expect(
        (getByRole(container, 'button', { name: 'admin.planning.run' }) as HTMLButtonElement)
          .disabled
      ).toBe(true);
      if (status === 403) {
        expect(queryByLabelText(container, 'Amount')).toBeNull();
        expect(queryByLabelText(container, /Summary/u)).toBeNull();
        expect(container.textContent).not.toContain('Planning sample');
      } else {
        const amount = getByLabelText(container, 'Amount') as HTMLInputElement;
        expect(amount.disabled).toBe(true);
        expect(amount.value).toBe('20.00');
        expect((getByLabelText(container, /Summary/u) as HTMLInputElement).value).toBe(
          'Planning sample'
        );
      }
      selectionStatus = 200;
      await act(async () => {
        fireEvent.click(getByRole(container, 'button', { name: 'actions.retry' }));
      });
      await settle();
      if (status === 403) {
        await act(async () => {
          fireEvent.mouseDown(getByRole(container, 'combobox', { name: 'admin.planning.form' }));
        });
        await act(async () => {
          fireEvent.click(
            getByRole(document.body, 'option', { name: 'admin.planning.formVersionLabel' })
          );
        });
        await settle();
      }
      expect((getByLabelText(container, 'Amount') as HTMLInputElement).value).toBe('20.00');
      expect((getByLabelText(container, 'Amount') as HTMLInputElement).disabled).toBe(false);
      expect((getByLabelText(container, /Summary/u) as HTMLInputElement).value).toBe(
        'Planning sample'
      );
      await act(async () => {
        fireEvent.click(getByRole(container, 'button', { name: 'admin.planning.run' }));
      });
      await settle();
      const post = fetch.mock.calls.find(([url]) => String(url).includes('/simulation'))!;
      expect(JSON.parse(post[1].body).samplePayload.amount).toBe('20');
    }
  );
  it('same-form Retry503 retains filled user input readonly and reopens only after explicit fresh selection', async () => {
    await choose();
    await act(async () => {
      fireEvent.change(getByLabelText(container, 'Amount'), { target: { value: '45.25' } });
    });
    selectionStatus = 503;
    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: 'actions.retry' }));
    });
    await settle();
    expect((getByLabelText(container, /Summary/u) as HTMLInputElement).value).toBe(
      'Planning sample'
    );
    expect((getByLabelText(container, 'Amount') as HTMLInputElement).value).toBe('45.25');
    expect((getByLabelText(container, 'Amount') as HTMLInputElement).disabled).toBe(true);
    expect(
      (getByRole(container, 'button', { name: 'admin.planning.run' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/simulation'))).toHaveLength(0);
    selectionStatus = 200;
    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: 'actions.retry' }));
    });
    await settle();
    expect((getByLabelText(container, 'Amount') as HTMLInputElement).value).toBe('45.25');
    expect((getByLabelText(container, 'Amount') as HTMLInputElement).disabled).toBe(false);
    expect(
      (getByRole(container, 'button', { name: 'admin.planning.run' }) as HTMLButtonElement).disabled
    ).toBe(false);
  });
});
