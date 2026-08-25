import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';
import Snackbar from '@mui/material/Snackbar';

type RecommendationUndoSnackbarProps = {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onUndo: () => void;
};

export function RecommendationUndoSnackbar({
  open,
  busy,
  onClose,
  onUndo,
}: RecommendationUndoSnackbarProps) {
  const { t } = useTranslation('home');
  return (
    <Snackbar
      open={open}
      autoHideDuration={8000}
      message={t('page.recommendationHidden')}
      onClose={(_, reason) => {
        if (reason !== 'clickaway' && !busy) onClose();
      }}
      action={
        <ActionButton
          intent="quiet"
          size="small"
          onClick={onUndo}
          loading={busy}
          loadingLabel={t('page.undoRecommendation')}
          sx={{ color: 'inherit' }}
        >
          {t('page.undoRecommendation')}
        </ActionButton>
      }
    />
  );
}
