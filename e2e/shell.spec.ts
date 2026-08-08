import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function expectNoAutomaticAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({ target: node.target, html: node.html })),
  }));
  expect(summary).toEqual([]);
}

async function mockAgentPlanContract(page: Page) {
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' },
      }),
    })
  );
  await page.route('**/api/agent/v1/plans/preview', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'Plan preview prepared.',
        success: true,
        data: {
          runId: 'run-ref-1042',
          auditId: 'AUD-REF-1042',
          planHash: 'a'.repeat(64),
          correlationId: 'correlation-ref-1042',
          state: 'REVIEW',
          riskTier: 'L2',
          approvalRequired: true,
          mutationAllowed: false,
          summary: 'Prepare a governed flexible work request preview.',
          steps: [
            {
              id: 'verify-sources',
              title: 'Verify source permissions and freshness',
              tool: 'policy.check',
              description: 'Stop if a source is outside the user scope.',
            },
            {
              id: 'human-gate',
              title: 'Wait for explicit user approval',
              tool: 'workflow.human-approval',
              description: 'A separate approved command is required before mutation.',
            },
          ],
          sourceReferences: ['src-policy-flex', 'src-remote-guide'],
          referenceMode: true,
          agentRegistry: {
            entryKey: 'REFERENCE_PLANNER',
            revision: 2,
            artifactVersion: '1.1.0',
            riskTier: 'MEDIUM',
            resolution: 'ACTIVE',
          },
        },
      }),
    })
  );
}

test('unauthenticated users see the login shell without business navigation', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', errorCode: 'UNAUTHORIZED' }),
    });
  });
  await page.route('**/api/auth/policy', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          tenantId: 1,
          defaultLoginType: 'LOCAL',
          allowedLoginTypes: ['LOCAL'],
          localLoginEnabled: true,
          ssoLoginEnabled: false,
          requireMfa: false,
        },
      }),
    });
  });
  await page.route('**/api/auth/idp', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    });
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.locator('nav')).toHaveCount(0);
  await expectNoAutomaticAccessibilityViolations(page);
});

test('authenticated users keep the common shell without business navigation', async ({
  page,
}, testInfo) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 1,
          displayName: 'Admin',
          email: 'admin@dwp.local',
          tenantId: 1,
          tenantCode: 'default',
          roles: ['ADMIN'],
        },
      }),
    });
  });
  await page.route('**/api/auth/permissions', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    });
  });

  await page.goto('/');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('dwp.accessToken'))).toBeNull();
  await expect(page.getByRole('button', { name: 'Select workspace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page);

  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('menuitem', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Preferences' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Security & sessions' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Administration' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  await expect(page.locator('[role="menuitem"]')).toHaveCount(0);
  await expectNoAutomaticAccessibilityViolations(page);

  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: 'Preferences' }).click();
  await expect(page).toHaveURL(/\/account\/settings/);
  await expect(page.locator('[role="menuitem"]')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Color mode' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'High contrast' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Interface density' })).toBeVisible();
  await expect(page.getByText('Managed')).toHaveCount(3);
  await expectNoAutomaticAccessibilityViolations(page);

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const sidebar = page.getByTestId('mobile-sidebar');
    await expect(sidebar.getByRole('link', { name: 'Digital Workplace home' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Today', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Work', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Ask', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Activity', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Apps', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link')).toHaveCount(6);
  } else {
    const sidebar = page.getByTestId('desktop-sidebar');
    await expect(sidebar.getByRole('link', { name: 'Digital Workplace home' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Today', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Work', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Ask', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Activity', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Apps', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link')).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'Collapse navigation' })).toBeVisible();
  }
});

