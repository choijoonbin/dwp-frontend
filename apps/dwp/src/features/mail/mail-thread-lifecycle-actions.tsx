import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, FolderInput, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyMailLifecycle, getMailOrganization, useToast } from '@dwp-frontend/shared-utils';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import { MailLifecycleUndo, type MailLifecycleUndoState } from './mail-lifecycle-undo';

import type { MailLifecycleAction, MailThread } from '@dwp-frontend/shared-utils';

export function MailThreadLifecycleActions({
  thread,
  onUpdated,
  onDeleted,
}: {
  thread: MailThread;
  onUpdated: (thread: MailThread) => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation('mail');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [undoState, setUndoState] = useState<MailLifecycleUndoState | null>(null);
  const organization = useQuery({
    queryKey: ['mail', 'organization'],
    queryFn: getMailOrganization,
    staleTime: 30_000,
    retry: 1,
  });
  const mutation = useMutation({
    mutationFn: ({
      action,
      targetFolderId,
    }: {
      action: MailLifecycleAction;
      targetFolderId?: string;
    }) => applyMailLifecycle(thread.threadId, action, thread.version, targetFolderId),
    onSuccess: async (result, variables) => {
      setAnchor(null);
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      if (result.deleted) {
        onDeleted();
      } else if (result.thread) {
        onUpdated(result.thread);
      }
      if (
        result.thread &&
        (variables.action === 'ARCHIVE' ||
          variables.action === 'SPAM' ||
          variables.action === 'TRASH')
      ) {
        setUndoState({ action: variables.action, thread: result.thread });
      } else {
        toast.success(t(`lifecycle.success.${variables.action}`));
      }
    },
    onError: () => toast.error(t('lifecycle.error')),
  });
  const folders =
    organization.data?.folders.filter(
      (item) =>
        item.accountId === thread.accountId &&
        ['INBOX', 'ARCHIVE', 'CUSTOM'].includes(item.folderType)
    ) ?? [];
  const restorable = ['ARCHIVE', 'SPAM', 'TRASH'].includes(thread.folderType);
  const inTrash = thread.folderType === 'TRASH';

  return (
    <>
      {restorable ? (
        <ActionIconButton
          label={t('lifecycle.restore')}
          loading={mutation.isPending}
          onClick={() => mutation.mutate({ action: 'RESTORE' })}
        >
          <RotateCcw size={18} />
        </ActionIconButton>
      ) : (
        <ActionIconButton
          label={t('thread.archive')}
          loading={mutation.isPending}
          onClick={() => mutation.mutate({ action: 'ARCHIVE' })}
        >
          <Archive size={18} />
        </ActionIconButton>
      )}
      {!inTrash && (
        <ActionIconButton
          label={t('lifecycle.move')}
          size="small"
          disabled={mutation.isPending}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <FolderInput size={17} />
        </ActionIconButton>
      )}
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {folders.map((folder) => (
          <MenuItem
            key={folder.folderId}
            onClick={() => mutation.mutate({ action: 'MOVE', targetFolderId: folder.folderId })}
          >
            <ListItemIcon>
              <FolderInput size={16} />
            </ListItemIcon>
            {folder.displayName}
          </MenuItem>
        ))}
        {folders.length > 0 && <Divider />}
        <MenuItem onClick={() => mutation.mutate({ action: 'SPAM' })}>
          <ListItemIcon>
            <ShieldAlert size={16} />
          </ListItemIcon>
          {t('lifecycle.spam')}
        </MenuItem>
        <MenuItem onClick={() => mutation.mutate({ action: 'TRASH' })}>
          <ListItemIcon>
            <Trash2 size={16} />
          </ListItemIcon>
          {t('lifecycle.trash')}
        </MenuItem>
      </Menu>
      {inTrash && (
        <ActionIconButton label={t('lifecycle.deleteUnavailable')} intent="danger" disabled>
          <Trash2 size={18} />
        </ActionIconButton>
      )}
      <MailLifecycleUndo
        state={undoState}
        onClose={() => setUndoState(null)}
        onRestored={onUpdated}
      />
    </>
  );
}
