import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import { HcmQueryState } from './hcm-query-state';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { reference?: string }) =>
      values?.reference ? `${key}:${values.reference}` : key,
  }),
}));

function renderState(error: unknown) {
  return renderToStaticMarkup(createElement(HcmQueryState, { error, onRetry: () => undefined }));
}

describe('HCM query state', () => {
  it('replaces internal authorization errors with an actionable permission status', () => {
    const markup = renderState(
      new HttpError('The exact HCM route authority required for this operation is missing.', 403, {
        correlationId: 'corr-safe-123',
      })
    );

    expect(markup).toContain('data-query-state="permission"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('domains.queryState.checkAccess');
    expect(markup).toContain('domains.queryState.reference:corr-safe-123');
    expect(markup).not.toContain('exact HCM route authority');
  });

  it('renders missing data separately from permission and retryable service failures', () => {
    expect(renderState(new HttpError('missing', 404))).toContain('data-query-state="not-found"');
    const unavailable = renderState(new HttpError('gateway unavailable', 503));
    expect(unavailable).toContain('data-query-state="unavailable"');
    expect(unavailable).toContain('role="alert"');
  });
});
