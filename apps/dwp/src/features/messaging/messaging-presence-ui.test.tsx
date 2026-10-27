// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values
        ? `${key}:${Object.values(values)
            .map((value) => String(value))
            .join(':')}`
        : key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

import { MessagingPersonLine } from './messaging-components';
import { MessagingPeoplePulse } from './messaging-home-continuation-sections';
import { MessagingMentionMenu } from './messaging-mention-menu';

describe('messaging presence UI', () => {
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

  it('distinguishes unavailable authority from a truthful zero-person state', async () => {
    await act(async () =>
      root.render(
        <MessagingPeoplePulse
          people={[
            {
              userId: 77,
              emailAddress: 'cached@example.com',
              displayName: 'Cached Live Person',
              presenceState: 'AVAILABLE',
            },
          ]}
          presence={{
            authority: 'UNAVAILABLE',
            evaluatedAt: '2026-10-27T07:00:00Z',
            leaseTtlSeconds: 75,
            refreshAfterSeconds: 15,
          }}
          onRetry={vi.fn()}
          onOpenDirectory={vi.fn()}
          onOpenPerson={vi.fn()}
          openingPerson={false}
        />
      )
    );

    expect(host.querySelector('[data-testid="messaging-presence-unavailable"]')).not.toBeNull();
    expect(host.textContent).toContain('home.people.unavailableTitle');
    expect(host.textContent).not.toContain('home.people.emptyTitle');
    expect(host.textContent).not.toContain('Cached Live Person');
  });

  it('exposes a textual presence label in addition to the decorative color dot', async () => {
    await act(async () =>
      root.render(
        <MessagingPersonLine
          person={{
            userId: 77,
            emailAddress: 'available@example.com',
            displayName: 'Available Person',
            presenceState: 'AVAILABLE',
          }}
        />
      )
    );

    expect(host.textContent).toContain('home.people.presence.AVAILABLE');
    expect(host.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('keeps presence in the accessible name of an actionable person row', async () => {
    await act(async () =>
      root.render(
        <MessagingPeoplePulse
          people={[
            {
              userId: 77,
              emailAddress: 'available@example.com',
              displayName: 'Available Person',
              presenceState: 'AVAILABLE',
            },
          ]}
          presence={{
            authority: 'LIVE',
            evaluatedAt: '2026-10-27T07:00:00Z',
            leaseTtlSeconds: 75,
            refreshAfterSeconds: 15,
          }}
          onRetry={vi.fn()}
          onOpenDirectory={vi.fn()}
          onOpenPerson={vi.fn()}
          openingPerson={false}
        />
      )
    );

    expect(
      host.querySelector('button[aria-label*="home.people.presence.AVAILABLE"]')
    ).not.toBeNull();
  });

  it('includes presence text in member mention suggestions', async () => {
    const anchor = document.createElement('div');
    host.append(anchor);

    await act(async () =>
      root.render(
        <MessagingMentionMenu
          anchorEl={anchor}
          open
          options={[
            {
              key: '77',
              token: '@Available Person',
              label: 'Available Person',
              detail: 'Risk Analyst',
              presenceState: 'AVAILABLE',
              userIds: [77],
              all: false,
            },
          ]}
          listboxId="presence-suggestions"
          activeIndex={0}
          suggestionsLabel="Mention suggestions"
          emptyLabel="No suggestions"
          participantCountLabel={(count) => `${count} participants`}
          onActiveIndexChange={vi.fn()}
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />
      )
    );

    expect(document.body.textContent).toContain('home.people.presence.AVAILABLE');
  });
});
