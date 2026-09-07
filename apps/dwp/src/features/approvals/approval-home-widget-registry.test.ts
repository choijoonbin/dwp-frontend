import { describe, expect, it } from 'vitest';

import { APPROVAL_HOME_WIDGET_REGISTRY } from './approval-home-widget-registry';

describe('approval Work home widgets', () => {
  it('contains only requester and approver content, never management health', () => {
    const keys = APPROVAL_HOME_WIDGET_REGISTRY.map((widget) => widget.key);

    expect(keys).toEqual(['decision-pulse', 'focus-queue', 'insights', 'my-requests', 'flow']);
    expect(APPROVAL_HOME_WIDGET_REGISTRY.every((widget) => widget.audience !== 'operator')).toBe(
      true
    );
  });
});
