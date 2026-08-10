import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ImageUp, RotateCcw, Save, Upload, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ProductMark } from '@dwp-frontend/design-system';
import {
  getAdminTenantBranding,
  resetTenantLogo,
  resolveTenantLogoUrl,
  updateTenantBranding,
  uploadTenantLogo,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';

import type { TenantBranding } from '@dwp-frontend/shared-utils';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation could not be completed.';
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TenantBrandingManager() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const brandingQuery = useQuery({
    queryKey: ['admin', 'tenant-branding'],
    queryFn: getAdminTenantBranding,
  });
  const branding = brandingQuery.data;

  useEffect(() => {
    if (branding) setOrganizationName(branding.organizationName ?? '');
  }, [branding]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const activeLogoUrl = previewUrl || resolveTenantLogoUrl(branding);
  const changed = useMemo(
    () => Boolean(branding && organizationName.trim() !== (branding.organizationName ?? '')),
    [branding, organizationName]
  );

  const refresh = async (next: TenantBranding) => {
    queryClient.setQueryData(['admin', 'tenant-branding'], next);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tenant-branding'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
    ]);
  };

  const run = async (operation: () => Promise<TenantBranding>, successMessage: string) => {
    setBusy(true);
    setOperationError(null);
    try {
      const next = await operation();
      await refresh(next);
      toast.success(successMessage);
    } catch (error) {
      const message = errorMessage(error);
      setOperationError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const selectFile = (file?: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  if (brandingQuery.isLoading) return <AdminPanelLoading label="Loading tenant branding" />;
  if (brandingQuery.isError || !branding) {
    return <AdminPanelError message={errorMessage(brandingQuery.error)} />;
  }

  return (
    <Box component="section" aria-labelledby="tenant-branding-heading">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={2}
        sx={{ py: 1.5 }}
      >
        <Box>
          <Typography id="tenant-branding-heading" component="h2" variant="h5">
            Tenant branding
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Organization identity in the DWP co-brand lockup.
          </Typography>
        </Box>
        <Chip
          label={branding.logoUrl ? 'Custom logo' : 'Product brand only'}
          color={branding.logoUrl ? 'info' : 'default'}
          variant="outlined"
        />
      </Stack>

      {operationError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setOperationError(null)}>
          {operationError}
        </Alert>
      )}

      <Box
        aria-label="Header brand preview"
        sx={{
          minHeight: 120,
          px: { xs: 2, md: 3 },
          display: 'flex',
          alignItems: 'center',
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <ProductMark
          aria-label="Brand lockup preview"
          prefix={
            activeLogoUrl ? (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                <Box
                  component="img"
                  src={activeLogoUrl}
                  alt=""
                  sx={{ width: 'auto', maxWidth: 92, height: 30, objectFit: 'contain' }}
                />
                <Box sx={{ width: 1, height: 24, bgcolor: 'divider' }} />
              </Box>
            ) : undefined
          }
        />
      </Box>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        gap={1}
        sx={{ py: 2 }}
      >
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="image/svg+xml,image/png,image/jpeg"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        <Button
          variant="outlined"
          startIcon={<ImageUp size={17} strokeWidth={1.8} />}
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          Choose logo
        </Button>
        {selectedFile && (
          <Button
            variant="contained"
            startIcon={<Upload size={17} strokeWidth={1.8} />}
            onClick={() =>
              void run(async () => {
                const next = await uploadTenantLogo(selectedFile, branding.version);
                selectFile();
                return next;
              }, 'Tenant logo uploaded.')
            }
            disabled={busy}
          >
            Upload logo
          </Button>
        )}
        <Button
          variant="text"
          color="inherit"
          startIcon={selectedFile ? <X size={17} /> : <RotateCcw size={17} />}
          onClick={() => {
            if (selectedFile) selectFile();
            else void run(() => resetTenantLogo(branding.version), 'Tenant logo removed.');
          }}
          disabled={busy || (!selectedFile && !branding.logoUrl)}
        >
          {selectedFile ? 'Discard selection' : 'Remove logo'}
        </Button>
        <Box sx={{ minWidth: 0, ml: { md: 'auto' }, textAlign: { md: 'right' } }}>
          <Typography variant="body2" noWrap>
            {selectedFile?.name || branding.logoOriginalName || 'No tenant logo'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {selectedFile
              ? `${formatBytes(selectedFile.size)} / pending upload`
              : branding.logoSizeBytes
                ? `${branding.logoWidth} x ${branding.logoHeight} / ${formatBytes(branding.logoSizeBytes)}`
                : 'SVG, PNG, or JPEG / up to 2 MB'}
          </Typography>
        </Box>
      </Stack>

      <Divider />
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ py: 3 }}>
        <TextField
          fullWidth
          label="Organization name"
          value={organizationName}
          onChange={(event) => setOrganizationName(event.target.value.slice(0, 160))}
          helperText={`${organizationName.length}/160`}
          slotProps={{ input: { startAdornment: <Building2 size={18} /> } }}
        />
        <Button
          variant="contained"
          startIcon={<Save size={17} />}
          disabled={busy || !changed}
          onClick={() =>
            void run(
              () => updateTenantBranding(organizationName.trim() || null, branding.version),
              'Tenant branding saved.'
            )
          }
          sx={{ alignSelf: { sm: 'flex-start' }, minWidth: 160, minHeight: 56 }}
        >
          Save branding
        </Button>
      </Stack>
    </Box>
  );
}
