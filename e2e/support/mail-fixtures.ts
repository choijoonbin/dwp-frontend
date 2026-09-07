import type { Page, Route } from '@playwright/test';
import type { MailOrganization } from '@dwp-frontend/shared-utils';

import { mockShellSession } from './shell-session';

export const MEMBER_PERMISSIONS = [
  {
    resourceType: 'APP',
    resourceKey: 'APP.MAIL',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'APP',
    resourceKey: 'APP.MAIL',
    permissionCode: 'UPDATE',
    effect: 'ALLOW' as const,
  },
];

export function fulfill(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data }),
  });
}

export function thread(id: string, options: { shared?: boolean; subject?: string } = {}) {
  return {
    threadId: id,
    accountId: '10000000-0000-0000-0000-000000000001',
    accountName: options.shared ? 'People Help' : 'Mina Kim',
    folderType: 'INBOX',
    sharedInboxId: options.shared ? '20000000-0000-0000-0000-000000000001' : null,
    sharedInboxName: options.shared ? 'People Help' : null,
    subject: options.subject ?? 'Customer launch review',
    preview: 'Please confirm the launch review before the customer meeting.',
    participants: [{ name: 'Alex Park', email: 'alex.park@example.com' }],
    latestMessageAt: '2026-08-19T08:30:00Z',
    unread: true,
    starred: false,
    importance: 'HIGH',
    triageLane: options.shared ? 'ASSIGNED' : 'PRIORITY',
    workflowState: 'OPEN',
    snoozedUntil: null,
    assignedUserId: options.shared ? 42 : null,
    assignedName: options.shared ? 'Mina Kim' : null,
    attachments: false,
    externalSender: true,
    classification: 'CONFIDENTIAL',
    messageCount: 2,
    version: 3,
  };
}

export function detail(item: ReturnType<typeof thread>, deliveryState = 'FAILED') {
  return {
    thread: item,
    messages: [
      {
        messageId: '30000000-0000-0000-0000-000000000001',
        senderEmail: 'alex.park@example.com',
        senderName: 'Alex Park',
        recipients: [{ name: 'Mina Kim', email: 'mina.kim@sk.com', type: 'TO' }],
        direction: 'INBOUND',
        bodyFormat: 'TEXT',
        body: 'Please confirm the launch review.',
        attachments: [],
        sentAt: '2026-08-19T08:00:00Z',
        deliveryState: 'RECEIVED',
        acceptedAt: null,
        lastDeliveryError: null,
      },
      {
        messageId: '30000000-0000-0000-0000-000000000002',
        senderEmail: 'mina.kim@sk.com',
        senderName: 'Mina Kim',
        recipients: [{ name: 'Alex Park', email: 'alex.park@example.com', type: 'TO' }],
        direction: 'OUTBOUND',
        bodyFormat: 'TEXT',
        body: 'I will confirm the final review shortly.',
        attachments: [],
        sentAt: '2026-08-19T08:15:00Z',
        deliveryState,
        acceptedAt: null,
        lastDeliveryError: deliveryState === 'FAILED' ? 'PROVIDER_UNAVAILABLE' : null,
      },
    ],
    internalComments: [],
    proposals: [],
    sharedInboxMembers: item.sharedInboxId
      ? [
          {
            userId: 42,
            displayName: 'Mina Kim',
            emailAddress: 'mina.kim@sk.com',
            memberRole: 'MANAGER',
          },
          {
            userId: 43,
            displayName: 'Jin Lee',
            emailAddress: 'jin.lee@sk.com',
            memberRole: 'MEMBER',
          },
        ]
      : [],
  };
}

export function draftDetail(
  id: string,
  fields: { toEmail?: string; subject?: string; body?: string },
  version: number
) {
  const item = {
    ...thread(id, { subject: fields.subject || '(No subject)' }),
    folderType: 'DRAFTS',
    workflowState: 'DRAFT',
    preview: fields.body ?? '',
    participants: fields.toEmail ? [{ name: fields.toEmail, email: fields.toEmail }] : [],
    unread: false,
    externalSender: false,
    messageCount: 1,
    version,
  };
  return {
    thread: item,
    messages: [
      {
        messageId: '30000000-0000-0000-0000-000000000099',
        senderEmail: 'mina.kim@sk.com',
        senderName: 'Mina Kim',
        recipients: fields.toEmail
          ? [{ name: fields.toEmail, email: fields.toEmail, type: 'TO' }]
          : [],
        direction: 'DRAFT',
        bodyFormat: 'TEXT',
        body: fields.body ?? '',
        attachments: [],
        sentAt: '2026-08-29T03:00:00Z',
        deliveryState: 'DRAFT',
        acceptedAt: null,
        lastDeliveryError: null,
      },
    ],
    internalComments: [],
    proposals: [],
    sharedInboxMembers: [],
  };
}

export function mailOrganization(): MailOrganization {
  return {
    accounts: [
      {
        accountId: '10000000-0000-0000-0000-000000000001',
        emailAddress: 'mina.kim@sk.com',
        displayName: 'Mina Kim',
        accountKind: 'PERSONAL',
        providerType: 'DWP_SANDBOX',
        connectionState: 'ACTIVE',
        synchronizationState: 'READY',
        defaultAccount: true,
      },
    ],
    folders: [
      {
        folderId: '11000000-0000-0000-0000-000000000001',
        accountId: '10000000-0000-0000-0000-000000000001',
        parentFolderId: null,
        folderKey: 'inbox',
        displayName: 'Inbox',
        folderType: 'INBOX',
        color: 'BLUE',
        synchronizationState: 'SYNCED',
        sortOrder: 10,
        totalCount: 6,
        unreadCount: 2,
        version: 0,
      },
      {
        folderId: '11000000-0000-0000-0000-000000000002',
        accountId: '10000000-0000-0000-0000-000000000001',
        parentFolderId: null,
        folderKey: 'projects',
        displayName: 'Projects',
        folderType: 'CUSTOM',
        color: 'TEAL',
        synchronizationState: 'LOCAL_ONLY',
        sortOrder: 100,
        totalCount: 3,
        unreadCount: 1,
        version: 0,
      },
    ],
    rules: [],
    recentRuns: [],
    generatedAt: '2026-08-27T08:00:00Z',
  };
}

export function mailAddressBook(
  contacts: Array<Record<string, unknown>> = [],
  groups: Array<Record<string, unknown>> = []
) {
  return {
    contacts: { items: contacts, total: contacts.length, page: 0, pageSize: 100 },
    groups,
    summary: {
      contactCount: contacts.length,
      favoriteCount: contacts.filter((contact) => contact.favorite).length,
      groupCount: groups.length,
    },
    generatedAt: '2026-09-03T03:00:00Z',
  };
}

export async function mockMailMember(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    email: 'mina.kim@sk.com',
    permissions: MEMBER_PERMISSIONS,
  });
}
