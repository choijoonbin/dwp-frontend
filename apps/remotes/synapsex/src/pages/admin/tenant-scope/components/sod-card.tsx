import type { UseMutationResult } from '@tanstack/react-query';

import { Label, Iconify } from '@dwp-frontend/design-system';
import { showToast, type TenantScopeSodRule } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';

const SEVERITY_OPTIONS: { value: 'INFO' | 'WARN' | 'BLOCK'; label: string }[] = [
  { value: 'INFO', label: 'Info' },
  { value: 'WARN', label: 'Warn' },
  { value: 'BLOCK', label: 'Block' },
];

type PatchSodRuleMutation = UseMutationResult<
  unknown,
  Error,
  {
    currentItems: { ruleKey: string; enabled: boolean; severity?: 'INFO' | 'WARN' | 'BLOCK' }[];
    enabled?: boolean;
    ruleKey: string;
    severity?: 'INFO' | 'WARN' | 'BLOCK';
  },
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
  const toCurrentItems = () =>
    items.map((i) => ({
      enabled: i.enabled,
      ruleKey: i.ruleKey,
      severity: i.severity ?? 'WARN',
    }));

  const handleToggle = async (ruleKey: string, enabled: boolean) => {
    patchMutation.mutate(
      {
        currentItems: toCurrentItems(),
        enabled,
        ruleKey,
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

  const handleSeverityChange = (ruleKey: string, severity: 'INFO' | 'WARN' | 'BLOCK') => {
    patchMutation.mutate(
      {
        currentItems: toCurrentItems(),
        ruleKey,
        severity,
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
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <InputLabel>Severity</InputLabel>
                    <Select
                      value={item.severity ?? 'WARN'}
                      label="Severity"
                      onChange={(e) =>
                        handleSeverityChange(item.ruleKey, e.target.value as 'INFO' | 'WARN' | 'BLOCK')
                      }
                      disabled={patchMutation.isPending || !item.enabled}
                    >
                      {SEVERITY_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
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
