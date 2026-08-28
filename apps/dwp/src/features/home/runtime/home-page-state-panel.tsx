import { useTranslation } from 'react-i18next';
import { ErrorState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';

import { HomeLoadingSkeleton } from '../../../components/home-loading-skeleton';

import type { HomePageGateState } from './home-page-runtime-state';

type HomePageStatePanelProps = Readonly<{
  state: Exclude<HomePageGateState, Readonly<{ kind: 'ready' }>>;
  retrying?: boolean;
  onRetry: () => void;
}>;

export function HomePageStatePanel({ state, retrying = false, onRetry }: HomePageStatePanelProps) {
  const { t } = useTranslation(['home', 'common']);

  if (state.kind === 'loading') {
    return (
      <Box
        data-testid="home-experience-bootstrap"
        data-home-bootstrap-state={state.source}
        aria-busy="true"
        aria-label={t('page.loadingHome')}
        aria-live="polite"
        role="status"
      >
        <HomeLoadingSkeleton />
      </Box>
    );
  }

  return (
    <Box data-testid="home-experience-error" data-home-error-source={state.source}>
      <ErrorState
        title={t('error.loadFailed', { ns: 'common' })}
        description={t('error.unexpected', { ns: 'common' })}
        retryLabel={t('actions.retry', { ns: 'common' })}
        onRetry={onRetry}
        retrying={retrying}
        size="page"
      />
    </Box>
  );
}
