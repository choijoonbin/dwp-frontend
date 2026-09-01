import { useTranslation } from 'react-i18next';
import { FormDialog, FormField } from '@dwp-frontend/design-system';

type AppLaunchpadFolderNameDialogsProps = {
  createOpen: boolean;
  renameOpen: boolean;
  folderName: string;
  createReady: boolean;
  onFolderNameChange: (name: string) => void;
  onCloseCreate: () => void;
  onCreate: () => void;
  onCloseRename: () => void;
  onRename: () => void;
};

export function AppLaunchpadFolderNameDialogs({
  createOpen,
  renameOpen,
  folderName,
  createReady,
  onFolderNameChange,
  onCloseCreate,
  onCreate,
  onCloseRename,
  onRename,
}: AppLaunchpadFolderNameDialogsProps) {
  const { t } = useTranslation('home');

  return (
    <>
      <FormDialog
        open={createOpen}
        title={t('launchpad.folder.create')}
        cancelLabel={t('actions.cancel', { ns: 'common' })}
        submitLabel={t('actions.create', { ns: 'common' })}
        submitDisabled={!folderName.trim() || !createReady}
        onClose={onCloseCreate}
        onSubmit={onCreate}
        maxWidth="xs"
      >
        <FormField
          autoFocus
          label={t('launchpad.folder.name')}
          value={folderName}
          onChange={(event) => onFolderNameChange(event.target.value.slice(0, 42))}
          onFocus={(event) => event.currentTarget.select()}
          sx={{ mt: 1 }}
        />
      </FormDialog>

      <FormDialog
        open={renameOpen}
        title={t('launchpad.folder.rename')}
        cancelLabel={t('actions.cancel', { ns: 'common' })}
        submitLabel={t('actions.save', { ns: 'common' })}
        submitDisabled={!folderName.trim()}
        onClose={onCloseRename}
        onSubmit={onRename}
        maxWidth="xs"
      >
        <FormField
          autoFocus
          label={t('launchpad.folder.name')}
          value={folderName}
          onChange={(event) => onFolderNameChange(event.target.value.slice(0, 42))}
          sx={{ mt: 1 }}
        />
      </FormDialog>
    </>
  );
}
