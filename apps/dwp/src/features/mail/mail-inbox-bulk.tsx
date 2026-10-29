import { useTranslation } from 'react-i18next';
import { Archive, CheckCheck, Star, X } from 'lucide-react';
import { applyMailLifecycle, applyMailThreadAction } from '@dwp-frontend/shared-utils';
import { ActionButton } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  MailBulkMutationIdentity,
  MailThread,
  MailThreadPage,
} from '@dwp-frontend/shared-utils';

export type MailQuickCommand = 'mark-read' | 'star' | 'archive';

export type MailBulkCommandPlan = Readonly<{
  command: MailQuickCommand;
  contextKey: string;
  bulkIntentId: string;
  items: readonly Readonly<{
    threadId: string;
    expectedVersion: number;
    identity: MailBulkMutationIdentity;
  }>[];
}>;

export type MailBulkCommandExecutionItem = Readonly<{
  thread: MailThread;
  expectedVersion: number;
  identity: MailBulkMutationIdentity;
}>;

export async function applyMailQuickCommand(
  command: MailQuickCommand,
  thread: MailThread,
  bulkIdentity?: MailBulkMutationIdentity,
  expectedVersion = thread.version
) {
  if (command === 'archive') {
    return {
      command,
      result: await applyMailLifecycle(
        thread.threadId,
        'ARCHIVE',
        expectedVersion,
        undefined,
        bulkIdentity
      ),
    } as const;
  }
  const action = command === 'star' ? 'STAR' : 'MARK_READ';
  return {
    command,
    result: await applyMailThreadAction(thread.threadId, action, expectedVersion, bulkIdentity),
  } as const;
}

export function createMailBulkCommandPlan(
  command: MailQuickCommand,
  contextKey: string,
  threads: readonly MailThread[],
  createId: () => string = () => globalThis.crypto.randomUUID()
): MailBulkCommandPlan {
  const bulkIntentId = createId();
  return {
    command,
    contextKey,
    bulkIntentId,
    items: threads.map((thread) => ({
      threadId: thread.threadId,
      expectedVersion: thread.version,
      identity: {
        bulkIntentId,
        itemIdempotencyKey: createId(),
      },
    })),
  };
}

/**
 * Reuses the original item keys for an exact retry. This covers an indeterminate network response:
 * the server may already have committed an item, so rotating its key would turn a safe replay into
 * a version conflict. Callers discard the plan when the user changes the selection or command.
 */
export function resolveMailBulkCommandPlan(
  current: MailBulkCommandPlan | null,
  command: MailQuickCommand,
  contextKey: string,
  threads: readonly MailThread[],
  createId: () => string = () => globalThis.crypto.randomUUID()
) {
  const reusable =
    current?.command === command &&
    current.contextKey === contextKey &&
    threads.every((thread) => current.items.some((item) => item.threadId === thread.threadId));
  const plan = reusable
    ? current
    : createMailBulkCommandPlan(command, contextKey, threads, createId);
  const plannedItems = new Map(plan.items.map((item) => [item.threadId, item]));
  return {
    plan,
    items: threads.map<MailBulkCommandExecutionItem>((thread) => {
      const planned = plannedItems.get(thread.threadId)!;
      return {
        thread,
        expectedVersion: planned.expectedVersion,
        identity: planned.identity,
      };
    }),
  };
}

export function summarizeMailBulkResults(
  threadIds: readonly string[],
  results: readonly PromiseSettledResult<unknown>[]
) {
  return threadIds.reduce(
    (summary, threadId, index) => {
      if (results[index]?.status === 'fulfilled') summary.succeededIds.push(threadId);
      else summary.failedIds.push(threadId);
      return summary;
    },
    { succeededIds: [] as string[], failedIds: [] as string[] }
  );
}

export function updateMailThreadPageAfterBulk(
  page: MailThreadPage | undefined,
  command: MailQuickCommand,
  succeededIds: readonly string[],
  updatedThreads: readonly MailThread[]
) {
  if (!page || !succeededIds.length) return page;
  const succeeded = new Set(succeededIds);
  if (command === 'archive') {
    const items = page.items.filter((thread) => !succeeded.has(thread.threadId));
    return { ...page, items, total: Math.max(0, page.total - (page.items.length - items.length)) };
  }
  const updates = new Map(updatedThreads.map((thread) => [thread.threadId, thread]));
  return {
    ...page,
    items: page.items.map((thread) => updates.get(thread.threadId) ?? thread),
  };
}

export function MailInboxBulkToolbar({
  selectedCount,
  totalCount,
  busy,
  onTogglePage,
  onCommand,
  onDone,
}: {
  selectedCount: number;
  totalCount: number;
  busy: boolean;
  onTogglePage: () => void;
  onCommand: (command: MailQuickCommand) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation('mail');
  return (
    <Stack
      data-testid="mail-inbox-bulk-toolbar"
      spacing={1}
      sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}
      aria-live="polite"
    >
      <Typography variant="caption" fontWeight="fontWeightBold">
        {t('mailbox.bulk.selected', { count: selectedCount })}
      </Typography>
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
        <ActionButton intent="quiet" size="small" disabled={busy} onClick={onTogglePage}>
          {selectedCount === totalCount ? t('mailbox.bulk.clear') : t('mailbox.bulk.selectPage')}
        </ActionButton>
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<CheckCheck size={15} />}
          loading={busy}
          disabled={!selectedCount}
          onClick={() => onCommand('mark-read')}
        >
          {t('thread.markRead')}
        </ActionButton>
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<Star size={15} />}
          disabled={!selectedCount || busy}
          onClick={() => onCommand('star')}
        >
          {t('thread.star')}
        </ActionButton>
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<Archive size={15} />}
          disabled={!selectedCount || busy}
          onClick={() => onCommand('archive')}
        >
          {t('thread.archive')}
        </ActionButton>
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<X size={15} />}
          disabled={busy}
          onClick={onDone}
        >
          {t('mailbox.bulk.done')}
        </ActionButton>
      </Stack>
    </Stack>
  );
}
