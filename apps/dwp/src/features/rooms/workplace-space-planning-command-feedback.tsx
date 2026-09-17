import { BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';

import type { WorkplacePlanningCommandResult } from '@dwp-frontend/shared-utils/api/workplace-planning-contract';

type WorkplaceSpacePlanningCommandFeedbackProps = Readonly<{
  error: Error | null;
  receipt: WorkplacePlanningCommandResult['receipt'] | null;
  recovering: boolean;
  pending: boolean;
  recoveryChecked: boolean;
  onRecover: () => void;
  onReplay: () => void;
}>;

export function WorkplaceSpacePlanningCommandFeedback({
  error,
  receipt,
  recovering,
  pending,
  recoveryChecked,
  onRecover,
  onReplay,
}: WorkplaceSpacePlanningCommandFeedbackProps) {
  const { t } = useTranslation('rooms');
  const conflict = error instanceof HttpError && error.status === 409;
  const denied = error instanceof HttpError && error.status === 403;
  const published = receipt?.state === 'SUCCEEDED' && receipt.outboxState === 'PUBLISHED';

  return (
    <>
      {error ? (
        <InlineFeedback severity={conflict ? 'warning' : 'error'}>
          {t(
            conflict
              ? 'workplace.spacePlanning.states.conflict'
              : denied
                ? 'workplace.spacePlanning.states.commandDenied'
                : 'workplace.spacePlanning.states.commandError'
          )}
        </InlineFeedback>
      ) : null}
      {receipt ? (
        <div data-testid="space-planning-command-receipt">
          <InlineFeedback
            severity={
              published
                ? 'success'
                : receipt.state === 'FAILED' || receipt.outboxState === 'FAILED'
                  ? 'error'
                  : 'warning'
            }
            icon={<BarChart3 size={17} />}
            action={
              receipt.state === 'RESULT_UNKNOWN' ? (
                <ActionButton
                  intent="quiet"
                  size="small"
                  disabled={recovering || pending}
                  onClick={recoveryChecked ? onReplay : onRecover}
                >
                  {t(
                    recoveryChecked
                      ? 'workplace.spacePlanning.retry'
                      : 'workplace.spacePlanning.actions.requery'
                  )}
                </ActionButton>
              ) : undefined
            }
          >
            {t(`workplace.spacePlanning.receipts.${receipt.state}`, {
              command: receipt.commandType,
            })}{' '}
            · {receipt.state} · {receipt.outboxState}
          </InlineFeedback>
        </div>
      ) : null}
    </>
  );
}
