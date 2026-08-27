import { describe, expect, it } from 'vitest';

import { filterRolePulseTextItems } from './home-purpose-role-pulse-policy';

import type { NormalizedHomeContribution } from '../contributions';
import type { FlowSignal } from './flow-home-model';

function contribution(providerKey: string): NormalizedHomeContribution {
  return {
    id: `${providerKey}:pulse`,
    providerKey,
    owner: { source: providerKey, appKey: `APP.${providerKey}` },
    kind: 'PULSE',
    scope: 'ME',
    priority: 'LOW',
    status: 'ON_TRACK',
    title: providerKey,
    description: null,
    count: 1,
    dueAt: null,
    route: `/${providerKey}`,
    deepLink: `/${providerKey}`,
    dedupeKey: providerKey,
    sourceReference: providerKey,
    sourceReferences: [providerKey],
    generatedAt: '2026-08-27T00:00:00Z',
    freshness: { state: 'FRESH', expiresAt: null },
    privacy: { classification: 'INTERNAL', sensitive: false, redaction: 'NONE' },
    redacted: false,
    duplicateCount: 0,
  };
}

function signal(key: FlowSignal['key']): FlowSignal {
  return {
    key,
    label: key,
    value: 1,
    unit: 'items',
    tone: 'neutral',
    comparison: { kind: 'none' },
    source: key,
    generatedAt: '2026-08-27T00:00:00Z',
    route: '/insights',
  };
}

describe('role pulse text policy', () => {
  const items = [
    contribution('workspace-work'),
    contribution('calendar-home'),
    contribution('workspace-activity'),
    contribution('approval-home'),
  ];

  it('removes only provider rows already represented by available visual signals', () => {
    expect(
      filterRolePulseTextItems(items, [signal('open-work'), signal('focus-time')]).map(
        (item) => item.providerKey
      )
    ).toEqual(['workspace-activity', 'approval-home']);
  });

  it('preserves uncovered and non-visual provider rows during partial data', () => {
    expect(
      filterRolePulseTextItems(items, [signal('activity-attention')]).map(
        (item) => item.providerKey
      )
    ).toEqual(['workspace-work', 'calendar-home', 'approval-home']);
  });

  it('keeps the original projection when no visual signal is available', () => {
    expect(filterRolePulseTextItems(items, [])).toBe(items);
  });
});
