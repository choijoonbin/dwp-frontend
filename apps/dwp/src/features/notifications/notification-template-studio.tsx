import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronRight,
  FilePenLine,
  Languages,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createNotificationIdempotencyKey,
  createNotificationTemplateDraft,
  getNotificationTemplateWorkspace,
  previewNotificationTemplate,
  publishNotificationTemplate,
  rejectNotificationTemplateDraft,
  withdrawNotificationTemplateDraft,
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
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { notificationQueryKeys } from './integration-contract';
import { NotificationDraftDecisionDialog } from './notification-draft-decision-dialog';
import { NotificationTemplateComparison } from './notification-governance-comparison';
import { NotificationResponsiveCatalog } from './notification-responsive-catalog';
import { NotificationChannelTemplatePreview } from './notification-template-preview';
import { NotificationTemplateDetailWorkspace } from './notification-template-detail-workspace';
import { notificationAdminFocus } from './notification-admin-focus';

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

function effectivePreviewSamples(variables: string[], locale: string): Record<string, string> {
  let korean = false;
  try {
    korean = new Intl.Locale(locale).language === 'ko';
  } catch {
    korean = false;
  }
  const values: Record<string, string> = {};
  for (const variable of variables) {
    const normalized = variable.toLowerCase();
    values[variable] = normalized.includes('name')
      ? korean
        ? '합성 사용자'
        : 'Synthetic user'
      : normalized.includes('title')
        ? korean
          ? '클라우드 운영 예산'
          : 'Cloud operations budget'
        : normalized.includes('message')
          ? korean
            ? '검토 의견을 남겼습니다.'
            : 'Left a review comment.'
          : normalized.includes('due')
            ? korean
              ? '오늘 오후 5시'
              : 'Today at 5:00 PM'
            : normalized.endsWith('id')
              ? 'sample-001'
              : korean
                ? `예시 ${variable}`
                : `Sample ${variable}`;
  }
  return values;
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
      aria-pressed={selected}
      sx={{
        width: 1,
        minHeight: 76,
        px: 1.75,
        py: 1.25,
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
        <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
          {variant.displayName}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', overflowWrap: 'anywhere' }}
        >
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
      <Stack direction="row" gap={0.75} alignItems="center">
        {variant.publishedOverride && (
          <Typography variant="caption" color="text.secondary">
            {`r${variant.publishedOverride.revision}`}
          </Typography>
        )}
        <ChevronRight size={18} aria-hidden />
      </Stack>
    </ButtonBase>
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
  const content = effectiveContent(variant);
  const effectivePreview = useQuery({
    queryKey: [
      ...notificationQueryKeys.adminTemplates(),
      'effective-preview',
      variantKey(variant),
      revision?.checksum ?? variant.version,
    ],
    queryFn: ({ signal }) =>
      previewNotificationTemplate(
        {
          typeVersionId: variant.typeVersionId,
          channel: variant.channel,
          locale: variant.locale,
          ...content,
          sampleData: effectivePreviewSamples(variant.allowedVariables, variant.locale),
        },
        signal
      ),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return (
    <Box component="section" sx={{ minWidth: 0, p: { xs: 1.5, md: 2 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        gap={1.5}
      >
        <Box minWidth={0}>
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <Chip size="small" variant="outlined" label={variant.appName} />
            <Chip size="small" variant="outlined" label={variant.channel} />
            <Chip size="small" variant="outlined" label={variant.locale} />
          </Stack>
          <Typography component="h2" variant="h6" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
            {variant.displayName}
          </Typography>
          <Typography
            component="code"
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}
          >
            {variant.typeKey}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {revision
              ? t('admin.templates.effectiveTenantRevision', { revision: revision.revision })
              : t('admin.templates.effectiveProviderRevision')}
          </Typography>
          {variant.draft && (
            <ActionButton
              component="a"
              intent="quiet"
              size="small"
              href={`#notification-template-review-${variant.draft.revisionId}`}
            >
              {t('admin.templates.draft')} {`· r${variant.draft.revision}`}
            </ActionButton>
          )}
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

      <NotificationTemplateDetailWorkspace
        variant={variant}
        content={content}
        canManage={canManage}
        onEdit={onEdit}
      >
        <Box sx={{ minWidth: 0 }}>
          {effectivePreview.isLoading ? (
            <LoadingState
              label={t('admin.templates.previewing')}
              variant="skeleton"
              skeletonRows={3}
            />
          ) : effectivePreview.isError || !effectivePreview.data ? (
            <InlineFeedback severity="warning" title={t('admin.templates.effectivePreviewFailed')}>
              <ActionButton
                intent="secondary"
                size="small"
                onClick={() => void effectivePreview.refetch()}
              >
                {t('actions.retry')}
              </ActionButton>
            </InlineFeedback>
          ) : (
            <NotificationChannelTemplatePreview
              variant={variant}
              content={effectivePreview.data.rendered}
              label={t('admin.templates.effectivePreview')}
            />
          )}
        </Box>
      </NotificationTemplateDetailWorkspace>
    </Box>
  );
}

export function NotificationTemplateStudio() {
  const { t } = useTranslation('notifications');
  const auth = useAuth();
  const { hasPermission } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const requestedRevisionId = notificationAdminFocus(searchParams, 'revisionId');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>({
    ...EMPTY_CONTENT,
    changeReason: '',
    samples: {},
  });
  const [renderedPreview, setRenderedPreview] = useState<NotificationTemplatePreview | null>(null);
  const [approvalDraft, setApprovalDraft] = useState<NotificationTemplateRevision | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [withdrawDraft, setWithdrawDraft] = useState<NotificationTemplateRevision | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [rejectDraft, setRejectDraft] = useState<NotificationTemplateRevision | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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
    const requested = requestedRevisionId
      ? variants.find(
          (variant) =>
            variant.draft?.revisionId === requestedRevisionId ||
            variant.publishedOverride?.revisionId === requestedRevisionId
        )
      : null;
    if (requested) {
      setSelectedKey(variantKey(requested));
      setMobileDetailOpen(true);
      return;
    }
    if (!selectedKey && variants.length) setSelectedKey(variantKey(variants[0]));
  }, [requestedRevisionId, selectedKey, variants]);

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
  const withdrawMutation = useMutation({
    mutationFn: ({ draft, reason }: { draft: NotificationTemplateRevision; reason: string }) =>
      withdrawNotificationTemplateDraft(
        draft.revisionId,
        {
          expectedVersion: draft.version,
          reason,
        },
        createNotificationIdempotencyKey('notification-template-retire')
      ),
    onSuccess: async () => {
      setWithdrawDraft(null);
      setWithdrawReason('');
      await refresh();
      toast.success(t('admin.templates.feedback.withdrawn'));
    },
    onError: () => toast.error(t('admin.templates.feedback.withdrawFailed')),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ draft, reason }: { draft: NotificationTemplateRevision; reason: string }) =>
      rejectNotificationTemplateDraft(
        draft.revisionId,
        { expectedVersion: draft.version, reason },
        createNotificationIdempotencyKey('notification-template-reject')
      ),
    onSuccess: async () => {
      setRejectDraft(null);
      setRejectReason('');
      await refresh();
      toast.success(t('admin.templates.feedback.rejected'));
    },
    onError: () => toast.error(t('admin.templates.feedback.rejectFailed')),
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
    <Stack gap={1.5} data-testid="notification-template-studio">
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
          <Box
            sx={{
              mt: 1.25,
              borderBlock: 1,
              borderColor: 'divider',
              maxHeight: 184,
              overflowY: 'auto',
            }}
          >
            {drafts.map((variant) => {
              const draft = variant.draft;
              const selfAuthored = draft.createdBy === auth.user?.userId;
              return (
                <Box
                  key={draft.revisionId}
                  id={`notification-template-review-${draft.revisionId}`}
                  tabIndex={-1}
                  data-testid={`notification-template-review-${draft.revisionId}`}
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
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {draft.changeReason}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {variant.channel} · {variant.locale} ·{' '}
                      {formatDate(draft.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                    {canManage && selfAuthored && (
                      <ActionButton
                        intent="secondary"
                        startIcon={<RotateCcw size={16} />}
                        onClick={() => {
                          setWithdrawDraft(draft);
                          setWithdrawReason('');
                        }}
                        disabled={withdrawMutation.isPending}
                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                      >
                        {t('admin.templates.withdrawDraft')}
                      </ActionButton>
                    )}
                    {canApprove && !selfAuthored && (
                      <ActionButton
                        intent="secondary"
                        startIcon={<XCircle size={16} />}
                        onClick={() => {
                          setRejectDraft(draft);
                          setRejectReason('');
                        }}
                        disabled={rejectMutation.isPending}
                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                      >
                        {t('admin.templates.rejectDraft')}
                      </ActionButton>
                    )}
                    {(canApprove || selfAuthored) && (
                      <ActionButton
                        intent="primary"
                        startIcon={<CheckCircle2 size={16} />}
                        disabled={selfAuthored}
                        onClick={() => setApprovalDraft(draft)}
                        sx={{ width: { xs: '100%', sm: 'auto' } }}
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

      <NotificationResponsiveCatalog
        testId="notification-template-catalog"
        detailOpen={mobileDetailOpen}
        onBack={() => setMobileDetailOpen(false)}
        backLabel={t('admin.backToCatalog')}
        listLabel={t('admin.templates.catalogLabel')}
        detailLabel={t('admin.templates.detailLabel')}
        desktopColumns="minmax(0, .7fr) minmax(0, 2.3fr)"
        listMaxHeight={760}
        list={
          <>
            {variants.map((variant) => (
              <TemplateVariantRow
                key={variantKey(variant)}
                variant={variant}
                selected={variantKey(variant) === variantKey(selected ?? variant)}
                onSelect={() => {
                  setSelectedKey(variantKey(variant));
                  setMobileDetailOpen(true);
                }}
              />
            ))}
          </>
        }
        detail={
          selected && (
            <TemplateDetail variant={selected} canManage={canManage} onEdit={openEditor} />
          )
        }
      />

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
          renderedPreview.warnings.length > 0 ||
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
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.1fr) minmax(0, .9fr)' },
                gap: 2,
              }}
            >
              <Stack gap={1.5} sx={{ minWidth: 0 }}>
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
                  sx={{
                    '& textarea': { typography: 'body2', fontFamily: foundationTokens.font.mono },
                  }}
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
              <Stack
                gap={1.5}
                sx={{ minWidth: 0, alignSelf: 'start', position: { md: 'sticky' }, top: 0 }}
              >
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
                  <Stack gap={1.25}>
                    {renderedPreview.warnings.length > 0 && (
                      <InlineFeedback
                        severity="warning"
                        title={t('admin.templates.validationWarningsTitle')}
                      >
                        <Box component="ul" sx={{ m: 0, mt: 0.75, pl: 2.5 }}>
                          {renderedPreview.warnings.map((warning) => (
                            <Typography component="li" variant="body2" key={warning}>
                              {warning}
                            </Typography>
                          ))}
                        </Box>
                      </InlineFeedback>
                    )}
                    <NotificationChannelTemplatePreview
                      variant={selected}
                      content={renderedPreview.rendered}
                      label={t('admin.templates.renderedPreview')}
                    />
                  </Stack>
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

      <NotificationDraftDecisionDialog
        open={Boolean(withdrawDraft)}
        title={t('admin.templates.withdrawTitle')}
        description={t('admin.templates.withdrawDescription')}
        target={t('admin.templates.withdrawTarget', {
          type: withdrawDraft?.typeKey ?? '',
          revision: withdrawDraft?.revision ?? '',
        })}
        reasonLabel={t('admin.templates.fields.withdrawReason')}
        reasonHelp={t('admin.templates.withdrawReasonHelp')}
        reason={withdrawReason}
        confirmLabel={t('admin.templates.withdrawConfirm')}
        submittingLabel={t('admin.templates.withdrawing')}
        cancelLabel={t('actions.cancel')}
        busy={withdrawMutation.isPending}
        onReasonChange={setWithdrawReason}
        onClose={() => {
          setWithdrawDraft(null);
          setWithdrawReason('');
        }}
        onSubmit={() => {
          if (withdrawDraft) {
            withdrawMutation.mutate({ draft: withdrawDraft, reason: withdrawReason.trim() });
          }
        }}
      />

      <NotificationDraftDecisionDialog
        open={Boolean(rejectDraft)}
        title={t('admin.templates.rejectTitle')}
        description={t('admin.templates.rejectDescription')}
        target={t('admin.templates.rejectTarget', {
          type: rejectDraft?.typeKey ?? '',
          revision: rejectDraft?.revision ?? '',
        })}
        reasonLabel={t('admin.templates.fields.rejectReason')}
        reasonHelp={t('admin.templates.rejectReasonHelp')}
        reason={rejectReason}
        confirmLabel={t('admin.templates.rejectConfirm')}
        submittingLabel={t('admin.templates.rejecting')}
        cancelLabel={t('actions.cancel')}
        busy={rejectMutation.isPending}
        onReasonChange={setRejectReason}
        onClose={() => {
          setRejectDraft(null);
          setRejectReason('');
        }}
        onSubmit={() => {
          if (rejectDraft) {
            rejectMutation.mutate({ draft: rejectDraft, reason: rejectReason.trim() });
          }
        }}
      />

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
            <NotificationTemplateComparison
              current={effectiveContent(approvalVariant)}
              proposed={approvalDraft.content}
              checksum={approvalDraft.checksum}
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
