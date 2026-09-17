import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  DwaionTokenBudgetActivationNotice,
  tokenBudgetEnforcementLabel,
} from './dwaion-token-budget-activation';

describe('token budget enforcement activation presentation', () => {
  it('marks a persisted BLOCK policy as staged when runtime enforcement is disabled', () => {
    expect(tokenBudgetEnforcementLabel('BLOCK', 'DISABLED', 'Active', 'Staged only')).toBe(
      'BLOCK · Staged only'
    );
    const html = renderToStaticMarkup(
      <DwaionTokenBudgetActivationNotice
        activationState="DISABLED"
        warning="Runtime blocking is disabled."
        recovery="Activate the approved runtime flag and restart."
      />
    );
    expect(html).toContain('Runtime blocking is disabled.');
    expect(html).toContain('Activate the approved runtime flag and restart.');
  });

  it('does not show an inactive warning when enforcement is enabled', () => {
    const html = renderToStaticMarkup(
      <DwaionTokenBudgetActivationNotice
        activationState="ENABLED"
        warning="Runtime blocking is disabled."
        recovery="Activate runtime enforcement."
      />
    );
    expect(html).toBe('');
  });
});
