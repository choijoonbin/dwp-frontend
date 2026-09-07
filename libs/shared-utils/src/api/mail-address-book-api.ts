import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { MailClassification, MailThreadDetail } from './mail-api';

export type MailContactSourceKind = 'MANUAL' | 'DIRECTORY';

export type MailContact = {
  contactId: string;
  displayName: string;
  emailAddress: string;
  organizationName?: string | null;
  jobTitle?: string | null;
  phoneNumber?: string | null;
  sourceKind: MailContactSourceKind;
  sourcePersonPublicId?: string | null;
  favorite: boolean;
  version: number;
  updatedAt: string;
};

export type MailContactGroupMember = {
  contactId: string;
  displayName: string;
  emailAddress: string;
  organizationName?: string | null;
  sortOrder: number;
};

export type MailContactGroup = {
  groupId: string;
  displayName: string;
  description?: string | null;
  members: MailContactGroupMember[];
  version: number;
  updatedAt: string;
};

export type MailAddressBook = {
  contacts: {
    items: MailContact[];
    total: number;
    page: number;
    pageSize: number;
  };
  groups: MailContactGroup[];
  summary: {
    contactCount: number;
    favoriteCount: number;
    groupCount: number;
  };
  generatedAt: string;
};

export type MailContactInput = {
  displayName: string;
  emailAddress: string;
  organizationName?: string | null;
  jobTitle?: string | null;
  phoneNumber?: string | null;
  favorite: boolean;
};

export async function getMailAddressBook(
  input: {
    query?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<MailAddressBook> {
  const search = new URLSearchParams({
    page: String(input.page ?? 0),
    pageSize: String(input.pageSize ?? 50),
  });
  if (input.query?.trim()) search.set('query', input.query.trim());
  const response = await axiosInstance.get<ApiResponse<MailAddressBook>>(
    `/api/platform/v1/mail/address-book?${search.toString()}`
  );
  return response.data.data;
}

export async function createMailContact(
  input: MailContactInput & { idempotencyKey: string }
): Promise<MailContact> {
  const response = await axiosInstance.post<ApiResponse<MailContact>>(
    '/api/platform/v1/mail/contacts',
    { ...input, sourceKind: 'MANUAL', sourcePersonPublicId: null }
  );
  return response.data.data;
}

export async function updateMailContact(
  contactId: string,
  input: MailContactInput & { version: number }
): Promise<MailContact> {
  const response = await axiosInstance.put<ApiResponse<MailContact>>(
    `/api/platform/v1/mail/contacts/${encodeURIComponent(contactId)}`,
    input
  );
  return response.data.data;
}

export async function archiveMailContact(contactId: string, version: number): Promise<void> {
  await axiosInstance.delete(
    `/api/platform/v1/mail/contacts/${encodeURIComponent(contactId)}?version=${version}`
  );
}

export async function createMailContactGroup(input: {
  displayName: string;
  description?: string | null;
  idempotencyKey: string;
}): Promise<MailContactGroup> {
  const response = await axiosInstance.post<ApiResponse<MailContactGroup>>(
    '/api/platform/v1/mail/contact-groups',
    input
  );
  return response.data.data;
}

export async function updateMailContactGroup(
  groupId: string,
  input: { displayName: string; description?: string | null; version: number }
): Promise<MailContactGroup> {
  const response = await axiosInstance.put<ApiResponse<MailContactGroup>>(
    `/api/platform/v1/mail/contact-groups/${encodeURIComponent(groupId)}`,
    input
  );
  return response.data.data;
}

export async function replaceMailContactGroupMembers(
  groupId: string,
  input: { contactIds: string[]; idempotencyKey: string; version: number }
): Promise<MailContactGroup> {
  const response = await axiosInstance.put<ApiResponse<MailContactGroup>>(
    `/api/platform/v1/mail/contact-groups/${encodeURIComponent(groupId)}/members`,
    input
  );
  return response.data.data;
}

export async function archiveMailContactGroup(groupId: string, version: number): Promise<void> {
  await axiosInstance.delete(
    `/api/platform/v1/mail/contact-groups/${encodeURIComponent(groupId)}?version=${version}`
  );
}

export async function sendMailContactGroupMessage(
  groupId: string,
  input: {
    subject: string;
    body: string;
    classification: MailClassification;
    idempotencyKey: string;
    groupVersion: number;
  }
): Promise<MailThreadDetail> {
  const response = await axiosInstance.post<ApiResponse<MailThreadDetail>>(
    `/api/platform/v1/mail/contact-groups/${encodeURIComponent(groupId)}/messages`,
    input
  );
  return response.data.data;
}
