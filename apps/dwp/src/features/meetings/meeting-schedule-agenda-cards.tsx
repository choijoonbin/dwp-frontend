import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, GripVertical, MoreVertical, Plus, Trash2 } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { meetingInsetSurface, meetingShape } from './meeting-visual-system';
import { moveMeetingScheduleAgenda, type MeetingScheduleDraft } from './meeting-schedule-model';

export function MeetingScheduleAgendaCards({
  draft,
  actorId,
  busy,
  update,
}: {
  draft: MeetingScheduleDraft;
  actorId: number;
  busy: boolean;
  update: (draft: MeetingScheduleDraft) => void;
}) {
  const { t } = useTranslation('meetings');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const patch = (key: string, value: Partial<MeetingScheduleDraft['agendaItems'][number]>) =>
    update({
      ...draft,
      agendaItems: draft.agendaItems.map((item) =>
        item.key === key ? { ...item, ...value } : item
      ),
    });
  return (
    <Stack gap={1.5}>
      <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
        <Typography variant="caption" color="text.secondary">
          {t('scheduleWorkspace.agendaHint')}
        </Typography>
        <Chip
          size="small"
          color="primary"
          variant="outlined"
          label={t('units.minutes', {
            count: draft.agendaItems.reduce((sum, item) => sum + item.plannedMinutes, 0),
          })}
        />
      </Stack>
      {!draft.agendaItems.length && (
        <Typography variant="body2">{t('scheduleWorkspace.agendaEmpty')}</Typography>
      )}
      <Stack component="ol" gap={1.25} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {draft.agendaItems.map((item, index) => {
          const editing = editingKey === item.key || !item.title;
          const owner =
            item.ownerUserId === actorId
              ? t('scheduleWorkspace.meHost')
              : (draft.participants.find(({ userId }) => userId === item.ownerUserId)
                  ?.displayName ??
                item.roleHint ??
                t('scheduleWorkspace.unassigned'));
          return (
            <Box
              component="li"
              key={item.key}
              sx={(theme) => ({ ...meetingInsetSurface(theme), p: { xs: 1.5, md: 2 } })}
            >
              <Stack direction="row" gap={1.25} alignItems="center">
                <GripVertical size={17} aria-hidden="true" style={{ flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                      {String(index + 1).padStart(2, '0')}.{' '}
                      {item.title || t('templates.fields.agendaTitle')}
                    </Typography>
                    <Chip
                      size="small"
                      color="primary"
                      variant="outlined"
                      label={t('units.minutes', { count: item.plannedMinutes })}
                    />
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {[owner, item.objective].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <ActionIconButton
                  label={t('scheduleWorkspace.design.editAgenda', { number: index + 1 })}
                  disabled={busy}
                  aria-expanded={editing}
                  onClick={() => setEditingKey(editing ? null : item.key)}
                >
                  <MoreVertical size={18} aria-hidden="true" />
                </ActionIconButton>
              </Stack>
              {editing && (
                <Stack gap={1.5} sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                  <FormField
                    required
                    label={t('templates.fields.agendaTitle')}
                    value={item.title}
                    inputProps={{ maxLength: 240 }}
                    disabled={busy}
                    onChange={(event) => patch(item.key, { title: event.target.value })}
                  />
                  <FormField
                    label={t('templates.fields.agendaDescription')}
                    value={item.objective}
                    inputProps={{ maxLength: 2000 }}
                    disabled={busy}
                    onChange={(event) => patch(item.key, { objective: event.target.value })}
                  />
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'minmax(0,2fr) minmax(0,1fr)' },
                      gap: 1.5,
                    }}
                  >
                    <SelectField<number>
                      label={t('scheduleWorkspace.agendaOwner')}
                      value={item.ownerUserId ?? 0}
                      disabled={busy}
                      options={[
                        { value: 0, label: t('scheduleWorkspace.unassigned') },
                        { value: actorId, label: t('scheduleWorkspace.meHost') },
                        ...draft.participants.map((person) => ({
                          value: person.userId,
                          label: person.displayName,
                        })),
                      ]}
                      onValueChange={(value) => patch(item.key, { ownerUserId: value || null })}
                    />
                    <FormField
                      required
                      type="number"
                      label={t('templates.fields.agendaMinutes')}
                      value={item.plannedMinutes}
                      inputProps={{ min: 1, max: 1440 }}
                      disabled={busy}
                      onChange={(event) =>
                        patch(item.key, { plannedMinutes: Number(event.target.value) })
                      }
                    />
                  </Box>
                  <Stack direction="row" gap={1} justifyContent="flex-end">
                    <ActionIconButton
                      label={t('templates.moveUp')}
                      disabled={busy || index === 0}
                      onClick={() => update(moveMeetingScheduleAgenda(draft, item.key, -1))}
                    >
                      <ArrowUp size={16} />
                    </ActionIconButton>
                    <ActionIconButton
                      label={t('templates.moveDown')}
                      disabled={busy || index === draft.agendaItems.length - 1}
                      onClick={() => update(moveMeetingScheduleAgenda(draft, item.key, 1))}
                    >
                      <ArrowDown size={16} />
                    </ActionIconButton>
                    <ActionIconButton
                      label={t('templates.removeAgenda')}
                      disabled={busy}
                      onClick={() =>
                        update({
                          ...draft,
                          agendaItems: draft.agendaItems.filter(
                            (candidate) => candidate.key !== item.key
                          ),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </ActionIconButton>
                    <ActionButton
                      intent="secondary"
                      size="small"
                      disabled={busy || !item.title.trim()}
                      onClick={() => setEditingKey(null)}
                    >
                      {t('scheduleWorkspace.design.finishAgenda')}
                    </ActionButton>
                  </Stack>
                </Stack>
              )}
            </Box>
          );
        })}
      </Stack>
      <ActionButton
        intent="secondary"
        startIcon={<Plus size={16} aria-hidden="true" />}
        disabled={busy || draft.agendaItems.length >= 50}
        sx={{ borderStyle: 'dashed', borderRadius: meetingShape.card, minHeight: 44 }}
        onClick={() => {
          const key = crypto.randomUUID();
          setEditingKey(key);
          update({
            ...draft,
            agendaItems: [
              ...draft.agendaItems,
              { key, title: '', objective: '', ownerUserId: null, plannedMinutes: 5 },
            ],
          });
        }}
      >
        {t('templates.addAgenda')}
      </ActionButton>
      <Typography variant="caption" color="text.secondary">
        {t('scheduleWorkspace.agendaTotal', {
          minutes: draft.agendaItems.reduce((sum, item) => sum + item.plannedMinutes, 0),
          duration: draft.durationMinutes,
        })}
      </Typography>
    </Stack>
  );
}
