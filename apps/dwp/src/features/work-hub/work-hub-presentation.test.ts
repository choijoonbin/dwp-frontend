import { describe, expect, it } from 'vitest';

import { workHubSourceStatusLabelKey } from './work-hub-presentation';

describe('workHubSourceStatusLabelKey', () => {
  it('uses owner-aware labels without probing unregistered dynamic translation keys', () => {
    expect(workHubSourceStatusLabelKey('SERVICE_REQUEST', 'AWAITING_REQUESTER')).toBe(
      'workHub.statusLabels.serviceAwaiting'
    );
    expect(workHubSourceStatusLabelKey('IDENTITY_GOVERNANCE', 'in-progress')).toBe(
      'workHub.statusLabels.reviewInProgress'
    );
  });

  it('falls back to a verified lifecycle or the registered unknown label', () => {
    expect(workHubSourceStatusLabelKey('UNMODELED', 'private-state', 'WAITING')).toBe(
      'workHub.lifecycle.WAITING'
    );
    expect(workHubSourceStatusLabelKey('UNMODELED', 'private-state')).toBe(
      'workHub.sourceStatuses.UNKNOWN'
    );
  });
});
