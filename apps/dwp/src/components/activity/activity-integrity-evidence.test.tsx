import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { UseQueryResult } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import { ActivityIntegrityEvidence } from './activity-integrity-evidence';

import type { WorkspaceActivityEvidence } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function query(
  data?: WorkspaceActivityEvidence,
  error?: Error
): UseQueryResult<WorkspaceActivityEvidence, Error> {
  return {
    data,
    error: error ?? null,
    isLoading: false,
    isError: Boolean(error),
  } as UseQueryResult<WorkspaceActivityEvidence, Error>;
}

describe('Activity integrity evidence', () => {
  it('shows a loading state without implying a link or integrity result', () => {
    const markup = renderToStaticMarkup(
      createElement(ActivityIntegrityEvidence, {
        query: {
          data: undefined,
          error: null,
          isLoading: true,
          isError: false,
        } as UseQueryResult<WorkspaceActivityEvidence, Error>,
      })
    );

    expect(markup).toContain('activityFoundation.detail.integrity.loading');
    expect(markup).not.toContain('activityFoundation.detail.integrity.status.VERIFIED');
  });

  it('keeps reference linkage separate from daily-checkpoint integrity', () => {
    const markup = renderToStaticMarkup(
      createElement(ActivityIntegrityEvidence, {
        query: query({
          eventId: 'aaaaaaaa-0000-5000-8000-000000000101',
          auditRecordId: 'aaaaaaaa-0000-5000-8000-000000000102',
          linkStatus: 'LINKED',
          auditAccess: 'AVAILABLE',
          recordHash: 'a'.repeat(64),
          hashAlgorithm: 'SHA-256',
          integrityStatus: 'VERIFIED',
          integrityScope: 'DAILY_CHECKPOINT_REPORTED',
          verifiedAt: '2026-09-07T09:00:00Z',
          observedAt: '2026-09-07T09:01:00Z',
        }),
      })
    );

    expect(markup).toContain('data-integrity-status="VERIFIED"');
    expect(markup).toContain('activityFoundation.detail.integrity.link.LINKED');
    expect(markup).toContain('activityFoundation.detail.integrity.status.VERIFIED');
    expect(markup).toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(markup).toContain('activityFoundation.detail.integrity.scopeNotice');
  });

  it('does not expose a hash or infer verification for restricted evidence', () => {
    const markup = renderToStaticMarkup(
      createElement(ActivityIntegrityEvidence, {
        query: query({
          eventId: 'aaaaaaaa-0000-5000-8000-000000000101',
          auditRecordId: 'aaaaaaaa-0000-5000-8000-000000000102',
          linkStatus: 'LINKED',
          auditAccess: 'RESTRICTED',
          recordHash: null,
          hashAlgorithm: null,
          integrityStatus: 'UNAVAILABLE',
          integrityScope: 'DAILY_CHECKPOINT_REPORTED',
          verifiedAt: null,
          observedAt: '2026-09-07T09:01:00Z',
        }),
      })
    );

    expect(markup).toContain('data-integrity-status="UNAVAILABLE"');
    expect(markup).toContain('activityFoundation.detail.integrity.restricted');
    expect(markup).not.toContain('activityFoundation.detail.integrity.recordHash');
    expect(markup).not.toContain('activityFoundation.detail.integrity.status.VERIFIED');
  });

  it('renders contradictory restricted data fail-closed when the API validator is bypassed', () => {
    const secretHash = 'b'.repeat(64);
    const markup = renderToStaticMarkup(
      createElement(ActivityIntegrityEvidence, {
        query: query({
          eventId: 'aaaaaaaa-0000-5000-8000-000000000101',
          auditRecordId: 'aaaaaaaa-0000-5000-8000-000000000102',
          linkStatus: 'LINKED',
          auditAccess: 'RESTRICTED',
          recordHash: secretHash,
          hashAlgorithm: 'SHA-256',
          integrityStatus: 'VERIFIED',
          integrityScope: 'DAILY_CHECKPOINT_REPORTED',
          verifiedAt: '2026-09-07T09:00:00Z',
          observedAt: '2026-09-07T09:01:00Z',
        }),
      })
    );

    expect(markup).toContain('data-integrity-status="UNAVAILABLE"');
    expect(markup).toContain('activityFoundation.detail.integrity.restricted');
    expect(markup).not.toContain(secretHash);
    expect(markup).not.toContain('activityFoundation.detail.integrity.verifiedAt');
    expect(markup).not.toContain('activityFoundation.detail.integrity.status.VERIFIED');
  });

  it.each([
    [403, 'RESTRICTED'],
    [404, 'NOT_COLLECTED'],
    [503, 'UNAVAILABLE'],
  ])('presents HTTP %s as %s without a success claim', (status, state) => {
    const markup = renderToStaticMarkup(
      createElement(ActivityIntegrityEvidence, {
        query: query(undefined, new HttpError('not available', status)),
      })
    );
    expect(markup).toContain(`activityFoundation.detail.integrity.errors.${state}.title`);
    expect(markup).not.toContain('activityFoundation.detail.integrity.status.VERIFIED');
  });
});
