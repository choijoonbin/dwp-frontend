import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Edit3, ShieldCheck } from 'lucide-react';
import { DateTimePickerField, FormDialog, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import { useSystemCodeOptions } from '../../components/use-system-code-options';

import type {
  Announcement,
  AnnouncementAudienceType,
  AnnouncementContentType,
  AnnouncementDefinition,
  AnnouncementSeverity,
} from '@dwp-frontend/shared-utils';

export type AnnouncementForm = {
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  audienceType: AnnouncementAudienceType;
  audienceValue: string;
  startsAt: string | null;
  endsAt: string | null;
  pinned: boolean;
  actionLabel: string;
  actionUrl: string;
  contentType: AnnouncementContentType;
  categoryKey: string;
  body: string;
  coverImageUrl: string;
  publisherName: string;
  featured: boolean;
  acknowledgementRequired: boolean;
  acknowledgementDueAt: string | null;
  dismissible: boolean;
  readingMinutes: number;
  sourceLocale: string;
};

const contentTypeValues: readonly AnnouncementContentType[] = [
  'ANNOUNCEMENT',
  'NEWS',
  'EVENT',
  'POLICY_UPDATE',
];

const categoryValues = [
  'COMPANY',
  'INNOVATION',
  'CULTURE',
  'SECURITY',
  'LEADERSHIP',
  'GROWTH',
] as const;

const coverAssets = [
  '',
  '/media/communications/innovation-lab.jpg',
  '/media/communications/community-day.jpg',
  '/media/communications/security-readiness.jpg',
] as const;

const emptyForm: AnnouncementForm = {
  title: '',
  message: '',
  severity: 'INFO',
  audienceType: 'ALL',
  audienceValue: '',
  startsAt: null,
  endsAt: null,
  pinned: false,
  actionLabel: '',
  actionUrl: '',
  contentType: 'ANNOUNCEMENT',
  categoryKey: 'COMPANY',
  body: '',
  coverImageUrl: '',
  publisherName: 'DWP Communications',
  featured: false,
  acknowledgementRequired: false,
  acknowledgementDueAt: null,
  dismissible: true,
  readingMinutes: 2,
  sourceLocale: 'ko',
};

export function formFrom(announcement: Announcement): AnnouncementForm {
  return {
    title: announcement.title,
    message: announcement.message,
    severity: announcement.severity,
    audienceType: announcement.audienceType,
    audienceValue: announcement.audienceValue ?? '',
    startsAt: announcement.startsAt ?? null,
    endsAt: announcement.endsAt ?? null,
    pinned: announcement.pinned,
    actionLabel: announcement.actionLabel ?? '',
    actionUrl: announcement.actionUrl ?? '',
    contentType: announcement.contentType ?? 'ANNOUNCEMENT',
    categoryKey: announcement.categoryKey ?? 'COMPANY',
    body: announcement.body ?? '',
    coverImageUrl: announcement.coverImageUrl ?? '',
    publisherName: announcement.publisherName ?? 'DWP Communications',
    featured: announcement.featured ?? false,
    acknowledgementRequired: announcement.acknowledgementRequired ?? false,
    acknowledgementDueAt: announcement.acknowledgementDueAt ?? null,
    dismissible: announcement.dismissible ?? true,
    readingMinutes: announcement.readingMinutes ?? 2,
    sourceLocale: announcement.sourceLocale ?? 'ko',
  };
}

export function definitionFrom(form: AnnouncementForm): AnnouncementDefinition {
  return {
    title: form.title.trim(),
    message: form.message.trim(),
    severity: form.severity,
    audienceType: form.audienceType,
    audienceValue: form.audienceType === 'ROLE' ? form.audienceValue.trim() : null,
    startsAt: form.startsAt,
    endsAt: form.endsAt,
    pinned: form.pinned,
    actionLabel: form.actionLabel.trim() || null,
    actionUrl: form.actionUrl.trim() || null,
    contentType: form.contentType,
    categoryKey: form.categoryKey.trim().toUpperCase(),
    body: form.body.trim() || null,
    coverImageUrl: form.coverImageUrl.trim() || null,
    publisherName: form.publisherName.trim(),
    featured: form.featured,
    acknowledgementRequired: form.acknowledgementRequired,
    acknowledgementDueAt: form.acknowledgementRequired ? form.acknowledgementDueAt : null,
    dismissible: form.acknowledgementRequired ? false : form.dismissible,
    readingMinutes: form.readingMinutes,
    sourceLocale: form.sourceLocale.trim(),
  };
}

export function AnnouncementDialog({
  open,
  announcement,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  announcement: Announcement | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (form: AnnouncementForm) => void;
}) {
  const { t } = useTranslation('admin');
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);
  const registeredContentTypes = useSystemCodeOptions(
    'PLATFORM.COMMUNICATION.CONTENT_TYPE',
    contentTypeValues
  );
  const registeredCategories = useSystemCodeOptions(
    'PLATFORM.COMMUNICATION.CATEGORY',
    categoryValues
  );
  const invalidWindow = Boolean(
    form.startsAt && form.endsAt && Date.parse(form.startsAt) > Date.parse(form.endsAt)
  );
  const invalidAction = Boolean(form.actionLabel.trim()) !== Boolean(form.actionUrl.trim());
  const invalidCategory = !/^[A-Z][A-Z0-9_]{1,39}$/.test(form.categoryKey.trim().toUpperCase());
  const invalidLocale = !/^[a-z]{2}(-[A-Z]{2})?$/.test(form.sourceLocale.trim());

  useEffect(() => {
    if (open) setForm(announcement ? formFrom(announcement) : emptyForm);
  }, [announcement, open]);

  return (
    <FormDialog
      open={open}
      title={
        announcement ? t('announcements.dialog.editTitle') : t('announcements.dialog.newTitle')
      }
      cancelLabel={t('common.actions.cancel')}
      submitLabel={
        announcement
          ? t('announcements.actions.saveChanges')
          : t('announcements.actions.createDraft')
      }
      busy={busy}
      onClose={onClose}
      onSubmit={() => onSubmit(form)}
      submitDisabled={
        invalidWindow ||
        invalidAction ||
        invalidCategory ||
        invalidLocale ||
        !form.title.trim() ||
        !form.message.trim() ||
        !form.publisherName.trim()
      }
      maxWidth="lg"
    >
      <Stack gap={3}>
        <Box component="section" aria-labelledby="announcement-editorial-fields">
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.75 }}>
            <Edit3 size={17} aria-hidden="true" />
            <Typography id="announcement-editorial-fields" component="h3" variant="subtitle2">
              {t('announcements.sections.editorial')}
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <FormField
              select
              autoFocus
              label={t('announcements.fields.contentType')}
              value={form.contentType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contentType: event.target.value as AnnouncementContentType,
                }))
              }
            >
              {registeredContentTypes.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`announcements.contentTypes.${value}`)}
                </MenuItem>
              ))}
            </FormField>
            <FormField
              select
              label={t('announcements.fields.category')}
              value={form.categoryKey}
              errorMessage={invalidCategory ? t('announcements.fields.invalidCategory') : undefined}
              onChange={(event) =>
                setForm((current) => ({ ...current, categoryKey: event.target.value }))
              }
            >
              {registeredCategories.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`announcements.categories.${value}`)}
                </MenuItem>
              ))}
            </FormField>
            <FormField
              required
              label={t('announcements.fields.publisher')}
              value={form.publisherName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  publisherName: event.target.value.slice(0, 160),
                }))
              }
            />
            <FormField
              required
              label={t('announcements.fields.sourceLocale')}
              value={form.sourceLocale}
              errorMessage={invalidLocale ? t('announcements.fields.invalidLocale') : undefined}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sourceLocale: event.target.value.slice(0, 16),
                }))
              }
            />
            <FormField
              required
              label={t('announcements.fields.title')}
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value.slice(0, 160) }))
              }
              supportingText={`${form.title.length}/160`}
              sx={{ gridColumn: { md: '1 / -1' } }}
            />
            <FormField
              required
              multiline
              minRows={2}
              label={t('announcements.fields.message')}
              value={form.message}
              onChange={(event) =>
                setForm((current) => ({ ...current, message: event.target.value.slice(0, 1000) }))
              }
              supportingText={`${form.message.length}/1000`}
              sx={{ gridColumn: { md: '1 / -1' } }}
            />
            <FormField
              multiline
              minRows={7}
              label={t('announcements.fields.body')}
              value={form.body}
              onChange={(event) =>
                setForm((current) => ({ ...current, body: event.target.value.slice(0, 20000) }))
              }
              supportingText={`${form.body.length}/20000`}
              sx={{ gridColumn: { md: '1 / -1' } }}
            />
            <FormField
              select
              label={t('announcements.fields.coverAsset')}
              value={form.coverImageUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, coverImageUrl: event.target.value }))
              }
            >
              {coverAssets.map((value) => (
                <MenuItem key={value || 'none'} value={value}>
                  {t(
                    `announcements.coverAssets.${value ? value.split('/').pop()?.split('.')[0] : 'none'}`
                  )}
                </MenuItem>
              ))}
            </FormField>
            <FormField
              type="number"
              label={t('announcements.fields.readingMinutes')}
              value={form.readingMinutes}
              slotProps={{ htmlInput: { min: 1, max: 60 } }}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  readingMinutes: Math.min(60, Math.max(1, Number(event.target.value) || 1)),
                }))
              }
            />
            {form.coverImageUrl && (
              <Box
                component="img"
                src={form.coverImageUrl}
                alt=""
                sx={{
                  gridColumn: { md: '1 / -1' },
                  width: 1,
                  maxHeight: 230,
                  objectFit: 'cover',
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                }}
              />
            )}
          </Box>
        </Box>

        <Box component="section" aria-labelledby="announcement-delivery-fields">
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.75 }}>
            <ShieldCheck size={17} aria-hidden="true" />
            <Typography id="announcement-delivery-fields" component="h3" variant="subtitle2">
              {t('announcements.sections.delivery')}
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <FormField
              select
              label={t('announcements.fields.severity')}
              value={form.severity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  severity: event.target.value as AnnouncementSeverity,
                }))
              }
            >
              {['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'].map((severity) => (
                <MenuItem key={severity} value={severity}>
                  {t(`announcements.severity.${severity}`)}
                </MenuItem>
              ))}
            </FormField>
            <FormField
              select
              label={t('announcements.fields.audience')}
              value={form.audienceType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  audienceType: event.target.value as AnnouncementAudienceType,
                }))
              }
            >
              <MenuItem value="ALL">{t('announcements.audience.ALL')}</MenuItem>
              <MenuItem value="ROLE">{t('announcements.audience.ROLE')}</MenuItem>
            </FormField>
            {form.audienceType === 'ROLE' && (
              <FormField
                required
                label={t('announcements.fields.roleKey')}
                value={form.audienceValue}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    audienceValue: event.target.value.toUpperCase().slice(0, 80),
                  }))
                }
              />
            )}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              gap={{ xs: 0, sm: 2 }}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={form.featured}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, featured: event.target.checked }))
                    }
                  />
                }
                label={t('announcements.fields.featured')}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.pinned}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, pinned: event.target.checked }))
                    }
                  />
                }
                label={t('announcements.fields.pinned')}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.dismissible}
                    disabled={form.acknowledgementRequired}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dismissible: event.target.checked }))
                    }
                  />
                }
                label={t('announcements.fields.dismissible')}
              />
            </Stack>
            <DateTimePickerField
              label={t('announcements.fields.starts')}
              value={form.startsAt}
              onValueChange={(startsAt) => setForm((current) => ({ ...current, startsAt }))}
              minutesStep={5}
            />
            <DateTimePickerField
              label={t('announcements.fields.ends')}
              value={form.endsAt}
              onValueChange={(endsAt) => setForm((current) => ({ ...current, endsAt }))}
              errorMessage={
                invalidWindow ? t('announcements.fields.invalidScheduleWindow') : undefined
              }
              minutesStep={5}
            />
            <FormControlLabel
              sx={{ alignSelf: 'center' }}
              control={
                <Switch
                  checked={form.acknowledgementRequired}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      acknowledgementRequired: event.target.checked,
                      acknowledgementDueAt: event.target.checked
                        ? current.acknowledgementDueAt
                        : null,
                      dismissible: event.target.checked ? false : current.dismissible,
                    }))
                  }
                />
              }
              label={t('announcements.fields.acknowledgementRequired')}
            />
            <DateTimePickerField
              label={t('announcements.fields.acknowledgementDue')}
              value={form.acknowledgementDueAt}
              onValueChange={(acknowledgementDueAt) =>
                setForm((current) => ({ ...current, acknowledgementDueAt }))
              }
              disabled={!form.acknowledgementRequired}
              minutesStep={5}
            />
          </Box>
        </Box>

        <Box component="section" aria-labelledby="announcement-action-fields">
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.75 }}>
            <CheckCircle2 size={17} aria-hidden="true" />
            <Typography id="announcement-action-fields" component="h3" variant="subtitle2">
              {t('announcements.sections.action')}
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <FormField
              label={t('announcements.fields.actionLabel')}
              value={form.actionLabel}
              errorMessage={invalidAction ? t('announcements.fields.invalidAction') : undefined}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  actionLabel: event.target.value.slice(0, 80),
                }))
              }
            />
            <FormField
              label={t('announcements.fields.actionUrl')}
              value={form.actionUrl}
              errorMessage={invalidAction ? t('announcements.fields.invalidAction') : undefined}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  actionUrl: event.target.value.slice(0, 1000),
                }))
              }
            />
          </Box>
        </Box>
      </Stack>
    </FormDialog>
  );
}
