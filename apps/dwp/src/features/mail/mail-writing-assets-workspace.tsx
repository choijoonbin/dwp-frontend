import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  Clock3,
  FileText,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Signature,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  archiveMailSignature,
  archiveMailTemplate,
  createMailSignature,
  createMailTemplate,
  getMailHome,
  getMailWritingAssets,
  HttpError,
  updateMailSignature,
  updateMailTemplate,
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
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { MailPageHeading } from './mail-components';
import { MailMessageBodyField, type MailMessageBodyFieldHandle } from './mail-message-body-field';
import {
  MAIL_WRITING_ASSET_VARIABLES,
  mailWritingAssetVariableToken,
} from './mail-writing-asset-content';

import type {
  MailSignature,
  MailSignatureInput,
  MailTemplate,
  MailTemplateInput,
} from '@dwp-frontend/shared-utils';

type WritingAsset =
  { kind: 'template'; value: MailTemplate } | { kind: 'signature'; value: MailSignature };

const EMPTY_TEMPLATE: MailTemplateInput = {
  name: '',
  subject: '',
  body: '',
  bodyFormat: 'TEXT',
  scope: 'PERSONAL',
  accountId: null,
};

const EMPTY_SIGNATURE: MailSignatureInput = {
  name: '',
  body: '',
  bodyFormat: 'TEXT',
  scope: 'PERSONAL',
  accountId: null,
  defaultForNew: false,
  defaultForReply: false,
};

