import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import {
  createMailContact,
  getMailAddressBook,
  replaceMailContactGroupMembers,
  sendMailContactGroupMessage,
} from './mail-address-book-api';

describe('mail address book API boundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('encodes contact search only in the read URL', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({
      data: { data: { contacts: { items: [], total: 0, page: 2, pageSize: 25 } } },
    });

    await getMailAddressBook({ query: 'Kim / launch', page: 2, pageSize: 25 });

    expect(get).toHaveBeenCalledWith(
      '/api/platform/v1/mail/address-book?page=2&pageSize=25&query=Kim+%2F+launch'
    );
  });

  it('creates a personal contact without allowing client-forged directory provenance', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({
      data: { data: { contactId: 'contact-1' } },
    });

    await createMailContact({
      displayName: 'Kim Min',
      emailAddress: 'kim@example.com',
      organizationName: 'Example',
      jobTitle: 'Product lead',
      phoneNumber: null,
      favorite: true,
      idempotencyKey: 'request-1',
    });

    expect(post).toHaveBeenCalledWith('/api/platform/v1/mail/contacts', {
      displayName: 'Kim Min',
      emailAddress: 'kim@example.com',
      organizationName: 'Example',
      jobTitle: 'Product lead',
      phoneNumber: null,
      favorite: true,
      idempotencyKey: 'request-1',
      sourceKind: 'MANUAL',
      sourcePersonPublicId: null,
    });
  });

  it('keeps reviewed group version and idempotency on membership and send commands', async () => {
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({
      data: { data: { groupId: 'group-1', version: 8 } },
    });
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({
      data: { data: { thread: { threadId: 'thread-1' } } },
    });

    await replaceMailContactGroupMembers('group/1', {
      contactIds: ['contact-2', 'contact-1'],
      idempotencyKey: 'members-request',
      version: 7,
    });
    await sendMailContactGroupMessage('group/1', {
      subject: 'Launch review',
      body: 'Please review.',
      classification: 'INTERNAL',
      idempotencyKey: 'send-request',
      groupVersion: 8,
    });

    expect(put).toHaveBeenCalledWith('/api/platform/v1/mail/contact-groups/group%2F1/members', {
      contactIds: ['contact-2', 'contact-1'],
      idempotencyKey: 'members-request',
      version: 7,
    });
    expect(post).toHaveBeenCalledWith('/api/platform/v1/mail/contact-groups/group%2F1/messages', {
      subject: 'Launch review',
      body: 'Please review.',
      classification: 'INTERNAL',
      idempotencyKey: 'send-request',
      groupVersion: 8,
    });
  });
});
