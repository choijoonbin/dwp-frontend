import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';

import { usePiiTab } from './hooks/use-pii-tab';
import { MaskingPolicyCard } from './components/masking-policy-card';
import { DataProtectionCard } from './components/data-protection-card';
import { PiiLoadingSkeleton } from './components/pii-loading-skeleton';
import { ErrorState } from '../../tenant-scope/components/error-state';

export const PiiEncryptionTab = () => {
  const {
    profileId,
    setProfileId,
    profileOptions,
    catalog,
    piiPoliciesByFieldKey,
    dataProtection,
    isLoading,
    hasProfiles,
    refetch,
    error,
  } = usePiiTab({ enabled: true });

  if (isLoading && !hasProfiles) {
    return (
      <Box sx={{ mt: 3 }}>
        <PiiLoadingSkeleton />
      </Box>
    );
  }

  if (!profileId && hasProfiles) {
    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Loading profile...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 3 }}>
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load PII settings.'}
          onRetry={refetch}
        />
      </Box>
    );
  }

  if (!hasProfiles) {
    return (
      <Box sx={{ mt: 3 }}>
        <ErrorState
          message="No profiles found. Configure a profile first."
          onRetry={refetch}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Profile</InputLabel>
          <Select
            value={profileId ?? ''}
            label="Profile"
            onChange={(e) => setProfileId(e.target.value || null)}
          >
            {profileOptions.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
                {p.isDefault ? ' (default)' : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' },
          gap: 2,
        }}
      >
        <MaskingPolicyCard
          profileId={profileId}
          catalog={catalog}
          policiesByFieldKey={piiPoliciesByFieldKey}
          isLoading={isLoading}
          onSaved={refetch}
        />
        <DataProtectionCard
          profileId={profileId!}
          data={dataProtection}
          isLoading={isLoading}
          onSaved={refetch}
        />
      </Box>
    </Box>
  );
};
