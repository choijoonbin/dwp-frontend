import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormDialog, FormField } from '@dwp-frontend/design-system';
import { requestSpaceAccess, useToast } from '@dwp-frontend/shared-utils';

import Stack from '@mui/material/Stack';

import { spaceDetailQueryKeys } from './space-detail-query-keys';

import type { SpaceQueryIdentity } from './space-detail-query-keys';
import type { SpaceAccessRequest } from '@dwp-frontend/shared-utils';

export function SpaceAccessDialog({
  open,
  spaceKey,
  identity,
  canRequest,
  onClose,
}: {
  open: boolean;
  spaceKey: string;
  identity: SpaceQueryIdentity;
  canRequest: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('spaces');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<'VIEWER' | 'CONTRIBUTOR'>('VIEWER');
  const [justification, setJustification] = useState('');
  const submitting = useRef(false);
  useEffect(() => {
    if (!open) return;
    setRole('VIEWER');
    setJustification('');
  }, [open]);
  const mutation = useMutation({
    retry: false,
    mutationFn: () => {
      if (!canRequest) throw new Error('Space access eligibility is not confirmed.');
      return requestSpaceAccess(spaceKey, { requestedRole: role, justification });
    },
    onSuccess: async (request) => {
      if (request.status === 'PENDING') {
        queryClient.setQueryData<SpaceAccessRequest[]>(
          spaceDetailQueryKeys.pending(identity),
          (previous) => [
            ...(previous ?? []).filter((item) => item.accessRequestId !== request.accessRequestId),
            request,
          ]
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: spaceDetailQueryKeys.detail(spaceKey, identity),
        }),
        queryClient.invalidateQueries({ queryKey: spaceDetailQueryKeys.pending(identity) }),
        queryClient.invalidateQueries({ queryKey: ['spaces', 'directory'] }),
      ]);
      toast.success(t(request.status === 'APPROVED' ? 'access.joined' : 'access.requested'));
      onClose();
    },
    onError: async () => {
      // A failed response may still have committed a request. Recheck before allowing another POST.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: spaceDetailQueryKeys.detail(spaceKey, identity),
        }),
        queryClient.invalidateQueries({ queryKey: spaceDetailQueryKeys.pending(identity) }),
      ]);
      toast.error(t('access.error'));
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  return (
    <FormDialog
      open={open}
      title={t('access.title')}
      description={t('access.description')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.requestAccess')}
      submittingLabel={t('actions.requestAccess')}
      busy={mutation.isPending}
      submitDisabled={!canRequest || mutation.isSuccess || justification.trim().length < 10}
      maxWidth="sm"
      onClose={onClose}
      onSubmit={() => {
        if (canRequest && !submitting.current && !mutation.isPending && !mutation.isSuccess) {
          submitting.current = true;
          mutation.mutate();
        }
      }}
    >
      <Stack gap={2}>
        <FormField
          select
          SelectProps={{ native: true }}
          label={t('access.requestedRole')}
          value={role}
          onChange={(event) => setRole(event.target.value as typeof role)}
        >
          <option value="VIEWER">{t('role.VIEWER')}</option>
          <option value="CONTRIBUTOR">{t('role.CONTRIBUTOR')}</option>
        </FormField>
        <FormField
          autoFocus
          multiline
          minRows={4}
          label={t('access.justification')}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          supportingText={t('access.justificationHelp')}
          inputProps={{ maxLength: 2000 }}
        />
      </Stack>
    </FormDialog>
  );
}
