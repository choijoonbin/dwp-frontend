import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { NotificationAttentionGovernanceStudio } from './notification-attention-governance-studio';

import type { NotificationAttentionGovernanceCopy } from './notification-attention-governance-studio';
import type {
  NotificationAttentionGovernanceRevision,
  NotificationAttentionGovernanceWorkspace,
} from '@dwp-frontend/shared-utils/api/notification-attention-governance-api';

const copy: NotificationAttentionGovernanceCopy = {
  title: 'Attention governance studio',
  description: 'Govern tenant attention controls with independent approval.',
  liveStatus: 'Published',
  draftStatus: 'Draft review',
  loading: 'Loading governance',
  loadErrorTitle: 'Governance unavailable',
  retry: 'Retry',
  emptyTitle: 'Governance is not initialized',
  emptyDescription: 'A server-authoritative baseline is required before creating a draft.',
  ruleLimitsTitle: 'User rule limits',
  ruleLimitsDescription: 'Set explicit tenant limits.',
  maxActiveRules: 'Maximum active rules',
  maxVipRules: 'Maximum VIP rules',
  maxFollowRules: 'Maximum follow rules',
  topicTitle: 'Approved topic allowlist',
  topicDescription: 'Only canonical topics can be selected.',
  topicInputLabel: 'Topic token',
  addTopic: 'Add topic',
  removeTopic: (topic) => `Remove ${topic}`,
  policyTitle: 'Policy and privacy guardrails',
  mandatoryPrecedence: 'Mandatory policy precedence',
  mandatoryPrecedenceDetail: 'Mandatory policies override user mute rules.',
  minimumCohort: 'Minimum analytics cohort',
  minimumCohortDetail: 'Smaller cohorts remain private.',
  independentReviewer: 'Independent reviewer required',
  independentReviewerDetail: 'The author cannot approve the same revision.',
  changeReason: 'Change reason',
  saveDraft: 'Create draft',
  pipelineTitle: 'Independent approval pipeline',
  pipelineDescription: 'Drafts require a separate reviewer.',
  activeRevision: 'Active revision',
  noActiveRevision: 'No active revision',
  draftRevision: 'Draft revision',
  createdBy: (id) => `Created by ${id}`,
  approvedBy: (id) => `Approved by ${id}`,
  version: (revision, version) => `Revision ${revision}, version ${version}`,
  stateLabel: (state) => state,
  decisionReason: 'Decision reason',
  publish: 'Publish',
  reject: 'Reject',
  withdraw: 'Withdraw',
  selfApprovalBlocked: 'Authors cannot approve their own revision.',
  guardrailBlocked: 'Required guardrails are disabled.',
  permissionBlocked: 'Approval permission is required.',
  pendingDraftBlocked: 'The open draft is immutable until it is decided.',
  mutationError: 'The governance change failed.',
};

function revision(
  state: NotificationAttentionGovernanceRevision['state'],
  creator = 17
): NotificationAttentionGovernanceRevision {
  return {
    governanceId: 'governance-1',
    state,
    settings: {
      maxActiveUserRules: 32,
      maxVipRules: 8,
      maxFollowRules: 21,
      approvedTopicAllowlist: ['#sec-soc-alert', '#infra-deploy'],
      mandatoryPolicyPrecedence: true,
      minimumAnalyticsCohort: 25,
      independentReviewerRequired: true,
    },
    revisionNumber: 4,
    version: '1',
    changeReason: 'Protect high-signal tenant attention rules',
    createdBy: creator,
    createdAt: '2026-09-17T00:00:00Z',
    updatedBy: creator,
    updatedAt: '2026-09-17T00:00:00Z',
  };
}

function workspace(drafts: NotificationAttentionGovernanceRevision[] = []) {
  return {
    activeRevision: drafts.length ? null : revision('PUBLISHED', 12),
    drafts,
    changeVersion: '4',
    generatedAt: '2026-09-17T00:00:00Z',
  } satisfies NotificationAttentionGovernanceWorkspace;
}

