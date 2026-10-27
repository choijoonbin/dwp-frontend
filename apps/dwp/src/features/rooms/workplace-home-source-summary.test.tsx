// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkplaceHomeSourceSummary } from './workplace-home-source-summary';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { provider?: string; time?: string }) =>
      values?.provider ? `${key}:${values.provider}` : values?.time ? `${key}:${values.time}` : key,
    i18n: { resolvedLanguage: 'ko' },
  }),
}));

vi.mock('@dwp-frontend/shared-i18n', () => ({
  formatDate: () => '16:20',
  resolveSupportedLocale: () => 'ko',
}));

describe('WorkplaceHomeSourceSummary', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('shows provider-owned freshness without claiming an occupancy value', async () => {
    await act(async () => {
      root.render(
        <WorkplaceHomeSourceSummary
          workspaceState="READY"
          calendarState="READY"
          externalPresenceState="READY"
          workspaceUpdatedAt="2026-10-27T07:20:00Z"
          calendarUpdatedAt="2026-10-27T07:20:00Z"
          externalPresenceUpdatedAt="2026-10-27T07:20:00Z"
          externalPresenceProvider="DWP_LOCAL_VERIFICATION"
        />
      );
    });

    expect(host.textContent).toContain('workplace.home.sources.externalPresence');
    expect(host.textContent).toContain('workplace.home.live');
    expect(host.textContent).toContain(
      'workplace.home.sources.externalVerifiedDescription:DWP_LOCAL_VERIFICATION'
    );
    expect(host.textContent).toContain('workplace.home.status.verifiedAt:16:20');
  });

  it('keeps a degraded provider visibly distinct from stale or unverified data', async () => {
    await act(async () => {
      root.render(
        <WorkplaceHomeSourceSummary
          workspaceState="READY"
          calendarState="SKIPPED"
          externalPresenceState="DEGRADED"
          externalPresenceUpdatedAt="2026-10-27T07:20:00Z"
          externalPresenceProvider="DWP_LOCAL_VERIFICATION"
        />
      );
    });

    expect(host.textContent).toContain('workplace.home.sources.degraded');
    expect(host.textContent).toContain(
      'workplace.home.sources.externalDegradedDescription:DWP_LOCAL_VERIFICATION'
    );
  });
});