export function MailWritingAssetsWorkspace() {
  const { t, i18n } = useTranslation('mail');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'templates' | 'signatures'>('templates');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const [editing, setEditing] = useState<WritingAsset | 'template' | 'signature' | null>(null);
  const [archiving, setArchiving] = useState<WritingAsset | null>(null);
  const assets = useQuery({
    queryKey: ['mail', 'writing-assets', { includeArchived: showArchived }],
    queryFn: () => getMailWritingAssets({ includeArchived: showArchived }),
    staleTime: 30_000,
    retry: 1,
  });
  const home = useQuery({
    queryKey: ['mail', 'home'],
    queryFn: () => getMailHome(),
    staleTime: 30_000,
    retry: 1,
  });
  const save = useMutation({
    mutationFn: async (input: MailTemplateInput | MailSignatureInput) => {
      if (editing === 'template') return createMailTemplate(input as MailTemplateInput);
      if (editing === 'signature') return createMailSignature(input as MailSignatureInput);
      if (editing?.kind === 'template') {
        return updateMailTemplate(
          editing.value.templateId,
          input as MailTemplateInput,
          editing.value.version
        );
      }
      if (editing?.kind === 'signature') {
        return updateMailSignature(
          editing.value.signatureId,
          input as MailSignatureInput,
          editing.value.version
        );
      }
      throw new Error('Writing asset editor is not open.');
    },
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['mail', 'writing-assets'] });
      toast.success(t('secondary.templates.saved'));
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        setSaveConflict(true);
        void assets.refetch();
        toast.error(t('secondary.templates.saveConflict'));
        return;
      }
      toast.error(t('secondary.templates.saveError'));
    },
  });
  const archive = useMutation({
    mutationFn: (asset: WritingAsset) =>
      asset.kind === 'template'
        ? archiveMailTemplate(asset.value.templateId, asset.value.version)
        : archiveMailSignature(asset.value.signatureId, asset.value.version),
    onSuccess: async () => {
      setArchiving(null);
      await queryClient.invalidateQueries({ queryKey: ['mail', 'writing-assets'] });
      toast.success(t('secondary.templates.archived'));
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) void assets.refetch();
      toast.error(
        error instanceof HttpError && error.status === 409
          ? t('secondary.templates.archiveConflict')
          : t('secondary.templates.archiveError')
      );
    },
  });

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const list =
      tab === 'templates' ? (assets.data?.templates ?? []) : (assets.data?.signatures ?? []);
    if (!term) return list;
    return list.filter((item) =>
      `${item.name} ${'subject' in item ? (item.subject ?? '') : ''} ${item.body}`
        .toLocaleLowerCase()
        .includes(term)
    );
  }, [assets.data, search, tab]);

  return (
    <PageCanvas topInset="compact">
      <MailPageHeading
        eyebrow={t('secondary.templates.eyebrow')}
        title={t('secondary.templates.title')}
        description={t('secondary.templates.description')}
        actions={
          <ActionIconButton label={t('actions.refresh')} onClick={() => void assets.refetch()}>
            <RefreshCw size={17} />
          </ActionIconButton>
        }
      />
      <Tabs
        value={tab}
        onChange={(_event, value: 'templates' | 'signatures') => setTab(value)}
        aria-label={t('secondary.templates.tabsLabel')}
        sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          value="templates"
          label={`${t('secondary.templates.templateTab')} (${assets.data?.templates.length ?? 0})`}
        />
        <Tab
          value="signatures"
          label={`${t('secondary.templates.signatureTab')} (${assets.data?.signatures.length ?? 0})`}
        />
      </Tabs>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'center' }}
        sx={{ my: 2 }}
      >
        <FormField
          type="search"
          size="small"
          label={t('secondary.templates.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} aria-hidden />
                </InputAdornment>
              ),
            },
          }}
          sx={{ maxWidth: 480 }}
        />
        <ActionButton
          intent="primary"
          startIcon={<Plus size={16} />}
          onClick={() => {
            setSaveConflict(false);
            setEditing(tab === 'templates' ? 'template' : 'signature');
          }}
        >
          {tab === 'templates'
            ? t('secondary.templates.newTemplate')
            : t('secondary.templates.newSignature')}
        </ActionButton>
        <FormControlLabel
          sx={{ ml: { sm: 'auto' } }}
          control={
            <Switch
              checked={showArchived}
              onChange={(_event, checked) => setShowArchived(checked)}
            />
          }
          label={t('secondary.templates.showArchived')}
        />
      </Stack>

      {assets.isLoading ? (
        <Stack spacing={1}>
          <Skeleton variant="rounded" height={120} />
          <Skeleton variant="rounded" height={120} />
        </Stack>
      ) : assets.isError ? (
        <Alert severity="error">{t('secondary.templates.loadError')}</Alert>
      ) : visible.length ? (
        <Box
          component="section"
          aria-label={
            tab === 'templates'
              ? t('secondary.templates.templateList')
              : t('secondary.templates.signatureList')
          }
          sx={{ borderBlock: 1, borderColor: 'divider' }}
        >
          {visible.map((item, index) => {
            const asset: WritingAsset =
              tab === 'templates'
                ? { kind: 'template', value: item as MailTemplate }
                : { kind: 'signature', value: item as MailSignature };
            const accountRemoved = Boolean(
              asset.value.accountId &&
              home.data &&
              !home.data?.accounts.some((account) => account.accountId === asset.value.accountId)
            );
            return (
              <Box
                key={asset.kind === 'template' ? asset.value.templateId : asset.value.signatureId}
              >
                {index > 0 && <Divider />}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  alignItems={{ sm: 'flex-start' }}
                  sx={{ py: 2 }}
                >
                  <Box sx={{ color: 'var(--dwp-product-accent)', pt: 0.25 }}>
                    {asset.kind === 'template' ? <FileText size={19} /> : <Signature size={19} />}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                      <Typography component="h2" variant="subtitle1" fontWeight={800}>
                        {asset.value.name}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`secondary.templates.scope.${asset.value.scope}`)}
                      />
                      <Chip
                        size="small"
                        color={asset.value.active === false ? 'default' : 'success'}
                        label={
                          asset.value.active === false
                            ? t('secondary.templates.statusArchived')
                            : t('secondary.templates.statusActive')
                        }
                      />
                      {accountRemoved && (
                        <Chip
                          size="small"
                          color="warning"
                          label={t('secondary.templates.accountRemoved')}
                        />
                      )}
                      {asset.kind === 'signature' && asset.value.defaultForNew && (
                        <Chip
                          size="small"
                          color="primary"
                          label={t('secondary.templates.defaultNew')}
                        />
                      )}
                      {asset.kind === 'signature' && asset.value.defaultForReply && (
                        <Chip
                          size="small"
                          color="primary"
                          label={t('secondary.templates.defaultReply')}
                        />
                      )}
                    </Stack>
                    {asset.kind === 'template' && asset.value.subject && (
                      <Typography variant="body2" fontWeight={650} sx={{ mt: 0.5 }}>
                        {asset.value.subject}
                      </Typography>
                    )}
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}
                    >
                      {asset.value.body}
                    </Typography>
                    {asset.value.mandatoryContent && (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        <Typography variant="caption" fontWeight={750}>
                          {t('secondary.templates.mandatoryContent')}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                          {asset.value.mandatoryContent}
                        </Typography>
                      </Alert>
                    )}
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={{ xs: 0.25, sm: 1.5 }}
                      sx={{ mt: 1 }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {t('secondary.templates.version', {
                          value:
                            asset.value.scope === 'ORGANIZATION'
                              ? (asset.value.publicationVersion ?? asset.value.version)
                              : asset.value.version,
                        })}
                      </Typography>
                      {asset.value.updatedAt && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                        >
                          <Clock3 size={13} aria-hidden />
                          {t('secondary.templates.updatedAt', {
                            value: formatDate(
                              asset.value.updatedAt,
                              { dateStyle: 'medium', timeStyle: 'short' },
                              locale
                            ),
                          })}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                  {asset.value.editable !== false && asset.value.active !== false && (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      <ActionButton
                        intent="quiet"
                        startIcon={<PenLine size={15} />}
                        disabled={accountRemoved}
                        onClick={() => {
                          setSaveConflict(false);
                          setEditing(asset);
                        }}
                      >
                        {t('secondary.templates.edit')}
                      </ActionButton>
                      <ActionButton
                        intent="quiet"
                        startIcon={<Archive size={15} />}
                        onClick={() => setArchiving(asset)}
                      >
                        {t('secondary.templates.archive')}
                      </ActionButton>
                    </Stack>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Box>
      ) : (
        <GuidedEmptyState
          kind="first-use"
          title={
            tab === 'templates'
              ? t('secondary.templates.emptyTemplateTitle')
              : t('secondary.templates.emptySignatureTitle')
          }
          description={t('secondary.templates.emptyDescription')}
          actionLabel={
            tab === 'templates'
              ? t('secondary.templates.newTemplate')
              : t('secondary.templates.newSignature')
          }
          onAction={() => {
            setSaveConflict(false);
            setEditing(tab === 'templates' ? 'template' : 'signature');
          }}
        />
      )}

      <WritingAssetDialog
        editing={editing}
        accounts={home.data?.accounts ?? []}
        accountsLoaded={home.isSuccess}
        busy={save.isPending}
        conflict={saveConflict}
        onClose={() => {
          setSaveConflict(false);
          setEditing(null);
        }}
        onSubmit={(input) => {
          setSaveConflict(false);
          save.mutate(input);
        }}
      />
      <ConfirmDialog
        open={Boolean(archiving)}
        title={t('secondary.templates.archiveTitle')}
        description={t('secondary.templates.archiveDescription')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('secondary.templates.archive')}
        intent="danger"
        busy={archive.isPending}
        onClose={() => setArchiving(null)}
        onConfirm={() => {
          if (archiving) archive.mutate(archiving);
        }}
      />
    </PageCanvas>
  );
}

function WritingAssetDialog({
  editing,
  accounts,
  accountsLoaded,
  busy,
  conflict,
  onClose,
  onSubmit,
}: {
  editing: WritingAsset | 'template' | 'signature' | null;
  accounts: Array<{ accountId: string; displayName: string; emailAddress: string }>;
  accountsLoaded: boolean;
  busy: boolean;
  conflict: boolean;
  onClose: () => void;
  onSubmit: (input: MailTemplateInput | MailSignatureInput) => void;
}) {
  const { t } = useTranslation('mail');
  const kind = typeof editing === 'object' ? editing?.kind : editing;
  const [template, setTemplate] = useState<MailTemplateInput>(EMPTY_TEMPLATE);
  const [signature, setSignature] = useState<MailSignatureInput>(EMPTY_SIGNATURE);
  const bodyFieldRef = useRef<MailMessageBodyFieldHandle | null>(null);

  useEffect(() => {
    if (!editing) return;
    if (editing === 'template') setTemplate(EMPTY_TEMPLATE);
    else if (editing === 'signature') setSignature(EMPTY_SIGNATURE);
    else if (editing.kind === 'template') {
      setTemplate({
        name: editing.value.name,
        subject: editing.value.subject ?? '',
        body: editing.value.body,
        bodyFormat: editing.value.bodyFormat,
        scope: editing.value.scope,
        accountId: editing.value.accountId ?? null,
      });
    } else {
      setSignature({
        name: editing.value.name,
        body: editing.value.body,
        bodyFormat: editing.value.bodyFormat,
        scope: editing.value.scope,
        accountId: editing.value.accountId ?? null,
        defaultForNew: editing.value.defaultForNew,
        defaultForReply: editing.value.defaultForReply,
      });
    }
  }, [editing]);

  const input = kind === 'template' ? template : signature;
  const accountRemoved = Boolean(
    accountsLoaded &&
    input.accountId &&
    !accounts.some((account) => account.accountId === input.accountId)
  );
  const valid = Boolean(input.name.trim() && input.body.trim() && !accountRemoved);
  return (
    <FormDialog
      open={Boolean(editing)}
      mobileFullScreen
      maxWidth="md"
      title={
        kind === 'template'
          ? t('secondary.templates.templateDialogTitle')
          : t('secondary.templates.signatureDialogTitle')
      }
      description={t('secondary.templates.dialogDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.saving')}
      busy={busy}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={() => onSubmit(input)}
    >
      <Stack spacing={2}>
        {conflict && (
          <Alert severity="warning">{t('secondary.templates.conflictDescription')}</Alert>
        )}
        {accountRemoved && (
          <Alert severity="error">{t('secondary.templates.accountRemovedDescription')}</Alert>
        )}
        <FormField
          required
          autoFocus
          label={t('secondary.templates.name')}
          value={input.name}
          inputProps={{ maxLength: 160 }}
          onChange={(event) =>
            kind === 'template'
              ? setTemplate({ ...template, name: event.target.value })
              : setSignature({ ...signature, name: event.target.value })
          }
        />
        <SelectField
          label={t('secondary.templates.account')}
          value={input.accountId ?? ''}
          options={[
            { value: '', label: t('secondary.templates.allAccounts') },
            ...accounts.map((account) => ({
              value: account.accountId,
              label: `${account.displayName} · ${account.emailAddress}`,
            })),
          ]}
          onValueChange={(value) =>
            kind === 'template'
              ? setTemplate({
                  ...template,
                  accountId: value || null,
                  scope: value ? 'ACCOUNT' : 'PERSONAL',
                })
              : setSignature({
                  ...signature,
                  accountId: value || null,
                  scope: value ? 'ACCOUNT' : 'PERSONAL',
                })
          }
        />
        {kind === 'template' && (
          <FormField
            label={t('secondary.templates.subject')}
            value={template.subject ?? ''}
            inputProps={{ maxLength: 500 }}
            onChange={(event) => setTemplate({ ...template, subject: event.target.value })}
          />
        )}
        <SelectField
          label={t('secondary.templates.bodyFormat')}
          value={input.bodyFormat}
          options={[
            { value: 'TEXT', label: t('compose.formatText') },
            { value: 'HTML', label: t('compose.formatRich') },
          ]}
          onValueChange={(value) => {
            if (!value) return;
            if (kind === 'template') setTemplate({ ...template, bodyFormat: value });
            else setSignature({ ...signature, bodyFormat: value });
          }}
        />
        <Box>
          <MailMessageBodyField
            ref={bodyFieldRef}
            format={input.bodyFormat}
            value={input.body}
            disabled={busy}
            minRows={8}
            onChange={(value) => {
              const body = value.slice(0, 100_000);
              if (kind === 'template') setTemplate({ ...template, body });
              else setSignature({ ...signature, body });
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {t('secondary.templates.variablesHelp')}
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {MAIL_WRITING_ASSET_VARIABLES.map((variable) => (
              <ActionButton
                key={variable}
                size="small"
                intent="quiet"
                disabled={busy}
                onClick={() =>
                  bodyFieldRef.current?.insertText(mailWritingAssetVariableToken(variable))
                }
              >
                {t(`secondary.templates.variable.${variable}`)}
              </ActionButton>
            ))}
          </Stack>
        </Box>
        {kind === 'signature' && (
          <Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={signature.defaultForNew}
                  onChange={(_event, checked) =>
                    setSignature({ ...signature, defaultForNew: checked })
                  }
                />
              }
              label={t('secondary.templates.applyNew')}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={signature.defaultForReply}
                  onChange={(_event, checked) =>
                    setSignature({ ...signature, defaultForReply: checked })
                  }
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
