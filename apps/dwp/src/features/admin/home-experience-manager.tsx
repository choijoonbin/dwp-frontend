import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  CircleAlert,
  History,
  ImageUp,
  Languages,
  Monitor,
  Moon,
  RotateCcw,
  Save,
  Smartphone,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, DetailInspector, FormField } from '@dwp-frontend/design-system';
import {
  useToast,
  getAdminHomeExperience,
  getHomeExperienceRevisions,
  resetHomeBackground,
  resolveAdminHomeBackgroundUrl,
  resolveHomeBackgroundUrl,
  rollbackHomeExperience,
  updateHomeExperience,
  uploadHomeBackground,
} from '@dwp-frontend/shared-utils';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';
import { useCurrentProviderSupportContext } from '../provider/use-provider-support-context';

import type {
  HomeBackgroundPosition,
  HomeExperience,
  HomeExperienceRevision,
  LocalizedHomeCopy,
} from '@dwp-frontend/shared-utils';

type StudioLocale = 'ko' | 'en';
type PreviewViewport = 'DESKTOP' | 'MOBILE';
type PreviewTheme = 'LIGHT' | 'DARK';
type FormState = {
  localizedContent: Record<StudioLocale, LocalizedHomeCopy>;
  defaultLocale: StudioLocale;
  backgroundPosition: HomeBackgroundPosition;
  overlayOpacity: number;
};

const emptyCopy: LocalizedHomeCopy = { headline: '', subheadline: '' };
const emptyForm: FormState = {
  localizedContent: { ko: emptyCopy, en: emptyCopy },
  defaultLocale: 'ko',
  backgroundPosition: 'CENTER',
  overlayOpacity: 18,
};

function normalizedCopy(copy?: LocalizedHomeCopy | null): LocalizedHomeCopy {
  return { headline: copy?.headline ?? '', subheadline: copy?.subheadline ?? '' };
}

function formFrom(experience: HomeExperience): FormState {
  const configured = experience.localizedContent ?? {};
  const defaultLocale: StudioLocale = experience.defaultLocale === 'en' ? 'en' : 'ko';
  const fallback = normalizedCopy({
    headline: experience.headline,
    subheadline: experience.subheadline,
  });
  const hasLocalizedContent = Object.keys(configured).length > 0;
  return {
    localizedContent: {
      ko: normalizedCopy(
        configured.ko ?? (!hasLocalizedContent && defaultLocale === 'ko' ? fallback : undefined)
      ),
      en: normalizedCopy(
        configured.en ?? (!hasLocalizedContent && defaultLocale === 'en' ? fallback : undefined)
      ),
    },
    defaultLocale,
    backgroundPosition: experience.backgroundPosition,
    overlayOpacity: experience.overlayOpacity,
  };
}

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

