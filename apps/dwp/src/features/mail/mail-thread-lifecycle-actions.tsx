import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, FolderInput, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyMailLifecycle,
  getMailOrganization,
  previewMailLifecycle,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionIconButton, ConfirmDialog } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MailLifecycleUndo, type MailLifecycleUndoState } from './mail-lifecycle-undo';

import type { MailLifecycleAction, MailThread } from '@dwp-frontend/shared-utils';

type PendingLifecycle = {
  action: MailLifecycleAction;
  targetFolderId?: string;
  targetLabel: string;
};

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
  const [pending, setPending] = useState<PendingLifecycle | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewMailLifecycle>> | null>(
    null
  );
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
    }) =>
      applyMailLifecycle(
        thread.threadId,
        action,
        preview?.version ?? thread.version,
        targetFolderId
      ),
    onSuccess: async (result, variables) => {
      setAnchor(null);
      setPending(null);
      setPreview(null);
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
  const previewMutation = useMutation({
    mutationFn: (request: PendingLifecycle) =>
      previewMailLifecycle(thread.threadId, {
        action: request.action,
        targetFolderId: request.targetFolderId,
        version: thread.version,
      }),
    onSuccess: (result, request) => {
      setAnchor(null);
      if (!result.allowed) {
        setPending(null);
        setPreview(null);
        toast.error(t('lifecycle.previewBlocked'));
        return;
      }
      setPending(request);
      setPreview(result);
    },
    onError: () => {
      setAnchor(null);
      setPending(null);
      setPreview(null);
      toast.error(t('lifecycle.previewError'));
    },
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
            onClick={() =>
              previewMutation.mutate({
                action: 'MOVE',
                targetFolderId: folder.folderId,
                targetLabel: folder.displayName,
              })
            }
          >
            <ListItemIcon>
              <FolderInput size={16} />
            </ListItemIcon>
            {folder.displayName}
          </MenuItem>
        ))}
        {organization.isError && <MenuItem disabled>{t('lifecycle.foldersUnavailable')}</MenuItem>}
        {folders.length > 0 && <Divider />}
        <MenuItem
          onClick={() =>
            previewMutation.mutate({ action: 'SPAM', targetLabel: t('lifecycle.spam') })
          }
        >
          <ListItemIcon>
            <ShieldAlert size={16} />
          </ListItemIcon>
          {t('lifecycle.spam')}
        </MenuItem>
        <MenuItem
          onClick={() =>
            previewMutation.mutate({ action: 'TRASH', targetLabel: t('lifecycle.trash') })
          }
        >
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
      <ConfirmDialog
        open={Boolean(pending && preview)}
        title={t('lifecycle.previewTitle')}
        description={t('lifecycle.previewDescription', { target: pending?.targetLabel ?? '' })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('lifecycle.previewConfirm')}
        confirmingLabel={t('lifecycle.moving')}
        busy={mutation.isPending}
        details={
          preview ? (
            <Stack spacing={1}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('lifecycle.previewTarget')}
                </Typography>
                <Typography variant="body2" fontWeight={750}>
                  {preview.targetFolderName ?? pending?.targetLabel}
                </Typography>
              </Box>
              <Typography variant="body2">
                {t('lifecycle.previewAffected', { count: preview.affectedCount })}
              </Typography>
              {preview.blockers.length > 0 && (
                <Alert severity="warning">{preview.blockers.join(', ')}</Alert>
              )}
            </Stack>
          ) : null
        }
        onClose={() => {
          if (mutation.isPending) return;
          setPending(null);
          setPreview(null);
        }}
        onConfirm={() => {
          if (pending && preview?.allowed) mutation.mutate(pending);
        }}
      />
    </>
  );
}
