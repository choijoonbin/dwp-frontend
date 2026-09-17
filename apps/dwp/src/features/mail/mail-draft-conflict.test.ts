// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import {
  clearMailDraftConflict,
  clearMailDraftConflictsForTests,
  readMailDraftConflict,
  rememberMailDraftConflict,
} from './mail-draft-conflict';

describe('mail draft conflict custody', () => {
  afterEach(clearMailDraftConflictsForTests);

  it('preserves local and base versions across a reload boundary', () => {
    const conflict = {
      threadId: 'draft-1',
      base: { toEmail: 'base@example.com', subject: 'Base', body: 'Base body' },
      local: { toEmail: 'local@example.com', subject: 'Local', body: 'Local body' },
    };

    rememberMailDraftConflict('tenant:7:42', conflict);

    expect(readMailDraftConflict('tenant:7:42', 'draft-1')).toEqual(conflict);
    expect(readMailDraftConflict('tenant:7:43', 'draft-1')).toBeNull();
    clearMailDraftConflict('tenant:7:42', 'draft-1');
    expect(readMailDraftConflict('tenant:7:42', 'draft-1')).toBeNull();
  });

  it('drops malformed persisted data', () => {
    sessionStorage.setItem(
      'dwp.mail.draft-conflict.v1:tenant%3A7%3A42%3Adraft-1',
      '{"threadId":"draft-1","local":{}}'
    );

    expect(readMailDraftConflict('tenant:7:42', 'draft-1')).toBeNull();
  });
});
