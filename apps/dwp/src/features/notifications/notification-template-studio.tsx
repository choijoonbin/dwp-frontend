import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Braces,
  CheckCircle2,
  FilePenLine,
  Languages,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createNotificationIdempotencyKey,
  createNotificationTemplateDraft,
  getNotificationTemplateWorkspace,
  previewNotificationTemplate,
  publishNotificationTemplate,
  retireNotificationTemplateDraft,
  type NotificationTemplateContent,
  type NotificationTemplatePreview,
  type NotificationTemplateRevision,
  type NotificationTemplateVariant,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { useAuth, usePermissions, useToast } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  FormDialog,
  FormField,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { notificationQueryKeys } from './integration-contract';

type EditorState = NotificationTemplateContent & {
  changeReason: string;
  samples: Record<string, string>;
};

const EMPTY_CONTENT: NotificationTemplateContent = {
  title: '',
  preview: '',
  body: '',
  actionLabel: '',
};

function variantKey(variant: NotificationTemplateVariant) {
  return `${variant.typeVersionId}:${variant.channel}:${variant.locale}`;
}

function effectiveRevision(variant: NotificationTemplateVariant) {
  return variant.publishedOverride ?? null;
}

function effectiveContent(variant: NotificationTemplateVariant) {
  return effectiveRevision(variant)?.content ?? variant.providerDefault;
}

function nextVersion(variant: NotificationTemplateVariant) {
  return variant.version;
}

