import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keyframes } from '@emotion/react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  EyeOff,
  HeartHandshake,
  Lightbulb,
  Newspaper,
  PartyPopper,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acknowledgeCommunication,
  getCommunication,
  getCommunicationFeed,
  recordCommunicationEvent,
  updateCommunicationReaderState,
  updateCommunicationReaction,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ActionIconButton, FormField, PageCanvas } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { useProductActionMutation } from '../components/use-product-action-mutation';
import { FeedLoading, storyDate } from '../features/communications/communication-feed-support';

import type {
  CommunicationContentType,
  CommunicationFeed,
  CommunicationFeedScope,
  CommunicationItem,
  CommunicationReaction,
} from '@dwp-frontend/shared-utils';
import { CommunicationActionRail } from '../features/communications/communication-action-rail';
import {
  buildCommunicationActionRailItems,
  communicationActionIds,
} from '../features/communications/communication-action-rail-model';

const enter = keyframes`
  from { transform: translateY(10px); }
  to { transform: translateY(0); }
`;

const scopeValues = new Set<CommunicationFeedScope>(['for-you', 'all', 'required', 'saved']);
const contentTypes: readonly (CommunicationContentType | 'ALL')[] = [
  'ALL',
  'NEWS',
  'ANNOUNCEMENT',
  'EVENT',
  'POLICY_UPDATE',
];

const categoryTone: Record<string, { accent: string; surface: string }> = {
  COMPANY: { accent: '#315FD5', surface: '#EAF0FF' },
  INNOVATION: { accent: '#6C4AC7', surface: '#F0EBFF' },
  CULTURE: { accent: '#D64F5F', surface: '#FFF0F2' },
  SECURITY: { accent: '#08727A', surface: '#E6F6F5' },
  LEADERSHIP: { accent: '#A45A06', surface: '#FFF3DE' },
  GROWTH: { accent: '#18794E', surface: '#E8F5EE' },
};

function toneFor(category: string) {
  return categoryTone[category] ?? categoryTone.COMPANY;
}

function useCommunicationImpression(id: number) {
  const ref = useRef<HTMLDivElement>(null);
  const sent = useRef(false);
  const recordEvent = useProductActionMutation('route.communications.work.event.action');

  useEffect(() => {
    const node = ref.current;
    if (!node || sent.current || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.55))
          return;
        sent.current = true;
        void recordEvent((authority) => recordCommunicationEvent(id, 'impression', authority));
        observer.disconnect();
      },
      { threshold: [0.55] }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, recordEvent]);
  return ref;
}

function StoryMeta({ item, light = false }: { item: CommunicationItem; light?: boolean }) {
  const { t } = useTranslation('communications');
  const color = light ? 'rgba(255,255,255,0.78)' : 'text.secondary';
  return (
    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
      <Typography variant="caption" color={color} fontWeight={700}>
        {item.publisherName}
      </Typography>
      <Box aria-hidden="true" sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: color }} />
      <Stack direction="row" alignItems="center" gap={0.45} color={color}>
        <CalendarDays size={13} aria-hidden="true" />
        <Typography variant="caption" color="inherit">
          {storyDate(item.publishedAt)}
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="center" gap={0.45} color={color}>
        <Clock3 size={13} aria-hidden="true" />
        <Typography variant="caption" color="inherit">
          {t('story.readTime', { count: item.readingMinutes })}
        </Typography>
      </Stack>
    </Stack>
  );
}

