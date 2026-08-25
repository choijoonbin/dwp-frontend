import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@dwp-frontend/design-system';

type HomeEditorGuardsProps = {
  discardOpen: boolean;
  navigationBlocked: boolean;
  onKeepDraft: () => void;
  onDiscardDraft: () => void;
  onStayOnHome: () => void;
  onLeaveHome: () => void;
};

export function HomeEditorGuards({
  discardOpen,
  navigationBlocked,
  onKeepDraft,
  onDiscardDraft,
  onStayOnHome,
  onLeaveHome,
}: HomeEditorGuardsProps) {
  const { t } = useTranslation('home');
  return (
    <>
      <ConfirmDialog
        open={discardOpen}
        title={t('flow.editor.unsavedTitle')}
        description={t('flow.editor.unsavedDescription')}
        cancelLabel={t('flow.editor.keepEditing')}
        confirmLabel={t('flow.editor.discardChanges')}
        intent="danger"
        onClose={onKeepDraft}
        onConfirm={onDiscardDraft}
      />
      <ConfirmDialog
        open={navigationBlocked}
        title={t('flow.editor.unsavedTitle')}
        description={t('flow.editor.navigationDescription')}
        cancelLabel={t('flow.editor.keepEditing')}
        confirmLabel={t('flow.editor.leaveHome')}
        intent="danger"
        onClose={onStayOnHome}
        onConfirm={onLeaveHome}
      />
    </>
  );
}
