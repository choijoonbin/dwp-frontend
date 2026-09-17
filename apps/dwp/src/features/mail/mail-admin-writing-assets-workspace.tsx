import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilePlus2, FileText, PenLine, RefreshCw, Send, Signature } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  createMailOrganizationWritingAssetDraft,
  getMailOrganizationWritingAssets,
  HttpError,
  transitionMailOrganizationWritingAsset,
  updateMailOrganizationWritingAssetDraft,
  useAuth,
  usePermissions,
  useProductSurfaceAuthority,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  FormDialog,
  FormField,
  GuidedEmptyState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { MailPageHeading } from './mail-components';
import { canUseMailWritingAssetAdminAction } from './mail-admin-writing-asset-policy';
import { MailMessageBodyField, type MailMessageBodyFieldHandle } from './mail-message-body-field';
import {
  MAIL_WRITING_ASSET_VARIABLES,
  mailWritingAssetVariableToken,
} from './mail-writing-asset-content';
import {
  mailWritingAssetCommandKey,
  mailWritingAssetDraftFingerprint,
  mailWritingAssetTransitionFingerprint,
} from './mail-writing-asset-command-key';

import type {
  MailOrganizationWritingAsset,
  MailOrganizationWritingAssetDraftInput,
  MailOrganizationWritingAssetKind,
  MailOrganizationWritingAssetState,
} from '@dwp-frontend/shared-utils';

type Editor = {
  kind: MailOrganizationWritingAssetKind;
  asset: MailOrganizationWritingAsset | null;
  supersedes: MailOrganizationWritingAsset | null;
};

type ConfirmingTransition = {
  asset: MailOrganizationWritingAsset;
  action: 'publish' | 'retire';
};

type SaveCommand = {
  input: MailOrganizationWritingAssetDraftInput;
  fingerprint: string;
};

const EMPTY_FORM: MailOrganizationWritingAssetDraftInput = {
  name: '',
  subject: '',
  body: '',
  bodyFormat: 'TEXT',
  mandatoryContent: '',
  defaultForNew: false,
  defaultForReply: false,
  supersedesId: null,
  version: null,
};

const STATES: Array<MailOrganizationWritingAssetState | ''> = [
  '',
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PUBLISHED',
  'RETIRED',
];

