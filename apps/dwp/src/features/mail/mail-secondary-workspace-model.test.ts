import { describe, expect, it } from 'vitest';

import {
  getMailSecondaryView,
  mailDeliveryPresentation,
  MAIL_SECONDARY_VIEWS,
} from './mail-secondary-workspace-model';

describe('mail secondary workspace model', () => {
  it('gives every user workflow a stable and unique route', () => {
    expect(MAIL_SECONDARY_VIEWS).toHaveLength(11);
    const routes = MAIL_SECONDARY_VIEWS.map((item) => item.path);
    expect(new Set(routes).size).toBe(routes.length);
    expect(getMailSecondaryView('templates').capability).toBe('AVAILABLE');
    expect(getMailSecondaryView('accounts').capability).toBe('AVAILABLE');
  });

  it('never presents the current SENT state as confirmed recipient delivery', () => {
    expect(mailDeliveryPresentation('SENT')).toMatchObject({
      confirmedDelivered: false,
      retryAllowed: false,
      severity: 'info',
      labelFallback: 'Accepted by provider',
    });
    expect(mailDeliveryPresentation('FAILED').retryAllowed).toBe(false);
    expect(mailDeliveryPresentation('PROVIDER_ACCEPTED')).toMatchObject({
      confirmedDelivered: false,
      retryAllowed: false,
      labelFallback: 'Accepted by provider (recipient delivery unconfirmed)',
    });
    expect(mailDeliveryPresentation('RESULT_UNKNOWN')).toMatchObject({
      confirmedDelivered: false,
      retryAllowed: false,
      severity: 'warning',
      labelFallback: 'Result needs verification',
    });
    expect(mailDeliveryPresentation('DELIVERED')).toMatchObject({
      confirmedDelivered: true,
      retryAllowed: false,
      severity: 'success',
    });
  });
});
