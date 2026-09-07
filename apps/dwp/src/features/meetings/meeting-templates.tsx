import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  LayoutTemplate,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormDialog,
  FormField,
  LoadingState,
  PageCanvas,
  foundationTokens,
} from '@dwp-frontend/design-system';
import { HttpError, useAuth, useToast } from '@dwp-frontend/shared-utils';
import {
  applyVideoMeetingTemplate,
  cloneVideoMeetingTemplate,
  createVideoMeetingTemplate,
  deleteVideoMeetingTemplate,
  favoriteVideoMeetingTemplate,
  getVideoMeetingTemplate,
  getVideoMeetingTemplates,
  updateVideoMeetingTemplate,
  type VideoMeetingTemplate,
  type VideoMeetingTemplateInput,
  type VideoMeetingTemplateScheduleDraft,
} from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import { MeetingTemplateEditor } from './meeting-template-editor';
import { MeetingTemplatePreview } from './meeting-template-preview';
import {
  MEETING_TEMPLATE_CATEGORIES,
  editableMeetingTemplate,
  emptyMeetingTemplate,
  meetingTemplateScope,
  visibleMeetingTemplates,
} from './meeting-template-model';

type Props = { onApplyDraft: (draft: VideoMeetingTemplateScheduleDraft) => void };
type EditorState = { template?: VideoMeetingTemplate; initial: VideoMeetingTemplateInput };

export function MeetingTemplates({ onApplyDraft }: Props) {
  const { user, isAuthenticated } = useAuth();
  const scope = JSON.stringify([
    isAuthenticated,
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
  ]);
  return (
    <MeetingTemplatesContent
      key={scope}
      scope={scope}
      authenticated={isAuthenticated && Boolean(user)}
      onApplyDraft={onApplyDraft}
    />
  );
}

