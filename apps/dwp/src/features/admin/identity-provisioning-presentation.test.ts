import { describe, expect, it } from 'vitest';

import {
  scimConnectorOperationLabelKey,
  scimEventOperationLabelKey,
  scimEventResourceLabelKey,
} from './identity-provisioning-presentation';

describe('SCIM provisioning presentation', () => {
  it('maps supported owner codes to localized labels', () => {
    expect(scimEventOperationLabelKey('PATCH')).toContain('.PATCH');
    expect(scimEventResourceLabelKey('GROUP')).toContain('.GROUP');
    expect(scimConnectorOperationLabelKey('USERS')).toContain('.USERS');
  });

  it('fails closed for unknown operation and resource codes', () => {
    expect(scimEventOperationLabelKey('FUTURE_OPERATION')).toContain('.UNKNOWN');
    expect(scimEventResourceLabelKey('FUTURE_RESOURCE')).toContain('.UNKNOWN');
    expect(scimConnectorOperationLabelKey('FUTURE_SCOPE')).toContain('.UNKNOWN');
  });
});
