import { describe, expect, it } from 'vitest';

import {
  dwaionAttachmentSelectionCanSubmit,
  formatDwaionAttachmentBytes,
  validateDwaionAttachmentSelection,
} from './dwaion-secure-attachment-model';

import type { DwaionSecureAttachment } from '@dwp-frontend/shared-utils';

function file(name: string, size: number, type = 'application/pdf'): File {
  return { name, size, type } as File;
}

describe('DWAI.ON secure attachment selection', () => {
  it('blocks unsupported, empty, oversized, and excess selections before upload', () => {
    expect(validateDwaionAttachmentSelection(6, [file('a.pdf', 2)])).toBe('COUNT_EXCEEDED');
    expect(validateDwaionAttachmentSelection(0, [file('a.pdf', 0)])).toBe('EMPTY_FILE');
    expect(validateDwaionAttachmentSelection(0, [file('a.pdf', 100 * 1024 * 1024 + 1)])).toBe(
      'SIZE_EXCEEDED'
    );
    expect(
      validateDwaionAttachmentSelection(0, [file('a.exe', 4, 'application/x-msdownload')])
    ).toBe('TYPE_BLOCKED');
  });

  it('allows submission only when every selected attachment is verified ready', () => {
    const ready = { state: 'READY' } as DwaionSecureAttachment;
    const scanning = { state: 'SCANNING' } as DwaionSecureAttachment;
    expect(dwaionAttachmentSelectionCanSubmit([], false)).toBe(true);
    expect(dwaionAttachmentSelectionCanSubmit([ready], false)).toBe(true);
    expect(dwaionAttachmentSelectionCanSubmit([ready, scanning], false)).toBe(false);
    expect(dwaionAttachmentSelectionCanSubmit([ready], true)).toBe(false);
  });

  it('formats file sizes without overstating precision', () => {
    expect(formatDwaionAttachmentBytes(512)).toBe('512 B');
    expect(formatDwaionAttachmentBytes(1_025)).toBe('2 KB');
    expect(formatDwaionAttachmentBytes(1_572_864)).toBe('1.5 MB');
  });
});
