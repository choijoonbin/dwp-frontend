import { isAppReadEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';

import type { AppEntitlementPermission } from '@dwp-frontend/shared-utils/auth/app-entitlements';

export function isDwaionGlobalHostAllowed(
  identityPlane: unknown,
  permissions: readonly AppEntitlementPermission[]
): boolean {
  return identityPlane === 'TENANT' && isAppReadEntitled('APP.ASK', permissions);
}
