import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { NotificationAttentionControls } from './notification-attention-controls';
import { NotificationAttentionDashboard } from './notification-attention-dashboard';
import { NotificationTestDiagnosticsPanel } from './notification-attention-test-diagnostics';

import type {
  NotificationAttentionRule,
  NotificationAttentionScopeOption,
  NotificationTestDiagnostics,
} from './notification-attention-model';
import type { NotificationDiagnosticChannelOption } from './notification-attention-diagnostic-channels';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      ({
        'actions.refresh': 'Refresh',
        'actions.retry': 'Try again',
        'actions.edit': 'Edit',
        'actions.delete': 'Delete',
        'attention.add': 'Add rule',
        'attention.unavailable': 'Unavailable',
        'attention.capacityReached': `Rule limit reached (${options?.used} of ${options?.limit}).`,
        'attention.controls.serverSupplied':
          'These choices are supplied by the notification service for this notification.',
        'attention.controls.policyLocked': 'Policy locked',
        'attention.managed.noException': 'No user exception',
        'attention.diagnostics.states.COMPLETE': 'Diagnostic complete',
        'attention.diagnostics.exclusion':
          'Diagnostic only. Excluded from the inbox, business actions, and notification quality KPIs.',
        'attention.diagnostics.capabilities.DISABLED': 'Provider disabled',
        'attention.diagnostics.actionUnavailable': 'Test action unavailable',
        'attention.diagnostics.availability.RATE_LIMITED':
          'The server rate limit currently blocks another test.',
        'attention.diagnostics.channelsTitle': 'Active channels to test',
        'attention.diagnostics.channelAvailability.AVAILABLE': 'Available',
        'attention.diagnostics.channelAvailability.DISABLED': 'Disabled',
        'attention.diagnostics.channelReasons.PROVIDER_DISABLED':
          'External provider approval is pending.',
        'attention.diagnostics.selectChannel': 'Select at least one available channel.',
        'attention.diagnostics.run': 'Run test',
        'attention.diagnostics.requestFailures.RATE_LIMITED.title':
          'Test notification rate limit reached',
        'attention.diagnostics.requestFailures.RATE_LIMITED.description':
          'Retry after the server-provided window.',
        'attention.diagnostics.requestFailures.FORBIDDEN.title':
          'You cannot run this test notification',
        'attention.diagnostics.requestFailures.FORBIDDEN.description':
          'Refresh your access or session, then retry.',
        'preferences.managed': 'Managed',
        'states.loadingPreferences': 'Loading notification settings',
        'states.preferencesErrorTitle': 'Notification settings could not be loaded',
      })[key] ?? key,
  }),
}));

const rule: NotificationAttentionRule = {
  ruleId: 'managed-rule',
  kind: 'MUTE_SCOPE',
  label: 'Deployment notices',
  scopeLabel: 'IT Service / deployment update',
  scopeKind: 'APP_TYPE',
  source: 'TENANT_POLICY',
  sourceLabel: 'Company policy',
  effect: 'MUTE',
  channelLabels: ['In-app'],
  state: 'ENABLED',
  startsAt: '2026-09-17T09:00:00Z',
  expiresAt: '2026-09-30T09:00:00Z',
  updatedAt: '2026-09-16T09:00:00Z',
  managed: {
    ownerLabel: 'IT operations',
    reason: 'Managed during the deployment window',
    exceptionAllowed: false,
  },
  conflicts: [
    {
      conflictId: 'mandatory-conflict',
      severity: 'BLOCKING',
      message: 'Mandatory security notices still deliver.',
    },
  ],
  actions: {
    canEdit: false,
    canDelete: false,
    canPause: false,
    canResume: false,
    canExtend: false,
  },
};

const lockedOption: NotificationAttentionScopeOption = {
  optionId: 'mute-type',
  action: 'MUTE_TYPE',
  label: 'Mute this notification type',
  description: 'Applies to future notifications of this exact type.',
  scopeLabel: 'Security / device risk',
  scopeKind: 'APP_TYPE',
  current: false,
  availability: 'LOCKED',
  policyLock: {
    ownerLabel: 'Security policy',
    reason: 'This notification type is mandatory.',
    exceptionAllowed: false,
  },
  expirationOptions: [{ optionId: 'day', label: 'One day' }],
};

