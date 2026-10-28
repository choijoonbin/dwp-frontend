// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getByRole, getByText, queryByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalFormOversightInspector } from './approval-form-oversight-inspector';

import type { ApprovalFormOversightProjection } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'ko', language: 'ko' },
  }),
}));

const form: ApprovalFormOversightProjection = {
  formId: '11111111-1111-1111-1111-111111111111',
  formKey: 'EXPENSE_FORM',
  categoryId: '22222222-2222-2222-2222-222222222222',
  categoryKey: 'FINANCE',
  categoryNameKo: '재무',
  categoryNameEn: 'Finance',
  nameKo: '비용 요청',
  nameEn: 'Expense request',
  formKind: 'REQUEST',
  lifecycleState: 'PUBLISHED',
  currentVersion: 2,
  fieldCount: 4,
  routeCount: 1,
  usageCount: 8,
  version: 3,
  updatedAt: '2026-10-27T00:00:00Z',
};

let root: Root;
let container: HTMLDivElement;

describe('approval form oversight inspector', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('renders the authorized metadata projection without edit or publish controls', async () => {
    await act(async () => root.render(<ApprovalFormOversightInspector form={form} locale="ko" />));

    expect(getByText(container, 'admin.formCatalog.inspector.metadataOnly')).toBeTruthy();
    expect(getByRole(container, 'heading', { name: form.nameKo })).toBeTruthy();
    expect(getByText(container, form.formKey, { exact: false })).toBeTruthy();
    expect(queryByRole(container, 'button')).toBeNull();
  });
});
