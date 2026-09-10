import { expect, type Page } from '@playwright/test';

import { DEFAULT_APP_PERMISSIONS } from './runtime-access';

export async function mockPendingBootstrapSignIn(page: Page) {
  let authenticated = false;
  let meRequestCount = 0;
  let loginRequestCount = 0;
  let policyRequestCount = 0;
  let telemetryRequestCount = 0;
  let submittedCredentials: Record<string, unknown> | null = null;
  let signalBootstrapVerification = () => undefined;
  let releaseBootstrapVerification = () => undefined;
  let signalLoginRequest = () => undefined;
  let signalTelemetryRejected = () => undefined;
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
  const telemetryRejected = new Promise<void>((resolve) => {
    signalTelemetryRejected = resolve;
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
  await page.route('**/api/auth/policy', (route) => {
    policyRequestCount += 1;
    return route.fulfill({
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
    });
  });
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
  await page.unroute('**/api/platform/v1/observability/web-vitals');
  await page.route('**/api/platform/v1/observability/web-vitals', async (route) => {
    telemetryRequestCount += 1;
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', errorCode: 'AUTHENTICATION_REQUIRED' }),
    });
    signalTelemetryRejected();
  });

  return {
    bootstrapVerificationRequested,
    loginRequested,
    telemetryRejected,
    brandingRequested,
    releaseBootstrapVerification: () => releaseBootstrapVerification(),
    releaseBranding: () => releaseBranding(),
    loginRequestCount: () => loginRequestCount,
    meRequestCount: () => meRequestCount,
    policyRequestCount: () => policyRequestCount,
    telemetryRequestCount: () => telemetryRequestCount,
    submittedCredentials: () => submittedCredentials,
    observeInteractionBoundary: async () => {
      await expect
        .poll(() => page.evaluate(() => window.__dwpWebVitalsRegistered === true))
        .toBe(true);
      await page.evaluate(() => {
        const state = window as typeof window & {
          __dwpShellBootObserved?: boolean;
          __dwpShellBootObserver?: MutationObserver;
          __dwpSignInFormReference?: HTMLFormElement;
          __dwpEmailInputReference?: HTMLInputElement;
          __dwpPasswordInputReference?: HTMLInputElement;
        };
        const form = document.querySelector<HTMLFormElement>('#dwp-sign-in-form');
        const email = document.querySelector<HTMLInputElement>('#dwp-email');
        const password = document.querySelector<HTMLInputElement>('#dwp-password');
        if (!form || !email || !password) throw new Error('Sign-in form was not rendered.');
        state.__dwpShellBootObserved = false;
        state.__dwpShellBootObserver = new MutationObserver(() => {
          if (document.querySelector('[data-testid="shell-boot-screen"]')) {
            state.__dwpShellBootObserved = true;
          }
        });
        state.__dwpShellBootObserver.observe(document.body, { childList: true, subtree: true });
        state.__dwpSignInFormReference = form;
        state.__dwpEmailInputReference = email;
        state.__dwpPasswordInputReference = password;
      });
    },
    formSnapshot: () =>
      page.evaluate(() => {
        const state = window as typeof window & {
          __dwpSignInFormReference?: HTMLFormElement;
          __dwpEmailInputReference?: HTMLInputElement;
          __dwpPasswordInputReference?: HTMLInputElement;
        };
        return {
          sameForm: state.__dwpSignInFormReference === document.querySelector('#dwp-sign-in-form'),
          sameEmail: state.__dwpEmailInputReference === document.querySelector('#dwp-email'),
          samePassword:
            state.__dwpPasswordInputReference === document.querySelector('#dwp-password'),
          email: document.querySelector<HTMLInputElement>('#dwp-email')?.value,
          password: document.querySelector<HTMLInputElement>('#dwp-password')?.value,
        };
      }),
    shellBootObserved: () =>
      page.evaluate(() => {
        const state = window as typeof window & {
          __dwpShellBootObserved?: boolean;
          __dwpShellBootObserver?: MutationObserver;
        };
        state.__dwpShellBootObserver?.disconnect();
        return state.__dwpShellBootObserved;
      }),
  };
}
