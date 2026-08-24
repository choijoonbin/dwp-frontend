import { describe, expect, it } from 'vitest';

import { resolveOidcCallbackDestination } from './oidc-callback';

describe('OIDC callback destination', () => {
  it('uses the normal login query return URL only for LOGIN callbacks', () => {
    expect(
      resolveOidcCallbackDestination(
        { purpose: 'LOGIN', response: { status: 'OK', message: '', data: {} } },
        '/approvals/home?scope=S1'
      )
    ).toBe('/approvals/home?scope=S1');
  });

  it('uses only the server-normalized header return path for STEP_UP callbacks', () => {
    expect(
      resolveOidcCallbackDestination(
        {
          purpose: 'STEP_UP',
          response: { status: 'OK', message: '', data: {} },
          flowId: '8f879f98-2476-4c33-a228-2984567ab889',
          returnTo: '/approvals/admin/workflows?scope=S2',
        },
        '/attacker-controlled'
      )
    ).toBe('/approvals/admin/workflows?scope=S2');
  });
});
