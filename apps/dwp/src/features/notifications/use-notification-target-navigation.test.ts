import { describe, expect, it } from 'vitest';

import { normalizeNotificationTargetHref } from './use-notification-target-navigation';

describe('normalizeNotificationTargetHref', () => {
  const baseHref = 'https://workspace.example.com/notifications/center';

  it('normalizes same-origin routes while preserving query and fragment', () => {
    expect(normalizeNotificationTargetHref('/messages/direct?id=7#message-9', baseHref)).toBe(
      '/messages/direct?id=7#message-9'
    );
  });

  it.each([
    '//malicious.example/path',
    '/\\\\malicious.example/path',
    '/%5cmalicious.example/path',
    '/%2fmalicious.example/path',
    'https://malicious.example/path',
    '/messages/7\nInjected',
    '/messages/7\u007fInjected',
  ])('rejects authority smuggling and malformed target %s', (href) => {
    expect(normalizeNotificationTargetHref(href, baseHref)).toBeNull();
  });
});
