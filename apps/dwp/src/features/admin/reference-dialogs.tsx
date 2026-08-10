import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { productLocales } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import type {
  ReferenceItem,
  ReferenceLabel,
  ReferenceSetDetail,
  CreateReferenceSetRequest,
  CreateReferenceItemRequest,
  UpdateReferenceSetRequest,
  UpdateReferenceItemRequest,
} from '@dwp-frontend/shared-utils';

type ReferenceSetDialogProps = {
  open: boolean;
  value?: ReferenceSetDetail | null;
  busy: boolean;
  onClose: () => void;
  onCreate: (request: CreateReferenceSetRequest) => Promise<void>;
  onUpdate: (request: UpdateReferenceSetRequest) => Promise<void>;
};

export function ReferenceSetDialog({
  open,
  value,
  busy,
  onClose,
  onCreate,
  onUpdate,
}: ReferenceSetDialogProps) {
  const { t } = useTranslation('admin');
  const [setKey, setSetKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setSetKey(value?.setKey ?? '');
    setName(value?.name ?? '');
    setDescription(value?.description ?? '');
  }, [open, value]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (value) {
      await onUpdate({
        name: name.trim(),
        description: description.trim(),
        version: value.version,
      });
      return;
    }
    await onCreate({
      setKey: setKey.trim(),
      name: name.trim(),
      description: description.trim(),
    });
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={(event) => void submit(event)}>
        <DialogTitle>
          {value
            ? t('referenceData.dialogs.set.editTitle')
            : t('referenceData.dialogs.set.newTitle')}
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          <TextField
            autoFocus={!value}
            label={t('referenceData.fields.setKey')}
            value={setKey}
            onChange={(event) => setSetKey(event.target.value.toUpperCase())}
            disabled={Boolean(value)}
            required
            inputProps={{ pattern: '[A-Za-z][A-Za-z0-9_.-]{1,79}', maxLength: 80 }}
          />
          <TextField
            autoFocus={Boolean(value)}
            label={t('referenceData.fields.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            inputProps={{ maxLength: 160 }}
          />
          <TextField
            label={t('referenceData.fields.description')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={3}
            inputProps={{ maxLength: 1000 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !setKey.trim() || !name.trim()}
          >
            {value ? t('referenceData.actions.saveChanges') : t('referenceData.actions.createSet')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

type ReferenceItemDialogProps = {
  open: boolean;
  value?: ReferenceItem | null;
  busy: boolean;
  onClose: () => void;
  onCreate: (request: CreateReferenceItemRequest) => Promise<void>;
  onUpdate: (request: UpdateReferenceItemRequest) => Promise<void>;
};

function emptyLabels(): ReferenceLabel[] {
  return productLocales.map(({ code }) => ({ locale: code, label: '', description: '' }));
}

function toLocalDateTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toInstant(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

export function ReferenceItemDialog({
  open,
  value,
  busy,
  onClose,
  onCreate,
  onUpdate,
}: ReferenceItemDialogProps) {
  const { t } = useTranslation('admin');
  const [code, setCode] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [parentCode, setParentCode] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [labels, setLabels] = useState<ReferenceLabel[]>(emptyLabels);

  useEffect(() => {
    if (!open) return;
    setCode(value?.code ?? '');
    setSortOrder(String(value?.sortOrder ?? 0));
    setParentCode(value?.parentCode ?? '');
    setValidFrom(toLocalDateTime(value?.validFrom));
    setValidTo(toLocalDateTime(value?.validTo));
    setLabels(value?.labels.length ? value.labels.map((label) => ({ ...label })) : emptyLabels());
  }, [open, value]);

  const updateLabel = (index: number, next: Partial<ReferenceLabel>) => {
    setLabels((current) =>
      current.map((label, labelIndex) => (labelIndex === index ? { ...label, ...next } : label))
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedLabels = labels
      .map((label) => ({
        locale: label.locale.trim(),
        label: label.label.trim(),
        description: label.description?.trim(),
      }))
      .filter((label) => label.locale && label.label);
    const common = {
      sortOrder: Number(sortOrder),
      parentCode: parentCode.trim() || undefined,
      validFrom: toInstant(validFrom),
      validTo: toInstant(validTo),
      labels: normalizedLabels,
    };
    if (value) {
      await onUpdate({ ...common, version: value.version });
      return;
    }
    await onCreate({ ...common, code: code.trim() });
  };

  const valid =
    code.trim().length > 0 &&
    Number.isFinite(Number(sortOrder)) &&
    labels.some((label) => label.locale.trim() && label.label.trim());

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <Box component="form" onSubmit={(event) => void submit(event)}>
        <DialogTitle>
          {value
            ? t('referenceData.dialogs.item.editTitle')
            : t('referenceData.dialogs.item.newTitle')}
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 160px' },
              gap: 2,
            }}
          >
            <TextField
              autoFocus={!value}
              label={t('referenceData.fields.code')}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              disabled={Boolean(value)}
              required
              inputProps={{ pattern: '[A-Za-z0-9][A-Za-z0-9_.-]{0,79}', maxLength: 80 }}
            />
            <TextField
              label={t('referenceData.fields.sortOrder')}
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              required
              inputProps={{ min: -1000000, max: 1000000 }}
            />
            <TextField
              label={t('referenceData.fields.parentCode')}
              value={parentCode}
              onChange={(event) => setParentCode(event.target.value.toUpperCase())}
              inputProps={{ maxLength: 80 }}
            />
            <Box />
            <TextField
              label={t('referenceData.fields.validFrom')}
              type="datetime-local"
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label={t('referenceData.fields.validTo')}
              type="datetime-local"
              value={validTo}
              onChange={(event) => setValidTo(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 3 }}>
            <Box component="h3" sx={{ m: 0, typography: 'subtitle2' }}>
              {t('referenceData.localizedLabels')}
            </Box>
            <Tooltip title={t('referenceData.actions.addLocale')}>
              <IconButton
                size="small"
                aria-label={t('referenceData.actions.addLocale')}
                onClick={() => setLabels((current) => [...current, { locale: '', label: '' }])}
              >
                <Plus size={18} strokeWidth={1.8} />
              </IconButton>
            </Tooltip>
          </Stack>
          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
            {labels.map((label, index) => (
              <Box
                key={`${index}-${label.locale}`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '92px minmax(0, 1fr) 36px',
                    sm: '120px minmax(0, 1fr) 36px',
                  },
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <TextField
                  label={t('referenceData.fields.locale')}
                  size="small"
                  value={label.locale}
                  onChange={(event) => updateLabel(index, { locale: event.target.value })}
                  inputProps={{ maxLength: 20 }}
                />
                <TextField
                  label={t('referenceData.fields.label')}
                  size="small"
                  value={label.label}
                  onChange={(event) => updateLabel(index, { label: event.target.value })}
                  inputProps={{ maxLength: 200 }}
                />
                <Tooltip title={t('referenceData.actions.removeLocale')}>
                  <span>
                    <IconButton
                      size="small"
                      aria-label={t('referenceData.actions.removeLocaleAt', {
                        index: index + 1,
                      })}
                      disabled={labels.length === 1}
                      onClick={() =>
                        setLabels((current) =>
                          current.filter((_, labelIndex) => labelIndex !== index)
                        )
                      }
                    >
                      <Trash2 size={17} strokeWidth={1.8} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={busy || !valid}>
            {value ? t('referenceData.actions.saveChanges') : t('referenceData.actions.createItem')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

type ConfirmActionDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function ConfirmActionDialog({
  open,
  title,
  message,
  confirmLabel,
  busy,
  destructive = false,
  onClose,
  onConfirm,
}: ConfirmActionDialogProps) {
  const { t } = useTranslation('admin');
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{message}</DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          disabled={busy}
          onClick={() => void onConfirm()}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
