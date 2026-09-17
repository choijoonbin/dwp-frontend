import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, ListFilter, PenLine, Save, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMailSavedView,
  deleteMailSavedView,
  getMailHome,
  getMailOrganization,
  getMailSavedViews,
  updateMailSavedView,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MailSavedView, MailSearchCriteria } from '@dwp-frontend/shared-utils';

import { useMailUserPermissions } from './use-mail-user-permissions';
import { mailSearchRuleSeed } from './mail-search-rule-handoff';

type SearchUpdate = (updates: Record<string, string | null>) => void;

export function MailSearchControls({
  criteria,
  onUpdate,
  onCreateRule,
}: {
  criteria: MailSearchCriteria;
  onUpdate: SearchUpdate;
  onCreateRule: () => void;
}) {
  const { t } = useTranslation('mail');
  const { canCreate, canUpdate } = useMailUserPermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [advancedOpen, setAdvancedOpen] = useState(() => hasAdvancedCriteria(criteria));
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [editingView, setEditingView] = useState<MailSavedView | null>(null);
  const [deleting, setDeleting] = useState<MailSavedView | null>(null);
  const views = useQuery({
    queryKey: ['mail', 'saved-views'],
    queryFn: getMailSavedViews,
    staleTime: 30_000,
    retry: 1,
  });
  const home = useQuery({
    queryKey: ['mail', 'home'],
    queryFn: () => getMailHome(),
    staleTime: 30_000,
    retry: 1,
  });
  const organization = useQuery({
    queryKey: ['mail', 'organization'],
    queryFn: getMailOrganization,
    staleTime: 30_000,
    retry: 1,
  });
  const create = useMutation({
    mutationFn: () => {
      if (editingView) {
        if (!canUpdate) throw new Error('APP.MAIL:UPDATE is required');
        return updateMailSavedView(
          editingView.savedViewId,
          { name: viewName.trim(), criteria: editingView.criteria },
          editingView.version
        );
      }
      if (!canCreate) throw new Error('APP.MAIL:CREATE is required');
      return createMailSavedView({ name: viewName.trim(), criteria });
    },
    onSuccess: async () => {
      setSaveOpen(false);
      setEditingView(null);
      setViewName('');
      await queryClient.invalidateQueries({ queryKey: ['mail', 'saved-views'] });
      toast.success(t('secondary.savedViews.saved'));
    },
    onError: () => toast.error(t('secondary.savedViews.saveError')),
  });
  const remove = useMutation({
    mutationFn: (view: MailSavedView) => {
      if (!canUpdate) throw new Error('APP.MAIL:UPDATE is required');
      return deleteMailSavedView(view.savedViewId, view.version);
    },
    onSuccess: async () => {
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ['mail', 'saved-views'] });
      toast.success(t('secondary.savedViews.deleted'));
    },
    onError: () => toast.error(t('secondary.savedViews.deleteError')),
  });
  const activeFilters = useMemo(
    () =>
      [
        criteria.accountId
          ? { key: 'accountId', label: accountLabel(home.data?.accounts ?? [], criteria.accountId) }
          : null,
        criteria.scope
          ? { key: 'scope', label: t(`secondary.search.scope.${criteria.scope}`) }
          : null,
        criteria.from
          ? { key: 'from', label: `${t('secondary.search.from')}: ${criteria.from}` }
          : null,
        criteria.to ? { key: 'to', label: `${t('secondary.search.to')}: ${criteria.to}` } : null,
        criteria.dateFrom
          ? { key: 'dateFrom', label: `${t('secondary.search.dateFrom')}: ${criteria.dateFrom}` }
          : null,
        criteria.dateTo
          ? { key: 'dateTo', label: `${t('secondary.search.dateTo')}: ${criteria.dateTo}` }
          : null,
        criteria.unread ? { key: 'unread', label: t('secondary.search.unreadOnly') } : null,
        criteria.needsReply
          ? { key: 'needsReply', label: t('secondary.search.needsReplyOnly') }
          : null,
        criteria.hasAttachment
          ? { key: 'hasAttachment', label: t('secondary.search.attachmentOnly') }
          : null,
        criteria.folderId
          ? {
              key: 'folderId',
              label: `${t('secondary.search.folder')}: ${folderLabel(
                organization.data?.folders ?? [],
                criteria.folderId
              )}`,
            }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string }>,
    [criteria, home.data?.accounts, organization.data?.folders, t]
  );

  useEffect(() => {
    if (!saveOpen) return;
    setViewName(editingView?.name ?? '');
  }, [editingView, saveOpen]);

  const applyView = (view: MailSavedView) => {
    const next = criteriaToParams(view.criteria);
    onUpdate({
      query: null,
      accountId: null,
      scope: null,
      from: null,
      to: null,
      dateFrom: null,
      dateTo: null,
      unread: null,
      needsReply: null,
      hasAttachment: null,
      folderId: null,
      state: null,
      lane: null,
      ...next,
    });
    setAdvancedOpen(hasAdvancedCriteria(view.criteria));
  };

  return (
    <Stack spacing={1.5} sx={{ mt: 1.5 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
        <ActionButton
          intent="secondary"
          startIcon={<SlidersHorizontal size={16} />}
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((value) => !value)}
        >
          {t('secondary.search.advanced')}
        </ActionButton>
        <ActionButton
          intent="secondary"
          startIcon={<Save size={16} />}
          disabled={!canCreate || (!criteria.query?.trim() && !hasAdvancedCriteria(criteria))}
          onClick={() => setSaveOpen(true)}
        >
          {t('secondary.savedViews.saveCurrent')}
        </ActionButton>
        <ActionButton
          intent="secondary"
          startIcon={<ListFilter size={16} />}
          disabled={!canCreate || !mailSearchRuleSeed(criteria)}
          onClick={onCreateRule}
        >
          {t('secondary.search.createRule', { defaultValue: 'Create rule from search' })}
        </ActionButton>
        {views.data?.map((view) => (
          <Stack key={view.savedViewId} direction="row" spacing={0.25} alignItems="center">
            <Chip
              icon={<Bookmark size={14} />}
              label={view.name}
              variant="outlined"
              onClick={() => applyView(view)}
              onDelete={canUpdate ? () => setDeleting(view) : undefined}
              deleteIcon={<Trash2 size={14} />}
            />
            <ActionButton
              intent="quiet"
              size="small"
              disabled={!canUpdate}
              aria-label={t('secondary.savedViews.rename', { name: view.name })}
              onClick={() => {
                setEditingView(view);
                setSaveOpen(true);
              }}
            >
              <PenLine size={14} />
            </ActionButton>
          </Stack>
        ))}
      </Stack>

      {activeFilters.length > 0 && (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {activeFilters.map((filter) => (
            <Chip
              key={filter.key}
              size="small"
              label={filter.label}
              onDelete={() => onUpdate({ [filter.key]: null })}
            />
          ))}
          <ActionButton
            intent="quiet"
            size="small"
            onClick={() =>
              onUpdate({
                accountId: null,
                scope: null,
                from: null,
                to: null,
                dateFrom: null,
                dateTo: null,
                unread: null,
                needsReply: null,
                hasAttachment: null,
                folderId: null,
              })
            }
          >
            {t('secondary.search.clearFilters')}
          </ActionButton>
        </Stack>
      )}

      <Collapse in={advancedOpen} unmountOnExit>
        <Box
          component="section"
          aria-label={t('secondary.search.advanced')}
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))',
            },
            gap: 1.5,
            py: 1.5,
            borderBlock: 1,
            borderColor: 'divider',
          }}
        >
          <SelectField
            size="small"
            label={t('secondary.search.account')}
            value={criteria.accountId ?? ''}
            options={[
              { value: '', label: t('secondary.search.allAccounts') },
              ...(home.data?.accounts ?? []).map((account) => ({
                value: account.accountId,
                label: `${account.displayName} · ${account.emailAddress}`,
              })),
            ]}
            onValueChange={(value) => onUpdate({ accountId: value || null })}
          />
          <SelectField
            size="small"
            label={t('secondary.search.scopeLabel')}
            value={criteria.scope ?? ''}
            options={[
              { value: '', label: t('secondary.search.scope.ALL') },
              { value: 'PERSONAL', label: t('secondary.search.scope.PERSONAL') },
              { value: 'SHARED', label: t('secondary.search.scope.SHARED') },
            ]}
            onValueChange={(value) => onUpdate({ scope: value || null })}
          />
          <FormField
            size="small"
            label={t('secondary.search.from')}
            value={criteria.from ?? ''}
            onChange={(event) => onUpdate({ from: event.target.value || null })}
          />
          <FormField
            size="small"
            label={t('secondary.search.to')}
            value={criteria.to ?? ''}
            onChange={(event) => onUpdate({ to: event.target.value || null })}
          />
          <FormField
            size="small"
            type="date"
            label={t('secondary.search.dateFrom')}
            value={criteria.dateFrom ?? ''}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(event) => onUpdate({ dateFrom: event.target.value || null })}
          />
          <FormField
            size="small"
            type="date"
            label={t('secondary.search.dateTo')}
            value={criteria.dateTo ?? ''}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(event) => onUpdate({ dateTo: event.target.value || null })}
          />
          <SelectField
            size="small"
            label={t('secondary.search.readState')}
            value={criteria.unread === true ? 'true' : ''}
            options={[
              { value: '', label: t('secondary.search.allReadStates') },
              { value: 'true', label: t('secondary.search.unreadOnly') },
            ]}
            onValueChange={(value) => onUpdate({ unread: value || null })}
          />
          <SelectField
            size="small"
            label={t('secondary.search.replyState')}
            value={criteria.needsReply === true ? 'true' : ''}
            options={[
              { value: '', label: t('secondary.search.allReplyStates') },
              { value: 'true', label: t('secondary.search.needsReplyOnly') },
            ]}
            onValueChange={(value) => onUpdate({ needsReply: value || null })}
          />
          <SelectField
            size="small"
            label={t('secondary.search.attachment')}
            value={criteria.hasAttachment === true ? 'true' : ''}
            options={[
              { value: '', label: t('secondary.search.allAttachments') },
              { value: 'true', label: t('secondary.search.attachmentOnly') },
            ]}
            onValueChange={(value) => onUpdate({ hasAttachment: value || null })}
          />
          <SelectField
            size="small"
            label={t('secondary.search.folder')}
            value={criteria.folderId ?? ''}
            options={[
              { value: '', label: t('secondary.search.allFolders') },
              ...(organization.data?.folders ?? []).map((folder) => ({
                value: folder.folderId,
                label: folder.displayName,
              })),
            ]}
            onValueChange={(value) => onUpdate({ folderId: value || null })}
          />
        </Box>
      </Collapse>

      <FormDialog
        open={saveOpen}
        title={
          editingView
            ? t('secondary.savedViews.renameTitle')
            : t('secondary.savedViews.dialogTitle')
        }
        description={t('secondary.savedViews.dialogDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('secondary.savedViews.save')}
        submittingLabel={t('actions.saving')}
        busy={create.isPending}
        submitDisabled={!viewName.trim()}
        onClose={() => {
          setSaveOpen(false);
          setEditingView(null);
        }}
        onSubmit={() => create.mutate()}
      >
        <Stack spacing={1.5}>
          <FormField
            autoFocus
            required
            label={t('secondary.savedViews.name')}
            value={viewName}
            inputProps={{ maxLength: 120 }}
            onChange={(event) => setViewName(event.target.value)}
          />
          <Typography variant="body2" color="text.secondary">
            {t('secondary.savedViews.personalOnly')}
          </Typography>
        </Stack>
      </FormDialog>
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('secondary.savedViews.deleteTitle')}
        description={t('secondary.savedViews.deleteDescription')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('secondary.savedViews.delete')}
        intent="danger"
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting);
        }}
      />
    </Stack>
  );
}

export function hasAdvancedCriteria(criteria: MailSearchCriteria) {
  return Boolean(
    criteria.accountId ||
    criteria.scope ||
    criteria.from ||
    criteria.to ||
    criteria.dateFrom ||
    criteria.dateTo ||
    criteria.unread ||
    criteria.needsReply ||
    criteria.hasAttachment ||
    criteria.folderId
  );
}

export function criteriaToParams(criteria: MailSearchCriteria): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(criteria).map(([key, value]) => [
      key,
      value == null || value === false ? null : String(value),
    ])
  );
}

function folderLabel(folders: Array<{ folderId: string; displayName: string }>, folderId: string) {
  return folders.find((folder) => folder.folderId === folderId)?.displayName ?? folderId;
}

function accountLabel(
  accounts: Array<{ accountId: string; displayName: string }>,
  accountId: string
) {
  return accounts.find((account) => account.accountId === accountId)?.displayName ?? accountId;
}
