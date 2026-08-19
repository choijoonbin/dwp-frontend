import { describe, expect, it } from 'vitest';

import {
  getProductExperienceProfile,
  productExperienceRegistry,
} from './product-experience-registry';

describe('product experience registry', () => {
  it('gives each operational app a distinct domain concept and visual signature', () => {
    const profiles = Object.values(productExperienceRegistry);

    expect(new Set(profiles.map((profile) => profile.concept)).size).toBe(profiles.length);
    expect(new Set(profiles.map((profile) => profile.accent)).size).toBe(profiles.length);
  });

  it('keeps HCM comfortable and people-centered', () => {
    expect(getProductExperienceProfile('hcm')).toMatchObject({
      concept: 'people-flow',
      density: 'comfortable',
    });
  });
});
