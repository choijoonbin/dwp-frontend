import type { Page } from '@playwright/test';

import { DEFAULT_APP_PERMISSIONS } from './runtime-access';

export async function mockPendingBootstrapSignIn(page: Page) {
  let authenticated = false;
  let meRequestCount = 0;
  let loginRequestCount = 0;
  let submittedCredentials: Record<string, unknown> | null = null;
  let signalBootstrapVerification = () => undefined;
  let releaseBootstrapVerification = () => undefined;
  let signalLoginRequest = () => undefined;
  let signalBrandingRequest = () => undefined;
  let releaseBranding = () => undefined;
  const bootstrapVerificationRequested = new Promise<void>((resolve) => {
    signalBootstrapVerification = resolve;
  });
  const bootstrapVerificationGate = new Promise<void>((resolve) => {
    releaseBootstrapVerification = resolve;
  });
  const loginRequested = new Promise<void>((resolve) => {
    signalLoginRequest = resolve;
  });
  const brandingRequested = new Promise<void>((resolve) => {
    signalBrandingRequest = resolve;
  });
  const brandingGate = new Promise<void>((resolve) => {
    releaseBranding = resolve;
  });

  await page.route('**/api/auth/me', async (route) => {
    const requestAuthenticated = authenticated;
    meRequestCount += 1;
    if (meRequestCount === 1) {
      signalBootstrapVerification();
      await bootstrapVerificationGate;
    }
    await route.fulfill(
      requestAuthenticated
        ? {
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'SUCCESS',
              message: 'OK',
              data: {
                userId: 1,
                displayName: 'Admin',
                jobTitle: 'Platform administrator',
                email: 'admin@dwp.local',
                tenantId: 1,
                tenantCode: 'default',
                identityPlane: 'TENANT',
                roles: ['ADMIN'],
              },
            }),
          }
        : {
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'ERROR', errorCode: 'UNAUTHORIZED' }),
          }
    );
  });
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: DEFAULT_APP_PERMISSIONS,
      }),
    })
  );
  await page.route('**/api/auth/policy', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          localLoginAvailable: true,
          ssoLoginAvailable: false,
          preferredLoginType: 'LOCAL',
        },
      }),
    })
  );
  await page.route('**/api/auth/login', (route) => {
    loginRequestCount += 1;
    submittedCredentials = route.request().postDataJSON() as Record<string, unknown>;
    authenticated = true;
    signalLoginRequest();
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: {} }),
    });
  });
  await page.unroute('**/api/platform/v1/tenant-branding');
  await page.route('**/api/platform/v1/tenant-branding', async (route) => {
    signalBrandingRequest();
    await brandingGate;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: { organizationName: 'SK AX', logoUrl: null, version: 1 },
      }),
    });
  });

  return {
    bootstrapVerificationRequested,
    loginRequested,
    brandingRequested,
    releaseBootstrapVerification: () => releaseBootstrapVerification(),
    releaseBranding: () => releaseBranding(),
    loginRequestCount: () => loginRequestCount,
    meRequestCount: () => meRequestCount,
    submittedCredentials: () => submittedCredentials,
  };
}
