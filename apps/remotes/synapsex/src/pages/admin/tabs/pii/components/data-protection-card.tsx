import { Link } from 'react-router-dom';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import { Label, Iconify } from '@dwp-frontend/design-system';
import {
  showToast,
  type DataProtectionDto,
  usePutDataProtectionMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';

import { SYNAPSE_ROUTES } from '../../../../../routes';

const RETENTION_OPTIONS = [
  { value: 1, label: '1y' },
  { value: 3, label: '3y' },
  { value: 5, label: '5y' },
  { value: 7, label: '7y' },
  { value: 10, label: '10y' },
];

const EXPORT_MODES = [
  { value: 'ZIP', label: 'ZIP' },
  { value: 'CSV', label: 'CSV' },
];

type DataProtectionCardProps = {
  profileId: string;
  data: DataProtectionDto;
  isLoading?: boolean;
  onSaved: () => void;
};

const DEBOUNCE_MS = 400;

export const DataProtectionCard = ({
  profileId,
  data,
  isLoading = false,
  onSaved,
}: DataProtectionCardProps) => {
  const { t } = useTranslation('common');
  const mutation = usePutDataProtectionMutation();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localData, setLocalData] = useState<DataProtectionDto>(data);

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  const handleChange = useCallback(
    (updates: Partial<DataProtectionDto>) => {
      setLocalData((prev) => ({ ...prev, ...updates }));

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        const payload: DataProtectionDto = { ...data, ...updates };
        mutation.mutate(
          { profileId, payload },
          {
            onSuccess: () => {
              showToast(t('toast.savedWithAudit'));
              onSaved();
            },
            onError: (err: Error) => {
              showToast(err instanceof Error ? err.message : t('toast.failedToSave'), 'error');
              setLocalData(data);
              onSaved();
            },
          }
        );
      }, DEBOUNCE_MS);
    },
    [data, mutation, onSaved, profileId, t]
  );

  const auditLink = `${SYNAPSE_ROUTES.AUDIT}?category=ADMIN&type=UPDATE&resourceType=DATA_PROTECTION`;

  return (
    <Card variant="outlined">
      <CardHeader
        title={
          <Stack direction="row" alignItems="center" spacing={1}>
            <Iconify icon="solar:key-bold-duotone" width={18} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Encryption & Retention
            </Typography>
          </Stack>
        }
        subheader="Enterprise-ready data lifecycle controls."
        action={
          <Button
            size="small"
            variant="text"
            component={Link}
            to={auditLink}
            endIcon={<Iconify icon="solar:document-text-bold" width={16} />}
          >
            View Audit
          </Button>
        }
        sx={{ pb: 2 }}
      />
      <CardContent>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          All changes are audited.
        </Typography>

        <Stack spacing={1.5}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              At-rest encryption
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {localData.kmsMode ?? data.kmsMode ?? localData.keyProvider ?? data.keyProvider ?? 'KMS-managed keys'}
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }}>
              {(localData.atRestEncryptionEnabled ?? data.atRestEncryptionEnabled) ? (
                <Label color="success" variant="soft">
                  Enabled
                </Label>
              ) : (
                <Label color="default" variant="soft">
                  Disabled
                </Label>
              )}
              <Switch
                checked={localData.atRestEncryptionEnabled ?? data.atRestEncryptionEnabled ?? false}
                onChange={(_, checked) => handleChange({ atRestEncryptionEnabled: checked })}
                disabled={mutation.isPending || isLoading}
              />
            </Stack>
          </Box>

          <Box
            sx={{
              p: 1.5,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Audit retention
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Keep audit trails
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1.5 }}>
              {RETENTION_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  size="small"
                  variant={(localData.auditRetentionYears ?? 7) === o.value ? 'filled' : 'outlined'}
                  color={(localData.auditRetentionYears ?? 7) === o.value ? 'primary' : 'default'}
                  onClick={() => handleChange({ auditRetentionYears: o.value })}
                  disabled={mutation.isPending || isLoading}
                />
              ))}
            </Stack>
          </Box>

          <Box
            sx={{
              p: 1.5,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Export controls
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Export requires approvals
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }} flexWrap="wrap" gap={1}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <FormControl size="small" sx={{ minWidth: 90 }}>
                  <Select
                    value={localData.exportMode ?? data.exportMode ?? 'ZIP'}
                    onChange={(e) => handleChange({ exportMode: e.target.value as 'ZIP' | 'CSV' })}
                    disabled={mutation.isPending || isLoading}
                    displayEmpty
                  >
                    {EXPORT_MODES.map((o) => (
                      <MenuItem key={o.value} value={o.value}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Label
                  color={(localData.exportRequiresApproval ?? data.exportRequiresApproval) ? 'warning' : 'default'}
                  variant="soft"
                >
                  {(localData.exportRequiresApproval ?? data.exportRequiresApproval) ? 'Approval required' : 'No approval'}
                </Label>
              </Stack>
              <Switch
                checked={localData.exportRequiresApproval ?? data.exportRequiresApproval ?? false}
                onChange={(_, checked) => handleChange({ exportRequiresApproval: checked })}
                disabled={mutation.isPending || isLoading}
              />
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};
