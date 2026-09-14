// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByLabelText, getByRole, queryByText } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalPublishedFormPreview } from './approval-form-published-preview';
import { compileApprovalTypedForm } from './approval-form-typed-compiler';
import { typedEditorSeed } from './approval-form-builder-typed-model';
import type { ApprovalFormDetail } from '@dwp-frontend/shared-utils/api/approval-management-contract';
import type { ApprovalFormUserBinding } from '@dwp-frontend/shared-utils/api/approval-form-user-api';

type PickerProps = {
  binding?: ApprovalFormUserBinding;
  value: string;
  label: string;
  onChange: (value: string) => void;
  onSourceReadyChange?: (state: { ready: boolean; validUntil?: string }) => void;
};
const state = vi.hoisted(() => ({
  scope: {
    governed: true,
    ready: true,
    contextScopeKey: 'admin-scope',
    cacheKey: ['tenant', 'actor', 'NORMAL', 'approvals.admin', 'admin-scope', 'revision-a'],
    queryMeta: { decisionRevision: 'revision-a' },
  },
  picker: vi.fn<(props: PickerProps) => void>(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => state.scope,
}));
vi.mock('./approval-request-user-picker', () => ({
  ApprovalRequestUserPicker: (props: PickerProps) => {
    state.picker(props);
    const { value, onSourceReadyChange } = props;
    useEffect(() => {
      onSourceReadyChange?.({
        ready: true,
        validUntil: value ? new Date(Date.now() + 30_000).toISOString() : undefined,
      });
    }, [value, onSourceReadyChange]);
    return (
      <button onClick={() => props.onChange('44444444-4444-4444-4444-444444444444')}>
        {props.label}
      </button>
    );
  },
}));

let root: Root;
let container: HTMLDivElement;
const source = async () => {
  const seed = typedEditorSeed('요약', 'Summary');
  const schema = {
    ...seed,
    fields: [
      ...seed.fields,
      {
        key: 'reviewer',
        type: 'USER' as const,
        labelKo: '검토자',
        labelEn: 'Reviewer',
        required: true,
      },
    ],
  };
  const compiled = await compileApprovalTypedForm(schema);
  const detail: ApprovalFormDetail = {
    form: {
      formId: '11111111-1111-1111-1111-111111111111',
      lifecycleState: 'PUBLISHED',
      nameKo: '양식',
      nameEn: 'Form',
      formKey: 'TEST_FORM',
      categoryId: 'category',
      categoryKey: 'TEST',
      categoryNameKo: '테스트',
      categoryNameEn: 'Test',
      descriptionKo: '테스트 양식',
      descriptionEn: 'Test form',
      ownerGroupRef: 'APPROVAL_DESIGNER',
      formKind: 'REQUEST',
      currentVersion: 1,
      fieldCount: schema.fields.length,
      routeCount: 0,
      usageCount: 0,
      version: 1,
      updatedAt: '2026-09-14T00:00:00Z',
    },
    schema,
    schemaHash: compiled.schemaSha256,
    routes: [],
    formVersionId: '22222222-2222-2222-2222-222222222222',
  };
  return { detail, compiled };
};

describe('published ADMIN preview source fencing', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    state.scope.governed = true;
    state.scope.ready = true;
    state.picker.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });
  it('never mounts the live picker for legacy, unavailable, mismatched-context or unpublished source', async () => {
    const { detail, compiled } = await source();
    const render = async (ready = true, cacheKey = state.scope.cacheKey, item = detail) => {
      await act(async () =>
        root.render(
          <ApprovalPublishedFormPreview
            detail={item}
            compiled={compiled}
            sourceReady={ready}
            sourceCacheKey={cacheKey}
            korean={false}
          />
        )
      );
      expect(state.picker).not.toHaveBeenCalled();
      expect(container.textContent).toContain('admin.typedForm.userSourceUnavailable');
    };
    state.scope.governed = false;
    await render();
    state.scope.governed = true;
    state.scope.ready = false;
    await render();
    state.scope.ready = true;
    await render(false);
    await render(true, ['previous-context']);
    await render(true, state.scope.cacheKey, {
      ...detail,
      form: { ...detail.form, lifecycleState: 'DRAFT' },
    });
  });
  it('clears selected sample USER and successful validation on the first source failure', async () => {
    const { detail, compiled } = await source();
    await act(async () =>
      root.render(
        <ApprovalPublishedFormPreview
          detail={detail}
          compiled={compiled}
          sourceReady
          sourceCacheKey={state.scope.cacheKey}
          korean={false}
        />
      )
    );
    await act(async () =>
      fireEvent.change(getByLabelText(container, /^Summary/), { target: { value: 'Review' } })
    );
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Reviewer' })));
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'admin.typedForm.previewValidate' }))
    );
    expect(queryByText(container, 'admin.typedForm.previewValid')).not.toBeNull();
    const props = state.picker.mock.lastCall![0];
    expect(props.binding).toEqual({
      surface: 'ADMIN',
      formId: detail.form.formId,
      formVersionId: detail.formVersionId,
      schemaSha256: compiled.schemaSha256,
      fieldKey: 'reviewer',
    });
    expect(props.binding).not.toHaveProperty('requestId');
    await act(async () => props.onSourceReadyChange?.({ ready: false }));
    expect(state.picker.mock.lastCall![0].value).toBe('');
    expect(queryByText(container, 'admin.typedForm.previewValid')).toBeNull();
    expect((getByLabelText(container, /^Summary/) as HTMLInputElement).value).toBe('Review');
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'admin.typedForm.previewValidate' }))
    );
    expect(container.textContent).toContain('admin.typedForm.previewInvalid');
  });
  it('resets samples when the exact published version changes despite an unchanged schema hash', async () => {
    const { detail, compiled } = await source();
    const render = async (item: ApprovalFormDetail) => {
      await act(async () =>
        root.render(
          <ApprovalPublishedFormPreview
            detail={item}
            compiled={compiled}
            sourceReady
            sourceCacheKey={state.scope.cacheKey}
            korean={false}
          />
        )
      );
    };
    await render(detail);
    await act(async () =>
      fireEvent.change(getByLabelText(container, /^Summary/), { target: { value: 'Old sample' } })
    );
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Reviewer' })));
    await render({ ...detail, formVersionId: '33333333-3333-3333-3333-333333333333' });
    expect((getByLabelText(container, /^Summary/) as HTMLInputElement).value).toBe('');
    expect(state.picker.mock.lastCall![0].value).toBe('');
  });
  it('rechecks candidate expiry synchronously at validation, before a timer can revoke the displayed value', async () => {
    const { detail, compiled } = await source();
    await act(async () =>
      root.render(
        <ApprovalPublishedFormPreview
          detail={detail}
          compiled={compiled}
          sourceReady
          sourceCacheKey={state.scope.cacheKey}
          korean={false}
        />
      )
    );
    await act(async () =>
      fireEvent.change(getByLabelText(container, /^Summary/), { target: { value: 'Review' } })
    );
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Reviewer' })));
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 30_001);
    try {
      await act(async () =>
        fireEvent.click(getByRole(container, 'button', { name: 'admin.typedForm.previewValidate' }))
      );
      expect(queryByText(container, 'admin.typedForm.previewValid')).toBeNull();
      expect(queryByText(container, 'admin.typedForm.previewInvalid')).not.toBeNull();
    } finally {
      clock.mockRestore();
    }
  });
});