function MeetingTemplatesContent({
  scope,
  authenticated,
  onApplyDraft,
}: Props & { scope: string; authenticated: boolean }) {
  const { t } = useTranslation('meetings');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const filter = meetingTemplateScope(params.get('scope'));
  const search = params.get('q') ?? '';
  const deferredSearch = useDeferredValue(search.trim());
  const page = Math.floor(Math.max(0, Math.min(10000, Number(params.get('page')) || 0)));
  const category = params.get('category') ?? '';
  const favoritesOnly = params.get('favorites') === 'true';
  const [busy, setBusy] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [clone, setClone] = useState<VideoMeetingTemplate | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [deleting, setDeleting] = useState<VideoMeetingTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const mounted = useRef(false);
  const authority = useRef(0);
  const inFlight = useRef(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const listKey = ['meetings', 'templates', scope] as const;
  const query = useQuery({
    queryKey: [...listKey, filter, deferredSearch, page, category, favoritesOnly],
    queryFn: ({ signal }) =>
      getVideoMeetingTemplates(
        { scope: filter, q: deferredSearch, page, pageSize: 30, category, favoritesOnly },
        signal
      ),
    enabled: authenticated && !revoked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    meta: { accessSensitive: true },
  });
  const visible =
    query.isError || revoked
      ? []
      : visibleMeetingTemplates(query.data?.items ?? [], category, favoritesOnly);
  const requestedId = params.get('template');
  const selectedId =
    visible.find((item) => item.templateId === requestedId)?.templateId ?? visible[0]?.templateId;
  const detail = useQuery({
    queryKey: [...listKey, 'detail', selectedId],
    queryFn: ({ signal }) => getVideoMeetingTemplate(selectedId!, signal),
    enabled: authenticated && !revoked && !query.isError && Boolean(selectedId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    meta: { accessSensitive: true },
  });
  const selected =
    !detail.isError && !revoked && detail.data?.templateId === selectedId ? detail.data : null;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      authority.current += 1;
    };
  }, []);
  useEffect(() => {
    const error = query.error ?? detail.error;
    if (error instanceof HttpError && [401, 403].includes(error.status)) {
      authority.current += 1;
      setRevoked(true);
      setEditor(null);
      setClone(null);
      setDeleting(null);
      setPreviewOpen(false);
    }
  }, [query.error, detail.error]);
  useEffect(() => {
    const requestedScope = params.get('scope');
    if (requestedScope === null || ['PERSONAL', 'ORGANIZATION'].includes(requestedScope)) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('scope', 'PERSONAL');
        next.delete('page');
        next.delete('template');
        return next;
      },
      { replace: true }
    );
  }, [params, setParams]);

  const changeParams = (patch: Record<string, string | null>) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        Object.entries(patch).forEach(([key, value]) =>
          value ? next.set(key, value) : next.delete(key)
        );
        return next;
      },
      { replace: true }
    );
  };
  const refresh = async () => {
    setRevoked(false);
    await queryClient.invalidateQueries({ queryKey: listKey });
  };
  const run = async <T,>(
    fingerprint: string,
    operation: (key: string) => Promise<T>,
    complete: (value: T) => void
  ) => {
    if (!authenticated || revoked || query.isError || inFlight.current) return;
    const generation = authority.current;
    inFlight.current = true;
    setBusy(true);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const value = await operation(attempt.current.key);
      if (!mounted.current || generation !== authority.current) return;
      attempt.current = null;
      complete(value);
      await queryClient.invalidateQueries({ queryKey: listKey });
    } catch (error) {
      if (!mounted.current || generation !== authority.current) return;
      if (
        error instanceof HttpError &&
        (error.status === 401 || error.status === 403 || error.status === 404)
      ) {
        setRevoked(true);
        authority.current += 1;
        setEditor(null);
        setClone(null);
        setDeleting(null);
        setPreviewOpen(false);
        queryClient.removeQueries({ queryKey: listKey });
      }
      toast.error(
        t(
          error instanceof HttpError && error.status === 409
            ? 'templates.conflict'
            : 'templates.commandError'
        )
      );
    } finally {
      if (mounted.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  const saved = (template: VideoMeetingTemplate) => {
    setEditor(null);
    setClone(null);
    changeParams({
      scope: 'PERSONAL',
      q: null,
      page: null,
      category: null,
      favorites: null,
      template: template.templateId,
    });
    toast.success(t('templates.saved'));
  };
  const submit = (input: VideoMeetingTemplateInput) => {
    if (!editor || busy) return;
    const original = editor.template;
    if (original && !original.canEdit) return;
    void run(
      JSON.stringify(['save', original?.templateId, original?.version, input]),
      (key) =>
        original
          ? updateVideoMeetingTemplate(original.templateId, input, original.version, key)
          : createVideoMeetingTemplate(input, key),
      saved
    );
  };
  const toggleFavorite = (template: VideoMeetingTemplate) => {
    void run(
      JSON.stringify(['favorite', template.templateId, !template.favorite]),
      (key) => favoriteVideoMeetingTemplate(template.templateId, !template.favorite, key),
      () => toast.success(t('templates.favoriteSaved'))
    );
  };
  const previewProps = (template: VideoMeetingTemplate) => ({
    template,
    busy,
    onApply: () =>
      void run(
        JSON.stringify(['apply', template.templateId, template.version]),
        (key) => applyVideoMeetingTemplate(template.templateId, template.version, key),
        onApplyDraft
      ),
    onClone: () => {
      setClone(template);
      setCloneName(t('templates.cloneName', { name: template.name }).slice(0, 160));
    },
    onEdit: () => {
      if (template.canEdit) setEditor({ template, initial: editableMeetingTemplate(template) });
    },
    onDelete: () => {
      if (template.canEdit) setDeleting(template);
    },
  });

  if (!authenticated)
    return (
      <PageCanvas mode="workspace">
        <ErrorState
          title={t('templates.accessTitle')}
          description={t('templates.accessDescription')}
        />
      </PageCanvas>
    );
  return (
    <PageCanvas mode="workspace" topInset="compact">
      <Box data-testid="meeting-templates">
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          gap={2}
          sx={{ mb: 1.5 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h3"
              component="h1"
              sx={{ typography: { xs: 'h6', lg: 'h3' }, overflowWrap: 'anywhere' }}
            >
              {t('templates.title')}
            </Typography>
          </Box>
          <ActionButton
            intent="primary"
            startIcon={<Plus size={18} aria-hidden="true" />}
            aria-label={t('templates.create')}
            disabled={busy || revoked || query.isError}
            onClick={() => setEditor({ initial: emptyMeetingTemplate() })}
            sx={{
              flexShrink: 0,
              minHeight: { xs: 44, lg: 32 },
              minWidth: { xs: 44, lg: 'auto' },
              '& .MuiButton-startIcon': { mr: { xs: 0, lg: 1 }, ml: { xs: 0, lg: -0.5 } },
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' } }}>
              {t('templates.create')}
            </Box>
          </ActionButton>
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          gap={1.5}
          data-testid="template-mobile-intro"
          sx={(theme) => ({
            display: { xs: 'flex', lg: 'none' },
            position: 'relative',
            isolation: 'isolate',
            minHeight: 96,
            overflow: 'hidden',
            p: 2,
            mb: 1.5,
            color: theme.palette.primary.contrastText,
            backgroundColor: theme.palette.primary.main,
            border: `1px solid ${alpha(theme.palette.primary.contrastText, 0.18)}`,
            borderLeftWidth: 4,
            borderLeftColor: theme.palette.primary.light,
            borderRadius: foundationTokens.radius.surface + 'px',
            boxShadow: 'none',
            '@media (forced-colors: active)': {
              color: 'CanvasText',
              backgroundColor: 'Canvas',
              border: '1px solid CanvasText',
              boxShadow: 'none',
            },
          })}
        >
          <Box
            sx={(theme) => ({
              display: 'grid',
              width: 42,
              height: 42,
              flexShrink: 0,
              placeItems: 'center',
              borderRadius: foundationTokens.radius.control + 'px',
              bgcolor: alpha(theme.palette.common.white, 0.14),
            })}
          >
            <Sparkles size={23} aria-hidden="true" />
          </Box>
          <Typography variant="body2" fontWeight="fontWeightBold" sx={{ maxWidth: 260 }}>
            {t('templates.subtitle')}
          </Typography>
        </Stack>
        <Box
          data-testid="template-search-scope"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,1fr) auto' },
            alignItems: 'center',
            gap: { xs: 1.5, lg: 1 },
            mb: 1.5,
          }}
        >
          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              changeParams({ q: search.trim(), page: null, template: null });
            }}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}
          >
            <FormField
              placeholder={t('templates.search')}
              value={search}
              onChange={(event) =>
                changeParams({ q: event.target.value.slice(0, 160), page: null, template: null })
              }
              size="small"
              inputProps={{ maxLength: 160, 'aria-label': t('templates.search') }}
              sx={{ flex: 1, minWidth: 0 }}
            />
            <ActionIconButton
              label={t('templates.searchAction')}
              type="submit"
              sx={{ minHeight: { xs: 44, lg: 32 }, minWidth: { xs: 44, lg: 32 } }}
            >
              <Search size={18} aria-hidden="true" />
            </ActionIconButton>
            <ActionIconButton
              label={t('actions.refresh')}
              loading={query.isFetching}
              onClick={() => void refresh()}
              sx={{ minHeight: { xs: 44, lg: 32 }, minWidth: { xs: 44, lg: 32 } }}
            >
              <RefreshCw size={18} aria-hidden="true" />
            </ActionIconButton>
          </Box>
          <Tabs
            value={filter}
            onChange={(_, value: string) =>
              changeParams({ scope: value, page: null, template: null })
            }
            variant="scrollable"
            allowScrollButtonsMobile
            aria-label={t('templates.scopeLabel')}
            sx={{
              minHeight: { xs: 44, lg: 32 },
              bgcolor: 'action.hover',
              borderRadius: foundationTokens.radius.surface + 'px',
              '& .MuiTab-root': { minHeight: { xs: 44, lg: 32 }, py: 0.5, px: 1.5, minWidth: 0 },
            }}
          >
            {(['PERSONAL', 'ORGANIZATION'] as const).map((value) => (
              <Tab key={value} value={value} label={t('templates.scopes.' + value)} />
            ))}
          </Tabs>
        </Box>
        <Stack
          direction="row"
          gap={0.75}
          sx={{
            overflowX: 'auto',
            pb: 1,
            mb: 1,
            px: 0.5,
            '& > .MuiButton-root': { flexShrink: 0 },
          }}
          aria-label={t('templates.categoryLabel')}
        >
          <ActionButton
            intent={!category ? 'primary' : 'quiet'}
            size="small"
            onClick={() => changeParams({ category: null, template: null })}
            sx={{ whiteSpace: 'nowrap', minHeight: { xs: 44, md: 32 } }}
          >
            {t('templates.categories.ALL')}
          </ActionButton>
          {MEETING_TEMPLATE_CATEGORIES.map((value) => (
            <ActionButton
              key={value}
              intent={category === value ? 'primary' : 'quiet'}
              size="small"
              onClick={() => changeParams({ category: value, template: null })}
              sx={{ whiteSpace: 'nowrap', minHeight: { xs: 44, md: 32 } }}
            >
              {t('templates.categories.' + value)}
            </ActionButton>
          ))}
          <ActionButton
            intent={favoritesOnly ? 'primary' : 'quiet'}
            size="small"
            startIcon={<Star size={14} aria-hidden="true" />}
            onClick={() =>
              changeParams({ favorites: favoritesOnly ? null : 'true', template: null })
            }
            sx={{ whiteSpace: 'nowrap', minHeight: { xs: 44, md: 32 } }}
          >
            {t('templates.favorites')}
          </ActionButton>
        </Stack>
        {query.isError || revoked ? (
          <ErrorState
            title={t('templates.loadError')}
            description={t('templates.accessDescription')}
            retryLabel={t('actions.retry')}
            onRetry={() => void refresh()}
          />
        ) : query.isPending ? (
          <LoadingState label={t('templates.loading')} variant="skeleton" skeletonRows={4} />
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              {t('templates.resultCount', { count: query.data?.total ?? 0 })}
            </Typography>
            {!visible.length ? (
              <EmptyState
                title={t('templates.emptyTitle')}
                description={t('templates.emptyDescription')}
                actionLabel={t('templates.clearFilters')}
                onAction={() => {
                  changeParams({ q: null, category: null, favorites: null, page: null });
                }}
              />
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,5fr) minmax(0,7fr)' },
                  gap: 2,
                  alignItems: 'start',
                }}
              >
                <Stack
                  gap={1}
                  component="section"
                  aria-label={t('templates.listLabel')}
                  data-testid="template-list"
                >
                  {visible.map((template) => {
                    const active = selectedId === template.templateId;
                    return (
                      <Box
                        key={template.templateId}
                        component="article"
                        sx={(theme) => ({
                          p: 1.5,
                          bgcolor: active
                            ? alpha(theme.palette.primary.main, 0.055)
                            : 'background.paper',
                          border: 1,
                          borderColor: active ? 'primary.main' : 'divider',
                          borderRadius: foundationTokens.radius.surface + 'px',
                          minWidth: 0,
                        })}
                      >
                        <Stack direction="row" alignItems="start" gap={1}>
                          <Box sx={{ color: 'primary.main', mt: 1 }}>
                            <LayoutTemplate size={20} aria-hidden="true" />
                          </Box>
                          <ActionButton
                            intent="quiet"
                            disabled={busy}
                            onClick={() => changeParams({ template: template.templateId })}
                            aria-pressed={active}
                            sx={{
                              p: 0,
                              textAlign: 'left',
                              justifyContent: 'start',
                              flex: 1,
                              minWidth: 0,
                              color: 'text.primary',
                            }}
                          >
                            <Box sx={{ minWidth: 0, py: 0.5 }}>
                              <Typography
                                variant="h6"
                                component="h2"
                                sx={(theme) => ({
                                  typography: { xs: active ? 'subtitle1' : 'subtitle2', lg: 'h6' },
                                  fontWeight: theme.typography.subtitle1.fontWeight,
                                  overflowWrap: 'anywhere',
                                })}
                              >
                                {template.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', mt: 0.5 }}
                              >
                                {t('templates.scopes.' + template.scope)} ·{' '}
                                {t('units.minutes', { count: template.durationMinutes })}
                              </Typography>
                            </Box>
                          </ActionButton>
                          <ActionIconButton
                            label={t(
                              template.favorite ? 'templates.unfavorite' : 'templates.favorite'
                            )}
                            aria-pressed={template.favorite}
                            disabled={busy}
                            onClick={() => toggleFavorite(template)}
                          >
                            <Star
                              size={18}
                              fill={template.favorite ? 'currentColor' : 'none'}
                              aria-hidden="true"
                            />
                          </ActionIconButton>
                        </Stack>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mt: 1,
                            overflowWrap: 'anywhere',
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 2,
                            overflow: 'hidden',
                          }}
                        >
                          {template.purpose}
                        </Typography>
                        <Stack
                          direction="row"
                          gap={1}
                          alignItems="center"
                          flexWrap="wrap"
                          sx={{ mt: 1 }}
                        >
                          <Chip
                            size="small"
                            label={t('templates.agendaCount', {
                              count: template.agendaItems.length,
                            })}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {t('templates.version', { version: template.version })}
                          </Typography>
                        </Stack>
                        {active && (
                          <Box sx={{ display: { xs: 'block', lg: 'none' }, mt: 2 }}>
                            {detail.isError ? (
                              <ErrorState
                                size="compact"
                                title={t('templates.detailError')}
                                retryLabel={t('actions.retry')}
                                onRetry={() => void detail.refetch()}
                              />
                            ) : selected ? (
                              <MeetingTemplatePreview
                                compact
                                {...previewProps(selected)}
                                onFullPreview={() => setPreviewOpen(true)}
                              />
                            ) : (
                              <LoadingState label={t('templates.loading')} size="compact" />
                            )}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
                <Box
                  component="section"
                  aria-label={t('templates.previewLabel')}
                  data-testid="template-preview"
                  sx={{
                    display: { xs: 'none', lg: 'block' },
                    minWidth: 0,
                    bgcolor: 'background.paper',
                    p: 3,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: foundationTokens.radius.surface + 'px',
                  }}
                >
                  {detail.isError ? (
                    <ErrorState
                      title={t('templates.detailError')}
                      retryLabel={t('actions.retry')}
                      onRetry={() => void detail.refetch()}
                    />
                  ) : selected ? (
                    <MeetingTemplatePreview {...previewProps(selected)} />
                  ) : (
                    <LoadingState
                      label={t('templates.loading')}
                      variant="skeleton"
                      skeletonRows={3}
                    />
                  )}
                </Box>
              </Box>
            )}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
              sx={{ mt: 2 }}
            >
              <ActionButton
                intent="quiet"
                startIcon={<ArrowLeft size={16} aria-hidden="true" />}
                disabled={page === 0 || busy}
                onClick={() => changeParams({ page: String(page - 1), template: null })}
              >
                {t('templates.previous')}
              </ActionButton>
              <Typography variant="caption">{t('templates.page', { page: page + 1 })}</Typography>
              <ActionButton
                intent="quiet"
                endIcon={<ArrowRight size={16} aria-hidden="true" />}
                disabled={(page + 1) * 30 >= (query.data?.total ?? 0) || busy}
                onClick={() => changeParams({ page: String(page + 1), template: null })}
              >
                {t('templates.next')}
              </ActionButton>
            </Stack>
          </>
        )}
        <FormDialog
          open={previewOpen && Boolean(selected) && !revoked}
          title={t('templates.previewLabel')}
          cancelLabel={t('actions.cancel')}
          submitLabel={t('templates.closePreview')}
          busy={busy}
          onClose={() => setPreviewOpen(false)}
          onSubmit={() => setPreviewOpen(false)}
          maxWidth="sm"
        >
          {selected && <MeetingTemplatePreview {...previewProps(selected)} />}
        </FormDialog>
        {editor && !revoked && (
          <MeetingTemplateEditor
            key={editor.template?.templateId ?? 'new'}
            initial={editor.initial}
            editing={Boolean(editor.template)}
            busy={busy}
            onClose={() => setEditor(null)}
            onSubmit={submit}
          />
        )}
        <FormDialog
          open={Boolean(clone) && !revoked}
          title={t('templates.clone')}
          description={t('templates.cloneDescription')}
          cancelLabel={t('actions.cancel')}
          submitLabel={t('templates.clone')}
          busy={busy}
          submitDisabled={!cloneName.trim() || cloneName.length > 160}
          onClose={() => setClone(null)}
          onSubmit={() => {
            if (clone && cloneName.trim())
              void run(
                JSON.stringify(['clone', clone.templateId, clone.version, cloneName.trim()]),
                (key) =>
                  cloneVideoMeetingTemplate(clone.templateId, cloneName.trim(), clone.version, key),
                saved
              );
          }}
        >
          <FormField
            autoFocus
            required
            label={t('templates.fields.name')}
            value={cloneName}
            inputProps={{ maxLength: 160 }}
            onChange={(event) => setCloneName(event.target.value)}
          />
        </FormDialog>
        <ConfirmDialog
          open={Boolean(deleting) && !revoked}
          title={t('templates.deleteTitle')}
          description={t('templates.deleteDescription')}
          cancelLabel={t('actions.cancel')}
          confirmLabel={t('templates.delete')}
          intent="danger"
          busy={busy}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            if (deleting?.canEdit)
              void run(
                JSON.stringify(['delete', deleting.templateId, deleting.version]),
                (key) => deleteVideoMeetingTemplate(deleting.templateId, deleting.version, key),
                () => {
                  setDeleting(null);
                  changeParams({ template: null });
                  toast.success(t('templates.deleted'));
                }
              );
          }}
        />
      </Box>
    </PageCanvas>
  );
}
