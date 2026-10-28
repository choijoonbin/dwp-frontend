// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getByRole, getByText, queryByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalWorkflowOversightInspector } from './approval-workflow-oversight-inspector';

import type { ApprovalWorkflowOversightProjection } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'ko', language: 'ko' },
  }),
}));

const workflow: ApprovalWorkflowOversightProjection = {
  workflowId: '11111111-1111-1111-1111-111111111111',
  workflowKey: 'EXPENSE_APPROVAL',
  nameKo: '비용 결재',
  nameEn: 'Expense approval',
  category: 'FINANCE',
  dataClassification: 'CONFIDENTIAL',
  lifecycleState: 'PUBLISHED',
  currentVersion: 2,
  slaMinutes: 240,
  version: 3,
  updatedAt: '2026-10-27T00:00:00Z',
};

let root: Root;
let container: HTMLDivElement;

describe('approval workflow oversight inspector', () => {
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

  it('renders authorized metadata without edit or publish controls', async () => {
    await act(async () =>
      root.render(<ApprovalWorkflowOversightInspector workflow={workflow} locale="ko" />)
    );

    expect(getByText(container, 'admin.workflows.metadataOnly')).toBeTruthy();
    expect(getByRole(container, 'heading', { name: workflow.nameKo })).toBeTruthy();
    expect(getByText(container, workflow.workflowKey, { exact: false })).toBeTruthy();
    expect(queryByRole(container, 'button')).toBeNull();
  });
});
