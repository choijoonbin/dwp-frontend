import Box from '@mui/material/Box';

import { NotificationAttentionGovernanceRuntime } from './notification-attention-governance-runtime';
import { NotificationPolicyStudio } from './notification-policy-studio';
import { NotificationAdminSurface } from './notification-product-pages';

export default function NotificationAdminPoliciesRoute() {
  return (
    <NotificationAdminSurface view="policies">
      <Box sx={{ display: 'grid', gap: 3, minWidth: 0 }}>
        <NotificationPolicyStudio />
        <NotificationAttentionGovernanceRuntime />
      </Box>
    </NotificationAdminSurface>
  );
}
