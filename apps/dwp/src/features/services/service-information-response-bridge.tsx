import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { getServiceMyRequest } from '@dwp-frontend/shared-utils/api/service-center-api';

import { useContextualProductActionMutation } from '../../components/use-contextual-product-action-mutation';
import {
  ServiceInformationResponse,
  type ServiceInformationResponseDraft,
} from './service-information-response';

import type { ServiceRequestDetail } from '@dwp-frontend/shared-utils/api/service-center-api';

export type ServiceInformationResponseBridgeProps = Readonly<{
  requestId: string;
  expectedVersion: number;
  expectedServiceKey: string;
  expectedDataClassification: string | null;
  appliedDraft?: ServiceInformationResponseDraft | null;
  onDraftApplied?: () => void;
  onBindingChange?: (binding: ServiceInformationResponseBinding | null) => void;
  onConfirmed: (receipt: ServiceRequestDetail) => void;
}>;

export type ServiceInformationResponseBinding = Readonly<{
  requestId: string;
  version: number;
  status: string;
}>;

function matchesSelectedService(
  detail: ServiceRequestDetail,
  expected: Pick<
    ServiceInformationResponseBridgeProps,
    'requestId' | 'expectedVersion' | 'expectedServiceKey' | 'expectedDataClassification'
  >
) {
  return (
    detail.request.requestId === expected.requestId &&
    detail.request.serviceKey === expected.expectedServiceKey &&
    detail.request.version >= expected.expectedVersion &&
    (expected.expectedDataClassification === null ||
      detail.dataClassification === expected.expectedDataClassification)
  );
}

/** Services-owned bridge for an inline response rendered from another product's composition root. */
export function ServiceInformationResponseBridge(props: ServiceInformationResponseBridgeProps) {
  const { t } = useTranslation('services');
  const { onBindingChange } = props;
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const action = useContextualProductActionMutation(
    'route.services.work.request-information-response.action',
    'services.request.respond',
    'SELF'
  );
  const owner = isAuthenticated && user ? `${user.tenantId}:${user.userId}` : '';
  const queryKey = [
    'services',
    'contextual-information-response',
    owner,
    action.accessMode,
    action.contextScopeKey ?? '',
    action.decisionRevision,
    props.requestId,
  ] as const;
  const detail = useQuery({
    queryKey,
    enabled: Boolean(owner && action.ready),
    queryFn: async ({ signal }) => {
      const current = await getServiceMyRequest(props.requestId, signal, action.contextScopeKey);
      if (!matchesSelectedService(current, props)) {
        throw new Error('Selected service request identity changed');
      }
      return current;
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnMount: 'always',
    meta: {
      accessSensitive: true,
      tenantId: String(user?.tenantId ?? ''),
      actorId: String(user?.userId ?? ''),
      accessMode: action.accessMode,
      productId: 'services',
      surfaceId: 'services.work',
      contextScopeKey: action.contextScopeKey ?? '',
      decisionRevision: action.decisionRevision,
    },
  });
  const bound = Boolean(
    detail.data && !detail.isFetching && !detail.isError && !detail.isRefetchError
  );
  useEffect(() => {
    onBindingChange?.(
      bound && detail.data
        ? {
            requestId: detail.data.request.requestId,
            version: detail.data.request.version,
            status: detail.data.request.status,
          }
        : null
    );
    return () => onBindingChange?.(null);
  }, [bound, detail.data, onBindingChange]);
  if (!detail.data && detail.isError)
    return (
      <InlineFeedback severity="warning">
        {t('informationResponse.refreshFailed')}
        <ActionButton
          intent="quiet"
          disabled={detail.isFetching}
          onClick={() => void detail.refetch()}
          sx={{ ml: 1 }}
        >
          {t('informationResponse.refresh')}
        </ActionButton>
      </InlineFeedback>
    );
  // Keep the form mounted while a conflict refresh is in flight. Unmounting here would discard
  // the local fields that the response flow explicitly promises to preserve across a 409.
  if (!detail.data) return null;
  return (
    <ServiceInformationResponse
      contextual
      detail={detail.data}
      appliedDraft={props.appliedDraft}
      onDraftApplied={props.onDraftApplied}
      onRefresh={() => void detail.refetch()}
      onConfirmed={(receipt) => {
        queryClient.setQueryData(queryKey, receipt);
        props.onConfirmed(receipt);
      }}
    />
  );
}
