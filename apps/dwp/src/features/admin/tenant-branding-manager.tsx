import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, ImageUp, RotateCcw, Save, Upload, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ProductMark } from '@dwp-frontend/design-system';
import { formatNumber } from '@dwp-frontend/shared-i18n';
import {
  getAdminTenantBranding,
  resolveAdminTenantLogoUrl,
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
import { useCurrentProviderSupportContext } from '../provider/use-provider-support-context';

import type { TenantBranding } from '@dwp-frontend/shared-utils';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${formatNumber(bytes / (1024 * 1024), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} MB`;
}

export function TenantBrandingManager() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const supportContext = useCurrentProviderSupportContext();
  const canWrite =
    !supportContext.data || supportContext.data.scopes.includes('TENANT_CONFIGURATION_WRITE');
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

  const activeLogoUrl =
    previewUrl ||
    (supportContext.data ? resolveAdminTenantLogoUrl(branding) : resolveTenantLogoUrl(branding));
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
      const message = errorMessage(error, t('common.operationError'));
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

  if (brandingQuery.isLoading) {
    return <AdminPanelLoading label={t('branding.loading')} />;
  }
  if (brandingQuery.isError || !branding) {
    return (
      <AdminPanelError message={errorMessage(brandingQuery.error, t('common.operationError'))} />
    );
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
            {t('branding.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {t('branding.description')}
          </Typography>
        </Box>
        <Chip
          label={branding.logoUrl ? t('branding.customLogo') : t('branding.productOnly')}
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
        aria-label={t('branding.headerPreview')}
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
          aria-label={t('branding.lockupPreview')}
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
          disabled={!canWrite}
          accept="image/svg+xml,image/png,image/jpeg"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        <Button
          variant="outlined"
          startIcon={<ImageUp size={17} strokeWidth={1.8} />}
          onClick={() => inputRef.current?.click()}
          disabled={busy || !canWrite}
        >
          {t('branding.actions.chooseLogo')}
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
              }, t('branding.toasts.logoUploaded'))
            }
            disabled={busy || !canWrite}
          >
            {t('branding.actions.uploadLogo')}
          </Button>
        )}
        <Button
          variant="text"
          color="inherit"
          startIcon={selectedFile ? <X size={17} /> : <RotateCcw size={17} />}
          onClick={() => {
            if (selectedFile) selectFile();
            else
              void run(() => resetTenantLogo(branding.version), t('branding.toasts.logoRemoved'));
          }}
          disabled={busy || !canWrite || (!selectedFile && !branding.logoUrl)}
        >
          {selectedFile ? t('common.actions.discardSelection') : t('branding.actions.removeLogo')}
        </Button>
        <Box sx={{ minWidth: 0, ml: { md: 'auto' }, textAlign: { md: 'right' } }}>
          <Typography variant="body2" noWrap>
            {selectedFile?.name || branding.logoOriginalName || t('branding.noLogo')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {selectedFile
              ? t('common.file.pendingUpload', { size: formatBytes(selectedFile.size) })
              : branding.logoSizeBytes
                ? t('common.file.metadata', {
                    width: branding.logoWidth,
                    height: branding.logoHeight,
                    size: formatBytes(branding.logoSizeBytes),
                  })
                : t('branding.fileRequirements')}
          </Typography>
        </Box>
      </Stack>

      <Divider />
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ py: 3 }}>
        <TextField
          fullWidth
          label={t('branding.organizationName')}
          value={organizationName}
          disabled={!canWrite}
          onChange={(event) => setOrganizationName(event.target.value.slice(0, 160))}
          helperText={`${organizationName.length}/160`}
          slotProps={{ input: { startAdornment: <Building2 size={18} /> } }}
        />
        <Button
          variant="contained"
          startIcon={<Save size={17} />}
          disabled={busy || !canWrite || !changed}
          onClick={() =>
            void run(
              () => updateTenantBranding(organizationName.trim() || null, branding.version),
              t('branding.toasts.saved')
            )
          }
          sx={{ alignSelf: { sm: 'flex-start' }, minWidth: 160, minHeight: 56 }}
        >
          {t('branding.actions.save')}
        </Button>
      </Stack>
    </Box>
  );
}
