import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  resolveAIRuntimeControlLoadFailure,
  shouldRetryAIRuntimeControlLoad,
} from './dwaion-ai-runtime-control-state';

describe('DWAI-ON AI runtime control load state', () => {
  it('recognizes only the stable 503 rollout-unavailable contract', () => {
    const unavailable = new HttpError('Request failed: 503', 503, {
      detail: {
        errorCode: 'AI_CONTROL_ROLLOUT_UNAVAILABLE',
        message: 'Trusted AI control rollout evidence is missing or invalid.',
      },
    });

    expect(resolveAIRuntimeControlLoadFailure(unavailable)).toBe('rollout-unavailable');
    expect(shouldRetryAIRuntimeControlLoad(0, unavailable)).toBe(false);
  });

  it('does not classify a matching free-form message or another status as rollout state', () => {
    const messageOnly = new HttpError('Request failed: 503', 503, {
      detail: 'Trusted AI control rollout evidence is missing or invalid.',
    });
    const wrongStatus = new HttpError('Request failed: 409', 409, {
      errorCode: 'AI_CONTROL_ROLLOUT_UNAVAILABLE',
    });

    expect(resolveAIRuntimeControlLoadFailure(messageOnly)).toBe('load-error');
    expect(resolveAIRuntimeControlLoadFailure(wrongStatus)).toBe('load-error');
    expect(shouldRetryAIRuntimeControlLoad(0, messageOnly)).toBe(true);
    expect(shouldRetryAIRuntimeControlLoad(1, messageOnly)).toBe(false);
  });
});
