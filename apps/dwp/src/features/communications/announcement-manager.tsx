import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, CopyPlus, Edit3, Eye, Image, Plus, Send } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveAnnouncement,
  createAnnouncement,
  listAdminAnnouncements,
  publishAnnouncement,
  updateAnnouncement,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  DetailInspector,
  GuidedEmptyState,
  OperationalKpiStrip,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { useCurrentProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';

import { AnnouncementDialog, definitionFrom, formFrom } from './announcement-dialog';

import type { Announcement } from '@dwp-frontend/shared-utils';

type AnnouncementPipelineState = 'ALL' | 'DRAFT' | 'LIVE' | 'SCHEDULED' | 'EXPIRED' | 'ARCHIVED';

function pipelineState(announcement: Announcement): Exclude<AnnouncementPipelineState, 'ALL'> {
  if (announcement.lifecycleState === 'DRAFT') return 'DRAFT';
  if (announcement.lifecycleState === 'ARCHIVED') return 'ARCHIVED';
  const now = Date.now();
  if (announcement.startsAt && Date.parse(announcement.startsAt) > now) return 'SCHEDULED';
  if (announcement.endsAt && Date.parse(announcement.endsAt) <= now) return 'EXPIRED';
  return 'LIVE';
}

function pipelineColor(state: Exclude<AnnouncementPipelineState, 'ALL'>) {
  if (state === 'LIVE') return 'success' as const;
  if (state === 'SCHEDULED') return 'info' as const;
  if (state === 'EXPIRED' || state === 'ARCHIVED') return 'warning' as const;
  return 'default' as const;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function displayDateTime(value: string): string {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });
}

