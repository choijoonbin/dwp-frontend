import { describe, expect, it } from 'vitest';

import {
  getProductExperienceProfile,
  productExperienceRegistry,
} from './product-experience-registry';

describe('product experience registry', () => {
  it('gives each operational app a distinct domain concept and visual signature', () => {
    expect(
      new Set(Object.values(productExperienceRegistry).map((profile) => profile.concept)).size
    ).toBe(3);
    expect(
      new Set(Object.values(productExperienceRegistry).map((profile) => profile.accent)).size
    ).toBe(3);
  });

  it('keeps HCM comfortable and people-centered', () => {
    expect(getProductExperienceProfile('hcm')).toMatchObject({
      concept: 'people-flow',
      density: 'comfortable',
    });
  });
});
