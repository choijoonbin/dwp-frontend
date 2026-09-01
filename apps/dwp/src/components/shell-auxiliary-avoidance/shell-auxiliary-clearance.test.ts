import { describe, expect, it } from 'vitest';

import {
  resolveShellAuxiliaryInlineClearance,
  type ShellAuxiliaryGeometry,
  type ShellAuxiliaryRect,
} from './shell-auxiliary-clearance';

const launcher: ShellAuxiliaryGeometry = {
  placement: 'floating',
  edge: 'block-end inline-end',
  rect: {
    left: 1_360,
    right: 1_416,
    top: 640,
    bottom: 696,
    width: 56,
    height: 56,
  },
};

function target(overrides: Partial<ShellAuxiliaryRect> = {}): ShellAuxiliaryRect {
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

describe('resolveShellAuxiliaryInlineClearance', () => {
  it('reserves the measured overlap and safety gap for a floating inline-end layer', () => {
    expect(resolveShellAuxiliaryInlineClearance(target(), launcher)).toBe(56);
  });

  it('does not move content for a header layer or a different block lane', () => {
    expect(
      resolveShellAuxiliaryInlineClearance(target(), { ...launcher, placement: 'header' })
    ).toBe(0);
    expect(resolveShellAuxiliaryInlineClearance(target({ top: 100, bottom: 250 }), launcher)).toBe(
      0
    );
  });

  it('only applies inline clearance to auxiliary layers anchored at inline-end', () => {
    expect(
      resolveShellAuxiliaryInlineClearance(target(), {
        ...launcher,
        edge: 'block-end inline-start',
      })
    ).toBe(0);
  });
});
