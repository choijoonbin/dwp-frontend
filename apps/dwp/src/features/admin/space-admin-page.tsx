import { useDeferredValue, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  FileCheck2,
  LayoutTemplate,
  Layers3,
  Plus,
  Route,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  FormDialog,
  FormField,
  OperationalKpiStrip,
} from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import {
  createSpaceTemplate,
  decideSpaceLifecycle,
  decideSpacePublication,
  decideSpaceRequest,
  getSpaceAdminOverview,
  getSpaceAdminRequests,
  getSpaceAdminSpaces,
  getSpaceAdminTemplates,
  getSpaceLifecycleReviews,
  getSpacePublicationReviews,
  updateSpaceTemplate,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { SpaceGlyph, SpaceStatusChip, localizedSpace } from '../../components/spaces/space-ui';
import { TemplateDialog, type TemplateForm } from './space-template-dialog';

import type {
  SpaceLifecycleReview,
  SpacePublicationReview,
  SpaceRequest,
  SpaceTemplate,
} from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

function SectionHeading({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      gap={1.5}
      sx={{ mt: 3, mb: 1.5 }}
    >
      <Stack direction="row" gap={1.25} alignItems="center">
        <Box
          sx={{
            width: 36,
            height: 36,
            display: 'grid',
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: 'action.selected',
            borderRadius: 1,
          }}
        >
          <Icon size={18} />
        </Box>
        <Box>
          <Typography component="h2" variant="h6">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
      </Stack>
      {action}
    </Stack>
  );
}

function DecisionDialog({
  open,
  title,
  description,
  busy,
  approveLabel,
  rejectLabel,
  onClose,
  onDecision,
}: {
  open: boolean;
  title: string;
  description: string;
  busy: boolean;
  approveLabel: string;
  rejectLabel: string;
  onClose: () => void;
  onDecision: (decision: 'APPROVE' | 'REJECT', note: string) => void;
}) {
  const { t } = useTranslation('admin');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) setNote('');
  }, [open]);
  return (
    <FormDialog
      open={open}
      title={title}
      description={description}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={approveLabel}
      submittingLabel={approveLabel}
      busy={busy}
      submitDisabled={note.trim().length < 5}
      maxWidth="sm"
      onClose={onClose}
      onSubmit={() => onDecision('APPROVE', note)}
      secondaryActions={
        <ActionButton
          intent="danger"
          disabled={note.trim().length < 5 || busy}
          onClick={() => onDecision('REJECT', note)}
        >
          {rejectLabel}
        </ActionButton>
      }
    >
      <FormField
        autoFocus
        multiline
        minRows={4}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        label={t('spaces.decision.note')}
        supportingText={t('spaces.decision.noteHelp')}
        inputProps={{ maxLength: 2000 }}
        sx={{ mt: 2 }}
      />
    </FormDialog>
  );
}

