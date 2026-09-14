import { useTranslation } from 'react-i18next';
import { Clock3, Layers3, ShieldCheck, ShieldX, UserRoundCheck } from 'lucide-react';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import type { ReactNode } from 'react';
import type { ApprovalPolicy } from '@dwp-frontend/shared-utils';

export function ApprovalPolicySection({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box component="section" aria-label={title} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
        sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box minWidth={0}>
          <Box component="h2" sx={{ m: 0, typography: 'subtitle2' }}>
            {title}
          </Box>
          {meta ? (
            <Box sx={{ mt: 0.5, typography: 'caption', color: 'text.secondary' }}>{meta}</Box>
          ) : null}
        </Box>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

export function ApprovalPolicySummary({ policies }: { policies: readonly ApprovalPolicy[] }) {
  const { t } = useTranslation('approvals');
  const signals = [
    { key: 'totalPolicies', count: policies.length, icon: Layers3, color: 'primary.main' },
    {
      key: 'pendingReviews',
      count: policies.filter((policy) => policy.pendingReview).length,
      icon: UserRoundCheck,
      color: 'warning.main',
    },
    {
      key: 'blockingPolicies',
      count: policies.filter((policy) => policy.enforcementMode === 'BLOCK').length,
      icon: ShieldX,
      color: 'error.main',
    },
    {
      key: 'activePolicies',
      count: policies.filter((policy) => policy.lifecycleState === 'ACTIVE').length,
      icon: ShieldCheck,
      color: 'success.main',
    },
    {
      key: 'slaPolicies',
      count: policies.filter((policy) => policy.policyType === 'SLA').length,
      icon: Clock3,
      color: 'info.main',
    },
  ];
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', sm: 'repeat(5,minmax(0,1fr))' },
        gap: 1.5,
        py: 2,
      }}
    >
      {signals.map(({ key, count, icon: Icon, color }) => (
        <Box
          key={key}
          style={{ borderRadius: foundationTokens.radius.surface }}
          sx={{
            minWidth: 0,
            p: 1.5,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Stack
            component="dt"
            direction="row"
            justifyContent="space-between"
            alignItems="start"
            gap={1}
          >
            <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
              {t(`admin.studio.workspace.${key}`)}
            </Box>
            <Box sx={{ color, display: 'flex', flexShrink: 0 }}>
              <Icon size={18} aria-hidden="true" />
            </Box>
          </Stack>
          <Box component="dd" sx={{ m: 0, mt: 0.75, typography: 'h4' }}>
            {count}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
