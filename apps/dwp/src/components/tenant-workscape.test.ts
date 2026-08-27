import { describe, expect, it } from 'vitest';

import { defaultHomeContentAlignment, resolveHomeWorkscapeContract } from './tenant-workscape';

describe('Tenant Workscape contract', () => {
  it('keeps the legacy image-position behavior while placing content away from the subject', () => {
    expect(resolveHomeWorkscapeContract({ backgroundPosition: 'LEFT' })).toEqual({
      focalX: 0,
      focalY: 50,
      mobileFocalX: 0,
      mobileFocalY: 50,
      contentAlignment: 'RIGHT',
    });
    expect(defaultHomeContentAlignment('CENTER')).toBe('CENTER');
    expect(defaultHomeContentAlignment('RIGHT')).toBe('LEFT');
  });

  it('keeps image crop and content alignment independent', () => {
    expect(
      resolveHomeWorkscapeContract({
        backgroundPosition: 'RIGHT',
        focalX: 74,
        focalY: 28,
        mobileFocalX: 61,
        mobileFocalY: 40,
        contentAlignment: 'RIGHT',
      })
    ).toEqual({
      focalX: 74,
      focalY: 28,
      mobileFocalX: 61,
      mobileFocalY: 40,
      contentAlignment: 'RIGHT',
    });
  });

  it('clamps invalid focal points and inherits desktop values for mobile', () => {
    expect(
      resolveHomeWorkscapeContract({
        backgroundPosition: 'CENTER',
        focalX: -10,
        focalY: 140,
      })
    ).toMatchObject({
      focalX: 0,
      focalY: 100,
      mobileFocalX: 0,
      mobileFocalY: 100,
    });
  });
});
