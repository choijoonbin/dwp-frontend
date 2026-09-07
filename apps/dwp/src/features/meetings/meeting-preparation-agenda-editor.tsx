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
  InlineFeedback,
  SelectField,
  foundationTokens,
} from '@dwp-frontend/design-system';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type {
  VideoMeetingAgendaInput,
  VideoMeetingPreparation,
} from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  editablePreparationAgenda,
  movePreparationAgenda,
  normalizePreparationAgenda,
  preparationAgendaError,
  preparationOwners,
} from './meeting-preparation-model';

export function MeetingPreparationAgendaEditor({
  initial,
  latest,
  meeting,
  busy,
  conflict,
  commandError,
  onClose,
  onSubmit,
}: {
  initial: VideoMeetingPreparation;
  latest: VideoMeetingPreparation;
  meeting: VideoMeetingSummary;
  busy: boolean;
  conflict: boolean;
  commandError: boolean;
  onClose: () => void;
  onSubmit: (items: VideoMeetingAgendaInput[], version: number) => void;
}) {
  const { t } = useTranslation('meetings');
  const [items, setItems] = useState(() => editablePreparationAgenda(initial));
  const [baseVersion, setBaseVersion] = useState(initial.agendaVersion);
  const [reviewing, setReviewing] = useState(false);
  const [reviewedVersion, setReviewedVersion] = useState<number | null>(null);
  const [discard, setDiscard] = useState(false);
  const dirty = JSON.stringify(items) !== JSON.stringify(editablePreparationAgenda(initial));
  const blocker = useBlocker(dirty);
  const changed = baseVersion !== latest.agendaVersion;
  const mustReview = changed || (conflict && reviewedVersion !== latest.agendaVersion);
  const error = preparationAgendaError(items, meeting);
  const owners = preparationOwners(meeting);
  useEffect(() => {
    if (conflict) setReviewedVersion(null);
  }, [conflict, latest.agendaVersion]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  const patch = (index: number, value: Partial<VideoMeetingAgendaInput>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...value } : item)));
  return (
    <>
      <FormDialog
        open
        title={t('preparation.editAgenda')}
        description={t('preparation.agendaEditorHint')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('preparation.saveAgenda')}
        busy={busy}
        submitDisabled={Boolean(error) || !latest.canEditAgenda || mustReview}
        maxWidth="md"
        onClose={() => (dirty ? setDiscard(true) : onClose())}
        onSubmit={() => {
          if (!error && !busy && latest.canEditAgenda && !mustReview)
            onSubmit(normalizePreparationAgenda(items), baseVersion);
        }}
      >
        <Stack gap={2}>
          {commandError && (
            <InlineFeedback severity="error">{t('preparation.commandError')}</InlineFeedback>
          )}
          {!latest.canEditAgenda && (
            <InlineFeedback severity="warning">{t('preparation.editNotAllowed')}</InlineFeedback>
          )}
          {(changed || conflict) && (
            <InlineFeedback severity="warning">
              <Typography variant="body2">{t('preparation.agendaConflict')}</Typography>
              <ActionButton intent="quiet" onClick={() => setReviewing(true)}>
                {t('preparation.reviewLatest')}
              </ActionButton>
              {reviewing && (
                <Stack gap={1} sx={{ mt: 1 }}>
                  <Typography variant="subtitle2">
                    {t('preparation.latestAgenda', { version: latest.agendaVersion })}
                  </Typography>
                  <Box component="ol" sx={{ pl: 2, m: 0 }}>
                    {latest.agendaItems.map((item) => (
                      <li key={item.itemId}>
                        <Typography variant="body2">{item.title}</Typography>
                      </li>
                    ))}
                  </Box>
                  <ActionButton
                    intent="secondary"
                    disabled={!latest.canEditAgenda}
                    onClick={() => {
                      setBaseVersion(latest.agendaVersion);
                      setReviewedVersion(latest.agendaVersion);
                    }}
                  >
                    {t('preparation.confirmLatest')}
                  </ActionButton>
                </Stack>
              )}
            </InlineFeedback>
          )}
          {items.map((item, index) => (
            <Stack
              key={item.itemId ?? `new-${index}`}
              gap={1.5}
              sx={{
                p: 2,
                border: 1,
                borderColor: 'divider',
                borderRadius: foundationTokens.radius.surface + 'px',
              }}
            >
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Typography variant="subtitle2" sx={{ flex: 1 }}>
                  {t('preparation.agendaNumber', { count: index + 1 })}
                </Typography>
                <ActionIconButton
                  label={t('preparation.moveUp')}
                  disabled={busy || index === 0}
                  onClick={() => setItems((current) => movePreparationAgenda(current, index, -1))}
                >
                  <ArrowUp size={16} />
                </ActionIconButton>
                <ActionIconButton
                  label={t('preparation.moveDown')}
                  disabled={busy || index === items.length - 1}
                  onClick={() => setItems((current) => movePreparationAgenda(current, index, 1))}
                >
                  <ArrowDown size={16} />
                </ActionIconButton>
                <ActionIconButton
                  label={t('preparation.removeAgenda')}
                  disabled={busy}
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 size={16} />
                </ActionIconButton>
              </Stack>
              <FormField
                required
                label={t('preparation.fields.title')}
                value={item.title}
                disabled={busy}
                inputProps={{ maxLength: 240 }}
                onChange={(event) => patch(index, { title: event.target.value })}
              />
              <FormField
                multiline
                minRows={2}
                label={t('preparation.fields.objective')}
                value={item.objective ?? ''}
                disabled={busy}
                inputProps={{ maxLength: 2000 }}
                onChange={(event) => patch(index, { objective: event.target.value })}
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5,
                }}
              >
                <SelectField<number>
                  label={t('preparation.fields.owner')}
                  value={item.ownerUserId ?? 0}
                  disabled={busy}
                  options={[
                    { value: 0, label: t('preparation.unassigned') },
                    ...owners.map((person) => ({
                      value: person.userId,
                      label: person.displayName,
                    })),
                  ]}
                  onValueChange={(value) =>
                    patch(index, { ownerUserId: value ? Number(value) : null })
                  }
                />
                <FormField
                  type="number"
                  label={t('preparation.fields.minutes')}
                  value={item.plannedMinutes ?? ''}
                  disabled={busy}
                  inputProps={{ min: 1, max: 1440 }}
                  onChange={(event) =>
                    patch(index, {
                      plannedMinutes: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                />
              </Box>
            </Stack>
          ))}
          <ActionButton
            intent="secondary"
            disabled={busy || items.length >= 50}
            startIcon={<Plus size={16} />}
            onClick={() =>
              setItems((current) => [
                ...current,
                { title: '', objective: null, ownerUserId: null, plannedMinutes: null },
              ])
            }
          >
            {t('preparation.addAgenda')}
          </ActionButton>
          {error && (
            <InlineFeedback severity="warning">
              {t('preparation.validation.' + error)}
            </InlineFeedback>
          )}
        </Stack>
      </FormDialog>
      <ConfirmDialog
        open={discard || blocker.state === 'blocked'}
        title={t('preparation.discardTitle')}
        description={t('preparation.discardDescription')}
        confirmLabel={t('preparation.discard')}
        cancelLabel={t('preparation.keepEditing')}
        intent="danger"
        onClose={() => {
          setDiscard(false);
          if (blocker.state === 'blocked') blocker.reset();
        }}
        onConfirm={() => {
          setDiscard(false);
          if (blocker.state === 'blocked') blocker.proceed();
          else onClose();
        }}
      />
    </>
  );
}
