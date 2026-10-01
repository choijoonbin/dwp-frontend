import { describe, expect, it } from 'vitest';

import {
  widgetEffectiveStateLabelKey,
  widgetEffectiveStatePriority,
  widgetPlacementLabelKey,
  widgetPolicyStateLabelKey,
  widgetPublicReasonLabelKey,
} from './tenant-widget-presentation';

describe('tenant widget presentation', () => {
  it('fails closed for unknown owner values', () => {
    expect(widgetEffectiveStateLabelKey('FUTURE')).toContain('.UNKNOWN');
    expect(widgetEffectiveStatePriority('FUTURE')).toBeGreaterThan(
      widgetEffectiveStatePriority('DENY')
    );
    expect(widgetPublicReasonLabelKey('FUTURE')).toContain('.UNKNOWN');
    expect(widgetPlacementLabelKey('FUTURE')).toContain('.UNKNOWN');
    expect(widgetPolicyStateLabelKey('FUTURE')).toContain('.UNKNOWN');
  });
});
