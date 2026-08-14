import { useTranslation } from 'react-i18next';
import { ErrorState, LoadingState } from '@dwp-frontend/design-system';

export function ManagementPanelLoading({ label }: { label: string }) {
  return <LoadingState label={label} size="page" />;
}

export function ManagementPanelError({ message }: { message: string }) {
  const { t } = useTranslation('common');
  return <ErrorState title={t('error.loadFailed')} description={message} size="standard" />;
}
