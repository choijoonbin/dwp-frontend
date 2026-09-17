import type { Page, Route } from '@playwright/test';
import type { MailOrganization, MailSharedInboxAction } from '@dwp-frontend/shared-utils';

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
    permissionCode: 'CREATE',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'APP',
    resourceKey: 'APP.MAIL',
    permissionCode: 'UPDATE',
    effect: 'ALLOW' as const,
  },
  ...['SEND', 'DELETE', 'DECIDE'].map((permissionCode) => ({
    resourceType: 'APP',
    resourceKey: 'APP.MAIL',
    permissionCode,
    effect: 'ALLOW' as const,
  })),
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

export function detail(
  item: ReturnType<typeof thread>,
  deliveryState = 'FAILED',
  options: {
    projectSharedInboxActions?: boolean;
    sharedInboxActions?: MailSharedInboxAction[];
  } = {}
) {
  const projectSharedInboxActions =
    options.projectSharedInboxActions ?? Boolean(item.sharedInboxId);
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
    ...(projectSharedInboxActions
      ? {
          sharedInboxActions: options.sharedInboxActions ?? [
            'ASSIGN',
            'COMMENT',
            'REPLY',
            'SEND_AS',
          ],
        }
      : {}),
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

export async function mockMailMember(
  page: Page,
  additionalPermissions: Array<{
    resourceType: string;
    resourceKey: string;
    permissionCode: string;
    effect: 'ALLOW' | 'DENY';
  }> = []
) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    email: 'mina.kim@sk.com',
    permissions: [...MEMBER_PERMISSIONS, ...additionalPermissions],
  });
  await page.route('**/api/platform/v1/mail/compose-context', (route) =>
    fulfill(route, defaultMailComposeContext())
  );
  await page.route('**/api/platform/v1/mail/writing-assets', (route) =>
    fulfill(route, { templates: [], signatures: [] })
  );
  await page.route('**/api/platform/v1/mail/preferences', (route) =>
    fulfill(route, defaultMailPreferences())
  );
}

function defaultMailPreferences() {
  return {
    density: 'COMFORTABLE',
    remoteImages: 'BLOCK',
    sendDelaySeconds: 0,
    keyboardShortcuts: false,
    notifyNewMail: true,
    notifySharedAssignment: true,
    notifyFollowUpDue: true,
    defaultAccountId: '10000000-0000-0000-0000-000000000001',
    defaultSignatureId: null,
    version: 1,
    orgLocks: {},
  };
}

function defaultMailComposeContext() {
  const capabilities = {
    multipleRecipients: true,
    cc: true,
    bcc: true,
    html: true,
    attachments: true,
    scheduling: true,
    maximumAttachmentBytes: 25 * 1024 * 1024,
  };
  return {
    accounts: mailOrganization().accounts,
    capabilities,
    accountCapabilities: {
      '10000000-0000-0000-0000-000000000001': capabilities,
    },
    accountReadiness: {
      '10000000-0000-0000-0000-000000000001': {
        state: 'READY',
        source: 'CONNECTOR_RUNTIME',
        observedAt: '2026-09-17T05:00:00Z',
        errorCode: null,
        credentialConfigured: true,
        lastSuccessfulSyncAt: '2026-09-17T04:55:00Z',
        lastSuccessfulSyncScope: 'INBOX',
        action: 'NONE',
        consentEvidence: {
          state: 'NOT_REQUIRED',
          source: 'CONNECTOR_RUNTIME',
          observedAt: '2026-09-17T05:00:00Z',
          expiresAt: null,
          errorCode: null,
          action: 'NONE',
        },
        tokenEvidence: {
          state: 'NOT_REQUIRED',
          source: 'CONNECTOR_RUNTIME',
          observedAt: '2026-09-17T05:00:00Z',
          expiresAt: null,
          errorCode: null,
          action: 'NONE',
        },
        featureReadiness: Object.fromEntries(
          ['SEND', 'BCC', 'HTML_BODY', 'ATTACHMENTS', 'SCHEDULING'].map((feature) => [
            feature,
            {
              state: 'READY',
              source: 'CONNECTOR_RUNTIME',
              observedAt: '2026-09-17T05:00:00Z',
              errorCode: null,
              lastSuccessfulAt: '2026-09-17T04:55:00Z',
              lastSuccessfulScope: feature,
              action: 'NONE',
            },
          ])
        ),
      },
    },
    templates: [],
    signatures: [],
    preferences: defaultMailPreferences(),
    variables: { displayName: 'Mina Kim', department: 'Digital Workplace' },
  };
}
