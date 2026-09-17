import type { MessagingPerson } from '@dwp-frontend/shared-utils/api/messaging-api';
import type {
  NotificationEffectiveSettings,
  NotificationInboxPage,
} from '@dwp-frontend/shared-utils/api/notification-api';
import type {
  NotificationAttentionContextOption,
  NotificationAttentionEffect,
  NotificationAttentionScopeKind,
} from '@dwp-frontend/shared-utils/api/notification-attention-api';

export type NotificationAttentionScopeChoice = {
  kind: NotificationAttentionScopeKind;
  key: string;
  label: string;
  detail?: string;
};

export type NotificationAttentionDiscoveryState = 'IDLE' | 'LOADING' | 'READY' | 'ERROR';

export type NotificationAttentionScopeCatalog = Partial<
  Record<NotificationAttentionScopeKind, readonly NotificationAttentionScopeChoice[]>
>;

const OPAQUE_SCOPE_KEY = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,299}$/u;
const APP_TYPE_SCOPE_KEY = /^[a-z0-9][a-z0-9-]{0,63}:[A-Z0-9][A-Z0-9._-]{0,159}$/u;
const TOPIC_SCOPE_KEY = /^[a-z0-9][a-z0-9._-]{0,159}$/u;

export function attentionScopeKeyIsCanonical(
  kind: NotificationAttentionScopeKind,
  key: string
): boolean {
  if (key !== key.trim()) return false;
  if (kind === 'APP_TYPE') return APP_TYPE_SCOPE_KEY.test(key);
  if (kind === 'TOPIC_TOKEN') return TOPIC_SCOPE_KEY.test(key);
  return OPAQUE_SCOPE_KEY.test(key);
}

export function preferredAttentionEffect(
  kind: NotificationAttentionScopeKind
): NotificationAttentionEffect {
  if (kind === 'ACTOR') return 'PRIORITIZE';
  if (kind === 'APP_TYPE') return 'MUTE';
  return 'FOLLOW';
}

export function appTypeScopeChoices(
  settings?: NotificationEffectiveSettings
): NotificationAttentionScopeChoice[] {
  if (!settings) return [];
  return settings.apps
    .flatMap((app) =>
      app.types.map((type) => ({
        kind: 'APP_TYPE' as const,
        key: `${app.appKey}:${type.typeKey}`,
        label: `${app.appName} / ${type.typeName}`,
        detail: type.description?.trim() || type.typeKey,
      }))
    )
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function recentThreadScopeChoices(
  inbox?: NotificationInboxPage
): NotificationAttentionScopeChoice[] {
  const choices = new Map<string, NotificationAttentionScopeChoice>();
  for (const item of inbox?.items ?? []) {
    const key = item.threadKey?.trim();
    if (!key || choices.has(key)) continue;
    choices.set(key, {
      kind: 'THREAD',
      key,
      label: item.title,
      detail: item.source.appName,
    });
  }
  return [...choices.values()];
}

export function actorScopeChoices(
  people?: readonly MessagingPerson[]
): NotificationAttentionScopeChoice[] {
  return (people ?? [])
    .map((person) => ({
      kind: 'ACTOR' as const,
      key: `user:${person.userId}`,
      label: person.displayName,
      detail: [person.jobTitle, person.organizationName, person.emailAddress]
        .filter(Boolean)
        .join(' · '),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function recentContextScopeChoices(
  contexts?: readonly NotificationAttentionContextOption[]
): NotificationAttentionScopeChoice[] {
  const choices = new Map<string, NotificationAttentionScopeChoice>();
  for (const context of contexts ?? []) {
    if (!attentionScopeKeyIsCanonical(context.scopeKind, context.scopeKey)) continue;
    const identity = `${context.scopeKind}\u0000${context.scopeKey}`;
    if (choices.has(identity)) continue;
    const label = context.displayLabel.trim() || context.scopeKey;
    choices.set(identity, {
      kind: context.scopeKind,
      key: context.scopeKey,
      label,
      detail:
        label === context.scopeKey
          ? context.contextKind
          : `${context.contextKind} · ${context.scopeKey}`,
    });
  }
  return [...choices.values()];
}

export function attentionScheduleIsValid(
  startsAt?: string | null,
  expiresAt?: string | null
): boolean {
  const start = startsAt ? Date.parse(startsAt) : null;
  const end = expiresAt ? Date.parse(expiresAt) : null;
  if ((start !== null && !Number.isFinite(start)) || (end !== null && !Number.isFinite(end))) {
    return false;
  }
  return start === null || end === null || end > start;
}
