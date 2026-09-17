import { describe, expect, it } from 'vitest';

import {
  workplaceAssistantInitialLocalRange,
  workplaceAssistantLocalDateTimeToInstant,
} from './workplace-assistant-time';

describe('Workplace Assistant site-local time boundary', () => {
  it('converts the same wall time with the selected Workplace site timezone', () => {
    expect(workplaceAssistantLocalDateTimeToInstant('2026-09-22T09:00', 'Asia/Seoul')).toBe(
      '2026-09-22T00:00:00Z'
    );
    expect(
      workplaceAssistantLocalDateTimeToInstant('2026-09-22T09:00', 'America/Los_Angeles')
    ).toBe('2026-09-22T16:00:00Z');
  });

  it('rejects nonexistent local wall time instead of shifting the booking', () => {
    expect(() =>
      workplaceAssistantLocalDateTimeToInstant('2026-03-08T02:30', 'America/Los_Angeles')
    ).toThrow();
  });

  it('builds the initial wall-time range inside the selected zone', () => {
    expect(workplaceAssistantInitialLocalRange('Asia/Seoul', '2026-09-17T01:00:00Z')).toEqual({
      startsAt: '2026-09-18T09:00',
      endsAt: '2026-09-18T18:00',
    });
  });
});
