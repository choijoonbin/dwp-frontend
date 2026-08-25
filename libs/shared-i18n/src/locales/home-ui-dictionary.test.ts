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
});
