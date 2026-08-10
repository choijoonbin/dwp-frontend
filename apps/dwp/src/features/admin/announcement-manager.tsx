import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, Edit3, Megaphone, Plus, Send, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveAnnouncement,
  createAnnouncement,
  listAdminAnnouncements,
  publishAnnouncement,
  updateAnnouncement,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';

import type {
  Announcement,
  AnnouncementAudienceType,
  AnnouncementDefinition,
  AnnouncementSeverity,
} from '@dwp-frontend/shared-utils';

type AnnouncementForm = {
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  audienceType: AnnouncementAudienceType;
  audienceValue: string;
  startsAt: string;
  endsAt: string;
  pinned: boolean;
  actionLabel: string;
  actionUrl: string;
};

const emptyForm: AnnouncementForm = {
  title: '',
  message: '',
  severity: 'INFO',
  audienceType: 'ALL',
  audienceValue: '',
  startsAt: '',
  endsAt: '',
  pinned: false,
  actionLabel: '',
  actionUrl: '',
};

const lifecycleColor = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  ARCHIVED: 'warning',
} as const;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function localDateTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoDateTime(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function displayDateTime(value: string): string {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });
}

function formFrom(announcement: Announcement): AnnouncementForm {
  return {
    title: announcement.title,
    message: announcement.message,
    severity: announcement.severity,
    audienceType: announcement.audienceType,
    audienceValue: announcement.audienceValue ?? '',
    startsAt: localDateTime(announcement.startsAt),
    endsAt: localDateTime(announcement.endsAt),
    pinned: announcement.pinned,
    actionLabel: announcement.actionLabel ?? '',
    actionUrl: announcement.actionUrl ?? '',
  };
}

function definitionFrom(form: AnnouncementForm): AnnouncementDefinition {
  return {
    title: form.title.trim(),
    message: form.message.trim(),
    severity: form.severity,
    audienceType: form.audienceType,
    audienceValue: form.audienceType === 'ROLE' ? form.audienceValue.trim() : null,
    startsAt: isoDateTime(form.startsAt),
    endsAt: isoDateTime(form.endsAt),
    pinned: form.pinned,
    actionLabel: form.actionLabel.trim() || null,
    actionUrl: form.actionUrl.trim() || null,
  };
}