const diagnosticChannels: NotificationDiagnosticChannelOption[] = [
  { channel: 'IN_APP', availability: 'AVAILABLE', endpointLabels: [] },
  {
    channel: 'WEB_PUSH',
    availability: 'DISABLED',
    reason: 'PROVIDER_DISABLED',
    endpointLabels: [],
  },
  {
    channel: 'MOBILE_PUSH',
    availability: 'DISABLED',
    reason: 'PROVIDER_DISABLED',
    endpointLabels: [],
  },
];

describe('notification attention components', () => {
  it('renders managed rules, conflicts, capacity, and disabled add state without mutating data', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationAttentionDashboard, {
        summary: { VIP: 1, FOLLOW_CONTEXT: 2, MUTE_SCOPE: 1, TOPIC_WATCH: 0 },
        rules: [rule],
        state: { kind: 'READY' },
        ruleLimit: { used: 4, limit: 4, reached: true },
        selectedKind: 'ALL',
        searchQuery: '',
        now: Date.parse('2026-09-16T10:00:00Z'),
        onSelectedKindChange: vi.fn(),
        onSearchQueryChange: vi.fn(),
        onAddRule: vi.fn(),
      })
    );
    expect(markup).toContain('data-testid="notification-attention-dashboard"');
    expect(markup).toContain('data-rule-group="MUTE_SCOPE"');
    expect(markup).toContain('Deployment notices');
    expect(markup).toContain('Managed during the deployment window');
    expect(markup).toContain('Mandatory security notices still deliver.');
    expect(markup).toContain('Rule limit reached (4 of 4).');
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>.*Add rule/su);
    expect(markup).not.toContain('>Edit<');
    expect(markup).not.toContain('>Delete<');
  });

  it('separates personal rules into the four Stitch attention work areas', () => {
    const rules = (
      [
        ['VIP', 'Executive sponsor'],
        ['FOLLOW_CONTEXT', 'Release thread'],
        ['MUTE_SCOPE', 'Build noise'],
        ['TOPIC_WATCH', 'Security posture'],
      ] as const
    ).map(([kind, label], index) => ({
      ...rule,
      ruleId: `rule-${index}`,
      kind,
      label,
      scopeLabel: label,
      managed: null,
      conflicts: [],
    }));
    const markup = renderToStaticMarkup(
      createElement(NotificationAttentionDashboard, {
        summary: { VIP: 1, FOLLOW_CONTEXT: 1, MUTE_SCOPE: 1, TOPIC_WATCH: 1 },
        rules,
        state: { kind: 'READY' },
        ruleLimit: { used: 4, limit: 20, reached: false },
        selectedKind: 'ALL',
        searchQuery: '',
        onSelectedKindChange: vi.fn(),
        onSearchQueryChange: vi.fn(),
      })
    );

    for (const kind of ['VIP', 'FOLLOW_CONTEXT', 'MUTE_SCOPE', 'TOPIC_WATCH']) {
      expect(markup).toContain(`data-rule-group="${kind}"`);
    }
    expect(markup).toContain('Executive sponsor');
    expect(markup).toContain('Release thread');
    expect(markup).toContain('Build noise');
    expect(markup).toContain('Security posture');
  });

  it('does not present supplied summary values as current when the settings source fails', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationAttentionDashboard, {
        summary: { VIP: 99, FOLLOW_CONTEXT: 99, MUTE_SCOPE: 99, TOPIC_WATCH: 99 },
        rules: [],
        state: { kind: 'ERROR', message: 'Settings source unavailable.' },
        selectedKind: 'ALL',
        searchQuery: '',
        onSelectedKindChange: vi.fn(),
        onSearchQueryChange: vi.fn(),
      })
    );
    expect(markup).toContain('Notification settings could not be loaded');
    expect(markup.match(/>Unavailable</gu)).toHaveLength(4);
    expect(markup).not.toContain('>99<');
  });

  it('renders only server-provided contextual scopes and keeps mandatory locks explicit', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationAttentionControls, {
        notificationTitle: 'New device risk',
        whyReceived: 'Security policy includes your managed device.',
        scopeOptions: [lockedOption],
        selectedOptionId: 'mute-type',
        selectedExpirationId: 'day',
        preview: { state: 'IDLE' },
        onOptionChange: vi.fn(),
        onExpirationChange: vi.fn(),
        onPreview: vi.fn(),
        onApply: vi.fn(),
      })
    );
    expect(markup).toContain('data-testid="notification-attention-controls"');
    expect(markup).toContain('These choices are supplied by the notification service');
    expect(markup).toContain('Security policy: This notification type is mandatory.');
    expect(markup).toContain('No user exception');
    expect(markup).toMatch(/<input(?=[^>]*type="radio")(?=[^>]*disabled)[^>]*>/su);
    expect(markup).not.toContain('bypass');
    expect(markup).not.toContain('DND');
  });

  it('uses neutral diagnostic outcomes and marks tests as excluded from business results', () => {
    const diagnostics: NotificationTestDiagnostics = {
      state: 'COMPLETE',
      runAvailability: 'AVAILABLE',
      testId: 'test-123',
      generatedAt: '2026-09-16T09:00:00Z',
      expiresAt: '2026-09-17T09:00:00Z',
      stages: [
        {
          stageId: 'banner',
          label: 'In-app banner',
          description: 'Checks banner rendering capability.',
          capability: 'SUPPORTED',
          status: 'REACHED',
          observedAt: '2026-09-16T09:00:02Z',
        },
        {
          stageId: 'push',
          label: 'Browser push',
          description: 'Checks the configured push provider.',
          capability: 'DISABLED',
          status: 'SKIPPED',
          detail: 'Provider disabled by tenant configuration.',
        },
      ],
    };
    const markup = renderToStaticMarkup(
      createElement(NotificationTestDiagnosticsPanel, {
        diagnostics,
        channelOptions: diagnosticChannels,
        selectedChannels: ['IN_APP'],
        defaultExpanded: true,
        onRun: vi.fn(),
        onSelectedChannelsChange: vi.fn(),
      })
    );
    expect(markup).toContain('data-business-outcome="excluded"');
    expect(markup).toContain('Diagnostic complete');
    expect(markup).toContain(
      'Excluded from the inbox, business actions, and notification quality KPIs.'
    );
    expect(markup).toContain('Provider disabled');
    expect(markup).toContain('External provider approval is pending.');
    expect(markup.toLocaleLowerCase('en-US')).not.toContain('business success');
  });

  it('explains when a partial diagnostic cannot be run again because of a server rate limit', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationTestDiagnosticsPanel, {
        diagnostics: {
          state: 'PARTIAL',
          runAvailability: 'RATE_LIMITED',
          retryAt: '2026-09-16T09:01:00Z',
          statusMessage: 'The in-app stage was observed; browser push is disabled.',
          stages: [],
        },
        channelOptions: diagnosticChannels,
        selectedChannels: ['IN_APP'],
        onRun: vi.fn(),
        onSelectedChannelsChange: vi.fn(),
      })
    );
    expect(markup).toContain('Test action unavailable');
    expect(markup).toContain('The server rate limit currently blocks another test.');
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>.*Run test/su);
  });

  it('requires an actually available selected channel before enabling a test run', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationTestDiagnosticsPanel, {
        diagnostics: { state: 'IDLE', runAvailability: 'AVAILABLE', stages: [] },
        channelOptions: diagnosticChannels,
        selectedChannels: ['WEB_PUSH'],
        onRun: vi.fn(),
        onSelectedChannelsChange: vi.fn(),
      })
    );

    expect(markup).toContain('External provider approval is pending.');
    expect(markup).toContain('Select at least one available channel.');
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>.*Run test/su);
  });

  it.each([
    [
      'RATE_LIMITED' as const,
      'Test notification rate limit reached',
      'Retry after the server-provided window.',
    ],
    [
      'FORBIDDEN' as const,
      'You cannot run this test notification',
      'Refresh your access or session, then retry.',
    ],
  ])('keeps a failed diagnostic retryable for %s responses', (requestFailure, title, detail) => {
    const markup = renderToStaticMarkup(
      createElement(NotificationTestDiagnosticsPanel, {
        diagnostics: { state: 'IDLE', runAvailability: 'AVAILABLE', stages: [] },
        channelOptions: diagnosticChannels,
        selectedChannels: ['IN_APP'],
        requestFailure,
        onRun: vi.fn(),
        onSelectedChannelsChange: vi.fn(),
      })
    );

    expect(markup).toContain(title);
    expect(markup).toContain(detail);
    expect(markup).toMatch(/<button(?![^>]*disabled)[^>]*>.*Try again/su);
  });
});
