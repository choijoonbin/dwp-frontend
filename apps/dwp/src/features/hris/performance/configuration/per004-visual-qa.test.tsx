// @vitest-environment node
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';

import { Per004WorkspaceView } from './per004-workspace';
import type { Per004ViewState } from './per004-workspace';

const css = readFileSync(new URL('./per004-workspace.css', import.meta.url), 'utf8');
const item = {
  itemPublicId: '12345678-1234-4234-8234-123456789abc',
  title:
    'A very long governed performance policy title that must wrap — 장문의 성과 평가 정책 제목',
  statusCode: 'SIMULATED',
  fieldGroups: {
    POLICY_VERSION: {
      decision: 'VIEW' as const,
      value: { policyKey: 'review.policy', revision: 7 },
    },
    PERFORMANCE_POLICY: {
      decision: 'VIEW' as const,
      value: { policyKey: 'review.policy', revision: 7 },
    },
    EFFECTIVE_STATUS: { decision: 'VIEW' as const, value: { code: 'SIMULATED', revision: 7 } },
  },
  deepLink: {
    route: '/hr/settings/performance',
    resourcePublicId: '12345678-1234-4234-8234-123456789abc',
  },
  availableActions: [
    {
      actionKey:
        'hris.action.sys.post.platform.v1.admin.hris.configurations.resource.versions.resource.submit' as const,
      method: 'POST' as const,
      targetResourceType: 'REFERENCE_CONFIGURATION_VERSION' as const,
      targetConfigurationId: '12345678-1234-4234-8234-123456789abc',
      targetVersion: 7,
      expectedObjectVersion: 11,
      resolvedHref:
        '/api/platform/v1/admin/hris/configurations/12345678-1234-4234-8234-123456789abc/versions/7/submit',
      idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY' as const,
      stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED' as const,
    },
  ],
};
const projection = { items: [item] } as unknown as Parameters<
  typeof Per004WorkspaceView
>[0]['projection'];
const states: readonly [string, Per004ViewState, boolean][] = [
  ['loading', 'LOADING', false],
  ['empty', 'EMPTY', false],
  ['complete', 'COMPLETE', true],
  ['partial', 'PARTIAL', false],
  ['unavailable', 'UNAVAILABLE', false],
  ['forbidden', 'FORBIDDEN', false],
  ['step-up', 'STEP_UP', false],
  ['masked', 'COMPLETE', false],
];

describe('PER-004 visual reflow (unmounted view only)', () => {
  it('keeps eight states within 1440/1280/390/320 at normal and 200% text zoom', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      for (const [name, state, hasAction] of states) {
        const shown =
          name === 'masked'
            ? ({
                items: [
                  {
                    ...item,
                    availableActions: [],
                    fieldGroups: {
                      ...item.fieldGroups,
                      PERFORMANCE_POLICY: {
                        decision: 'MASK' as const,
                        value: null,
                        maskReason: 'FIELD_RESTRICTED',
                        maskedDisplayKey: 'restricted',
                      },
                    },
                  },
                ],
              } as unknown as typeof projection)
            : projection;
        for (const width of [1440, 1280, 390, 320]) {
          for (const zoom of [1, 2]) {
            const context = await browser.newContext({
              viewport: { width, height: 900 },
              reducedMotion: 'reduce',
            });
            const page = await context.newPage();
            const markup = renderToStaticMarkup(
              <Per004WorkspaceView
                variant="PERFORMANCE"
                state={state}
                projection={shown}
                locale={width === 390 ? 'ko' : 'en'}
                retryable
                onRetry={() => {}}
                onAction={() => {}}
              />
            );
            await page.setContent(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1" />
              <style>html{font-family:Arial,sans-serif;font-size:${zoom * 100}%;}body{margin:0;}
              ${css}</style></head><body>${markup}</body></html>`);
            const metrics = await page.evaluate(() => ({
              scrollWidth: document.documentElement.scrollWidth,
              viewportWidth: window.innerWidth,
              actionCount: document.querySelectorAll('.per004-workspace__action').length,
            }));
            expect(metrics.scrollWidth, `${name}/${width}/${zoom}`).toBeLessThanOrEqual(
              metrics.viewportWidth
            );
            expect(metrics.actionCount, `${name}/${width}/${zoom}`).toBe(hasAction ? 1 : 0);
            await context.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
  }, 60_000);
});
