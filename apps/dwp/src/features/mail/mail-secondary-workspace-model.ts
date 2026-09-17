import type {
  MailAccount,
  MailDeliveryState,
  MailThread,
  MailThreadDetail,
} from '@dwp-frontend/shared-utils';

export type MailSecondaryView =
  | 'search'
  | 'follow-up'
  | 'delivery'
  | 'shared'
  | 'contacts'
  | 'groups'
  | 'folders'
  | 'rules'
  | 'actions'
  | 'templates'
  | 'accounts';

export type MailSecondaryCapabilityState = 'AVAILABLE' | 'READ_ONLY' | 'UNAVAILABLE';

export type MailSecondaryViewDescriptor = {
  view: MailSecondaryView;
  path: string;
  capability: MailSecondaryCapabilityState;
  titleKey: string;
  titleFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
};

export const MAIL_SECONDARY_VIEWS = [
  {
    view: 'search',
    path: '/mail/search',
    capability: 'AVAILABLE',
    titleKey: 'secondary.search.title',
    titleFallback: 'Search mail',
    descriptionKey: 'secondary.search.description',
    descriptionFallback: 'Search only messages the current account is allowed to read.',
  },
  {
    view: 'follow-up',
    path: '/mail/follow-up',
    capability: 'AVAILABLE',
    titleKey: 'secondary.followUp.title',
    titleFallback: 'Follow-up',
    descriptionKey: 'secondary.followUp.description',
    descriptionFallback: 'Review messages that need a reply or are scheduled to return later.',
  },
  {
    view: 'delivery',
    path: '/mail/delivery',
    capability: 'READ_ONLY',
    titleKey: 'secondary.delivery.title',
    titleFallback: 'Delivery status',
    descriptionKey: 'secondary.delivery.description',
    descriptionFallback: 'Inspect the latest state reported by the mail delivery service.',
  },
  {
    view: 'shared',
    path: '/mail/shared',
    capability: 'AVAILABLE',
    titleKey: 'navigation.items.mail.shared.label',
    titleFallback: 'Shared inboxes',
    descriptionKey: 'secondary.shared.description',
    descriptionFallback: 'Assign, discuss, and reply to team mail in one workspace.',
  },
  {
    view: 'contacts',
    path: '/mail/contacts',
    capability: 'AVAILABLE',
    titleKey: 'addressBook.title',
    titleFallback: 'Contacts',
    descriptionKey: 'addressBook.description',
    descriptionFallback: 'Manage contacts and company directory entries.',
  },
  {
    view: 'groups',
    path: '/mail/groups',
    capability: 'AVAILABLE',
    titleKey: 'addressBook.group.listTitle',
    titleFallback: 'Mail groups',
    descriptionKey: 'secondary.groups.description',
    descriptionFallback: 'Review the current group version and recipients before sending.',
  },
  {
    view: 'folders',
    path: '/mail/organization?section=folders',
    capability: 'AVAILABLE',
    titleKey: 'organization.tabs.folders',
    titleFallback: 'Folders',
    descriptionKey: 'organization.description',
    descriptionFallback: 'Organize messages into personal folders.',
  },
  {
    view: 'rules',
    path: '/mail/organization?section=rules',
    capability: 'AVAILABLE',
    titleKey: 'organization.tabs.rules',
    titleFallback: 'Rules',
    descriptionKey: 'secondary.rules.description',
    descriptionFallback: 'Preview rule impact before applying rules to existing messages.',
  },
  {
    view: 'actions',
    path: '/mail/actions',
    capability: 'AVAILABLE',
    titleKey: 'home.assistant.title',
    titleFallback: 'Action proposals',
    descriptionKey: 'home.assistant.description',
    descriptionFallback: 'Review evidence before continuing in the app that owns the action.',
  },
  {
    view: 'templates',
    path: '/mail/templates',
    capability: 'AVAILABLE',
    titleKey: 'secondary.templates.title',
    titleFallback: 'Templates and signatures',
    descriptionKey: 'secondary.templates.description',
    descriptionFallback: 'Create reusable mail templates and account-specific signatures.',
  },
  {
    view: 'accounts',
    path: '/mail/accounts',
    capability: 'AVAILABLE',
    titleKey: 'accounts.title',
    titleFallback: 'Accounts and preferences',
    descriptionKey: 'secondary.accounts.description',
    descriptionFallback: 'Review account readiness and manage your personal mail preferences.',
  },
] as const satisfies readonly MailSecondaryViewDescriptor[];

