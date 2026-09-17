// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import type { MailAdvancedThreadDetail } from '@dwp-frontend/shared-utils';

import {
  clearMailDraftConflict,
  clearMailDraftConflictsForTests,
  mailDraftFieldsFromDetail,
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

  it('canonicalizes a legacy draft without advanced options for conflict comparison', () => {
    const fields = mailDraftFieldsFromDetail({
      thread: {
        accountId: 'account-1',
        subject: 'Matching draft',
        participants: [{ name: 'owner@example.com', email: 'owner@example.com' }],
      },
      messages: [{ direction: 'DRAFT', body: 'Matching body' }],
    } as unknown as MailAdvancedThreadDetail);

    expect(fields).toMatchObject({
      toEmail: 'owner@example.com',
      subject: 'Matching draft',
      body: 'Matching body',
      composeOptions: {
        accountId: 'account-1',
        recipients: [{ type: 'TO', name: null, email: 'owner@example.com' }],
        bodyFormat: 'TEXT',
      },
    });
  });
});