function HomeRevisionHistory({
  open,
  revisions,
  busy,
  canWrite,
  onClose,
  onRestore,
}: {
  open: boolean;
  revisions: HomeExperienceRevision[];
  busy: boolean;
  canWrite: boolean;
  onClose: () => void;
  onRestore: (revision: HomeExperienceRevision) => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <DetailInspector
      open={open}
      variant="drawer"
      width={480}
      title={t('homeExperience.history.title')}
      subtitle={t('homeExperience.history.subtitle')}
      closeLabel={t('homeExperience.history.close')}
      onClose={onClose}
    >
      {revisions.length === 0 ? (
        <Alert severity="info">{t('homeExperience.history.empty')}</Alert>
      ) : (
        <Stack divider={<Divider flexItem />}>
          {revisions.map((revision) => (
            <Stack key={revision.revisionId} gap={1} sx={{ py: 1.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2">
                    {t(`homeExperience.history.changeTypes.${revision.changeType}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(revision.createdAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Typography>
                </Box>
                {revision.current ? (
                  <Chip size="small" color="success" label={t('homeExperience.history.current')} />
                ) : (
                  <ActionButton
                    size="small"
                    intent="secondary"
                    startIcon={<RotateCcw size={15} />}
                    disabled={busy || !canWrite}
                    onClick={() => onRestore(revision)}
                  >
                    {t('homeExperience.history.restore')}
                  </ActionButton>
                )}
              </Stack>
              <Typography variant="body2" noWrap>
                {revision.headline || t('homeExperience.history.defaultCopy')}
              </Typography>
              <Stack direction="row" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {revision.backgroundOriginalName || t('homeExperience.builtInBackground')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('homeExperience.history.summary', {
                    locales: t('homeExperience.history.localeCount', {
                      count: revision.localeCount,
                    }),
                    version: revision.sourceVersion,
                  })}
                </Typography>
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </DetailInspector>
  );
}

export function HomeExperienceManager() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const supportContext = useCurrentProviderSupportContext();
  const canWrite =
    !supportContext.data || supportContext.data.scopes.includes('TENANT_CONFIGURATION_WRITE');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editorLocale, setEditorLocale] = useState<StudioLocale>('ko');
  const [previewLocale, setPreviewLocale] = useState<StudioLocale>('ko');
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>('DESKTOP');
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>('LIGHT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDimensions, setSelectedDimensions] = useState<{ width: number; height: number }>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const experienceQuery = useQuery({
    queryKey: ['admin', 'home-experience'],
    queryFn: getAdminHomeExperience,
  });
  const historyQuery = useQuery({
    queryKey: ['admin', 'home-experience', 'revisions'],
    queryFn: () => getHomeExperienceRevisions(30),
  });
  const experience = experienceQuery.data;

  useEffect(() => {
    if (!experience) return;
    const next = formFrom(experience);
    setForm(next);
    setEditorLocale(next.defaultLocale);
    setPreviewLocale(next.defaultLocale);
  }, [experience]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const persistedBackgroundUrl = supportContext.data
    ? resolveAdminHomeBackgroundUrl(experience)
    : resolveHomeBackgroundUrl(experience);
  const activeBackgroundUrl = previewUrl || persistedBackgroundUrl;
  const changed = useMemo(() => {
    if (!experience) return false;
    return JSON.stringify(form) !== JSON.stringify(formFrom(experience));
  }, [experience, form]);
  const previewCopy = form.localizedContent[previewLocale];
  const editorCopy = form.localizedContent[editorLocale];
  const imageWidth = selectedDimensions?.width ?? experience?.backgroundWidth ?? 0;
  const imageHeight = selectedDimensions?.height ?? experience?.backgroundHeight ?? 0;
  const imageRatio = imageHeight > 0 ? imageWidth / imageHeight : 0;
  const defaultCopy = form.localizedContent[form.defaultLocale];
  const localeCoverage = (['ko', 'en'] as const).filter(
    (locale) =>
      form.localizedContent[locale].headline?.trim() &&
      form.localizedContent[locale].subheadline?.trim()
  ).length;
  const qualityChecks = [
    {
      pass: Boolean(defaultCopy.headline?.trim() && defaultCopy.subheadline?.trim()),
      label: t('homeExperience.quality.defaultCopy.label'),
      detail: t(
        defaultCopy.headline?.trim() && defaultCopy.subheadline?.trim()
          ? 'homeExperience.quality.defaultCopy.pass'
          : 'homeExperience.quality.defaultCopy.warning'
      ),
    },
    {
      pass: localeCoverage === 2,
      label: t('homeExperience.quality.locales.label'),
      detail: t('homeExperience.quality.locales.detail', { complete: localeCoverage, total: 2 }),
    },
    {
      pass:
        selectedFile?.size !== undefined
          ? selectedFile.size <= 10 * 1024 * 1024
          : !experience?.backgroundUrl || (imageWidth >= 1440 && imageHeight >= 400),
      label: t('homeExperience.quality.asset.label'),
      detail: selectedFile
        ? t('homeExperience.quality.asset.pending', { size: formatBytes(selectedFile.size) })
        : experience?.backgroundUrl
          ? t('homeExperience.quality.asset.dimensions', { width: imageWidth, height: imageHeight })
          : t('homeExperience.quality.asset.builtIn'),
    },
    {
      pass: !experience?.backgroundUrl || (imageRatio >= 2.2 && imageRatio <= 5),
      label: t('homeExperience.quality.safeArea.label'),
      detail: t('homeExperience.quality.safeArea.detail', {
        ratio: imageRatio ? imageRatio.toFixed(1) : t('homeExperience.quality.notAvailable'),
      }),
    },
    {
      pass: form.overlayOpacity >= 18,
      label: t('homeExperience.quality.readability.label'),
      detail: t('homeExperience.quality.readability.detail', { opacity: form.overlayOpacity }),
    },
  ];

  const refresh = async (next: HomeExperience) => {
    queryClient.setQueryData(['admin', 'home-experience'], next);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['home-experience'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'home-experience', 'revisions'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
    ]);
  };

  const run = async (
    operation: () => Promise<HomeExperience>,
    successMessage: string
  ): Promise<void> => {
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
    setSelectedDimensions(undefined);
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);
    const image = new Image();
    image.onload = () =>
      setSelectedDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = url;
  };

  const updateCopy = (field: keyof LocalizedHomeCopy, value: string) => {
    setForm((current) => ({
      ...current,
      localizedContent: {
        ...current.localizedContent,
        [editorLocale]: { ...current.localizedContent[editorLocale], [field]: value },
      },
    }));
  };

  const saveSettings = () => {
    if (!experience) return;
    const localizedContent = Object.fromEntries(
      (['ko', 'en'] as const).map((locale) => [
        locale,
        {
          headline: form.localizedContent[locale].headline?.trim() || null,
          subheadline: form.localizedContent[locale].subheadline?.trim() || null,
        },
      ])
    );
    const fallback = localizedContent[form.defaultLocale];
    void run(
      () =>
        updateHomeExperience({
          headline: fallback.headline,
          subheadline: fallback.subheadline,
          localizedContent,
          defaultLocale: form.defaultLocale,
          backgroundPosition: form.backgroundPosition,
          overlayOpacity: form.overlayOpacity,
          version: experience.version,
        }),
      t('homeExperience.toasts.published')
    );
  };

  const upload = () => {
    if (!experience || !selectedFile) return;
    void run(async () => {
      const next = await uploadHomeBackground(selectedFile, experience.version);
      selectFile();
      return next;
    }, t('homeExperience.toasts.uploaded'));
  };

  const resetBackground = () => {
    if (!experience) return;
    if (selectedFile) {
      selectFile();
      return;
    }
    void run(() => resetHomeBackground(experience.version), t('homeExperience.toasts.restored'));
  };

  if (experienceQuery.isLoading) {
    return <AdminPanelLoading label={t('homeExperience.loading')} />;
  }
  if (experienceQuery.isError || !experience) {
    return (
      <AdminPanelError message={errorMessage(experienceQuery.error, t('common.operationError'))} />
    );
  }

  const mobilePreview = previewViewport === 'MOBILE';
  const darkPreview = previewTheme === 'DARK';

  return (
    <Box component="section" aria-labelledby="home-experience-heading">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={2}
        sx={{ py: 1.5 }}
      >
        <Box>
          <Typography id="home-experience-heading" component="h2" variant="h5">
            {t('homeExperience.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {t('homeExperience.description')}
          </Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {changed && <Chip size="small" color="warning" label={t('homeExperience.unsaved')} />}
          <Chip
            size="small"
            variant="outlined"
            label={t('homeExperience.version', { version: experience.version })}
          />
          <ActionButton
            intent="secondary"
            startIcon={<History size={17} />}
            onClick={() => setHistoryOpen(true)}
          >
            {t('homeExperience.actions.history')}
          </ActionButton>
        </Stack>
      </Stack>

      {operationError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setOperationError(null)}>
          {operationError}
        </Alert>
      )}

      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        alignItems={{ xs: 'stretch', lg: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ py: 1.5, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box>
          <Typography component="h3" variant="subtitle2">
            {t('homeExperience.previewStudio.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('homeExperience.previewStudio.status', {
              viewport: t(`homeExperience.previewStudio.viewports.${previewViewport}`),
              locale: t(`homeExperience.locales.${previewLocale}`),
              theme: t(`homeExperience.previewStudio.themes.${previewTheme}`),
            })}
          </Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <ToggleButtonGroup
            exclusive
            size="small"
            value={previewViewport}
            onChange={(_event, value: PreviewViewport | null) => value && setPreviewViewport(value)}
            aria-label={t('homeExperience.previewStudio.viewportLabel')}
          >
            <ToggleButton
              value="DESKTOP"
              aria-label={t('homeExperience.previewStudio.viewports.DESKTOP')}
            >
              <Monitor size={17} />
            </ToggleButton>
            <ToggleButton
              value="MOBILE"
              aria-label={t('homeExperience.previewStudio.viewports.MOBILE')}
            >
              <Smartphone size={17} />
            </ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={previewTheme}
            onChange={(_event, value: PreviewTheme | null) => value && setPreviewTheme(value)}
            aria-label={t('homeExperience.previewStudio.themeLabel')}
          >
            <ToggleButton value="LIGHT" aria-label={t('homeExperience.previewStudio.themes.LIGHT')}>
              <Sun size={17} />
            </ToggleButton>
            <ToggleButton value="DARK" aria-label={t('homeExperience.previewStudio.themes.DARK')}>
              <Moon size={17} />
            </ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={previewLocale}
            onChange={(_event, value: StudioLocale | null) => value && setPreviewLocale(value)}
            aria-label={t('homeExperience.previewStudio.localeLabel')}
          >
            <ToggleButton value="ko">{t('homeExperience.localeCodes.ko')}</ToggleButton>
            <ToggleButton value="en">{t('homeExperience.localeCodes.en')}</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      <Box
        sx={{
          py: 3,
          minHeight: 430,
          display: 'grid',
          placeItems: 'center',
          bgcolor: darkPreview ? '#0F151D' : 'background.default',
          borderBottom: 1,
          borderColor: 'divider',
          transition: 'background-color 160ms ease-out',
        }}
      >
        <Box
          aria-label={t('homeExperience.preview')}
          sx={{
            position: 'relative',
            width: mobilePreview ? 320 : 'calc(100% - 32px)',
            maxWidth: mobilePreview ? 320 : 1120,
            aspectRatio: mobilePreview ? '9 / 16' : '16 / 6',
            minHeight: mobilePreview ? 568 : 340,
            overflow: 'hidden',
            color: '#FFFFFF',
            bgcolor: '#07163D',
            backgroundImage: `url(${activeBackgroundUrl})`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: `${form.backgroundPosition.toLowerCase()} center`,
            backgroundSize: 'cover',
            border: 1,
            borderColor: darkPreview ? '#4B5663' : 'divider',
            borderRadius: 1,
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              bgcolor: `rgba(2, 10, 34, ${form.overlayOpacity / 100})`,
            },
          }}
        >
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              inset: mobilePreview ? '56px 16px 80px' : '32px 7%',
              border: '1px dashed rgba(255,255,255,0.42)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: mobilePreview ? 'auto 16px 80px' : 'auto 7% 42px',
              maxWidth: mobilePreview ? 'none' : 560,
              p: mobilePreview ? 1.5 : 2,
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 1,
              bgcolor: 'rgba(5,17,47,0.68)',
              backdropFilter: 'blur(14px)',
            }}
          >
            <Typography component="p" variant={mobilePreview ? 'h6' : 'h5'} color="inherit">
              {previewCopy.headline?.trim() || t('homeExperience.previewHeadline')}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.75, color: 'rgba(255,255,255,0.82)' }}>
              {previewCopy.subheadline?.trim() || t('homeExperience.previewMessage')}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.4fr) minmax(320px, 0.6fr)' },
          gap: 3,
          py: 3,
        }}
      >
        <Stack gap={3}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5}>
            <Box>
              <Typography component="h3" variant="subtitle1">
                {t('homeExperience.editor.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('homeExperience.editor.localeStatus', {
                  locale: t(`homeExperience.locales.${editorLocale}`),
                })}
              </Typography>
            </Box>
            <Stack direction="row" alignItems="center" gap={1}>
              <Languages size={17} />
              <ToggleButtonGroup
                exclusive
                size="small"
                value={editorLocale}
                onChange={(_event, value: StudioLocale | null) => value && setEditorLocale(value)}
                aria-label={t('homeExperience.editor.localeLabel')}
              >
                <ToggleButton value="ko">{t('homeExperience.localeCodes.ko')}</ToggleButton>
                <ToggleButton value="en">{t('homeExperience.localeCodes.en')}</ToggleButton>
              </ToggleButtonGroup>
              <ActionButton
                size="small"
                intent={form.defaultLocale === editorLocale ? 'primary' : 'secondary'}
                onClick={() => setForm((current) => ({ ...current, defaultLocale: editorLocale }))}
                disabled={!canWrite || form.defaultLocale === editorLocale}
              >
                {form.defaultLocale === editorLocale
                  ? t('homeExperience.editor.defaultLocale')
                  : t('homeExperience.editor.makeDefault')}
              </ActionButton>
            </Stack>
          </Stack>

          <Stack gap={2}>
            <FormField
              label={t('homeExperience.fields.headline')}
              value={editorCopy.headline ?? ''}
              disabled={!canWrite}
              onChange={(event) => updateCopy('headline', event.target.value.slice(0, 160))}
              supportingText={`${editorCopy.headline?.length ?? 0}/160`}
            />
            <FormField
              label={t('homeExperience.fields.message')}
              value={editorCopy.subheadline ?? ''}
              disabled={!canWrite}
              onChange={(event) => updateCopy('subheadline', event.target.value.slice(0, 500))}
              supportingText={`${editorCopy.subheadline?.length ?? 0}/500`}
              multiline
              minRows={3}
            />
          </Stack>

          <Divider />
          <Typography component="h3" variant="subtitle1">
            {t('homeExperience.asset.title')}
          </Typography>
          <input
            ref={inputRef}
            hidden
            type="file"
            disabled={!canWrite}
            accept="image/png,image/jpeg"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} gap={1}>
            <ActionButton
              intent="secondary"
              startIcon={<ImageUp size={17} />}
              onClick={() => inputRef.current?.click()}
              disabled={busy || !canWrite}
            >
              {t('homeExperience.actions.chooseImage')}
            </ActionButton>
            {selectedFile && (
              <ActionButton
                intent="primary"
                startIcon={<Upload size={17} />}
                onClick={upload}
                disabled={busy || !canWrite || selectedFile.size > 10 * 1024 * 1024}
              >
                {t('homeExperience.actions.publishImage')}
              </ActionButton>
            )}
            <ActionButton
              intent="quiet"
              startIcon={selectedFile ? <X size={17} /> : <RotateCcw size={17} />}
              onClick={resetBackground}
              disabled={busy || !canWrite || (!selectedFile && !experience.backgroundUrl)}
            >
              {selectedFile
                ? t('common.actions.discardSelection')
                : t('homeExperience.actions.restore')}
            </ActionButton>
            <Box sx={{ minWidth: 0, ml: { md: 'auto' }, textAlign: { md: 'right' } }}>
              <Typography variant="body2" noWrap>
                {selectedFile?.name ||
                  experience.backgroundOriginalName ||
                  t('homeExperience.builtInBackground')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedFile
                  ? t('common.file.pendingUpload', { size: formatBytes(selectedFile.size) })
                  : experience.backgroundSizeBytes
                    ? t('common.file.metadata', {
                        width: experience.backgroundWidth,
                        height: experience.backgroundHeight,
                        size: formatBytes(experience.backgroundSizeBytes),
                      })
                    : t('homeExperience.fileRequirements')}
              </Typography>
            </Box>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(260px, 0.8fr)' },
              gap: 3,
            }}
          >
            <Box>
              <Typography component="h4" variant="subtitle2">
                {t('homeExperience.fields.imagePosition')}
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={form.backgroundPosition}
                disabled={!canWrite}
                onChange={(_event, value: HomeBackgroundPosition | null) => {
                  if (value) setForm((current) => ({ ...current, backgroundPosition: value }));
                }}
                aria-label={t('homeExperience.fields.imagePosition')}
                sx={{ mt: 1 }}
              >
                <ToggleButton value="LEFT">{t('homeExperience.positions.LEFT')}</ToggleButton>
                <ToggleButton value="CENTER">{t('homeExperience.positions.CENTER')}</ToggleButton>
                <ToggleButton value="RIGHT">{t('homeExperience.positions.RIGHT')}</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Box>
              <Stack direction="row" alignItems="baseline" justifyContent="space-between">
                <Typography component="h4" variant="subtitle2">
                  {t('homeExperience.fields.overlay')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {form.overlayOpacity}%
                </Typography>
              </Stack>
              <Slider
                value={form.overlayOpacity}
                disabled={!canWrite}
                min={0}
                max={70}
                step={1}
                onChange={(_event, value) =>
                  setForm((current) => ({ ...current, overlayOpacity: value as number }))
                }
                valueLabelDisplay="auto"
                aria-label={t('homeExperience.fields.overlay')}
                sx={{ mt: 1 }}
              />
            </Box>
          </Box>

          <ActionButton
            intent="primary"
            startIcon={<Save size={17} />}
            onClick={saveSettings}
            disabled={
              busy ||
              !canWrite ||
              !changed ||
              !defaultCopy.headline?.trim() ||
              !defaultCopy.subheadline?.trim()
            }
            sx={{ alignSelf: 'flex-start' }}
          >
            {t('homeExperience.actions.publish')}
          </ActionButton>
        </Stack>

        <Box component="aside" aria-labelledby="home-quality-heading">
          <Typography id="home-quality-heading" component="h3" variant="subtitle1">
            {t('homeExperience.quality.title')}
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

      <HomeRevisionHistory
        open={historyOpen}
        revisions={historyQuery.data ?? []}
        busy={busy}
        canWrite={canWrite}
        onClose={() => setHistoryOpen(false)}
        onRestore={(revision) => {
          setHistoryOpen(false);
          void run(
            () => rollbackHomeExperience(revision.revisionId, experience.version),
            t('homeExperience.toasts.revisionRestored')
          );
        }}
      />
    </Box>
  );
}
