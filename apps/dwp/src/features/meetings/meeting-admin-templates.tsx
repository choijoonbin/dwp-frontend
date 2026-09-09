import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import {
  ActionButton,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  InlineFeedback,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import { HttpError, usePermissions, useToast } from '@dwp-frontend/shared-utils';
import {
  createVideoMeetingAdminTemplate,
  deleteVideoMeetingAdminTemplate,
  getVideoMeetingAdminTemplate,
  getVideoMeetingAdminTemplates,
  updateVideoMeetingAdminTemplate,
} from '@dwp-frontend/shared-utils/api/video-meeting-admin-templates-api';
import type {
  VideoMeetingTemplate,
  VideoMeetingTemplateInput,
} from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AdminPageHeading, adminPanel } from './meeting-admin-presentation';
import { MeetingAdminSectionNavigation } from './meeting-admin-section-navigation';
import { MeetingTemplateEditor } from './meeting-template-editor';
import { editableMeetingTemplate, emptyMeetingTemplate } from './meeting-template-model';

type Editor = { template?: VideoMeetingTemplate; initial: VideoMeetingTemplateInput };
export function MeetingAdminTemplates({
  identityScope,
  isCurrentScope,
}: {
  identityScope: string;
  isCurrentScope: () => boolean;
}) {
  const { t } = useTranslation('meetings');
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.MEETINGS', 'MANAGE');
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const search = params.get('templateQuery') ?? '';
  const q = useDeferredValue(search.trim());
  const page = Math.max(0, Math.min(10000, Math.floor(Number(params.get('templatePage')) || 0)));
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<VideoMeetingTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'conflict' | 'commandError' | null>(null);
  const [revoked, setRevoked] = useState(false);
  const mounted = useRef(false);
  const authority = useRef(0);
  const currentPermission = useRef(canManage);
  currentPermission.current = canManage;
  const inFlight = useRef(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const listKey = ['meetings', 'admin', 'templates', identityScope] as const;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      authority.current += 1;
    };
  }, []);
  const changeParams = (values: Record<string, string | null>) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  const list = useQuery({
    queryKey: [...listKey, q, page],
    queryFn: ({ signal }) => getVideoMeetingAdminTemplates({ q, page }, signal),
    enabled: !revoked,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  const visible = list.isError || revoked ? [] : (list.data?.items ?? []);
  const selectedId =
    visible.find((item) => item.templateId === params.get('template'))?.templateId ??
    visible[0]?.templateId;
  const detail = useQuery({
    queryKey: [...listKey, 'detail', selectedId],
    queryFn: ({ signal }) => getVideoMeetingAdminTemplate(selectedId!, signal),
    enabled: Boolean(selectedId) && !list.isError && !revoked,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  const selected =
    !detail.isError && !revoked && detail.data?.templateId === selectedId ? detail.data : null;
  const revoke = () => {
    authority.current += 1;
    setRevoked(true);
    setEditor(null);
    setDeleting(null);
    client.removeQueries({ queryKey: listKey });
  };
  useEffect(() => {
    const failure = list.error ?? detail.error;
    if (failure instanceof HttpError && [401, 403].includes(failure.status)) {
      authority.current += 1;
      setRevoked(true);
      setEditor(null);
      setDeleting(null);
    }
  }, [list.error, detail.error]);
  const run = async <T,>(
    fingerprint: string,
    operation: (key: string) => Promise<T>,
    done: (value: T) => void
  ) => {
    if (inFlight.current || revoked || !canManage || list.isError) return;
    const generation = authority.current;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const value = await operation(attempt.current.key);
      if (
        !mounted.current ||
        !isCurrentScope() ||
        generation !== authority.current ||
        !currentPermission.current
      )
        return;
      attempt.current = null;
      done(value);
      await client.invalidateQueries({ queryKey: listKey });
      // Member organization catalogs must re-read the authoritative revision too.
      await client.invalidateQueries({ queryKey: ['meetings', 'templates'] });
    } catch (failure) {
      if (
        !mounted.current ||
        !isCurrentScope() ||
        generation !== authority.current ||
        !currentPermission.current
      )
        return;
      if (failure instanceof HttpError && [401, 403].includes(failure.status)) {
        revoke();
        return;
      }
      const conflict = failure instanceof HttpError && [404, 409].includes(failure.status);
      setError(conflict ? 'conflict' : 'commandError');
      if (conflict) {
        setDeleting(null);
        attempt.current = null;
        void client.invalidateQueries({ queryKey: listKey });
      }
    } finally {
      if (mounted.current && isCurrentScope()) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  const feedback = error ? (
    <InlineFeedback severity={error === 'conflict' ? 'warning' : 'error'}>
      {t('admin.templates.' + error)}
    </InlineFeedback>
  ) : undefined;
  const submit = (input: VideoMeetingTemplateInput) => {
    if (!editor || error === 'conflict') return;
    const original = editor.template;
    if (original && !original.canEdit) return;
    void run(
      JSON.stringify(['save', original?.templateId, original?.version, input]),
      (key) =>
        original
          ? updateVideoMeetingAdminTemplate(original.templateId, input, original.version, key)
          : createVideoMeetingAdminTemplate(input, key),
      (saved) => {
        setEditor(null);
        changeParams({ templateQuery: null, templatePage: null, template: saved.templateId });
        toast.success(t('admin.templates.saved'));
      }
    );
  };
  return (
    <PageCanvas mode="workspace" topInset="compact">
      <MeetingAdminSectionNavigation disabled={busy} />
      <AdminPageHeading
        eyebrow={t('admin.eyebrow')}
        title={t('admin.templates.title')}
        description={t('admin.templates.description')}
        actions={
          <ActionButton
            intent="primary"
            startIcon={<Plus size={16} aria-hidden="true" />}
            sx={{
              minHeight: 44,
              '@media (forced-colors: active)': {
                '&&': {
                  color: 'ButtonText',
                  bgcolor: 'ButtonFace',
                  border: '1px solid ButtonText',
                },
              },
            }}
            disabled={!canManage || revoked || list.isError || list.isPending || busy}
            onClick={() => {
              setError(null);
              setEditor({ initial: emptyMeetingTemplate() });
            }}
          >
            {t('admin.templates.create')}
          </ActionButton>
        }
      />
      {!canManage && (
        <InlineFeedback severity="info">{t('admin.templates.readOnly')}</InlineFeedback>
      )}
      <Stack direction="row" gap={1} sx={{ my: 2 }}>
        <FormField
          fullWidth
          label={t('admin.templates.search')}
          value={search}
          inputProps={{ maxLength: 160 }}
          onChange={(event) =>
            changeParams({ templateQuery: event.target.value, templatePage: null, template: null })
          }
        />
        <ActionButton
          intent="secondary"
          startIcon={<RefreshCw size={16} aria-hidden="true" />}
          disabled={busy || list.isFetching}
          onClick={() => {
            setRevoked(false);
            void client.invalidateQueries({ queryKey: listKey });
          }}
          sx={{ minHeight: 44, flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {t('actions.refresh')}
        </ActionButton>
      </Stack>
      {revoked || list.isError ? (
        <ErrorState
          title={t('admin.templates.loadError')}
          description={t(revoked ? 'admin.templates.accessError' : 'admin.templates.retryHint')}
          retryLabel={t('actions.retry')}
          onRetry={() => {
            setRevoked(false);
            void list.refetch();
          }}
        />
      ) : list.isPending ? (
        <LoadingState label={t('templates.loading')} variant="skeleton" skeletonRows={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={t('admin.templates.empty')}
          description={t('admin.templates.emptyHint')}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(240px,1fr) minmax(0,1.7fr)' },
            gap: 2,
          }}
        >
          <Stack
            component="section"
            aria-label={t('admin.templates.list')}
            gap={0.5}
            sx={(theme) => ({ ...adminPanel(theme), p: 1 })}
          >
            {visible.map((item) => (
              <ActionButton
                key={item.templateId}
                intent={selectedId === item.templateId ? 'secondary' : 'quiet'}
                aria-pressed={selectedId === item.templateId}
                disabled={busy}
                onClick={() => changeParams({ template: item.templateId })}
                sx={{
                  minHeight: 56,
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                }}
              >
                <Box>
                  <Typography component="span" display="block" variant="subtitle2">
                    {item.name}
                  </Typography>
                  <Typography component="span" variant="caption" color="text.secondary">
                    {t('admin.templates.meta', {
                      minutes: item.durationMinutes,
                      version: item.version,
                    })}
                  </Typography>
                </Box>
              </ActionButton>
            ))}
          </Stack>
          <Box
            component="section"
            aria-label={t('admin.templates.detail')}
            sx={(theme) => ({
              ...adminPanel(theme),
              p: { xs: 2, md: 3 },
              overflowWrap: 'anywhere',
            })}
          >
            {detail.isError ? (
              <ErrorState
                title={t('admin.templates.detailError')}
                retryLabel={t('actions.retry')}
                onRetry={() => detail.refetch()}
              />
            ) : !selected ? (
              <LoadingState label={t('templates.loading')} variant="skeleton" skeletonRows={3} />
            ) : (
              <Stack gap={2}>
                <Box>
                  <Typography component="h2" variant="h6">
                    {selected.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selected.purpose || t('admin.templates.noPurpose')}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {t('admin.templates.meta', {
                    minutes: selected.durationMinutes,
                    version: selected.version,
                  })}
                </Typography>
                <Typography component="h3" variant="subtitle2">
                  {t('templates.agenda')}
                </Typography>
                {selected.agendaItems.length === 0 ? (
                  <Typography variant="body2">{t('admin.templates.noAgenda')}</Typography>
                ) : (
                  <Stack component="ol" gap={1.5} sx={{ pl: 3, my: 0 }}>
                    {selected.agendaItems.map((item, index) => (
                      <Box component="li" key={index}>
                        <Typography variant="subtitle2">{item.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.description}
                        </Typography>
                        <Typography variant="caption">
                          {item.role} ·{' '}
                          {t('admin.templates.minutes', { count: item.durationMinutes })}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
                {selected.canEdit && canManage ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                    <ActionButton
                      intent="secondary"
                      disabled={busy || detail.isFetching}
                      sx={{ minHeight: 44 }}
                      onClick={() => {
                        setError(null);
                        setEditor({
                          template: selected,
                          initial: editableMeetingTemplate(selected),
                        });
                      }}
                    >
                      {t('templates.edit')}
                    </ActionButton>
                    <ActionButton
                      intent="quiet"
                      disabled={busy || detail.isFetching}
                      sx={{ minHeight: 44, color: 'error.main' }}
                      onClick={() => {
                        setError(null);
                        setDeleting(selected);
                      }}
                    >
                      {t('templates.delete')}
                    </ActionButton>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('admin.templates.readOnly')}
                  </Typography>
                )}
              </Stack>
            )}
          </Box>
        </Box>
      )}
      {!revoked && !list.isError && list.data && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          sx={{ mt: 2 }}
        >
          <ActionButton
            intent="quiet"
            disabled={busy || page === 0}
            onClick={() =>
              changeParams({ templatePage: page > 1 ? String(page - 1) : null, template: null })
            }
            sx={{ minHeight: 44 }}
          >
            {t('templates.previous')}
          </ActionButton>
          <Typography variant="caption">
            {t('admin.templates.page', { page: page + 1, count: list.data.total })}
          </Typography>
          <ActionButton
            intent="quiet"
            disabled={busy || (page + 1) * list.data.pageSize >= list.data.total}
            onClick={() => changeParams({ templatePage: String(page + 1), template: null })}
            sx={{ minHeight: 44 }}
          >
            {t('actions.next')}
          </ActionButton>
        </Stack>
      )}
      {!editor && !deleting && feedback}
      {editor && (
        <MeetingTemplateEditor
          initial={editor.initial}
          editing={Boolean(editor.template)}
          busy={busy}
          description={t('admin.templates.editorHint')}
          feedback={feedback}
          submitDisabled={error === 'conflict' || list.isError || !canManage}
          onClose={() => {
            setEditor(null);
            setError(null);
          }}
          onSubmit={submit}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('admin.templates.deleteTitle')}
        description={t('admin.templates.deleteHint', { name: deleting?.name })}
        confirmLabel={t('templates.delete')}
        cancelLabel={t('actions.cancel')}
        busy={busy}
        intent="danger"
        onClose={() => {
          setDeleting(null);
          setError(null);
        }}
        onConfirm={() => {
          if (!deleting || error === 'conflict') return;
          void run(
            JSON.stringify(['delete', deleting.templateId, deleting.version]),
            (key) => deleteVideoMeetingAdminTemplate(deleting.templateId, deleting.version, key),
            () => {
              setDeleting(null);
              changeParams({ template: null });
              toast.success(t('admin.templates.deleted'));
            }
          );
        }}
        details={feedback}
      />
    </PageCanvas>
  );
}