test('reference work hub connects Today, Work, Ask, Activity, and Apps', async ({
  page,
}, testInfo) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 1,
          displayName: 'Admin User',
          email: 'admin@dwp.local',
          tenantId: 1,
          tenantCode: 'default',
          roles: ['ADMIN'],
        },
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );
  await mockAgentPlanContract(page);

  const navigateTo = async (label: 'Work' | 'Ask' | 'Activity' | 'Apps') => {
    if (testInfo.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await page
        .getByTestId('mobile-sidebar')
        .getByRole('link', { name: label, exact: true })
        .click();
      return;
    }
    await page
      .getByTestId('desktop-sidebar')
      .getByRole('link', { name: label, exact: true })
      .click();
  };

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await page.getByRole('button', { name: /Approve software access request/ }).click();
  await expect(page).toHaveURL(/\/work\?item=WK-1042/);
  await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Work queue' })).toBeVisible();
  await expect(page.getByText('WK-1042 / Approval / Owner: You')).toBeVisible();

  await navigateTo('Ask');
  await expect(page.getByRole('heading', { name: 'Ask DWP' })).toBeVisible();
  await page.getByRole('button', { name: 'Can I work remotely next Friday?' }).click();
  await expect(page.getByRole('heading', { name: 'Answer' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Answer sources' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Flexible work request preview' })).toBeVisible();
  await expect(page.getByText('AUD-REF-1042')).toBeVisible();

  await navigateTo('Activity');
  await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Agents' }).click();
  await expect(
    page.getByRole('list', { name: 'Workspace activity' }).getByRole('listitem')
  ).toHaveCount(2);
  await page.getByRole('button', { name: /Restricted payroll query stopped by policy/ }).click();
  await expect(page.getByText('AUD-20260808-2051')).toBeVisible();

  await navigateTo('Apps');
  await expect(page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search apps' }).fill('legacy');
  await expect(page.getByText('1 apps')).toBeVisible();
  await page.getByRole('button', { name: /Legacy operations/ }).click();
  await expect(page.getByRole('alert')).toContainText('Legacy operations launch preview opened.');
  await expect(page.locator('.MuiAlert-root')).toHaveCSS('opacity', '1');
  await expectNoAutomaticAccessibilityViolations(page);
});

test('users can review and revoke another browser session', async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 1,
          displayName: 'Admin',
          email: 'admin@dwp.local',
          tenantId: 1,
          tenantCode: 'default',
          roles: ['ADMIN'],
        },
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' },
      }),
    })
  );

  let sessions = [
    {
      sessionId: '11111111-1111-4111-8111-111111111111',
      current: true,
      ipAddress: '10.20.30.40',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
      startedAt: '2026-08-08T00:00:00Z',
      lastSeenAt: '2026-08-08T00:10:00Z',
      idleExpiresAt: '2026-08-08T00:40:00Z',
      expiresAt: '2026-08-08T08:00:00Z',
    },
    {
      sessionId: '22222222-2222-4222-8222-222222222222',
      current: false,
      ipAddress: '203.0.113.24',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0',
      startedAt: '2026-08-07T23:00:00Z',
      lastSeenAt: '2026-08-08T00:05:00Z',
      idleExpiresAt: '2026-08-08T00:35:00Z',
      expiresAt: '2026-08-08T07:00:00Z',
    },
  ];

  await page.route('**/api/auth/sessions/**', async (route) => {
    const sessionId = route.request().url().split('/').pop();
    sessions = sessions.filter((session) => session.sessionId !== sessionId);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: null }),
    });
  });
  await page.route('**/api/auth/sessions', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: sessions }),
    });
  });

  await page.goto('/account/security');
  await expect(page.getByRole('heading', { name: 'Security & sessions' })).toBeVisible();
  const sessionList = page.getByRole('list', { name: 'Active browser sessions' });
  await expect(sessionList.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByText('Chrome on macOS')).toBeVisible();
  const otherSession = sessionList
    .getByRole('listitem')
    .filter({ hasText: 'Microsoft Edge on Windows' });
  await otherSession.getByRole('button', { name: 'End session' }).click();

  const dialog = page.getByRole('dialog', { name: 'End this session?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Sign out' }).click();
  await expect(sessionList.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByText('Microsoft Edge on Windows')).toHaveCount(0);
  await expectNoAutomaticAccessibilityViolations(page);
});
