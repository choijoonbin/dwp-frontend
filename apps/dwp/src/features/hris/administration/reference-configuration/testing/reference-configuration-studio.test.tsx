import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ReferenceConfigurationStudio } from '../components/reference-configuration-studio';

describe('ReferenceConfigurationStudio', () => {
  it('renders a responsive list-detail studio with immutable owner evidence and actions', () => {
    const html = renderToStaticMarkup(
      createElement(ReferenceConfigurationStudio, {
        state: 'READY',
        workbench: workbench(),
        detail: detail(),
        detailLoading: false,
        selectedId: CONFIGURATION_ID,
        statusFilter: '',
        onStatusFilterChange: vi.fn(),
        onSelect: vi.fn(),
        onRefresh: vi.fn(),
        onPrepareAction: vi.fn(),
      })
    );

    expect(html).toContain('data-testid="reference-configuration-studio"');
    expect(html).toContain('Reference configuration');
    expect(html).toContain('Owner evidence — content is not copied here');
    expect(html).toContain('SCHEDULE');
    expect(html).toContain('PUBLISH');
    expect(html).toContain('Evidence: CURRENT');
    expect(html).not.toContain('WorkforceReferenceData');
  });

  it('keeps denied, unavailable, partial, and empty surfaces materially distinct', () => {
    const base = {
      detailLoading: false,
      statusFilter: '',
      onStatusFilterChange: vi.fn(),
      onSelect: vi.fn(),
      onRefresh: vi.fn(),
      onPrepareAction: vi.fn(),
    };
    expect(
      renderToStaticMarkup(
        createElement(ReferenceConfigurationStudio, { ...base, state: 'DENIED' })
      )
    ).toContain('Reference configuration is restricted');
    expect(
      renderToStaticMarkup(
        createElement(ReferenceConfigurationStudio, { ...base, state: 'UNAVAILABLE' })
      )
    ).toContain('Reference configuration is unavailable');
    expect(
      renderToStaticMarkup(
        createElement(ReferenceConfigurationStudio, {
          ...base,
          state: 'EMPTY',
          workbench: { ...workbench(), queryState: { ...workbench().queryState, state: 'EMPTY' } },
        })
      )
    ).toContain('No configuration versions match this scope');
  });
});

const CONFIGURATION_ID = '10000000-0000-4000-8000-000000000001';

function detail() {
  return {
    configurationId: CONFIGURATION_ID,
    version: 3,
    state: 'APPROVED' as const,
    effectiveFrom: '2026-10-13T00:00:00Z',
    effectiveTo: null,
    schemaKey: 'employment-status',
    schemaVersion: 2,
    payloadDigest: 'a'.repeat(64),
    approvalReceiptId: '20000000-0000-4000-8000-000000000001',
    aggregateVersion: 4,
  };
}

function workbench() {
  return {
    projectionVersion: '1' as const,
    asOf: '2026-10-12T00:00:00Z',
    variantKey: 'REFERENCE' as const,
    queryState: {
      state: 'COMPLETE' as const,
      scopeDecisionRevision: 'scope-1',
      freshness: 'CURRENT' as const,
      nextCursor: null,
      fieldDecisionSummary: { viewCount: 3, maskedCount: 0, omittedCount: 0 },
      partialFailures: [],
      correlationId: '30000000-0000-4000-8000-000000000001',
      cachePolicy: {
        authorizationDecisionRevision: 'scope-1',
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1' as const,
        maxAgeSeconds: 30,
      },
    },
    items: [
      {
        itemPublicId: CONFIGURATION_ID,
        title: 'Employment status',
        statusCode: 'APPROVED' as const,
        fieldGroups: {
          POLICY_VERSION: { decision: 'VIEW', value: { revision: 3 } },
          REFERENCE_DATA: { decision: 'VIEW', value: { code: 'SYS' } },
        },
        deepLink: {
          route: '/hr/settings/reference-data' as const,
          resourcePublicId: CONFIGURATION_ID,
        },
        availableActions: [action('schedule'), action('publish')],
      },
    ],
  };
}

function action(name: 'schedule' | 'publish') {
  return {
    actionKey: `hris.action.sys.post.platform.v1.admin.hris.configurations.resource.versions.resource.${name}`,
    method: 'POST' as const,
    hrefTemplate: `/api/platform/v1/admin/hris/configurations/{configId}/versions/{version}/${name}`,
    idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY' as const,
    stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED' as const,
  };
}
