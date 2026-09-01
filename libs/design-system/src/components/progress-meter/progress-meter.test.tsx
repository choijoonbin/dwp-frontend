import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProgressMeter } from './progress-meter';

describe('ProgressMeter', () => {
  it('provides visible and accessible meaning while clamping the value', () => {
    const markup = renderToStaticMarkup(
      <ProgressMeter label="Campaign review progress" value={140} valueLabel="8 of 8" />
    );

    expect(markup).toContain('Campaign review progress');
    expect(markup).toContain('aria-label="Campaign review progress"');
    expect(markup).toContain('aria-valuenow="100"');
    expect(markup).toContain('aria-valuetext="8 of 8"');
  });

  it('preserves a meaningful fractional percentage for assistive technology', () => {
    const markup = renderToStaticMarkup(
      <ProgressMeter label="Review progress" value={62.5} valueLabel="5 of 8 complete" />
    );

    expect(markup).toContain('aria-valuenow="62.5"');
    expect(markup).toContain('aria-valuetext="5 of 8 complete"');
  });
});
