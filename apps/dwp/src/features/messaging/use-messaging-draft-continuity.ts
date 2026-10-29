import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteMessagingDraft,
  getMessagingDraft,
  saveMessagingDraft,
} from '@dwp-frontend/shared-utils';

import { messagingMentionUserIds, type MessagingMentionDraft } from './messaging-composer-model';

import type { MutableRefObject } from 'react';
import type { MessagingDraft, MessagingMember } from '@dwp-frontend/shared-utils';

export type MessagingDraftPersistenceState =
  'IDLE' | 'LOADING' | 'SAVING' | 'SAVED' | 'ERROR' | 'CONFLICT';

type Input = {
  conversationId: string | null;
  threadRootMessageId?: string | null;
  enabled: boolean;
  value: string;
  mentions: MessagingMentionDraft[];
  valueRef: MutableRefObject<string>;
  mentionsRef: MutableRefObject<MessagingMentionDraft[]>;
  members: MessagingMember[];
  membersReady: boolean;
  setValue: (value: string) => void;
  setMentions: (mentions: MessagingMentionDraft[]) => void;
};

function fingerprint(body: string, mentionedPersonPublicIds: string[]) {
  return JSON.stringify([
    body,
    [...mentionedPersonPublicIds].sort((left, right) => left.localeCompare(right)),
  ]);
}

export function messagingMentionPersonPublicIds(
  mentions: MessagingMentionDraft[],
  members: MessagingMember[]
): string[] | null {
  const publicIdByUserId = new Map(
    members.flatMap((member) =>
      member.personPublicId ? [[member.userId, member.personPublicId] as const] : []
    )
  );
  const publicIds = messagingMentionUserIds(mentions).map((userId) => publicIdByUserId.get(userId));
  if (publicIds.some((publicId) => !publicId)) return null;
  return [...new Set(publicIds as string[])].sort((left, right) => left.localeCompare(right));
}

export function restoreMessagingMentionDrafts(
  body: string,
  mentionedPersonPublicIds: string[],
  members: MessagingMember[]
): MessagingMentionDraft[] {
  const membersByPublicId = new Map(
    members.flatMap((member) =>
      member.personPublicId ? [[member.personPublicId, member] as const] : []
    )
  );
  const uniqueIds = [...new Set(mentionedPersonPublicIds)].flatMap((personPublicId) => {
    const member = membersByPublicId.get(personPublicId);
    return member ? [member.userId] : [];
  });
  const massToken = body.includes('@모두')
    ? '@모두'
    : body.toLocaleLowerCase().includes('@everyone')
      ? '@everyone'
      : body.toLocaleLowerCase().includes('@all')
        ? '@all'
        : null;
  if (massToken && uniqueIds.length > 0) return [{ token: massToken, userIds: uniqueIds }];
  return uniqueIds.flatMap((userId) => {
    const member = members.find((candidate) => candidate.userId === userId);
    if (!member) return [];
    const token = `@${member.displayName}`;
    return body.includes(token) ? [{ token, userIds: [userId] }] : [];
  });
}