function SaveButton({ item, compact = false }: { item: CommunicationItem; compact?: boolean }) {
  const { t } = useTranslation('communications');
  const toast = useToast();
  const queryClient = useQueryClient();
  const updateReaderState = useProductActionMutation(
    'route.communications.work.reader-state.action'
  );
  const mutation = useMutation({
    mutationFn: () =>
      updateReaderState((authority) =>
        updateCommunicationReaderState(
          item.communicationId,
          { saved: !item.readerState.saved },
          authority
        )
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['communications'] }),
    onError: () => toast.error(t('story.saveError')),
  });
  const label = item.readerState.saved ? t('story.removeSaved') : t('story.save');

  if (compact) {
    return (
      <ActionIconButton
        label={label}
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {item.readerState.saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
      </ActionIconButton>
    );
  }
  return (
    <ActionButton
      intent="secondary"
      startIcon={item.readerState.saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      {item.readerState.saved ? t('story.saved') : t('story.save')}
    </ActionButton>
  );
}

function FeaturedStory({
  item,
  scope,
}: {
  item: CommunicationItem;
  scope: CommunicationFeedScope;
}) {
  const { t } = useTranslation('communications');
  const impressionRef = useCommunicationImpression(item.communicationId);
  return (
    <Box
      ref={impressionRef}
      component="article"
      sx={{
        position: 'relative',
        minHeight: { xs: 430, md: 480 },
        overflow: 'hidden',
        borderRadius: 1,
        bgcolor: '#102033',
        border: 1,
        borderColor: 'divider',
        animation: `${enter} 420ms ease-out both`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      {item.coverImageUrl ? (
        <Box
          component="img"
          src={item.coverImageUrl}
          alt=""
          sx={{ position: 'absolute', inset: 0, width: 1, height: 1, objectFit: 'cover' }}
        />
      ) : (
        <Box sx={{ position: 'absolute', inset: 0, bgcolor: toneFor(item.categoryKey).accent }} />
      )}
      <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(5,14,28,0.36)' }} />
      <Stack
        sx={{
          position: 'absolute',
          inset: 'auto 0 0 0',
          p: { xs: 2.5, md: 4 },
          bgcolor: 'rgba(7,18,36,0.86)',
          color: 'common.white',
        }}
        gap={1.5}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            <Chip
              size="small"
              icon={<Sparkles size={14} />}
              label={t('story.featured')}
              sx={{ bgcolor: '#EAF0FF', color: '#183A86' }}
            />
            <Chip
              size="small"
              label={t(`categories.${item.categoryKey}`, { defaultValue: item.categoryKey })}
              sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: 'common.white' }}
            />
            {item.readerState.unread && (
              <Chip size="small" label={t('page.unread')} color="primary" />
            )}
          </Stack>
          <SaveButton item={item} compact />
        </Stack>
        <Typography component="h2" variant="h4" sx={{ maxWidth: 900, color: 'common.white' }}>
          {item.title}
        </Typography>
        <Typography variant="body1" sx={{ maxWidth: 880, color: 'rgba(255,255,255,0.78)' }}>
          {item.summary}
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          gap={1.5}
        >
          <StoryMeta item={item} light />
          <ActionButton
            component={Link}
            to={`/communications/${scope}/${item.communicationId}`}
            intent="primary"
            endIcon={<ArrowRight size={17} />}
          >
            {t('story.open')}
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}

function StoryCard({
  item,
  scope,
  index,
}: {
  item: CommunicationItem;
  scope: CommunicationFeedScope;
  index: number;
}) {
  const { t } = useTranslation('communications');
  const impressionRef = useCommunicationImpression(item.communicationId);
  const tone = toneFor(item.categoryKey);
  return (
    <Box
      ref={impressionRef}
      component="article"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '210px minmax(0, 1fr)' },
        minHeight: { sm: 178 },
        border: 1,
        borderColor: item.readerState.unread ? tone.accent : 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        animation: `${enter} 360ms ease-out both`,
        animationDelay: `${Math.min(index, 6) * 55}ms`,
        transition: (theme) =>
          theme.transitions.create(['box-shadow', 'transform', 'border-color'], {
            duration: theme.transitions.duration.shorter,
          }),
        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 14px 34px rgba(15,23,42,0.10)' },
        '@media (prefers-reduced-motion: reduce)': { animation: 'none', transition: 'none' },
      }}
    >
      <Box
        component={Link}
        to={`/communications/${scope}/${item.communicationId}`}
        aria-label={item.title}
        sx={{
          minHeight: { xs: 170, sm: 'auto' },
          bgcolor: tone.surface,
          textDecoration: 'none',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {item.coverImageUrl ? (
          <Box
            component="img"
            src={item.coverImageUrl}
            alt=""
            loading="lazy"
            sx={{ width: 1, height: 1, objectFit: 'cover', transition: 'transform 260ms ease' }}
          />
        ) : (
          <Box sx={{ height: 1, display: 'grid', placeItems: 'center', color: tone.accent }}>
            <Newspaper size={42} strokeWidth={1.4} aria-hidden="true" />
          </Box>
        )}
      </Box>
      <Stack sx={{ minWidth: 0, p: { xs: 2, md: 2.25 } }} gap={1}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <Chip
              size="small"
              label={t(`types.${item.contentType}`)}
              sx={{ bgcolor: tone.surface, color: tone.accent }}
            />
            {item.acknowledgementRequired && !item.readerState.acknowledged && (
              <Chip size="small" color="warning" label={t('page.required')} />
            )}
          </Stack>
          <SaveButton item={item} compact />
        </Stack>
        <Typography
          component={Link}
          to={`/communications/${scope}/${item.communicationId}`}
          variant="h6"
          color="text.primary"
          sx={{ textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
        >
          {item.title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.summary}
        </Typography>
        <Box sx={{ mt: 'auto' }}>
          <StoryMeta item={item} />
        </Box>
      </Stack>
    </Box>
  );
}

const reactionOptions: readonly {
  key: CommunicationReaction;
  icon: typeof PartyPopper;
}[] = [
  { key: 'CELEBRATE', icon: PartyPopper },
  { key: 'INSIGHTFUL', icon: Lightbulb },
  { key: 'SUPPORT', icon: HeartHandshake },
];

function ReactionBar({ item }: { item: CommunicationItem }) {
  const { t } = useTranslation('communications');
  const queryClient = useQueryClient();
  const toast = useToast();
  const updateReaction = useProductActionMutation('route.communications.work.reaction.action');
  const reaction = useMutation({
    mutationFn: (next: CommunicationReaction | null) =>
      updateReaction((authority) =>
        updateCommunicationReaction(item.communicationId, next, authority)
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['communications'] }),
    onError: () => toast.error(t('story.reactions.error')),
  });

  return (
    <Box component="section" aria-labelledby="story-reactions-heading" sx={{ mt: 4 }}>
      <Typography id="story-reactions-heading" variant="subtitle2">
        {t('story.reactions.title')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('story.reactions.description')}
      </Typography>
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
        {reactionOptions.map(({ key, icon: Icon }) => {
          const selected = item.reactions.viewerReaction === key;
          return (
            <ActionButton
              key={key}
              intent={selected ? 'primary' : 'secondary'}
              startIcon={<Icon size={17} />}
              aria-pressed={selected}
              disabled={reaction.isPending}
              onClick={() => reaction.mutate(selected ? null : key)}
            >
              {t(`story.reactions.${key}`)}
              <Typography
                component="span"
                variant="caption"
                sx={{ ml: 0.75, fontVariantNumeric: 'tabular-nums', color: 'inherit' }}
              >
                {item.reactions.counts[key] ?? 0}
              </Typography>
            </ActionButton>
          );
        })}
      </Stack>
    </Box>
  );
}

function StoryDetail({ item, scope }: { item: CommunicationItem; scope: CommunicationFeedScope }) {
  const { t } = useTranslation('communications');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const acknowledgeItem = useProductActionMutation(
    'route.communications.work.acknowledgement.action'
  );
  const updateReaderState = useProductActionMutation(
    'route.communications.work.reader-state.action'
  );
  const recordEvent = useProductActionMutation('route.communications.work.event.action');
  const opened = useRef<number | null>(null);
  const tone = toneFor(item.categoryKey);
  const acknowledge = useMutation({
    mutationFn: () =>
      acknowledgeItem((authority) => acknowledgeCommunication(item.communicationId, authority)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['communications'] }),
    onError: () => toast.error(t('story.acknowledgeError')),
  });
  const dismiss = useMutation({
    mutationFn: () =>
      updateReaderState((authority) =>
        updateCommunicationReaderState(item.communicationId, { dismissed: true }, authority)
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['communications'] });
      toast.success(t('story.dismissed'));
      navigate(`/communications/${scope}`);
    },
    onError: () => toast.error(t('story.dismissError')),
  });

  useEffect(() => {
    if (opened.current === item.communicationId) return;
    opened.current = item.communicationId;
    void recordEvent((authority) =>
      recordCommunicationEvent(item.communicationId, 'open', authority)
    ).then(() => queryClient.invalidateQueries({ queryKey: ['communications'] }));
  }, [item.communicationId, queryClient, recordEvent]);

  const openAction = () => {
    if (!item.actionUrl) return;
    void recordEvent((authority) =>
      recordCommunicationEvent(item.communicationId, 'action', authority)
    );
    if (item.actionUrl.startsWith('https://'))
      window.open(item.actionUrl, '_blank', 'noopener,noreferrer');
    else navigate(item.actionUrl);
  };
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url: window.location.href });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        toast.success(t('story.copied'));
      } else {
        throw new Error('Sharing is unavailable.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error(t('story.shareError'));
    }
  };
  const paragraphs = (item.body || item.summary).split(/\n\s*\n/).filter(Boolean);

  return (
    <PageCanvas mode="focus">
      <ActionButton
        intent="quiet"
        startIcon={<ArrowLeft size={17} />}
        component={Link}
        to={`/communications/${scope}`}
      >
        {t('story.back')}
      </ActionButton>
      <Box component="article" sx={{ maxWidth: 1120, mx: 'auto', mt: 2.5 }}>
        <Box
          sx={{
            position: 'relative',
            aspectRatio: { xs: '4 / 3', md: '16 / 7' },
            minHeight: { xs: 300, md: 430 },
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: tone.surface,
          }}
        >
          {item.coverImageUrl ? (
            <Box
              component="img"
              src={item.coverImageUrl}
              alt=""
              sx={{ width: 1, height: 1, objectFit: 'cover' }}
            />
          ) : (
            <Box
              sx={{
                width: 1,
                height: 1,
                display: 'grid',
                placeItems: 'center',
                color: tone.accent,
              }}
            >
              <Newspaper size={72} strokeWidth={1.2} aria-hidden="true" />
            </Box>
          )}
        </Box>
        <Box sx={{ maxWidth: 880, mx: 'auto', pt: { xs: 3, md: 4 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
            <Stack direction="row" gap={0.75} flexWrap="wrap">
              <Chip
                size="small"
                label={t(`types.${item.contentType}`)}
                sx={{ bgcolor: tone.surface, color: tone.accent }}
              />
              <Chip
                size="small"
                variant="outlined"
                label={t(`categories.${item.categoryKey}`, { defaultValue: item.categoryKey })}
              />
              {item.acknowledgementRequired && (
                <Chip
                  size="small"
                  color={item.readerState.acknowledged ? 'success' : 'warning'}
                  label={
                    item.readerState.acknowledged ? t('story.acknowledged') : t('page.required')
                  }
                />
              )}
            </Stack>
            <Stack direction="row" gap={0.5}>
              <SaveButton item={item} compact />
              <ActionIconButton label={t('story.share')} onClick={() => void share()}>
                <Share2 size={18} />
              </ActionIconButton>
            </Stack>
          </Stack>
          <Typography component="h1" variant="h3" sx={{ mt: 2.5, maxWidth: 820 }}>
            {item.title}
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            fontWeight={450}
            sx={{ mt: 1.5, maxWidth: 820 }}
          >
            {item.summary}
          </Typography>
          <Box sx={{ mt: 2 }}>
            <StoryMeta item={item} />
          </Box>
          <Divider sx={{ my: { xs: 3, md: 4 } }} />
          <Stack gap={2.25}>
            {paragraphs.map((paragraph, index) => (
              <Typography
                key={`${item.communicationId}-${index}`}
                variant="body1"
                sx={{ fontSize: '1rem', lineHeight: 1.85 }}
              >
                {paragraph}
              </Typography>
            ))}
          </Stack>
          {(item.actionUrl || item.acknowledgementRequired) && (
            <Box
              sx={{
                mt: 4,
                p: { xs: 2, md: 2.5 },
                borderTop: 1,
                borderBottom: 1,
                borderColor: item.acknowledgementRequired ? '#E89727' : 'divider',
                bgcolor: item.acknowledgementRequired ? '#FFF9EF' : 'action.hover',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                gap={2}
              >
                <Box>
                  {item.acknowledgementRequired && (
                    <>
                      <Typography variant="subtitle2">
                        {item.readerState.acknowledged
                          ? t('story.acknowledged')
                          : item.acknowledgementDueAt
                            ? t('story.acknowledgementDue', {
                                date: storyDate(item.acknowledgementDueAt),
                              })
                            : t('page.required')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('story.acknowledgementEvidence')}
                      </Typography>
                    </>
                  )}
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                  {item.dismissible && !item.acknowledgementRequired && (
                    <ActionButton
                      intent="quiet"
                      startIcon={<EyeOff size={16} />}
                      onClick={() => dismiss.mutate()}
                      disabled={dismiss.isPending}
                    >
                      {t('story.dismiss')}
                    </ActionButton>
                  )}
                  {item.actionUrl && (
                    <ActionButton
                      intent="secondary"
                      endIcon={<ExternalLink size={16} />}
                      onClick={openAction}
                    >
                      {item.actionLabel || t('story.external')}
                    </ActionButton>
                  )}
                  {item.acknowledgementRequired && (
                    <ActionButton
                      intent="primary"
                      startIcon={<Check size={17} />}
                      onClick={() => acknowledge.mutate()}
                      disabled={item.readerState.acknowledged || acknowledge.isPending}
                    >
                      {item.readerState.acknowledged
                        ? t('story.acknowledged')
                        : t('story.acknowledge')}
                    </ActionButton>
                  )}
                </Stack>
              </Stack>
            </Box>
          )}
          <ReactionBar item={item} />
        </Box>
      </Box>
    </PageCanvas>
  );
}

export default function CommunicationsPage() {
  const { t } = useTranslation('communications');
  const auth = useAuth();
  const params = useParams<{ view?: string; storyId?: string }>();
  const scope = scopeValues.has(params.view as CommunicationFeedScope)
    ? (params.view as CommunicationFeedScope)
    : 'for-you';
  const hasStoryRoute = params.storyId !== undefined;
  const storyId = params.storyId ? Number(params.storyId) : null;
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [contentType, setContentType] = useState<CommunicationContentType | 'ALL'>('ALL');
  const queryClient = useQueryClient();
  const feed = useQuery({
    queryKey: ['communications', 'feed', scope, deferredSearch, contentType, 24],
    queryFn: () =>
      getCommunicationFeed({ scope, query: deferredSearch, type: contentType, size: 24 }),
    staleTime: 30_000,
    retry: 1,
  });
  const requiredFeed = useQuery({
    queryKey: ['communications', 'feed', 'required', '', 'ALL', 24],
    queryFn: () => getCommunicationFeed({ scope: 'required', type: 'ALL', size: 24 }),
    staleTime: 30_000,
    retry: 1,
  });
  const detail = useQuery({
    queryKey: ['communications', 'detail', storyId],
    queryFn: () => getCommunication(storyId as number),
    enabled: Number.isInteger(storyId) && Number(storyId) > 0,
    staleTime: 30_000,
    retry: 1,
  });
  const tenantName = auth.user?.tenantName || auth.user?.tenantCode || t('shell.tenantFallback');

  if (hasStoryRoute && (!Number.isInteger(storyId) || Number(storyId) <= 0)) {
    return (
      <PageCanvas mode="focus">
        <ActionButton
          intent="quiet"
          startIcon={<ArrowLeft size={17} />}
          component={Link}
          to={`/communications/${scope}`}
        >
          {t('story.back')}
        </ActionButton>
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="subtitle2">{t('page.detailErrorTitle')}</Typography>
          <Typography variant="body2">{t('page.detailErrorDescription')}</Typography>
        </Alert>
      </PageCanvas>
    );
  }
  if (storyId && detail.isLoading) {
    return (
      <PageCanvas>
        <FeedLoading />
      </PageCanvas>
    );
  }
  if (storyId && detail.isError) {
    return (
      <PageCanvas mode="focus">
        <ActionButton
          intent="quiet"
          startIcon={<ArrowLeft size={17} />}
          component={Link}
          to={`/communications/${scope}`}
        >
          {t('story.back')}
        </ActionButton>
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={
            <ActionButton intent="quiet" onClick={() => void detail.refetch()}>
              {t('page.retry')}
            </ActionButton>
          }
        >
          <Typography variant="subtitle2">{t('page.detailErrorTitle')}</Typography>
          <Typography variant="body2">{t('page.detailErrorDescription')}</Typography>
        </Alert>
      </PageCanvas>
    );
  }
  if (storyId && detail.data) return <StoryDetail item={detail.data} scope={scope} />;

  const data: CommunicationFeed | undefined = feed.data;
  const actionItems = buildCommunicationActionRailItems(data, requiredFeed.data);
  const actionIds = communicationActionIds(actionItems);
  const editorialFeatured =
    data?.featured && !actionIds.has(data.featured.communicationId) ? data.featured : undefined;
  const editorialItems = (data?.items ?? []).filter((item) => !actionIds.has(item.communicationId));
  const editorialItemCount = editorialItems.length + (editorialFeatured ? 1 : 0);
  const hasVisibleContent = editorialItemCount > 0 || actionItems.length > 0;

  return (
    <PageCanvas>
      <Box sx={{ maxWidth: 1540, mx: 'auto' }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'flex-end' }}
          justifyContent="space-between"
          gap={2.5}
        >
          <Box>
            <Typography variant="overline" color="primary.main">
              {t('page.eyebrow', { tenant: tenantName })}
            </Typography>
            <Typography component="h1" variant="h4" sx={{ mt: 0.25 }}>
              {t('page.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>
              {t('page.description')}
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" gap={1}>
            {data?.generatedAt && (
              <Typography variant="caption" color="text.secondary">
                {t('page.refreshed', {
                  time: formatDate(data.generatedAt, { hour: '2-digit', minute: '2-digit' }),
                })}
              </Typography>
            )}
            <ActionIconButton
              label={t('page.retry')}
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['communications'] })}
            >
              <RefreshCw size={17} />
            </ActionIconButton>
          </Stack>
        </Stack>

        <Box
          aria-label={t('page.total')}
          sx={{
            mt: 3,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
            },
            borderTop: 1,
            borderLeft: 1,
            borderColor: 'divider',
          }}
        >
          {(
            [
              ['unread', data?.summary.unread ?? 0, Sparkles, '#315FD5'],
              ['required', data?.summary.required ?? 0, CircleAlert, '#C56612'],
              ['saved', data?.summary.saved ?? 0, Bookmark, '#0A7C84'],
              ['total', data?.summary.total ?? 0, Newspaper, '#52606D'],
            ] as const
          ).map(([key, value, Icon, color]) => (
            <Stack
              key={key}
              direction="row"
              alignItems="center"
              gap={1.25}
              sx={{
                p: 1.75,
                borderRight: 1,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 1,
                  bgcolor: `${color}14`,
                  color,
                }}
              >
                <Icon size={18} aria-hidden="true" />
              </Box>
              <Box>
                <Typography component="p" variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(`page.${key}`)}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Box>

        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          alignItems={{ xs: 'stretch', lg: 'center' }}
          justifyContent="space-between"
          gap={1.5}
          sx={{ mt: 3, mb: 2 }}
        >
          <FormField
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            label={t('page.searchLabel')}
            placeholder={t('page.searchPlaceholder')}
            sx={{ width: { xs: 1, lg: 420 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} />
                  </InputAdornment>
                ),
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <ActionIconButton label={t('page.clearSearch')} onClick={() => setSearch('')}>
                      <X size={16} />
                    </ActionIconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
          <ToggleButtonGroup
            exclusive
            size="small"
            value={contentType}
            onChange={(_, value: CommunicationContentType | 'ALL' | null) =>
              value && setContentType(value)
            }
            aria-label={t('page.filterLabel')}
            sx={{ overflowX: 'auto', alignSelf: { xs: 'stretch', lg: 'auto' } }}
          >
            {contentTypes.map((type) => (
              <ToggleButton key={type} value={type} sx={{ minWidth: 76, whiteSpace: 'nowrap' }}>
                {t(`types.${type}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        {feed.isError ? (
          <Alert
            severity="error"
            action={
              <ActionButton intent="quiet" onClick={() => void feed.refetch()}>
                {t('page.retry')}
              </ActionButton>
            }
          >
            <Typography variant="subtitle2">{t('page.errorTitle')}</Typography>
            <Typography variant="body2">{t('page.errorDescription')}</Typography>
          </Alert>
        ) : feed.isLoading ? (
          <FeedLoading />
        ) : !hasVisibleContent ? (
          <Box
            sx={{
              minHeight: 360,
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              borderTop: 1,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Box>
              <Search size={30} color="#667085" aria-hidden="true" />
              <Typography variant="h6" sx={{ mt: 1.5 }}>
                {t('page.emptyTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t('page.emptyDescription')}
              </Typography>
            </Box>
          </Box>
        ) : (
          <>
            {editorialFeatured && <FeaturedStory item={editorialFeatured} scope={scope} />}
            <Box
              sx={{
                mt: 3.5,
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  xl: 'minmax(0, 2.1fr) minmax(300px, 0.9fr)',
                },
                gap: { xs: 3.5, xl: 4 },
                alignItems: 'start',
              }}
            >
              <Box component="section" aria-labelledby="latest-news-title" minWidth={0}>
                <Stack
                  direction="row"
                  alignItems="baseline"
                  justifyContent="space-between"
                  gap={2}
                  sx={{ mb: 1.5 }}
                >
                  <Typography id="latest-news-title" component="h2" variant="h6">
                    {t('page.latest')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('page.latestCount', { count: editorialItems.length })}
                  </Typography>
                </Stack>
                <Stack gap={1.5}>
                  {editorialItems.map((item, index) => (
                    <StoryCard key={item.communicationId} item={item} scope={scope} index={index} />
                  ))}
                </Stack>
              </Box>
              <Box sx={{ position: { xl: 'sticky' }, top: { xl: 88 } }}>
                <CommunicationActionRail items={actionItems} scope={scope} />
              </Box>
            </Box>
          </>
        )}
      </Box>
    </PageCanvas>
  );
}
