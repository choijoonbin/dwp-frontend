import { describe, expect, it } from 'vitest';

import {
  MAX_JOIN_CODE_LENGTH,
  MIN_JOIN_CODE_LENGTH,
  formatJoinCode,
  hasValidJoinCodeLength,
  isJoinCodeLocked,
  maskJoinCode,
  meetingJoinStep,
  safeJoinDenialReason,
  visibleJoinCodeSuffix,
} from './meeting-join-model';

describe('meeting join presentation model', () => {
  it('normalizes pasted separators and caps the canonical value at its contract boundary', () => {
    expect(formatJoinCode(' abcd efgh-jkmn ')).toBe('ABCD-EFGH-JKMN');
    expect(hasValidJoinCodeLength('A'.repeat(MIN_JOIN_CODE_LENGTH - 1))).toBe(false);
    expect(hasValidJoinCodeLength('A'.repeat(MIN_JOIN_CODE_LENGTH))).toBe(true);
    expect(hasValidJoinCodeLength('A'.repeat(MAX_JOIN_CODE_LENGTH))).toBe(true);
    expect(formatJoinCode('A'.repeat(MAX_JOIN_CODE_LENGTH + 1))).toBe('AAAA-AAAA-AAAA-AAAA');
  });

  it('shows only the final code group after a meeting has been resolved', () => {
    expect(maskJoinCode('ABCD-EFGH-JKMN')).toBe('••••-••••-JKMN');
    expect(visibleJoinCodeSuffix('ABCD-EFGH-JKMN')).toBe('JKMN');
    expect(maskJoinCode('ABCD-EFGH-JKMN-PQRS')).toBe('••••-••••-••••-PQRS');
  });

  it('maps only a server-owned safe reason and redacts arbitrary denial detail', () => {
    expect(safeJoinDenialReason('MEETING_UNAVAILABLE')).toBe('MEETING_UNAVAILABLE');
    expect(safeJoinDenialReason('tenant=acme; subject=joonbin@sk.com')).toBe('POLICY_UNAVAILABLE');
    expect(safeJoinDenialReason('POLICY_UNAVAILABLE')).toBe('POLICY_UNAVAILABLE');
    expect(safeJoinDenialReason(null)).toBe('POLICY_UNAVAILABLE');
  });

  it('projects progress and locks code replacement only while admission is pending', () => {
    expect(meetingJoinStep(false)).toBe(0);
    expect(meetingJoinStep(true)).toBe(1);
    expect(meetingJoinStep(true, 'WAITING')).toBe(1);
    expect(meetingJoinStep(true, 'DENIED')).toBe(1);
    expect(meetingJoinStep(true, 'APPROVED')).toBe(2);
    expect(isJoinCodeLocked()).toBe(false);
    expect(isJoinCodeLocked('WAITING')).toBe(true);
    expect(isJoinCodeLocked('APPROVED')).toBe(false);
    expect(isJoinCodeLocked('DENIED')).toBe(false);
  });
});
