import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { GroupRoleAssignment } from '@dwp-frontend/shared-utils';

export function RoleAssignmentRevokeDialog({
  assignment,
  roleName,
  busy,
  onClose,
  onConfirm,
}: {
  assignment: GroupRoleAssignment | null;
  roleName: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useTranslation('admin');
  return (
    <ConfirmDialog
      open={Boolean(assignment)}
      title={t('roleGovernance.revokeDialog.title')}
      description={t('roleGovernance.revokeDialog.description')}
      cancelLabel={t('common.actions.cancel')}
      confirmLabel={t('roleGovernance.revokeDialog.confirm')}
      confirmingLabel={t('roleGovernance.revokeDialog.confirming')}
      busy={busy}
      intent="danger"
      onClose={onClose}
      onConfirm={onConfirm}
      details={
        assignment ? (
          <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Stack gap={1}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('roleGovernance.columns.group')}
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {assignment.groupName}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('roleGovernance.columns.role')}
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {roleName}
                </Typography>
              </Box>
            </Stack>
          </Box>
        ) : null
      }
    />
  );
}
