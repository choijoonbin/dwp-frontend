import { describe, expect, it } from 'vitest';

import { formatMailAttachmentSize, mailMessageAttachments } from './mail-attachment-download';

describe('mail attachment presentation', () => {
  it('keeps every downloadable attachment in server order', () => {
    expect(
      mailMessageAttachments([
        {
          attachmentId: 'attachment-1',
          fileName: 'agenda.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1536,
        },
        {
          attachmentId: 'attachment-2',
          fileName: 'notes.txt',
          contentType: 'text/plain',
          sizeBytes: 12,
        },
      ]).map((attachment) => attachment.fileName)
    ).toEqual(['agenda.pdf', 'notes.txt']);
  });

  it('rejects incomplete attachment projections and formats useful sizes', () => {
    expect(mailMessageAttachments([{ fileName: 'missing-id.pdf' }, null])).toEqual([]);
    expect(formatMailAttachmentSize(1536, 'en')).toBe('1.5 KB');
    expect(formatMailAttachmentSize(12, 'en')).toBe('12 B');
  });
});
