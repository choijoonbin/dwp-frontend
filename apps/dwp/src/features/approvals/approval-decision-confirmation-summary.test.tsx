// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalDecisionConfirmationSummary } from './approval-decision-confirmation-summary';

import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'inbox.stageProgress') return `${options?.current}단계 · ${options?.name}`;
      if (key === 'inbox.confirmation.riskValue') return `${options?.score}점`;
      return key;
    },
  }),
}));
vi.mock('@dwp-frontend/shared-i18n', () => ({ formatDate: () => '2026. 9. 15. 09:30' }));

const detail: ApprovalTaskDetail = {
  task: {
    taskId: 'task-1',
    requestId: 'request-1',
    requestNumber: 'APR-2026-001',
    title: 'Production access extension',
    summary: '',
    workflowNameKo: '권한 결재',
    workflowNameEn: 'Access approval',
    stepKey: 'SECURITY',
    stepName: 'Security review',
    stepSequence: 2,
    requesterName: 'Kim',
    status: 'PENDING',
    priority: 'HIGH',
    dataClassification: 'CONFIDENTIAL',
    riskScore: 82,
    version: 7,
  },
  contentAccess: {
    state: 'FULL',
    reason: 'CURRENT_AUTHORITY_VERIFIED',
    evaluatedAt: '2026-09-15T00:00:00Z',
  },
  payload: {},
  timeline: [],
  canClaim: false,
  canDecide: true,
  selfApprovalBlocked: false,
};

let container: HTMLDivElement;
let root: Root;

describe('approval decision confirmation summary', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('shows immutable target identity, stage, risk, version, and verification time', async () => {
    await act(async () =>
      root.render(<ApprovalDecisionConfirmationSummary detail={detail} verifiedAt={1} />)
    );

    expect(container.textContent).toContain('APR-2026-001');
    expect(container.textContent).toContain('Production access extension');
    expect(container.textContent).toContain('Kim');
    expect(container.textContent).toContain('2단계 · Security review');
    expect(container.textContent).toContain('82점');
    expect(container.textContent).toContain('7');
    expect(container.textContent).toContain('2026. 9. 15. 09:30');
  });
});
