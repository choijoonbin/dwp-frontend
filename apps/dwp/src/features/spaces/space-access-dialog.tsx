import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormDialog, FormField } from '@dwp-frontend/design-system';
import { requestSpaceAccess, useToast } from '@dwp-frontend/shared-utils';

import Stack from '@mui/material/Stack';

export function SpaceAccessDialog({
  open,
  spaceKey,
  onClose,
}: {
  open: boolean;
  spaceKey: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('spaces');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<'VIEWER' | 'CONTRIBUTOR'>('VIEWER');
  const [justification, setJustification] = useState('');
  useEffect(() => {
    if (!open) return;
    setRole('VIEWER');
    setJustification('');
  }, [open]);
  const mutation = useMutation({
    mutationFn: () => requestSpaceAccess(spaceKey, { requestedRole: role, justification }),
    onSuccess: async (request) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['spaces', 'detail', spaceKey] }),
        queryClient.invalidateQueries({ queryKey: ['spaces', 'access-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['spaces', 'directory'] }),
      ]);
      toast.success(t(request.status === 'APPROVED' ? 'access.joined' : 'access.requested'));
      onClose();
    },
    onError: () => toast.error(t('access.error')),
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
      submitDisabled={justification.trim().length < 10}
      maxWidth="sm"
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
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
