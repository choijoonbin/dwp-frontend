import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCheck, SearchCheck } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { getApprovalRequestDetail } from '@dwp-frontend/shared-utils';
import Stack from '@mui/material/Stack';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import { approvalInformationReceiptRouteInstalled } from './approval-request-information-receipt-authority';
import { useApprovalRequestInformationReceipt } from './use-approval-request-information-receipt';

import type { RequestActionCommand } from './approval-request-action-model';
import type { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

type Props = Readonly<{
  command: RequestActionCommand;
  requestScope: ReturnType<typeof useProductSurfaceRequestScope>;
  sourceIsCurrent: () => boolean;
  originalWire: (command: RequestActionCommand) => string | undefined;
  isOriginal: (command: RequestActionCommand) => boolean;
  onConfirmed: (command: RequestActionCommand) => void | Promise<void>;
}>;

export function ApprovalRequestInformationReceipt(props: Props) {
  return approvalInformationReceiptRouteInstalled(PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS) ? (
    <InstalledReceipt {...props} />
  ) : null;
}

function InstalledReceipt(props: Props) {
  const { t } = useTranslation('approvals');
  const cache = useQueryClient();
  const queryKey = [
    'approvals',
    ...props.requestScope.cacheKey,
    'information-receipt-owner',
    props.command.input.action.request.requestId,
  ];
  const owner = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      getApprovalRequestDetail(
        props.command.input.action.request.requestId,
        props.requestScope.contextScopeKey,
        signal
      ),
    enabled: props.requestScope.ready && props.isOriginal(props.command),
    meta: props.requestScope.queryMeta,
    retry: false,
    staleTime: 0,
    notifyOnChangeProps: 'all',
  });
  const live = useRef({ props, owner, queryKey });
  live.current = { props, owner, queryKey };
  const sourceIsCurrent = () => {
    const current = live.current;
    const state = cache.getQueryState(current.queryKey);
    return Boolean(
      current.props.requestScope.ready &&
      current.props.sourceIsCurrent() &&
      current.props.isOriginal(current.props.command) &&
      !current.owner.isError &&
      !current.owner.isFetching &&
      current.owner.data?.request.requestId ===
        current.props.command.input.action.request.requestId &&
      state?.status === 'success' &&
      state.fetchStatus === 'idle' &&
      state.data === current.owner.data
    );
  };
  const receipt = useApprovalRequestInformationReceipt({
    sourceIsCurrent,
    originalWire: props.originalWire,
    isOriginal: props.isOriginal,
  });
  return (
    <Stack gap={1}>
      {!receipt.available ? (
        <InlineFeedback severity="warning">
          {t('requests.amendment.receiptUnavailable')}
        </InlineFeedback>
      ) : receipt.receipt ? (
        <InlineFeedback
          severity="success"
          icon={<CheckCheck size={18} aria-hidden="true" />}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => {
                if (sourceIsCurrent() && receipt.isCurrent()) void props.onConfirmed(props.command);
              }}
            >
              {t('actions.close')}
            </ActionButton>
          }
        >
          {t('requests.amendment.receiptCompleted')}
        </InlineFeedback>
      ) : (
        <ActionButton
          type="button"
          intent="secondary"
          size="small"
          loading={receipt.pending}
          disabled={!receipt.available || receipt.pending}
          startIcon={<SearchCheck size={16} aria-hidden="true" />}
          onClick={() => void receipt.read(props.command)}
        >
          {t('requests.amendment.receiptLookup')}
        </ActionButton>
      )}
      {receipt.error && (
        <InlineFeedback severity="error">{t('requests.amendment.receiptReadError')}</InlineFeedback>
      )}
    </Stack>
  );
}
