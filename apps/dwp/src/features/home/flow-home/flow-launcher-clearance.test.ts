import { describe, expect, it } from 'vitest';

import { resolveFlowLauncherClearance, type FlowLauncherRect } from './flow-launcher-clearance';

const launcher: FlowLauncherRect = {
  left: 1_360,
  right: 1_416,
  top: 640,
  bottom: 696,
  width: 56,
  height: 56,
};

function widget(overrides: Partial<FlowLauncherRect> = {}): FlowLauncherRect {
  return {
    left: 960,
    right: 1_400,
    top: 560,
    bottom: 710,
    width: 440,
    height: 150,
    ...overrides,
  };
}

describe('resolveFlowLauncherClearance', () => {
  it('reserves the measured inline overlap plus the safety gap', () => {
    expect(resolveFlowLauncherClearance(widget(), launcher, 'floating')).toBe(56);
  });

  it('does not reserve space for a header launcher or a different vertical lane', () => {
    expect(resolveFlowLauncherClearance(widget(), launcher, 'header')).toBe(0);
    expect(
      resolveFlowLauncherClearance(widget({ top: 100, bottom: 250 }), launcher, 'floating')
    ).toBe(0);
  });

  it('uses the supplied safety gap without relying on a widget type or fixed width', () => {
    expect(
      resolveFlowLauncherClearance(
        widget({ left: 600, right: 1_372, width: 772 }),
        launcher,
        'floating',
        8
      )
    ).toBe(20);
  });
});
