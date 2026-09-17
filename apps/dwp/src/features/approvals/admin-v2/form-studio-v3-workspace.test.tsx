// @vitest-environment jsdom
import { act } from 'react';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FormStudioV3Workspace } from './form-studio-v3-workspace';
import { attention, facts, formCopy, healthy, metrics } from './admin-v2-test-fixtures';
import { createAdminV2TestHarness, type AdminV2TestHarness } from './admin-v2-test-harness';

const fields = [
  {
    id: 'field-1',
    key: 'request_reason',
    label: 'Request reason',
    typeLabel: 'Long text',
    helpText: 'Explain the business purpose.',
    required: true,
    spanLabel: 'Full width',
    classificationLabel: 'Internal',
    status: healthy,
    facts,
  },
  {
    id: 'field-2',
    key: 'estimated_cost',
    label: 'Estimated cost',
    typeLabel: 'Currency',
    required: false,
    spanLabel: 'Half width',
    classificationLabel: 'Confidential',
    status: attention,
    facts,
  },
] as const;

const baseProps = {
  copy: formCopy,
  metrics,
  formName: 'Privileged access request',
  versionLabel: 'Draft v4',
  formStatus: attention,
  dirtyLabel: 'Unsaved changes',
  schemaFacts: facts,
  fields,
  selectedFieldId: 'field-1',
  rules: [
    {
      id: 'rule-1',
      name: 'Require justification',
      expression: 'risk == HIGH => required(request_reason)',
      explanation: 'High-risk requests require an explicit justification.',
      scopeLabel: 'Submit rule',
      status: healthy,
    },
  ],
  validation: [
    {
      id: 'validation-1',
      title: 'Localized labels complete',
      detail: 'KO and EN labels are present.',
      location: 'schema.fields',
      status: healthy,
    },
  ],
  reviewChanges: [
    {
      id: 'change-1',
      label: 'Classification',
      beforeValue: 'Internal',
      afterValue: 'Confidential',
      status: attention,
    },
  ],
  validationScore: 100,
  validationScoreLabel: '100%',
} as const;

describe('APR-18 Form Studio V3 workspace', () => {
  let harness: AdminV2TestHarness;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    harness = createAdminV2TestHarness();
  });

  afterEach(async () => {
    await harness.destroy();
    vi.unstubAllGlobals();
  });

  function props(view: 'builder' | 'rules' | 'validation' | 'review' = 'builder') {
    return {
      ...baseProps,
      state: 'ready' as const,
      view,
      addFieldReady: false,
      addFieldDisabledReason: 'Complete field input is required.',
      editFieldReady: true,
      saveDraftReady: true,
      submitReviewReady: true,
      onViewChange: vi.fn(),
      onSelectField: vi.fn(),
      onAddField: vi.fn(),
      onEditField: vi.fn(),
      onCloneField: vi.fn(),
      onMoveField: vi.fn(),
      onDeleteField: vi.fn(),
      onSaveDraft: vi.fn(),
      onRunValidation: vi.fn(),
      onSubmitReview: vi.fn(),
      onRetry: vi.fn(),
      onResolveConflict: vi.fn(),
    };
  }

  it('wires builder selection, draft, validation, and governed review commands', async () => {
    const current = props();
    await harness.render(<FormStudioV3Workspace {...current} />);

    await act(async () => {
      fireEvent.click(getByRole(harness.node, 'button', { name: /2\. Estimated cost/u }));
      fireEvent.click(getByRole(harness.node, 'button', { name: formCopy.addFieldLabel }));
      fireEvent.click(getByRole(harness.node, 'button', { name: formCopy.saveDraftLabel }));
      fireEvent.click(getByRole(harness.node, 'button', { name: formCopy.validateLabel }));
      fireEvent.click(getByRole(harness.node, 'button', { name: formCopy.submitReviewLabel }));
    });

    expect(current.onSelectField).toHaveBeenCalledWith('field-2');
    expect(current.onAddField).not.toHaveBeenCalled();
    expect(harness.node.textContent).toContain(current.addFieldDisabledReason);
    expect(current.onSaveDraft).toHaveBeenCalledTimes(1);
    expect(current.onRunValidation).toHaveBeenCalledTimes(1);
    expect(current.onSubmitReview).toHaveBeenCalledTimes(1);
    expect(
      getByRole<HTMLButtonElement>(harness.node, 'button', { name: formCopy.mobileReviewLabel })
        .disabled
    ).toBe(true);
  });

  it('renders deterministic validation and switches views through typed callbacks', async () => {
    const current = props('validation');
    await harness.render(<FormStudioV3Workspace {...current} />);
    expect(getByRole(harness.node, 'progressbar').getAttribute('aria-valuenow')).toBe('100');
    await act(async () =>
      fireEvent.click(getByRole(harness.node, 'tab', { name: formCopy.reviewTab }))
    );
    expect(current.onViewChange).toHaveBeenCalledWith('review');
  });

  it('preserves review evidence during a 409 and requires an explicit version refresh', async () => {
    const current = props('review');
    await harness.render(<FormStudioV3Workspace {...current} state="conflict" />);
    expect(getByRole(harness.node, 'table', { name: formCopy.reviewTitle }).textContent).toContain(
      'Confidential'
    );
    const submit = getByRole<HTMLButtonElement>(harness.node, 'button', {
      name: formCopy.submitReviewLabel,
    });
    expect(submit.disabled).toBe(true);
    await act(async () =>
      fireEvent.click(getByRole(harness.node, 'button', { name: formCopy.state.conflictAction }))
    );
    expect(current.onResolveConflict).toHaveBeenCalledTimes(1);
  });
});
