import type { UseMutationResult } from '@tanstack/react-query';

import { Label, Iconify } from '@dwp-frontend/design-system';
import { showToast, type TenantScopeSodRule } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

type PatchSodRuleMutation = UseMutationResult<
  unknown,
  Error,
  { ruleKey: string; enabled: boolean; currentItems: { ruleKey: string; enabled: boolean }[] },
  unknown
>;

type SodCardProps = {
  items: TenantScopeSodRule[];
  isLoading?: boolean;
  patchMutation: PatchSodRuleMutation;
  refetch: () => void;
  sodMode?: 'PLANNED' | 'BASELINE' | 'ENFORCED';
};

export const SodCard = ({ items, isLoading, patchMutation, refetch, sodMode }: SodCardProps) => {

  const handleToggle = async (ruleKey: string, enabled: boolean) => {
    patchMutation.mutate(
      {
        ruleKey,
        enabled,
        currentItems: items.map((i) => ({ ruleKey: i.ruleKey, enabled: i.enabled })),
      },
      {
        onSuccess: () => {
          showToast('Saved');
          refetch();
        },
        onError: (err: Error) => {
          showToast(err instanceof Error ? err.message : 'Failed to update', 'error');
        },
      }
    );
  };

  return (
    <Card variant="outlined">
      <CardHeader
        title={
          <Stack direction="row" alignItems="center" spacing={1}>
            <Iconify icon="solar:shield-check-bold-duotone" width={18} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Segregation of Duties
            </Typography>
          </Stack>
        }
        subheader="Prevent risky combinations for approvals and execution."
        action={
          sodMode && (
            <Label
              variant="soft"
              color={sodMode === 'ENFORCED' ? 'success' : sodMode === 'BASELINE' ? 'warning' : 'default'}
            >
              {sodMode}
            </Label>
          )
        }
        sx={{ pb: 2 }}
      />
      <CardContent>
        <Stack spacing={1.5}>
          {isLoading ? (
            <Typography variant="body2" color="text.secondary">
              Loading...
            </Typography>
          ) : items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No SoD rules configured.
            </Typography>
          ) : (
            items.map((item) => (
              <Box
                key={item.ruleKey}
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {item.description ?? item.ruleKey}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Switch
                    checked={item.enabled}
                    onChange={(_, checked) => handleToggle(item.ruleKey, checked)}
                    disabled={patchMutation.isPending}
                  />
                </Stack>
              </Box>
            ))
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