export function MailAdminWritingAssetsWorkspace() {
  const { t, i18n } = useTranslation('mail');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const toast = useToast();
  const auth = useAuth();
  const { hasPermission } = usePermissions();
  const authority = useProductSurfaceAuthority();
  const queryClient = useQueryClient();
  const saveCommandKeys = useRef(new Map<string, string>());
  const transitionCommandKeys = useRef(new Map<string, string>());
  const [kind, setKind] = useState<MailOrganizationWritingAssetKind>('TEMPLATE');
  const [state, setState] = useState<MailOrganizationWritingAssetState | ''>('');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saveConflict, setSaveConflict] = useState(false);
  const [confirmingTransition, setConfirmingTransition] = useState<ConfirmingTransition | null>(
    null
  );
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const mayEdit = hasPermission('ADMIN.MAIL', 'WRITING_ASSET_EDIT');
  const maySubmit = hasPermission('ADMIN.MAIL', 'WRITING_ASSET_SUBMIT');
  const mayApprove = hasPermission('ADMIN.MAIL', 'WRITING_ASSET_APPROVE');
  const mayPublish = hasPermission('ADMIN.MAIL', 'WRITING_ASSET_PUBLISH');
  const mayRetire = hasPermission('ADMIN.MAIL', 'WRITING_ASSET_RETIRE');
  const mayMutate = mayEdit || maySubmit || mayApprove || mayPublish || mayRetire;
  const canEdit = canUseMailWritingAssetAdminAction({ action: 'edit', elevated, hasPermission });
  const canSubmit = canUseMailWritingAssetAdminAction({
    action: 'submit',
    elevated,
    hasPermission,
  });
  const canPublish = canUseMailWritingAssetAdminAction({
    action: 'publish',
    elevated,
    hasPermission,
  });
  const canRetire = canUseMailWritingAssetAdminAction({
    action: 'retire',
    elevated,
    hasPermission,
  });

  const assets = useQuery({
    queryKey: ['mail', 'admin', 'writing-assets', kind, state || 'ALL'],
    queryFn: () => getMailOrganizationWritingAssets({ kind, state }),
    staleTime: 15_000,
    retry: 1,
  });
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return assets.data ?? [];
    return (assets.data ?? []).filter((asset) =>
      `${asset.name} ${asset.subject ?? ''} ${asset.body} ${asset.mandatoryContent}`
        .toLocaleLowerCase()
        .includes(term)
    );
  }, [assets.data, search]);

  const save = useMutation({
    mutationFn: async ({ input, fingerprint }: SaveCommand) => {
      if (!editor || !canEdit) throw new Error('Organization asset mutation is unavailable.');
      if (!saveCommandKeys.current.has(fingerprint)) saveCommandKeys.current.clear();
      const options = {
        activeAccessMode: 'ELEVATED' as const,
        idempotencyKey: mailWritingAssetCommandKey(saveCommandKeys.current, fingerprint),
      };
      if (editor.asset) {
        return updateMailOrganizationWritingAssetDraft(editor.asset, input, options);
      }
      return createMailOrganizationWritingAssetDraft(editor.kind, input, options);
    },
    onSuccess: async (_asset, command) => {
      saveCommandKeys.current.delete(command.fingerprint);
      setConfirmingTransition(null);
      setEditor(null);
      setSaveConflict(false);
      await queryClient.invalidateQueries({ queryKey: ['mail', 'admin', 'writing-assets'] });
      await queryClient.invalidateQueries({ queryKey: ['mail', 'writing-assets'] });
      toast.success(t('admin.writingAssets.saved'));
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        setSaveConflict(true);
        void assets.refetch();
        toast.error(t('admin.writingAssets.conflict'));
        return;
      }
      toast.error(t('admin.writingAssets.saveError'));
    },
  });
  const transition = useMutation({
    mutationFn: ({
      asset,
      action,
    }: {
      asset: MailOrganizationWritingAsset;
      action: 'submit' | 'approve' | 'publish' | 'retire';
    }) => {
      const allowed =
        (action === 'submit' && canSubmit) ||
        (action === 'approve' &&
          canUseMailWritingAssetAdminAction({ action: 'approve', elevated, hasPermission })) ||
        (action === 'publish' && canPublish) ||
        (action === 'retire' && canRetire);
      if (!allowed) throw new Error('Organization asset mutation is unavailable.');
      const fingerprint = mailWritingAssetTransitionFingerprint({
        kind: asset.kind,
        assetId: asset.assetId,
        action,
        version: asset.version,
      });
      if (!transitionCommandKeys.current.has(fingerprint)) transitionCommandKeys.current.clear();
      return transitionMailOrganizationWritingAsset(asset, action, {
        activeAccessMode: 'ELEVATED',
        idempotencyKey: mailWritingAssetCommandKey(transitionCommandKeys.current, fingerprint),
      });
    },
    onSuccess: async (_asset, command) => {
      transitionCommandKeys.current.delete(
        mailWritingAssetTransitionFingerprint({
          kind: command.asset.kind,
          assetId: command.asset.assetId,
          action: command.action,
          version: command.asset.version,
        })
      );
      await queryClient.invalidateQueries({ queryKey: ['mail', 'admin', 'writing-assets'] });
      await queryClient.invalidateQueries({ queryKey: ['mail', 'writing-assets'] });
      toast.success(t('admin.writingAssets.transitioned'));
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) void assets.refetch();
      toast.error(
        error instanceof HttpError && error.status === 409
          ? t('admin.writingAssets.conflict')
          : t('admin.writingAssets.transitionError')
      );
    },
  });

  const openCreate = (assetKind: MailOrganizationWritingAssetKind) => {
    saveCommandKeys.current.clear();
    setSaveConflict(false);
    setEditor({ kind: assetKind, asset: null, supersedes: null });
  };
  const openEdit = (asset: MailOrganizationWritingAsset) => {
    saveCommandKeys.current.clear();
    setSaveConflict(false);
    setEditor({ kind: asset.kind, asset, supersedes: null });
  };
  const openVersion = (asset: MailOrganizationWritingAsset) => {
    saveCommandKeys.current.clear();
    setSaveConflict(false);
    setEditor({ kind: asset.kind, asset: null, supersedes: asset });
  };

  return (
    <PageCanvas topInset="compact">
      <MailPageHeading
        eyebrow={t('admin.writingAssets.eyebrow')}
        title={t('admin.writingAssets.title')}
        description={t('admin.writingAssets.description')}
        actions={
          <ActionIconButton label={t('actions.refresh')} onClick={() => void assets.refetch()}>
            <RefreshCw size={17} />
          </ActionIconButton>
        }
      />
      {!mayMutate && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('admin.writingAssets.readOnly')}
        </Alert>
      )}
      {mayMutate && !elevated && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {t('admin.writingAssets.elevatedRequired')}
        </Alert>
      )}
      <Alert severity="info" sx={{ mt: 2 }}>
        {t('admin.writingAssets.workflow')}
      </Alert>

      <Tabs
        value={kind}
        onChange={(_event, value: MailOrganizationWritingAssetKind) => setKind(value)}
        aria-label={t('admin.writingAssets.tabsLabel')}
        sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="TEMPLATE" label={t('admin.writingAssets.templates')} />
        <Tab value="SIGNATURE" label={t('admin.writingAssets.signatures')} />
      </Tabs>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        alignItems={{ md: 'center' }}
        sx={{ my: 2 }}
      >
        <FormField
          type="search"
          size="small"
          label={t('admin.writingAssets.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ flex: 1, maxWidth: 480 }}
        />
        <SelectField
          label={t('admin.writingAssets.stateFilter')}
          size="small"
          value={state}
          options={STATES.map((value) => ({
            value,
            label: value
              ? t(`admin.writingAssets.state.${value}`)
              : t('admin.writingAssets.allStates'),
          }))}
          onValueChange={(value) => setState(value as MailOrganizationWritingAssetState | '')}
          sx={{ minWidth: 210 }}
        />
        <ActionButton
          intent="primary"
          startIcon={<FilePlus2 size={16} />}
          disabled={!canEdit}
          onClick={() => openCreate(kind)}
        >
          {kind === 'TEMPLATE'
            ? t('admin.writingAssets.newTemplate')
            : t('admin.writingAssets.newSignature')}
        </ActionButton>
      </Stack>

      {assets.isLoading ? (
        <Stack spacing={1}>
          <Skeleton variant="rounded" height={150} />
          <Skeleton variant="rounded" height={150} />
        </Stack>
      ) : assets.isError ? (
        <Alert severity="error">{t('admin.writingAssets.loadError')}</Alert>
      ) : visible.length ? (
        <Box component="section" sx={{ borderBlock: 1, borderColor: 'divider' }}>
          {visible.map((asset, index) => (
            <Box key={asset.assetId}>
              {index > 0 && <Divider />}
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                alignItems={{ md: 'flex-start' }}
                sx={{ py: 2 }}
              >
                <Box sx={{ color: 'var(--dwp-product-accent)', pt: 0.25 }}>
                  {asset.kind === 'TEMPLATE' ? <FileText size={19} /> : <Signature size={19} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                    <Typography component="h2" variant="subtitle1" fontWeight={800}>
                      {asset.name}
                    </Typography>
                    <Chip
                      size="small"
                      color={stateColor(asset.publicationState)}
                      label={t(`admin.writingAssets.state.${asset.publicationState}`)}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t('admin.writingAssets.publicationVersion', {
                        value: asset.publicationVersion,
                      })}
                    />
                    {asset.kind === 'SIGNATURE' && asset.defaultForNew && (
                      <Chip size="small" label={t('secondary.templates.defaultNew')} />
                    )}
                    {asset.kind === 'SIGNATURE' && asset.defaultForReply && (
                      <Chip size="small" label={t('secondary.templates.defaultReply')} />
                    )}
                  </Stack>
                  {asset.kind === 'TEMPLATE' && asset.subject && (
                    <Typography variant="body2" fontWeight={650} sx={{ mt: 0.5 }}>
                      {asset.subject}
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}
                  >
                    {asset.body}
                  </Typography>
                  <Alert severity="info" sx={{ mt: 1 }}>
                    <Typography variant="caption" fontWeight={750}>
                      {t('secondary.templates.mandatoryContent')}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                      {asset.mandatoryContent}
                    </Typography>
                  </Alert>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: 'block' }}
                  >
                    {t('admin.writingAssets.updatedAt', {
                      value: formatDate(
                        asset.updatedAt,
                        { dateStyle: 'medium', timeStyle: 'short' },
                        locale
                      ),
                    })}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {asset.publicationState === 'DRAFT' && (
                    <>
                      <ActionButton
                        intent="quiet"
                        startIcon={<PenLine size={15} />}
                        disabled={!canEdit}
                        onClick={() => openEdit(asset)}
                      >
                        {t('actions.edit')}
                      </ActionButton>
                      <ActionButton
                        intent="secondary"
                        disabled={!canSubmit || transition.isPending}
                        onClick={() => transition.mutate({ asset, action: 'submit' })}
                      >
                        {t('admin.writingAssets.submit')}
                      </ActionButton>
                    </>
                  )}
                  {asset.publicationState === 'PENDING_APPROVAL' && (
                    <ActionButton
                      intent="primary"
                      disabled={
                        !canUseMailWritingAssetAdminAction({
                          action: 'approve',
                          elevated,
                          hasPermission,
                          isCreator: asset.createdBy === Number(auth.user?.userId),
                        }) || transition.isPending
                      }
                      onClick={() => transition.mutate({ asset, action: 'approve' })}
                    >
                      {t('admin.writingAssets.approve')}
                    </ActionButton>
                  )}
                  {asset.publicationState === 'APPROVED' && (
                    <ActionButton
                      intent="primary"
                      startIcon={<Send size={15} />}
                      disabled={!canPublish || transition.isPending}
                      onClick={() => setConfirmingTransition({ asset, action: 'publish' })}
                    >
                      {t('admin.writingAssets.publish')}
                    </ActionButton>
                  )}
                  {asset.publicationState === 'PUBLISHED' && (
                    <>
                      <ActionButton
                        intent="secondary"
                        disabled={!canEdit}
                        onClick={() => openVersion(asset)}
                      >
                        {t('admin.writingAssets.newVersion')}
                      </ActionButton>
                      <ActionButton
                        intent="quiet"
                        disabled={!canRetire || transition.isPending}
                        onClick={() => setConfirmingTransition({ asset, action: 'retire' })}
                      >
                        {t('admin.writingAssets.retire')}
                      </ActionButton>
                    </>
                  )}
                </Stack>
              </Stack>
            </Box>
          ))}
        </Box>
      ) : (
        <GuidedEmptyState
          kind="first-use"
          title={t('admin.writingAssets.emptyTitle')}
          description={t('admin.writingAssets.emptyDescription')}
          actionLabel={
            kind === 'TEMPLATE'
              ? t('admin.writingAssets.newTemplate')
              : t('admin.writingAssets.newSignature')
          }
          onAction={canEdit ? () => openCreate(kind) : undefined}
        />
      )}

      <OrganizationWritingAssetDialog
        editor={editor}
        busy={save.isPending}
        conflict={saveConflict}
        onClose={() => {
          saveCommandKeys.current.clear();
          setEditor(null);
          setSaveConflict(false);
        }}
        onSubmit={(input) => {
          setSaveConflict(false);
          const editorIdentity = editor?.asset
            ? `${editor.kind}:${editor.asset.assetId}:${editor.asset.version}`
            : editor?.supersedes
              ? `${editor.kind}:supersede:${editor.supersedes.assetId}:${editor.supersedes.version}`
              : `new:${editor?.kind ?? 'UNKNOWN'}`;
          save.mutate({
            input,
            fingerprint: mailWritingAssetDraftFingerprint(
              editorIdentity,
              input as unknown as Record<string, unknown>
            ),
          });
        }}
      />
      <ConfirmDialog
        open={Boolean(confirmingTransition)}
        title={
          confirmingTransition?.action === 'retire'
            ? t('admin.writingAssets.retireConfirmTitle')
            : t('admin.writingAssets.publishConfirmTitle')
        }
        description={
          confirmingTransition?.action === 'retire'
            ? t('admin.writingAssets.retireConfirmDescription')
            : t('admin.writingAssets.publishConfirmDescription')
        }
        cancelLabel={t('actions.cancel')}
        confirmLabel={
          confirmingTransition?.action === 'retire'
            ? t('admin.writingAssets.retire')
            : t('admin.writingAssets.publish')
        }
        intent={confirmingTransition?.action === 'retire' ? 'danger' : 'primary'}
        busy={transition.isPending}
        onClose={() => setConfirmingTransition(null)}
        onConfirm={() => {
          if (confirmingTransition) transition.mutate(confirmingTransition);
        }}
      />
    </PageCanvas>
  );
}

