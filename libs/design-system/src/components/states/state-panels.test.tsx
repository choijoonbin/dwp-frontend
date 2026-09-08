import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { GuidedEmptyState, LoadingState, LocalErrorState } from './state-panels';

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

describe('LocalErrorState heading contract', () => {
  it('keeps H2 as the default and allows an explicit page-level H1', () => {
    const nestedMarkup = renderToStaticMarkup(
      <LocalErrorState title="Unavailable" description="Try again later." />
    );
    const pageMarkup = renderToStaticMarkup(
      <LocalErrorState title="Unavailable" titleComponent="h1" description="Try again later." />
    );

    expect(nestedMarkup).toContain('<h2');
    expect(nestedMarkup).not.toContain('<h1');
    expect(pageMarkup).toContain('<h1');
    expect(pageMarkup).not.toContain('<h2');
  });
});