export function getMailSecondaryView(view: MailSecondaryView): MailSecondaryViewDescriptor {
  return MAIL_SECONDARY_VIEWS.find((item) => item.view === view)!;
}

export function resolveMailSecondaryView(pathname: string): MailSecondaryView | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  if (normalized === '/mail/organization') return 'folders';
  const descriptor = MAIL_SECONDARY_VIEWS.find((item) => item.path.split('?')[0] === normalized);
  return descriptor?.view ?? null;
}

export type MailDeliveryPresentation = {
  severity: 'default' | 'info' | 'success' | 'warning' | 'error';
  labelKey: string;
  labelFallback: string;
  confirmedDelivered: boolean;
  retryAllowed: false;
};

const DELIVERY_PRESENTATIONS: Record<MailDeliveryState, MailDeliveryPresentation> = {
  RECEIVED: {
    severity: 'default',
    labelKey: 'delivery.state.RECEIVED',
    labelFallback: 'Received',
    confirmedDelivered: false,
    retryAllowed: false,
  },
  DRAFT: {
    severity: 'default',
    labelKey: 'delivery.state.DRAFT',
    labelFallback: 'Draft',
    confirmedDelivered: false,
    retryAllowed: false,
  },
  QUEUED: {
    severity: 'info',
    labelKey: 'delivery.state.QUEUED',
    labelFallback: 'Queued',
    confirmedDelivered: false,
    retryAllowed: false,
  },
  SENDING: {
    severity: 'info',
    labelKey: 'delivery.state.SENDING',
    labelFallback: 'Sending',
    confirmedDelivered: false,
    retryAllowed: false,
  },
  RETRYING: {
    severity: 'warning',
    labelKey: 'delivery.state.RETRYING',
    labelFallback: 'Retry in progress',
    confirmedDelivered: false,
    retryAllowed: false,
  },
  SENT: {
    severity: 'success',
    labelKey: 'secondary.delivery.sentUnconfirmed',
    labelFallback: 'Sent from DWP; recipient delivery is not confirmed',
    confirmedDelivered: false,
    retryAllowed: false,
  },
  FAILED: {
    severity: 'error',
    labelKey: 'delivery.state.FAILED',
    labelFallback: 'Failed',
    confirmedDelivered: false,
    retryAllowed: false,
  },
};

export function mailDeliveryPresentation(state: MailDeliveryState): MailDeliveryPresentation {
  return DELIVERY_PRESENTATIONS[state];
}

export function latestOutboundMessage(detail: MailThreadDetail) {
  return [...detail.messages]
    .reverse()
    .find((message) => message.direction === 'OUTBOUND' || message.direction === 'DRAFT');
}

export function mailAccountReadiness(account: MailAccount): MailSecondaryCapabilityState {
  return account.connectionState === 'ACTIVE' && account.synchronizationState === 'READY'
    ? 'AVAILABLE'
    : 'READ_ONLY';
}

export function mailThreadAccessibleName(thread: MailThread) {
  const sender = thread.participants[0]?.name ?? thread.accountName;
  const states = [
    thread.unread ? 'unread' : 'read',
    thread.attachments ? 'has attachment' : null,
    thread.assignedName ? `assigned to ${thread.assignedName}` : null,
  ].filter(Boolean);
  return `${sender}, ${thread.subject}, ${states.join(', ')}`;
}