function OrganizationWritingAssetDialog({
  editor,
  busy,
  conflict,
  onClose,
  onSubmit,
}: {
  editor: Editor | null;
  busy: boolean;
  conflict: boolean;
  onClose: () => void;
  onSubmit: (input: MailOrganizationWritingAssetDraftInput) => void;
}) {
  const { t } = useTranslation('mail');
  const [form, setForm] = useState<MailOrganizationWritingAssetDraftInput>(EMPTY_FORM);
  const bodyFieldRef = useRef<MailMessageBodyFieldHandle | null>(null);
  const mandatoryFieldRef = useRef<MailMessageBodyFieldHandle | null>(null);
  useEffect(() => {
    if (!editor) return;
    const source = editor.asset ?? editor.supersedes;
    setForm(
      source
        ? {
            name: source.name,
            subject: source.subject ?? '',
            body: source.body,
            bodyFormat: source.bodyFormat,
            mandatoryContent: source.mandatoryContent,
            defaultForNew: source.defaultForNew,
            defaultForReply: source.defaultForReply,
            supersedesId: editor.supersedes?.assetId ?? source.supersedesId ?? null,
            version: editor.asset?.version ?? null,
          }
        : EMPTY_FORM
    );
  }, [editor]);
  const valid = Boolean(form.name.trim() && form.body.trim() && form.mandatoryContent.trim());
  return (
    <FormDialog
      open={Boolean(editor)}
      mobileFullScreen
      maxWidth="md"
      title={
        editor?.kind === 'SIGNATURE'
          ? t('admin.writingAssets.signatureDialogTitle')
          : t('admin.writingAssets.templateDialogTitle')
      }
      description={t('admin.writingAssets.dialogDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={busy}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={() => onSubmit(form)}
    >
      <Stack spacing={2}>
        {conflict && <Alert severity="warning">{t('admin.writingAssets.conflictDetail')}</Alert>}
        {editor?.supersedes && (
          <Alert severity="info">
            {t('admin.writingAssets.versioningNotice', {
              value: editor.supersedes.publicationVersion + 1,
            })}
          </Alert>
        )}
        <FormField
          required
          autoFocus
          label={t('secondary.templates.name')}
          value={form.name}
          inputProps={{ maxLength: 160 }}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        {editor?.kind === 'TEMPLATE' && (
          <FormField
            label={t('secondary.templates.subject')}
            value={form.subject ?? ''}
            inputProps={{ maxLength: 500 }}
            onChange={(event) => setForm({ ...form, subject: event.target.value })}
          />
        )}
        <SelectField
          label={t('secondary.templates.bodyFormat')}
          value={form.bodyFormat}
          options={[
            { value: 'TEXT', label: t('compose.formatText') },
            { value: 'HTML', label: t('compose.formatRich') },
          ]}
          onValueChange={(value) =>
            value && setForm({ ...form, bodyFormat: value as 'TEXT' | 'HTML' })
          }
        />
        <Box>
          <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 0.75 }}>
            {t('secondary.templates.body')}
          </Typography>
          <MailMessageBodyField
            ref={bodyFieldRef}
            format={form.bodyFormat}
            value={form.body}
            disabled={busy}
            minRows={8}
            onChange={(body) => setForm({ ...form, body: body.slice(0, 100_000) })}
          />
          <WritingAssetVariableButtons
            disabled={busy}
            onInsert={(token) => bodyFieldRef.current?.insertText(token)}
          />
        </Box>
        <Box>
          <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 0.75 }}>
            {t('secondary.templates.mandatoryContent')}
          </Typography>
          <MailMessageBodyField
            ref={mandatoryFieldRef}
            format={form.bodyFormat}
            value={form.mandatoryContent}
            disabled={busy}
            minRows={4}
            onChange={(mandatoryContent) =>
              setForm({ ...form, mandatoryContent: mandatoryContent.slice(0, 20_000) })
            }
          />
          <WritingAssetVariableButtons
            disabled={busy}
            onInsert={(token) => mandatoryFieldRef.current?.insertText(token)}
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t('secondary.templates.variablesHelp', {
            displayName: '{{displayName}}',
            department: '{{department}}',
            recipientName: '{{recipientName}}',
          })}
        </Typography>
        {editor?.kind === 'SIGNATURE' && (
          <Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={form.defaultForNew}
                  onChange={(_event, checked) => setForm({ ...form, defaultForNew: checked })}
                />
              }
              label={t('secondary.templates.applyNew')}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.defaultForReply}
                  onChange={(_event, checked) => setForm({ ...form, defaultForReply: checked })}
                />
              }
              label={t('secondary.templates.applyReply')}
            />
          </Stack>
        )}
      </Stack>
    </FormDialog>
  );
}

function WritingAssetVariableButtons({
  disabled,
  onInsert,
}: {
  disabled: boolean;
  onInsert: (token: string) => void;
}) {
  const { t } = useTranslation('mail');
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
      {MAIL_WRITING_ASSET_VARIABLES.map((variable) => (
        <ActionButton
          key={variable}
          size="small"
          intent="quiet"
          disabled={disabled}
          onClick={() => onInsert(mailWritingAssetVariableToken(variable))}
        >
          {t(`secondary.templates.variable.${variable}`)}
        </ActionButton>
      ))}
    </Stack>
  );
}

function stateColor(state: MailOrganizationWritingAssetState) {
  if (state === 'PUBLISHED') return 'success' as const;
  if (state === 'PENDING_APPROVAL' || state === 'APPROVED') return 'warning' as const;
  return 'default' as const;
}
