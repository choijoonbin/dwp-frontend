import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DWAION_ROUTINE_COPY_KO } from './dwaion-routine-copy';
import { DwaionRoutineApprovalQueue } from './dwaion-routine-approval-queue';

import type { DwaionRoutineAdvancedCommand } from '@dwp-frontend/shared-utils';

const COMMAND: DwaionRoutineAdvancedCommand = {
  commandId: '22222222-2222-4222-8222-222222222222',
  routineId: '11111111-1111-4111-8111-111111111111',
  ownerUserId: 'maker@company.com',
  kind: 'CHANGE_APPROVAL',
  state: 'AWAITING_APPROVAL',
  expectedRevision: 7,
  version: 1,
  makerUserId: 'maker@company.com',
  checkerUserId: null,
  canApprove: true,
  proposedDefinition: {
    name: '검토 대상 아침 우선순위',
    objective: '허용된 업무 신호를 검토하고 제안을 생성합니다.',
    triggerType: 'SCHEDULED',
    cadence: 'WEEKDAYS',
    localTime: '09:00',
    timeZone: 'Asia/Seoul',
    webhookEventType: null,
    webhookEndpointReference: null,
    locale: 'ko-KR',
    sources: ['WORK_ITEM'],
    weekDays: [],
    activeFrom: null,
    activeUntil: null,
    quietHoursStart: null,
    quietHoursEnd: null,
    budget: {
      maximumRunsPerMonth: 31,
      maximumTokensPerRun: 32_000,
      maximumMinutesPerRun: 15,
    },
    retryPolicy: { maximumAttempts: 3, initialBackoffSeconds: 30, backoffMultiplier: 2 },
    notificationPolicy: { notifyOnPartial: true, notifyOnFailure: true, notifyOnRecovery: true },
    compensationPolicy: { enabled: true, strategy: 'REVOKE_PENDING_HANDOFFS' },
  },
  problem: null,
  receipt: null,
  createdAt: '2026-09-17T03:00:00Z',
  updatedAt: '2026-09-17T03:00:00Z',
};

describe('DwaionRoutineApprovalQueue', () => {
  it('renders an accessible independent review item with both governed decisions', () => {
    const html = renderToStaticMarkup(
      <DwaionRoutineApprovalQueue
        commands={[COMMAND]}
        copy={DWAION_ROUTINE_COPY_KO}
        formatTimestamp={() => '2026. 9. 17. 12:00'}
        onRetry={vi.fn()}
        onDecide={vi.fn()}
      />
    );

    expect(html).toContain('aria-labelledby=');
    expect(html).toContain('독립 검토 대기열');
    expect(html).toContain('maker@company.com');
    expect(html).toContain('검토 대상 아침 우선순위');
    expect(html).toContain('허용된 업무 신호를 검토하고 제안을 생성합니다.');
    expect(html).toContain('변경 승인');
    expect(html).toContain('변경 반려');
    expect(html).toContain('2026. 9. 17. 12:00');
  });

  it('states truthfully when the tenant has no eligible checker work', () => {
    const html = renderToStaticMarkup(
      <DwaionRoutineApprovalQueue
        commands={[]}
        copy={DWAION_ROUTINE_COPY_KO}
        onRetry={vi.fn()}
        onDecide={vi.fn()}
      />
    );

    expect(html).toContain('현재 독립 검토가 필요한 루틴 변경이 없습니다.');
    expect(html).toContain('대기 0건');
  });
});
