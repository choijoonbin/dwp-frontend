import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageUp, RotateCcw, Save, Upload, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useToast,
  getAdminHomeExperience,
  resetHomeBackground,
  resolveAdminHomeBackgroundUrl,
  resolveHomeBackgroundUrl,
  updateHomeExperience,
  uploadHomeBackground,
} from '@dwp-frontend/shared-utils';
import { formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';
import { useCurrentProviderSupportContext } from '../provider/use-provider-support-context';

import type { HomeBackgroundPosition, HomeExperience } from '@dwp-frontend/shared-utils';

type FormState = {
  headline: string;
  subheadline: string;
  backgroundPosition: HomeBackgroundPosition;
  overlayOpacity: number;
};

const emptyForm: FormState = {
  headline: '',
  subheadline: '',
  backgroundPosition: 'CENTER',
  overlayOpacity: 18,
};

function formFrom(experience: HomeExperience): FormState {
  return {
    headline: experience.headline ?? '',
    subheadline: experience.subheadline ?? '',
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

export function HomeExperienceManager() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const supportContext = useCurrentProviderSupportContext();
  const canWrite =
    !supportContext.data || supportContext.data.scopes.includes('TENANT_CONFIGURATION_WRITE');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const experienceQuery = useQuery({
    queryKey: ['admin', 'home-experience'],
    queryFn: getAdminHomeExperience,
  });
  const experience = experienceQuery.data;

  useEffect(() => {
    if (experience) setForm(formFrom(experience));
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

  const refresh = async (next: HomeExperience) => {
    queryClient.setQueryData(['admin', 'home-experience'], next);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['home-experience'] }),
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
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const saveSettings = () => {
    if (!experience) return;
    void run(
      () =>
        updateHomeExperience({
          headline: form.headline.trim() || null,
          subheadline: form.subheadline.trim() || null,
          backgroundPosition: form.backgroundPosition,
          overlayOpacity: form.overlayOpacity,
          version: experience.version,
        }),
      t('homeExperience.toasts.saved')
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
        <Chip
          label={
            experience.backgroundUrl
              ? t('homeExperience.customBackground')
              : t('homeExperience.defaultBackground')
          }
          color={experience.backgroundUrl ? 'info' : 'default'}
          variant="outlined"
        />
      </Stack>

      {operationError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setOperationError(null)}>
          {operationError}
        </Alert>
      )}

      <Box
        aria-label={t('homeExperience.preview')}
        sx={{
          position: 'relative',
          minHeight: { xs: 260, md: 360 },
          overflow: 'hidden',
          color: '#FFFFFF',
          bgcolor: '#07163D',
          backgroundImage: `url(${activeBackgroundUrl})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `${form.backgroundPosition.toLowerCase()} center`,
          backgroundSize: 'cover',
          border: 1,
          borderColor: 'divider',
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
          sx={{
            position: 'absolute',
            inset: { xs: 'auto 16px 16px', md: 'auto 28px 28px' },
            maxWidth: 560,
            p: 2,
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 1,
            bgcolor: 'rgba(5,17,47,0.68)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <Typography component="p" variant="h5" color="inherit">
            {form.headline.trim() || t('homeExperience.previewHeadline')}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.75, color: 'rgba(255,255,255,0.76)' }}>
            {form.subheadline.trim() || t('homeExperience.previewMessage')}
          </Typography>
        </Box>
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
          accept="image/png,image/jpeg"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        <Button
          variant="outlined"
          startIcon={<ImageUp size={17} strokeWidth={1.8} />}
          onClick={() => inputRef.current?.click()}
          disabled={busy || !canWrite}
        >
          {t('homeExperience.actions.chooseImage')}
        </Button>
        {selectedFile && (
          <Button
            variant="contained"
            startIcon={<Upload size={17} strokeWidth={1.8} />}
            onClick={upload}
            disabled={busy || !canWrite}
          >
            {t('homeExperience.actions.upload')}
          </Button>
        )}
        <Button
          variant="text"
          color="inherit"
          startIcon={selectedFile ? <X size={17} /> : <RotateCcw size={17} />}
          onClick={resetBackground}
          disabled={busy || !canWrite || (!selectedFile && !experience.backgroundUrl)}
        >
          {selectedFile
            ? t('common.actions.discardSelection')
            : t('homeExperience.actions.restore')}
        </Button>
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

      <Divider />

      <Box
        sx={{
          py: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)' },
          gap: 3,
        }}
      >
        <Stack gap={2}>
          <TextField
            label={t('homeExperience.fields.headline')}
            value={form.headline}
            disabled={!canWrite}
            onChange={(event) =>
              setForm((current) => ({ ...current, headline: event.target.value.slice(0, 160) }))
            }
            helperText={`${form.headline.length}/160`}
          />
          <TextField
            label={t('homeExperience.fields.message')}
            value={form.subheadline}
            disabled={!canWrite}
            onChange={(event) =>
              setForm((current) => ({ ...current, subheadline: event.target.value.slice(0, 500) }))
            }
            helperText={`${form.subheadline.length}/500`}
            multiline
            minRows={3}
          />
        </Stack>

        <Stack gap={3}>
          <Box>
            <Typography component="h3" variant="subtitle2">
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
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Typography component="h3" variant="subtitle2">
                {t('homeExperience.fields.overlay')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {form.overlayOpacity}%
              </Typography>
            </Box>
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

          <Button
            variant="contained"
            startIcon={<Save size={17} strokeWidth={1.8} />}
            onClick={saveSettings}
            disabled={busy || !canWrite || !changed}
            sx={{ alignSelf: { sm: 'flex-start' } }}
          >
            {t('homeExperience.actions.save')}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
