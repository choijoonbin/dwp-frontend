import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import type { VideoMeetingTemplateInput } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  MEETING_TEMPLATE_CATEGORIES,
  meetingTemplateInputError,
  moveTemplateAgenda,
  normalizeMeetingTemplateInput,
} from './meeting-template-model';

type Props = {
  initial: VideoMeetingTemplateInput;
  editing: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: VideoMeetingTemplateInput) => void;
};

export function MeetingTemplateEditor({ initial, editing, busy, onClose, onSubmit }: Props) {
  const { t } = useTranslation('meetings');
  const [form, setForm] = useState(initial);
  const [discardOpen, setDiscardOpen] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const blocker = useBlocker(dirty);
  const error = meetingTemplateInputError(form);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  const patchItem = (
    index: number,
    patch: Partial<VideoMeetingTemplateInput['agendaItems'][number]>
  ) =>
    setForm((current) => ({
      ...current,
      agendaItems: current.agendaItems.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      ),
    }));
  return (
    <>
      <FormDialog
        open
        title={t(editing ? 'templates.edit' : 'templates.create')}
        description={t('templates.editorDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('templates.save')}
        busy={busy}
        submitDisabled={Boolean(error)}
        maxWidth="md"
        onClose={() => (dirty ? setDiscardOpen(true) : onClose())}
        onSubmit={() => {
          if (!error && !busy) onSubmit(normalizeMeetingTemplateInput(form));
        }}
      >
        <Stack gap={2}>
          <FormField
            autoFocus
            required
            label={t('templates.fields.name')}
            value={form.name}
            inputProps={{ maxLength: 160 }}
            disabled={busy}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <FormField
            label={t('templates.fields.purpose')}
            value={form.purpose}
            multiline
            minRows={2}
            inputProps={{ maxLength: 2000 }}
            disabled={busy}
            onChange={(event) =>
              setForm((current) => ({ ...current, purpose: event.target.value }))
            }
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: '1fr 1fr' },
              gap: 2,
            }}
          >
            <SelectField<string>
              label={t('templates.fields.category')}
              value={form.category}
              disabled={busy}
              options={[...new Set([...MEETING_TEMPLATE_CATEGORIES, form.category])].map(
                (value) => ({
                  value,
                  label: MEETING_TEMPLATE_CATEGORIES.some((known) => known === value)
                    ? t('templates.categories.' + value)
                    : value,
                })
              )}
              onValueChange={(value) => {
                if (value) setForm((current) => ({ ...current, category: value }));
              }}
            />
            <FormField
              required
              type="number"
              label={t('templates.fields.duration')}
              value={form.durationMinutes}
              inputProps={{ min: 5, max: 1440, step: 1 }}
              disabled={busy}
              onChange={(event) =>
                setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))
              }
            />
          </Box>
          <Typography variant="subtitle1" component="h2">
            {t('templates.agenda')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('templates.agendaEditorHint')}
          </Typography>
          {form.agendaItems.map((item, index) => (
            <Box key={index} sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle2">
                  {t('templates.agendaNumber', { count: index + 1 })}
                </Typography>
                <Stack direction="row" gap={0.5}>
                  <ActionIconButton
                    label={t('templates.moveUp')}
                    disabled={busy || index === 0}
                    onClick={() => setForm((current) => moveTemplateAgenda(current, index, -1))}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </ActionIconButton>
                  <ActionIconButton
                    label={t('templates.moveDown')}
                    disabled={busy || index === form.agendaItems.length - 1}
                    onClick={() => setForm((current) => moveTemplateAgenda(current, index, 1))}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </ActionIconButton>
                  <ActionIconButton
                    label={t('templates.removeAgenda')}
                    disabled={busy}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        agendaItems: current.agendaItems.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </ActionIconButton>
                </Stack>
              </Stack>
              <Stack gap={1.5}>
                <FormField
                  required
                  label={t('templates.fields.agendaTitle')}
                  value={item.title}
                  inputProps={{ maxLength: 240 }}
                  disabled={busy}
                  onChange={(event) => patchItem(index, { title: event.target.value })}
                />
                <FormField
                  label={t('templates.fields.agendaDescription')}
                  value={item.description}
                  multiline
                  minRows={2}
                  inputProps={{ maxLength: 2000 }}
                  disabled={busy}
                  onChange={(event) => patchItem(index, { description: event.target.value })}
                />
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' },
                    gap: 1.5,
                  }}
                >
                  <FormField
                    label={t('templates.fields.role')}
                    value={item.role}
                    inputProps={{ maxLength: 80 }}
                    disabled={busy}
                    onChange={(event) => patchItem(index, { role: event.target.value })}
                  />
                  <FormField
                    required
                    type="number"
                    label={t('templates.fields.agendaMinutes')}
                    value={item.durationMinutes}
                    inputProps={{ min: 1, max: 1440, step: 1 }}
                    disabled={busy}
                    onChange={(event) =>
                      patchItem(index, { durationMinutes: Number(event.target.value) })
                    }
                  />
                </Box>
              </Stack>
            </Box>
          ))}
          <ActionButton
            intent="secondary"
            startIcon={<Plus size={16} aria-hidden="true" />}
            disabled={busy || form.agendaItems.length >= 50}
            onClick={() =>
              setForm((current) => ({
                ...current,
                agendaItems: [
                  ...current.agendaItems,
                  { title: '', description: '', role: '', durationMinutes: 5 },
                ],
              }))
            }
          >
            {t('templates.addAgenda')}
          </ActionButton>
          {error && (
            <Typography role="status" variant="body2" color="text.secondary">
              {t('templates.validation.' + error)}
            </Typography>
          )}
        </Stack>
      </FormDialog>
      <ConfirmDialog
        open={discardOpen || blocker.state === 'blocked'}
        title={t('templates.discardTitle')}
        description={t('templates.discardDescription')}
        cancelLabel={t('templates.keepEditing')}
        confirmLabel={t('templates.discard')}
        busy={busy}
        onClose={() => {
          setDiscardOpen(false);
          if (blocker.state === 'blocked') blocker.reset();
        }}
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed();
          else onClose();
        }}
      />
    </>
  );
}
