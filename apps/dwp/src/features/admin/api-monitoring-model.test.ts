import { describe, expect, it } from 'vitest';

import {
  apiMonitoringErrorMessage,
  apiMonitoringObservationLabelKey,
} from './api-monitoring-model';

describe('api monitoring presentation', () => {
  it('keeps internal error details out of the operator surface', () => {
    expect(apiMonitoringErrorMessage(new Error('database table missing'), 'Unable to load')).toBe(
      'Unable to load'
    );
  });

  it('fails closed for unknown observation points', () => {
    expect(apiMonitoringObservationLabelKey('GATEWAY')).toBe('apiMonitoring.observation.GATEWAY');
    expect(apiMonitoringObservationLabelKey('FUTURE')).toBe('apiMonitoring.observation.UNKNOWN');
  });
});
