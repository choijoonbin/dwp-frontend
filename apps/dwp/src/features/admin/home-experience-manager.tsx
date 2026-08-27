import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker, useNavigate } from 'react-router-dom';
import { flushSync } from 'react-dom';
import {
  CheckCircle2,
  CircleAlert,
  History,
  ImageUp,
  Languages,
  LayoutGrid,
  Moon,
  PanelTop,
  RotateCcw,
  Save,
  Sun,
  X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, ConfirmDialog, FormDialog, FormField } from '@dwp-frontend/design-system';
import {
  DEFAULT_HOME_BACKGROUND_URL,
  getAdminHomeExperience,
  getHomeExperienceRevisions,
  publishHomeExperience,
  resolveAdminHomeBackgroundUrl,
  resolveHomeBackgroundUrl,
  rollbackHomeExperience,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatNumber } from '@dwp-frontend/shared-i18n';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { useCurrentProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { HOME_PREVIEW_VIEWPORTS, HomeExperiencePreview } from './home-experience-preview';
import {
  createHomeExperienceStudioForm,
  homeExperienceStudioLocales,
  homeExperienceDraftVersion,
  isHomeExperienceStudioFormEqual,
  resolveHomeExperiencePreviewCopy,
  shouldHydrateHomeExperienceDraft,
  toHomeExperienceUpdateRequest,
} from './home-experience-studio-model';

import type {
  HomeBackgroundPosition,
  HomeContentAlignment,
  HomeExperience,
  HomeExperienceRevision,
  LocalizedHomeCopy,
} from '@dwp-frontend/shared-utils';
import type { HomePreviewTheme, HomePreviewViewport } from './home-experience-preview';
import type { HomeExperienceStudioForm } from './home-experience-studio-model';
import {
  HomeExperienceRevisionHistory,
  homeExperienceRevisionScopes,
} from './home-experience-revision-history';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIN_IMAGE_WIDTH = 1920;
const MIN_IMAGE_HEIGHT = 480;
const MIN_IMAGE_RATIO = 2.4;
const MAX_IMAGE_RATIO = 6.5;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${formatNumber(bytes / (1024 * 1024), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
}

function localeLabel(locale: string, language: string): string {
  try {
    return (
      new Intl.DisplayNames([language], { type: 'language' }).of(locale) ?? locale.toUpperCase()
    );
  } catch {
    return locale.toUpperCase();
  }
}

export function HomeExperienceManager() {
  const { t, i18n } = useTranslation('admin');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const supportContext = useCurrentProviderSupportContext();
  const canWrite =
    !supportContext.data || supportContext.data.scopes.includes('TENANT_CONFIGURATION_WRITE');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const hydratedVersionRef = useRef<number | null>(null);
  const [form, setForm] = useState<HomeExperienceStudioForm | null>(null);
  const [baseline, setBaseline] = useState<HomeExperienceStudioForm | null>(null);
  const [editorLocale, setEditorLocale] = useState('ko');
  const [previewLocale, setPreviewLocale] = useState('ko');
  const [previewViewport, setPreviewViewport] = useState<HomePreviewViewport>('WIDE');
  const [previewTheme, setPreviewTheme] = useState<HomePreviewTheme>('LIGHT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDimensions, setSelectedDimensions] = useState<{ width: number; height: number }>();
  const [selectedFileError, setSelectedFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [backgroundResetRequested, setBackgroundResetRequested] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<HomeExperienceRevision | null>(null);
  const [pendingAdminPath, setPendingAdminPath] = useState<string | null>(null);
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
  const changed = Boolean(
    form &&
    baseline &&
    (!isHomeExperienceStudioFormEqual(form, baseline) || selectedFile || backgroundResetRequested)
  );
  const navigationBlocker = useBlocker(changed || busy);
  dirtyRef.current = changed;

  const clearSelectedFile = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setSelectedFile(null);
    setSelectedDimensions(undefined);
    setSelectedFileError(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const hydrate = useCallback(
    (nextExperience: HomeExperience) => {
      const next = createHomeExperienceStudioForm(nextExperience);
      setForm(next);
      setBaseline(next);
      setEditorLocale(next.defaultLocale);
      setPreviewLocale(next.defaultLocale);
      setBackgroundResetRequested(false);
      clearSelectedFile();
      hydratedVersionRef.current = nextExperience.version;
    },
    [clearSelectedFile]
  );

  useEffect(() => {
    if (
      experience &&
      shouldHydrateHomeExperienceDraft(
        hydratedVersionRef.current,
        experience.version,
        dirtyRef.current
      )
    )
      hydrate(experience);
  }, [experience, hydrate]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

  const refresh = async (next: HomeExperience) => {
    queryClient.setQueryData(['admin', 'home-experience'], next);
    hydrate(next);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['home-experience'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'home-experience', 'revisions'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
    ]);
  };

  const run = async (operation: () => Promise<HomeExperience>, successMessage: string) => {
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
    clearSelectedFile();
    setBackgroundResetRequested(false);
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setSelectedFileError(t('homeExperience.asset.errors.type'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setSelectedFileError(t('homeExperience.asset.errors.size'));
      return;
    }
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setSelectedFile(file);
    setPreviewUrl(url);
    const image = new Image();
    image.onload = () => {
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      setSelectedDimensions(dimensions);
      const ratio = dimensions.width / dimensions.height;
      if (dimensions.width < MIN_IMAGE_WIDTH || dimensions.height < MIN_IMAGE_HEIGHT)
        setSelectedFileError(t('homeExperience.asset.errors.dimensions'));
      else if (ratio < MIN_IMAGE_RATIO || ratio > MAX_IMAGE_RATIO)
        setSelectedFileError(t('homeExperience.asset.errors.ratio'));
    };
    image.onerror = () => setSelectedFileError(t('homeExperience.asset.errors.decode'));
    image.src = url;
  };

  if (experienceQuery.isLoading || (experience && !form))
    return <ManagementPanelLoading label={t('homeExperience.loading')} />;
  if (experienceQuery.isError || !experience || !form || !baseline)
    return (
      <ManagementPanelError
        message={errorMessage(experienceQuery.error, t('common.operationError'))}
      />
    );

  const locales = homeExperienceStudioLocales(form);
  const editorCopy = form.localizedContent[editorLocale];
  const fixedPreviewT = i18n.getFixedT(previewLocale, 'admin');
  const previewCopy = resolveHomeExperiencePreviewCopy(form, previewLocale, {
    headline: fixedPreviewT('homeExperience.previewHeadline'),
    subheadline: fixedPreviewT('homeExperience.previewMessage'),
  });
  const defaultCopy = form.localizedContent[form.defaultLocale];
  const activeBackgroundUrl = backgroundResetRequested
    ? DEFAULT_HOME_BACKGROUND_URL
    : previewUrl ||
      (supportContext.data
        ? resolveAdminHomeBackgroundUrl(experience)
        : resolveHomeBackgroundUrl(experience));
  const imageRatio = selectedDimensions
    ? selectedDimensions.width / selectedDimensions.height
    : experience.backgroundHeight
      ? (experience.backgroundWidth ?? 0) / experience.backgroundHeight
      : 0;
  const selectedImageValid = Boolean(
    selectedFile &&
    selectedDimensions &&
    !selectedFileError &&
    selectedFile.size <= MAX_IMAGE_BYTES &&
    selectedDimensions.width >= MIN_IMAGE_WIDTH &&
    selectedDimensions.height >= MIN_IMAGE_HEIGHT &&
    imageRatio >= MIN_IMAGE_RATIO &&
    imageRatio <= MAX_IMAGE_RATIO
  );
  const completeLocaleCount = locales.filter(
    (locale) =>
      form.localizedContent[locale]?.headline?.trim() &&
      form.localizedContent[locale]?.subheadline?.trim()
  ).length;
  const qualityChecks = [
    {
      pass: Boolean(defaultCopy?.headline?.trim() && defaultCopy?.subheadline?.trim()),
      blocking: true,
      label: t('homeExperience.quality.defaultCopy.label'),
      detail: t(
        defaultCopy?.headline?.trim() && defaultCopy?.subheadline?.trim()
          ? 'homeExperience.quality.defaultCopy.pass'
          : 'homeExperience.quality.defaultCopy.warning'
      ),
    },
    {
      pass: completeLocaleCount === locales.length,
      blocking: false,
      label: t('homeExperience.quality.locales.label'),
      detail: t('homeExperience.quality.locales.detail', {
        complete: completeLocaleCount,
        total: locales.length,
      }),
    },
    {
      pass: !selectedFile || selectedImageValid,
      blocking: true,
      label: t('homeExperience.quality.asset.label'),
      detail:
        selectedFileError ||
        (selectedFile && selectedDimensions
          ? t('homeExperience.quality.asset.pendingDimensions', {
              width: selectedDimensions.width,
              height: selectedDimensions.height,
              size: formatBytes(selectedFile.size),
            })
          : backgroundResetRequested || !experience.backgroundUrl
            ? t('homeExperience.quality.asset.builtIn')
            : t('homeExperience.quality.asset.dimensions', {
                width: experience.backgroundWidth,
                height: experience.backgroundHeight,
              })),
    },
    {
      pass:
        backgroundResetRequested ||
        !experience.backgroundUrl ||
        (imageRatio >= MIN_IMAGE_RATIO && imageRatio <= MAX_IMAGE_RATIO),
      blocking: Boolean(selectedFile),
      label: t('homeExperience.quality.safeArea.label'),
      detail: t('homeExperience.quality.safeArea.detail', {
        ratio: imageRatio ? imageRatio.toFixed(1) : t('homeExperience.quality.notAvailable'),
      }),
    },
    {
      pass: form.overlayOpacity >= 18,
      blocking: false,
      label: t('homeExperience.quality.readability.label'),
      detail: t('homeExperience.quality.readability.detail', { opacity: form.overlayOpacity }),
    },
  ];
  const publishBlocked = qualityChecks.some((check) => check.blocking && !check.pass);

  const updateCopy = (field: keyof LocalizedHomeCopy, value: string) =>
    setForm((current) =>
      current
        ? {
            ...current,
            localizedContent: {
              ...current.localizedContent,
              [editorLocale]: { ...current.localizedContent[editorLocale], [field]: value },
            },
          }
        : current
    );
  const discardDraft = () => {
    setForm(baseline);
    setEditorLocale(baseline.defaultLocale);
    setPreviewLocale(baseline.defaultLocale);
    setBackgroundResetRequested(false);
    clearSelectedFile();
  };
  const publishDraft = () => {
    if (!changed || publishBlocked) return;
    void run(async () => {
      return publishHomeExperience(
        toHomeExperienceUpdateRequest(
          form,
          homeExperienceDraftVersion(hydratedVersionRef.current, experience.version)
        ),
        selectedFile,
        backgroundResetRequested
      );
    }, t('homeExperience.toasts.published'));
  };

  const focalControl = (
    label: string,
    x: number,
    y: number,
    onX: (value: number) => void,
    onY: (value: number) => void
  ) => (
    <Box>
      <Typography component="h4" variant="subtitle2">
        {label}
      </Typography>
      <Stack direction="row" gap={2} sx={{ mt: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption">{t('homeExperience.fields.focalX')}</Typography>
          <Slider
            value={x}
            disabled={!canWrite}
            min={0}
            max={100}
            aria-label={`${label} ${t('homeExperience.fields.focalX')}`}
            onChange={(_event, value) => onX(value as number)}
            valueLabelDisplay="auto"
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption">{t('homeExperience.fields.focalY')}</Typography>
          <Slider
            value={y}
            disabled={!canWrite}
            min={0}
            max={100}
            aria-label={`${label} ${t('homeExperience.fields.focalY')}`}
            onChange={(_event, value) => onY(value as number)}
            valueLabelDisplay="auto"
          />
        </Box>
      </Stack>
    </Box>
  );

  return (
    <Box component="section" aria-labelledby="home-experience-heading">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
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
          <Chip
            size="small"
            color={changed ? 'warning' : 'success'}
            label={t(changed ? 'homeExperience.unsaved' : 'homeExperience.published')}
          />
          <Chip
            size="small"
            variant="outlined"
            label={t('homeExperience.version', { version: experience.version })}
          />
          {changed && (
            <ActionButton intent="quiet" startIcon={<RotateCcw size={17} />} onClick={discardDraft}>
              {t('homeExperience.actions.discardDraft')}
            </ActionButton>
          )}
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

      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          boxShadow: '0 14px 36px rgba(24,38,63,0.07)',
        }}
      >
        <Stack
          direction={{ xs: 'column', xl: 'row' }}
          alignItems={{ xs: 'stretch', xl: 'center' }}
          justifyContent="space-between"
          gap={1.5}
          sx={{ px: { xs: 2, md: 2.5 }, py: 1.75, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box>
            <Typography component="h3" variant="subtitle1" fontWeight={750}>
              {t('homeExperience.previewStudio.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('homeExperience.previewStudio.scope')}
            </Typography>
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <ToggleButtonGroup
              exclusive
              size="small"
              value={previewViewport}
              onChange={(_event, value: HomePreviewViewport | null) =>
                value && setPreviewViewport(value)
              }
              aria-label={t('homeExperience.previewStudio.viewportLabel')}
              sx={{ '& .MuiToggleButton-root': { minWidth: 44, minHeight: 44 } }}
            >
              {(Object.keys(HOME_PREVIEW_VIEWPORTS) as HomePreviewViewport[]).map((viewport) => (
                <ToggleButton key={viewport} value={viewport}>
                  {t(`homeExperience.previewStudio.viewports.${viewport}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={previewTheme}
              onChange={(_event, value: HomePreviewTheme | null) => value && setPreviewTheme(value)}
              aria-label={t('homeExperience.previewStudio.themeLabel')}
              sx={{ '& .MuiToggleButton-root': { minWidth: 44, minHeight: 44 } }}
            >
              <ToggleButton value="LIGHT">
                <Sun size={15} aria-hidden="true" />
                {t('homeExperience.previewStudio.themes.LIGHT')}
              </ToggleButton>
              <ToggleButton value="DARK">
                <Moon size={15} aria-hidden="true" />
                {t('homeExperience.previewStudio.themes.DARK')}
              </ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={previewLocale}
              onChange={(_event, value: string | null) => value && setPreviewLocale(value)}
              aria-label={t('homeExperience.previewStudio.localeLabel')}
              sx={{ '& .MuiToggleButton-root': { minWidth: 44, minHeight: 44 } }}
            >
              {locales.map((locale) => (
                <ToggleButton key={locale} value={locale}>
                  {locale.toUpperCase()}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
        </Stack>
        <Box sx={{ p: { xs: 1.5, md: 2.5 }, bgcolor: 'action.hover' }}>
          <HomeExperiencePreview
            experience={{ ...experience, backgroundPosition: form.backgroundPosition }}
            backgroundUrl={activeBackgroundUrl}
            headline={previewCopy.headline}
            subheadline={previewCopy.subheadline}
            viewport={previewViewport}
            theme={previewTheme}
            focalX={form.backgroundFocalX}
            focalY={form.backgroundFocalY}
            mobileFocalX={form.mobileBackgroundFocalX}
            mobileFocalY={form.mobileBackgroundFocalY}
            contentAlignment={form.contentAlignment}
            overlayOpacity={form.overlayOpacity}
            draft={changed}
            canvasLabel={t(
              'homeExperience.previewStudio.canvasSize',
              HOME_PREVIEW_VIEWPORTS[previewViewport]
            )}
            draftLabel={t('homeExperience.previewStudio.draftBadge')}
            publishedLabel={t('homeExperience.previewStudio.publishedBadge')}
            appDockLabel={t('homeExperience.previewDockTitle')}
            allAppsLabel={t('homeExperience.previewAllApps')}
            emptyAppsLabel={t('homeExperience.previewEmptyApps')}
            sampleDate={t('homeExperience.previewStudio.sampleDate')}
            metrics={[
              t('homeExperience.previewStudio.metrics.action'),
              t('homeExperience.previewStudio.metrics.timeline'),
              t('homeExperience.previewStudio.metrics.response'),
            ]}
          />
          {previewCopy.fallbackFields.length > 0 && previewCopy.sourceLocale && (
            <Alert severity="info" sx={{ maxWidth: 1320, mx: 'auto', mt: 1 }}>
              {t('homeExperience.previewStudio.fallbackNotice', {
                requested: localeLabel(previewLocale, i18n.language),
                resolved: localeLabel(previewCopy.sourceLocale, i18n.language),
                fields: previewCopy.fallbackFields
                  .map((field) =>
                    t(
                      field === 'headline'
                        ? 'homeExperience.fields.headline'
                        : 'homeExperience.fields.message'
                    )
                  )
                  .join(', '),
              })}
            </Alert>
          )}
          {previewCopy.builtInFallbackFields.length > 0 && (
            <Alert severity="info" sx={{ maxWidth: 1320, mx: 'auto', mt: 1 }}>
              {t('homeExperience.previewStudio.builtInFallbackNotice', {
                fields: previewCopy.builtInFallbackFields
                  .map((field) =>
                    t(
                      field === 'headline'
                        ? 'homeExperience.fields.headline'
                        : 'homeExperience.fields.message'
                    )
                  )
                  .join(', '),
              })}
            </Alert>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.45fr) minmax(320px, 0.55fr)' },
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
                  locale: localeLabel(editorLocale, i18n.language),
                })}
              </Typography>
            </Box>
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Languages size={17} aria-hidden="true" />
              <ToggleButtonGroup
                exclusive
                size="small"
                value={editorLocale}
                onChange={(_event, value: string | null) => value && setEditorLocale(value)}
                aria-label={t('homeExperience.editor.localeLabel')}
              >
                {locales.map((locale) => (
                  <ToggleButton key={locale} value={locale}>
                    {locale.toUpperCase()}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <ActionButton
                size="small"
                intent={form.defaultLocale === editorLocale ? 'primary' : 'secondary'}
                onClick={() => setForm({ ...form, defaultLocale: editorLocale })}
                disabled={!canWrite || form.defaultLocale === editorLocale}
              >
                {t(
                  form.defaultLocale === editorLocale
                    ? 'homeExperience.editor.defaultLocale'
                    : 'homeExperience.editor.makeDefault'
                )}
              </ActionButton>
            </Stack>
          </Stack>
          <Stack gap={2}>
            <FormField
              label={t('homeExperience.fields.headline')}
              value={editorCopy?.headline ?? ''}
              disabled={!canWrite}
              onChange={(event) => updateCopy('headline', event.target.value.slice(0, 160))}
              supportingText={`${editorCopy?.headline?.length ?? 0}/160`}
            />
            <FormField
              label={t('homeExperience.fields.message')}
              value={editorCopy?.subheadline ?? ''}
              disabled={!canWrite}
              onChange={(event) => updateCopy('subheadline', event.target.value.slice(0, 500))}
              supportingText={`${editorCopy?.subheadline?.length ?? 0}/500`}
              multiline
              minRows={3}
            />
          </Stack>
          <Divider />
          <Box>
            <Typography component="h3" variant="subtitle1">
              {t('homeExperience.asset.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('homeExperience.asset.description')}
            </Typography>
          </Box>
          <input
            ref={inputRef}
            hidden
            type="file"
            aria-describedby="home-experience-file-feedback"
            disabled={!canWrite}
            accept="image/png,image/jpeg"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} gap={1}>
            <ActionButton
              intent="secondary"
              startIcon={<ImageUp size={17} />}
              aria-describedby="home-experience-file-feedback"
              onClick={() => inputRef.current?.click()}
              disabled={busy || !canWrite}
            >
              {t('homeExperience.actions.chooseImage')}
            </ActionButton>
            {selectedFile && (
              <ActionButton intent="quiet" startIcon={<X size={17} />} onClick={clearSelectedFile}>
                {t('common.actions.discardSelection')}
              </ActionButton>
            )}
            <ActionButton
              intent="quiet"
              startIcon={<RotateCcw size={17} />}
              onClick={() => {
                clearSelectedFile();
                setBackgroundResetRequested(true);
              }}
              disabled={busy || !canWrite || (!experience.backgroundUrl && !selectedFile)}
            >
              {t('homeExperience.actions.stageRestore')}
            </ActionButton>
            <Box sx={{ minWidth: 0, ml: { md: 'auto' }, textAlign: { md: 'right' } }}>
              <Typography variant="body2" noWrap>
                {backgroundResetRequested
                  ? t('homeExperience.builtInBackground')
                  : selectedFile?.name ||
                    experience.backgroundOriginalName ||
                    t('homeExperience.builtInBackground')}
              </Typography>
              <Typography
                id="home-experience-file-feedback"
                variant="caption"
                color={selectedFileError ? 'error' : 'text.secondary'}
                role={selectedFileError ? 'alert' : undefined}
                aria-live={selectedFileError ? 'assertive' : 'polite'}
              >
                {selectedFileError ||
                  (selectedFile && selectedDimensions
                    ? t('common.file.metadata', {
                        width: selectedDimensions.width,
                        height: selectedDimensions.height,
                        size: formatBytes(selectedFile.size),
                      })
                    : experience.backgroundSizeBytes && !backgroundResetRequested
                      ? t('common.file.metadata', {
                          width: experience.backgroundWidth,
                          height: experience.backgroundHeight,
                          size: formatBytes(experience.backgroundSizeBytes),
                        })
                      : t('homeExperience.fileRequirements'))}
              </Typography>
            </Box>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 2.5,
            }}
          >
            <Box>
              <Typography component="h4" variant="subtitle2">
                {t('homeExperience.fields.contentAlignment')}
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={form.contentAlignment}
                disabled={!canWrite}
                aria-label={t('homeExperience.fields.contentAlignment')}
                onChange={(_event, value: HomeContentAlignment | null) =>
                  value && setForm({ ...form, contentAlignment: value })
                }
                sx={{ mt: 1 }}
              >
                {(['LEFT', 'CENTER', 'RIGHT'] as const).map((position) => (
                  <ToggleButton key={position} value={position}>
                    {t(`homeExperience.positions.${position}`)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Box>
              <Typography component="h4" variant="subtitle2">
                {t('homeExperience.fields.compatibilityPosition')}
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={form.backgroundPosition}
                disabled={!canWrite}
                aria-label={t('homeExperience.fields.compatibilityPosition')}
                onChange={(_event, value: HomeBackgroundPosition | null) =>
                  value && setForm({ ...form, backgroundPosition: value })
                }
                sx={{ mt: 1 }}
              >
                {(['LEFT', 'CENTER', 'RIGHT'] as const).map((position) => (
                  <ToggleButton key={position} value={position}>
                    {t(`homeExperience.positions.${position}`)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            {focalControl(
              t('homeExperience.fields.desktopFocalPoint'),
              form.backgroundFocalX,
              form.backgroundFocalY,
              (value) => setForm({ ...form, backgroundFocalX: value }),
              (value) => setForm({ ...form, backgroundFocalY: value })
            )}
            {focalControl(
              t('homeExperience.fields.mobileFocalPoint'),
              form.mobileBackgroundFocalX,
              form.mobileBackgroundFocalY,
              (value) => setForm({ ...form, mobileBackgroundFocalX: value }),
              (value) => setForm({ ...form, mobileBackgroundFocalY: value })
            )}
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
                onChange={(_event, value) => setForm({ ...form, overlayOpacity: value as number })}
                valueLabelDisplay="auto"
                aria-label={t('homeExperience.fields.overlay')}
                sx={{ mt: 1 }}
              />
            </Box>
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <ActionButton
              intent="primary"
              startIcon={<Save size={17} />}
              onClick={publishDraft}
              disabled={busy || !canWrite || !changed || publishBlocked}
            >
              {t('homeExperience.actions.publishDraft')}
            </ActionButton>
            <ActionButton
              intent="secondary"
              startIcon={<PanelTop size={17} />}
              disabled={busy}
              onClick={() => {
                if (changed) setPendingAdminPath('/admin/experience/home-composition');
                else navigate('/admin/experience/home-composition');
              }}
            >
              {t('homeExperience.actions.openComposition')}
            </ActionButton>
            <ActionButton
              intent="secondary"
              startIcon={<LayoutGrid size={17} />}
              disabled={busy}
              onClick={() => {
                if (changed) setPendingAdminPath('/admin/experience/home-apps');
                else navigate('/admin/experience/home-apps');
              }}
            >
              {t('homeExperience.actions.openApps')}
            </ActionButton>
          </Stack>
        </Stack>
        <Box component="aside" aria-labelledby="home-quality-heading">
          <Typography id="home-quality-heading" component="h3" variant="subtitle1">
            {t('homeExperience.quality.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('homeExperience.quality.description')}
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

      <HomeExperienceRevisionHistory
        open={historyOpen}
        revisions={historyQuery.data ?? []}
        loading={historyQuery.isLoading}
        error={historyQuery.isError}
        busy={busy}
        canWrite={canWrite}
        onClose={() => setHistoryOpen(false)}
        onRestore={setRestoreCandidate}
        onRetry={() => void historyQuery.refetch()}
      />
      <ConfirmDialog
        open={navigationBlocker.state === 'blocked'}
        title={t('homeExperience.navigationGuard.title')}
        description={t('homeExperience.navigationGuard.description')}
        cancelLabel={t('homeExperience.navigationGuard.keepEditing')}
        confirmLabel={t('homeExperience.navigationGuard.discardAndLeave')}
        intent="danger"
        onClose={() => navigationBlocker.reset?.()}
        onConfirm={() => navigationBlocker.proceed?.()}
      />
      <ConfirmDialog
        open={Boolean(pendingAdminPath)}
        title={t('homeExperience.navigationGuard.title')}
        description={t('homeExperience.navigationGuard.description')}
        cancelLabel={t('homeExperience.navigationGuard.keepEditing')}
        confirmLabel={t('homeExperience.navigationGuard.discardAndLeave')}
        intent="danger"
        onClose={() => setPendingAdminPath(null)}
        onConfirm={() => {
          if (!pendingAdminPath) return;
          const destination = pendingAdminPath;
          flushSync(() => {
            discardDraft();
            setPendingAdminPath(null);
          });
          navigate(destination);
        }}
      />
      <FormDialog
        open={Boolean(restoreCandidate)}
        title={t('homeExperience.restoreDialog.title')}
        description={t('homeExperience.restoreDialog.description')}
        cancelLabel={t('homeExperience.restoreDialog.cancel')}
        submitLabel={t('homeExperience.restoreDialog.confirm')}
        submittingLabel={t('homeExperience.restoreDialog.restoring')}
        submitIntent="danger"
        busy={busy}
        onClose={() => setRestoreCandidate(null)}
        onSubmit={async () => {
          if (!restoreCandidate) return;
          const revision = restoreCandidate;
          setRestoreCandidate(null);
          setHistoryOpen(false);
          await run(
            () => rollbackHomeExperience(revision.revisionId, experience.version),
            t('homeExperience.toasts.revisionRestored')
          );
        }}
      >
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('homeExperience.restoreDialog.warning')}
        </Alert>
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          {(restoreCandidate ? homeExperienceRevisionScopes(restoreCandidate) : []).map((scope) => (
            <Chip
              key={scope}
              size="small"
              variant="outlined"
              label={t(`homeExperience.history.scopes.${scope}`)}
            />
          ))}
        </Stack>
        {changed && (
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            {t('homeExperience.restoreDialog.unsavedWarning')}
          </Typography>
        )}
      </FormDialog>
    </Box>
  );
}
