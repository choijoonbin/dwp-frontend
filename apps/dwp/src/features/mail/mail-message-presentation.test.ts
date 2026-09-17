/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';

import {
  mailForwardDraft,
  mailExternalLinkDetails,
  mailMessageRecipients,
  mailRemoteImageCount,
  sanitizeMailHtml,
} from './mail-message-presentation';

describe('mail message presentation', () => {
  it('projects typed recipients while hiding inbound BCC values', () => {
    const recipients = [
      { type: 'TO', name: 'Alex', email: 'alex@example.com' },
      { recipientType: 'CC', displayName: 'Jin', emailAddress: 'jin@example.com' },
      { kind: 'BCC', address: 'hidden@example.com' },
    ];
    expect(mailMessageRecipients({ direction: 'INBOUND', recipients })).toEqual([
      { type: 'TO', name: 'Alex', email: 'alex@example.com' },
      { type: 'CC', name: 'Jin', email: 'jin@example.com' },
    ]);
    expect(mailMessageRecipients({ direction: 'OUTBOUND', recipients })).toHaveLength(3);
  });

  it('sanitizes active content and blocks remote images until requested', () => {
    const html = [
      '<p onclick="steal()">Hello <strong>team</strong></p>',
      '<script>alert(1)</script>',
      '<a href="javascript:alert(1)">bad</a>',
      '<img src="https://tracking.example/pixel.gif" alt="campaign">',
    ].join('');
    expect(mailRemoteImageCount(html)).toBe(1);
    const blocked = sanitizeMailHtml(html);
    expect(blocked).toContain('<strong>team</strong>');
    expect(blocked).toContain('data-mail-remote-image="blocked"');
    expect(blocked).not.toContain('onclick');
    expect(blocked).not.toContain('script');
    expect(blocked).not.toContain('javascript:');
    const loaded = sanitizeMailHtml(html, true);
    expect(loaded).toContain('src="https://tracking.example/pixel.gif"');
    expect(loaded).toContain('referrerpolicy="no-referrer"');
  });

  it('marks safe web links for an explicit external-navigation review', () => {
    const sanitized = sanitizeMailHtml(
      '<a href="https://docs.example.com/path?q=1" target="_blank">Review docs</a>'
    );
    expect(sanitized).toContain('data-mail-external-link="https://docs.example.com/path?q=1"');
    expect(sanitized).not.toContain('target="_blank"');
    expect(mailExternalLinkDetails('https://docs.example.com/path')).toEqual({
      url: 'https://docs.example.com/path',
      domain: 'docs.example.com',
    });
    expect(mailExternalLinkDetails('mailto:owner@example.com')).toBeNull();
  });

  it('builds a forward draft without carrying active HTML', () => {
    const draft = mailForwardDraft(
      'Launch review',
      {
        body: '<p>Hello <strong>team</strong></p>',
        bodyFormat: 'HTML',
        senderName: 'Alex',
        senderEmail: 'alex@example.com',
        sentAt: '2026-09-17T00:00:00Z',
      },
      { forwardedMessage: 'Forwarded message', from: 'From', sentAt: 'Date', subject: 'Subject' }
    );
    expect(draft.subject).toBe('Fwd: Launch review');
    expect(draft.body).toContain('Hello team');
    expect(draft.body).not.toContain('<strong>');
  });
});
