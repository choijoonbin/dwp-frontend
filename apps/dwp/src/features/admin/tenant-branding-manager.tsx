import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppWindow,
  Building2,
  CheckCircle2,
  CircleAlert,
  History,
  ImageUp,
  LogIn,
  Mail,
  Monitor,
  RotateCcw,
  Save,
  Upload,
  X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, DetailInspector, FormField, ProductMark } from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import {
  getAdminTenantBranding,
  getTenantBrandingRevisions,
  resolveAdminTenantLogoUrl,
  resetTenantLogo,
  resolveTenantLogoUrl,
  rollbackTenantBranding,
  updateTenantBranding,
  uploadTenantLogo,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { getContrastRatio } from '@mui/material/styles';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';
import { useCurrentProviderSupportContext } from '../provider/use-provider-support-context';

import type { TenantBranding, TenantBrandingRevision } from '@dwp-frontend/shared-utils';

type PreviewSurface = 'SHELL' | 'SIGN_IN' | 'EMAIL' | 'FAVICON';

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

function safeAccent(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : '#2457D6';
}

function RevisionHistory({
  open,
  revisions,
  busy,
  canWrite,
  onClose,
  onRestore,
}: {
  open: boolean;
  revisions: TenantBrandingRevision[];
  busy: boolean;
  canWrite: boolean;
  onClose: () => void;
  onRestore: (revision: TenantBrandingRevision) => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <DetailInspector
      open={open}
      variant="drawer"
      width={480}
      title={t('branding.history.title')}
      subtitle={t('branding.history.subtitle')}
      closeLabel={t('branding.history.close')}
      onClose={onClose}
    >
      {revisions.length === 0 ? (
        <Alert severity="info">{t('branding.history.empty')}</Alert>
      ) : (
        <Stack divider={<Divider flexItem />}>
          {revisions.map((revision) => (
            <Stack key={revision.revisionId} gap={1} sx={{ py: 1.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2">
                    {t(`branding.history.changeTypes.${revision.changeType}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(revision.createdAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Typography>
                </Box>
                {revision.current ? (
                  <Chip size="small" color="success" label={t('branding.history.current')} />
                ) : (
                  <ActionButton
                    size="small"
                    intent="secondary"
                    startIcon={<RotateCcw size={15} />}
                    disabled={busy || !canWrite}
                    onClick={() => onRestore(revision)}
                  >
                    {t('branding.history.restore')}
                  </ActionButton>
                )}
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <Typography variant="body2" noWrap>
                  {revision.organizationName || t('branding.history.productOnly')}
                </Typography>
                <Stack direction="row" alignItems="center" gap={0.75}>
                  <Box
                    aria-hidden="true"
                    sx={{ width: 14, height: 14, bgcolor: revision.accentColor, borderRadius: 0.5 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t('branding.history.version', { version: revision.sourceVersion })}
                  </Typography>
                </Stack>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {revision.logoOriginalName || t('branding.noLogo')}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </DetailInspector>
  );
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
  const [accentColor, setAccentColor] = useState('#2457D6');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSurface, setPreviewSurface] = useState<PreviewSurface>('SHELL');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const brandingQuery = useQuery({
    queryKey: ['admin', 'tenant-branding'],
    queryFn: getAdminTenantBranding,
  });
  const historyQuery = useQuery({
    queryKey: ['admin', 'tenant-branding', 'revisions'],
    queryFn: () => getTenantBrandingRevisions(30),
  });
  const branding = brandingQuery.data;

  useEffect(() => {
    if (!branding) return;
    setOrganizationName(branding.organizationName ?? '');
    setAccentColor(safeAccent(branding.accentColor));
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
    () =>
      Boolean(
        branding &&
          (organizationName.trim() !== (branding.organizationName ?? '') ||
            safeAccent(accentColor) !== safeAccent(branding.accentColor))
      ),
    [accentColor, branding, organizationName]
  );
  const accentContrast = Math.max(
    getContrastRatio(safeAccent(accentColor), '#FFFFFF'),
    getContrastRatio(safeAccent(accentColor), '#0F151D')
  );
  const logoWidth = branding?.logoWidth ?? 0;
  const logoHeight = branding?.logoHeight ?? 0;
  const logoRatio = logoHeight > 0 ? logoWidth / logoHeight : 0;
  const qualityChecks = [
    {
      pass: organizationName.trim().length > 0,
      label: t('branding.quality.organization.label'),
      detail: t(
        organizationName.trim()
          ? 'branding.quality.organization.pass'
          : 'branding.quality.organization.warning'
      ),
    },
    {
      pass: accentContrast >= 4.5,
      label: t('branding.quality.contrast.label'),
      detail: t('branding.quality.contrast.detail', { ratio: accentContrast.toFixed(1) }),
    },
    {
      pass: Boolean(activeLogoUrl) && (selectedFile ? selectedFile.size <= 2 * 1024 * 1024 : true),
      label: t('branding.quality.asset.label'),
      detail: selectedFile
        ? t('branding.quality.asset.pending', { size: formatBytes(selectedFile.size) })
        : activeLogoUrl
          ? t('branding.quality.asset.pass')
          : t('branding.quality.asset.warning'),
    },
    {
      pass: !branding?.logoUrl || (logoRatio >= 1 && logoRatio <= 6),
      label: t('branding.quality.ratio.label'),
      detail: branding?.logoUrl
        ? t('branding.quality.ratio.detail', {
            width: branding.logoWidth,
            height: branding.logoHeight,
          })
        : t('branding.quality.ratio.notAvailable'),
    },
  ];

  const refresh = async (next: TenantBranding) => {
    queryClient.setQueryData(['admin', 'tenant-branding'], next);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tenant-branding'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenant-branding', 'revisions'] }),
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

  const brandLockup = (
    <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
      {activeLogoUrl && (
        <>
          <Box
            component="img"
            src={activeLogoUrl}
            alt=""
            sx={{ display: 'block', maxWidth: 92, maxHeight: 30, objectFit: 'contain' }}
          />
          <Box aria-hidden="true" sx={{ width: 1, height: 24, bgcolor: 'divider' }} />
        </>
      )}
      <ProductMark />
    </Stack>
  );

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
        <Stack direction="row" gap={1} flexWrap="wrap">
          {changed && <Chip size="small" color="warning" label={t('branding.unsaved')} />}
          <Chip
            size="small"
            label={t('branding.version', { version: branding.version })}
            variant="outlined"
          />
          <ActionButton
            intent="secondary"
            startIcon={<History size={17} />}
            onClick={() => setHistoryOpen(true)}
          >
            {t('branding.actions.history')}
          </ActionButton>
        </Stack>
      </Stack>

      {operationError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setOperationError(null)}>
          {operationError}
        </Alert>
      )}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ py: 1.5, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box>
          <Typography component="h3" variant="subtitle2">
            {t('branding.preview.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t(`branding.preview.surfaces.${previewSurface}`)}
          </Typography>
        </Box>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={previewSurface}
          onChange={(_event, value: PreviewSurface | null) => value && setPreviewSurface(value)}
          aria-label={t('branding.preview.surfaceLabel')}
        >
          <ToggleButton value="SHELL" aria-label={t('branding.preview.surfaces.SHELL')}>
            <Monitor size={17} />
          </ToggleButton>
          <ToggleButton value="SIGN_IN" aria-label={t('branding.preview.surfaces.SIGN_IN')}>
            <LogIn size={17} />
          </ToggleButton>
          <ToggleButton value="EMAIL" aria-label={t('branding.preview.surfaces.EMAIL')}>
            <Mail size={17} />
          </ToggleButton>
          <ToggleButton value="FAVICON" aria-label={t('branding.preview.surfaces.FAVICON')}>
            <AppWindow size={17} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Box
        aria-label={t('branding.preview.title')}
        sx={{
          minHeight: 260,
          display: 'grid',
          placeItems: 'center',
          p: { xs: 2, md: 4 },
          bgcolor: 'background.default',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {previewSurface === 'SHELL' && (
          <Box
            sx={{
              width: 1,
              maxWidth: 980,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ px: 2, minHeight: 64 }}
            >
              {brandLockup}
              <Stack direction="row" alignItems="center" gap={1}>
                <Box sx={{ width: 120, height: 32, bgcolor: 'action.hover', borderRadius: 1 }} />
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: safeAccent(accentColor),
                    borderRadius: '50%',
                  }}
                />
              </Stack>
            </Stack>
            <Box sx={{ height: 3, bgcolor: safeAccent(accentColor) }} />
          </Box>
        )}
        {previewSurface === 'SIGN_IN' && (
          <Box
            sx={{
              width: 1,
              maxWidth: 420,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              p: 3,
            }}
          >
            {brandLockup}
            <Typography component="p" variant="h6" sx={{ mt: 4 }}>
              {organizationName.trim() || t('branding.preview.organizationFallback')}
            </Typography>
            <Box sx={{ mt: 2, height: 44, border: 1, borderColor: 'divider', borderRadius: 1 }} />
            <Box sx={{ mt: 1.5, height: 44, bgcolor: safeAccent(accentColor), borderRadius: 1 }} />
          </Box>
        )}
        {previewSurface === 'EMAIL' && (
          <Box
            sx={{
              width: 1,
              maxWidth: 640,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Box sx={{ px: 3, py: 2, borderBottom: 3, borderColor: safeAccent(accentColor) }}>
              {brandLockup}
            </Box>
            <Stack gap={1.25} sx={{ p: 3 }}>
              <Box sx={{ width: '42%', height: 18, bgcolor: 'text.primary', opacity: 0.85 }} />
              <Box sx={{ width: '100%', height: 10, bgcolor: 'action.hover' }} />
              <Box sx={{ width: '88%', height: 10, bgcolor: 'action.hover' }} />
              <Box
                sx={{
                  width: 128,
                  height: 36,
                  mt: 1,
                  bgcolor: safeAccent(accentColor),
                  borderRadius: 1,
                }}
              />
            </Stack>
          </Box>
        )}
        {previewSurface === 'FAVICON' && (
          <Box
            sx={{
              width: 1,
              maxWidth: 520,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              gap={1.25}
              sx={{ px: 2, py: 1.25, bgcolor: 'action.hover' }}
            >
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                  borderRadius: 0.75,
                  bgcolor: safeAccent(accentColor),
                }}
              >
                {activeLogoUrl ? (
                  <Box
                    component="img"
                    src={activeLogoUrl}
                    alt=""
                    sx={{ maxWidth: 20, maxHeight: 20, objectFit: 'contain' }}
                  />
                ) : (
                  <Typography variant="caption" sx={{ color: '#FFFFFF', fontWeight: 700 }}>
                    D
                  </Typography>
                )}
              </Box>
              <Typography variant="body2" noWrap>
                {organizationName.trim() || t('branding.preview.organizationFallback')}
              </Typography>
              <X size={14} />
            </Stack>
            <Box sx={{ height: 96 }} />
          </Box>
        )}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(300px, 0.65fr)' },
          gap: 3,
          py: 3,
        }}
      >
        <Stack gap={2.5}>
          <Typography component="h3" variant="subtitle1">
            {t('branding.editor.title')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <FormField
              label={t('branding.organizationName')}
              value={organizationName}
              disabled={!canWrite}
              onChange={(event) => setOrganizationName(event.target.value.slice(0, 160))}
              supportingText={`${organizationName.length}/160`}
              slotProps={{ input: { startAdornment: <Building2 size={18} /> } }}
            />
            <Stack direction="row" alignItems="flex-start" gap={1}>
              <Box
                component="input"
                type="color"
                aria-label={t('branding.accentColor')}
                value={safeAccent(accentColor)}
                disabled={!canWrite}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setAccentColor(event.target.value.toUpperCase())
                }
                sx={{
                  width: 56,
                  height: 56,
                  p: 0.5,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                }}
              />
              <FormField
                label={t('branding.accentColor')}
                value={accentColor}
                disabled={!canWrite}
                onChange={(event) => setAccentColor(event.target.value.slice(0, 7))}
                errorMessage={
                  !/^#[0-9a-f]{6}$/i.test(accentColor)
                    ? t('branding.accentColorInvalid')
                    : undefined
                }
                sx={{ width: 150 }}
              />
            </Stack>
          </Stack>

          <Divider />
          <input
            ref={inputRef}
            hidden
            type="file"
            disabled={!canWrite}
            accept="image/svg+xml,image/png,image/jpeg"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} gap={1}>
            <ActionButton
              intent="secondary"
              startIcon={<ImageUp size={17} />}
              onClick={() => inputRef.current?.click()}
              disabled={busy || !canWrite}
            >
              {t('branding.actions.chooseLogo')}
            </ActionButton>
            {selectedFile && (
              <ActionButton
                intent="primary"
                startIcon={<Upload size={17} />}
                onClick={() =>
                  void run(async () => {
                    const next = await uploadTenantLogo(selectedFile, branding.version);
                    selectFile();
                    return next;
                  }, t('branding.toasts.logoUploaded'))
                }
                disabled={busy || !canWrite || selectedFile.size > 2 * 1024 * 1024}
              >
                {t('branding.actions.publishLogo')}
              </ActionButton>
            )}
            <ActionButton
              intent="quiet"
              startIcon={selectedFile ? <X size={17} /> : <RotateCcw size={17} />}
              onClick={() => {
                if (selectedFile) selectFile();
                else
                  void run(
                    () => resetTenantLogo(branding.version),
                    t('branding.toasts.logoRemoved')
                  );
              }}
              disabled={busy || !canWrite || (!selectedFile && !branding.logoUrl)}
            >
              {selectedFile
                ? t('common.actions.discardSelection')
                : t('branding.actions.removeLogo')}
            </ActionButton>
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

          <ActionButton
            intent="primary"
            startIcon={<Save size={17} />}
            disabled={busy || !canWrite || !changed || !/^#[0-9a-f]{6}$/i.test(accentColor)}
            onClick={() =>
              void run(
                () =>
                  updateTenantBranding(
                    organizationName.trim() || null,
                    safeAccent(accentColor),
                    branding.version
                  ),
                t('branding.toasts.published')
              )
            }
            sx={{ alignSelf: 'flex-start' }}
          >
            {t('branding.actions.publish')}
          </ActionButton>
        </Stack>

        <Box component="aside" aria-labelledby="branding-quality-heading">
          <Typography id="branding-quality-heading" component="h3" variant="subtitle1">
            {t('branding.quality.title')}
          </Typography>
          <Stack sx={{ mt: 1.5, borderTop: 1, borderColor: 'divider' }}>
            {qualityChecks.map((check) => (
              <Stack
                key={check.label}
                direction="row"
                alignItems="flex-start"
                gap={1.25}
                sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}
              >
                {check.pass ? (
                  <CheckCircle2 size={18} color="#16794B" aria-hidden="true" />
                ) : (
                  <CircleAlert size={18} color="#9A5B00" aria-hidden="true" />
                )}
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {check.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {check.detail}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>

      <RevisionHistory
        open={historyOpen}
        revisions={historyQuery.data ?? []}
        busy={busy}
        canWrite={canWrite}
        onClose={() => setHistoryOpen(false)}
        onRestore={(revision) => {
          setHistoryOpen(false);
          void run(
            () => rollbackTenantBranding(revision.revisionId, branding.version),
            t('branding.toasts.restored')
          );
        }}
      />
    </Box>
  );
}