const callbacks = {
  onCreateDraft: vi.fn(),
  onPublish: vi.fn(),
  onReject: vi.fn(),
  onWithdraw: vi.fn(),
};

describe('NotificationAttentionGovernanceStudio', () => {
  it('renders only server supplied settings and the accepted Stitch governance structure', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationAttentionGovernanceStudio, {
        workspace: workspace(),
        status: 'READY',
        actorUserId: 17,
        canManage: true,
        canApprove: true,
        copy,
        ...callbacks,
      })
    );

    expect(markup).toContain('data-testid="notification-attention-governance-studio"');
    expect(markup).toContain('Attention governance studio');
    expect(markup).toContain('value="32"');
    expect(markup).toContain('#sec-soc-alert');
    expect(markup).toContain('Minimum analytics cohort');
    expect(markup).toContain('Independent approval pipeline');
    expect(markup).not.toContain('4,120');
    expect(markup).not.toContain('240');
  });

  it('fails closed in the UI when the signed-in author views their own draft', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationAttentionGovernanceStudio, {
        workspace: workspace([revision('DRAFT', 17)]),
        status: 'READY',
        actorUserId: 17,
        canManage: true,
        canApprove: true,
        copy,
        ...callbacks,
      })
    );

    expect(markup).toContain('Authors cannot approve their own revision.');
    expect(markup).toContain('The open draft is immutable until it is decided.');
    expect(markup).toMatch(/<button(?=[^>]*disabled)[^>]*>.*Publish/su);
    expect(markup).toMatch(/<button(?=[^>]*disabled)[^>]*>.*Reject/su);
  });

  it('keeps approval decisions disabled without the exact APPROVE permission', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationAttentionGovernanceStudio, {
        workspace: workspace([revision('DRAFT', 99)]),
        status: 'READY',
        actorUserId: 17,
        canManage: true,
        canApprove: false,
        copy,
        ...callbacks,
      })
    );

    expect(markup).toContain('Approval permission is required.');
    expect(markup).toMatch(/<button(?=[^>]*disabled)[^>]*>.*Publish/su);
    expect(markup).toMatch(/<button(?=[^>]*disabled)[^>]*>.*Reject/su);
  });

  it('renders the runtime error contract without exposing stale workspace fields', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationAttentionGovernanceStudio, {
        workspace: workspace(),
        status: 'ERROR',
        errorMessage: 'The server-authoritative revision is unavailable.',
        actorUserId: 17,
        canManage: true,
        canApprove: true,
        copy,
        ...callbacks,
      })
    );

    expect(markup).toContain('Governance unavailable');
    expect(markup).toContain('The server-authoritative revision is unavailable.');
    expect(markup).not.toContain('value="32"');
  });

  it('does not invent a baseline when the backend has no effective configuration', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationAttentionGovernanceStudio, {
        workspace: { activeRevision: null, drafts: [], changeVersion: '0', generatedAt: '' },
        status: 'READY',
        actorUserId: 17,
        canManage: true,
        canApprove: true,
        copy,
        ...callbacks,
      })
    );

    expect(markup).toContain('Governance is not initialized');
    expect(markup).not.toContain('value="20"');
  });

  it('fails safe when a legacy policy payload is intercepted at the governance endpoint', () => {
    const legacyWorkspace = {
      effectivePolicies: [{ policyId: 'legacy-policy' }],
      drafts: [{ policyId: 'legacy-draft' }],
      generatedAt: '2026-09-17T00:00:00Z',
    } as unknown as NotificationAttentionGovernanceWorkspace;

    const markup = renderToStaticMarkup(
      createElement(NotificationAttentionGovernanceStudio, {
        workspace: legacyWorkspace,
        status: 'READY',
        actorUserId: 17,
        canManage: true,
        canApprove: true,
        copy,
        ...callbacks,
      })
    );

    expect(markup).toContain('Governance is not initialized');
    expect(markup).not.toContain('data-testid="notification-attention-governance-studio"');
  });
});
