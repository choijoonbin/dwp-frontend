import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { HrisSystemWorkspace, HrisSystemWorkspaceView } from '../pages/hris-system-workspace';

import type { HrisSystemWorkspaceModel } from '../model/hris-system-model';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

const model: HrisSystemWorkspaceModel = {
  state: 'READY',
  reasonCode: null,
  readOnly: false,
  roleGroups: ['EMPLOYEE'],
  menus: [
    {
      navigationKey: 'hr',
      itemType: 'GROUP',
      label: 'A very long localized human resources navigation label that must wrap safely',
      children: [
        {
          navigationKey: 'hr.self',
          itemType: 'APP',
          label: 'My HR',
          children: [],
        },
      ],
    },
  ],
  widgets: [
    {
      templateId: 'template-1',
      templateKey: 'employee-home',
      templateName: 'Employee home',
      widgetKey: 'hris-profile-summary-with-a-long-localized-name',
      templateVersion: 1,
    },
  ],
  sources: [
    { source: 'NAVIGATION', state: 'AVAILABLE' },
    { source: 'HOME_TEMPLATE', state: 'AVAILABLE' },
  ],
  homeEntitlements: [],
  evidenceVersion: 'access-1',
  projectionVersion: 'projection-1',
  canOpenGovernance: true,
  configurationActions: [],
};

describe('HrisSystemWorkspaceView', () => {
  it('publishes the query-backed workspace entry for route composition', () => {
    expect(HrisSystemWorkspace).toBeTypeOf('function');
  });

  it('uses semantic headings, native keyboard navigation, canonical governance route and 320-safe layout', () => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(HrisSystemWorkspaceView, { model }))
    );

    expect(html).toContain('data-testid="hris-system-workspace"');
    expect(html).toContain('<h1');
    expect(html.match(/<h2/gu)).toHaveLength(3);
    expect(html).toContain('href="/admin/identity/app-governance?product=HCM"');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
    expect(html).toContain('min-width:0');
    expect(html).toContain('overflow-wrap:anywhere');
    expect(html).not.toContain('@keyframes');
  });

  it('renders RESULT_UNKNOWN guidance without exposing a duplicate-submit action', () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(HrisSystemWorkspaceView, {
          model,
          ownerReceipt: {
            idempotencyKey: 'owner-request-0001',
            request: {
              presetCode: 'HCM_CONFIGURATION_OWNER',
              resourceSetId: 'scope-1',
              validTo: '2026-12-31T00:00:00Z',
              reviewDueAt: '2026-11-30T00:00:00Z',
            },
            status: 'RESULT_UNKNOWN',
          },
          onReconcileOwnerReceipt: vi.fn(),
        })
      )
    );

    expect(html).toContain('system.owner.resultUnknown');
    expect(html).toContain('system.owner.reconcile');
    expect(html).not.toContain('Submit again');
  });
});
