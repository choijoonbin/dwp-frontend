import { describe, expect, it } from 'vitest';

import enHome from './en/home.json';
import enHomeStudio from './en/homeStudio.json';
import koHome from './ko/home.json';
import koHomeStudio from './ko/homeStudio.json';

const PROVIDER_STATUS_KEYS = [
  'overdue',
  'urgent',
  'attention',
  'needs_response',
  'needs_info',
  'info_requested',
  'actionable',
  'awaiting_requester',
  'conflict',
  'check_in',
  'failed',
  'blocked',
  'policy_blocked',
  'below_target',
  'on_track',
  'required',
  'pending',
  'submitted',
  'in_review',
  'in_progress',
  'waiting',
  'due_soon',
  'reserved',
  'checked_in',
  'confirmed',
  'tentative',
  'open',
  'claimed',
  'reassigned',
  'approved',
  'rejected',
  'skipped',
  'cancelled',
  'draft',
  'triaged',
  'resolved',
  'closed',
  'withdrawn',
  'completed',
  'no_show',
  'released',
  'declined',
  'paused',
  'active',
  'redacted',
] as const;

describe('Home purpose UI dictionaries', () => {
  it('localizes every finite provider and privacy status in Korean and English', () => {
    for (const key of PROVIDER_STATUS_KEYS) {
      expect(koHome.flow.purpose.status[key]).toBeTruthy();
      expect(enHome.flow.purpose.status[key]).toBeTruthy();
    }
  });

  it('localizes every Home Studio width option without exposing raw keys', () => {
    for (const key of ['fifth', 'quarter', 'compactWidth', 'medium', 'large', 'full'] as const) {
      expect(koHomeStudio.device[key]).toBeTruthy();
      expect(enHomeStudio.device[key]).toBeTruthy();
    }
  });

  it('uses the Messenger product name for the Korean Home launcher label', () => {
    expect(koHome.apps.items['dwp-messaging']).toMatchObject({
      name: '메신저',
      shortName: '메신저',
    });
  });

  it('localizes the preference conflict dialog close control', () => {
    expect(koHome.flow.conflict.closeDialog).toBe('충돌 대화상자 닫기');
    expect(enHome.flow.conflict.closeDialog).toBe('Close conflict dialog');
  });

  it('keeps generic widget failure copy privacy-safe without an interpolation token', () => {
    expect(enHome.states['widget-error'].description).toBe(
      'The affected widget stopped safely. The rest of Home remains available.'
    );
    expect(koHome.states['widget-error'].description).toBe(
      '문제가 발생한 위젯만 안전하게 중단되었습니다. 홈의 다른 영역은 계속 사용할 수 있습니다.'
    );
    expect(enHome.states['widget-error'].description).not.toContain('{{');
    expect(koHome.states['widget-error'].description).not.toContain('{{');
  });
});
