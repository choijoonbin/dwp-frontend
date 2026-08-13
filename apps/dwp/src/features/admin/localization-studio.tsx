import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArchiveRestore,
  Check,
  Eye,
  GitCompareArrows,
  History,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  createLocalizationBundle,
  createLocalizationDraft,
  decideLocalizationRevision,
  getLocalizationDiff,
  getLocalizationWorkspace,
  listLocalizationRevisions,
  publishLocalizationRevision,
  restoreLocalizationRevision,
  saveLocalizationDraft,
  submitLocalizationRevision,
  useToast,
  type CreateLocalizationBundleRequest,
  type LocalizationBundleSummary,
  type LocalizationRevision,
  type LocalizationRevisionState,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  GuidedEmptyState,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { AdminPanelError, AdminPanelLoading } from './admin-ui';

type WorkspaceView = 'EDITOR' | 'DIFF' | 'PREVIEW' | 'HISTORY';
type Transition = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'PUBLISH' | 'RESTORE' | 'NEW_DRAFT';
type EntryRow = { key: string; source: string; target: string };

const EMPTY_BUNDLES: LocalizationBundleSummary[] = [];

const stateColor: Record<
  LocalizationRevisionState,
  'default' | 'info' | 'warning' | 'success' | 'error'
> = {
  DRAFT: 'default',
  IN_REVIEW: 'warning',
  APPROVED: 'info',
  REJECTED: 'error',
  PUBLISHED: 'success',
  SUPERSEDED: 'default',
};

function revisionRows(revision: LocalizationRevision): EntryRow[] {
  const keys = new Set([...Object.keys(revision.sourceEntries), ...Object.keys(revision.entries)]);
  return [...keys]
    .sort((left, right) => left.localeCompare(right))
    .map((key) => ({
      key,
      source: revision.sourceEntries[key] ?? '',
      target: revision.entries[key] ?? '',
    }));
}

function rowsToEntries(rows: EntryRow[]) {
  return {
    sourceEntries: Object.fromEntries(rows.map((row) => [row.key.trim(), row.source.trim()])),
    entries: Object.fromEntries(rows.map((row) => [row.key.trim(), row.target.trim()])),
  };
}

