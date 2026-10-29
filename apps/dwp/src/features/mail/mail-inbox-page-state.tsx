import { useTranslation } from 'react-i18next';
import { Command, ListChecks, MailPlus } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  GuidedEmptyState,
  InlineFeedback,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';

import { MailPageHeading } from './mail-components';

export type MailInboxAccountGateState = 'loading' | 'error' | 'empty';

export function MailInboxAccountGate({
  state,
  retrying,
  onRetry,
  onConnect,
}: {
  state: MailInboxAccountGateState;
  retrying: boolean;
  onRetry: () => void;
  onConnect: () => void;
}) {
  const { t } = useTranslation('mail');
  return (
    <PageCanvas topInset="compact">
      {state === 'loading' ? (
        <LoadingState label={t('common:labels.loading')} size="page" />
      ) : state === 'error' ? (
        <ErrorState
          title={t('mailbox.loadError')}
          titleComponent="h1"
          retryLabel={t('actions.retry')}
          onRetry={onRetry}
          retrying={retrying}
          size="page"
        />
      ) : (
        <GuidedEmptyState
          kind="first-use"
          title={t('home.journey.noAccountTitle')}
          description={t('home.journey.noAccountDescription')}
          titleComponent="h1"
          actionLabel={t('home.journey.health.NO_ACCOUNT.action')}
          onAction={onConnect}
          size="page"
        />
      )}
    </PageCanvas>
  );
}

export function MailInboxHeading({
  mailboxCopyKey,
  title,
  canCreate,
  canUpdate,
  hasItems,
  bulkMode,
  onOpenCommand,
  onEnterBulkMode,
  onExitBulkMode,
  onCompose,
}: {
  mailboxCopyKey: string;
  title?: string;
  canCreate: boolean;
  canUpdate: boolean;
  hasItems: boolean;
  bulkMode: boolean;
  onOpenCommand: () => void;
  onEnterBulkMode: () => void;
  onExitBulkMode: () => void;
  onCompose: () => void;
}) {
  const { t } = useTranslation('mail');
  return (
    <>
      <MailPageHeading
        eyebrow={t(`mailbox.${mailboxCopyKey}.eyebrow`)}
        title={title ?? t(`mailbox.${mailboxCopyKey}.title`)}
        description={t(`mailbox.${mailboxCopyKey}.description`)}
        actions={
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <ActionIconButton label={t('command.open')} onClick={onOpenCommand}>
              <Command size={18} />
            </ActionIconButton>
            {canUpdate && hasItems ? (
              <ActionButton
                intent="secondary"
                startIcon={<ListChecks size={17} />}
                aria-pressed={bulkMode}
                onClick={bulkMode ? onExitBulkMode : onEnterBulkMode}
              >
                {bulkMode ? t('mailbox.bulk.done') : t('mailbox.bulk.select')}
              </ActionButton>
            ) : null}
            <ActionButton
              intent="primary"
              startIcon={<MailPlus size={17} />}
              disabled={!canCreate}
              onClick={onCompose}
            >
              {t('actions.compose')}
            </ActionButton>
          </Stack>
        }
      />
      {!canCreate && !canUpdate ? (
        <InlineFeedback severity="info" role="alert" sx={{ mt: 2 }}>
          {t('permissions.readOnly', {
            defaultValue:
              'You have read-only mail access. Draft and message update actions are unavailable.',
          })}
        </InlineFeedback>
      ) : null}
    </>
  );
}
