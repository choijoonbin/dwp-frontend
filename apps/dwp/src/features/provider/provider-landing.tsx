import { useQuery } from '@tanstack/react-query';
import { getProviderOperatorProfile } from '@dwp-frontend/shared-utils/api/provider-control-api';
import { Navigate } from 'react-router-dom';

import { ProviderAccessPending } from './provider-access-pending';
import { resolveProviderLandingPath } from './provider-navigation';
import { ProviderError, ProviderLoading } from './provider-ui';

export function ProviderLanding() {
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
    staleTime: 30_000,
  });

  if (operator.isLoading && !operator.data) return <ProviderLoading />;
  if (operator.isError && !operator.data) {
    return (
      <ProviderError
        error={operator.error}
        onRetry={() => void operator.refetch()}
        retrying={operator.isFetching}
      />
    );
  }

  const destination = resolveProviderLandingPath(operator.data?.permissions ?? []);
  return destination ? <Navigate to={destination} replace /> : <ProviderAccessPending />;
}
