import { describe, expect, it } from 'vitest';

import {
  navigationNodeLifecycleLabelKey,
  navigationNodeTypeLabelKey,
  navigationRevisionStateLabelKey,
} from './navigation-studio-presentation';

describe('navigation studio presentation', () => {
  it('fails closed for unknown revision states', () => {
    expect(navigationRevisionStateLabelKey('PUBLISHED')).toContain('.published');
    expect(navigationRevisionStateLabelKey('FUTURE_INTERNAL_STATE')).toContain('.unavailable');
  });

  it('fails closed for unknown node types and lifecycle states', () => {
    expect(navigationNodeTypeLabelKey('APP')).toBe('navigationManager.types.APP');
    expect(navigationNodeTypeLabelKey('FUTURE')).toBe('navigationManager.types.UNKNOWN');
    expect(navigationNodeLifecycleLabelKey('ACTIVE')).toBe('common.lifecycle.ACTIVE');
    expect(navigationNodeLifecycleLabelKey('FUTURE')).toBe('common.lifecycle.UNKNOWN');
  });
});
