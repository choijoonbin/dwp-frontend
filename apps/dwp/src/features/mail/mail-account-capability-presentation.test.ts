import { describe, expect, it } from 'vitest';

import { mailAccountCapabilityPresentation } from './mail-account-capability-presentation';

describe('mail account capability presentation', () => {
  it('keeps provider send, content, attachment, and scheduling readiness distinct', () => {
    const result = mailAccountCapabilityPresentation(
      { accountKind: 'PERSONAL' },
      {
        multipleRecipients: true,
        cc: true,
        bcc: false,
        html: true,
        attachments: false,
        scheduling: true,
        maximumAttachmentBytes: 25 * 1024 * 1024,
      }
    );

    expect(result).toEqual([
      { key: 'send', ready: true },
      { key: 'bcc', ready: false },
      { key: 'html', ready: true },
      { key: 'attachments', ready: false },
      { key: 'scheduling', ready: true },
    ]);
  });

  it('reports shared identity readiness from the governed shared sender capability', () => {
    const result = mailAccountCapabilityPresentation({ accountKind: 'SHARED' }, undefined);
    expect(result.at(-1)).toEqual({ key: 'sharedIdentity', ready: false });
  });
});