export function useMessagingDraftContinuity(input: Input) {
  const { members, membersReady, setMentions, setValue, valueRef } = input;
  const [state, setState] = useState<MessagingDraftPersistenceState>('IDLE');
  const [loadRevision, setLoadRevision] = useState(0);
  const [retryRevision, setRetryRevision] = useState(0);
  const versionRef = useRef(0);
  const loadedScopeRef = useRef<string | null>(null);
  const syncedFingerprintRef = useRef(fingerprint('', []));
  const failedFingerprintRef = useRef<string | null>(null);
  const pendingMentionRestoreRef = useRef<{
    scopeKey: string;
    body: string;
    mentionedPersonPublicIds: string[];
  } | null>(null);
  const conflictRef = useRef<MessagingDraft | null>(null);
  const scopeKey =
    input.enabled && input.conversationId
      ? `${input.conversationId}:${input.threadRootMessageId ?? 'root'}`
      : null;

  useEffect(() => {
    if (!scopeKey || !input.conversationId) {
      loadedScopeRef.current = null;
      versionRef.current = 0;
      syncedFingerprintRef.current = fingerprint('', []);
      pendingMentionRestoreRef.current = null;
      conflictRef.current = null;
      setState('IDLE');
      return;
    }
    const controller = new AbortController();
    const conversationId = input.conversationId;
    const threadRootMessageId = input.threadRootMessageId;
    loadedScopeRef.current = null;
    versionRef.current = 0;
    failedFingerprintRef.current = null;
    conflictRef.current = null;
    setState('LOADING');
    void getMessagingDraft({ conversationId, threadRootMessageId, signal: controller.signal })
      .then((draft) => {
        if (controller.signal.aborted) return;
        versionRef.current = draft.version;
        syncedFingerprintRef.current = fingerprint(draft.body, draft.mentionedPersonPublicIds);
        loadedScopeRef.current = scopeKey;
        if (!input.valueRef.current.trim() && input.mentionsRef.current.length === 0) {
          input.setValue(draft.body);
          if (draft.mentionedPersonPublicIds.length > 0 && !input.membersReady) {
            pendingMentionRestoreRef.current = {
              scopeKey,
              body: draft.body,
              mentionedPersonPublicIds: draft.mentionedPersonPublicIds,
            };
          } else {
            input.setMentions(
              restoreMessagingMentionDrafts(
                draft.body,
                draft.mentionedPersonPublicIds,
                input.members
              )
            );
          }
        }
        setState('SAVED');
        setLoadRevision((current) => current + 1);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        loadedScopeRef.current = scopeKey;
        setState('ERROR');
      });
    return () => controller.abort();
    // Setter and ref identities are stable. Member changes should not restart a network load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.conversationId, input.threadRootMessageId, input.enabled, scopeKey]);

  useEffect(() => {
    const pending = pendingMentionRestoreRef.current;
    if (!pending || pending.scopeKey !== scopeKey || !membersReady) return;
    pendingMentionRestoreRef.current = null;
    if (valueRef.current !== pending.body) return;
    setMentions(
      restoreMessagingMentionDrafts(pending.body, pending.mentionedPersonPublicIds, members)
    );
  }, [members, membersReady, setMentions, valueRef, scopeKey]);

  useEffect(() => {
    if (!scopeKey || !input.conversationId || loadedScopeRef.current !== scopeKey) return;
    if (pendingMentionRestoreRef.current?.scopeKey === scopeKey) return;
    if (input.mentions.length > 0 && !membersReady) return;
    const mentionedPersonPublicIds = messagingMentionPersonPublicIds(input.mentions, members);
    if (mentionedPersonPublicIds === null) {
      setState('ERROR');
      return;
    }
    const nextFingerprint = fingerprint(input.value, mentionedPersonPublicIds);
    if (
      nextFingerprint === syncedFingerprintRef.current ||
      nextFingerprint === failedFingerprintRef.current
    ) {
      return;
    }
    const conversationId = input.conversationId;
    const threadRootMessageId = input.threadRootMessageId;
    const timeout = window.setTimeout(() => {
      setState('SAVING');
      const operation =
        !input.value.trim() && mentionedPersonPublicIds.length === 0
          ? versionRef.current === 0
            ? Promise.resolve(null)
            : deleteMessagingDraft({
                conversationId,
                threadRootMessageId,
                version: versionRef.current,
              }).then(() => null)
          : saveMessagingDraft({
              conversationId,
              threadRootMessageId,
              body: input.value,
              mentionedPersonPublicIds,
              expectedVersion: versionRef.current,
            });
      void operation
        .then((saved) => {
          if (loadedScopeRef.current !== scopeKey) return;
          versionRef.current = saved?.version ?? 0;
          syncedFingerprintRef.current = nextFingerprint;
          failedFingerprintRef.current = null;
          setState('SAVED');
        })
        .catch((error: unknown) => {
          if (loadedScopeRef.current !== scopeKey) return;
          failedFingerprintRef.current = nextFingerprint;
          const status =
            typeof error === 'object' && error !== null && 'status' in error
              ? Number((error as { status?: unknown }).status)
              : 0;
          if (status === 409) {
            void getMessagingDraft({ conversationId, threadRootMessageId })
              .then((remote) => {
                if (loadedScopeRef.current !== scopeKey) return;
                versionRef.current = remote.version;
                conflictRef.current = remote;
                setState('CONFLICT');
              })
              .catch(() => {
                if (loadedScopeRef.current === scopeKey) setState('ERROR');
              });
          } else {
            setState('ERROR');
            window.setTimeout(() => {
              if (
                loadedScopeRef.current === scopeKey &&
                failedFingerprintRef.current === nextFingerprint
              ) {
                failedFingerprintRef.current = null;
                setRetryRevision((current) => current + 1);
              }
            }, 5_000);
          }
        });
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [
    input.conversationId,
    input.enabled,
    input.mentions,
    input.threadRootMessageId,
    input.value,
    loadRevision,
    members,
    membersReady,
    retryRevision,
    scopeKey,
  ]);

  const resolveConflict = useCallback(
    (choice: 'SERVER' | 'LOCAL') => {
      const remote = conflictRef.current;
      if (!remote || !scopeKey || loadedScopeRef.current !== scopeKey) return;
      conflictRef.current = null;
      failedFingerprintRef.current = null;
      if (choice === 'SERVER') {
        syncedFingerprintRef.current = fingerprint(remote.body, remote.mentionedPersonPublicIds);
        setValue(remote.body);
        setMentions(
          restoreMessagingMentionDrafts(remote.body, remote.mentionedPersonPublicIds, members)
        );
        setState('SAVED');
        return;
      }
      setState('SAVING');
      setRetryRevision((current) => current + 1);
    },
    [members, setMentions, setValue, scopeKey]
  );

  return { state, resolveConflict };
}
