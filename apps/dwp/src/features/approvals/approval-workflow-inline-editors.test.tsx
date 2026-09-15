// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByLabelText, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalWorkflowInlineEditor } from './approval-workflow-inline-editor';
import { APPROVAL_TYPED_WORKFLOW_CONTRACT } from './approval-workflow-typed-model';
import { ApprovalWorkflowTypedInlineEditor } from './approval-workflow-typed-inline-editor';

import type { ApprovalWorkflowDraft } from './approval-workflow-model';
import type { ApprovalWorkflowConditionSource } from './approval-workflow-typed-source';
import type { ApprovalTypedWorkflowDraft } from './approval-workflow-typed-workspace-model';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { field?: string; count?: number }) =>
      options?.field ?? (options?.count === undefined ? key : `${key}:${options.count}`),
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
}));

const source = {
  selectedId: '',
  pin: null,
  available: false,
  compiled: undefined,
  changed: false,
  forms: [],
  busy: false,
  select: vi.fn(),
  reload: vi.fn(),
  isCurrent: vi.fn(() => false),
  verify: vi.fn(),
} as unknown as ApprovalWorkflowConditionSource;

const legacyDraft = (): ApprovalWorkflowDraft => ({
  workflowKey: 'EXPENSE_APPROVAL',
  nameKo: '비용 결재',
  nameEn: 'Expense approval',
  descriptionKo: '비용 검토',
  descriptionEn: 'Expense review',
  category: 'FINANCE',
  dataClassification: 'CONFIDENTIAL',
  slaMinutes: 120,
  ownerGroupRef: 'APPROVAL_OPERATOR',
  steps: [
    {
      key: 'REVIEW_1',
      name: '',
      mode: 'ANY',
      candidateRole: 'APPROVAL_OPERATOR',
      slaMinutes: 30,
    },
    {
      key: 'REVIEW_2',
      name: 'Security review',
      mode: 'ANY',
      candidateRole: 'SECURITY_REVIEWER',
      slaMinutes: 30,
    },
  ],
});

const typedDraft = (): ApprovalTypedWorkflowDraft => ({
  workflowKey: 'EXPENSE_APPROVAL',
  nameKo: '',
  nameEn: 'Expense approval',
  descriptionKo: '비용 검토',
  descriptionEn: 'Expense review',
  category: 'FINANCE',
  dataClassification: 'CONFIDENTIAL',
  slaMinutes: 120,
  ownerGroupRef: 'APPROVAL_OPERATOR',
  typedDefinition: {
    schemaContract: APPROVAL_TYPED_WORKFLOW_CONTRACT,
    schemaVersion: 2,
    slaMinutes: 120,
    stages: [
      {
        key: 'REVIEW_1',
        name: 'Manager review',
        candidateRole: 'APPROVAL_OPERATOR',
        quorum: { mode: 'ANY' },
        slaMinutes: 30,
        predecessors: [],
      },
      {
        key: 'REVIEW_2',
        name: 'Security review',
        candidateRole: 'SECURITY_REVIEWER',
        quorum: { mode: 'ANY' },
        slaMinutes: 30,
        predecessors: ['REVIEW_1'],
      },
    ],
  },
});

function LegacyHarness() {
  const [draft, setDraft] = useState(legacyDraft);
  return (
    <ApprovalWorkflowInlineEditor
      workspaceKey="legacy"
      library={<div>library</div>}
      draft={draft}
      editing
      creating={false}
      busy={false}
      writeReady
      sourceConflict={false}
      readRetrying={false}
      lifecycle="DRAFT"
      canEdit
      canPublish={false}
      publishing={false}
      onChange={setDraft}
      onEdit={() => undefined}
      onSave={() => undefined}
      onCancel={() => undefined}
      onPublish={() => undefined}
      onRetryRead={() => undefined}
    />
  );
}

function TypedHarness() {
  const [draft, setDraft] = useState(typedDraft);
  return (
    <ApprovalWorkflowTypedInlineEditor
      workspaceKey="typed"
      library={<div>library</div>}
      draft={draft}
      editing
      creating={false}
      busy={false}
      writeReady
      sourceConflict={false}
      readRetrying={false}
      lifecycle="DRAFT"
      canEdit
      canPublish={false}
      publishing={false}
      source={source}
      onChange={setDraft}
      onEdit={() => undefined}
      onSave={() => undefined}
      onCancel={() => undefined}
      onPublish={() => undefined}
      onRetryRead={() => undefined}
    />
  );
}

describe('approval workflow mobile inspector focus', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    Element.prototype.scrollIntoView = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('focuses legacy stage properties, restores the row and jumps to the exact invalid input', async () => {
    await act(async () => root.render(<LegacyHarness />));
    const second = container.querySelector<HTMLElement>('[data-approval-stage="1"]')!;
    await act(async () => fireEvent.click(second));
    expect(document.activeElement).toBe(getByLabelText(container, 'admin.studio.stepKey'));

    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'admin.studio.backToRoute' }))
    );
    expect(document.activeElement).toBe(
      container.querySelector('[data-approval-stage="1"]')
    );

    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'admin.studio.stepName' }))
    );
    expect(document.activeElement).toBe(getByLabelText(container, 'admin.studio.stepName'));
  });

  it('focuses typed stage properties, restores the exact row and jumps to metadata errors', async () => {
    await act(async () => root.render(<TypedHarness />));
    const second = container.querySelector<HTMLElement>('[data-approval-typed-stage="REVIEW_2"]')!;
    await act(async () => fireEvent.click(second));
    expect(document.activeElement).toBe(getByLabelText(container, 'admin.studio.stepKey'));

    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'admin.studio.backToRoute' }))
    );
    expect(document.activeElement).toBe(
      container.querySelector('[data-approval-typed-stage="REVIEW_2"]')
    );

    await act(async () =>
      fireEvent.click(
        getByRole(container, 'button', { name: 'admin.typedWorkflow.validationFailed' })
      )
    );
    expect(document.activeElement).toBe(getByLabelText(container, 'admin.studio.nameKo'));
  });
});
