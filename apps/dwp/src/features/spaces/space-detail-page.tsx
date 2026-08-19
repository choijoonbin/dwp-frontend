import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowLeft,
  Bot,
  Boxes,
  FilePlus2,
  FileText,
  KeyRound,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, EmptyState, FormField, PageCanvas } from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import {
  getSpace,
  getSpaceContent,
  getSpaceMembers,
  getMySpaceAccessRequests,
  updateSpacePolicies,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { CreateSpaceContentDialog } from './create-space-content-dialog';
import { SpaceAccessDialog } from './space-access-dialog';
import { SpaceMemberManager } from './space-member-manager';
import { SpaceGlyph, SpaceStatusChip, getSpaceTone, localizedSpace } from './space-ui';

const ALL_TABS = ['overview', 'content', 'people', 'apps', 'agent', 'owner'] as const;
type SpaceTab = (typeof ALL_TABS)[number];

function ContentList({ spaceKey }: { spaceKey: string }) {
  const { t } = useTranslation('spaces');
  const content = useQuery({
    queryKey: ['spaces', 'content', spaceKey],
    queryFn: () => getSpaceContent(spaceKey),
  });
  if (content.isLoading) return <Skeleton variant="rounded" height={280} />;
  if (content.isError) return <Alert severity="error">{t('detail.contentLoadError')}</Alert>;
  return (
    <Paper component="section" variant="outlined" sx={{ borderRadius: 1 }}>
      <Stack divider={<Divider flexItem />}>
        {content.data?.map((item) => (
          <Box key={item.contentId} sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" gap={2} alignItems="flex-start">
              <Stack direction="row" gap={1.5} sx={{ minWidth: 0 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    flex: '0 0 36px',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#315B7A',
                    bgcolor: '#E6EDF2',
                    borderRadius: 1,
                  }}
                >
                  <FileText size={17} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={750}>{item.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                    {item.summary}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.75, display: 'block' }}
                  >
                    {item.authorName ?? t('detail.unknownAuthor')} ·{' '}
                    {formatDate(item.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" gap={0.75}>
                <Chip
                  size="small"
                  variant="outlined"
                  label={t(`content.types.${item.contentType}`)}
                />
                <SpaceStatusChip value={item.lifecycleState} />
              </Stack>
            </Stack>
          </Box>
        ))}
        {!content.data?.length && (
          <Box sx={{ py: 8, px: 2, textAlign: 'center' }}>
            <Typography fontWeight={750}>{t('detail.noContentTitle')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('detail.noContentDescription')}
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

function MemberList({ spaceKey }: { spaceKey: string }) {
  const { t } = useTranslation('spaces');
  const members = useQuery({
    queryKey: ['spaces', 'members', spaceKey],
    queryFn: () => getSpaceMembers(spaceKey),
  });
  if (members.isLoading) return <Skeleton variant="rounded" height={260} />;
  if (members.isError) return <Alert severity="error">{t('detail.membersLoadError')}</Alert>;
  return (
    <Paper component="section" variant="outlined" sx={{ borderRadius: 1 }}>
      <Stack divider={<Divider flexItem />}>
        {members.data?.map((member) => (
          <Box key={member.membershipId} sx={{ px: 2, py: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" gap={2} alignItems="center">
              <Stack direction="row" gap={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                <Avatar sx={{ width: 34, height: 34, fontSize: 13 }}>
                  {member.principalType === 'GROUP'
                    ? 'G'
                    : member.principalRef.slice(0, 1).toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={750} noWrap>
                    {member.principalRef}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`principal.${member.principalType}`)} ·{' '}
                    {t(`membershipSource.${member.membershipSource}`, {
                      defaultValue: member.membershipSource,
                    })}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" gap={0.75} alignItems="center">
                <Chip size="small" label={t(`role.${member.memberRole}`)} />
                <SpaceStatusChip value={member.lifecycleState} />
              </Stack>
            </Stack>
          </Box>
        ))}
        {!members.data?.length && (
          <EmptyState
            size="compact"
            title={t('members.noMembersTitle')}
            description={t('members.noMembersDescription')}
          />
        )}
      </Stack>
    </Paper>
  );
}

export function SpaceDetailPage({ spaceKey, tab }: { spaceKey: string; tab: string }) {
  const { t, i18n } = useTranslation('spaces');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [createContentOpen, setCreateContentOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const detail = useQuery({
    queryKey: ['spaces', 'detail', spaceKey],
    queryFn: () => getSpace(spaceKey),
    staleTime: 20_000,
  });
  const [contentPolicy, setContentPolicy] = useState('OWNER_REVIEW');
  const [appPolicy, setAppPolicy] = useState('OWNER_REVIEW');
  const [aiPolicy, setAiPolicy] = useState('MEMBER_SCOPED');
  const accessRequests = useQuery({
    queryKey: ['spaces', 'access-requests'],
    queryFn: () => getMySpaceAccessRequests('PENDING'),
    staleTime: 20_000,
  });
  const activeTab: SpaceTab = ALL_TABS.includes(tab as SpaceTab) ? (tab as SpaceTab) : 'overview';

  useEffect(() => {
    if (!detail.data) return;
    setContentPolicy(detail.data.contentPolicy);
    setAppPolicy(detail.data.appPolicy);
    setAiPolicy(detail.data.aiPolicy);
  }, [detail.data]);

  const policyMutation = useMutation({
    mutationFn: () =>
      updateSpacePolicies(spaceKey, {
        contentPolicy,
        appPolicy,
        aiPolicy,
        expectedVersion: detail.data?.space.version ?? 0,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(['spaces', 'detail', spaceKey], next);
      toast.success(t('owner.saved'));
    },
    onError: () => toast.error(t('owner.error')),
  });

  if (detail.isLoading) {
    return (
      <PageCanvas>
        <Skeleton variant="rounded" height={186} />
        <Skeleton variant="rounded" height={340} sx={{ mt: 2 }} />
      </PageCanvas>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <PageCanvas>
        <Alert severity="error">{t('detail.loadError')}</Alert>
      </PageCanvas>
    );
  }

  const data = detail.data;
  const space = data.space;
  const language = i18n.resolvedLanguage ?? i18n.language;
  const label = localizedSpace(space, language);
  const tone = getSpaceTone(space.accentToken);
  const canViewSpaceBody = Boolean(
    space.memberRole || data.canManage || space.visibility === 'OPEN'
  );
  const tabs = ALL_TABS.filter(
    (value) => (value === 'overview' || canViewSpaceBody) && (value !== 'owner' || data.canManage)
  );
  const visibleTab = tabs.includes(activeTab) ? activeTab : 'overview';

  return (
    <PageCanvas topInset="compact">
      <ActionButton
        intent="quiet"
        startIcon={<ArrowLeft size={16} />}
        onClick={() => navigate('/spaces/home')}
        sx={{ mb: 1 }}
      >
        {t('actions.backToSpaces')}
      </ActionButton>
      <Box
        component="header"
        sx={{
          px: { xs: 2, md: 3 },
          py: { xs: 2.5, md: 3 },
          bgcolor: tone.soft,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          gap={2.5}
        >
          <Stack direction="row" gap={2} alignItems="flex-start">
            <SpaceGlyph iconKey={space.iconKey} accentToken={space.accentToken} size={52} />
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                <Typography component="h1" variant="h4">
                  {label.name}
                </Typography>
                {space.memberRole && <Chip size="small" label={t(`role.${space.memberRole}`)} />}
              </Stack>
              <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
                {label.summary}
              </Typography>
              <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.5 }}>
                <Chip size="small" variant="outlined" label={t(`visibility.${space.visibility}`)} />
                <Chip
                  size="small"
                  variant="outlined"
                  label={t(`classification.${space.dataClassification}`)}
                />
                <SpaceStatusChip value={space.lifecycleState} />
              </Stack>
            </Box>
          </Stack>
          {data.canContribute ? (
            <ActionButton
              intent="primary"
              startIcon={<FilePlus2 size={17} />}
              onClick={() => setCreateContentOpen(true)}
            >
              {t('actions.newContent')}
            </ActionButton>
          ) : !space.memberRole ? (
            <ActionButton
              intent="primary"
              startIcon={<KeyRound size={17} />}
              disabled={accessRequests.data?.some(
                (request) => request.spaceKey === spaceKey && request.status === 'PENDING'
              )}
              onClick={() => setAccessOpen(true)}
            >
              {accessRequests.data?.some(
                (request) => request.spaceKey === spaceKey && request.status === 'PENDING'
              )
                ? t('actions.accessPending')
                : t('actions.requestAccess')}
            </ActionButton>
          ) : null}
        </Stack>
      </Box>

      <Tabs
        value={visibleTab}
        onChange={(_, value: SpaceTab) => navigate(`/spaces/${spaceKey}/${value}`)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={t('detail.tabsLabel')}
        sx={{ mt: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.map((value) => (
          <Tab key={value} value={value} label={t(`detail.tabs.${value}`)} />
        ))}
      </Tabs>

      <Box sx={{ mt: 2.5 }}>
        {visibleTab === 'overview' && (
          <Stack gap={2.5}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' },
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              {[
                ['members', space.memberCount],
                ['content', space.contentCount],
                ['unread', space.unreadCount],
                ['activity', formatDate(space.lastActivityAt, { dateStyle: 'medium' })],
              ].map(([key, value], index) => (
                <Box
                  key={String(key)}
                  sx={{
                    p: 2,
                    minHeight: 88,
                    borderRight: { xs: index % 2 === 0 ? 1 : 0, lg: index < 3 ? 1 : 0 },
                    borderBottom: { xs: index < 2 ? 1 : 0, lg: 0 },
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {t(`detail.metrics.${key}`)}
                  </Typography>
                  <Typography component="p" variant="h5" sx={{ mt: 0.5 }}>
                    {typeof value === 'number' ? formatNumber(value) : value}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(300px, 0.8fr)' },
                gap: 2,
              }}
            >
              <Paper component="section" variant="outlined" sx={{ borderRadius: 1 }}>
                <Stack direction="row" alignItems="center" gap={1} sx={{ p: 2 }}>
                  <FileText size={18} />
                  <Typography component="h2" variant="h6">
                    {t('detail.featuredContent')}
                  </Typography>
                </Stack>
                <Divider />
                <Stack divider={<Divider flexItem />}>
                  {data.featuredContent.map((item) => (
                    <Box key={item.contentId} sx={{ p: 2 }}>
                      <Typography fontWeight={750}>{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                        {item.summary}
                      </Typography>
                    </Box>
                  ))}
                  {!data.featuredContent.length && (
                    <EmptyState
                      size="compact"
                      title={t('detail.noFeaturedTitle')}
                      description={t('detail.noFeaturedDescription')}
                    />
                  )}
                </Stack>
              </Paper>
              <Paper component="section" variant="outlined" sx={{ borderRadius: 1 }}>
                <Stack direction="row" alignItems="center" gap={1} sx={{ p: 2 }}>
                  <Activity size={18} />
                  <Typography component="h2" variant="h6">
                    {t('detail.recentActivity')}
                  </Typography>
                </Stack>
                <Divider />
                <Stack divider={<Divider flexItem />}>
                  {data.activity.slice(0, 6).map((item) => (
                    <Box key={item.activityId} sx={{ px: 2, py: 1.5 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {language.startsWith('ko') ? item.titleKo : item.titleEn}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(item.occurredAt, { timeStyle: 'short' })}
                      </Typography>
                    </Box>
                  ))}
                  {!data.activity.length && (
                    <EmptyState
                      size="compact"
                      title={t('detail.noActivityTitle')}
                      description={t('detail.noActivityDescription')}
                    />
                  )}
                </Stack>
              </Paper>
            </Box>
          </Stack>
        )}
        {visibleTab === 'content' && <ContentList spaceKey={spaceKey} />}
        {visibleTab === 'people' &&
          (data.canModerate ? (
            <MemberList spaceKey={spaceKey} />
          ) : (
            <Alert severity="info">{t('detail.peoplePrivacy')}</Alert>
          ))}
        {visibleTab === 'apps' && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
              gap: 1.5,
            }}
          >
            {data.apps.map((app) => (
              <Paper
                key={app.bindingId}
                component="section"
                variant="outlined"
                sx={{ p: 2, borderRadius: 1 }}
              >
                <Stack direction="row" gap={1.5} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      display: 'grid',
                      placeItems: 'center',
                      color: '#315B7A',
                      bgcolor: '#E6EDF2',
                      borderRadius: 1,
                    }}
                  >
                    <Boxes size={19} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={750}>
                      {language.startsWith('ko') ? app.displayNameKo : app.displayNameEn}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('detail.appScope', {
                        scope: t(`dataAccessScope.${app.dataAccessScope}`, {
                          defaultValue: app.dataAccessScope,
                        }),
                      })}
                    </Typography>
                    {app.launchTarget.startsWith('/') ? (
                      <Link
                        component={RouterLink}
                        to={app.launchTarget}
                        underline="hover"
                        sx={{ mt: 1, display: 'block' }}
                      >
                        {t('actions.openApp')}
                      </Link>
                    ) : (
                      <Link
                        href={app.launchTarget}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        sx={{ mt: 1, display: 'block' }}
                      >
                        {t('actions.openApp')}
                      </Link>
                    )}
                  </Box>
                </Stack>
              </Paper>
            ))}
            {!data.apps.length && (
              <Box sx={{ gridColumn: '1 / -1', border: 1, borderColor: 'divider' }}>
                <EmptyState
                  size="compact"
                  title={t('detail.noAppsTitle')}
                  description={t('detail.noAppsDescription')}
                />
              </Box>
            )}
          </Box>
        )}
        {visibleTab === 'agent' && (
          <Paper component="section" variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} gap={2.5} alignItems="flex-start">
              <Box
                sx={{
                  width: 46,
                  height: 46,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#187B72',
                  bgcolor: '#E3F2EF',
                  borderRadius: 1,
                }}
              >
                <Bot size={22} />
              </Box>
              <Box sx={{ maxWidth: 760 }}>
                <Typography component="h2" variant="h6">
                  {t('detail.agentTitle')}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  {t('detail.agentDescription')}
                </Typography>
                <Stack direction="row" gap={1} sx={{ mt: 2 }}>
                  <Chip icon={<ShieldCheck size={14} />} label={t(`aiPolicy.${data.aiPolicy}`)} />
                  <Chip
                    variant="outlined"
                    label={t(`classification.${space.dataClassification}`)}
                  />
                </Stack>
              </Box>
            </Stack>
          </Paper>
        )}
        {visibleTab === 'owner' && data.canManage && (
          <Stack gap={3}>
            <SpaceMemberManager spaceKey={spaceKey} />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(280px, 0.7fr)' },
                gap: 2,
              }}
            >
              <Paper component="section" variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
                <Stack direction="row" gap={1} alignItems="center">
                  <Settings2 size={19} />
                  <Typography component="h2" variant="h6">
                    {t('owner.title')}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('owner.description')}
                </Typography>
                <Stack gap={2} sx={{ mt: 2.5 }}>
                  <FormField
                    select
                    SelectProps={{ native: true }}
                    label={t('owner.contentPolicy')}
                    value={contentPolicy}
                    onChange={(event) => setContentPolicy(event.target.value)}
                  >
                    {['OPEN_PUBLISH', 'OWNER_REVIEW', 'COMPLIANCE_REVIEW'].map((value) => (
                      <option key={value} value={value}>
                        {t(`contentPolicy.${value}`)}
                      </option>
                    ))}
                  </FormField>
                  <FormField
                    select
                    SelectProps={{ native: true }}
                    label={t('owner.appPolicy')}
                    value={appPolicy}
                    onChange={(event) => setAppPolicy(event.target.value)}
                  >
                    {['OWNER_MANAGED', 'OWNER_REVIEW', 'ADMIN_REVIEW'].map((value) => (
                      <option key={value} value={value}>
                        {t(`appPolicy.${value}`)}
                      </option>
                    ))}
                  </FormField>
                  <FormField
                    select
                    SelectProps={{ native: true }}
                    label={t('owner.aiPolicy')}
                    value={aiPolicy}
                    onChange={(event) => setAiPolicy(event.target.value)}
                  >
                    {['DISABLED', 'MEMBER_SCOPED', 'RESTRICTED_SCOPED'].map((value) => (
                      <option key={value} value={value}>
                        {t(`aiPolicy.${value}`)}
                      </option>
                    ))}
                  </FormField>
                  <ActionButton
                    intent="primary"
                    onClick={() => policyMutation.mutate()}
                    loading={policyMutation.isPending}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {t('actions.savePolicies')}
                  </ActionButton>
                </Stack>
              </Paper>
              <Box
                component="aside"
                sx={{ borderInlineStart: { lg: 1 }, borderColor: 'divider', pl: { lg: 2 } }}
              >
                <Typography component="h2" variant="subtitle1" fontWeight={750}>
                  {t('owner.guardrailsTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {t('owner.guardrailsDescription')}
                </Typography>
                <Stack gap={1.25} sx={{ mt: 2 }}>
                  {['leastPrivilege', 'contentEvidence', 'lifecycleReview'].map((value) => (
                    <Stack key={value} direction="row" gap={1} alignItems="flex-start">
                      <ShieldCheck size={17} color={tone.strong} />
                      <Typography variant="body2">{t(`owner.guardrails.${value}`)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Stack>
        )}
      </Box>
      <CreateSpaceContentDialog
        open={createContentOpen}
        spaceKey={spaceKey}
        onClose={() => setCreateContentOpen(false)}
      />
      <SpaceAccessDialog
        open={accessOpen}
        spaceKey={spaceKey}
        onClose={() => setAccessOpen(false)}
      />
    </PageCanvas>
  );
}
