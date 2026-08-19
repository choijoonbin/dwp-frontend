import { useTranslation } from 'react-i18next';
import { ActionButton, ConfirmDialog, ContentDialog, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import type { MessagingMessage } from '@dwp-frontend/shared-utils';

export function MessagingMessageDialogs({
  editingMessage,
  deletingMessage,
  editBody,
  editBusy,
  deleteBusy,
  onEditBodyChange,
  onCloseEdit,
  onSubmitEdit,
  onCloseDelete,
  onConfirmDelete,
}: {
  editingMessage: MessagingMessage | null;
  deletingMessage: MessagingMessage | null;
  editBody: string;
  editBusy: boolean;
  deleteBusy: boolean;
  onEditBodyChange: (body: string) => void;
  onCloseEdit: () => void;
  onSubmitEdit: () => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const { t } = useTranslation('messaging');

  return (
    <>
      <ContentDialog
        open={Boolean(editingMessage)}
        title={t('message.editTitle')}
        description={t('message.editDescription')}
        closeLabel={t('actions.close')}
        onClose={onCloseEdit}
        busy={editBusy}
        maxWidth="sm"
      >
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitEdit();
          }}
        >
          <FormField
            autoFocus
            fullWidth
            multiline
            minRows={4}
            maxRows={12}
            label={t('message.editLabel')}
            value={editBody}
            disabled={editBusy}
            inputProps={{ maxLength: 20_000 }}
            onChange={(event) => onEditBodyChange(event.target.value)}
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2.5 }}>
            <ActionButton intent="quiet" disabled={editBusy} onClick={onCloseEdit}>
              {t('actions.cancel')}
            </ActionButton>
            <ActionButton
              type="submit"
              intent="primary"
              loading={editBusy}
              loadingLabel={t('message.editSaving')}
              disabled={!editBody.trim()}
            >
              {t('message.editSave')}
            </ActionButton>
          </Stack>
        </Box>
      </ContentDialog>

      <ConfirmDialog
        open={Boolean(deletingMessage)}
        title={t('message.deleteTitle')}
        description={t('message.deleteDescription')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('message.deleteConfirm')}
        confirmingLabel={t('message.deleteDeleting')}
        busy={deleteBusy}
        intent="danger"
        onClose={onCloseDelete}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
