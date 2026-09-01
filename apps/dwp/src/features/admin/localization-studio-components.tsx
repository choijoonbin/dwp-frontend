import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import type {
  CreateLocalizationBundleRequest,
  LocalizationBundleSummary,
  LocalizationRevision,
  LocalizationRevisionState,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  ProgressMeter,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export type WorkspaceView = 'EDITOR' | 'DIFF' | 'PREVIEW' | 'HISTORY';
export type Transition = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'PUBLISH' | 'RESTORE' | 'NEW_DRAFT';
export type EntryRow = { key: string; source: string; target: string };

export const EMPTY_BUNDLES: LocalizationBundleSummary[] = [];

export const stateColor: Record<
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

export function revisionRows(revision: LocalizationRevision): EntryRow[] {
  const keys = new Set([...Object.keys(revision.sourceEntries), ...Object.keys(revision.entries)]);
  return [...keys]
    .sort((left, right) => left.localeCompare(right))
    .map((key) => ({
      key,
      source: revision.sourceEntries[key] ?? '',
      target: revision.entries[key] ?? '',
    }));
}

export function rowsToEntries(rows: EntryRow[]) {
  return {
    sourceEntries: Object.fromEntries(rows.map((row) => [row.key.trim(), row.source.trim()])),
    entries: Object.fromEntries(rows.map((row) => [row.key.trim(), row.target.trim()])),
  };
}

export function entryFingerprint(entries: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(entries).sort(([left], [right]) => left.localeCompare(right))
  );
}

export function Metric({ label, value }: { label: string; value: number | string }) {
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

export function BundleListItem({
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
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
          <Typography variant="caption" color={bundle.issueCount ? 'error.dark' : 'success.dark'}>
            {t('localization.bundle.issues', { count: bundle.issueCount })}
          </Typography>
        </Stack>
        <ProgressMeter
          label={t('localization.bundle.completeness', { value: bundle.completeness })}
          value={bundle.completeness}
          valueLabel={`${bundle.completeness}%`}
          tone={bundle.issueCount ? 'warning' : 'success'}
          size="compact"
          sx={{ mt: 0.5 }}
        />
      </Box>
    </Box>
  );
}

export function CreateBundleDialog({
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

export function TransitionDialog({
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

export function QualitySummary({ revision }: { revision: LocalizationRevision }) {
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

export function Editor({
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
        role="group"
        aria-label={t('localization.editor.tableLabel')}
        sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
      >
        <Box
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
            <Typography key={field} variant="caption" color="text.secondary">
              {t(`localization.fields.${field}`)}
            </Typography>
          ))}
          <Box />
        </Box>
        <Stack divider={<Divider flexItem />}>
          {rows.map((row, index) => (
            <Box
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