function AnnouncementPreview({
  announcement,
  onClose,
}: {
  announcement: Announcement | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const accent = {
    INFO: 'info.main',
    SUCCESS: 'success.main',
    WARNING: 'warning.main',
    CRITICAL: 'error.main',
  }[announcement?.severity ?? 'INFO'];

  return (
    <DetailInspector
      open={Boolean(announcement)}
      variant="drawer"
      width={500}
      title={t('announcements.preview.title')}
      subtitle={announcement?.title}
      closeLabel={t('announcements.preview.close')}
      onClose={onClose}
      status={
        announcement ? (
          <Chip
            size="small"
            variant="outlined"
            color={pipelineColor(pipelineState(announcement))}
            label={t(`announcements.pipeline.${pipelineState(announcement)}`)}
          />
        ) : undefined
      }
    >
      {announcement && (
        <Stack gap={2.5}>
          <Box component="section" aria-labelledby="announcement-workspace-preview">
            <Typography id="announcement-workspace-preview" component="h3" variant="subtitle2">
              {t('announcements.preview.workspace')}
            </Typography>
            <Box
              sx={{
                mt: 1,
                height: 180,
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
                borderRadius: 1,
                bgcolor: 'action.hover',
                color: 'text.secondary',
              }}
            >
              {announcement.coverImageUrl ? (
                <Box
                  component="img"
                  src={announcement.coverImageUrl}
                  alt=""
                  sx={{ width: 1, height: 1, objectFit: 'cover' }}
                />
              ) : (
                <Image size={32} strokeWidth={1.5} aria-hidden="true" />
              )}
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '4px minmax(0, 1fr)',
                gap: 1.5,
                p: 1.5,
                borderTop: 1,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: 'action.hover',
              }}
            >
              <Box sx={{ width: 4, minHeight: 46, bgcolor: accent }} />
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mb: 0.75 }}>
                  <Chip
                    size="small"
                    label={t(
                      `announcements.contentTypes.${announcement.contentType ?? 'ANNOUNCEMENT'}`
                    )}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`announcements.categories.${announcement.categoryKey ?? 'COMPANY'}`)}
                  />
                  {announcement.featured && (
                    <Chip size="small" color="primary" label={t('announcements.featured')} />
                  )}
                </Stack>
                <Typography component="h4" variant="subtitle2">
                  {announcement.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {announcement.message}
                </Typography>
                {announcement.actionLabel && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={announcement.actionLabel}
                    sx={{ mt: 0.75 }}
                  />
                )}
              </Box>
            </Box>
          </Box>

          <Box component="section" aria-labelledby="announcement-delivery-evidence">
            <Typography id="announcement-delivery-evidence" component="h3" variant="subtitle2">
              {t('announcements.preview.delivery')}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                mt: 1,
                borderTop: 1,
                borderLeft: 1,
                borderColor: 'divider',
              }}
            >
              {[
                {
                  label: t('announcements.metrics.uniqueViewers'),
                  value: announcement.uniqueViewerCount ?? 0,
                },
                {
                  label: t('announcements.metrics.views'),
                  value: announcement.viewCount ?? 0,
                },
                {
                  label: t('announcements.metrics.actionClicks'),
                  value: announcement.actionClickCount ?? 0,
                },
                {
                  label: t('announcements.metrics.acknowledgements'),
                  value: announcement.acknowledgementCount ?? 0,
                },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{ p: 1.25, borderRight: 1, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {item.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.label}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              {t('announcements.preview.analyticsNotice')}
            </Typography>
          </Box>

          <Box component="section" aria-labelledby="announcement-governance-preview">
            <Typography id="announcement-governance-preview" component="h3" variant="subtitle2">
              {t('announcements.preview.governance')}
            </Typography>
            <Stack sx={{ mt: 1, borderTop: 1, borderColor: 'divider' }}>
              {[
                {
                  label: t('announcements.fields.audience'),
                  value:
                    announcement.audienceType === 'ALL'
                      ? t('announcements.audience.ALL')
                      : announcement.audienceValue,
                },
                {
                  label: t('announcements.fields.starts'),
                  value: announcement.startsAt
                    ? displayDateTime(announcement.startsAt)
                    : t('announcements.immediate'),
                },
                {
                  label: t('announcements.fields.ends'),
                  value: announcement.endsAt
                    ? displayDateTime(announcement.endsAt)
                    : t('announcements.openEnded'),
                },
                {
                  label: t('announcements.fields.publisher'),
                  value: announcement.publisherName ?? 'DWP Communications',
                },
                {
                  label: t('announcements.fields.acknowledgementRequired'),
                  value: announcement.acknowledgementRequired
                    ? t('announcements.values.required')
                    : t('announcements.values.optional'),
                },
                ...(announcement.acknowledgementRequired
                  ? [
                      {
                        label: t('announcements.fields.acknowledgementDue'),
                        value: announcement.acknowledgementDueAt
                          ? displayDateTime(announcement.acknowledgementDueAt)
                          : t('announcements.openEnded'),
                      },
                    ]
                  : []),
              ].map((item) => (
                <Stack
                  key={item.label}
                  direction="row"
                  justifyContent="space-between"
                  gap={2}
                  sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {item.label}
                  </Typography>
                  <Typography variant="body2" textAlign="right">
                    {item.value}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Stack>
      )}
    </DetailInspector>
  );
}

export function AnnouncementManager() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission, isLoaded: permissionsLoaded } = usePermissions();
  const supportContext = useCurrentProviderSupportContext();
  const supportWrite = supportContext.data?.scopes.includes('TENANT_CONFIGURATION_WRITE') ?? false;
  const useSupportPermissions = Boolean(supportContext.data);
  const canCreate = useSupportPermissions
    ? supportWrite
    : permissionsLoaded && hasPermission('ADMIN.COMMUNICATIONS', 'CREATE');
  const canUpdate = useSupportPermissions
    ? supportWrite
    : permissionsLoaded && hasPermission('ADMIN.COMMUNICATIONS', 'UPDATE');
  const canPublish = useSupportPermissions
    ? supportWrite
    : permissionsLoaded && hasPermission('ADMIN.COMMUNICATIONS', 'APPROVE');
  const canArchive = useSupportPermissions
    ? supportWrite
    : permissionsLoaded && hasPermission('ADMIN.COMMUNICATIONS', 'MANAGE');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [previewed, setPreviewed] = useState<Announcement | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState<AnnouncementPipelineState>('ALL');
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

  const announcements = useMemo(() => announcementsQuery.data ?? [], [announcementsQuery.data]);
  const filteredAnnouncements = useMemo(
    () =>
      pipelineFilter === 'ALL'
        ? announcements
        : announcements.filter((announcement) => pipelineState(announcement) === pipelineFilter),
    [announcements, pipelineFilter]
  );
  const pipelineCounts = useMemo(() => {
    const counts: Record<Exclude<AnnouncementPipelineState, 'ALL'>, number> = {
      DRAFT: 0,
      LIVE: 0,
      SCHEDULED: 0,
      EXPIRED: 0,
      ARCHIVED: 0,
    };
    announcements.forEach((announcement) => {
      counts[pipelineState(announcement)] += 1;
    });
    return counts;
  }, [announcements]);
  const uniqueViewers = announcements.reduce(
    (sum, announcement) => sum + (announcement.uniqueViewerCount ?? 0),
    0
  );

  if (announcementsQuery.isLoading) {
    return <ManagementPanelLoading label={t('announcements.loading')} />;
  }
  if (announcementsQuery.isError) {
    return (
      <ManagementPanelError
        message={errorMessage(announcementsQuery.error, t('common.operationError'))}
      />
    );
  }

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
        <ActionButton
          intent="primary"
          startIcon={<Plus size={17} />}
          disabled={!canCreate}
          onClick={() => {
            setSelected(null);
            setDialogOpen(true);
          }}
        >
          {t('announcements.actions.new')}
        </ActionButton>
      </Stack>

      <OperationalKpiStrip
        ariaLabel={t('announcements.metrics.label')}
        items={[
          {
            key: 'live',
            label: t('announcements.pipeline.LIVE'),
            value: pipelineCounts.LIVE,
            tone: pipelineCounts.LIVE ? 'success' : 'neutral',
            detail: t('announcements.metrics.currentlyVisible'),
          },
          {
            key: 'scheduled',
            label: t('announcements.pipeline.SCHEDULED'),
            value: pipelineCounts.SCHEDULED,
            tone: 'info',
            detail: t('announcements.metrics.awaitingWindow'),
          },
          {
            key: 'draft',
            label: t('announcements.pipeline.DRAFT'),
            value: pipelineCounts.DRAFT,
            tone: pipelineCounts.DRAFT ? 'warning' : 'neutral',
            detail: t('announcements.metrics.awaitingPublish'),
          },
          {
            key: 'viewers',
            label: t('announcements.metrics.uniqueViewers'),
            value: uniqueViewers,
            tone: 'info',
            detail: t('announcements.metrics.aggregateNotice'),
          },
        ]}
      />

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        gap={1}
        sx={{ py: 1.5 }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={pipelineFilter}
          onChange={(_, value: AnnouncementPipelineState | null) =>
            value && setPipelineFilter(value)
          }
          aria-label={t('announcements.pipeline.label')}
          sx={{ overflowX: 'auto', justifyContent: { xs: 'flex-start', md: 'initial' } }}
        >
          {(['ALL', 'DRAFT', 'LIVE', 'SCHEDULED', 'EXPIRED', 'ARCHIVED'] as const).map((state) => (
            <ToggleButton key={state} value={state} sx={{ whiteSpace: 'nowrap' }}>
              {t(`announcements.pipeline.${state}`)}
              <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                {state === 'ALL' ? announcements.length : pipelineCounts[state]}
              </Typography>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary">
          {t('announcements.pipeline.resultCount', { count: filteredAnnouncements.length })}
        </Typography>
      </Stack>

      {operationError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setOperationError(null)}>
          {operationError}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        {t('announcements.immutableNotice')}
      </Alert>

      <Box sx={{ overflowX: 'auto', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Table
          size="small"
          aria-label={t('announcements.table.label')}
          sx={{
            minWidth: 1080,
            tableLayout: 'fixed',
            '& .MuiTableRow-root': { height: 52 },
            '& .MuiTableCell-root': { py: 0.75, verticalAlign: 'middle' },
            '& .MuiIconButton-root': { width: 32, height: 32 },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell width="32%">{t('announcements.table.announcement')}</TableCell>
              <TableCell width={112}>{t('announcements.table.status')}</TableCell>
              <TableCell width={140}>{t('announcements.table.audience')}</TableCell>
              <TableCell width={220}>{t('announcements.table.window')}</TableCell>
              <TableCell width={150}>{t('announcements.table.engagement')}</TableCell>
              <TableCell width={176} align="right">
                {t('announcements.table.actions')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAnnouncements.map((announcement) => (
              <TableRow key={announcement.announcementId} hover>
                <TableCell>
                  <Typography variant="subtitle2" noWrap>
                    {announcement.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" noWrap>
                    {t(`announcements.severity.${announcement.severity}`)}
                    {announcement.pinned ? ` / ${t('announcements.pinned')}` : ''}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={t(`announcements.pipeline.${pipelineState(announcement)}`)}
                    color={pipelineColor(pipelineState(announcement))}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  {announcement.audienceType === 'ALL'
                    ? t('announcements.audience.ALL')
                    : announcement.audienceValue}
                </TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <Typography variant="caption" color="text.secondary" display="block" noWrap>
                    {announcement.startsAt
                      ? displayDateTime(announcement.startsAt)
                      : t('announcements.immediate')}
                    {' - '}
                    {announcement.endsAt
                      ? displayDateTime(announcement.endsAt)
                      : t('announcements.openEnded')}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {t('announcements.table.engagementValue', {
                      viewers: announcement.uniqueViewerCount ?? 0,
                      clicks: announcement.actionClickCount ?? 0,
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('announcements.table.viewsValue', {
                      count: announcement.viewCount ?? 0,
                    })}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <ActionIconButton
                    size="small"
                    label={t('announcements.actions.previewNamed', {
                      title: announcement.title,
                    })}
                    tooltip={t('announcements.actions.preview')}
                    onClick={() => setPreviewed(announcement)}
                  >
                    <Eye size={17} />
                  </ActionIconButton>
                  <ActionIconButton
                    size="small"
                    label={t('announcements.actions.duplicateNamed', {
                      title: announcement.title,
                    })}
                    tooltip={t('announcements.actions.duplicate')}
                    disabled={!canCreate || busy}
                    onClick={() =>
                      void run(
                        () =>
                          createAnnouncement({
                            ...definitionFrom(formFrom(announcement)),
                            title: t('announcements.copyTitle', {
                              title: announcement.title,
                            }).slice(0, 160),
                          }),
                        t('announcements.toasts.duplicated')
                      )
                    }
                  >
                    <CopyPlus size={17} />
                  </ActionIconButton>
                  <ActionIconButton
                    size="small"
                    label={t('announcements.actions.editNamed', {
                      title: announcement.title,
                    })}
                    tooltip={t('common.actions.edit')}
                    disabled={!canUpdate || busy || announcement.lifecycleState !== 'DRAFT'}
                    onClick={() => {
                      setSelected(announcement);
                      setDialogOpen(true);
                    }}
                  >
                    <Edit3 size={17} />
                  </ActionIconButton>
                  {announcement.lifecycleState === 'DRAFT' && (
                    <ActionIconButton
                      size="small"
                      intent="primary"
                      label={t('announcements.actions.publishNamed', {
                        title: announcement.title,
                      })}
                      tooltip={t('announcements.actions.publish')}
                      disabled={!canPublish || busy}
                      onClick={() =>
                        void run(
                          () =>
                            publishAnnouncement(announcement.announcementId, announcement.version),
                          t('announcements.toasts.published')
                        )
                      }
                    >
                      <Send size={17} />
                    </ActionIconButton>
                  )}
                  {announcement.lifecycleState !== 'ARCHIVED' && (
                    <ActionIconButton
                      size="small"
                      label={t('announcements.actions.archiveNamed', {
                        title: announcement.title,
                      })}
                      tooltip={t('announcements.actions.archive')}
                      disabled={!canArchive || busy}
                      onClick={() =>
                        void run(
                          () =>
                            archiveAnnouncement(announcement.announcementId, announcement.version),
                          t('announcements.toasts.archived')
                        )
                      }
                    >
                      <Archive size={17} />
                    </ActionIconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filteredAnnouncements.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ p: 0 }}>
                  <GuidedEmptyState
                    kind={announcements.length ? 'no-results' : 'first-use'}
                    title={t(
                      announcements.length
                        ? 'announcements.empty.filteredTitle'
                        : 'announcements.empty.title'
                    )}
                    description={t(
                      announcements.length
                        ? 'announcements.empty.filteredDescription'
                        : 'announcements.empty.description'
                    )}
                    actionLabel={
                      announcements.length
                        ? t('announcements.actions.showAll')
                        : canCreate
                          ? t('announcements.actions.new')
                          : undefined
                    }
                    onAction={
                      announcements.length
                        ? () => setPipelineFilter('ALL')
                        : canCreate
                          ? () => {
                              setSelected(null);
                              setDialogOpen(true);
                            }
                          : undefined
                    }
                    size="standard"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>

      <AnnouncementDialog
        key={selected?.announcementId ?? 'new'}
        open={dialogOpen && (selected ? canUpdate : canCreate)}
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
      <AnnouncementPreview announcement={previewed} onClose={() => setPreviewed(null)} />
    </Box>
  );
}
