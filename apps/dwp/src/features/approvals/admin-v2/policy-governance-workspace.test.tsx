// @vitest-environment jsdom
import { act } from 'react';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PolicyGovernanceWorkspace } from './policy-governance-workspace';
import { attention, facts, healthy, metrics, policyCopy } from './admin-v2-test-fixtures';
import { createAdminV2TestHarness, type AdminV2TestHarness } from './admin-v2-test-harness';

const policies = [
  {
    id: 'policy-1',
    name: 'High-risk approval outcome',
    description: 'Prevents silent automatic decisions.',
    familyLabel: 'Segregation of duties',
    scopeLabel: 'Tenant scope',
    versionLabel: 'Published v7',
    status: attention,
    facts,
    impactFacts: facts,
    highRisk: true,
    highRiskReason: 'Automatic outcomes require independent review and exact evidence.',
  },
  {
    id: 'policy-2',
    name: 'Reminder policy',
    description: 'Schedules regional working-time reminders.',
    familyLabel: 'SLA',
    scopeLabel: 'Finance workflows',
    versionLabel: 'Published v2',
    status: healthy,
    facts,
    impactFacts: facts,
    highRisk: false,
  },
] as const;

const providers = [
  {
    id: 'provider-1',
    name: 'In-app notifications',
    channelLabel: 'IN_APP',
    lastVerifiedLabel: 'Verified now',
    status: healthy,
  },
  {
    id: 'provider-2',
    name: 'Teams',
    channelLabel: 'TEAMS',
    lastVerifiedLabel: 'No current probe',
    status: { label: 'NOT_CONFIGURED', tone: 'warning' as const },
  },
] as const;

const calendars = [
  {
    id: 'calendar-1',
    name: 'Korea finance calendar',
    timezoneLabel: 'Asia/Seoul',
    effectiveLabel: 'Effective 2026',
    weekdaysLabel: 'Mon-Fri',
    holidayCountLabel: '17 holidays',
    exceptionCountLabel: '2 exceptions',
    status: healthy,
    facts,
  },
] as const;

const escalationSteps = [
  {
    id: 'step-1',
    title: 'First reminder',
    detail: 'Send an in-app notification after one business day.',
    meta: 'T+8 business hours',
    status: healthy,
  },
  {
    id: 'step-2',
    title: 'Manager escalation',
    detail: 'Resolve the current line manager and notify only.',
    meta: 'T+16 business hours',
    status: attention,
  },
] as const;

const deliveryPreview = {
  id: 'delivery-1',
  channelLabel: 'IN_APP',
  localeLabel: 'ko-KR',
  recipientLabel: 'Resolved line manager',
  subject: 'Approval reminder',
  body: 'A request is approaching its governed SLA.',
  fallbackLabel: 'Accessible plain-text fallback',
  redactionLabel: 'Confidential field values are redacted.',
  status: healthy,
} as const;

const delegations = [
  {
    id: 'delegation-1',
    title: 'Finance approval delegation',
    description: 'Temporary scoped authority during approved leave.',
    scopeLabel: 'Workflow FIN-AP-07',
    effectiveLabel: 'Sep 18-20',
    auditLabel: 'Independent reviewer assigned',
    status: attention,
    facts,
  },
] as const;

describe('APR-20 policy, notification, calendar, and delegation workspace', () => {
  let harness: AdminV2TestHarness;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    harness = createAdminV2TestHarness();
  });

  afterEach(async () => {
    await harness.destroy();
    vi.unstubAllGlobals();
  });

  function props(view: 'catalog' | 'calendar' | 'delivery' | 'delegation' = 'catalog') {
    return {
      state: 'ready' as const,
      copy: policyCopy,
      metrics,
      view,
      policies,
      selectedPolicyId: 'policy-1',
      providers,
      calendars,
      selectedCalendarId: 'calendar-1',
      deliveryPreview,
      escalationSteps,
      delegations,
      editPolicyReady: false,
      editPolicyDisabledReason: 'Complete draft input is required.',
      submitReviewReady: false,
      submitReviewDisabledReason: 'Independent review evidence is required.',
      delegationReviewReady: false,
      delegationReviewDisabledReason: 'A governance disposition is required.',
      simulationReady: false,
      simulationDisabledReason: 'Canonical simulation inputs are required.',
      onViewChange: vi.fn(),
      onSelectPolicy: vi.fn(),
      onSelectCalendar: vi.fn(),
      onEditPolicy: vi.fn(),
      onRunSimulation: vi.fn(),
      onSubmitReview: vi.fn(),
      onReviewDelegation: vi.fn(),
      onRetry: vi.fn(),
      onResolveConflict: vi.fn(),
    };
  }

  it('renders truthful provider readiness and closes unsupported policy commands at first paint', async () => {
    const current = props();
    await harness.render(<PolicyGovernanceWorkspace {...current} />);
    expect(harness.node.textContent).toContain('NOT_CONFIGURED');
    expect(harness.node.textContent).toContain(policies[0].highRiskReason);
    await act(async () => {
      fireEvent.click(getByRole(harness.node, 'button', { name: /Reminder policy/u }));
      fireEvent.click(getByRole(harness.node, 'button', { name: policyCopy.editPolicyLabel }));
      fireEvent.click(getByRole(harness.node, 'button', { name: policyCopy.submitReviewLabel }));
    });
    expect(current.onSelectPolicy).toHaveBeenCalledWith('policy-2');
    expect(current.onEditPolicy).not.toHaveBeenCalled();
    expect(current.onSubmitReview).not.toHaveBeenCalled();
    expect(harness.node.textContent).toContain(current.editPolicyDisabledReason);
    expect(harness.node.textContent).toContain(current.submitReviewDisabledReason);
    expect(
      getByRole<HTMLButtonElement>(harness.node, 'button', { name: policyCopy.mobileReviewLabel })
        .disabled
    ).toBe(true);
  });

  it('shows business calendar evidence and closes simulation without canonical inputs', async () => {
    const current = props('calendar');
    await harness.render(<PolicyGovernanceWorkspace {...current} />);
    expect(harness.node.textContent).toContain(calendars[0].timezoneLabel);
    const simulationButton = getByRole<HTMLButtonElement>(harness.node, 'button', {
      name: policyCopy.runSimulationLabel,
    });
    expect(simulationButton.disabled).toBe(true);
    await act(async () => fireEvent.click(simulationButton));
    expect(current.onRunSimulation).not.toHaveBeenCalled();
    expect(harness.node.textContent).toContain(current.simulationDisabledReason);
  });

  it('connects delegation evidence review and closes commands under stale authority', async () => {
    const current = props('delegation');
    await harness.render(<PolicyGovernanceWorkspace {...current} state="stale" />);
    await act(async () =>
      fireEvent.click(getByRole(harness.node, 'button', { name: policyCopy.reviewDelegationLabel }))
    );
    expect(current.onReviewDelegation).not.toHaveBeenCalled();
    expect(harness.node.textContent).toContain(current.delegationReviewDisabledReason);
    expect(
      getByRole<HTMLButtonElement>(harness.node, 'button', { name: policyCopy.submitReviewLabel })
        .disabled
    ).toBe(true);
  });

  it('renders exact notification provider readiness in the delivery workspace', async () => {
    const current = props('delivery');
    await harness.render(<PolicyGovernanceWorkspace {...current} />);
    expect(harness.node.textContent).toContain(providers[0].name);
    expect(harness.node.textContent).toContain(providers[0].channelLabel);
    expect(harness.node.textContent).toContain(providers[1].lastVerifiedLabel);
  });
});
