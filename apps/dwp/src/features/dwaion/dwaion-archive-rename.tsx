import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { ErrorState, FormDialog, FormField } from '@dwp-frontend/design-system';
import {
  HttpError,
  renameDwaionConversation,
  useAuth,
  type DwaionConversationSummary,
} from '@dwp-frontend/shared-utils';
import { conversationCopy } from './dwaion-conversation-copy';
import { useDwaionGovernedMutation } from '../../components/use-dwaion-governed-mutation';

export function DwaionArchiveRename({
  target,
  onClose,
}: {
  target: DwaionConversationSummary;
  onClose: () => void;
}) {
  const { i18n } = useTranslation('work');
  const copy = conversationCopy(resolveSupportedLocale(i18n.resolvedLanguage, i18n.language));
  const { user } = useAuth();
  const identity = `${user?.identityPlane ?? ''}:${user?.tenantId ?? ''}:${user?.userId ?? ''}:${user?.personPublicId ?? ''}`;
  const titleInput = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    // The closing menu's focus restoration completes before this frame.
    const frame = requestAnimationFrame(() => titleInput.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(target.title);
  const runRenameMutation = useDwaionGovernedMutation(
    'route.dwaion.work.conversation-rename.action'
  );
  const normalized = title.trim();
  const valid = Array.from(normalized).length >= 1 && Array.from(normalized).length <= 160;
  const rename = useMutation({
    mutationFn: async () => {
      const result = await runRenameMutation((authority) =>
        renameDwaionConversation(target.conversationId, normalized, authority)
      );
      if (result.summary.conversationId !== target.conversationId)
        throw new HttpError(
          'Conversation rename response does not match the selected conversation.',
          502
        );
      return { result, identity };
    },
    onSuccess: ({ result, identity: owner }) => {
      if (!active.current || owner !== currentIdentity.current) return;
      queryClient.setQueryData<DwaionConversationSummary[]>(['dwaion', 'conversations'], (items) =>
        items?.map((item) =>
          item.conversationId === target.conversationId ? result.summary : item
        )
      );
      void queryClient.invalidateQueries({
        queryKey: ['dwaion', 'conversation', target.conversationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['dwaion', 'conversations'],
      });
      onClose();
    },
  });
  const status = rename.error instanceof HttpError ? rename.error.status : undefined;
  const denied = status === 403 || status === 404;
  return (
    <FormDialog
      open
      title={copy.renameTitle}
      cancelLabel={copy.cancel}
      submitLabel={copy.save}
      submittingLabel={copy.saving}
      busy={rename.isPending}
      submitDisabled={!valid || denied || normalized === target.title}
      onClose={onClose}
      onSubmit={() => rename.mutate()}
    >
      {rename.isError && (
        <ErrorState
          size="compact"
          title={
            status === 403
              ? copy.renameForbidden
              : status === 404
                ? copy.renameMissing
                : status === 409
                  ? copy.renameConflict
                  : copy.renameError
          }
        />
      )}
      {!denied && (
        <FormField
          autoFocus
          inputRef={titleInput}
          fullWidth
          label={copy.titleLabel}
          value={title}
          disabled={rename.isPending}
          onChange={(event) => {
            setTitle(event.target.value);
            if (rename.isError) rename.reset();
          }}
          errorMessage={!valid ? copy.titleLength : undefined}
          supportingText={copy.titleLength}
        />
      )}
    </FormDialog>
  );
}
