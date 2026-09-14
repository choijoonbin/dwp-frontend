import { useContext, useEffect } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

export function ApprovalAttachmentNavigationGuard({
  locked,
  ownerId,
}: {
  locked: boolean;
  ownerId?: string;
}) {
  const router = useContext(UNSAFE_DataRouterContext);
  useEffect(() => {
    if (!locked) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [locked]);
  return router ? <RoutedAttachmentGuard locked={locked} ownerId={ownerId} /> : null;
}

function RoutedAttachmentGuard({ locked, ownerId }: { locked: boolean; ownerId?: string }) {
  const { t } = useTranslation('approvals');
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const next = new URLSearchParams(nextLocation.search);
    const nextOwner = next.get('request') ?? next.get('draft');
    return (
      locked &&
      (currentLocation.pathname !== nextLocation.pathname ||
        Boolean(nextOwner && ownerId && nextOwner !== ownerId))
    );
  });
  return blocker.state === 'blocked' ? (
    <InlineFeedback
      severity="warning"
      action={
        <ActionButton type="button" intent="quiet" onClick={() => blocker.reset()}>
          {t('requests.attachments.close')}
        </ActionButton>
      }
    >
      {t('requests.attachments.navigationBlocked')}
    </InlineFeedback>
  ) : null;
}
