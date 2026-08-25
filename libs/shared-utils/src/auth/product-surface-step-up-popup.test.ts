import { describe, expect, it } from 'vitest';

import {
  isTrustedProductSurfaceStepUpWindowCompletion,
  matchesProductSurfaceStepUpCompletion,
  parseProductSurfaceStepUpCompletion,
  PRODUCT_SURFACE_STEP_UP_COMPLETION_TYPE,
} from './product-surface-step-up-popup';

describe('product surface step-up popup protocol', () => {
  it('accepts only an exact opaque flow-id completion message', () => {
    const message = {
      type: PRODUCT_SURFACE_STEP_UP_COMPLETION_TYPE,
      flowId: '8f879f98-2476-4c33-a228-2984567ab889',
    };
    expect(parseProductSurfaceStepUpCompletion(message)).toEqual(message);
    expect(parseProductSurfaceStepUpCompletion({ ...message, challenge: 'jwt' })).toBeNull();
    expect(parseProductSurfaceStepUpCompletion({ ...message, flowId: 'not-a-flow-id' })).toBeNull();
    expect(matchesProductSurfaceStepUpCompletion(message, message.flowId)).toBe(true);
    expect(
      matchesProductSurfaceStepUpCompletion(message, '64c6b25b-4aba-4b11-aa07-768632b0af64')
    ).toBe(false);
  });

  it('rejects foreign origins, unrelated popup sources and stale flow references', () => {
    const value = {
      type: PRODUCT_SURFACE_STEP_UP_COMPLETION_TYPE,
      flowId: '8f879f98-2476-4c33-a228-2984567ab889',
    };
    const trusted = (
      overrides: Partial<Parameters<typeof isTrustedProductSurfaceStepUpWindowCompletion>[0]> = {}
    ) =>
      isTrustedProductSurfaceStepUpWindowCompletion({
        value,
        expectedFlowRef: value.flowId,
        eventOrigin: 'https://app.example.test',
        expectedOrigin: 'https://app.example.test',
        sourceMatches: true,
        ...overrides,
      });

    expect(trusted()).toBe(true);
    expect(trusted({ eventOrigin: 'https://attacker.example.test' })).toBe(false);
    expect(trusted({ sourceMatches: false })).toBe(false);
    expect(trusted({ expectedFlowRef: '64c6b25b-4aba-4b11-aa07-768632b0af64' })).toBe(false);
  });
});