export function SpaceAdminOverview() {
  const { t, i18n } = useTranslation(['admin', 'spaces']);
  const navigate = useNavigate();
  const overview = useQuery({
    queryKey: ['spaces', 'admin', 'overview'],
    queryFn: getSpaceAdminOverview,
    staleTime: 20_000,
  });
  if (overview.isLoading) return <Skeleton variant="rounded" height={420} sx={{ mt: 3 }} />;
  if (overview.isError || !overview.data) {
    return (
      <Alert severity="error" sx={{ mt: 3 }}>
        {t('admin:spaces.common.loadError')}
      </Alert>
    );
  }
  const data = overview.data;
  const korean = (i18n.resolvedLanguage ?? i18n.language).startsWith('ko');
  return (
    <Box>
      <OperationalKpiStrip
        ariaLabel={t('admin:spaces.overview.metricsLabel')}
        items={[
          {
            key: 'active',
            label: t('admin:spaces.metrics.activeSpaces'),
            value: formatNumber(data.metrics.activeSpaces),
            tone: 'success',
          },
          {
            key: 'restricted',
            label: t('admin:spaces.metrics.restrictedSpaces'),
            value: formatNumber(data.metrics.restrictedSpaces),
            tone: 'warning',
          },
          {
            key: 'requests',
            label: t('admin:spaces.metrics.pendingRequests'),
            value: formatNumber(data.metrics.pendingCreationRequests),
            tone: data.metrics.pendingCreationRequests ? 'warning' : 'neutral',
            onSelect: () => navigate('/admin/spaces/requests'),
          },
          {
            key: 'publication',
            label: t('admin:spaces.metrics.pendingReviews'),
            value: formatNumber(data.metrics.pendingPublicationReviews),
            tone: data.metrics.pendingPublicationReviews ? 'warning' : 'neutral',
            onSelect: () => navigate('/admin/spaces/content-reviews'),
          },
          {
            key: 'overdue',
            label: t('admin:spaces.metrics.overdueLifecycle'),
            value: formatNumber(data.metrics.overdueLifecycleReviews),
            tone: data.metrics.overdueLifecycleReviews ? 'critical' : 'neutral',
            onSelect: () => navigate('/admin/spaces/lifecycle'),
          },
          {
            key: 'memberships',
            label: t('admin:spaces.metrics.activeMemberships'),
            value: formatNumber(data.metrics.activeMemberships),
            tone: 'info',
          },
        ]}
      />
      <Box
        sx={{
          mt: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.4fr) minmax(320px, 0.8fr)' },
          gap: 2,
        }}
      >
        <Paper component="section" variant="outlined" sx={{ borderRadius: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
            <Box>
              <Typography component="h2" variant="h6">
                {t('admin:spaces.overview.priorityTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('admin:spaces.overview.priorityDescription')}
              </Typography>
            </Box>
            <ActionButton
              intent="quiet"
              endIcon={<ArrowRight size={16} />}
              onClick={() => navigate('/admin/spaces/requests')}
            >
              {t('admin:spaces.actions.openQueue')}
            </ActionButton>
          </Stack>
          <Divider />
          <Stack divider={<Divider flexItem />}>
            {data.priorityRequests.slice(0, 5).map((request) => (
              <Box key={request.requestId} sx={{ px: 2, py: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={750}>
                      {request.requestedName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {request.requesterName ?? t('admin:spaces.common.unknownRequester')} ·{' '}
                      {korean ? request.templateNameKo : request.templateNameEn}
                    </Typography>
                  </Box>
                  <Stack direction="row" gap={0.75} alignItems="center">
                    <Chip
                      size="small"
                      color={request.riskLevel === 'HIGH' ? 'error' : 'default'}
                      variant="outlined"
                      label={t(`spaces:risk.${request.riskLevel}`)}
                    />
                    <SpaceStatusChip value={request.status} />
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>
        <Paper
          component="section"
          elevation={0}
          sx={{
            p: 2.5,
            color: '#EAF2F5',
            bgcolor: '#172A33',
            border: 1,
            borderColor: '#31515E',
            borderRadius: 1,
          }}
        >
          <Stack direction="row" gap={1} alignItems="center">
            <ShieldCheck size={18} color="#82D5C8" />
            <Typography component="h2" variant="h6">
              {t('admin:spaces.overview.postureTitle')}
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ mt: 0.75, color: 'rgba(234,242,245,0.68)' }}>
            {t('admin:spaces.overview.postureDescription')}
          </Typography>
          <Stack gap={1.5} sx={{ mt: 2.5 }}>
            {[
              [t('admin:spaces.metrics.pendingReviews'), data.metrics.pendingPublicationReviews],
              [t('admin:spaces.metrics.overdueLifecycle'), data.metrics.overdueLifecycleReviews],
              [t('admin:spaces.metrics.restrictedSpaces'), data.metrics.restrictedSpaces],
            ].map(([label, value]) => (
              <Stack
                key={String(label)}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="body2" sx={{ color: 'rgba(234,242,245,0.78)' }}>
                  {label}
                </Typography>
                <Typography fontWeight={800}>{value}</Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}

export function SpaceAdminDirectory() {
  const { t, i18n } = useTranslation(['admin', 'spaces']);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const spaces = useQuery({
    queryKey: ['spaces', 'admin', 'directory', deferredQuery],
    queryFn: () => getSpaceAdminSpaces(deferredQuery),
  });
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (
    <Box>
      <SectionHeading
        icon={Layers3}
        title={t('admin:spaces.directory.title')}
        description={t('admin:spaces.directory.description')}
        action={
          <FormField
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            label={t('admin:spaces.directory.search')}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: 1, sm: 320 } }}
          />
        }
      />
      {spaces.isLoading ? (
        <Skeleton variant="rounded" height={380} />
      ) : spaces.isError ? (
        <Alert severity="error">{t('admin:spaces.common.loadError')}</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
          <Table aria-label={t('admin:spaces.directory.tableLabel')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin:spaces.columns.space')}</TableCell>
                <TableCell>{t('admin:spaces.columns.purpose')}</TableCell>
                <TableCell>{t('admin:spaces.columns.visibility')}</TableCell>
                <TableCell>{t('admin:spaces.columns.classification')}</TableCell>
                <TableCell align="right">{t('admin:spaces.columns.members')}</TableCell>
                <TableCell>{t('admin:spaces.columns.activity')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {spaces.data?.map((space) => {
                const label = localizedSpace(space, language);
                return (
                  <TableRow key={space.spaceId} hover>
                    <TableCell>
                      <Stack direction="row" gap={1.25} alignItems="center">
                        <SpaceGlyph
                          iconKey={space.iconKey}
                          accentToken={space.accentToken}
                          size={34}
                        />
                        <Box>
                          <Typography variant="body2" fontWeight={750}>
                            {label.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {space.spaceKey}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{t(`admin:spaces.purpose.${space.purposeType}`)}</TableCell>
                    <TableCell>{t(`spaces:visibility.${space.visibility}`)}</TableCell>
                    <TableCell>{t(`spaces:classification.${space.dataClassification}`)}</TableCell>
                    <TableCell align="right">{formatNumber(space.memberCount)}</TableCell>
                    <TableCell>
                      {formatDate(space.lastActivityAt, { dateStyle: 'medium' })}
                    </TableCell>
                    <TableCell align="right">
                      <ActionButton
                        intent="quiet"
                        size="small"
                        onClick={() => navigate(`/spaces/${space.spaceKey}/overview`)}
                      >
                        {t('admin:spaces.actions.openSpace')}
                      </ActionButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

export function SpaceAdminRequests() {
  const { t, i18n } = useTranslation(['admin', 'spaces']);
  const permissions = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SpaceRequest | null>(null);
  const requests = useQuery({
    queryKey: ['spaces', 'admin', 'requests'],
    queryFn: () => getSpaceAdminRequests('ALL'),
  });
  const mutation = useMutation({
    mutationFn: ({ decision, note }: { decision: 'APPROVE' | 'REJECT'; note: string }) =>
      decideSpaceRequest(selected!.requestId, {
        decision,
        note,
        expectedVersion: selected!.version,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['spaces', 'admin'] });
      setSelected(null);
      toast.success(t('admin:spaces.decision.saved'));
    },
    onError: () => toast.error(t('admin:spaces.decision.error')),
  });
  const canDecide = permissions.hasPermission('ADMIN.SPACE_GOVERNANCE', 'MANAGE');
  const korean = (i18n.resolvedLanguage ?? i18n.language).startsWith('ko');
  return (
    <Box>
      <SectionHeading
        icon={Route}
        title={t('admin:spaces.requests.title')}
        description={t('admin:spaces.requests.description')}
      />
      {requests.isLoading ? (
        <Skeleton variant="rounded" height={380} />
      ) : requests.isError ? (
        <Alert severity="error">{t('admin:spaces.common.loadError')}</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
          <Table aria-label={t('admin:spaces.requests.tableLabel')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin:spaces.columns.space')}</TableCell>
                <TableCell>{t('admin:spaces.columns.requester')}</TableCell>
                <TableCell>{t('admin:spaces.columns.template')}</TableCell>
                <TableCell>{t('admin:spaces.columns.risk')}</TableCell>
                <TableCell>{t('admin:spaces.columns.status')}</TableCell>
                <TableCell>{t('admin:spaces.columns.requestedAt')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.data?.map((item) => (
                <TableRow key={item.requestId} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={750}>
                      {item.requestedName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.requestedKey}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {item.requesterName ?? t('admin:spaces.common.unknownRequester')}
                  </TableCell>
                  <TableCell>{korean ? item.templateNameKo : item.templateNameEn}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={item.riskLevel === 'HIGH' ? 'error' : 'default'}
                      label={t(`spaces:risk.${item.riskLevel}`)}
                    />
                  </TableCell>
                  <TableCell>
                    <SpaceStatusChip value={item.status} />
                  </TableCell>
                  <TableCell>
                    {formatDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                  </TableCell>
                  <TableCell align="right">
                    {canDecide && item.status === 'PENDING' && (
                      <ActionButton intent="quiet" size="small" onClick={() => setSelected(item)}>
                        {t('admin:spaces.actions.review')}
                      </ActionButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <DecisionDialog
        open={Boolean(selected)}
        title={selected?.requestedName ?? ''}
        description={t('admin:spaces.requests.decisionDescription')}
        busy={mutation.isPending}
        approveLabel={t('admin:spaces.actions.approve')}
        rejectLabel={t('admin:spaces.actions.reject')}
        onClose={() => setSelected(null)}
        onDecision={(decision, note) => mutation.mutate({ decision, note })}
      />
    </Box>
  );
}

export function SpaceAdminTemplates() {
  const { t, i18n } = useTranslation(['admin', 'spaces']);
  const permissions = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<SpaceTemplate | null>(null);
  const templates = useQuery({
    queryKey: ['spaces', 'admin', 'templates'],
    queryFn: getSpaceAdminTemplates,
  });
  const mutation = useMutation({
    mutationFn: (form: TemplateForm) =>
      form.templateId ? updateSpaceTemplate(form.templateId, form) : createSpaceTemplate(form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['spaces', 'admin', 'templates'] });
      setEditorOpen(false);
      setSelected(null);
      toast.success(t('admin:spaces.templates.saved'));
    },
    onError: () => toast.error(t('admin:spaces.templates.error')),
  });
  const canCreate =
    permissions.hasPermission('ADMIN.SPACE_TEMPLATES', 'CREATE') ||
    permissions.hasPermission('ADMIN.SPACE_TEMPLATES', 'MANAGE');
  const canUpdate =
    permissions.hasPermission('ADMIN.SPACE_TEMPLATES', 'UPDATE') ||
    permissions.hasPermission('ADMIN.SPACE_TEMPLATES', 'MANAGE');
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (
    <Box>
      <SectionHeading
        icon={LayoutTemplate}
        title={t('admin:spaces.templates.title')}
        description={t('admin:spaces.templates.description')}
        action={
          canCreate ? (
            <ActionButton
              intent="primary"
              startIcon={<Plus size={16} />}
              onClick={() => {
                setSelected(null);
                setEditorOpen(true);
              }}
            >
              {t('admin:spaces.actions.newTemplate')}
            </ActionButton>
          ) : undefined
        }
      />
      {templates.isLoading ? (
        <Skeleton variant="rounded" height={360} />
      ) : templates.isError ? (
        <Alert severity="error">{t('admin:spaces.common.loadError')}</Alert>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
            gap: 1.5,
          }}
        >
          {templates.data?.map((template) => {
            const label = localizedSpace(
              {
                nameKo: template.nameKo,
                nameEn: template.nameEn,
                summaryKo: template.descriptionKo,
                summaryEn: template.descriptionEn,
              },
              language
            );
            return (
              <Paper
                key={template.templateId}
                component="section"
                variant="outlined"
                sx={{ p: 2, borderRadius: 1 }}
              >
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <SpaceGlyph
                    iconKey={template.iconKey}
                    accentToken={template.accentToken}
                    size={40}
                  />
                  <SpaceStatusChip value={template.lifecycleState} />
                </Stack>
                <Typography component="h3" variant="subtitle1" fontWeight={750} sx={{ mt: 1.5 }}>
                  {label.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, minHeight: 40 }}>
                  {label.summary}
                </Typography>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mt: 2 }}
                >
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`admin:spaces.purpose.${template.purposeType}`)}
                  />
                  {canUpdate && (
                    <ActionButton
                      intent="quiet"
                      size="small"
                      onClick={() => {
                        setSelected(template);
                        setEditorOpen(true);
                      }}
                    >
                      {t('admin:common.actions.edit')}
                    </ActionButton>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Box>
      )}
      <TemplateDialog
        open={editorOpen}
        template={selected}
        busy={mutation.isPending}
        onClose={() => setEditorOpen(false)}
        onSave={(form) => mutation.mutate(form)}
      />
    </Box>
  );
}

export function SpaceAdminContentReviews() {
  const { t } = useTranslation(['admin', 'spaces']);
  const permissions = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SpacePublicationReview | null>(null);
  const reviews = useQuery({
    queryKey: ['spaces', 'admin', 'content-reviews'],
    queryFn: () => getSpacePublicationReviews('ALL'),
  });
  const mutation = useMutation({
    mutationFn: ({ decision, note }: { decision: 'APPROVE' | 'REJECT'; note: string }) =>
      decideSpacePublication(selected!.reviewId, { decision, note }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['spaces', 'admin'] });
      setSelected(null);
      toast.success(t('admin:spaces.decision.saved'));
    },
    onError: () => toast.error(t('admin:spaces.decision.error')),
  });
  const canDecide =
    permissions.hasPermission('ADMIN.SPACE_COMPLIANCE', 'APPROVE') ||
    permissions.hasPermission('ADMIN.SPACE_COMPLIANCE', 'MANAGE');
  return (
    <Box>
      <SectionHeading
        icon={FileCheck2}
        title={t('admin:spaces.content.title')}
        description={t('admin:spaces.content.description')}
      />
      {reviews.isLoading ? (
        <Skeleton variant="rounded" height={360} />
      ) : reviews.isError ? (
        <Alert severity="error">{t('admin:spaces.common.loadError')}</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
          <Table aria-label={t('admin:spaces.content.tableLabel')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin:spaces.columns.content')}</TableCell>
                <TableCell>{t('admin:spaces.columns.space')}</TableCell>
                <TableCell>{t('admin:spaces.columns.classification')}</TableCell>
                <TableCell>{t('admin:spaces.columns.strategy')}</TableCell>
                <TableCell>{t('admin:spaces.columns.status')}</TableCell>
                <TableCell>{t('admin:spaces.columns.requestedAt')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {reviews.data?.map((item) => (
                <TableRow key={item.reviewId} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={750}>
                      {item.contentTitle}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t(`spaces:content.types.${item.contentType}`)}
                    </Typography>
                  </TableCell>
                  <TableCell>{item.spaceNameKo}</TableCell>
                  <TableCell>{t(`spaces:classification.${item.dataClassification}`)}</TableCell>
                  <TableCell>{item.reviewerStrategy}</TableCell>
                  <TableCell>
                    <SpaceStatusChip value={item.status} />
                  </TableCell>
                  <TableCell>
                    {formatDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                  </TableCell>
                  <TableCell align="right">
                    {canDecide && item.status === 'PENDING' && (
                      <ActionButton intent="quiet" size="small" onClick={() => setSelected(item)}>
                        {t('admin:spaces.actions.review')}
                      </ActionButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <DecisionDialog
        open={Boolean(selected)}
        title={selected?.contentTitle ?? ''}
        description={t('admin:spaces.content.decisionDescription')}
        busy={mutation.isPending}
        approveLabel={t('admin:spaces.actions.publish')}
        rejectLabel={t('admin:spaces.actions.reject')}
        onClose={() => setSelected(null)}
        onDecision={(decision, note) => mutation.mutate({ decision, note })}
      />
    </Box>
  );
}

export function SpaceAdminLifecycle() {
  const { t, i18n } = useTranslation(['admin', 'spaces']);
  const permissions = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SpaceLifecycleReview | null>(null);
  const [recommendation, setRecommendation] = useState<
    'KEEP' | 'ARCHIVE' | 'DELETE' | 'REVIEW_ACCESS'
  >('KEEP');
  const [note, setNote] = useState('');
  const reviews = useQuery({
    queryKey: ['spaces', 'admin', 'lifecycle'],
    queryFn: () => getSpaceLifecycleReviews('ALL'),
  });
  const mutation = useMutation({
    mutationFn: () => decideSpaceLifecycle(selected!.lifecycleReviewId, { recommendation, note }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['spaces', 'admin'] });
      setSelected(null);
      toast.success(t('admin:spaces.lifecycle.saved'));
    },
    onError: () => toast.error(t('admin:spaces.decision.error')),
  });
  const canDecide =
    permissions.hasPermission('ADMIN.SPACE_ACCESS_REVIEW', 'APPROVE') ||
    permissions.hasPermission('ADMIN.SPACE_ACCESS_REVIEW', 'MANAGE');
  const korean = (i18n.resolvedLanguage ?? i18n.language).startsWith('ko');
  return (
    <Box>
      <SectionHeading
        icon={ShieldCheck}
        title={t('admin:spaces.lifecycle.title')}
        description={t('admin:spaces.lifecycle.description')}
      />
      {reviews.isLoading ? (
        <Skeleton variant="rounded" height={360} />
      ) : reviews.isError ? (
        <Alert severity="error">{t('admin:spaces.common.loadError')}</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
          <Table aria-label={t('admin:spaces.lifecycle.tableLabel')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin:spaces.columns.space')}</TableCell>
                <TableCell>{t('admin:spaces.columns.reviewType')}</TableCell>
                <TableCell>{t('admin:spaces.columns.dueAt')}</TableCell>
                <TableCell>{t('admin:spaces.columns.recommendation')}</TableCell>
                <TableCell>{t('admin:spaces.columns.status')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {reviews.data?.map((item) => (
                <TableRow key={item.lifecycleReviewId} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={750}>
                      {korean ? item.spaceNameKo : item.spaceNameEn}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.spaceKey}
                    </Typography>
                  </TableCell>
                  <TableCell>{t(`admin:spaces.lifecycle.types.${item.reviewType}`)}</TableCell>
                  <TableCell>{formatDate(item.dueAt, { dateStyle: 'medium' })}</TableCell>
                  <TableCell>
                    {item.recommendation
                      ? t(`admin:spaces.lifecycle.recommendations.${item.recommendation}`)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <SpaceStatusChip value={item.status} />
                  </TableCell>
                  <TableCell align="right">
                    {canDecide && ['OPEN', 'OVERDUE'].includes(item.status) && (
                      <ActionButton
                        intent="quiet"
                        size="small"
                        onClick={() => {
                          setSelected(item);
                          setRecommendation('KEEP');
                          setNote('');
                        }}
                      >
                        {t('admin:spaces.actions.review')}
                      </ActionButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <FormDialog
        open={Boolean(selected)}
        title={t('admin:spaces.lifecycle.decisionTitle')}
        description={t('admin:spaces.lifecycle.decisionDescription')}
        cancelLabel={t('admin:common.actions.cancel')}
        submitLabel={t('admin:spaces.actions.recordDecision')}
        submittingLabel={t('admin:spaces.actions.recordDecision')}
        busy={mutation.isPending}
        submitDisabled={note.trim().length < 5}
        maxWidth="sm"
        onClose={() => setSelected(null)}
        onSubmit={() => mutation.mutate()}
      >
        <Stack gap={2}>
          <FormField
            select
            SelectProps={{ native: true }}
            label={t('admin:spaces.columns.recommendation')}
            value={recommendation}
            onChange={(event) => setRecommendation(event.target.value as typeof recommendation)}
          >
            {['KEEP', 'ARCHIVE', 'DELETE', 'REVIEW_ACCESS'].map((value) => (
              <option key={value} value={value}>
                {t(`admin:spaces.lifecycle.recommendations.${value}`)}
              </option>
            ))}
          </FormField>
          <FormField
            multiline
            minRows={4}
            label={t('admin:spaces.decision.note')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            supportingText={t('admin:spaces.decision.noteHelp')}
          />
        </Stack>
      </FormDialog>
    </Box>
  );
}
