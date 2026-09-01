import { useTranslation } from 'react-i18next';
import { BookmarkPlus, Copy, Download, FileJson2, FolderInput, ShieldCheck, X } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { OutcomeChip, RiskScore, SeverityChip, actorLabel, targetLabel } from './audit-ui';

import type { AuditCase, AuditEvent, AuditWindow } from '@dwp-frontend/shared-utils';

function JsonState({ label, value }: { label: string; value: Record<string, unknown> }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Box
        component="pre"
        sx={{
          minHeight: 120,
          maxHeight: 260,
          overflow: 'auto',
          m: 0,
          mt: 0.75,
          p: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'action.hover',
          fontFamily: 'monospace',
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {JSON.stringify(value, null, 2)}
      </Box>
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '128px minmax(0, 1fr)', gap: 2, py: 0.9 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}
      >
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

export function AuditEventDrawer({
  selected,
  canInvestigate,
  actionLabel,
  onClose,
  onPreserve,
  onCopy,
}: {
  selected: AuditEvent | null;
  canInvestigate: boolean;
  actionLabel: (action: string) => string;
  onClose: () => void;
  onPreserve: () => void;
  onCopy: (value?: string | null) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  return (
    <Drawer
      anchor="right"
      open={Boolean(selected)}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 620 }, maxWidth: '100%' } } }}
    >
      {selected && (
        <Box sx={{ minHeight: 1, display: 'flex', flexDirection: 'column' }}>
          <Stack
            direction="row"
            alignItems="flex-start"
            justifyContent="space-between"
            gap={2}
            sx={{ p: 2.5 }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" gap={1} alignItems="center">
                <SeverityChip severity={selected.severity} />
                <OutcomeChip outcome={selected.outcome} />
              </Stack>
              <Typography component="h2" variant="h5" sx={{ mt: 1.5 }}>
                {actionLabel(selected.action)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {selected.sourceService} / {selected.sourceModule}
              </Typography>
              {canInvestigate && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<FolderInput size={16} />}
                  sx={{ mt: 1.5 }}
                  onClick={onPreserve}
                >
                  {t('auditControl.explorer.preserveInCase')}
                </Button>
              )}
            </Box>
            <IconButton aria-label={t('common.actions.close')} onClick={onClose}>
              <X size={20} />
            </IconButton>
          </Stack>
          <Divider />
          <Box sx={{ p: 2.5, overflowY: 'auto' }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Typography component="h3" variant="subtitle1">
                {t('auditControl.detail.context')}
              </Typography>
              <RiskScore value={selected.riskScore} />
            </Stack>
            <DetailRow
              label={t('auditControl.detail.occurredAt')}
              value={formatDate(selected.occurredAt, { dateStyle: 'medium', timeStyle: 'long' })}
            />
            <DetailRow
              label={t('auditControl.events.columns.actor')}
              value={actorLabel(selected)}
            />
            <DetailRow
              label={t('auditControl.events.columns.target')}
              value={`${selected.targetType} / ${targetLabel(selected)}`}
            />
            <DetailRow
              label={t('auditControl.detail.roles')}
              value={selected.actorRoles.join(', ') || '—'}
            />
            <DetailRow label={t('auditControl.detail.retention')} value={selected.retentionClass} />
            <Divider sx={{ my: 2 }} />
            <Typography component="h3" variant="subtitle1">
              {t('auditControl.detail.traceability')}
            </Typography>
            {[
              ['correlation', selected.correlationId],
              ['trace', selected.traceId],
              ['eventId', selected.eventId],
            ].map(([key, value]) => (
              <Stack key={key} direction="row" alignItems="center" gap={1}>
                <Box sx={{ flex: 1 }}>
                  <DetailRow label={t(`auditControl.detail.${key}`)} value={value} />
                </Box>
                {value && (
                  <Tooltip title={t('auditControl.detail.copy')}>
                    <IconButton size="small" onClick={() => void onCopy(value)}>
                      <Copy size={15} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            ))}
            <DetailRow label={t('auditControl.detail.hash')} value={selected.recordHash} />
            <Divider sx={{ my: 2 }} />
            <Typography component="h3" variant="subtitle1" sx={{ mb: 1.5 }}>
              {t('auditControl.detail.change')}
            </Typography>
            {selected.changedFields.length > 0 && (
              <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mb: 1.5 }}>
                {selected.changedFields.map((field) => (
                  <Typography
                    key={field}
                    component="span"
                    variant="caption"
                    sx={{
                      px: 0.75,
                      py: 0.25,
                      bgcolor: 'action.selected',
                      color: 'primary.main',
                      borderRadius: 0.5,
                    }}
                  >
                    {field}
                  </Typography>
                ))}
              </Stack>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
              }}
            >
              <JsonState label={t('auditControl.detail.before')} value={selected.beforeState} />
              <JsonState label={t('auditControl.detail.after')} value={selected.afterState} />
            </Box>
            <Box sx={{ mt: 2 }}>
              <JsonState label={t('auditControl.detail.metadata')} value={selected.metadata} />
            </Box>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}

export function AuditExportDialog({
  open,
  window,
  resultCount,
  format,
  formats,
  reason,
  busy,
  onClose,
  onFormatChange,
  onReasonChange,
  onSubmit,
}: {
  open: boolean;
  window: AuditWindow;
  resultCount: number;
  format: 'CSV' | 'JSONL';
  formats: readonly ('CSV' | 'JSONL')[];
  reason: string;
  busy: boolean;
  onClose: () => void;
  onFormatChange: (format: 'CSV' | 'JSONL') => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('auditControl.export.title')}</DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ pt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: 'text.secondary' }}>
            <ShieldCheck size={18} />
            <Typography variant="body2">
              {t('auditControl.export.scope', {
                window: t(`auditControl.windows.${window}`),
                count: resultCount,
              })}
            </Typography>
          </Box>
          <ToggleButtonGroup
            exclusive
            value={format}
            onChange={(_, value: 'CSV' | 'JSONL' | null) => value && onFormatChange(value)}
            size="small"
          >
            {formats.map((item) => (
              <ToggleButton key={item} value={item}>
                {item === 'CSV' ? <Download size={16} /> : <FileJson2 size={16} />}{' '}
                {t(`auditControl.export.formats.${item}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <TextField
            autoFocus
            required
            multiline
            minRows={3}
            label={t('auditControl.export.reason')}
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            inputProps={{ maxLength: 500 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          startIcon={<Download size={17} />}
          disabled={!reason.trim() || busy}
          onClick={onSubmit}
        >
          {t('auditControl.export.download')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function AuditSavedSearchDialog({
  open,
  name,
  shared,
  canShare,
  busy,
  onClose,
  onNameChange,
  onSharedChange,
  onSubmit,
}: {
  open: boolean;
  name: string;
  shared: boolean;
  canShare: boolean;
  busy: boolean;
  onClose: () => void;
  onNameChange: (name: string) => void;
  onSharedChange: (shared: boolean) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('auditControl.savedSearches.saveTitle')}</DialogTitle>
      <DialogContent>
        <Stack gap={1.5} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            required
            label={t('auditControl.savedSearches.name')}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            inputProps={{ maxLength: 160 }}
          />
          {canShare && (
            <FormControlLabel
              control={
                <Switch
                  checked={shared}
                  onChange={(event) => onSharedChange(event.target.checked)}
                />
              }
              label={t('auditControl.savedSearches.shared')}
            />
          )}
          <Typography variant="caption" color="text.secondary">
            {t('auditControl.savedSearches.upsertHint')}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          startIcon={<BookmarkPlus size={17} />}
          disabled={!name.trim() || busy}
          onClick={onSubmit}
        >
          {t('common.actions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function AuditCaseLinkDialog({
  open,
  cases,
  caseId,
  note,
  busy,
  onClose,
  onCaseIdChange,
  onNoteChange,
  onSubmit,
}: {
  open: boolean;
  cases: AuditCase[];
  caseId: string;
  note: string;
  busy: boolean;
  onClose: () => void;
  onCaseIdChange: (caseId: string) => void;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation('admin');
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('auditControl.explorer.preserveTitle')}</DialogTitle>
      <DialogContent>
        <Stack gap={1.5} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t('auditControl.explorer.preserveHint')}
          </Typography>
          <TextField
            select
            required
            label={t('auditControl.investigations.linkCase')}
            value={caseId}
            onChange={(event) => onCaseIdChange(event.target.value)}
          >
            {cases.map((item) => (
              <MenuItem key={item.caseId} value={item.caseId}>
                #{item.caseNumber} {item.title}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            multiline
            minRows={3}
            label={t('auditControl.explorer.evidenceNote')}
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            inputProps={{ maxLength: 2000 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          startIcon={<FolderInput size={17} />}
          disabled={!caseId || busy}
          onClick={onSubmit}
        >
          {t('auditControl.explorer.preserve')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
