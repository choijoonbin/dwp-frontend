// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole, queryByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalPolicySummary } from './approval-policy-presentation';
import {
  ApprovalPolicyDetail,
  ApprovalPolicyInspector,
  ApprovalPolicyListItem,
} from './approval-policy-workspace';

import type { ComponentProps } from 'react';
import type { ApprovalPolicy, ApprovalPolicyVersion } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; userId?: number }) =>
      options?.userId != null ? `${key} ${options.userId}` : (options?.defaultValue ?? key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));
const policy: ApprovalPolicy = {
  policyId: '11111111-1111-4111-8111-111111111111',
  policyKey: 'BLOCK_SELF_APPROVAL',
  nameKo: '요청자 승인 분리',
  nameEn: 'Separate requester and approver',
  policyType: 'SEGREGATION_OF_DUTIES',
  enforcementMode: 'WARN',
  severity: 'HIGH',
  lifecycleState: 'ACTIVE',
  version: 0,
  rule: { requesterCannotDecide: false, legacy: ['Finance', 'Risk'] },
  pendingReview: true,
  pendingEnforcementMode: 'BLOCK',
  pendingSeverity: 'CRITICAL',
  pendingLifecycleState: 'ACTIVE',
  pendingRule: { requesterCannotDecide: true },
  pendingBy: 31,
  pendingAt: '2026-09-14T00:00:00Z',
  pendingChangeReason: 'Review the stronger self-approval control',
};
const version: ApprovalPolicyVersion = {
  policyVersionId: '22222222-2222-4222-8222-222222222222',
  versionNumber: 1,
  enforcementMode: 'WARN',
  severity: 'HIGH',
  lifecycleState: 'ACTIVE',
  rule: policy.rule,
  changeReason: 'Actual published rationale',
  submittedBy: 30,
  submittedAt: '2026-09-13T00:00:00Z',
  publishedBy: 32,
  publishedAt: '2026-09-13T00:00:00Z',
  reviewComment: 'Actual independent review evidence',
};
let node: HTMLDivElement;
let root: Root;
async function render(content: Parameters<Root['render']>[0]) {
  await act(async () => root.render(content));
}
function inspector(overrides: Partial<ComponentProps<typeof ApprovalPolicyInspector>> = {}) {
  return (
    <ApprovalPolicyInspector
      policy={policy}
      versions={[version]}
      versionsLoading={false}
      versionsError={false}
      versionsFetching={false}
      publishedVersionLabel="v1"
      canEdit
      canReview
      makerBlocked={false}
      onEdit={() => {}}
      onReview={() => {}}
      onRetryVersions={() => {}}
      impact={<section aria-label="actual impact">actual impact</section>}
      {...overrides}
    />
  );
}
describe('APR15 native policy presentation', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    node = document.createElement('div');
    document.body.append(node);
    root = createRoot(node);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    node.remove();
    vi.unstubAllGlobals();
  });
  it('derives all five summary counts exclusively from current rows, not draft severity or proposal modes', async () => {
    await render(
      <ApprovalPolicySummary
        policies={[
          policy,
          {
            ...policy,
            policyId: '2',
            pendingReview: false,
            policyType: 'SLA',
            enforcementMode: 'BLOCK',
            lifecycleState: 'DISABLED',
          },
          { ...policy, policyId: '3', pendingReview: false, policyType: 'DATA' },
        ]}
      />
    );
    expect(Array.from(node.querySelectorAll('dd'), (entry) => entry.textContent)).toEqual([
      '3',
      '1',
      '1',
      '2',
      '1',
    ]);
    expect(node.querySelectorAll('dt')).toHaveLength(5);
  });
  it('renders truthful zero summaries for an empty scoped result', async () => {
    await render(<ApprovalPolicySummary policies={[]} />);
    expect(Array.from(node.querySelectorAll('dd'), (entry) => entry.textContent)).toEqual([
      '0',
      '0',
      '0',
      '0',
      '0',
    ]);
  });
  it('shows exactly one comparison with original stored values, removed keys and the actual version label', async () => {
    await render(
      <ApprovalPolicyDetail
        policy={policy}
        publishedVersionLabel="admin.studio.unpublishedVersion"
      />
    );
    const table = getByRole(node, 'table', { name: 'admin.studio.changeComparison' });
    expect(node.querySelectorAll('[role="table"]')).toHaveLength(1);
    expect(table.textContent).toContain('admin.studio.unpublishedVersion');
    expect(table.textContent).toContain('Finance, Risk');
    expect(table.textContent).toContain('false');
    expect(table.textContent).toContain('true');
    expect(node.textContent).toContain(policy.pendingChangeReason);
    expect(node.textContent).not.toMatch(/v3\.2|100%|assigned publisher/iu);
  });
  it('does not present a fabricated proposal or retained pending metadata when no proposal exists', async () => {
    await render(
      <ApprovalPolicyDetail
        policy={{ ...policy, pendingReview: false }}
        publishedVersionLabel="v1"
      />
    );
    expect(queryByRole(node, 'columnheader', { name: /admin.studio.proposedValue/u })).toBeNull();
    expect(node.textContent).not.toContain(policy.pendingChangeReason);
    expect(getByRole(node, 'region', { name: 'admin.studio.ruleTitle' })).toBeDefined();
  });
  it('keeps impact before publication history and renders only real review evidence', async () => {
    await render(inspector());
    const impact = getByRole(node, 'region', { name: 'actual impact' });
    const history = getByRole(node, 'region', { name: 'admin.studio.historyTitle' });
    expect(impact.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(node.textContent).toContain(version.reviewComment);
    expect(node.textContent).toContain('admin.studio.pendingMaker 31');
  });
  it('retains independent maker blocking and suppresses commands when authority is unavailable', async () => {
    const review = vi.fn();
    await render(inspector({ makerBlocked: true, onReview: review }));
    const button = getByRole<HTMLButtonElement>(node, 'button', {
      name: 'admin.studio.reviewAndPublish',
    });
    expect(button.disabled).toBe(true);
    await act(async () => fireEvent.click(button));
    expect(review).not.toHaveBeenCalled();
    await render(inspector({ canEdit: false, canReview: false }));
    expect(queryByRole(node, 'button', { name: 'admin.studio.reviewAndPublish' })).toBeNull();
    expect(queryByRole(node, 'button', { name: 'admin.studio.configurePolicy' })).toBeNull();
  });
  it('hides stale history on first failure and keeps retry and version-unavailable publication blocking', async () => {
    await render(
      inspector({
        versionsError: true,
        publishedVersionLabel: 'admin.studio.policyVersionUnavailable',
      })
    );
    expect(node.textContent).not.toContain(version.reviewComment);
    expect(
      getByRole<HTMLButtonElement>(node, 'button', { name: 'admin.studio.reviewAndPublish' })
        .disabled
    ).toBe(true);
    expect(getByRole(node, 'button', { name: 'actions.retry' })).toBeDefined();
  });
  it('exposes keyboard selection/current state and uses the requested locale without truncating the policy name', async () => {
    const select = vi.fn();
    await render(
      <ul>
        <ApprovalPolicyListItem policy={policy} selected locale="ko" onSelect={select} />
      </ul>
    );
    const button = getByRole(node, 'button');
    expect(button.getAttribute('aria-current')).toBe('true');
    expect(button.textContent).toContain(policy.nameKo);
    await act(async () => fireEvent.click(button));
    expect(select).toHaveBeenCalledTimes(1);
  });
});