function AnnouncementDialog({
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

  const reset = () => setForm(announcement ? formFrom(announcement) : emptyForm);

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="md"
      slotProps={{ transition: { onEnter: reset } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Megaphone size={19} strokeWidth={1.8} />
        <Box sx={{ flex: 1 }}>
          {announcement ? t('announcements.dialog.editTitle') : t('announcements.dialog.newTitle')}
        </Box>
        <IconButton aria-label={t('announcements.dialog.close')} onClick={onClose} disabled={busy}>
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack gap={2.25}>
          <TextField
            autoFocus
            required
            label={t('announcements.fields.title')}
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value.slice(0, 160) }))
            }
            helperText={`${form.title.length}/160`}
          />
          <TextField
            required
            multiline
            minRows={4}
            label={t('announcements.fields.message')}
            value={form.message}
            onChange={(event) =>
              setForm((current) => ({ ...current, message: event.target.value.slice(0, 1000) }))
            }
            helperText={`${form.message.length}/1000`}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <TextField
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
            </TextField>
            <TextField
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
            </TextField>
            {form.audienceType === 'ROLE' && (
              <TextField
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
            <TextField
              type="datetime-local"
              label={t('announcements.fields.starts')}
              value={form.startsAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, startsAt: event.target.value }))
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              type="datetime-local"
              label={t('announcements.fields.ends')}
              value={form.endsAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, endsAt: event.target.value }))
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label={t('announcements.fields.actionLabel')}
              value={form.actionLabel}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  actionLabel: event.target.value.slice(0, 80),
                }))
              }
            />
            <TextField
              label={t('announcements.fields.actionUrl')}
              value={form.actionUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  actionUrl: event.target.value.slice(0, 1000),
                }))
              }
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={() => onSubmit(form)}
          disabled={busy || !form.title.trim() || !form.message.trim()}
        >
          {announcement
            ? t('announcements.actions.saveChanges')
            : t('announcements.actions.createDraft')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function AnnouncementManager() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const announcementsQuery = useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: listAdminAnnouncements,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] }),
      queryClient.invalidateQueries({ queryKey: ['announcements'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
    ]);
  };

  const run = async (operation: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    setOperationError(null);
    try {
      await operation();
      await refresh();
      setDialogOpen(false);
      setSelected(null);
      toast.success(successMessage);
    } catch (error) {
      const message = errorMessage(error, t('common.operationError'));
      setOperationError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  if (announcementsQuery.isLoading) {
    return <AdminPanelLoading label={t('announcements.loading')} />;
  }
  if (announcementsQuery.isError) {
    return (
      <AdminPanelError
        message={errorMessage(announcementsQuery.error, t('common.operationError'))}
      />
    );
  }

  const announcements = announcementsQuery.data ?? [];

  return (
    <Box component="section" aria-labelledby="announcements-admin-heading">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={2}
        sx={{ py: 1.5 }}
      >
        <Box>
          <Typography id="announcements-admin-heading" component="h2" variant="h5">
            {t('announcements.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {t('announcements.description')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={17} />}
          onClick={() => {
            setSelected(null);
            setDialogOpen(true);
          }}
        >
          {t('announcements.actions.new')}
        </Button>
      </Stack>

      {operationError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setOperationError(null)}>
          {operationError}
        </Alert>
      )}

      <Box sx={{ overflowX: 'auto', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Table aria-label={t('announcements.table.label')}>
          <TableHead>
            <TableRow>
              <TableCell>{t('announcements.table.announcement')}</TableCell>
              <TableCell>{t('announcements.table.status')}</TableCell>
              <TableCell>{t('announcements.table.audience')}</TableCell>
              <TableCell>{t('announcements.table.window')}</TableCell>
              <TableCell align="right">{t('announcements.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {announcements.map((announcement) => (
              <TableRow key={announcement.announcementId} hover>
                <TableCell sx={{ minWidth: 280 }}>
                  <Typography variant="subtitle2">{announcement.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`announcements.severity.${announcement.severity}`)}
                    {announcement.pinned ? ` / ${t('announcements.pinned')}` : ''}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={t(`common.status.${announcement.lifecycleState}`)}
                    color={lifecycleColor[announcement.lifecycleState]}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  {announcement.audienceType === 'ALL'
                    ? t('announcements.audience.ALL')
                    : announcement.audienceValue}
                </TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <Typography variant="caption" color="text.secondary">
                    {announcement.startsAt
                      ? displayDateTime(announcement.startsAt)
                      : t('announcements.immediate')}
                    {' - '}
                    {announcement.endsAt
                      ? displayDateTime(announcement.endsAt)
                      : t('announcements.openEnded')}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title={t('common.actions.edit')}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={t('announcements.actions.editNamed', {
                          title: announcement.title,
                        })}
                        disabled={busy || announcement.lifecycleState === 'ARCHIVED'}
                        onClick={() => {
                          setSelected(announcement);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit3 size={17} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {announcement.lifecycleState === 'DRAFT' && (
                    <Tooltip title={t('announcements.actions.publish')}>
                      <span>
                        <IconButton
                          size="small"
                          color="primary"
                          aria-label={t('announcements.actions.publishNamed', {
                            title: announcement.title,
                          })}
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                publishAnnouncement(
                                  announcement.announcementId,
                                  announcement.version
                                ),
                              t('announcements.toasts.published')
                            )
                          }
                        >
                          <Send size={17} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  {announcement.lifecycleState !== 'ARCHIVED' && (
                    <Tooltip title={t('announcements.actions.archive')}>
                      <span>
                        <IconButton
                          size="small"
                          aria-label={t('announcements.actions.archiveNamed', {
                            title: announcement.title,
                          })}
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                archiveAnnouncement(
                                  announcement.announcementId,
                                  announcement.version
                                ),
                              t('announcements.toasts.archived')
                            )
                          }
                        >
                          <Archive size={17} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {announcements.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                  {t('announcements.noAnnouncements')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>

      <AnnouncementDialog
        key={selected?.announcementId ?? 'new'}
        open={dialogOpen}
        announcement={selected}
        busy={busy}
        onClose={() => setDialogOpen(false)}
        onSubmit={(form) =>
          void run(
            () =>
              selected
                ? updateAnnouncement(
                    selected.announcementId,
                    definitionFrom(form),
                    selected.version
                  )
                : createAnnouncement(definitionFrom(form)),
            selected ? t('announcements.toasts.updated') : t('announcements.toasts.created')
          )
        }
      />
    </Box>
  );
}