function TemplateVariantRow({
  variant,
  selected,
  onSelect,
}: {
  variant: NotificationTemplateVariant;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('notifications');
  return (
    <ButtonBase
      onClick={onSelect}
      aria-current={selected ? 'page' : undefined}
      sx={{
        width: 1,
        minHeight: 84,
        px: 1.75,
        py: 1.35,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 1,
        textAlign: 'left',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: selected ? 'action.selected' : 'transparent',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box minWidth={0}>
        <Typography variant="subtitle2" noWrap>
          {variant.displayName}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {variant.appName} · {variant.channel} · {variant.locale}
        </Typography>
        <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
          <Chip
            size="small"
            variant="outlined"
            color={variant.publishedOverride ? 'info' : 'default'}
            label={t(
              variant.publishedOverride
                ? 'admin.templates.tenantOverride'
                : 'admin.templates.providerDefault'
            )}
          />
          {variant.draft && (
            <Chip
              size="small"
              variant="outlined"
              color="warning"
              label={t('admin.templates.draft')}
            />
          )}
        </Stack>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {variant.publishedOverride ? `r${variant.publishedOverride.revision}` : 'P'}
      </Typography>
    </ButtonBase>
  );
}

function TemplatePreviewCard({
  variant,
  content,
  label,
}: {
  variant: NotificationTemplateVariant;
  content: NotificationTemplateContent;
  label: string;
}) {
  const { t } = useTranslation('notifications');
  return (
    <Box component="section" aria-label={label} sx={{ borderBlock: 1, borderColor: 'divider' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1 }}>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Chip size="small" variant="outlined" label={variant.channel} />
      </Stack>
      <Box sx={{ py: 2, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 1.5 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1,
            bgcolor: 'primary.50',
            color: 'primary.main',
          }}
        >
          <Languages size={19} />
        </Box>
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary">
            {variant.appName}
          </Typography>
          <Typography variant="subtitle1" sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>
            {content.title || t('admin.templates.emptyContent')}
          </Typography>
          {content.preview && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {content.preview}
            </Typography>
          )}
          <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
            {content.body || t('admin.templates.emptyContent')}
          </Typography>
          {content.actionLabel && (
            <ActionButton intent="quiet" size="small" sx={{ mt: 1, px: 0 }}>
              {content.actionLabel}
            </ActionButton>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function TemplateDetail({
  variant,
  canManage,
  onEdit,
}: {
  variant: NotificationTemplateVariant;
  canManage: boolean;
  onEdit: (content?: NotificationTemplateContent) => void;
}) {
  const { t } = useTranslation('notifications');
  const revision = effectiveRevision(variant);
  return (
    <Box component="section" sx={{ minWidth: 0, p: { xs: 2, md: 2.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
        <Box minWidth={0}>
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <Chip size="small" variant="outlined" label={variant.appName} />
            <Chip size="small" variant="outlined" label={variant.channel} />
            <Chip size="small" variant="outlined" label={variant.locale} />
          </Stack>
          <Typography component="h2" variant="h5" sx={{ mt: 1.25, overflowWrap: 'anywhere' }}>
            {variant.typeKey}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {revision
              ? t('admin.templates.effectiveTenantRevision', { revision: revision.revision })
              : t('admin.templates.effectiveProviderRevision')}
          </Typography>
        </Box>
        {canManage && (
          <ActionButton
            intent="secondary"
            startIcon={<FilePenLine size={17} />}
            onClick={() => onEdit()}
            disabled={Boolean(variant.draft)}
          >
            {variant.draft
              ? t('admin.templates.openDraftExists')
              : t('admin.templates.proposeOverride')}
          </ActionButton>
        )}
      </Stack>

      <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ my: 2 }}>
        <Braces size={18} aria-hidden />
        {variant.allowedVariables.length > 0 ? (
          variant.allowedVariables.map((variable) => (
            <Chip key={variable} size="small" variant="outlined" label={`{{${variable}}}`} />
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t('admin.templates.noVariables')}
          </Typography>
        )}
      </Stack>

      <TemplatePreviewCard
        variant={variant}
        content={effectiveContent(variant)}
        label={t('admin.templates.effectivePreview')}
      />

      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {[
          [
            t('admin.templates.fields.source'),
            t(revision ? 'admin.templates.tenantOverride' : 'admin.templates.providerDefault'),
          ],
          [t('admin.templates.fields.revision'), revision ? `r${revision.revision}` : 'Provider'],
          [
            t('admin.templates.fields.approvedAt'),
            revision?.approvedAt
              ? formatDate(revision.approvedAt, { dateStyle: 'medium', timeStyle: 'short' })
              : '—',
          ],
        ].map(([term, value]) => (
          <Box key={term} sx={{ py: 1.25, pr: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography component="dt" variant="caption" color="text.secondary">
              {term}
            </Typography>
            <Typography component="dd" variant="body2" fontWeight={700} sx={{ m: 0, mt: 0.35 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      {variant.history.length > 0 && (
        <Box component="section" sx={{ mt: 2.5 }}>
          <Typography component="h3" variant="subtitle1">
            {t('admin.templates.historyTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {t('admin.templates.historyDescription')}
          </Typography>
          <Box sx={{ mt: 1, borderBlock: 1, borderColor: 'divider' }}>
            {variant.history.slice(0, 8).map((item) => {
              const current = revision?.revisionId === item.revisionId;
              const restorable = item.state === 'PUBLISHED' && !current && !variant.draft;
              return (
                <Box
                  key={item.revisionId}
                  sx={{
                    minHeight: 58,
                    py: 1,
                    display: 'grid',
                    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                    gap: 1,
                    alignItems: 'center',
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:last-of-type': { borderBottom: 0 },
                  }}
                >
                  <Chip
                    size="small"
                    variant="outlined"
                    color={current ? 'success' : item.state === 'DRAFT' ? 'warning' : 'default'}
                    label={`r${item.revision}`}
                  />
                  <Box minWidth={0}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {t(`admin.templates.state.${item.state}`)}
                      {current ? ` · ${t('admin.templates.current')}` : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {item.changeReason} ·{' '}
                      {formatDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    </Typography>
                  </Box>
                  {canManage && restorable && (
                    <ActionButton intent="quiet" size="small" onClick={() => onEdit(item.content)}>
                      {t('admin.templates.proposeRestore')}
                    </ActionButton>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}

export function NotificationTemplateStudio() {
  const { t } = useTranslation('notifications');
  const auth = useAuth();
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>({
    ...EMPTY_CONTENT,
    changeReason: '',
    samples: {},
  });
  const [renderedPreview, setRenderedPreview] = useState<NotificationTemplatePreview | null>(null);
  const [approvalDraft, setApprovalDraft] = useState<NotificationTemplateRevision | null>(null);
  const [decisionReason, setDecisionReason] = useState('');

  const canManage = hasPermission('ADMIN.NOTIFICATION_TEMPLATE', 'MANAGE');
  const canApprove = hasPermission('ADMIN.NOTIFICATION_TEMPLATE', 'APPROVE');
  const workspace = useQuery({
    queryKey: notificationQueryKeys.adminTemplates(),
    queryFn: ({ signal }) => getNotificationTemplateWorkspace(signal),
    staleTime: 20_000,
    retry: 1,
  });
  const variants = useMemo(() => workspace.data?.items ?? [], [workspace.data]);
  const selected = useMemo(
    () => variants.find((variant) => variantKey(variant) === selectedKey) ?? variants[0] ?? null,
    [selectedKey, variants]
  );
  const drafts = variants.filter(
    (variant): variant is NotificationTemplateVariant & { draft: NotificationTemplateRevision } =>
      Boolean(variant.draft)
  );
  const approvalVariant = approvalDraft
    ? (variants.find(
        (variant) =>
          variant.typeVersionId === approvalDraft.typeVersionId &&
          variant.channel === approvalDraft.channel &&
          variant.locale === approvalDraft.locale
      ) ?? null)
    : null;

  useEffect(() => {
    if (!selectedKey && variants.length) setSelectedKey(variantKey(variants[0]));
  }, [selectedKey, variants]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.adminTemplates() });
  };
  const previewMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('No template variant selected.');
      return previewNotificationTemplate({
        typeVersionId: selected.typeVersionId,
        channel: selected.channel,
        locale: selected.locale,
        title: editor.title,
        preview: editor.preview,
        body: editor.body,
        actionLabel: editor.actionLabel,
        sampleData: editor.samples,
      });
    },
    onSuccess: setRenderedPreview,
    onError: () => toast.error(t('admin.templates.feedback.previewFailed')),
  });
  const draftMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('No template variant selected.');
      return createNotificationTemplateDraft(
        {
          typeVersionId: selected.typeVersionId,
          channel: selected.channel,
          locale: selected.locale,
          title: editor.title,
          preview: editor.preview,
          body: editor.body,
          actionLabel: editor.actionLabel,
          changeReason: editor.changeReason,
          expectedVersion: nextVersion(selected),
        },
        createNotificationIdempotencyKey('notification-template-draft')
      );
    },
    onSuccess: async () => {
      setEditorOpen(false);
      setRenderedPreview(null);
      await refresh();
      toast.success(t('admin.templates.feedback.draftCreated'));
    },
    onError: () => toast.error(t('admin.templates.feedback.draftFailed')),
  });
  const publishMutation = useMutation({
    mutationFn: ({ draft, reason }: { draft: NotificationTemplateRevision; reason: string }) =>
      publishNotificationTemplate(
        draft.revisionId,
        { expectedVersion: draft.version, reason },
        createNotificationIdempotencyKey('notification-template-publish')
      ),
    onSuccess: async () => {
      setApprovalDraft(null);
      setDecisionReason('');
      await refresh();
      toast.success(t('admin.templates.feedback.published'));
    },
    onError: () => toast.error(t('admin.templates.feedback.publishFailed')),
  });
  const retireMutation = useMutation({
    mutationFn: (draft: NotificationTemplateRevision) =>
      retireNotificationTemplateDraft(
        draft.revisionId,
        {
          expectedVersion: draft.version,
          reason: t('admin.templates.retireReason'),
        },
        createNotificationIdempotencyKey('notification-template-retire')
      ),
    onSuccess: async () => {
      await refresh();
      toast.success(t('admin.templates.feedback.retired'));
    },
    onError: () => toast.error(t('admin.templates.feedback.retireFailed')),
  });

  const openEditor = (content?: NotificationTemplateContent) => {
    if (!selected) return;
    setEditor({
      ...(content ?? effectiveContent(selected)),
      changeReason: '',
      samples: Object.fromEntries(selected.allowedVariables.map((variable) => [variable, ''])),
    });
    setRenderedPreview(null);
    setEditorOpen(true);
  };

  if (workspace.isLoading) {
    return (
      <LoadingState label={t('states.loadingTemplates')} variant="skeleton" skeletonRows={8} />
    );
  }
  if (workspace.isError || !workspace.data) {
    return (
      <ErrorState
        title={t('states.templatesErrorTitle')}
        description={t('states.templatesErrorDescription')}
        retryLabel={t('actions.retry')}
        onRetry={() => void workspace.refetch()}
        retrying={workspace.isFetching}
      />
    );
  }
  if (variants.length === 0) {
    return (
      <EmptyState
        icon={<Languages size={28} />}
        title={t('admin.templates.emptyTitle')}
        description={t('admin.templates.emptyDescription')}
        size="page"
      />
    );
  }

  return (
    <Stack gap={2.5}>
      <Alert severity="info" icon={<ShieldCheck size={18} />}>
        {t('admin.templates.governanceNotice')}
      </Alert>

      {drafts.length > 0 && (
        <Box component="section">
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Box>
              <Typography component="h2" variant="h6">
                {t('admin.templates.reviewQueueTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('admin.templates.reviewQueueDescription')}
              </Typography>
            </Box>
            <Chip size="small" variant="outlined" label={drafts.length} />
          </Stack>
          <Box sx={{ mt: 1.25, borderBlock: 1, borderColor: 'divider' }}>
            {drafts.map((variant) => {
              const draft = variant.draft;
              const selfAuthored = draft.createdBy === auth.user?.userId;
              return (
                <Box
                  key={draft.revisionId}
                  sx={{
                    minHeight: 76,
                    px: 1.5,
                    py: 1.2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                    gap: 1.25,
                    alignItems: 'center',
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:last-of-type': { borderBottom: 0 },
                  }}
                >
                  <Box minWidth={0}>
                    <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle2">{variant.typeKey}</Typography>
                      <Chip
                        size="small"
                        color="warning"
                        variant="outlined"
                        label={`r${draft.revision}`}
                      />
                      {selfAuthored && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t('admin.templates.authoredByMe')}
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {draft.changeReason}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {variant.channel} · {variant.locale} ·{' '}
                      {formatDate(draft.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    </Typography>
                  </Box>
                  <Stack direction="row" gap={1}>
                    {canManage && (
                      <ActionButton
                        intent="secondary"
                        startIcon={<RotateCcw size={16} />}
                        onClick={() => retireMutation.mutate(draft)}
                        disabled={retireMutation.isPending}
                      >
                        {t('admin.templates.retireDraft')}
                      </ActionButton>
                    )}
                    {canApprove && (
                      <ActionButton
                        intent="primary"
                        startIcon={<CheckCircle2 size={16} />}
                        disabled={selfAuthored}
                        onClick={() => setApprovalDraft(draft)}
                      >
                        {selfAuthored
                          ? t('admin.templates.independentApprovalRequired')
                          : t('admin.templates.reviewAndPublish')}
                      </ActionButton>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(300px, .85fr) minmax(0, 2.15fr)' },
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{ borderRight: { lg: 1 }, borderColor: 'divider', maxHeight: 760, overflowY: 'auto' }}
        >
          {variants.map((variant) => (
            <TemplateVariantRow
              key={variantKey(variant)}
              variant={variant}
              selected={variantKey(variant) === variantKey(selected ?? variant)}
              onSelect={() => setSelectedKey(variantKey(variant))}
            />
          ))}
        </Box>
        {selected && (
          <TemplateDetail variant={selected} canManage={canManage} onEdit={openEditor} />
        )}
      </Box>

      <FormDialog
        open={editorOpen}
        title={t('admin.templates.editorTitle', { type: selected?.typeKey ?? '' })}
        description={t('admin.templates.editorDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('admin.templates.createDraft')}
        submittingLabel={t('admin.templates.creatingDraft')}
        busy={draftMutation.isPending}
        submitDisabled={
          !renderedPreview ||
          editor.title.trim().length === 0 ||
          editor.body.trim().length === 0 ||
          editor.changeReason.trim().length < 10
        }
        onClose={() => setEditorOpen(false)}
        onSubmit={() => draftMutation.mutate()}
        maxWidth="lg"
      >
        {selected && (
          <Stack gap={2}>
            <Alert severity="warning" icon={<LockKeyhole size={18} />}>
              {t('admin.templates.editorGovernanceNotice')}
            </Alert>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(320px, .8fr)' },
                gap: 2.5,
              }}
            >
              <Stack gap={1.5}>
                <FormField
                  label={t('admin.templates.fields.title')}
                  value={editor.title}
                  onChange={(event) => {
                    setRenderedPreview(null);
                    setEditor((current) => ({ ...current, title: event.target.value }));
                  }}
                  required
                />
                <FormField
                  label={t('admin.templates.fields.preview')}
                  value={editor.preview}
                  onChange={(event) => {
                    setRenderedPreview(null);
                    setEditor((current) => ({ ...current, preview: event.target.value }));
                  }}
                  multiline
                  minRows={2}
                />
                <FormField
                  label={t('admin.templates.fields.body')}
                  value={editor.body}
                  onChange={(event) => {
                    setRenderedPreview(null);
                    setEditor((current) => ({ ...current, body: event.target.value }));
                  }}
                  multiline
                  minRows={5}
                  required
                />
                <FormField
                  label={t('admin.templates.fields.actionLabel')}
                  value={editor.actionLabel}
                  onChange={(event) => {
                    setRenderedPreview(null);
                    setEditor((current) => ({ ...current, actionLabel: event.target.value }));
                  }}
                />
                <Divider />
                {selected.allowedVariables.map((variable) => (
                  <FormField
                    key={variable}
                    label={`{{${variable}}}`}
                    value={editor.samples[variable] ?? ''}
                    onChange={(event) => {
                      setRenderedPreview(null);
                      setEditor((current) => ({
                        ...current,
                        samples: { ...current.samples, [variable]: event.target.value },
                      }));
                    }}
                    supportingText={t('admin.templates.sampleValueHelp')}
                  />
                ))}
                <FormField
                  label={t('admin.templates.fields.changeReason')}
                  value={editor.changeReason}
                  onChange={(event) =>
                    setEditor((current) => ({ ...current, changeReason: event.target.value }))
                  }
                  multiline
                  minRows={3}
                  required
                  supportingText={t('admin.templates.changeReasonHelp')}
                />
              </Stack>
              <Stack gap={1.5}>
                <ActionButton
                  intent="secondary"
                  startIcon={<Sparkles size={17} />}
                  onClick={() => previewMutation.mutate()}
                  disabled={
                    previewMutation.isPending ||
                    editor.title.trim().length === 0 ||
                    editor.body.trim().length === 0
                  }
                >
                  {previewMutation.isPending
                    ? t('admin.templates.previewing')
                    : t('admin.templates.validateAndPreview')}
                </ActionButton>
                {renderedPreview ? (
                  <TemplatePreviewCard
                    variant={selected}
                    content={renderedPreview.rendered}
                    label={t('admin.templates.renderedPreview')}
                  />
                ) : (
                  <Box
                    sx={{
                      minHeight: 240,
                      p: 3,
                      display: 'grid',
                      placeItems: 'center',
                      border: 1,
                      borderStyle: 'dashed',
                      borderColor: 'divider',
                      textAlign: 'center',
                    }}
                  >
                    <Box>
                      <Sparkles size={24} />
                      <Typography variant="subtitle2" sx={{ mt: 1 }}>
                        {t('admin.templates.previewEmptyTitle')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('admin.templates.previewEmptyDescription')}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Stack>
            </Box>
          </Stack>
        )}
      </FormDialog>

      <FormDialog
        open={Boolean(approvalDraft)}
        title={t('admin.templates.approvalTitle')}
        description={t('admin.templates.approvalDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('admin.templates.publish')}
        submittingLabel={t('admin.templates.publishing')}
        busy={publishMutation.isPending}
        submitDisabled={decisionReason.trim().length < 10}
        onClose={() => setApprovalDraft(null)}
        onSubmit={() => {
          if (approvalDraft) {
            publishMutation.mutate({ draft: approvalDraft, reason: decisionReason.trim() });
          }
        }}
        maxWidth="md"
      >
        {approvalDraft && approvalVariant && (
          <Stack gap={2}>
            <Alert severity="warning" icon={<ShieldCheck size={18} />}>
              {t('admin.templates.makerCheckerApproval')}
            </Alert>
            <TemplatePreviewCard
              variant={approvalVariant}
              content={approvalDraft.content}
              label={t('admin.templates.proposedPreview')}
            />
            <Typography variant="body2" color="text.secondary">
              {approvalDraft.changeReason}
            </Typography>
            <FormField
              label={t('admin.templates.fields.approvalReason')}
              value={decisionReason}
              onChange={(event) => setDecisionReason(event.target.value)}
              multiline
              minRows={3}
              required
              supportingText={t('admin.templates.approvalReasonHelp')}
            />
          </Stack>
        )}
      </FormDialog>
    </Stack>
  );
}
