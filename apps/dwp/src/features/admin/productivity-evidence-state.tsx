import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import { ActionButton } from '@dwp-frontend/design-system';

export function ProductivityEvidenceState({
  scope,
  pending,
  error,
  hasMore,
  limit,
  onRetry,
}: {
  scope: 'consent' | 'runs';
  pending: boolean;
  error: boolean;
  hasMore: boolean;
  limit?: number;
  onRetry: () => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <Stack gap={1.5}>
      {pending && <Alert severity="info">{t(`productivity.${scope}.loading`)}</Alert>}
      {error && (
        <Alert
          severity="error"
          action={<ActionButton onClick={onRetry}>{t(`productivity.${scope}.retry`)}</ActionButton>}
        >
          {t(`productivity.${scope}.loadError`)}
        </Alert>
      )}
      {hasMore && (
        <Alert severity="warning">
          {t(`productivity.${scope}.partial`, { limit: limit ?? 0 })}
        </Alert>
      )}
    </Stack>
  );
}