function entryFingerprint(entries: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(entries).sort(([left], [right]) => left.localeCompare(right))
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Box sx={{ px: 2, py: 1.5, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" sx={{ mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  );
}

function BundleListItem({
  bundle,
  selected,
  onSelect,
}: {
  bundle: LocalizationBundleSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('admin');
  const state =
    bundle.openRevisionState ?? (bundle.currentPublishedRevisionId ? 'PUBLISHED' : null);
  return (
    <Box component="li">
      <Box
        component="button"
        type="button"
        onClick={onSelect}
        sx={{
          width: 1,
          minHeight: 84,
          px: 2,
          py: 1.5,
          border: 0,
          borderLeft: 3,
          borderLeftColor: selected ? 'primary.main' : 'transparent',
          bgcolor: selected ? 'action.selected' : 'transparent',
          color: 'text.primary',
          textAlign: 'left',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {bundle.bundleKey}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {bundle.sourceLocale} → {bundle.targetLocale}
            </Typography>
          </Box>
          {state && (
            <Chip
              size="small"
              color={stateColor[state]}
              variant={state === 'PUBLISHED' ? 'filled' : 'outlined'}
              label={t(`localization.states.${state}`)}
            />
          )}
        </Stack>
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t('localization.bundle.completeness', { value: bundle.completeness })}
          </Typography>
          <Typography variant="caption" color={bundle.issueCount ? 'error.main' : 'success.main'}>
            {t('localization.bundle.issues', { count: bundle.issueCount })}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={bundle.completeness}
          color={bundle.issueCount ? 'warning' : 'success'}
          sx={{ mt: 0.75, height: 3 }}
        />
      </Box>
    </Box>
  );
}

function CreateBundleDialog({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (request: CreateLocalizationBundleRequest) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [bundleKey, setBundleKey] = useState('');
  const [sourceLocale, setSourceLocale] = useState('en');
  const [targetLocale, setTargetLocale] = useState('ko');
  const [entryKey, setEntryKey] = useState('');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [summary, setSummary] = useState('');
  const valid =
    /^[a-z][a-z0-9.-]{2,119}$/.test(bundleKey.trim()) &&
    sourceLocale.trim() !== targetLocale.trim() &&
    entryKey.trim().length > 0 &&
    source.trim().length > 0 &&
    summary.trim().length >= 5;

  return (
    <FormDialog
      open={open}
      title={t('localization.create.title')}
      description={t('localization.create.description')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('localization.actions.createBundle')}
      submittingLabel={t('localization.actions.creating')}
      submitDisabled={!valid}
      busy={busy}
      maxWidth="md"
      onClose={onClose}
      onSubmit={() =>
        onSubmit({
          bundleKey: bundleKey.trim(),
          sourceLocale: sourceLocale.trim(),
          targetLocale: targetLocale.trim(),
          sourceEntries: { [entryKey.trim()]: source.trim() },
          entries: target.trim() ? { [entryKey.trim()]: target.trim() } : {},
          changeSummary: summary.trim(),
        })
      }
    >
      <Stack gap={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            autoFocus
            required
            fullWidth
            label={t('localization.fields.bundleKey')}
            value={bundleKey}
            onChange={(event) => setBundleKey(event.target.value)}
            supportingText={t('localization.create.bundleKeyHelp')}
          />
          <FormField
            select
            required
            fullWidth
            label={t('localization.fields.sourceLocale')}
            value={sourceLocale}
            onChange={(event) => setSourceLocale(event.target.value)}
          >
            <MenuItem value="en">{t('localization.locales.en')}</MenuItem>
            <MenuItem value="ko">{t('localization.locales.ko')}</MenuItem>
          </FormField>
          <FormField
            select
            required
            fullWidth
            label={t('localization.fields.targetLocale')}
            value={targetLocale}
            onChange={(event) => setTargetLocale(event.target.value)}
          >
            <MenuItem value="ko">{t('localization.locales.ko')}</MenuItem>
            <MenuItem value="en">{t('localization.locales.en')}</MenuItem>
          </FormField>
        </Stack>
        <Divider />
        <FormField
          required
          fullWidth
          label={t('localization.fields.key')}
          value={entryKey}
          onChange={(event) => setEntryKey(event.target.value)}
          supportingText={t('localization.create.entryHelp')}
        />
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
          <FormField
            required
            multiline
            minRows={3}
            fullWidth
            label={t('localization.fields.sourceText')}
            value={source}
            onChange={(event) => setSource(event.target.value)}
          />
          <FormField
            multiline
            minRows={3}
            fullWidth
            label={t('localization.fields.translation')}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            supportingText={t('localization.create.fallbackHelp')}
          />
        </Stack>
        <FormField
          required
          multiline
          minRows={2}
          fullWidth
          label={t('localization.fields.changeSummary')}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
      </Stack>
    </FormDialog>
  );
}

function TransitionDialog({
  transition,
  busy,
  onClose,
  onSubmit,
}: {
  transition: Transition | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [reason, setReason] = useState('');
  if (!transition) return null;
  const destructive = transition === 'REJECT';
  return (
    <FormDialog
      open
      title={t(`localization.transitions.${transition}.title`)}
      description={t(`localization.transitions.${transition}.description`)}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t(`localization.transitions.${transition}.submit`)}
      submittingLabel={t('localization.actions.saving')}
      submitIntent={destructive ? 'danger' : 'primary'}
      submitDisabled={reason.trim().length < 5}
      busy={busy}
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim())}
    >
      <FormField
        autoFocus
        required
        multiline
        minRows={4}
        fullWidth
        label={t('localization.fields.reason')}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        supportingText={t('localization.transitions.reasonHelp')}
        slotProps={{ htmlInput: { maxLength: 1000 } }}
      />
    </FormDialog>
  );
}

function QualitySummary({ revision }: { revision: LocalizationRevision }) {
  const { t } = useTranslation('admin');
  const preview = revision.preview;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, 1fr)' },
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Metric label={t('localization.quality.completeness')} value={`${preview.completeness}%`} />
      <Metric label={t('localization.quality.missing')} value={preview.missingKeys.length} />
      <Metric
        label={t('localization.quality.placeholders')}
        value={preview.placeholderIssues.length}
      />
      <Metric label={t('localization.quality.unknown')} value={preview.unknownKeys.length} />
    </Box>
  );
}

function Editor({
  revision,
  rows,
  onRowsChange,
}: {
  revision: LocalizationRevision;
  rows: EntryRow[];
  onRowsChange: (rows: EntryRow[]) => void;
}) {
  const { t } = useTranslation('admin');
  const editable = revision.lifecycleState === 'DRAFT';
  const addRow = () => onRowsChange([...rows, { key: '', source: '', target: '' }]);
  const update = (index: number, field: keyof EntryRow, value: string) =>
    onRowsChange(
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    );

  return (
    <Stack gap={1.25}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Box>
          <Typography variant="subtitle2">{t('localization.editor.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('localization.editor.description')}
          </Typography>
        </Box>
        {editable && (
          <ActionButton
            intent="secondary"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={addRow}
          >
            {t('localization.actions.addKey')}
          </ActionButton>
        )}
      </Stack>
      <Box
        role="table"
        aria-label={t('localization.editor.tableLabel')}
        sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
      >
        <Box
          role="row"
          sx={{
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns: 'minmax(150px, .7fr) minmax(220px, 1fr) minmax(220px, 1fr) 44px',
            px: 1.5,
            py: 1,
            bgcolor: 'action.hover',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {['key', 'sourceText', 'translation'].map((field) => (
            <Typography key={field} role="columnheader" variant="caption" color="text.secondary">
              {t(`localization.fields.${field}`)}
            </Typography>
          ))}
          <Box />
        </Box>
        <Stack divider={<Divider flexItem />}>
          {rows.map((row, index) => (
            <Box
              role="row"
              key={`${index}-${row.key}`}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr) 40px',
                  md: 'minmax(150px, .7fr) minmax(220px, 1fr) minmax(220px, 1fr) 44px',
                },
                gap: 1,
                p: 1.25,
                alignItems: 'start',
              }}
            >
              <FormField
                size="small"
                label={t('localization.fields.key')}
                value={row.key}
                disabled={!editable}
                onChange={(event) => update(index, 'key', event.target.value)}
                sx={{ gridColumn: { xs: '1', md: 'auto' } }}
              />
              <FormField
                size="small"
                multiline
                minRows={2}
                label={t('localization.fields.sourceText')}
                value={row.source}
                disabled={!editable}
                onChange={(event) => update(index, 'source', event.target.value)}
                sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
              />
              <FormField
                size="small"
                multiline
                minRows={2}
                label={t('localization.fields.translation')}
                value={row.target}
                disabled={!editable}
                errorMessage={
                  revision.preview.missingKeys.includes(row.key)
                    ? t('localization.quality.missingValue')
                    : revision.preview.placeholderIssues.some((issue) => issue.key === row.key)
                      ? t('localization.quality.placeholderMismatch')
                      : undefined
                }
                onChange={(event) => update(index, 'target', event.target.value)}
                sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
              />
              <ActionIconButton
                label={t('localization.actions.removeKey', { key: row.key || index + 1 })}
                tooltip={t('localization.actions.remove')}
                size="small"
                disabled={!editable || rows.length === 1}
                onClick={() =>
                  onRowsChange(rows.filter((_candidate, rowIndex) => rowIndex !== index))
                }
                sx={{ gridColumn: { xs: '2', md: 'auto' }, gridRow: { xs: '1', md: 'auto' } }}
              >
                <Trash2 size={16} />
              </ActionIconButton>
            </Box>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

export function LocalizationStudio() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [view, setView] = useState<WorkspaceView>('EDITOR');
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [changeSummary, setChangeSummary] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [transition, setTransition] = useState<Transition | null>(null);
  const [busy, setBusy] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: ['admin', 'localization'],
    queryFn: getLocalizationWorkspace,
  });
  const bundles = workspaceQuery.data?.bundles ?? EMPTY_BUNDLES;
  const selectedBundle =
    bundles.find((bundle) => bundle.bundleId === selectedBundleId) ?? bundles[0] ?? null;
  const revisionsQuery = useQuery({
    queryKey: ['admin', 'localization', selectedBundle?.bundleId, 'revisions'],
    queryFn: () => listLocalizationRevisions(selectedBundle!.bundleId),
    enabled: Boolean(selectedBundle),
  });
  const revisions = revisionsQuery.data ?? [];
  const selectedRevision =
    revisions.find((revision) => revision.revisionId === selectedRevisionId) ??
    revisions[0] ??
    null;
  const diffQuery = useQuery({
    queryKey: ['admin', 'localization', selectedRevision?.revisionId, 'diff'],
    queryFn: () => getLocalizationDiff(selectedRevision!.revisionId),
    enabled: Boolean(selectedRevision && view === 'DIFF'),
  });

  useEffect(() => {
    if (!selectedBundleId && bundles[0]) setSelectedBundleId(bundles[0].bundleId);
  }, [bundles, selectedBundleId]);

  useEffect(() => {
    if (!selectedRevision) return;
    setSelectedRevisionId(selectedRevision.revisionId);
    setRows(revisionRows(selectedRevision));
    setChangeSummary(selectedRevision.changeSummary);
  }, [selectedRevision]);

  const dirty = useMemo(() => {
    if (!selectedRevision || selectedRevision.lifecycleState !== 'DRAFT') return false;
    const entries = rowsToEntries(rows);
    return (
      entryFingerprint(entries.sourceEntries) !==
        entryFingerprint(selectedRevision.sourceEntries) ||
      entryFingerprint(entries.entries) !== entryFingerprint(selectedRevision.entries) ||
      changeSummary.trim() !== selectedRevision.changeSummary
    );
  }, [changeSummary, rows, selectedRevision]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'localization'] });
  };

  const run = async (operation: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await operation();
      await refresh();
      toast.success(message);
      setTransition(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.operationError'));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!selectedRevision) return;
    const entries = rowsToEntries(rows);
    await run(
      () =>
        saveLocalizationDraft(selectedRevision.revisionId, {
          ...entries,
          changeSummary: changeSummary.trim(),
          version: selectedRevision.version,
        }),
      t('localization.toasts.saved')
    );
  };

  const handleTransition = async (reason: string) => {
    if (!selectedRevision || !selectedBundle || !transition) return;
    const actions: Record<Transition, () => Promise<unknown>> = {
      SUBMIT: () =>
        submitLocalizationRevision(selectedRevision.revisionId, reason, selectedRevision.version),
      APPROVE: () =>
        decideLocalizationRevision(
          selectedRevision.revisionId,
          'APPROVED',
          reason,
          selectedRevision.version
        ),
      REJECT: () =>
        decideLocalizationRevision(
          selectedRevision.revisionId,
          'REJECTED',
          reason,
          selectedRevision.version
        ),
      PUBLISH: () =>
        publishLocalizationRevision(selectedRevision.revisionId, reason, selectedRevision.version),
      RESTORE: () => restoreLocalizationRevision(selectedRevision.revisionId, reason),
      NEW_DRAFT: () => createLocalizationDraft(selectedBundle.bundleId, reason),
    };
    await run(actions[transition], t(`localization.toasts.${transition}`));
  };

  if (workspaceQuery.isLoading) {
    return <AdminPanelLoading label={t('localization.loading')} />;
  }
  if (workspaceQuery.isError) {
    return (
      <AdminPanelError
        message={
          workspaceQuery.error instanceof Error
            ? workspaceQuery.error.message
            : t('common.operationError')
        }
      />
    );
  }

  const workspace = workspaceQuery.data!;
  const hasOpenRevision = Boolean(selectedBundle?.openRevisionState);
  const closedRevision =
    selectedRevision &&
    ['PUBLISHED', 'SUPERSEDED', 'REJECTED'].includes(selectedRevision.lifecycleState);

  return (
    <>
      <Stack gap={2.5}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, 1fr)' },
            borderTop: 1,
            borderBottom: 1,
            borderColor: 'divider',
            '& > * + *': { borderLeft: 1, borderColor: 'divider' },
          }}
        >
          <Metric label={t('localization.metrics.bundles')} value={workspace.bundleCount} />
          <Metric label={t('localization.metrics.drafts')} value={workspace.draftCount} />
          <Metric label={t('localization.metrics.review')} value={workspace.reviewCount} />
          <Metric label={t('localization.metrics.published')} value={workspace.publishedCount} />
          <Metric label={t('localization.metrics.issues')} value={workspace.issueCount} />
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
          <Box>
            <Typography variant="subtitle1">{t('localization.workspace.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('localization.workspace.description')}
            </Typography>
          </Box>
          <Stack direction="row" gap={1}>
            <ActionIconButton
              label={t('common.actions.refresh')}
              tooltip={t('common.actions.refresh')}
              onClick={() => void refresh()}
            >
              <RefreshCw size={18} />
            </ActionIconButton>
            <ActionButton
              intent="primary"
              startIcon={<Plus size={16} />}
              onClick={() => setCreateOpen(true)}
            >
              {t('localization.actions.createBundle')}
            </ActionButton>
          </Stack>
        </Stack>

        {!bundles.length ? (
          <GuidedEmptyState
            kind="empty"
            title={t('localization.empty.title')}
            description={t('localization.empty.description')}
            actionLabel={t('localization.actions.createBundle')}
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '300px minmax(0, 1fr)' },
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                borderRight: { xs: 0, lg: 1 },
                borderBottom: { xs: 1, lg: 0 },
                borderColor: 'divider',
              }}
            >
              <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2">{t('localization.bundle.listTitle')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('localization.bundle.listDescription')}
                </Typography>
              </Box>
              <Stack
                component="ul"
                divider={<Divider flexItem />}
                sx={{ p: 0, m: 0, listStyle: 'none', maxHeight: { lg: 760 }, overflowY: 'auto' }}
              >
                {bundles.map((bundle) => (
                  <BundleListItem
                    key={bundle.bundleId}
                    bundle={bundle}
                    selected={bundle.bundleId === selectedBundle?.bundleId}
                    onSelect={() => {
                      setSelectedBundleId(bundle.bundleId);
                      setSelectedRevisionId(null);
                      setView('EDITOR');
                    }}
                  />
                ))}
              </Stack>
            </Box>

            <Box sx={{ minWidth: 0 }}>
              {revisionsQuery.isLoading ? (
                <AdminPanelLoading label={t('localization.loadingRevisions')} />
              ) : !selectedRevision ? (
                <GuidedEmptyState
                  kind="empty"
                  title={t('localization.revision.emptyTitle')}
                  description={t('localization.revision.emptyDescription')}
                />
              ) : (
                <Stack gap={0}>
                  <Box
                    sx={{ px: { xs: 2, md: 2.5 }, py: 2, borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                      gap={1.5}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography variant="h6">{selectedRevision.bundleKey}</Typography>
                          <Chip
                            size="small"
                            color={stateColor[selectedRevision.lifecycleState]}
                            label={t(`localization.states.${selectedRevision.lifecycleState}`)}
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={t('localization.revision.number', {
                              number: selectedRevision.revisionNumber,
                            })}
                          />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                          {selectedRevision.sourceLocale} → {selectedRevision.targetLocale} ·{' '}
                          {formatDate(selectedRevision.updatedAt, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </Typography>
                      </Box>
                      <Stack direction="row" gap={1} flexWrap="wrap">
                        {selectedRevision.lifecycleState === 'DRAFT' && (
                          <>
                            <ActionButton
                              intent="secondary"
                              startIcon={<Save size={16} />}
                              disabled={!dirty || changeSummary.trim().length < 5}
                              loading={busy}
                              onClick={() => void save()}
                            >
                              {t('localization.actions.saveDraft')}
                            </ActionButton>
                            <ActionButton
                              intent="primary"
                              startIcon={<Send size={16} />}
                              disabled={dirty || !selectedRevision.preview.publishable}
                              onClick={() => setTransition('SUBMIT')}
                            >
                              {t('localization.actions.submit')}
                            </ActionButton>
                          </>
                        )}
                        {selectedRevision.lifecycleState === 'IN_REVIEW' && (
                          <>
                            <ActionButton
                              intent="secondary"
                              startIcon={<X size={16} />}
                              onClick={() => setTransition('REJECT')}
                            >
                              {t('localization.actions.reject')}
                            </ActionButton>
                            <ActionButton
                              intent="primary"
                              startIcon={<Check size={16} />}
                              onClick={() => setTransition('APPROVE')}
                            >
                              {t('localization.actions.approve')}
                            </ActionButton>
                          </>
                        )}
                        {selectedRevision.lifecycleState === 'APPROVED' && (
                          <ActionButton
                            intent="primary"
                            startIcon={<Rocket size={16} />}
                            onClick={() => setTransition('PUBLISH')}
                          >
                            {t('localization.actions.publish')}
                          </ActionButton>
                        )}
                        {closedRevision && !hasOpenRevision && (
                          <ActionButton
                            intent="secondary"
                            startIcon={<ArchiveRestore size={16} />}
                            onClick={() => setTransition('RESTORE')}
                          >
                            {t('localization.actions.restore')}
                          </ActionButton>
                        )}
                        {selectedRevision.lifecycleState === 'PUBLISHED' && !hasOpenRevision && (
                          <ActionButton
                            intent="primary"
                            startIcon={<Plus size={16} />}
                            onClick={() => setTransition('NEW_DRAFT')}
                          >
                            {t('localization.actions.newDraft')}
                          </ActionButton>
                        )}
                      </Stack>
                    </Stack>

                    <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} sx={{ mt: 2 }}>
                      <FormField
                        size="small"
                        fullWidth
                        label={t('localization.fields.changeSummary')}
                        value={changeSummary}
                        disabled={selectedRevision.lifecycleState !== 'DRAFT'}
                        onChange={(event) => setChangeSummary(event.target.value)}
                      />
                      <FormField
                        select
                        size="small"
                        label={t('localization.revision.select')}
                        value={selectedRevision.revisionId}
                        onChange={(event) => {
                          setSelectedRevisionId(event.target.value);
                          setView('EDITOR');
                        }}
                        sx={{ minWidth: { md: 210 } }}
                      >
                        {revisions.map((revision) => (
                          <MenuItem key={revision.revisionId} value={revision.revisionId}>
                            {t('localization.revision.option', {
                              number: revision.revisionNumber,
                              state: t(`localization.states.${revision.lifecycleState}`),
                            })}
                          </MenuItem>
                        ))}
                      </FormField>
                    </Stack>
                  </Box>

                  <QualitySummary revision={selectedRevision} />

                  {!selectedRevision.preview.publishable && (
                    <Alert severity="warning" sx={{ borderRadius: 0 }}>
                      {t('localization.quality.blocked')}
                    </Alert>
                  )}

                  <Box sx={{ px: { xs: 2, md: 2.5 }, pt: 2 }}>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={view}
                      aria-label={t('localization.views.label')}
                      onChange={(_event, value: WorkspaceView | null) => value && setView(value)}
                    >
                      <ToggleButton value="EDITOR">
                        <Save size={15} />
                        <Box component="span" sx={{ ml: 0.75 }}>
                          {t('localization.views.editor')}
                        </Box>
                      </ToggleButton>
                      <ToggleButton value="DIFF">
                        <GitCompareArrows size={15} />
                        <Box component="span" sx={{ ml: 0.75 }}>
                          {t('localization.views.diff')}
                        </Box>
                      </ToggleButton>
                      <ToggleButton value="PREVIEW">
                        <Eye size={15} />
                        <Box component="span" sx={{ ml: 0.75 }}>
                          {t('localization.views.preview')}
                        </Box>
                      </ToggleButton>
                      <ToggleButton value="HISTORY">
                        <History size={15} />
                        <Box component="span" sx={{ ml: 0.75 }}>
                          {t('localization.views.history')}
                        </Box>
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  <Box sx={{ p: { xs: 2, md: 2.5 }, minHeight: 320 }}>
                    {view === 'EDITOR' && (
                      <Editor revision={selectedRevision} rows={rows} onRowsChange={setRows} />
                    )}
                    {view === 'DIFF' &&
                      (diffQuery.isLoading ? (
                        <AdminPanelLoading label={t('localization.diff.loading')} />
                      ) : (
                        <Stack gap={1}>
                          <Typography variant="subtitle2">
                            {t('localization.diff.title')}
                          </Typography>
                          {(diffQuery.data?.entries ?? []).map((entry) => (
                            <Box
                              key={entry.key}
                              sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}
                            >
                              <Stack direction="row" justifyContent="space-between" gap={1}>
                                <Typography variant="subtitle2">{entry.key}</Typography>
                                <Chip
                                  size="small"
                                  label={t(`localization.diff.states.${entry.changeType}`)}
                                />
                              </Stack>
                              <Stack direction={{ xs: 'column', md: 'row' }} gap={2} sx={{ mt: 1 }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    {t('localization.diff.before')}
                                  </Typography>
                                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                                    {entry.beforeValue || '—'}
                                  </Typography>
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    {t('localization.diff.after')}
                                  </Typography>
                                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                                    {entry.afterValue || '—'}
                                  </Typography>
                                </Box>
                              </Stack>
                            </Box>
                          ))}
                        </Stack>
                      ))}
                    {view === 'PREVIEW' && (
                      <Stack gap={1}>
                        <Typography variant="subtitle2">
                          {t('localization.preview.title')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('localization.preview.description')}
                        </Typography>
                        {Object.entries(selectedRevision.preview.resolvedEntries).map(
                          ([key, value]) => (
                            <Box
                              key={key}
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: 'minmax(180px, .45fr) 1fr' },
                                gap: 1,
                                py: 1.25,
                                borderTop: 1,
                                borderColor: 'divider',
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ overflowWrap: 'anywhere' }}
                              >
                                {key}
                              </Typography>
                              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                                {value}
                                {selectedRevision.preview.fallbackKeys.includes(key) && (
                                  <Chip
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                    label={t('localization.preview.fallback')}
                                    sx={{ ml: 1 }}
                                  />
                                )}
                              </Typography>
                            </Box>
                          )
                        )}
                      </Stack>
                    )}
                    {view === 'HISTORY' && (
                      <Stack divider={<Divider flexItem />}>
                        {!selectedRevision.decisions.length ? (
                          <GuidedEmptyState
                            kind="empty"
                            size="compact"
                            title={t('localization.history.emptyTitle')}
                            description={t('localization.history.emptyDescription')}
                          />
                        ) : (
                          selectedRevision.decisions.map((decision) => (
                            <Box key={decision.decisionId} sx={{ py: 1.5 }}>
                              <Stack direction="row" justifyContent="space-between" gap={1}>
                                <Typography variant="subtitle2">
                                  {t(`localization.decisions.${decision.decision}`)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatDate(decision.decidedAt, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })}
                                </Typography>
                              </Stack>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {decision.reason}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {t('localization.history.actor', { id: decision.actorId })}
                              </Typography>
                            </Box>
                          ))
                        )}
                      </Stack>
                    )}
                  </Box>
                </Stack>
              )}
            </Box>
          </Box>
        )}
      </Stack>

      <CreateBundleDialog
        key={String(createOpen)}
        open={createOpen}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (request) => {
          await run(async () => {
            const created = await createLocalizationBundle(request);
            setSelectedBundleId(created.bundleId);
            setSelectedRevisionId(created.revisionId);
            setCreateOpen(false);
          }, t('localization.toasts.created'));
        }}
      />
      <TransitionDialog
        key={transition ?? 'none'}
        transition={transition}
        busy={busy}
        onClose={() => setTransition(null)}
        onSubmit={handleTransition}
      />
    </>
  );
}
