import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CompensationPlanningWorkspace } from '../compensation-planning-workspace';

const ID = {
  cycle: '11111111-1111-4111-8111-111111111111',
  proposal: '22222222-2222-4222-8222-222222222222',
  worker: '33333333-3333-4333-8333-333333333333',
  assignment: '44444444-4444-4444-8444-444444444444',
} as const;
const HASH = 'a'.repeat(64);
const NOW = '2026-10-13T08:00:00Z';
const cycle = {
  cycleId: ID.cycle,
  aggregateVersion: 3,
  cycleCode: 'FY27',
  effectiveFrom: '2027-01-01',
  effectiveTo: null,
  status: 'PROPOSAL_REVIEW' as const,
  budgetMasked: true,
};
const actions = {
  canCreate: false,
  canRevise: false,
  canAllocate: false,
  canDraftProposal: false,
  canSubmitProposal: false,
  canApprove: false,
  canPublish: false,
  canCancel: false,
};

describe('compensation-planning workspace', () => {
  it('renders the governed route, hard-cap lifecycle, and restricted values without leakage', () => {
    const html = renderToStaticMarkup(
      <CompensationPlanningWorkspace
        status="READY"
        cycles={[cycle]}
        selectedCycleId={ID.cycle}
        cycleDetail={{
          item: cycle,
          referenceEffectiveAt: NOW,
          freshnessWatermark: NOW,
          fieldPolicyRevision: 4,
        }}
        proposals={{
          items: [
            {
              proposalId: ID.proposal,
              aggregateVersion: 1,
              cycleId: ID.cycle,
              workerId: ID.worker,
              assignmentId: ID.assignment,
              componentCode: 'BASE',
              currency: 'USD',
              effectiveFrom: '2027-01-01',
              effectiveTo: null,
              currentRevision: 1,
              status: 'DRAFT',
              contentDigest: HASH,
              amountMasked: true,
            },
          ],
          nextCursor: null,
          hasMore: false,
          referenceEffectiveAt: NOW,
          freshnessWatermark: NOW,
          fieldPolicyRevision: 4,
        }}
        proposalDetail={{
          item: {
            proposalId: ID.proposal,
            aggregateVersion: 1,
            cycleId: ID.cycle,
            workerId: ID.worker,
            assignmentId: ID.assignment,
            componentCode: 'BASE',
            currency: 'USD',
            effectiveFrom: '2027-01-01',
            effectiveTo: null,
            currentRevision: 1,
            status: 'DRAFT',
            contentDigest: HASH,
            amountMasked: true,
          },
          referenceEffectiveAt: NOW,
          freshnessWatermark: NOW,
          fieldPolicyRevision: 4,
        }}
        actions={actions}
        onSelectCycle={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    expect(html).toContain('/hr/operations/performance/compensation-planning');
    expect(html).toContain('Compensation planning studio');
    expect(html).toContain('Hard-cap policy');
    expect(html).toContain('Restricted');
    expect(html).not.toContain('EXCEPTION_APPROVAL');
    expect(html).not.toContain('100000');
    expect((html.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });

  it('opens summary-only rows through the detail projection and renders an allowed amount', () => {
    const summary = {
      proposalId: ID.proposal,
      aggregateVersion: 1,
      cycleId: ID.cycle,
      workerId: ID.worker,
      assignmentId: ID.assignment,
      componentCode: 'BASE',
      currency: 'USD',
      effectiveFrom: '2027-01-01',
      effectiveTo: null,
      currentRevision: 1,
      status: 'DRAFT' as const,
      contentDigest: HASH,
      amountMasked: true,
    };
    const common = {
      status: 'READY' as const,
      cycles: [cycle],
      selectedCycleId: ID.cycle,
      cycleDetail: {
        item: cycle,
        referenceEffectiveAt: NOW,
        freshnessWatermark: NOW,
        fieldPolicyRevision: 4,
      },
      proposals: {
        items: [summary],
        nextCursor: null,
        hasMore: false,
        referenceEffectiveAt: NOW,
        freshnessWatermark: NOW,
        fieldPolicyRevision: 4,
      },
      actions,
      onSelectCycle: vi.fn(),
      onSelectProposal: vi.fn(),
      onRefresh: vi.fn(),
    };
    expect(renderToStaticMarkup(<CompensationPlanningWorkspace {...common} />))
      .toContain('View amount');
    const detailHtml = renderToStaticMarkup(
      <CompensationPlanningWorkspace
        {...common}
        selectedProposalId={ID.proposal}
        proposalDetail={{
          item: { ...summary, amountMasked: false, amount: '1250.25' },
          referenceEffectiveAt: NOW,
          freshnessWatermark: NOW,
          fieldPolicyRevision: 4,
        }}
      />
    );
    expect(detailHtml).toContain('1250.25 USD');
  });

  it.each([
    ['DENIED', 'Access unavailable'],
    ['STEP_UP_REQUIRED', 'Verification required'],
    ['STALE_VERSION', 'This plan changed'],
    ['RESULT_UNKNOWN', 'Result needs reconciliation'],
  ] as const)('renders the %s state without exposing plan data', (status, title) => {
    const html = renderToStaticMarkup(
      <CompensationPlanningWorkspace
        status={status}
        cycles={[cycle]}
        selectedCycleId={ID.cycle}
        cycleDetail={null}
        proposals={null}
        actions={actions}
        onSelectCycle={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    expect(html).toContain(title);
    expect(html).not.toContain(ID.worker);
  });
});
