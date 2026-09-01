import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { GuidedEmptyState, LoadingState } from './state-panels';

describe('LoadingState accessibility contract', () => {
  it('keeps a custom loading silhouette inside a named status region', () => {
    const markup = renderToStaticMarkup(
      <LoadingState
        label="Loading workspace"
        variant="skeleton"
        skeleton={<div data-testid="workspace-silhouette" />}
      />
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="Loading workspace"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('data-testid="workspace-silhouette"');
    expect(markup).toContain('aria-hidden="true"');
  });

  it('keeps embedded silhouettes accessible without adding visible panel chrome', () => {
    const markup = renderToStaticMarkup(
      <LoadingState
        label="Loading calendar"
        variant="skeleton"
        embedded
        skeleton={<div data-testid="calendar-silhouette" />}
      />
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="Loading calendar"');
    expect(markup).toContain('data-testid="calendar-silhouette"');
    expect(markup).not.toContain('>Loading calendar</');
  });
});

describe('GuidedEmptyState accessibility contract', () => {
  it('can defer live-region semantics to a containing composite widget', () => {
    const markup = renderToStaticMarkup(
      <GuidedEmptyState
        kind="empty"
        title="No rows"
        description="Create the first row to continue."
        announce={false}
      />
    );

    expect(markup).not.toContain('role="status"');
    expect(markup).toContain('No rows');
  });
});
